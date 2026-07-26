/* global.js — shared across all pages: mode, stars, lamp, burger, cursor */

/* ── Mode persistence ── */
let isLightMode = sessionStorage.getItem('portfolio-mode') === 'light';
let colorTransition = isLightMode ? 1 : 0;
if (isLightMode) document.body.classList.add('light-mode');

/* ── Star canvas ── */
(function () {
  const canvas = document.getElementById('universe');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const cfg = {
    starCount:      45,
    particleCount:  45000,
    baseSize:       40,
    longAxisRatio:  2.2,
    sharpness:      0.45,
    friction:       0.94,
    ease:           0.06,
  };

  let v = { x: 0, y: 0, tx: 0, ty: 0 }, lastM = { x: 0, y: 0 };
  const motherCache = { dark: [], light: [] };

  function createMother(color, blurStr) {
    const mCanvas = document.createElement('canvas');
    const w = cfg.baseSize * 5, h = w * cfg.longAxisRatio;
    mCanvas.width = w; mCanvas.height = h;
    const mctx = mCanvas.getContext('2d');
    if (blurStr !== '0px') mctx.filter = `blur(${blurStr})`;
    mctx.fillStyle = color;
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < cfg.particleCount; i++) {
      const rx = (Math.random() - 0.5) * cfg.baseSize * 4;
      const ry = (Math.random() - 0.5) * cfg.baseSize * cfg.longAxisRatio * 2;
      const nx = Math.abs(rx) / cfg.baseSize;
      const ny = Math.abs(ry) / (cfg.baseSize * cfg.longAxisRatio);
      const dist = Math.pow(nx, cfg.sharpness) + Math.pow(ny, cfg.sharpness);
      if (dist < 0.8 || (dist < 1.6 && Math.random() < Math.pow(Math.max(0, 1 - (dist - 0.8) / 0.8), 8))) {
        const pSize = 0.3 + 1.9 * Math.pow(Math.max(0, 1 - dist / 1.6), 2);
        mctx.fillRect(cx + rx, cy + ry, pSize, pSize);
      }
    }
    return mCanvas;
  }

  class Star {
    constructor() { this.age = Math.random() * 8000; this.reset(true); }
    reset(keepAge) {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      const r = Math.random();
      if      (r > 0.8) { this.idx = 0; this.sc = 0.45; this.bAmp = 0.12; this.bSpd = 0.004; }
      else if (r > 0.4) { this.idx = 1; this.sc = 0.28; this.bAmp = 0.06; this.bSpd = 0.008; }
      else              { this.idx = 2; this.sc = 0.15; this.bAmp = 0.02; this.bSpd = 0.012; }
      this.op   = 0;
      this.life = 10000 + Math.random() * 10000;
      if (!keepAge) this.age = 0;
      this.bPh  = Math.random() * 7;
      this.tPh  = Math.random() * 7;
    }
    update() {
      this.age += 16.6; this.bPh += this.bSpd; this.tPh += 0.05;
      const fade = 2500;
      if      (this.age < fade)              this.op = this.age / fade;
      else if (this.age > this.life - fade)  this.op = (this.life - this.age) / fade;
      else                                   this.op = 1;
      if (this.age >= this.life) this.reset(false);
    }
    draw(ox, oy) {
      const finalSc = this.sc * (1 + Math.sin(this.bPh) * this.bAmp) * (1 + Math.sin(this.tPh) * 0.03);
      const dImg = motherCache.dark[this.idx];
      const lImg = motherCache.light[this.idx];
      const dx = this.x - (dImg.width  * finalSc) / 2 + ox * (2.5 - this.idx);
      const dy = this.y - (dImg.height * finalSc) / 2 + oy * (2.5 - this.idx);
      const w  = dImg.width  * finalSc;
      const h  = dImg.height * finalSc;
      const op = Math.max(0, this.op);
      ctx.globalAlpha = op * (1 - colorTransition);
      ctx.drawImage(dImg, dx, dy, w, h);
      ctx.globalAlpha = op * colorTransition;
      ctx.drawImage(lImg, dx, dy, w, h);
    }
  }

  let stars = [];

  function init() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const blurs = ['0px', '0.6px', '1.8px'];
    motherCache.dark  = blurs.map(b => createMother('white', b));
    motherCache.light = blurs.map(b => createMother('black', b));
    stars = Array.from({ length: cfg.starCount }, () => new Star());
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    v.tx *= cfg.friction; v.ty *= cfg.friction;
    v.x  += (v.tx - v.x) * cfg.ease;
    v.y  += (v.ty - v.y) * cfg.ease;

    const step = 16.6 / 1000;
    if ( isLightMode && colorTransition < 1) colorTransition = Math.min(1, colorTransition + step);
    if (!isLightMode && colorTransition > 0) colorTransition = Math.max(0, colorTransition - step);

    ctx.globalAlpha = 1;
    stars.forEach(s => { s.update(); s.draw(v.x, v.y); });
    requestAnimationFrame(loop);
  }

  window.addEventListener('mousemove', e => {
    if (lastM.x !== 0) {
      v.tx += (e.clientX - lastM.x) * 0.5;
      v.ty += (e.clientY - lastM.y) * 0.5;
    }
    lastM.x = e.clientX; lastM.y = e.clientY;
  });
  window.addEventListener('resize', init);
  init(); loop();
})();

