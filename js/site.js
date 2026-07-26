/* ═══════════════════════════════════════════
   site.js — new single-page logic
   (global.js handles lamp, stars, burger menu)
═══════════════════════════════════════════ */

/* ── Sync star color transition when lamp toggled on index.html ── */
(function() {
  const mask = document.getElementById('clickMask');
  if (!mask) return;
  mask.addEventListener('click', () => {
    if (typeof isLightMode !== 'undefined') {
      isLightMode = document.body.classList.contains('light-mode');
    }
  });
})();

/* ── Topbar HOME ── */
const topbarHome = document.getElementById('topbarHome');
if (topbarHome) {
  topbarHome.addEventListener('click', e => {
    e.preventDefault();
    const el = document.getElementById('home');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });
}

/* ── Smooth scroll for all #hash links ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth' }); }
  });
});

/* ── Back to top ── */
const backTop = document.getElementById('backTop');
if (backTop) backTop.addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });

/* ═══════════════════════════════════════════
   LANGUAGE SWITCHING
═══════════════════════════════════════════ */
const STRINGS = {
  en: {
    'nav-home':    'HOME',
    'nav-work':    'WORK',
    'nav-about':   'ABOUT',
    'nav-contact': 'CONTACT',
    'nav-resume':  'RESUME',
    'home-hi':     'Najisa (Amber He)',
    'home-sub':    'Digital Artist · Media & Computational Designer',
    'work-selected': 'Selected Works',
    'more-works':  'More Works',
    'about-p1':    "Hi, I'm Amber He, a <strong>digital artist</strong> from Changsha, China, currently studying Interactive Media Arts at NYU Tisch School of the Arts.",
    'about-p2':    "I'm interested in creative coding, focusing on front-end web design and interactive experiences.",
    'about-p3':    'Alongside coding, I use tools like After Effects and Blender to create animation, VFX, and 3D work.',
    'about-p4':    "I'm drawn to the style that is slightly uncanny and unpredictable.",
    'menu-sub':    'From Changsha, China · Interactive Media Arts at NYU',
    'reach-out':   "Reach out to get speedy responses!",
    'back-top':    'Back to Top',
    'copyright':   '© 2026 Najisa. All rights reserved.',
  },
  zh: {
    'nav-home':    '主页',
    'nav-work':    '作品',
    'nav-about':   '关于我',
    'nav-contact': '联系方式',
    'nav-resume':  '简历',
    'home-hi':     'Najisa (Amber He)',
    'home-sub':    '数字艺术家 · 媒体与计算设计师',
    'work-selected': '精选作品',
    'more-works':  '更多作品',
    'about-p1':    '哈喽，我叫何婧杉，来自中国长沙，是一名<strong>数字艺术家</strong>，目前在纽约大学Tisch学院学习交互媒体艺术专业。',
    'about-p2':    '我喜欢创意编程，专注于前端网页设计与交互体验。',
    'about-p3':    '除此之外，我还会用After Effects和Blender制作动画、视效和3D建模作品。',
    'about-p4':    '我偏爱带有一丝诡异和不确定性的风格。',
    'menu-sub':    '来自中国长沙 · 纽约大学互动媒体艺术',
    'reach-out':   '随时找我！本人秒回党',
    'back-top':    '返回顶部',
    'copyright':   '© 2026 Najisa. All rights reserved.',
  },
  ja: {
    'nav-home':    'ホーム',
    'nav-work':    '作品',
    'nav-about':   '自己紹介',
    'nav-contact': '連絡先',
    'nav-resume':  '履歴書',
    'home-hi':     'Najisa (Amber He)',
    'home-sub':    'デジタルアーティスト · メディア＆計算デザイナー',
    'work-selected': '選出された作品',
    'more-works':  'もっと見る',
    'about-p1':    'ヤッホー！アンバーです。中国・長沙出身で、現在はNYUでInteractive Media Artsを専攻しています。<strong>デジタルアーティスト</strong>として活動しています。',
    'about-p2':    'クリエイティブコーディングが好きで、フロントエンドのWebデザインやインタラクティブな体験を中心に制作しています。',
    'about-p3':    'After EffectsやBlenderを使った映像や3Dの制作もしています。',
    'about-p4':    '少し不気味で、予測できないようなスタイルに惹かれます。',
    'menu-sub':    '中国・長沙出身 · NYU Interactive Media Arts',
    'reach-out':   'いつでもオンライン！',
    'back-top':    'トップへ',
    'copyright':   '© 2026 Najisa. All rights reserved.',
  }
};

const LANG_LABELS = { en: 'EN', zh: '中', ja: '日' };
let lang = sessionStorage.getItem('nj-lang') || 'en';

function applyLang(l) {
  lang = l;
  sessionStorage.setItem('nj-lang', l);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (STRINGS[l] && STRINGS[l][key]) el.innerHTML = STRINGS[l][key];
  });
  const cur = document.getElementById('langCurrent');
  if (cur) cur.textContent = LANG_LABELS[l] || l.toUpperCase();
  document.querySelectorAll('.lang-opt').forEach(b => b.classList.toggle('active', b.dataset.lang === l));
  document.querySelectorAll('.reveal').forEach(el => {
    if (el.classList.contains('in-view')) el.style.color = '';
  });
}

