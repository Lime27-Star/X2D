/* X2D Academy — instructor dashboard. An instructor signs in with their own username + password
   (created by an admin from /admin) and only ever sees and edits their own students and schedule. */
(function () {
'use strict';

var $ = function (s, r) { return (r || document).querySelector(s); };
function h(tag, props) {
  var e = document.createElement(tag);
  if (props) Object.keys(props).forEach(function (k) {
    var v = props[k];
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  });
  for (var i = 2; i < arguments.length; i++) {
    var c = arguments[i];
    if (c == null || c === false) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

var state = { name: '', students: [], sessions: [], tab: 'students' };

var ERR = {
  wrong_credentials: 'Wrong username or password.',
  too_many: 'Too many attempts. Wait 15 minutes and try again.',
  name: 'Enter the student’s name (at least 2 characters).',
  email: 'That email address doesn’t look right.',
  title: 'Enter a session title.',
  datetime: 'Enter a valid date and time.',
  not_found: 'That record no longer exists.',
  forbidden: 'That record belongs to a different instructor.',
  unauthorized: 'Your session ended. Sign in again.',
  store_not_configured: 'The database is not connected yet. Ask the admin to check Vercel’s Storage settings.',
  store_unreachable: 'Could not reach the database. Try again in a minute.',
  store_error: 'The database returned an error. Try again.'
};
var msg = function (e) { return ERR[e && e.message] || 'Something went wrong (' + (e && e.message) + ').'; };

async function api(action, payload) {
  var r = await fetch('/api/x2d?r=instructor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'x2d' },
    body: JSON.stringify(Object.assign({ action: action }, payload || {}))
  });
  var j = {};
  try { j = await r.json(); } catch (e) { /* empty */ }
  if (!r.ok) { var err = new Error(j.error || ('http_' + r.status)); err.status = r.status; throw err; }
  return j;
}

var toastTimer;
function toast(text, bad) {
  var t = $('#toast'); t.textContent = text; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = ''; }, 4200);
}
function banner(text) { var b = $('#banner'); b.textContent = text || ''; b.hidden = !text; }
function fail(e) {
  if (e && e.status === 401) { showLogin(msg(e)); return; }
  toast(msg(e), true);
  if (e && (e.message === 'store_not_configured' || e.message === 'store_unreachable')) banner(msg(e));
}
function fmtWhen(iso) {
  var t = new Date(iso);
  return isNaN(t) ? iso : t.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function toLocalInput(iso) {
  var t = new Date(iso); if (isNaN(t)) return '';
  var p = function (n) { return String(n).padStart(2, '0'); };
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()) + 'T' + p(t.getHours()) + ':' + p(t.getMinutes());
}
function cap(s) { return (s || '').replace(/^./, function (c) { return c.toUpperCase(); }); }

/* Never access form controls as f.name / f.title / f.method, etc.
   Those names can collide with native HTMLFormElement/HTMLElement properties. */
function field(form, id) { return document.getElementById(id); }
function value(form, id) { return field(form, id).value; }
function setValue(form, id, v) { field(form, id).value = v == null ? '' : v; }

/* ---------- students ---------- */
function renderStudents() {
  var body = $('#studBody');
  var q = ($('#studSearch').value || '').trim().toLowerCase();
  var rows = state.students.filter(function (s) {
    if (!q) return true;
    return (s.name + ' ' + (s.phone || '') + ' ' + (s.email || '')).toLowerCase().indexOf(q) !== -1;
  });
  $('#nStudents').textContent = state.students.length; body.textContent = '';
  if (!rows.length) { body.appendChild(h('tr', null, h('td', { colspan: 6, class: 'empty', text: state.students.length ? 'No student matches.' : 'No students yet. Use "Add student".' }))); return; }
  rows.forEach(function (s) {
    body.appendChild(h('tr', null,
      h('td', null, h('b', { text: s.name }), h('div', { class: 'sub', text: [s.phone, s.email].filter(Boolean).join(' · ') })),
      h('td', null, s.level || '—', s.cohort ? h('div', { class: 'sub', text: s.cohort }) : null),
      h('td', null, h('span', { class: 'pill ' + (s.status === 'active' ? 'ok' : (s.status === 'dropped' ? 'bad' : '')), text: cap(s.status || 'active') })),
      h('td', null, h('span', { class: 'pill ' + (s.payment === 'paid' ? 'ok' : (s.payment === 'overdue' ? 'bad' : '')), text: cap(s.payment || 'pending') })),
      h('td', { class: 'goal', text: s.progress || '—' }),
      h('td', { class: 'acts' },
        h('button', { class: 'lnk', type: 'button', text: 'Edit', onclick: function () { openStudentEdit(s); } }),
        h('button', { class: 'lnk danger', type: 'button', text: 'Delete', onclick: function () { removeStudent(s); } })
      )));
  });
}
var editingStudent = null;
function openAddStudent() {
  editingStudent = null; var f = $('#studForm'); f.reset(); $('#studDlgTitle').textContent = 'Add student'; $('#studErr').textContent = '';
  setValue(f, 's-status', 'active'); setValue(f, 's-payment', 'pending'); $('#studDlg').showModal();
}
function openStudentEdit(s) {
  editingStudent = s; var f = $('#studForm');
  setValue(f, 's-name', s.name); setValue(f, 's-phone', s.phone); setValue(f, 's-email', s.email);
  setValue(f, 's-level', s.level || 'Level 1'); setValue(f, 's-cohort', s.cohort); setValue(f, 's-status', s.status || 'active'); setValue(f, 's-payment', s.payment || 'pending');
  setValue(f, 's-progress', s.progress); setValue(f, 's-notes', s.notes);
  $('#studDlgTitle').textContent = 'Edit student'; $('#studErr').textContent = ''; $('#studDlg').showModal();
}
async function removeStudent(s) {
  if (!window.confirm('Delete ' + s.name + ' permanently?')) return;
  try { await api('student_delete', { id: s.id }); state.students = state.students.filter(function (x) { return x.id !== s.id; }); renderStudents(); toast('Student deleted.'); }
  catch (e) { fail(e); }
}

/* ---------- sessions ---------- */
function renderSessions() {
  var body = $('#sessBody'); $('#nSchedule').textContent = state.sessions.length; body.textContent = '';
  if (!state.sessions.length) { body.appendChild(h('tr', null, h('td', { colspan: 5, class: 'empty', text: 'No sessions yet. Use "Add session".' }))); return; }
  state.sessions.forEach(function (s) {
    body.appendChild(h('tr', null,
      h('td', null, fmtWhen(s.datetime), h('div', { class: 'sub', text: s.duration + ' min' })),
      h('td', null, h('b', { text: s.title }), s.notes ? h('div', { class: 'sub', text: s.notes }) : null),
      h('td', null, s.level || '—', s.cohort ? h('div', { class: 'sub', text: s.cohort }) : null),
      h('td', null, h('span', { class: 'pill ' + (s.status === 'done' ? 'ok' : (s.status === 'cancelled' ? 'bad' : '')), text: cap(s.status || 'scheduled') }),
        h('span', { style: 'margin-inline-start:.6em' },
          h('button', { class: 'lnk', type: 'button', text: 'Edit', onclick: function () { openSessionEdit(s); } }),
          h('button', { class: 'lnk danger', type: 'button', text: 'Delete', onclick: function () { removeSession(s); } })))
    ));
  });
}
var editingSession = null;
function openAddSession() {
  editingSession = null; var f = $('#sessForm'); f.reset(); $('#sessDlgTitle').textContent = 'Add session'; $('#sessErr').textContent = '';
  setValue(f, 'sc-dur', 120); setValue(f, 'sc-status', 'scheduled'); $('#sessDlg').showModal();
}
function openSessionEdit(s) {
  editingSession = s; var f = $('#sessForm');
  setValue(f, 'sc-title', s.title); setValue(f, 'sc-when', toLocalInput(s.datetime)); setValue(f, 'sc-dur', s.duration || 120);
  setValue(f, 'sc-level', s.level); setValue(f, 'sc-cohort', s.cohort); setValue(f, 'sc-status', s.status || 'scheduled'); setValue(f, 'sc-notes', s.notes);
  $('#sessDlgTitle').textContent = 'Edit session'; $('#sessErr').textContent = ''; $('#sessDlg').showModal();
}
async function removeSession(s) {
  if (!window.confirm('Delete the session "' + s.title + '"?')) return;
  try { await api('session_delete', { id: s.id }); state.sessions = state.sessions.filter(function (x) { return x.id !== s.id; }); renderSessions(); toast('Session deleted.'); }
  catch (e) { fail(e); }
}

async function loadAll() {
  banner('');
  try { state.students = (await api('students_list')).students; renderStudents(); } catch (e) { renderStudents(); fail(e); }
  try { state.sessions = (await api('sessions_list')).sessions; renderSessions(); } catch (e) { renderSessions(); if (e.status === 401) fail(e); }
}

/* ---------- views ---------- */
function showLogin(message) {
  $('#app').hidden = true; $('#login').hidden = false; $('#signOut').hidden = true; $('#whoami').textContent = '';
  $('#loginErr').textContent = message || ''; $('#pw').value = ''; setTimeout(function () { $('#u').focus(); }, 50);
}
function showApp() { $('#login').hidden = true; $('#app').hidden = false; $('#signOut').hidden = false; $('#whoami').textContent = state.name || ''; }
function setTab(t) {
  state.tab = t;
  $('#paneStudents').hidden = t !== 'students'; $('#paneSchedule').hidden = t !== 'schedule';
  $('#tabStudents').setAttribute('aria-selected', t === 'students'); $('#tabSchedule').setAttribute('aria-selected', t === 'schedule');
}

async function boot() {
  $('#loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = $('#loginBtn'); btn.disabled = true; $('#loginErr').textContent = '';
    try { var r = await api('login', { username: $('#u').value, password: $('#pw').value }); state.name = r.name; await start(); }
    catch (err) { $('#loginErr').textContent = msg(err); }
    finally { btn.disabled = false; }
  });
  $('#signOut').addEventListener('click', async function () { try { await api('logout'); } catch (e) { /* ignore */ } showLogin(''); });
  $('#tabStudents').addEventListener('click', function () { setTab('students'); });
  $('#tabSchedule').addEventListener('click', function () { setTab('schedule'); });

  /* students */
  $('#addStudBtn').addEventListener('click', openAddStudent);
  $('#studCancel').addEventListener('click', function () { $('#studDlg').close(); });
  $('#studSearch').addEventListener('input', renderStudents);
  $('#studForm').addEventListener('submit', async function (e) {
    e.preventDefault(); var f = e.target;
    var payload = {
      name: value(f, 's-name'), phone: value(f, 's-phone'), email: value(f, 's-email'),
      level: value(f, 's-level'), cohort: value(f, 's-cohort'), status: value(f, 's-status'),
      payment: value(f, 's-payment'), progress: value(f, 's-progress'), notes: value(f, 's-notes')
    };
    try {
      var r;
      if (editingStudent) { payload.id = editingStudent.id; r = await api('student_update', payload); Object.assign(editingStudent, r.record); }
      else { r = await api('student_create', payload); state.students.unshift(r.record); }
      renderStudents(); $('#studDlg').close(); toast('Saved.');
    } catch (err) { $('#studErr').textContent = msg(err); }
  });

  /* sessions */
  $('#addSessBtn').addEventListener('click', openAddSession);
  $('#sessCancel').addEventListener('click', function () { $('#sessDlg').close(); });
  $('#sessForm').addEventListener('submit', async function (e) {
    e.preventDefault(); var f = e.target;
    var payload = {
      title: value(f, 'sc-title'), datetime: value(f, 'sc-when'), duration: value(f, 'sc-dur'),
      level: value(f, 'sc-level'), cohort: value(f, 'sc-cohort'), status: value(f, 'sc-status'),
      notes: value(f, 'sc-notes')
    };
    try {
      var r;
      if (editingSession) { payload.id = editingSession.id; r = await api('session_update', payload); Object.assign(editingSession, r.record); }
      else { r = await api('session_create', payload); state.sessions.push(r.record); }
      state.sessions.sort(function (a, b) { return String(a.datetime).localeCompare(String(b.datetime)); });
      renderSessions(); $('#sessDlg').close(); toast('Saved.');
    } catch (err) { $('#sessErr').textContent = msg(err); }
  });

  try { var me = await api('me'); state.name = me.name; await start(true); }
  catch (e) { showLogin(e.status === 401 ? '' : msg(e)); }
}
async function start(already) {
  if (!already) { var me = await api('me'); state.name = me.name; }
  showApp(); setTab('students'); await loadAll();
}
boot();

})();
