// Lenis smooth scrolling bound to GSAP ScrollTrigger, plus helpers for scroll-driven 3D.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);
export { gsap, ScrollTrigger, SplitText };

export function smoothScroll({ lerp = 0.085, wheelMultiplier = 1, ...rest } = {}) {
  const lenis = new Lenis({ lerp, wheelMultiplier, smoothWheel: true, syncTouch: false, ...rest });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
  return lenis;
}

/** Normalised page progress (0..1) and progress through an element's scroll span. */
export function pageProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  return max > 0 ? scrollY / max : 0;
}

export function elementProgress(el, { start = 'top top', end = 'bottom bottom' } = {}) {
  const r = el.getBoundingClientRect();
  const vh = innerHeight;
  const s = start === 'top bottom' ? r.top - vh : start === 'top center' ? r.top - vh / 2 : r.top;
  const e = end === 'bottom top' ? r.bottom : end === 'bottom center' ? r.bottom - vh / 2 : r.bottom - vh;
  const span = e - s || 1;
  return Math.min(1, Math.max(0, -s / span));
}

/** Reveal text by lines/words/chars when it scrolls into view. */
export function reveal(selector, { type = 'lines', stagger = 0.08, y = '110%', duration = 1.1, ease = 'expo.out', start = 'top 85%', scrub = false, mask = true } = {}) {
  const els = typeof selector === 'string' ? document.querySelectorAll(selector) : [selector].flat();
  const out = [];
  els.forEach(el => {
    const split = SplitText.create(el, { type, mask: mask ? type.split(',').pop().trim() : undefined, autoSplit: true,
      onSplit(self) {
        const targets = self[type.split(',').pop().trim()];
        return gsap.from(targets, { yPercent: parseFloat(y), opacity: 0, duration, ease, stagger,
          scrollTrigger: scrub ? { trigger: el, start, end: 'bottom 40%', scrub: true } : { trigger: el, start, once: true } });
      } });
    out.push(split);
  });
  return out;
}
