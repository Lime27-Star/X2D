'use strict';
/* X2D Academy backend (one Vercel serverless function, no dependencies).
 *
 *   GET  /api/x2d?r=verify&id=X2D-XXXX-XXXX-XXXX   public  : look up one certificate
 *   POST /api/x2d?r=enroll                         public  : enrollment form
 *   POST /api/x2d?r=admin                          private : admin dashboard (password + cookie session)
 *
 * Environment variables (Vercel -> Project -> Settings -> Environment Variables):
 *   ADMIN_PASSWORD         required   password for /admin
 *   ADMIN_SESSION_SECRET   recommended  any long random string (signs the login cookie)
 *   KV_REST_API_URL / KV_REST_API_TOKEN   added automatically when you connect an Upstash Redis
 *                          database to the project (UPSTASH_REDIS_REST_URL / _TOKEN also work)
 *   SITE_URL               optional   defaults to https://x-2d.vercel.app  (used inside QR codes)
 *   RESEND_API_KEY, NOTIFY_EMAIL, NOTIFY_FROM   optional   email you when someone applies
 */
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0, 1
const LEVELS = ['', 'Complete beginner', 'Comfortable with computers', 'IT or security experience'];
const SESSION_SECONDS = 12 * 3600;
const CERTS = 'x2d:certs';   // hash: normalized ID -> JSON
const APPS = 'x2d:apps';     // hash: application id -> JSON

const env = (k) => process.env[k] || '';
const siteUrl = () => (env('SITE_URL') || 'https://x-2d.vercel.app').replace(/\/+$/, '');

/* ------------------------------------------------------------------ storage (Upstash Redis over HTTPS) */
class StoreError extends Error {}
async function redis(cmd) {
  const url = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) throw new StoreError('store_not_configured');
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  } catch (e) { throw new StoreError('store_unreachable'); }
  let j = {};
  try { j = await r.json(); } catch (e) { /* empty */ }
  if (!r.ok || j.error) throw new StoreError('store_error');
  return j.result;
}
async function hgetall(key) {
  const r = await redis(['HGETALL', key]);
  if (!r) return {};
  if (Array.isArray(r)) { const o = {}; for (let i = 0; i < r.length; i += 2) o[r[i]] = r[i + 1]; return o; }
  return r;
}
const parseAll = (o) => Object.values(o).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);

/* ------------------------------------------------------------------ small helpers */
function send(res, status, obj, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (headers) for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(obj));
}
function redirect(res, to) { res.statusCode = 303; res.setHeader('Location', to); res.setHeader('Cache-Control', 'no-store'); res.end(); }

