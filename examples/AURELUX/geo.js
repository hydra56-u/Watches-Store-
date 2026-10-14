// Geometry kit for the procedural calibre: signed-distance outlines contoured with marching squares,
// analytic gear/escape/ratchet profiles, and a chamfering extruder whose 45° bevel *is* the anglage.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
const len = (x, y) => Math.sqrt(x * x + y * y);

// ─── 2D signed distances ─────────────────────────────────────────────────────
// Each primitive carries a bounding circle (.b = [cx, cy, R]) so unions can skip far-away parts.
const withB = (f, cx, cy, R) => { f.b = [cx, cy, R]; return f; };
export const circle = (cx, cy, r) => withB((x, y) => len(x - cx, y - cy) - r, cx, cy, r);
export const ring = (cx, cy, r0, r1) => withB((x, y) => { const d = len(x - cx, y - cy); return Math.max(r0 - d, d - r1); }, cx, cy, r1);
export function seg(ax, ay, bx, by, r, rb = r) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  return withB((x, y) => {
    const px = x - ax, py = y - ay;
    const h = clamp((px * dx + py * dy) / L2);
    return len(px - dx * h, py - dy * h) - lerp(r, rb, h);
  }, (ax + bx) / 2, (ay + by) / 2, Math.sqrt(L2) / 2 + Math.max(r, rb));
}
/** A tapered arm along a quadratic Bézier, as a chain of capsules. */
export function arm(ax, ay, cx, cy, bx, by, r, rb = r, n = 14) {
  const parts = [];
  let px = ax, py = ay;
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * ax + 2 * u * t * cx + t * t * bx, y = u * u * ay + 2 * u * t * cy + t * t * by;
    parts.push(seg(px, py, x, y, lerp(r, rb, (i - 1) / n), lerp(r, rb, i / n)));
    px = x; py = y;
  }
  return union(parts);
}
export function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function enclose(fs) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const f of fs) { const [cx, cy, R] = f.b; x0 = Math.min(x0, cx - R); y0 = Math.min(y0, cy - R); x1 = Math.max(x1, cx + R); y1 = Math.max(y1, cy + R); }
  return [(x0 + x1) / 2, (y0 + y1) / 2, len(x1 - x0, y1 - y0) / 2];
}
export function union(fs, k = 0) {
  const n = fs.length, B = fs.map(f => f.b);
  const f = (x, y) => {
    let d = 1e9;
    for (let i = 0; i < n; i++) {
      const b = B[i];
      if (len(x - b[0], y - b[1]) - b[2] > d + k) continue;
      const v = fs[i](x, y);
      d = k ? smin(d, v, k) : Math.min(d, v);
    }
    return d;
  };
  return withB(f, ...enclose(fs));
}
export const subtract = (a, b, k = 0) => withB((x, y) => (k ? -smin(-a(x, y), b(x, y), k) : Math.max(a(x, y), -b(x, y))), ...a.b);

