/* Runs before first paint: picks the language, decides whether the brand intro plays. */
(function (d) {
  d.classList.add('js');
  try {
    var q = new URLSearchParams(location.search).get('lang');
    var l = (q === 'ar' || q === 'en') ? q : localStorage.getItem('x2d-lang');
    if (l === 'ar') { d.lang = 'ar'; d.dir = 'rtl'; }
  } catch (e) {}

  /* Only the home page (<html data-intro>) has the animated intro. */
  if (!d.hasAttribute('data-intro')) { d.classList.add('no-intro', 'is-ready'); return; }

  var seen = 0;
  try { seen = sessionStorage.getItem('x2d-intro'); } catch (e) {}
  if (seen || matchMedia('(prefers-reduced-motion:reduce)').matches) d.classList.add('no-intro');
  else d.classList.add('intro-on');
  /* safety net: never leave the page locked behind the intro */
  setTimeout(function () { d.classList.remove('intro-on'); d.classList.add('is-ready'); }, 9000);
})(document.documentElement);