function parseBody(raw, ct) {
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  const s = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '');
  if (!s) return {};
  if (/json/i.test(ct)) { try { return JSON.parse(s); } catch (e) { return null; } }
  if (/x-www-form-urlencoded/i.test(ct)) return Object.fromEntries(new URLSearchParams(s));
  try { return JSON.parse(s); } catch (e) { return Object.fromEntries(new URLSearchParams(s)); }
}
async function readBody(req) {
  const ct = req.headers['content-type'] || '';
  if (req.body !== undefined) return parseBody(req.body, ct);   // Vercel pre-parses JSON / form bodies
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 100000) return null; chunks.push(c); }
  return parseBody(Buffer.concat(chunks), ct);
}

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));
const isHttps = (req) => String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
function newId() {
  let s = '';
  for (let i = 0; i < 12; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `X2D-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
function ipHash(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'x';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}
/* best-effort rate limit; if the counter itself fails we never block real users */
async function allow(bucket, req, max, windowSec) {
  try {
    const key = `x2d:rl:${bucket}:${ipHash(req)}`;
    const n = await redis(['INCR', key]);
    if (n === 1) await redis(['EXPIRE', key, windowSec]);
    return n <= max;
  } catch (e) { return true; }
}

/* ------------------------------------------------------------------ admin session (signed cookie) */
const b64u = (x) => Buffer.from(x).toString('base64url');
const sessionKey = () => crypto.createHash('sha256').update('x2d-admin|' + (env('ADMIN_SESSION_SECRET') || env('ADMIN_PASSWORD'))).digest();
function sign(payload) {
  const p = b64u(JSON.stringify(payload));
  return p + '.' + crypto.createHmac('sha256', sessionKey()).update(p).digest('base64url');
}
function readSession(req) {
  const m = /(?:^|;\s*)x2d_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const parts = m[1].split('.');
  if (parts.length !== 2) return null;
  const good = crypto.createHmac('sha256', sessionKey()).update(parts[0]).digest('base64url');
  const a = Buffer.from(parts[1]), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return d.exp > Date.now() / 1000 ? d : null;
  } catch (e) { return null; }
}
const sessionCookie = (val, maxAge, req) =>
  `x2d_admin=${val}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}` + (isHttps(req) ? '; Secure' : '');
function passwordOk(input) {
  const a = crypto.createHash('sha256').update(String(input == null ? '' : input)).digest();
  const b = crypto.createHash('sha256').update(env('ADMIN_PASSWORD')).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ public: verify a certificate */
async function verify(req, res, url) {
  const idNorm = norm(url.searchParams.get('id'));
  if (idNorm.length < 6 || idNorm.length > 30) return send(res, 404, { ok: false });
  if (!(await allow('verify', req, 40, 60))) return send(res, 429, { error: 'slow_down' });
  let raw;
  try { raw = await redis(['HGET', CERTS, idNorm]); } catch (e) { return send(res, 503, { error: e.message }); }
  if (!raw) return send(res, 404, { ok: false });
  let r;
  try { r = JSON.parse(raw); } catch (e) { return send(res, 404, { ok: false }); }
  return send(res, 200, { ok: true, record: { id: r.id, name: r.name, date: r.date, level: r.level, exam: r.exam || {}, status: r.status || 'valid' } });
}

/* ------------------------------------------------------------------ public: enrollment form */
async function enroll(req, res) {
  const asJson = /json/i.test(req.headers.accept || '') || /json/i.test(req.headers['content-type'] || '');
  const fail = (status, code) => asJson ? send(res, status, { error: code }) : redirect(res, '/#contact');
  const body = await readBody(req);
  if (!body || typeof body !== 'object') return fail(400, 'bad_request');

  if (clean(body['bot-field'], 50)) return asJson ? send(res, 200, { ok: true }) : redirect(res, '/thanks.html'); // bots: pretend success

  const name = clean(body.name, 120);
  const phone = clean(body.phone, 30);
  const digits = phone.replace(/\D/g, '');
  const email = clean(body.email, 160);
  const level = LEVELS.includes(clean(body.level, 60)) ? clean(body.level, 60) : '';
  const goal = String(body.goal == null ? '' : body.goal).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 800);
  const language = body.language === 'ar' ? 'ar' : 'en';
  if (name.length < 2) return fail(400, 'name');
  if (!/^\+?[\d\s\-().]+$/.test(phone) || digits.length < 8 || digits.length > 15) return fail(400, 'phone');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'email');

  if (!(await allow('enroll', req, 6, 600))) return fail(429, 'slow_down');

  const rec = { id: crypto.randomBytes(6).toString('hex'), at: new Date().toISOString(), name, phone, email, level, goal, language };
  try { await redis(['HSET', APPS, rec.id, JSON.stringify(rec)]); } catch (e) { return fail(503, e.message); }
  await notify(rec);
  return asJson ? send(res, 200, { ok: true }) : redirect(res, '/thanks.html');
}
async function notify(rec) {
  const key = env('RESEND_API_KEY'), to = env('NOTIFY_EMAIL');
  if (!key || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('NOTIFY_FROM') || 'X2D Academy <onboarding@resend.dev>',
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: 'New X2D enrollment request: ' + rec.name,
        text: ['Name: ' + rec.name, 'WhatsApp: ' + rec.phone, 'Email: ' + (rec.email || '-'), 'Level: ' + (rec.level || '-'),
               'Language: ' + rec.language, '', 'Goal:', rec.goal || '-', '', 'Open the dashboard: ' + siteUrl() + '/admin'].join('\n')
      })
    });
  } catch (e) { /* the request is already saved; a failed email must not fail the form */ }
}

/* ------------------------------------------------------------------ private: admin dashboard */
function certFromInput(b, base) {
  const name = clean(b.name, 120);
  if (name.length < 2) return { error: 'name' };
  if (!isDate(b.date)) return { error: 'date' };
  const examDate = b.examDate ? String(b.examDate) : '';
  if (examDate && !isDate(examDate)) return { error: 'examDate' };
  const exam = { result: clean(b.examResult, 40) || 'Passed' };
  if (examDate) exam.date = examDate;
  return Object.assign({}, base, { name, date: b.date, level: clean(b.level, 30) || (base && base.level) || 'Level 3', exam });
}

async function admin(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!env('ADMIN_PASSWORD')) return send(res, 503, { error: 'admin_not_configured' });
  if (req.headers['x-requested-with'] !== 'x2d') return send(res, 403, { error: 'forbidden' });
  const b = await readBody(req);
  if (!b || typeof b !== 'object') return send(res, 400, { error: 'bad_request' });
  const action = String(b.action || '');

  if (action === 'login') {
    if (!(await allow('login', req, 8, 900))) return send(res, 429, { error: 'too_many' });
    if (!passwordOk(b.password)) { await new Promise((r) => setTimeout(r, 600)); return send(res, 401, { error: 'wrong_password' }); }
    const token = sign({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS });
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS, req) });
  }
  if (action === 'logout') return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0, req) });
  if (!readSession(req)) return send(res, 401, { error: 'unauthorized' });

  try {
    switch (action) {
      case 'me':
        return send(res, 200, { ok: true, siteUrl: siteUrl() });

      case 'list': {
        const certs = parseAll(await hgetall(CERTS)).sort((x, y) => String(y.issuedAt).localeCompare(String(x.issuedAt)));
        return send(res, 200, { ok: true, certs });
      }
      case 'apps': {
        const apps = parseAll(await hgetall(APPS)).sort((x, y) => String(y.at).localeCompare(String(x.at)));
        return send(res, 200, { ok: true, apps });
      }
      case 'issue': {
        const base = { status: 'valid', issuedAt: new Date().toISOString() };
        for (let i = 0; i < 6; i++) {
          const id = newId();
          const rec = certFromInput(b, Object.assign({ id }, base));
          if (rec.error) return send(res, 400, { error: rec.error });
          const added = await redis(['HSETNX', CERTS, norm(id), JSON.stringify(rec)]);
          if (Number(added) === 1) return send(res, 200, { ok: true, record: rec });
        }
        return send(res, 500, { error: 'id_collision' });
      }
      case 'update': case 'revoke': case 'restore': {
        const key = norm(b.id);
        const raw = key ? await redis(['HGET', CERTS, key]) : null;
        if (!raw) return send(res, 404, { error: 'not_found' });
        let rec = JSON.parse(raw);
        if (action === 'update') {
          rec = certFromInput(b, rec);
          if (rec.error) return send(res, 400, { error: rec.error });
        } else if (action === 'revoke') { rec.status = 'revoked'; rec.revokedAt = new Date().toISOString(); }
        else { rec.status = 'valid'; delete rec.revokedAt; }
        await redis(['HSET', CERTS, key, JSON.stringify(rec)]);
        return send(res, 200, { ok: true, record: rec });
      }
      case 'delete':
        await redis(['HDEL', CERTS, norm(b.id)]);
        return send(res, 200, { ok: true });
      case 'delete_app':
        await redis(['HDEL', APPS, clean(b.id, 40)]);
        return send(res, 200, { ok: true });
      default:
        return send(res, 400, { error: 'unknown_action' });
    }
  } catch (e) {
    if (e instanceof StoreError) return send(res, 503, { error: e.message });
    throw e;
  }
}

/* ------------------------------------------------------------------ router */
module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const route = url.searchParams.get('r');
    if (route === 'verify' && req.method === 'GET') return await verify(req, res, url);
    if (route === 'enroll' && req.method === 'POST') return await enroll(req, res);
    if (route === 'admin') return await admin(req, res);
    return send(res, 404, { error: 'not_found' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'server' });
  }
};