document.addEventListener('langchange', e => applyLang(e.detail.lang));

applyLang(lang);

/* ═══════════════════════════════════════════
   CURTAIN ANIMATION
═══════════════════════════════════════════ */
const curtain = document.getElementById('curtain');
const about   = document.getElementById('about');
if (curtain && about) {
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { curtain.classList.add('raised'); obs.disconnect(); }
  }, { threshold: 0.05 });
  obs.observe(about);
}

/* ═══════════════════════════════════════════
   TEXT REVEAL ON SCROLL
═══════════════════════════════════════════ */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in-view');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ═══════════════════════════════════════════
   SELECTED WORKS GRID
═══════════════════════════════════════════ */
const SELECTED_WORKS = [
  "Love Visualization",
  "Care Compass NYC",
  "Composing Meteor",
  "Foggy Bathroom",
  "The Night of Seimei",
  "Wake Up!",
  "The Day Befor I Got My Glasses",
];

const selGrid = document.getElementById('selGrid');
if (selGrid && typeof worksData !== 'undefined') {
  worksData
    .filter(w => SELECTED_WORKS.includes(w.name))
    .sort((a, b) => SELECTED_WORKS.indexOf(a.name) - SELECTED_WORKS.indexOf(b.name))
    .forEach(work => {
    const card = document.createElement('div');
    card.className = 'sel-card';

    let src = work.thumbnail || '';
    if (!src && work.mediaType === 'image')   src = work.path;
    if (!src && work.mediaType === 'youtube') src = `https://img.youtube.com/vi/${work.path.split('?')[0]}/maxresdefault.jpg`;

    card.innerHTML = `
      <div class="sel-thumb">${src ? `<img src="${src}" alt="${work.name}" loading="lazy">` : ''}</div>
      <div class="sel-type">${work.year} / ${work.category}</div>
      <div class="sel-name">${work.name}</div>
    `;
    const img = card.querySelector('img');
    if (img) {
      img.addEventListener('load', () => img.classList.add('loaded'));
      if (img.complete) img.classList.add('loaded');
    }
    card.addEventListener('click', () => openLightbox(work));
    selGrid.appendChild(card);
  });
}

/* ═══════════════════════════════════════════
   LIGHTBOX
═══════════════════════════════════════════ */
function openLightbox(work) {
  if (work.openInTab && work.link) { window.open(work.link, '_blank'); return; }
  const lb  = document.getElementById('lightbox');
  const med = document.getElementById('lbMedia');
  if (!lb || !med) return;
  med.innerHTML = '';
  if (work.link) {
    med.innerHTML = `<iframe src="${work.link}" allowfullscreen></iframe>`;
  } else if (work.mediaType === 'image') {
    med.innerHTML = `<img src="${work.path}" alt="${work.name}">`;
  } else if (work.mediaType === 'pdf') {
    med.innerHTML = `<iframe src="${work.path}"></iframe>`;
  } else {
    const vid = work.path.split('?')[0];
    med.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?autoplay=1&rel=0" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
  }
  lb.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const lb  = document.getElementById('lightbox');
  const med = document.getElementById('lbMedia');
  lb?.classList.remove('active');
  if (med) med.innerHTML = '';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

/* ═══════════════════════════════════════════
   PHONE PICKER
═══════════════════════════════════════════ */
(function () {
  const picker = document.getElementById('phonePicker');
  if (!picker) return;
  picker.addEventListener('click', e => {
    e.stopPropagation();
    picker.classList.toggle('open');
  });
  document.addEventListener('click', () => picker.classList.remove('open'));
})();

/* ═══════════════════════════════════════════
   AVATAR PARTICLE DOTS — JS-generated, fine & dense
═══════════════════════════════════════════ */
(function () {
  const el = document.querySelector('.avatar-particles');
  if (!el) return;

  const particles = [];
  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2;
    const zone  = Math.random();
    const r = zone < 0.4 ? 45  + Math.random() * 75
            : zone < 0.75? 120 + Math.random() * 80
            :               200 + Math.random() * 90;
    particles.push({
      x:  Math.round(Math.cos(angle) * r),
      y:  Math.round(Math.sin(angle) * r),
      op: (0.25 + Math.random() * 0.65).toFixed(2),
    });
  }

  function apply() {
    const rgb = document.body.classList.contains('light-mode') ? '26,21,14' : '255,255,255';
    el.style.boxShadow = particles
      .map(p => `${p.x}px ${p.y}px 0 0 rgba(${rgb},${p.op})`)
      .join(',');
  }

  apply();
  new MutationObserver(apply).observe(document.body, { attributeFilter: ['class'] });
})();

