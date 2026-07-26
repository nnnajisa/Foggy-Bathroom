/* works-gallery.js — coverflow carousel */
const track   = document.getElementById('worksTrack');
const rail    = document.getElementById('progressRail');
const thumb   = document.getElementById('progressThumb');
const prevBtn = document.getElementById('wkPrev');
const nextBtn = document.getElementById('wkNext');
if (!track || typeof worksData === 'undefined') { /* nothing */ } else {

let activeYear = 'ALL', activeCat = 'ALL';
let activeIdx  = 0;
let visCards   = [];

/* ── Build cards ── */
worksData.forEach(work => {
  const card = document.createElement('article');
  card.className = 'wk-card';
  card.dataset.year = work.year;
  card.dataset.cat  = work.category;
  let src = work.thumbnail || '';
  if (!src && work.mediaType === 'image')   src = work.path;
  if (!src && work.mediaType === 'youtube') src = `https://img.youtube.com/vi/${work.path.split('?')[0]}/maxresdefault.jpg`;
  card.innerHTML = `
    <div class="wk-thumb">${src ? `<img src="${src}" alt="${work.name}" loading="lazy">` : ''}</div>
    <div class="wk-type">${work.year} / ${work.category}</div>
    <div class="wk-name">${work.name}</div>
  `;
  const img = card.querySelector('img');
  if (img) {
    img.addEventListener('load', () => img.classList.add('loaded'));
    if (img.complete) img.classList.add('loaded');
  }
  track.appendChild(card);
});

/* ── Coverflow render ── */
function render() {
  visCards = Array.from(track.querySelectorAll('.wk-card:not(.hidden)'));
  const n = visCards.length;
  if (!n) return;
  activeIdx = Math.max(0, Math.min(activeIdx, n - 1));

  const spacing = Math.min(window.innerWidth * 0.27, 360);

  visCards.forEach((card, i) => {
    const off  = i - activeIdx;
    const aOff = Math.abs(off);

    let sc, op, zi;
    if      (aOff === 0) { sc = 1;    op = 1;    zi = 10; }
    else if (aOff === 1) { sc = 0.78; op = 0.42; zi = 6;  }
    else if (aOff === 2) { sc = 0.60; op = 0.18; zi = 3;  }
    else                 { sc = 0.50; op = 0;    zi = 1;  }

    const px = off * spacing;
    card.style.transform =
      `translateX(calc(-50% + ${px}px)) translateY(-50%) scale(${sc})`;
    card.style.opacity       = op;
    card.style.zIndex        = zi;
    card.style.pointerEvents = aOff <= 2 ? 'auto' : 'none';
    card.classList.toggle('cov-active', off === 0);
  });

  updateProgress();
}

/* ── Build filter chips ── */
function buildChips(container, allLabel, vals, setFn) {
  [allLabel, ...vals].forEach(v => {
    const b = document.createElement('button');
    b.className = 'chip' + (v === allLabel ? ' active' : '');
    b.textContent = v;
    b.addEventListener('click', () => {
      setFn(v === allLabel ? 'ALL' : v);
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      activeIdx = 0;
      filterCards();
    });
    container.appendChild(b);
  });
}
const seasonRank = { W: 1, S: 2, F: 3 };
function semesterVal(s) {
  return parseInt(s.slice(1)) * 10 + (seasonRank[s[0]] || 0);
}
const sortedYears = [...new Set(worksData.map(w => w.year))].sort((a, b) => semesterVal(b) - semesterVal(a));

buildChips(document.getElementById('yearChips'), 'ALL TIME',     sortedYears,                                    v => activeYear = v);
buildChips(document.getElementById('catChips'),  'ALL CATEGORY', [...new Set(worksData.map(w => w.category))],  v => activeCat  = v);

function filterCards() {
  document.querySelectorAll('.wk-card').forEach(c => {
    const ok = (activeYear === 'ALL' || c.dataset.year === activeYear) &&
               (activeCat  === 'ALL' || c.dataset.cat  === activeCat);
    c.classList.toggle('hidden', !ok);
  });
  render();
}

/* ── Click: side cards focus, center card opens lightbox ── */
track.addEventListener('click', e => {
  const card = e.target.closest('.wk-card');
  if (!card || card.classList.contains('hidden')) return;
  const idx = visCards.indexOf(card);
  if (idx === -1) return;
  if (idx !== activeIdx) {
    activeIdx = idx;
    render();
  } else {
    const name = card.querySelector('.wk-name')?.textContent;
    const work = worksData.find(w => w.name === name);
    if (work) openLightbox(work);
  }
});

/* ── Navigation ── */
function prev() { if (activeIdx > 0)                    { activeIdx--; render(); } }
function next() { if (activeIdx < visCards.length - 1)  { activeIdx++; render(); } }

prevBtn?.addEventListener('click', prev);
nextBtn?.addEventListener('click', next);
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  prev();
  if (e.key === 'ArrowRight') next();
});

/* ── Touch swipe ── */
let touchX = 0;
track.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
track.addEventListener('touchend',   e => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
});

/* ── Wheel scroll ── */
let lastWheel = 0;
window.addEventListener('wheel', e => {
  e.preventDefault();
  const now = Date.now();
  if (now - lastWheel < 300) return;
  lastWheel = now;
  if (e.deltaY > 0 || e.deltaX > 0) next();
  else prev();
}, { passive: false });

/* ── Progress ── */
function updateProgress() {
  const n = visCards.length;
  if (!n || !thumb) return;
  const pct = n <= 1 ? 1 : activeIdx / (n - 1);
  thumb.style.width = (pct * 100) + '%';
}

/* progress bar is indicator only — no drag, no click */

render();
window.addEventListener('resize', render);

} // end if track

/* ── Lightbox ── */
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
    const v = work.path.split('?')[0];
    med.innerHTML = `<iframe src="https://www.youtube.com/embed/${v}?autoplay=1&rel=0" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
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