// ─── Marching squares → closed loops (material always on the left of travel) ──
export function contour(sdf, [x0, y0, x1, y1], res) {
  x0 -= res * 2; y0 -= res * 2; x1 += res * 2; y1 += res * 2;
  const nx = Math.ceil((x1 - x0) / res) + 1, ny = Math.ceil((y1 - y0) / res) + 1;
  const F = new Float32Array(nx * ny);
  // Narrow band: a coarse pass decides the sign far from the outline; exact samples only near it.
  const C = 4, cnx = Math.ceil((nx - 1) / C) + 1, cny = Math.ceil((ny - 1) / C) + 1;
  const G = new Float32Array(cnx * cny);
  for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) G[j * cnx + i] = sdf(x0 + i * C * res, y0 + j * C * res);
  const band = 2.2 * C * res;
  for (let j = 0; j < ny; j++) {
    const y = y0 + j * res, cj = Math.min(Math.floor(j / C), cny - 2), fy = j / C - cj;
    for (let i = 0; i < nx; i++) {
      const ci = Math.min(Math.floor(i / C), cnx - 2), fx = i / C - ci;
      const g0 = G[cj * cnx + ci], g1 = G[cj * cnx + ci + 1], g2 = G[(cj + 1) * cnx + ci], g3 = G[(cj + 1) * cnx + ci + 1];
      let v = (g0 * (1 - fx) + g1 * fx) * (1 - fy) + (g2 * (1 - fx) + g3 * fx) * fy;
      if (Math.abs(v) < band) v = sdf(x0 + i * res, y);
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) v = Math.max(v, res);
      F[j * nx + i] = v === 0 ? 1e-9 : v;
    }
  }
  const next = new Map();
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      const a = F[k], b = F[k + 1], c = F[k + nx + 1], d = F[k + nx];
      const code = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (d < 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const eB = 2 * k, eT = 2 * (k + nx), eL = 2 * k + 1, eR = 2 * (k + 1) + 1;
      const L = (p, q) => next.set(p, q);
      const mid = (a + b + c + d) * 0.25 < 0;
      switch (code) {
        case 1: L(eB, eL); break; case 2: L(eR, eB); break; case 3: L(eR, eL); break;
        case 4: L(eT, eR); break; case 6: L(eT, eB); break; case 7: L(eT, eL); break;
        case 8: L(eL, eT); break; case 9: L(eB, eT); break; case 11: L(eR, eT); break;
        case 12: L(eL, eR); break; case 13: L(eB, eR); break; case 14: L(eL, eB); break;
        case 5: if (mid) { L(eB, eR); L(eT, eL); } else { L(eB, eL); L(eT, eR); } break;
        case 10: if (mid) { L(eR, eT); L(eL, eB); } else { L(eR, eB); L(eL, eT); } break;
      }
    }
  }
  const P = (key, out) => {
    const k = key >> 1, i = k % nx, j = (k - i) / nx;
    if (key & 1) { const f0 = F[k], f1 = F[k + nx]; const t = f0 / (f0 - f1); out.push(x0 + i * res, y0 + (j + t) * res); }
    else { const f0 = F[k], f1 = F[k + 1]; const t = f0 / (f0 - f1); out.push(x0 + (i + t) * res, y0 + j * res); }
  };
  const loops = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const pts = [];
    let e = start;
    while (e !== undefined && !seen.has(e)) { seen.add(e); P(e, pts); e = next.get(e); }
    if (pts.length >= 8) loops.push(simplify(pts, res * 0.025));
  }
  return loops;
}

/** Drop nearly-collinear points (keeps curvature, removes marching-squares stair noise on straights). */
export function simplify(pts, eps) {
  const n = pts.length / 2;
  if (n < 8) return pts;
  const out = [pts[0], pts[1]];
  let ax = pts[0], ay = pts[1];
  for (let i = 1; i < n - 1; i++) {
    const bx = pts[2 * i + 2], by = pts[2 * i + 3];
    const cx = pts[2 * i], cy = pts[2 * i + 1];
    const dx = bx - ax, dy = by - ay, L = len(dx, dy) || 1;
    const dist = Math.abs((cx - ax) * dy - (cy - ay) * dx) / L;
    if (dist > eps || L > eps * 400) { out.push(cx, cy); ax = cx; ay = cy; }
  }
  out.push(pts[2 * n - 2], pts[2 * n - 1]);
  return out;
}