/* ═══════════════════════════════════════════
   AVATAR → ABOUT PHOTO MORPH
   One element, always visible, just moves.
═══════════════════════════════════════════ */
(function () {
  const morphEl       = document.getElementById('morphAvatar');
  const morphDark     = morphEl?.querySelector('.morph-img-dark');
  const morphLight    = morphEl?.querySelector('.morph-img-light');
  const avatarImgD    = document.querySelector('.avatar-img-dark');
  const avatarImgL    = document.querySelector('.avatar-img-light');
  const avatarWrap    = document.querySelector('.avatar-wrap');
  const frame         = document.querySelector('.photo-frame');
  const about         = document.getElementById('about');
  if (!morphEl || !morphDark || !morphLight || !avatarImgD || !avatarWrap || !frame || !about) return;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t)  { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

  let aDoc = {}, fDoc = {}, aboutAbsTop = 0, rafId = null, morphReady = false;
  let fPad = { LR: 20, T: 20, B: 66 };

  function recalc() {
    const sy = window.scrollY;
    const aR = avatarImgD.getBoundingClientRect();
    const fR = frame.getBoundingClientRect();
    aDoc = { top: aR.top + sy, left: aR.left, width: aR.width, height: aR.height };
    fDoc = { top: fR.top + sy, left: fR.left, width: fR.width, height: fR.height };
    aboutAbsTop = about.getBoundingClientRect().top + sy;
    const cs = getComputedStyle(frame);
    fPad = {
      LR: parseFloat(cs.borderLeftWidth)   || 20,
      T:  parseFloat(cs.borderTopWidth)    || 20,
      B:  parseFloat(cs.borderBottomWidth) || 66,
    };
  }

  /* Delay until avatar fadeUp animation finishes (~1.5s), then hand off */
  recalc(); /* get aboutAbsTop early for p computation */
  setTimeout(() => {
    recalc(); /* re-read accurate positions after animation */
    /* Hide real images — morphEl is the only visible image from now on */
    avatarImgD.style.cssText = 'opacity:0!important;transition:none!important';
    if (avatarImgL) avatarImgL.style.cssText = 'opacity:0!important;transition:none!important';
    frame.style.opacity = '0';
    morphReady = true;
    update();
  }, 1500);

  window.addEventListener('resize', () => { recalc(); if (morphReady) update(); }, { passive: true });

  function setMorphImages() {
    const isLight = document.body.classList.contains('light-mode');
    morphDark.style.opacity  = isLight ? '0' : '1';
    morphLight.style.opacity = isLight ? '1' : '0';
  }

  function update() {
    rafId = null;
    if (!morphReady) return;

    const scrollY = window.scrollY;
    const viewH   = window.innerHeight;
    const start   = aboutAbsTop - viewH * 0.95;
    const end     = aboutAbsTop - viewH * 0.15;
    const p  = Math.max(0, Math.min(1, (scrollY - start) / (end - start)));
    const ep = easeInOut(p);
    const isLt = document.body.classList.contains('light-mode');

    const fPadLR = fPad.LR, fPadT = fPad.T, fPadB = fPad.B;
    const fImgW  = fDoc.width  - fPadLR * 2;
    const fImgH  = fDoc.height - fPadT - fPadB;

    /* Viewport positions — pure math, zero layout reads */
    const aTop = aDoc.top - scrollY, aLeft = aDoc.left;
    const fTop = fDoc.top - scrollY, fLeft = fDoc.left;

    const aCx = aLeft + aDoc.width  / 2;
    const aCy = aTop  + aDoc.height / 2;
    const fCx = fLeft + fPadLR + fImgW / 2;
    const fCy = fTop  + fPadT  + fImgH  / 2;

    const imgW  = lerp(aDoc.width,  fImgW,  ep);
    const imgH  = lerp(aDoc.height, fImgH,  ep);
    const padLR = lerp(0, fPadLR, ep);
    const padT  = lerp(0, fPadT,  ep);
    const padB  = lerp(0, fPadB,  ep);
    const rot   = lerp(0, -2, ep);
    const fa    = ep;

    const cx = lerp(aCx, fCx, ep);
    const cy = lerp(aCy, fCy, ep);

    const offScreen = cy < -300 || cy > viewH + 300;

    setMorphImages();

    morphEl.style.cssText = `
      position:fixed;z-index:200;pointer-events:none;overflow:hidden;
      opacity:${offScreen ? 0 : 1};
      width:${imgW + padLR * 2}px;
      height:${imgH + padT + padB}px;
      left:${cx - padLR - imgW / 2}px;
      top:${cy - padT - imgH / 2}px;
      border-style:solid;
      border-width:${padT}px ${padLR}px ${padB}px ${padLR}px;
      border-color:${isLt ? `rgba(17,17,17,${fa})` : `rgba(255,255,255,${fa})`};
      background:transparent;
      box-shadow:${fa > 0.1 ? `0 8px ${Math.round(32 * fa)}px rgba(0,0,0,${(0.45 * fa).toFixed(2)})` : 'none'};
      transform:rotate(${rot}deg);
    `;
  }

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  new MutationObserver(() => { if (morphReady) update(); })
    .observe(document.body, { attributeFilter: ['class'] });
})();
