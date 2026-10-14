// Page chrome shared by every world: preloader, cursor, magnetic buttons, collection navigator.
import { gsap } from 'gsap';
import { WORLDS } from './worlds.js';
import './ui.css';

/**
 * Preloader bound to an Assets instance. Returns a promise that resolves after the exit animation.
 * `el` is the page's own loader element (each world styles its own); `onValue(v)` updates it.
 */
export function preloader({ assets, el, onValue, minTime = 900, exit = null }) {
  const t0 = performance.now();
  let shown = 0;
  const state = { v: 0 };
  const tick = () => {
    shown += (assets.progress - shown) * 0.12;
    onValue?.(shown);
    if (!state.done) requestAnimationFrame(tick);
  };
  tick();
  return {
    async finish() {
      const wait = Math.max(0, minTime - (performance.now() - t0));
      await new Promise(r => setTimeout(r, wait));
      state.done = true;
      onValue?.(1);
      if (exit) await exit();
      else if (el) await gsap.to(el, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' });
      el?.remove?.();
    },
  };
}

/** Custom cursor: a dot plus a lagging ring that swells over interactive elements. */
export function cursor({ color = '#fff', blend = 'difference', size = 34, label = true } = {}) {
  if (matchMedia('(pointer: coarse)').matches) return null;
  const root = document.createElement('div');
  root.className = 'tw-cursor';
  root.style.setProperty('--c', color);
  root.style.setProperty('--s', size + 'px');
  root.style.mixBlendMode = blend;
  root.innerHTML = '<div class="tw-cursor-ring"><span class="tw-cursor-label"></span></div><div class="tw-cursor-dot"></div>';
  document.body.appendChild(root);
  document.documentElement.classList.add('tw-has-cursor');
  const ring = root.firstElementChild, dot = root.lastElementChild, lab = ring.firstElementChild;
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
  addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; }, { passive: true });
  const loop = () => {
    rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    requestAnimationFrame(loop);
  };
  loop();
  const api = {
    root,
    set(state, text = '') { root.dataset.state = state || ''; lab.textContent = label ? text : ''; },
  };
  document.addEventListener('pointerover', e => {
    const t = e.target.closest?.('a,button,[data-cursor]');
    if (t) api.set(t.dataset.cursor ?? 'link', t.dataset.cursorLabel ?? '');
  });
  document.addEventListener('pointerout', e => {
    const t = e.target.closest?.('a,button,[data-cursor]');
    if (t && !t.contains(e.relatedTarget)) api.set('');
  });
  return api;
}

/** Buttons that lean toward the pointer. */
export function magnetic(selector = '[data-magnetic]', strength = 0.35) {
  document.querySelectorAll(selector).forEach(el => {
    const inner = el.querySelector('[data-magnetic-inner]') ?? el;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: dx * strength, y: dy * strength, duration: 0.5, ease: 'power3.out' });
      if (inner !== el) gsap.to(inner, { x: dx * strength * 0.4, y: dy * strength * 0.4, duration: 0.5, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to([el, inner], { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
    });
  });
}

/** Small collection navigator pinned to a corner of every world. */
export function worldNav(slug, { theme = 'dark', corner = 'bl' } = {}) {
  const i = WORLDS.findIndex(w => w.slug === slug);
  const prev = WORLDS[(i - 1 + WORLDS.length) % WORLDS.length];
  const next = WORLDS[(i + 1) % WORLDS.length];
  const base = import.meta.env.BASE_URL;
  const nav = document.createElement('nav');
  nav.className = `tw-nav tw-nav-${theme} tw-nav-${corner}`;
  nav.setAttribute('aria-label', 'Twenty Worlds');
  nav.innerHTML = `
    <a class="tw-nav-home" href="${base}" title="All twenty worlds">
      <svg viewBox="0 0 20 20" aria-hidden="true"><g fill="currentColor">${[0, 1, 2, 3].map(r => [0, 1, 2, 3, 4].map(c => `<rect x="${1 + c * 3.8}" y="${2 + r * 4.4}" width="2.2" height="2.2" rx=".6" opacity="${(r * 5 + c) === i ? 1 : 0.38}"/>`).join('')).join('')}</g></svg>
    </a>
    <a href="${base}examples/${prev.slug}/" class="tw-nav-step" title="${prev.name}" aria-label="Previous world: ${prev.name}">‹</a>
    <span class="tw-nav-count">${String(i + 1).padStart(2, '0')}<em>/20</em></span>
    <a href="${base}examples/${next.slug}/" class="tw-nav-step" title="${next.name}" aria-label="Next world: ${next.name}">›</a>`;
  document.body.appendChild(nav);
  return nav;
}