export function loopArea(p) { let a = 0; const n = p.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; }
function inside(x, y, p) {
  let c = false; const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[2 * i], yi = p[2 * i + 1], xj = p[2 * j], yj = p[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function reverseLoop(p) { const o = []; for (let i = p.length - 2; i >= 0; i -= 2) o.push(p[i], p[i + 1]); return o; }
/** Pair outer loops (CCW) with the holes (CW) they contain. */
export function groupLoops(loops) {
  const outers = [], holes = [];
  for (const l of loops) { const a = loopArea(l); (a > 0 ? outers : holes).push({ p: l, a: Math.abs(a) }); }
  const groups = outers.map(o => ({ outer: o.p, holes: [], a: o.a }));
  for (const h of holes) {
    let best = null;
    for (const g of groups) if (g.a > h.a && inside(h.p[0], h.p[1], g.outer) && (!best || g.a < best.a)) best = g;
    if (best) best.holes.push(h.p);
  }
  return groups;
}
export const sdfShape = (sdf, bbox, res) => groupLoops(contour(sdf, bbox, res));

// ─── Chamfering extruder ─────────────────────────────────────────────────────
// Caps get normal ±Z, chamfers ±45°, walls are smooth along the outline except at sharp corners.
// Object-space normals let the finish shader tell caps (Côtes, perlage…) from bevels (anglage) from flanks.
export function extrude(groups, { depth, chamfer = 0, bottom = chamfer, sharp = 38 }) {
  const pos = [], nor = [], idx = [];
  const cs = Math.cos(sharp * Math.PI / 180);
  const add = (x, y, z, a, b, c) => { pos.push(x, y, z); nor.push(a, b, c); return pos.length / 3 - 1; };
  const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
  const k = Math.SQRT1_2;
  const z0 = bottom, z1 = depth - chamfer;
  for (const g of groups) {
    const caps = [];
    for (const loop of [g.outer, ...g.holes]) {
      const n = loop.length / 2;
      const ex = new Float64Array(n), ey = new Float64Array(n), vx = new Float64Array(n), vy = new Float64Array(n), sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const dx = loop[2 * j] - loop[2 * i], dy = loop[2 * j + 1] - loop[2 * i + 1], l = Math.hypot(dx, dy) || 1;
        ex[i] = dy / l; ey[i] = -dx / l;
      }
      const top = [], bot = [];
      for (let i = 0; i < n; i++) {
        const p = (i - 1 + n) % n;
        let sx = ex[p] + ex[i], sy = ey[p] + ey[i]; const l = Math.hypot(sx, sy) || 1; sx /= l; sy /= l;
        vx[i] = sx; vy[i] = sy;
        sh[i] = ex[p] * ex[i] + ey[p] * ey[i] < cs ? 1 : 0;
        const miter = 1 / Math.max(sx * ex[i] + sy * ey[i], 0.4);
        const x = loop[2 * i], y = loop[2 * i + 1];
        top.push(x - sx * chamfer * miter, y - sy * chamfer * miter);
        bot.push(x - sx * bottom * miter, y - sy * bottom * miter);
      }
      caps.push({ top, bot });
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = sh[i] ? ex[i] : vx[i], ay = sh[i] ? ey[i] : vy[i];
        const bx = sh[j] ? ex[i] : vx[j], by = sh[j] ? ey[i] : vy[j];
        const xi = loop[2 * i], yi = loop[2 * i + 1], xj = loop[2 * j], yj = loop[2 * j + 1];
        if (z1 > z0 + 1e-7) quad(add(xi, yi, z0, ax, ay, 0), add(xj, yj, z0, bx, by, 0), add(xj, yj, z1, bx, by, 0), add(xi, yi, z1, ax, ay, 0));
        if (chamfer > 0) quad(add(xi, yi, z1, ax * k, ay * k, k), add(xj, yj, z1, bx * k, by * k, k), add(top[2 * j], top[2 * j + 1], depth, bx * k, by * k, k), add(top[2 * i], top[2 * i + 1], depth, ax * k, ay * k, k));
        if (bottom > 0) quad(add(bot[2 * i], bot[2 * i + 1], 0, ax * k, ay * k, -k), add(bot[2 * j], bot[2 * j + 1], 0, bx * k, by * k, -k), add(xj, yj, z0, bx * k, by * k, -k), add(xi, yi, z0, ax * k, ay * k, -k));
      }
    }
    const V2 = a => { const o = []; for (let i = 0; i < a.length; i += 2) o.push(new THREE.Vector2(a[i], a[i + 1])); return o; };
    for (const [key, z, nz] of [['top', depth, 1], ['bot', 0, -1]]) {
      const outer = V2(caps[0][key]), holes = caps.slice(1).map(c => V2(c[key]));
      const faces = THREE.ShapeUtils.triangulateShape(outer, holes);
      const all = [outer, ...holes].flat();
      const base = pos.length / 3;
      for (const v of all) add(v.x, v.y, z, 0, 0, nz);
      for (const [a, b, c] of faces) {
        const A = all[a], B = all[b], C = all[c];
        const cr = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
        if ((cr > 0) === (nz > 0)) idx.push(base + a, base + b, base + c); else idx.push(base + a, base + c, base + b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let i = 0; i < pos.length / 3; i++) { uv[2 * i] = pos[3 * i]; uv[2 * i + 1] = pos[3 * i + 1]; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// ─── Tooth profiles (CCW loops) ──────────────────────────────────────────────
/** Horological (cycloidal-style) teeth: radial dedendum flanks, elliptical ogival addendum. */
export function gearLoop(N, rp, { add = 1.15, ded = 1.45, thick = 0.5, tip = 5, root = 4 } = {}) {
  const m = 2 * rp / N, ra = rp + add * m, rf = rp - ded * m;
  const P = TAU / N, hw = thick * P / 2;
  const out = [];
  const pol = (r, a) => out.push(r * Math.cos(a), r * Math.sin(a));
  for (let q = 0; q < N; q++) {
    const c = q * P;
    for (let s = 1; s < root; s++) pol(rf, lerp(c - P + hw, c - hw, s / root));
    pol(rf, c - hw);
    for (let s = 0; s <= tip * 2; s++) { const t = s / (tip * 2) * Math.PI; pol(rp + (ra - rp) * Math.sin(t), c - hw * Math.cos(t)); }
    pol(rf, c + hw);
  }
  return out;
}
export const rootRadius = (N, rp, ded = 1.45) => rp - ded * 2 * rp / N;

/** Swiss-lever club teeth: a raked locking face, a short impulse plane, a concave back. */
export function escapeLoop(N, ra) {
  const P = TAU / N, rf = ra * 0.7, out = [];
  const pol = (r, a) => out.push(r * Math.cos(a), r * Math.sin(a));
  for (let q = 0; q < N; q++) {
    const c = q * P;
    pol(rf, c);
    for (let s = 1; s <= 3; s++) { const t = s / 3; pol(lerp(rf, ra, t), c + P * 0.2 * t * t); }
    pol(ra * 0.985, c + P * 0.28);
    pol(ra * 0.955, c + P * 0.36);
    for (let s = 1; s <= 5; s++) { const t = s / 6; pol(lerp(ra * 0.955, rf, Math.sin(t * Math.PI / 2)), c + P * lerp(0.36, 0.98, t)); }
  }
  return out;
}

/** Ratchet wheel: saw teeth with a small land at each tip. */
export function ratchetLoop(N, rp) {
  const m = 2 * rp / N, ra = rp + 0.85 * m, rf = rp - 1.05 * m, P = TAU / N, out = [];
  const pol = (r, a) => out.push(r * Math.cos(a), r * Math.sin(a));
  for (let q = 0; q < N; q++) {
    const c = q * P;
    pol(rf, c); pol(ra, c + P * 0.06); pol(ra, c + P * 0.16);
    for (let s = 1; s <= 3; s++) pol(lerp(ra, rf, s / 4), c + P * lerp(0.16, 0.94, s / 4));
    pol(rf, c + P * 0.94);
  }
  return out;
}

export function circleLoop(r, n = 160, cw = false) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (cw ? -1 : 1) * i / n * TAU; out.push(r * Math.cos(a), r * Math.sin(a)); }
  return out;
}

/** Spoke windows for a wheel: annulus minus curved spokes, corners rounded. SDF negative inside a window. */
export function spokeWindows({ n, rIn, rOut, w, curve = 0, round = 0.008, phase = 0, taper = 1 }) {
  return (x, y) => {
    const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x);
    const t = clamp((r - rIn) / (rOut - rIn));
    let d = Math.max(rIn + round - r, r - (rOut - round));
    let best = 1e9;
    for (let q = 0; q < n; q++) {
      const a = phase + q * TAU / n + curve * t * t;
      let da = th - a; da = ((da + Math.PI) % TAU + TAU) % TAU - Math.PI;
      best = Math.min(best, Math.abs(da) * r - w * lerp(1, taper, t) / 2 - round);
    }
    return Math.max(d, -best) - round;
  };
}

/** A wheel: analytic outline + contoured spoke windows, chamfered. */
export function wheelGeometry({ outline, rOut, windows = null, depth, chamfer }) {
  let holes = [];
  if (windows) {
    const R = rOut * 1.02;
    holes = contour(windows, [-R, -R, R, R], Math.max(R / 380, 0.0006)).filter(l => loopArea(l) > 0).map(reverseLoop);
  }
  return extrude([{ outer: outline, holes }], { depth, chamfer });
}

// ─── Faceted 'tent' pieces (hands, applied indices): two flat facets meeting at a ridge ──
export function tentGeometry(profile, { base = 0.004, ridge = 0.006 } = {}) {
  // profile: [[y, halfWidth], ...] ordered along +Y. Built along Y, centred on X, sitting on z = 0.
  const pos = [], nor = [], idx = [];
  const add = (x, y, z, n) => { pos.push(x, y, z); nor.push(n.x, n.y, n.z); return pos.length / 3 - 1; };
  const n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const s of [-1, 1]) {
    for (let i = 0; i < profile.length - 1; i++) {
      const [y0, w0] = profile[i], [y1, w1] = profile[i + 1];
      const P0 = [s * w0, y0, base], P1 = [s * w1, y1, base], C0 = [0, y0, base + ridge * Math.min(1, w0 * 60)], C1 = [0, y1, base + ridge * Math.min(1, w1 * 60)];
      // facet normal from both triangles (either may be degenerate at a pointed end)
      a.set(P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]); b.set(C1[0] - P0[0], C1[1] - P0[1], C1[2] - P0[2]);
      n.crossVectors(a, b);
      a.set(C0[0] - P0[0], C0[1] - P0[1], C0[2] - P0[2]);
      n.add(new THREE.Vector3().crossVectors(b, a));
      if (n.lengthSq() < 1e-20) n.set(0, 0, 1); else n.normalize();
      if (n.z < 0) n.negate();
      const i0 = add(...P0, n), i1 = add(...P1, n), i2 = add(...C1, n), i3 = add(...C0, n);
      if (s > 0) idx.push(i0, i1, i2, i0, i2, i3); else idx.push(i0, i2, i1, i0, i3, i2);
      // wall
      n.set(s, -(w1 - w0) / Math.max(1e-5, y1 - y0), 0).normalize();
      const j0 = add(s * w0, y0, 0, n), j1 = add(s * w1, y1, 0, n), j2 = add(s * w1, y1, base, n), j3 = add(s * w0, y0, base, n);
      if (s > 0) idx.push(j0, j1, j2, j0, j2, j3); else idx.push(j0, j2, j1, j0, j3, j2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

// ─── Lathe helper around +Z (three's lathe spins around Y) ──
export function latheZ(points, segments = 128) {
  const g = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), segments);
  g.rotateX(Math.PI / 2);
  return g;
}
export function cylZ(r, z0, z1, seg = 32, rTop = r) {
  const g = new THREE.CylinderGeometry(rTop, r, z1 - z0, seg, 1);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

// ─── Spiral ribbon with a rectangular section (mainspring, hairspring) ──
// sample(s) → [r, θ]; writes into a preallocated geometry so it can be re-posed every frame.
export class Ribbon {
  constructor(n, { width, z0, z1, attr = false }) {
    this.n = n; this.width = width; this.z0 = z0; this.z1 = z1;
    const V = n * 6;
    this.pos = new Float32Array(V * 3);
    this.nor = new Float32Array(V * 3);
    const idx = [];
    for (let f = 0; f < 3; f++) for (let i = 0; i < n - 1; i++) {
      const a = f * n * 2 + i * 2, b = a + 2;
      idx.push(a, b + 1, b, a, a + 1, b + 1);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    if (attr) {
      const s = new Float32Array(V);
      for (let f = 0; f < 3; f++) for (let i = 0; i < n; i++) s[f * n * 2 + i * 2] = s[f * n * 2 + i * 2 + 1] = i / (n - 1);
      this.geo.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    }
    this.geo.setIndex(idx);
  }
  pose(rs, ths) {
    const { n, width: w, z0, z1, pos, nor } = this;
    const put = (v, x, y, z, nx, ny, nz) => { pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz; };
    for (let i = 0; i < n; i++) {
      const r = rs[i], c = Math.cos(ths[i]), s = Math.sin(ths[i]);
      const ri = r - w / 2, ro = r + w / 2;
      // top face (inner, outer)
      put(i * 2, ri * c, ri * s, z1, 0, 0, 1); put(i * 2 + 1, ro * c, ro * s, z1, 0, 0, 1);
      // outer wall (bottom, top)
      put(n * 2 + i * 2, ro * c, ro * s, z1, c, s, 0); put(n * 2 + i * 2 + 1, ro * c, ro * s, z0, c, s, 0);
      // inner wall
      put(n * 4 + i * 2, ri * c, ri * s, z0, -c, -s, 0); put(n * 4 + i * 2 + 1, ri * c, ri * s, z1, -c, -s, 0);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

/** Re-express a geometry built in XY (+Z up) into another frame via a basis. */
export function rebase(geo, m) { geo.applyMatrix4(m); return geo; }
