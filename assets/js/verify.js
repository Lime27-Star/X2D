/* Certificate verification.
   The public file assets/data/certs.json holds only encrypted records. Each record can be opened
   only with the certificate's own ID (which is in the QR code), so the file can't be used to list students. */
(function () {
  var d = document.documentElement;
  var out = document.getElementById('vOut'), form = document.getElementById('vForm'), input = document.getElementById('vId');
  var state = { kind: 'idle' };

  var S = {
    en: {
      checking: 'Checking…',
      noneT: 'We couldn’t find this certificate.',
      noneB: 'This ID doesn’t match any certificate issued by X2D Academy. Check the ID and try again, or scan the QR code again.',
      errT: 'We couldn’t check right now.',
      errB: 'Check your connection and try again.',
      verified: 'Verified',
      issued: 'This certificate was issued by X2D Academy.',
      sample: 'This is a sample. It was not issued to a real student.',
      rows: ['Student', 'Program', 'Level', 'Completion date', 'Certificate ID', 'Issued by'],
      program: 'X2D Cybersecurity Academy, full track (26 weeks)',
      by: 'X2D Academy',
      insideH: 'What’s inside this certificate',
      insideP: 'To earn it, the student completed all three levels and the Portfolio Phase.',
      inside: [
        ['Level 1 · Computer Fundamentals', '4 weeks. Comfortable on Linux and Windows from the terminal, and writing small scripts.'],
        ['Level 2 · Networking', '6 weeks. Subnetting by hand and reading traffic in Wireshark.'],
        ['Level 3 · Cybersecurity', '14 weeks. A full Pentest from recon to report, including Web vulnerabilities, privilege escalation, and Active Directory.'],
        ['Portfolio Phase', '2 weeks. Independent work in a near-real environment, ending in a complete Pentest report.']
      ],
      examH: 'The exam',
      examP: 'Every level ends with a practical exam. The student has to pass it to unlock the next level, and the program finishes with a final Pentest report.',
      exams: [
        ['Level 1 · Week 4', 'Practical checkpoint.'],
        ['Level 2 · Week 10', 'Practical checkpoint.'],
        ['Level 3 · Week 24', 'Capstone: an environment of two or three chained machines, under a time limit, ending in a professional Pentest report.'],
        ['Graduation · Week 26', 'The final Pentest report from an independent engagement.']
      ],
      resultL: 'Exam result', examDateL: 'Exam date',
      results: { 'Passed': 'Passed' },
      foot: 'Questions about this certificate?', footLink: 'Message X2D on WhatsApp'
    },
    ar: {
      checking: 'جاري التحقق…',
      noneT: 'ملقيناش الشهادة دي.',
      noneB: 'الرقم ده مش مطابق لأي شهادة صادرة من أكاديمية <span class="en">X2D</span>. اتأكد من الرقم وجرّب تاني، أو امسح الـ <span class="en">QR code</span> تاني.',
      errT: 'مقدرناش نتحقق دلوقتي.',
      errB: 'اتأكد من النت وجرّب تاني.',
      verified: 'موثّقة',
      issued: 'الشهادة دي صادرة من أكاديمية <span class="en">X2D</span>.',
      sample: 'ده مثال توضيحي. الشهادة دي مش صادرة لطالب حقيقي.',
      rows: ['الطالب', 'البرنامج', 'المستوى', 'تاريخ الإنهاء', 'رقم الشهادة', 'الجهة المُصدرة'],
      program: 'أكاديمية <span class="en">X2D</span> للـ <span class="en">Cybersecurity</span>، المسار كامل (26 أسبوع)',
      by: 'أكاديمية <span class="en">X2D</span>',
      insideH: 'إيه اللي جوّا الشهادة دي',
      insideP: 'عشان ياخدها، الطالب خلّص المستويات التلاتة والـ <span class="en">Portfolio Phase</span>.',
      inside: [
        ['المستوى 1 · <span class="en">Computer Fundamentals</span>', '4 أسابيع. يبقى مرتاح على <span class="en">Linux</span> و<span class="en">Windows</span> من الـ <span class="en">terminal</span>، ويكتب <span class="en">scripts</span> صغيرة.'],
        ['المستوى 2 · <span class="en">Networking</span>', '6 أسابيع. <span class="en">Subnetting</span> بالإيد، وقراءة الـ <span class="en">traffic</span> في <span class="en">Wireshark</span>.'],
        ['المستوى 3 · <span class="en">Cybersecurity</span>', '14 أسبوع. <span class="en">Pentest</span> كامل من الـ <span class="en">recon</span> للتقرير، شامل ثغرات الـ <span class="en">Web</span> والـ <span class="en">privilege escalation</span> والـ <span class="en">Active Directory</span>.'],
        ['<span class="en">Portfolio Phase</span>', 'أسبوعين. شغل مستقل على بيئة أقرب للواقع، وينتهي بتقرير <span class="en">Pentest</span> كامل.']
      ],
      examH: 'الامتحان',
      examP: 'كل مستوى بيخلص بامتحان عملي. الطالب لازم يعدّيه عشان المستوى اللي بعده يتفتح، والبرنامج بيخلص بتقرير <span class="en">Pentest</span> نهائي.',
      exams: [
        ['المستوى 1 · الأسبوع 4', 'امتحان عملي (<span class="en">Checkpoint</span>).'],
        ['المستوى 2 · الأسبوع 10', 'امتحان عملي (<span class="en">Checkpoint</span>).'],
        ['المستوى 3 · الأسبوع 24', '<span class="en">Capstone</span>: بيئة فيها 2 أو 3 أجهزة متسلسلة، تحت وقت محدد، وتخلص بتقرير <span class="en">Pentest</span> احترافي.'],
        ['التخرّج · الأسبوع 26', 'تقرير الـ <span class="en">Pentest</span> النهائي من شغل مستقل.']
      ],
      resultL: 'نتيجة الامتحان', examDateL: 'تاريخ الامتحان',
      results: { 'Passed': 'ناجح' },
      foot: 'عندك سؤال عن الشهادة دي؟', footLink: 'ابعتلنا على واتساب'
    }
  };

  var CHECK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-7"/></svg>';

  function lang() { return d.lang === 'ar' ? 'ar' : 'en'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function pretty(n) { return (n.length === 15 && n.indexOf('X2D') === 0) ? 'X2D-' + n.slice(3, 7) + '-' + n.slice(7, 11) + '-' + n.slice(11) : n; }
  function fmtDate(iso) {
    var t = new Date(String(iso) + 'T00:00:00');
    if (isNaN(t)) return esc(iso);
    return t.toLocaleDateString(lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function level(l) { l = String(l || 'Level 3'); return lang() === 'ar' ? esc(l.replace(/^Level\s*(\d+)/i, 'المستوى $1')) : esc(l); }
  function waHref() {
    var c = window.X2D_CONFIG || {}, n = String(c.whatsappNumber || '').replace(/\D/g, '');
    return n ? 'https://wa.me/' + n : '';
  }

  /* ---------- crypto ---------- */
  function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function hex(u) { return Array.prototype.map.call(u, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  async function derive(idNorm, reg) {
    var km = await crypto.subtle.importKey('raw', new TextEncoder().encode(idNorm), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(reg.salt), iterations: reg.iter }, km, 512);
    var u = new Uint8Array(bits);
    return { key: u.slice(0, 32), lookup: hex(u.slice(32)) };
  }
  async function lookup(idNorm) {
    if (idNorm === 'X2DSAMPLE') {
      return { sample: true, id: 'X2D-SAMPLE', name: 'Sample Student', date: '2026-01-15', level: 'Level 3', exam: { result: 'Passed' } };
    }
    if (!(window.crypto && crypto.subtle)) throw new Error('crypto');
    var r = await fetch('assets/data/certs.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('registry ' + r.status);
    var reg = await r.json();
    var k = await derive(idNorm, reg);
    var rec = reg.records && reg.records[k.lookup];
    if (!rec) return null;
    try {
      var key = await crypto.subtle.importKey('raw', k.key, 'AES-GCM', false, ['decrypt']);
      var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(rec.iv) }, key, b64(rec.ct));
      return JSON.parse(new TextDecoder().decode(plain));
    } catch (e) { return null; }
  }

  /* ---------- rendering ---------- */
  function list(rows) {
    return '<ul class="v-list">' + rows.map(function (r) { return '<li><b>' + r[0] + '</b><span>' + r[1] + '</span></li>'; }).join('') + '</ul>';
  }
  function render() {
    var s = S[lang()];
    if (state.kind === 'idle') { out.innerHTML = ''; return; }
    if (state.kind === 'loading') { out.innerHTML = '<p class="v-msg">' + s.checking + '</p>'; return; }
    if (state.kind === 'error') { out.innerHTML = '<div class="v-none"><h2>' + s.errT + '</h2><p>' + s.errB + '</p></div>'; return; }
    var wa = waHref(), waHtml = wa ? '<p class="v-foot">' + s.foot + ' <a href="' + wa + '" target="_blank" rel="noopener noreferrer">' + s.footLink + '</a></p>' : '';
    if (state.kind === 'none') {
      out.innerHTML = '<div class="v-none"><h2>' + s.noneT + '</h2><p>' + s.noneB + '</p></div>' + waHtml;
      return;
    }
    var r = state.rec, ex = r.exam || {};
    var meta = [
      [s.rows[1], s.program],
      [s.rows[2], level(r.level)],
      [s.rows[3], fmtDate(r.date)],
      [s.rows[4], '<span class="mono" dir="ltr">' + esc(r.id) + '</span>'],
      [s.rows[5], s.by]
    ];
    var res = '';
    if (ex.result || ex.date) {
      res = '<div class="v-result">' +
        (ex.result ? '<span>' + s.resultL + ': <b>' + esc(s.results[ex.result] || ex.result) + '</b></span>' : '') +
        (ex.date ? '<span>' + s.examDateL + ': <b>' + fmtDate(ex.date) + '</b></span>' : '') + '</div>';
    }
    out.innerHTML =
      '<div class="v-ok">' +
      '<span class="v-badge">' + CHECK + s.verified + '</span>' +
      '<h2 class="v-name" dir="auto">' + esc(r.name) + '</h2>' +
      '<p class="v-issued">' + s.issued + '</p>' +
      (r.sample ? '<p class="v-sample">' + s.sample + '</p>' : '') +
      '<dl class="v-meta">' + meta.map(function (m) { return '<dt>' + m[0] + '</dt><dd>' + m[1] + '</dd>'; }).join('') + '</dl>' +
      '<section class="v-sec"><h2>' + s.insideH + '</h2><p>' + s.insideP + '</p>' + list(s.inside) + '</section>' +
      '<section class="v-sec"><h2>' + s.examH + '</h2><p>' + s.examP + '</p>' + list(s.exams) + res + '</section>' +
      waHtml + '</div>';
  }

  async function run(raw) {
    var idNorm = norm(raw);
    if (!idNorm) { state = { kind: 'idle' }; render(); return; }
    state = { kind: 'loading' }; render();
    try {
      var rec = await lookup(idNorm);
      if (rec) { rec.id = rec.id || pretty(idNorm); state = { kind: 'ok', rec: rec }; }
      else state = { kind: 'none' };
    } catch (e) { state = { kind: 'error' }; }
    render();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value.trim();
    try { history.replaceState(null, '', v ? '?id=' + encodeURIComponent(norm(v) ? pretty(norm(v)) : v) : location.pathname); } catch (_) {}
    run(v);
  });
  new MutationObserver(render).observe(d, { attributes: true, attributeFilter: ['lang'] });

  var q = '';
  try { q = new URLSearchParams(location.search).get('id') || ''; } catch (_) {}
  if (q) { input.value = pretty(norm(q)); run(q); }
})();