/* ── Lamp ── */
(function () {
  const mask = document.getElementById('clickMask');
  if (!mask) return;
  mask.addEventListener('click', function () {
    isLightMode = !isLightMode;
    document.body.classList.toggle('light-mode', isLightMode);
    sessionStorage.setItem('portfolio-mode', isLightMode ? 'light' : 'dark');
  });
})();

/* ── Burger menu ── */
(function () {
  const burger  = document.getElementById('burger');
  const overlay = document.getElementById('menuOverlay');
  if (!burger || !overlay) return;

  burger.addEventListener('click', e => {
    e.stopPropagation();
    const open = overlay.classList.toggle('active');
    burger.classList.toggle('active', open);
    document.body.classList.toggle('menu-open', open);
  });

  document.addEventListener('click', e => {
    if (!overlay.contains(e.target) && !burger.contains(e.target)) {
      overlay.classList.remove('active');
      burger.classList.remove('active');
      document.body.classList.remove('menu-open');
    }
  });

  overlay.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      overlay.classList.remove('active');
      burger.classList.remove('active');
      document.body.classList.remove('menu-open');
    });
  });
})();

/* ── Lang picker dropdown ── */
(function () {
  const LABELS = { en: 'EN', zh: '中', ja: '日' };
  const picker  = document.getElementById('langPicker');
  const current = document.getElementById('langCurrent');
  if (!picker || !current) return;

  const saved = sessionStorage.getItem('nj-lang') || 'en';
  current.textContent = LABELS[saved] || 'EN';
  document.querySelectorAll('.lang-opt').forEach(b => b.classList.toggle('active', b.dataset.lang === saved));

  current.addEventListener('click', e => {
    e.stopPropagation();
    picker.classList.toggle('open');
  });
  document.querySelectorAll('.lang-opt').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const l = btn.dataset.lang;
      sessionStorage.setItem('nj-lang', l);
      current.textContent = LABELS[l] || l;
      document.querySelectorAll('.lang-opt').forEach(b => b.classList.toggle('active', b.dataset.lang === l));
      picker.classList.remove('open');
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: l } }));
    });
  });
  document.addEventListener('click', () => picker.classList.remove('open'));
})();

/* ── Topbar scroll shadow ── */
(function () {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  window.addEventListener('scroll', () => {
    topbar.classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });
})();

/* ── Custom cursor: hatched dot + lagging ring ── */
(function () {
  const dot  = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;

  let mx = -200, my = -200; // mouse (dot follows instantly)
  let rx = -200, ry = -200; // ring position (lerped)

  window.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  });

  /* ring lags: lerp factor 0.1 = smooth follow */
  (function tick() {
    rx += (mx - rx) * 0.10;
    ry += (my - ry) * 0.10;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(tick);
  })();

  const hide = () => { dot.classList.add('hidden'); ring.classList.add('hidden'); };
  const show = () => { dot.classList.remove('hidden'); ring.classList.remove('hidden'); };
  document.addEventListener('mouseleave', hide);
  document.addEventListener('mouseenter', show);

  const hoverSel = 'a, button, [role="button"], .chip, .wk-card, .sel-card, ' +
    '.ci, .wk-arrow, .burger-icon, .click-mask, .more-link, ' +
    '.lang-current, .lang-opt, .topbar-home, .menu-link, .hnb-link, ' +
    '.back-top, .footer-nav-link, .progress-thumb, label';

  document.querySelectorAll(hoverSel).forEach(el => {
    el.addEventListener('mouseenter', () => { dot.classList.add('hovering'); ring.classList.add('hovering'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('hovering'); ring.classList.remove('hovering'); });
  });
})();
