/* ============================================================
   Keerthi Tadikonda, portfolio
   ------------------------------------------------------------
   Motion budget, and why each piece exists:

   hero intro    storytelling. She lands first, the name is then
                 pushed out from behind her and set in place.
   hero parallax hierarchy. Releases the hero so the eye moves on.
   reveals       hierarchy. Content arrives in reading order.
   counters      hierarchy. Pulls the eye to the three real numbers.
   marquee       storytelling. Breadth of tooling, at a glance.
   work deck     storytelling. Each project is dealt onto the
                 stack, alternating left and right, so the set
                 reads as one body of work rather than a list.

   Everything below collapses to a static page under
   prefers-reduced-motion, and the page is fully readable with
   JavaScript switched off.
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme ---------- */

  var toggle = document.getElementById('themeToggle');

  function currentTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncToggle() {
    var dark = currentTheme() === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  toggle.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('kt-theme', next); } catch (e) {}
    syncToggle();
  });
  syncToggle();

  /* ---------- Portrait slots ----------
     The two portraits are drop-in files. Until they exist the figure
     falls back to a designed plate rather than a broken image icon. */

  Array.prototype.forEach.call(document.querySelectorAll('[data-portrait]'), function (img) {
    var slot = img.closest('.portrait-slot');
    function empty() {
      slot.classList.add('is-empty');
      console.info(
        '[portfolio] No image at "' + img.getAttribute('src') + '". ' +
        'Drop a background-free PNG there and reload to replace the placeholder plate.'
      );
    }
    if (img.complete) {
      if (!img.naturalWidth) empty();
    } else {
      img.addEventListener('error', empty, { once: true });
    }
  });

  /* ---------- Project covers ----------
     Each card ships with a tinted cover. A real screenshot dropped at
     img/work-0N.jpg is picked up here and faded in over the top. */

  Array.prototype.forEach.call(document.querySelectorAll('[data-cover]'), function (img) {
    var card = img.closest('.card');
    var probe = new Image();
    probe.onload = function () {
      img.src = probe.src;
      img.alt = card.querySelector('.card__title').textContent.trim() + ', screenshot';
      img.removeAttribute('aria-hidden');
      img.classList.add('is-loaded');
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    };
    probe.src = img.dataset.cover;
  });

  /* ---------- Toolkit marquee ---------- */

  var LOGOS = [
    'python', 'react', 'typescript', 'javascript', 'flask', 'tailwindcss',
    'openjdk', 'numpy', 'pandas', 'scikitlearn', 'docker', 'postgresql',
    'git', 'github', 'firebase', 'mysql', 'plotly', 'html5', 'css',
    'cplusplus', 'c', 'salesforce', 'redhat'
  ];

  var track = document.getElementById('marqueeTrack');
  var strip = LOGOS.map(function (slug) {
    return '<span class="marquee__item logo-' + slug + '"></span>';
  }).join('');
  track.innerHTML = strip + strip;

  /* ---------- Motion ---------- */

  if (reduced || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);
  root.classList.add('js-motion');

  /* Lenis owns the scroll position, ScrollTrigger reads from it. */
  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({
      lerp: 0.055,             /* heavier glide: the page keeps moving after you stop */
      wheelMultiplier: 0.85,
      syncTouch: true,
      touchInertiaMultiplier: 22
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -72, duration: 1.6 });
    });
  }

  var EASE = 'expo.out';
  var EASE_SOFT = 'power2.out';

  /* --- Nav hairline once the hero is behind us --- */

  ScrollTrigger.create({
    start: 'top -40',
    end: 99999,
    onToggle: function (self) {
      document.getElementById('nav').classList.toggle('is-stuck', self.isActive);
    }
  });

  /* --- Scrim over the wave field ---
     Paper at a scroll-driven opacity: clear across the hero so the field is
     the hero background, near solid behind the reading sections, then eased
     back for the closing block so the colour returns as a bookend.

     Driven from the ticker rather than a ScrollTrigger callback, because the
     pinned work deck makes trigger-relative progress unreliable this far down
     the page. Geometry is cached and only remeasured on refresh, so the frame
     cost is two reads and at most one style write. */

  var scrim = document.getElementById('scrim');
  var heroEl = document.querySelector('.hero');
  var contactEl = document.getElementById('contact');

  var SCRIM_HERO = 0.05;   /* field fully visible */
  var SCRIM_READ = 0.93;   /* body copy sits on near solid paper */
  var SCRIM_END  = 0.72;   /* colour returns under the closing block */

  var geo = { heroH: 0, contactTop: 0 };
  var lastO = -1;

  function measure() {
    geo.heroH = heroEl.offsetHeight || window.innerHeight;
    geo.contactTop = contactEl.getBoundingClientRect().top + (window.scrollY || 0);
  }

  function syncScrim() {
    var y = window.scrollY || window.pageYOffset || 0;
    var vh = window.innerHeight;

    var settle = gsap.utils.clamp(0, 1, (y - geo.heroH * 0.30) / (geo.heroH * 0.55));
    var open = gsap.utils.clamp(0, 1, (y + vh - geo.contactTop) / (vh * 0.75));

    var o = SCRIM_HERO + settle * (SCRIM_READ - SCRIM_HERO);
    o -= open * (SCRIM_READ - SCRIM_END);

    if (Math.abs(o - lastO) > 0.002) {
      scrim.style.opacity = o.toFixed(3);
      lastO = o;
    }
  }

  gsap.set(scrim, { opacity: SCRIM_HERO });
  measure();
  syncScrim();
  gsap.ticker.add(syncScrim);
  ScrollTrigger.addEventListener('refresh', measure);

  /* --- Hero: she arrives, then the name is set behind her --- */

  var words = gsap.utils.toArray('.hero__word');
  var portrait = document.getElementById('heroPortrait');
  var typeEl = document.querySelector('.hero__type');

  /* The resting offsets live in CSS so the no-JS render and the animated one
     agree, and so the narrow breakpoint can push the name clear of her. */
  function restX(i) {
    var v = getComputedStyle(typeEl).getPropertyValue(i === 0 ? '--wa-x' : '--wb-x');
    return parseFloat(v) || 0;
  }

  var heroMM = gsap.matchMedia();

  /* Two conditions rather than one always-true query, so crossing the narrow
     breakpoint tears the timeline down and rebuilds it on the new offsets. */
  heroMM.add({ narrow: '(max-width: 760px)', wide: '(min-width: 761px)' }, function () {
    var ax = restX(0), bx = restX(1);

    gsap.set(words[0], { xPercent: ax });
    gsap.set(words[1], { xPercent: bx });

    var intro = gsap.timeline({ defaults: { ease: EASE } });

    intro
      .from(portrait, { opacity: 0, scale: 1.07, yPercent: 4, duration: 1.7 })
      .from(words, {
        opacity: 0,
        scale: 0.58,
        xPercent: 0,                     /* collapsed on her centre line */
        yPercent: function (i) { return i === 0 ? 78 : -78; },
        duration: 2.0,
        stagger: 0.14
      }, '-=1.35')
      .from('.hero__foot > *', { opacity: 0, y: 22, duration: 1.3, stagger: 0.13 }, '-=1.5');

    /* --- Depth parallax: the name, the portrait and the footer copy sit on
       three different planes, so moving the pointer parallaxes them against
       each other instead of sliding one flat image. quickTo writes straight
       to the transform on GSAP's own ticker, so there is no extra rAF and no
       state to re-render. --- */
    var stage = document.querySelector('.hero__stage');
    var deep = {
      px: gsap.quickTo(portrait, 'x', { duration: 0.9, ease: 'power3' }),
      py: gsap.quickTo(portrait, 'y', { duration: 0.9, ease: 'power3' }),
      pr: gsap.quickTo(portrait, 'rotationY', { duration: 1.1, ease: 'power3' }),
      pt: gsap.quickTo(portrait, 'rotationX', { duration: 1.1, ease: 'power3' }),
      w0x: gsap.quickTo(words[0], 'x', { duration: 1.3, ease: 'power3' }),
      w0y: gsap.quickTo(words[0], 'y', { duration: 1.3, ease: 'power3' }),
      w1x: gsap.quickTo(words[1], 'x', { duration: 1.3, ease: 'power3' }),
      w1y: gsap.quickTo(words[1], 'y', { duration: 1.3, ease: 'power3' })
    };

    function parallax(e) {
      var r = stage.getBoundingClientRect();
      if (r.bottom < 0) return;                 /* hero is off screen */
      var nx = (e.clientX / window.innerWidth) - 0.5;
      var ny = (e.clientY / window.innerHeight) - 0.5;

      deep.px(nx * 26); deep.py(ny * 16);
      deep.pr(nx * 7);  deep.pt(-ny * 5);
      deep.w0x(-nx * 42); deep.w0y(-ny * 20);
      deep.w1x(-nx * 58); deep.w1y(-ny * 26);
    }
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', parallax, { passive: true });
    }

    /* Hero release: she lifts and fades, the name drifts apart. */
    var out = gsap.timeline({
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.9
      }
    })
      .to(portrait, { yPercent: -14, scale: 1.1, opacity: 0.25, ease: 'none' }, 0)
      .to(words[0], { yPercent: -34, xPercent: ax - 8, ease: 'none' }, 0)
      .to(words[1], { yPercent: 34, xPercent: bx + 8, ease: 'none' }, 0);

    return function () {
      window.removeEventListener('pointermove', parallax);
      intro.kill();
      out.scrollTrigger && out.scrollTrigger.kill();
      out.kill();
      gsap.set(words.concat([portrait]), { clearProps: 'all' });
    };
  });


  /* --- Scroll rail --- */

  var rail = document.querySelector('.progress');
  var railBar = document.getElementById('progressBar');
  var setRail = gsap.quickSetter(railBar, 'scaleX');

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: function (self) { setRail(self.progress); },
    onToggle: function (self) { rail.classList.toggle('is-on', self.progress > 0.01); }
  });
  var railOn = false;
  gsap.ticker.add(function () {
    var on = (window.scrollY || 0) > 40;
    if (on !== railOn) { railOn = on; rail.classList.toggle('is-on', on); }
  });

  /* --- Nav: a pill that slides to whichever section is in view --- */

  var pill = document.getElementById('navPill');
  var navLinks = gsap.utils.toArray('.nav__links a');
  var pillX = gsap.quickTo(pill, 'x', { duration: 0.55, ease: 'power3' });
  var current = null;

  function markCurrent(link) {
    if (link === current) return;
    current = link;
    navLinks.forEach(function (a) { a.classList.toggle('is-current', a === link); });
    if (!link) { gsap.to(pill, { opacity: 0, duration: 0.3 }); return; }
    var pad = 14;
    gsap.set(pill, { width: link.offsetWidth + pad * 2 });
    pillX(link.offsetLeft - pad);
    gsap.to(pill, { opacity: 1, duration: 0.35 });
  }

  navLinks.forEach(function (link) {
    var id = link.getAttribute('href');
    var section = document.querySelector(id);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: function (self) { if (self.isActive) markCurrent(link); }
    });
  });

  /* --- Magnetic buttons: the label follows the cursor, the button leans ---
     Cursor only. A finger has no hover state, and on touch this just fights
     the scroll. --- */

  var finePointer = window.matchMedia('(pointer: fine)').matches;

  if (finePointer) gsap.utils.toArray('.btn, .foot__top').forEach(function (el) {
    var mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    var my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });

    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      mx((e.clientX - (r.left + r.width / 2)) * 0.28);
      my((e.clientY - (r.top + r.height / 2)) * 0.42);
    });
    el.addEventListener('pointerleave', function () { mx(0); my(0); });
  });

  /* --- Spotlight: surfaces pick up a highlight under the cursor --- */

  if (finePointer) gsap.utils.toArray('.card, .cert').forEach(function (el) {
    var target = el.querySelector('.card__core') || el;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      target.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      target.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  });

  /* --- Scroll reveals, in reading order ---
     One trigger per element rather than a batch, so an element that is
     already past its start on load (deep link, or a reload part way down
     the page) resolves to visible on the first refresh instead of being
     stranded at zero opacity. Siblings still stagger against each other. */

  /* Headings are split on their explicit line breaks and each line hinges up
     from behind its own mask. No measurement, so nothing to recompute on
     resize, and it degrades to plain text with JS off. */
  gsap.utils.toArray('h2.reveal, .contact__line').forEach(function (el) {
    var parts = el.innerHTML.split(/<br\s*\/?>/i);
    if (!parts.length) return;
    el.innerHTML = parts.map(function (s) {
      return '<span class="line-wrap"><span>' + s.trim() + '</span></span>';
    }).join('');
    el.classList.add('has-lines');
  });

  gsap.utils.toArray('.has-lines').forEach(function (el) {
    var lines = el.querySelectorAll('.line-wrap > span');
    gsap.set(lines, { yPercent: 118, rotationX: -62, opacity: 0, transformOrigin: '50% 100%' });
    gsap.to(lines, {
      yPercent: 0, rotationX: 0, opacity: 1,
      duration: 1.5, ease: 'expo.out', stagger: 0.13,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  gsap.set('.reveal', { y: 32 });

  gsap.utils.toArray('.reveal').forEach(function (el) {
    if (el.classList.contains('has-lines')) { gsap.set(el, { opacity: 1, y: 0 }); return; }
    var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) {
      return c.classList.contains('reveal');
    });

    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1.35,
      ease: EASE,
      delay: sibs.indexOf(el) * 0.11,
      scrollTrigger: { trigger: el, start: 'top 92%', once: true }
    });
  });

  /* --- The three real numbers count up --- */

  gsap.utils.toArray('[data-count]').forEach(function (el) {
    var end = parseFloat(el.dataset.count);
    var dp = parseInt(el.dataset.decimals || '0', 10);
    var obj = { v: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: function () {
        gsap.to(obj, {
          v: end,
          duration: 2.4,
          ease: 'power2.out',
          onUpdate: function () { el.textContent = obj.v.toFixed(dp); }
        });
      }
    });
  });

  /* --- Marquee, nudged by how fast the page is moving --- */

  var half = track.scrollWidth / 2;
  var loop = gsap.to(track, {
    x: -half,
    duration: 62,
    ease: 'none',
    repeat: -1,
    modifiers: {
      x: gsap.utils.unitize(function (x) { return parseFloat(x) % half; })
    }
  });

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: function (self) {
      var boost = Math.min(2.6, Math.abs(self.getVelocity()) / 1100);
      gsap.to(loop, { timeScale: 1 + boost, duration: 0.9, ease: 'power2.out', overwrite: true });
    }
  });

  /* --- The work deck ---
     Cards are dealt onto one stack, alternating from the left and the
     right edge. Each landing pushes the cards beneath it back, so the
     set reads as a hand being laid down. */

  var mm = gsap.matchMedia();

  mm.add('(min-width: 901px)', function () {
    var wrap = document.getElementById('deckCards');
    var cards = gsap.utils.toArray('#deckCards .card');
    var n = cards.length;

    wrap.classList.add('deck--stacked');

    function restRot(i) { return (i % 2 ? 1 : -1) * (2.6 - i * 0.55); }
    function restY(i)   { return (((n - 1) / 2) - i) * 2.7; }

    /* Dealt in 3D: each card swings in on its own Y axis and settles onto the
       stack at a different z depth, so the pile has real thickness. */
    gsap.set(cards, {
      xPercent: function (i) { return cards[i].dataset.from === 'left' ? -150 : 150; },
      rotationY: function (i) { return cards[i].dataset.from === 'left' ? 34 : -34; },
      rotationX: -12,
      rotationZ:  function (i) { return cards[i].dataset.from === 'left' ? -9 : 9; },
      z: -260,
      yPercent: 12,
      zIndex: function (i) { return i + 1; },
      transformOrigin: '50% 60%',
      transformPerspective: 1600
    });

    var tl = gsap.timeline({
      defaults: { ease: 'power2.out', duration: 1 },
      scrollTrigger: {
        trigger: '.deck',
        start: 'top top',
        end: function () { return '+=' + Math.round(window.innerHeight * (n + 0.85)); },
        pin: true,
        scrub: 1.1,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    cards.forEach(function (card, i) {
      var at = i;

      tl.to(card, {
        xPercent: 0, yPercent: restY(i),
        rotationY: 0, rotationX: 0, rotationZ: restRot(i),
        z: 0, scale: 1
      }, at);

      /* the cover drifts as the card travels, so the card has depth */
      tl.fromTo(card.querySelectorAll('.card__media > *'),
        { scale: 1.22 }, { scale: 1, ease: 'none' }, at);

      /* everything already on the table settles back */
      for (var j = 0; j < i; j++) {
        var d = i - j;
        tl.to(cards[j], {
          yPercent: restY(j) - d * 4.4,
          z: -d * 62,
          rotationX: d * 1.6,
          filter: 'brightness(' + (1 - d * 0.11).toFixed(2) + ')'
        }, at);
      }
    });

    tl.to({}, { duration: 0.85 });   /* hold on the last card */

    return function () {
      wrap.classList.remove('deck--stacked');
      gsap.set(cards, { clearProps: 'all' });
      gsap.set(gsap.utils.toArray('#deckCards .card__core'), { clearProps: 'all' });
      gsap.set(gsap.utils.toArray('#deckCards .card__media > *'), { clearProps: 'all' });
    };
  });

  /* --- Below 900px the deck is a plain column, reveal only --- */

  mm.add('(max-width: 900px)', function () {
    var cards = gsap.utils.toArray('#deckCards .card');
    var tweens = cards.map(function (card) {
      return gsap.from(card, {
        opacity: 0, y: 44, duration: 1.2, ease: EASE,
        scrollTrigger: { trigger: card, start: 'top 88%', once: true }
      });
    });
    return function () { tweens.forEach(function (t) { t.scrollTrigger && t.scrollTrigger.kill(); t.kill(); }); };
  });

  /* Fonts and late images change layout height, so remeasure once settled. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
