(function(){
  var root=document.documentElement;
  var reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(!(window.CSS&&CSS.registerProperty))root.classList.add('no-conic');

  /* every arrow path can be "drawn" */
  [].forEach.call(document.querySelectorAll('svg path'),function(p){p.setAttribute('pathLength','100')});

  /* nav: solid after scroll */
  var nav=document.getElementById('nav');
  function onScroll(){nav.classList.toggle('is-solid',window.scrollY>24)}
  addEventListener('scroll',onScroll,{passive:true});onScroll();

  /* mobile menu */
  var btn=document.querySelector('.menu-btn'),links=document.getElementById('navLinks');
  var curLang=root.lang==='ar'?'ar':'en',MENU={en:['Menu','Close'],ar:['القائمة','إغلاق']};
  function setMenu(o){document.body.classList.toggle('menu-open',o);btn.setAttribute('aria-expanded',String(o));btn.textContent=MENU[curLang][o?1:0]}
  btn.addEventListener('click',function(){setMenu(!document.body.classList.contains('menu-open'))});
  links.addEventListener('click',function(e){if(e.target.closest('a'))setMenu(false)});
  addEventListener('keydown',function(e){if(e.key==='Escape')setMenu(false)});


  /* ---------- site config: WhatsApp + form strings (defined early: setLang runs on load) ---------- */
  var FORM_MSG={
    en:{req:'This field is required.',tel:'Enter your number with the country code, for example +20 100 123 4567.',mail:'Enter a valid email address.',sending:'Sending…',
        fail:'We couldn’t send your request. Check your connection and try again'},
    ar:{req:'الخانة دي مطلوبة.',tel:'اكتب رقمك ومعاه كود الدولة، زي \u2066+20\u2069 لمصر.',mail:'اكتب إيميل صحيح.',sending:'جاري الإرسال…',
        fail:'مقدرناش نبعت طلبك. اتأكد من النت وجرّب تاني'}
  };
  var WA_TXT={en:'or message us on WhatsApp.',ar:'أو ابعتلنا على واتساب.'};
  function waHref(){
    var c=window.X2D_CONFIG||{},n=String(c.whatsappNumber||'').replace(/\D/g,'');
    if(!n)return '';
    var m=(c.whatsappMessage&&c.whatsappMessage[curLang])||'';
    return 'https://wa.me/'+n+(m?'?text='+encodeURIComponent(m):'');
  }
  function updateWa(){
    var h=waHref();
    [].forEach.call(document.querySelectorAll('[data-wa]'),function(a){if(h)a.href=h});
    [].forEach.call(document.querySelectorAll('[data-wa-wrap]'),function(w){w.hidden=!h});
  }
  function onLang(){
    updateWa();
    var l=document.querySelector('#enrollForm [name="language"]');if(l)l.value=curLang;
    [].forEach.call(document.querySelectorAll('.field-err:not([hidden])'),function(p){
      var k=p.getAttribute('data-k');if(k&&FORM_MSG[curLang][k])p.textContent=FORM_MSG[curLang][k];
    });
  }

  /* ---------- language: English (default) / Arabic ---------- */
  var AR=window.X2D_AR||{t:{},a:{},p:{}};
  var metaDesc=document.querySelector('meta[name="description"]');
  var EN={t:{},a:{},p:{},title:document.title,desc:metaDesc.getAttribute('content')};
  [].forEach.call(document.querySelectorAll('[data-i18n]'),function(el){EN.t[el.getAttribute('data-i18n')]=el.innerHTML});
  [].forEach.call(document.querySelectorAll('[data-i18n-aria]'),function(el){EN.a[el.getAttribute('data-i18n-aria')]=el.getAttribute('aria-label')});
  [].forEach.call(document.querySelectorAll('[data-i18n-ph]'),function(el){EN.p[el.getAttribute('data-i18n-ph')]=el.getAttribute('placeholder')});
  var langBtn=document.getElementById('langBtn');
  function setLang(lang,persist){
    var ar=lang==='ar',src=ar?AR:EN;
    curLang=lang;root.lang=lang;root.dir=ar?'rtl':'ltr';
    [].forEach.call(document.querySelectorAll('[data-i18n]'),function(el){
      var h=src.t[el.getAttribute('data-i18n')];if(h==null)return;
      el.innerHTML=h;
      if(el.classList.contains('rv'))splitWords(el); /* re-split so the word reveal keeps working */
    });
    [].forEach.call(document.querySelectorAll('[data-i18n-aria]'),function(el){
      var v=src.a[el.getAttribute('data-i18n-aria')];if(v!=null)el.setAttribute('aria-label',v);
    });
    [].forEach.call(document.querySelectorAll('[data-i18n-ph]'),function(el){
      var v=src.p&&src.p[el.getAttribute('data-i18n-ph')];if(v!=null)el.setAttribute('placeholder',v);
    });
    document.title=src.title;metaDesc.setAttribute('content',src.desc);
    onLang();
    langBtn.textContent=ar?'English':'العربية';langBtn.setAttribute('lang',ar?'en':'ar');
    setMenu(document.body.classList.contains('menu-open'));
    if(persist){try{localStorage.setItem('x2d-lang',lang)}catch(e){}}
  }
  langBtn.addEventListener('click',function(){setLang(curLang==='ar'?'en':'ar',true)});
  if(curLang==='ar')setLang('ar',false);

  /* ---------- word wipe: split by WORD only (Arabic letters must stay joined) ---------- */
  function splitWords(el){
    (function walk(node){
      var kids=[].slice.call(node.childNodes),prev=null;
      kids.forEach(function(k){
        if(k.nodeType===3){
          var parts=k.textContent.split(/(\s+)/),first=true,frag=document.createDocumentFragment();
          parts.forEach(function(t){
            if(!t)return;
            if(/^\s+$/.test(t)){frag.appendChild(document.createTextNode(t));prev=null;first=false;return}
            if(prev&&first){prev.appendChild(document.createTextNode(t))}
            else{var w=document.createElement('span');w.className='w';w.textContent=t;frag.appendChild(w);prev=w}
            first=false;
          });
          node.insertBefore(frag,k);node.removeChild(k);
        }else if(k.nodeType===1){
          if(k.classList.contains('en')){
            if(prev){prev.appendChild(k)}
            else{var w2=document.createElement('span');w2.className='w';node.insertBefore(w2,k);w2.appendChild(k);prev=w2}
          }else{walk(k);prev=null}
        }
      });
    })(el);
    [].forEach.call(el.querySelectorAll('.w'),function(w,i){w.style.setProperty('--i',Math.min(i,16))});
  }
  var h1=document.getElementById('h1');splitWords(h1);h1.classList.add('rv');
  var rvs=[].slice.call(document.querySelectorAll('.h-section,.what-big,.inst-quote blockquote,#h-cta'));
  rvs.forEach(function(e){splitWords(e);e.classList.add('rv')});
  var io=null;
  if('IntersectionObserver' in window&&!reduce){
    io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.3,rootMargin:'0px 0px -6% 0px'});
    rvs.forEach(function(e){io.observe(e)});
  }else{rvs.forEach(function(e){e.classList.add('in')})}

  /* ---------- tool strip ---------- */
  var strip=document.getElementById('strip'),tools=[].slice.call(strip.querySelectorAll('.tool'));
  var desk=matchMedia('(hover:hover) and (min-width:900px)');
  var caps=tools.map(function(t){var c=t.querySelector('.cap-en');c.setAttribute('data-full',c.textContent);return c});
  var typeT,cur=0;
  function typeCap(i){
    clearInterval(typeT);var c=caps[i],full=c.getAttribute('data-full'),k=0;
    if(reduce){c.textContent=full;return}
    c.textContent='';
    typeT=setInterval(function(){k++;c.textContent=full.slice(0,k);if(k>=full.length)clearInterval(typeT)},22);
  }
  function activate(i){
    tools.forEach(function(t,k){t.classList.toggle('is-active',k===i);t.setAttribute('aria-current',String(k===i))});
    if(i!==cur){caps[cur].textContent=caps[cur].getAttribute('data-full');cur=i;typeCap(i)}
  }
  tools.forEach(function(t,i){
    t.addEventListener('mouseenter',function(){if(desk.matches)activate(i)});
    t.addEventListener('focus',function(){activate(i)});
    t.addEventListener('click',function(e){
      if(moved){e.preventDefault();e.stopPropagation();moved=false;return}
      activate(i);
      if(!desk.matches)t.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})
    });
  });
  /* ---------- automatic infinite tool-strip motion ---------- */
  var autoLast=performance.now();
  var AUTO_SPEED=.32; // pixels per millisecond
  var originalToolCount=tools.length;

  /*
   * Clone the original cards once. The strip becomes:
   * [original cards][same cards again]
   * When the second set reaches the exact width of the first set,
   * subtract one cycle width. The visual position is identical, so
   * the carousel appears to continue forward forever with no rewind.
   */
  tools.forEach(function(t){
    var clone=t.cloneNode(true);
    clone.setAttribute('aria-hidden','true');
    clone.removeAttribute('aria-current');
    strip.appendChild(clone);
  });

  function getCycleWidth(){
    var first=strip.children[0], last=strip.children[originalToolCount-1];
    if(!first||!last)return 0;
    var a=first.getBoundingClientRect();
    var b=last.getBoundingClientRect();
    var gap=parseFloat(getComputedStyle(strip).gap)||0;
    return (b.right-a.left)+gap;
  }

  var cycleWidth=0;
  function refreshCycleWidth(){cycleWidth=getCycleWidth();}
  addEventListener('resize',refreshCycleWidth,{passive:true});
  refreshCycleWidth();

  function autoScroll(now){
    var dt=Math.min(40,now-autoLast);
    autoLast=now;

    if(cycleWidth>0){
      strip.scrollLeft += AUTO_SPEED*dt;

      if(strip.scrollLeft >= cycleWidth){
        strip.scrollLeft -= cycleWidth;
      }
    }
    requestAnimationFrame(autoScroll);
  }
  requestAnimationFrame(autoScroll);

  var raf;
  strip.addEventListener('scroll',function(){
    if(desk.matches)return;
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){
      var r=strip.getBoundingClientRect(),c=r.left+r.width/2,best=0,bd=1e9;
      tools.forEach(function(t,i){var b=t.getBoundingClientRect(),d=Math.abs(b.left+b.width/2-c);if(d<bd){bd=d;best=i}});
      activate(best);
    });
  },{passive:true});

  /* ---------- roadmap: ruler + drawn-on bar ---------- */
  var ruler=document.getElementById('ruler'),bar=document.getElementById('bar'),gates={4:1,10:1,24:1,26:2},h='';
  for(var w=1;w<=26;w++){h+='<i style="--i:'+w+'"'+(gates[w]?' class="gate'+(gates[w]===2?' grad':'')+'"':'')+'></i>'}
  ruler.innerHTML=h;
  function drawRoad(){bar.classList.add('in');ruler.classList.add('in')}
  if('IntersectionObserver' in window&&!reduce){
    var io2=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){drawRoad();io2.disconnect()}})},{threshold:.6});
    io2.observe(bar);
  }else{drawRoad()}
  var segs=[].slice.call(document.querySelectorAll('.seg'));
  [].slice.call(document.querySelectorAll('.lv')).forEach(function(r){
    var l=r.getAttribute('data-l');
    r.addEventListener('mouseenter',function(){segs.forEach(function(s){s.classList.toggle('is-on',s.getAttribute('data-l')===l)})});
    r.addEventListener('mouseleave',function(){segs.forEach(function(s){s.classList.remove('is-on')})});
  });

  /* FAQ: one open at a time */
  var ds=[].slice.call(document.querySelectorAll('#faqList details'));
  ds.forEach(function(d){d.addEventListener('toggle',function(){if(d.open)ds.forEach(function(o){if(o!==d)o.open=false})})});


  /* ---------- enrollment form (posts to /api/x2d, stored for the admin dashboard) ---------- */
  updateWa();
  var form=document.getElementById('enrollForm');
  if(form){
    form.noValidate=true; /* custom bilingual messages; the HTML still works without JS */
    var done=document.getElementById('enrollDone'),status=document.getElementById('formStatus');
    var lang0=form.querySelector('[name="language"]');if(lang0)lang0.value=curLang;

    function errFor(input){return document.getElementById('e-'+input.id.replace(/^f-/,''))}
    function setErr(input,k){
      var p=errFor(input);
      if(k){input.setAttribute('aria-invalid','true');p.setAttribute('data-k',k);p.textContent=FORM_MSG[curLang][k];p.hidden=false}
      else{input.removeAttribute('aria-invalid');p.removeAttribute('data-k');p.textContent='';p.hidden=true}
    }
    function check(input){
      var v=input.value.trim();
      if(input.required&&!v){setErr(input,'req');return false}
      if(input.type==='tel'&&v){
        var digits=v.replace(/\D/g,'');
        if(!/^\+?[\d\s\-().]+$/.test(v)||digits.length<8||digits.length>15){setErr(input,'tel');return false}
      }
      if(input.type==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){setErr(input,'mail');return false}
      setErr(input,null);return true;
    }
    var fields=[].slice.call(form.querySelectorAll('#f-name,#f-phone,#f-email'));
    fields.forEach(function(i){
      i.addEventListener('blur',function(){if(i.value.trim()||i.hasAttribute('aria-invalid'))check(i)});
      i.addEventListener('input',function(){if(i.hasAttribute('aria-invalid'))check(i)});
    });

    form.addEventListener('submit',function(e){
      e.preventDefault();
      var bad=null;
      fields.forEach(function(i){if(!check(i)&&!bad)bad=i});
      if(bad){bad.focus();return}

      var btn=form.querySelector('button[type="submit"]'),lab=btn.querySelector('span'),old=lab.innerHTML;
      status.hidden=true;
      btn.disabled=true;btn.setAttribute('aria-busy','true');lab.textContent=FORM_MSG[curLang].sending;
      form.elements['language'].value=curLang;
      var data={};new FormData(form).forEach(function(v,k){data[k]=v});
      fetch('/api/x2d?r=enroll',{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(data)
      }).then(function(r){
        if(!r.ok)throw new Error('HTTP '+r.status);
        form.hidden=true;done.hidden=false;done.focus();
        try{done.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'})}catch(_){}
      }).catch(function(){
        lab.innerHTML=old;btn.disabled=false;btn.removeAttribute('aria-busy');
        var h=waHref();
        status.innerHTML=FORM_MSG[curLang].fail+(h?', <a href="'+h+'" target="_blank" rel="noopener noreferrer">'+WA_TXT[curLang]+'</a>':'.');
        status.hidden=false;
      });
    });
  }

  /* ---------- page ready + brand intro ---------- */
  var isReady=false;
  function ready(){
    if(isReady)return;isReady=true;
    root.classList.add('is-ready');h1.classList.add('in');
    setTimeout(function(){typeCap(0)},1500);
  }
  var intro=document.getElementById('intro');
  if(!intro||root.classList.contains('no-intro')||!root.classList.contains('intro-on')){
    if(intro)intro.parentNode.removeChild(intro);
    requestAnimationFrame(ready);
    return;
  }
  /* build the per-letter lines (Latin only) */
  [].forEach.call(intro.querySelectorAll('.il'),function(line){
    var txt=line.textContent,t=line.getAttribute('data-t');line.textContent='';
    line.style.setProperty('--t',t+'ms');
    txt.split('').forEach(function(ch,i){var s=document.createElement('span');s.className='ch';s.style.setProperty('--i',i);s.style.setProperty('--t',t+'ms');s.textContent=ch===' '?'\u00A0':ch;line.appendChild(s)});
  });
  var timers=[],done=false,typeEl=intro.querySelector('.intro-type'),full='Cybersecurity Academy';
  function at(ms,fn){timers.push(setTimeout(fn,ms))}
  function finish(){
    if(done)return;done=true;timers.forEach(clearTimeout);
    typeEl.classList.add('done');intro.classList.add('out');
    setTimeout(ready,220);
    setTimeout(function(){if(intro.parentNode)intro.parentNode.removeChild(intro);root.classList.remove('intro-on')},1000);
  }
  function play(){
    try{sessionStorage.setItem('x2d-intro','1')}catch(e){}
    intro.classList.add('play');
    at(1500,function(){intro.classList.add('mark')});
    at(1650,function(){
      var i=0;(function step(){typeEl.textContent=full.slice(0,++i);if(i<full.length)timers.push(setTimeout(step,28))})();
    });
    at(2900,finish);
  }
  intro.addEventListener('click',finish);
  addEventListener('keydown',function(e){if(e.key==='Escape')finish()});
  var fontsReady=(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve();
  Promise.race([fontsReady,new Promise(function(r){setTimeout(r,900)})]).then(play);
})();
