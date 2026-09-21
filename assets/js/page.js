/* Shared behaviour for the small pages (thanks.html, 404.html): language switch + WhatsApp link. */
(function () {
  var d = document.documentElement;
  var btn = document.getElementById('langBtn');
  [].forEach.call(document.querySelectorAll('svg path'), function (p) { p.setAttribute('pathLength', '100'); });

  function wa(lang) {
    var c = window.X2D_CONFIG || {}, n = String(c.whatsappNumber || '').replace(/\D/g, '');
    var links = document.querySelectorAll('[data-wa]');
    var wraps = document.querySelectorAll('[data-wa-wrap]');
    var msg = (c.whatsappMessage && c.whatsappMessage[lang]) || '';
    [].forEach.call(links, function (a) { if (n) a.href = 'https://wa.me/' + n + (msg ? '?text=' + encodeURIComponent(msg) : ''); });
    [].forEach.call(wraps, function (w) { w.hidden = !n; });
  }

  function set(lang, persist) {
    var ar = lang === 'ar';
    d.lang = lang; d.dir = ar ? 'rtl' : 'ltr';
    if (btn) { btn.textContent = ar ? 'English' : 'العربية'; btn.setAttribute('lang', ar ? 'en' : 'ar'); }
    document.title = ar ? document.body.getAttribute('data-title-ar') : document.body.getAttribute('data-title-en');
    wa(lang);
    if (persist) { try { localStorage.setItem('x2d-lang', lang); } catch (e) {} }
  }

  if (btn) btn.addEventListener('click', function () { set(d.lang === 'ar' ? 'en' : 'ar', true); });
  set(d.lang === 'ar' ? 'ar' : 'en', false);
})();
