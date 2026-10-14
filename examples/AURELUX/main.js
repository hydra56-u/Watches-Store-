import { Engine, THREE, prepModel, damp, clamp, smooth, lerp } from '../../src/core/engine.js';
import { DepthOfFieldEffect } from 'postprocessing';
import { Assets, firstMesh } from '../../src/core/assets.js';
import { Pointer } from '../../src/core/input.js';
import { smoothScroll, gsap } from '../../src/core/scroll.js';
import { preloader, cursor, magnetic, worldNav } from '../../src/core/ui.js';
import { buildMovement } from './movement.js';
import { patch, irisUniforms } from './finish.js';
import { makeStudio } from './studio.js';
import { ContactShadow } from './shadow.js';

const Q = new URLSearchParams(location.search);
const D2R = Math.PI / 180;
const MOBILE = () => innerWidth / innerHeight < 0.8;

// ─── Engine ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gl');
let dof = null;
const engine = new Engine({
  canvas, fov: 30, near: 0.05, far: 120, dpr: 1.25, background: 0x0b0b0f,
  post: {
    tone: 'neutral',
    ao: { aoRadius: 0.16, intensity: 2.1, distanceFalloff: 1.1 },
    bloom: { intensity: 0.55, luminanceThreshold: 1.3, luminanceSmoothing: 0.25, radius: 0.62 },
    vignette: false, noise: 0.022, ca: 0.0005,
    pre: cam => (Q.has('nodof') ? [] : [(dof = new DepthOfFieldEffect(cam, { focusDistance: 8, focusRange: 3, bokehScale: 0, resolutionScale: 0.5 }))]),
  },
});
const { scene, camera, renderer } = engine;
const AURELUX_BG = new THREE.Color(0x0b0b0f);

renderer.setClearColor(AURELUX_BG, 1);
const studio = makeStudio(renderer, scene, { front: 2.1, dome: 1.4 });

// Ivory cyclorama: a full-screen HDR gradient drawn behind everything (lands on #f3efe7 after neutral tone mapping).
const backdrop = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)),
  new THREE.ShaderMaterial({
    depthWrite: false, depthTest: false,
    uniforms: {
  uC: { value: AURELUX_BG.clone() },
  uRes: { value: new THREE.Vector2(1, 1) },
  uFocus: { value: new THREE.Vector2(0.62, 0.52) }
},
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: `uniform vec3 uC; uniform vec2 uRes, uFocus;
      void main(){ vec2 uv = gl_FragCoord.xy / uRes; vec2 d = (uv - uFocus) * vec2(uRes.x / uRes.y, 1.0);
        float r = length(d);

vec3 c = uC * mix(
  1.8,
  0.65,
  smoothstep(0.0, 1.3, r)
);

c += vec3(0.018, 0.009, 0.012)
   * (1.0 - smoothstep(0.0, 1.1, r));
        gl_FragColor = vec4(c, 1.0); }`,
  }));
backdrop.frustumCulled = false; backdrop.renderOrder = -10;
scene.add(backdrop);
engine.onResize((w, h, dpr) => backdrop.material.uniforms.uRes.value.set(w * dpr, h * dpr));

const shadow = new ContactShadow(renderer, scene, { width: 18, depth: 11, y: -2.75, res: 512, far: 5.2, blur: 3.4, opacity: 0.55 });
shadow.hidden.push(backdrop);

// ─── Loader ──────────────────────────────────────────────────────────────────
const assets = new Assets();
const loaderEl = document.querySelector('.loader');
{
  const g = loaderEl.querySelector('.lg-ticks');
  for (let i = 0; i <= 72; i += 6) { const a = (i / 72) * Math.PI * 2 - Math.PI / 2, r0 = i % 24 ? 90 : 89, r1 = i % 24 ? 94 : 98;
    g.insertAdjacentHTML('beforeend', `<line x1="${100 + Math.cos(a) * r0}" y1="${100 + Math.sin(a) * r0}" x2="${100 + Math.cos(a) * r1}" y2="${100 + Math.sin(a) * r1}"/>`); }
}
let buildP = 0;
const loader = preloader({
  assets, el: loaderEl, minTime: 1500,
  onValue: v => { const p = Math.min(v * 0.75 + buildP * 0.25, 1); loaderEl.style.setProperty('--p', p); loaderEl.querySelector('.loader-n').textContent = Math.round(p * 72); },
  exit: () => gsap.timeline()
    .to('.loader-gauge', { scale: 1.08, duration: 0.5, ease: 'power2.out' })
    .to(loaderEl, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, 0.25),
});

// ─── Rig: the Meshy watch and the procedural calibre share one frame (dial centre at origin, dial → +Z) ──
const rig = new THREE.Group();
scene.add(rig);
const irisA = irisUniforms();
const pointer = new Pointer({ lambda: 5 });

const watchLoad = assets.gltf('models/horologie/watch.glb');
const mvBuild = buildMovement({ u: irisA, yieldFn: () => new Promise(r => { buildP = Math.min(buildP + 0.1, 1); setTimeout(r, 0); }) });

function prepWatch(src) {
  src.updateMatrixWorld(true);
  const mesh = firstMesh(src);
  const pos = mesh.geometry.attributes.position, v = new THREE.Vector3();
  let zmin = 1e9, zmax = -1e9;
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); zmin = Math.min(zmin, v.z); zmax = Math.max(zmax, v.z); }
  const slab = zmax - 0.1 * (zmax - zmin);
  const bb = new THREE.Box2(new THREE.Vector2(1e9, 1e9), new THREE.Vector2(-1e9, -1e9));
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); if (v.z > slab) bb.expandByPoint(new THREE.Vector2(v.x, v.y)); }
  const c = bb.getCenter(new THREE.Vector2()), r = (bb.max.x - bb.min.x) / 2;
  const s = 1.205 / r;
  const holder = new THREE.Group();
  holder.add(src);
  src.scale.setScalar(s);
  src.position.set(-c.x * s, -c.y * s, 0.335 - zmax * s);
  src.updateMatrixWorld(true);
  const inv = mesh.matrixWorld.clone().invert();
  const dialC = new THREE.Vector3(0, 0, 0.335).applyMatrix4(inv);
  const caseR = 1.205 / mesh.matrixWorld.getMaxScaleOnAxis();
  return { holder, mesh, dialC, caseR };
}

// ─── Keyframes (world space unless camL/lookL: rig-local) ────────────────────
// s = keyframe index along the page; each segment eases with a short hold at both ends.
const KF = [
  { id: 'hero', sec: 'top', p: 0, cam: [0, 0.15, 10.6], look: [0.25, 0.02, 0], fov: 30, rig: [1.95, 0.12, 0, -6, -32, 5], explode: 0, iris: 0, tilt: 1, ts: 1, m: { rig: [0, -2.7, 0, -6, -32, 5], cam: [0, -0.55, 16.5], look: [0, -0.55, 0] } },
  { id: 'open', sec: 'calibre', p: 0.045, cam: [0.4, 0, 7.8], look: [0.4, 0, 0], fov: 30, rig: [1.55, 0, 0, -6, 14, 0], explode: 0, iris: 1, irisEase: [0.3, 0.62], tilt: 0.5, ts: 1, m: { rig: [0, 1.05, 0, -6, 14, 0], cam: [0, 0.2, 12.5], look: [0, 0.2, 0] } },
  { id: 'exploded', sec: 'calibre', p: 0.24, cam: [0.35, 0.05, 12.6], look: [0.35, 0.05, 0], fov: 30, rig: [1.75, -0.45, 0, -41.8, 41.3, -20], explode: 1, iris: 1, tilt: 0.35, ts: 1, m: { rig: [0.1, 0.9, 0, -58, 22, -24], cam: [0, 0.35, 19], look: [0, 0.35, 0] } },
  { id: 'barrel', sec: 'calibre', p: 0.45, orbit: [0.4, 0.3, -0.38, -40, 5, 4.6], shift: -0.5, fov: 30, rig: [1.9, 0, 0, -41.8, 41.3, -20], m: { rig: [0.15, 0.55, 0, -58, 22, -24] }, explode: 1, iris: 1, tilt: 0.2, ts: 1, dof: 3.5, fr: 1.3, focus: 'barrel', gap: [8, 0.6], fly: { dial: 3.5, hands: 4, crystal: 5 } },
  { id: 'train', sec: 'calibre', p: 0.65, orbit: [-0.05, 0.0, 0.1, -32, 2, 4.1], shift: -0.6, fov: 30, rig: [1.9, 0, 0, -41.8, 41.3, -20], m: { rig: [0.15, 0.55, 0, -58, 22, -24] }, explode: 1, iris: 1, tilt: 0.2, ts: 1, dof: 2.2, fr: 1.8, focus: 'train', gap: [0.22, 0.25], fly: { plate: -8, case: -8.5, caseback: -9, bridges: 3.2, winding: 3.4, dial: 3.8, hands: 4.2, crystal: 5 } },
  { id: 'escapement', sec: 'calibre', p: 0.86, orbit: [0, -0.47, 0.86, 12, -2, 2.95], shift: -0.62, fov: 30, rig: [1.9, 0, 0, -41.8, 41.3, -20], m: { rig: [0.15, 0.55, 0, -58, 22, -24] }, explode: 1, iris: 1, tilt: 0.15, ts: 0.1, dof: 4, fr: 0.6, focus: 'cage', gap: [6, 0.6], fly: { dial: 3.5, hands: 4, crystal: 5 } },
  { id: 'cotes', sec: 'finishing', p: 0.14, orbit: [-0.5, 0.12, 1.1, 30, 10, 1.2], shift: 0.3, fov: 30, rig: [1.9, 0, 0, -41.8, 41.3, -20], m: { rig: [0.15, 0.55, 0, -58, 22, -24] }, explode: 1, iris: 1, tilt: 0.08, ts: 1, dof: 6, fr: 0.3, focus: 'bridges', gap: 0.95 },
  { id: 'perlage', sec: 'finishing', p: 0.5, orbit: [-0.55, -0.12, -1.34, -30, 10, 1.2], shift: 0.3, fov: 30, rig: [1.9, 0, 0, -41.8, 41.3, -20], m: { rig: [0.15, 0.55, 0, -58, 22, -24] }, explode: 1, iris: 1, tilt: 0.08, ts: 1, dof: 6, fr: 0.3, focus: 'plate', gap: 0.95 },
  { id: 'anglage', sec: 'finishing', p: 0.86, orbit: [0.37, -0.36, 1.21, 60, 6, 1.05], shift: 0.25, fov: 30, rig: [1.9, 0, 0, -41.8, 41.3, -20], m: { rig: [0.15, 0.55, 0, -58, 22, -24] }, explode: 1, iris: 1, tilt: 0.08, ts: 1, dof: 3.5, fr: 0.35, focus: 'bridges', gap: 0.95 },
  { id: 'assembled', sec: 'collection', p: 0.07, cam: [0, 0.1, 12.2], look: [0, -0.2, 0], fov: 30, rig: [0, 0.55, 0, -8, -30, 5], explode: 0, iris: 0, irisEase: [0.36, 0.66], tilt: 0.8, ts: 1, m: { cam: [0, 0.2, 17], look: [0, 0.2, 0], rig: [0, 1.6, 0, -8, -30, 5] } },
  { id: 'collection', sec: 'collection', p: 0.5, cam: [0, 0.35, 15.2], look: [0, 0.1, 0], fov: 30, rig: [0, 0.55, 0, -4, -24, 4], explode: 0, iris: 0, irisEase: [0.05, 0.3], tilt: 0.5, ts: 1, coll: 1, m: { cam: [0, 0.2, 21], look: [0, -0.2, 0], rig: [0, 0.2, 0.8, -4, -24, 4] } },
  { id: 'atelier', sec: 'atelier', p: 0.42, cam: [0, 0.2, 7.6], look: [0.35, 0.05, 0], fov: 30, rig: [1.7, -0.3, 0, -52, 24, 18], explode: 0.26, iris: 1, irisEase: [0.5, 0.66], ease: [0.46, 0.92], collEase: [0.45, 0.6], tilt: 0.5, ts: 1, bare: 1, dof: 1.2, fr: 2.5, m: { rig: [0, 1.0, 0, -52, 24, 18], cam: [0, 0.4, 13], look: [0, 0.4, 0] } },
  { id: 'cta', sec: 'appointment', p: 0.25, cam: [0, 0.1, 10.4], look: [-0.6, 0.05, 0], fov: 30, rig: [1.7, 0.05, 0, -6, -34, 5], explode: 0, iris: 0, irisEase: [0.3, 0.6], tilt: 1, ts: 1, m: { rig: [0, 2.3, 0, -6, -34, 5], cam: [0, 0.5, 16.5], look: [0, 0.5, 0] } },
];
window.__KF = KF;
if (Q.has('kf')) { // tuning overrides: ?kf=3&camL=x,y,z&lookL=x,y,z (or cam/look, rig=px,py,pz,rx,ry,rz)
  const k = KF[Math.floor(+Q.get('kf'))];
  for (const key of ['camL', 'lookL', 'cam', 'look', 'rig', 'orbit']) if (Q.has(key)) k[key] = Q.get(key).split(',').map(Number);
  if (Q.has('shift')) k.shift = +Q.get('shift');
  if (Q.has('dofv')) k.dof = +Q.get('dofv');
}
const COLL = [
  { pos: [-3.45, 0.55, -0.4], mpos: [-1.75, 1.2, -2.6], tint: [0.6, 0.61, 0.64], strap: [0.018, 0.03, 0.085], dlc: 0 },   // Glacier: platinum, midnight strap
  { pos: [3.45, 0.55, -0.4], mpos: [1.75, 1.2, -2.6], tint: [0.055, 0.055, 0.06], strap: [0.012, 0.012, 0.013], dlc: 1 }, // Nuit: DLC, black calf
];

const kfY = new Array(KF.length).fill(0);
function measure() {
  for (let i = 0; i < KF.length; i++) {
    const k = KF[i], el = document.getElementById(k.sec);
    const top = el.getBoundingClientRect().top + scrollY;
    kfY[i] = top + k.p * Math.max(0, el.offsetHeight - innerHeight);
  }
  // Where each copy block sits, so it can fade before sliding under the nav when its stage scrolls away.
  for (const el of steps ?? []) {
    const sec = el.closest('section'), r = sec.getBoundingClientRect();
    el._secTop = r.top + scrollY; el._secH = sec.offsetHeight; el._sticky = !!el.closest('.stage'); el._y = el.offsetTop;
  }
}
function scrollS(y = scrollY) {
  if (y <= kfY[0]) return 0;
  for (let i = 0; i < KF.length - 1; i++) if (y < kfY[i + 1]) return i + (y - kfY[i]) / Math.max(1, kfY[i + 1] - kfY[i]);
  return KF.length - 1;
}
window.__goto = i => { measure(); const y = kfY[Math.floor(i)] + (i % 1) * ((kfY[Math.floor(i) + 1] ?? kfY[Math.floor(i)]) - kfY[Math.floor(i)]); window.__lenis?.scrollTo(y, { immediate: true, force: true }); S = i; };

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
// Phones get their own framing: subject above or below the copy card instead of beside it.
const V = k => (MOBILE() && k.m ? { ...k, ...k.m } : k);
function kfRig(k0, outP, outQ) {
  const k = V(k0), r = k.rig;
  outP.set(r[0], r[1], r[2]);
  if (MOBILE() && !k0.m?.rig) outP.x *= 0.1;
  outQ.setFromEuler(tmpE.set(r[3] * D2R, r[4] * D2R, r[5] * D2R));
}
const tmpQ2 = new THREE.Quaternion(), tmpUp = new THREE.Vector3();
function kfCam(k0, outC, outL) {
  const k = V(k0), mob = MOBILE();
  if (k.orbit) {
    // Orbit a rig-local target, measured from the overview direction (world +Z seen from the rig).
    kfRig(k0, tmpV, tmpQ);
    const [tx, ty, tz, yaw, pitch, d0] = k.orbit, dist = d0 * (mob ? 1.3 : 1);
    const v = tmpV2.set(0, 0, 1).applyQuaternion(tmpQ2.copy(tmpQ).invert());
    const phi = Math.atan2(v.y, v.x) + yaw * D2R, th = Math.asin(clamp(v.z, -1, 1)) + pitch * D2R;
    outL.set(tx, ty, tz);
    outC.set(tx + dist * Math.cos(th) * Math.cos(phi), ty + dist * Math.cos(th) * Math.sin(phi), tz + dist * Math.sin(th));
    tmpM.compose(tmpV, tmpQ, new THREE.Vector3(1, 1, 1));
    outC.applyMatrix4(tmpM); outL.applyMatrix4(tmpM);
    const fw = tmpV2.subVectors(outL, outC).normalize();
    const shift = mob ? 0 : k.shift;
    if (shift) { const r = tmpUp.crossVectors(fw, camera.up).normalize(); outC.addScaledVector(r, shift); outL.addScaledVector(r, shift); }
    if (mob) { const r = tmpUp.crossVectors(fw, camera.up).normalize(); const up = r.cross(fw).normalize(); const lift = -0.28 * dist * Math.tan(15 * D2R); outC.addScaledVector(up, lift); outL.addScaledVector(up, lift); }
    return;
  }
  if (k.camL) {
    kfRig(k0, tmpV, tmpQ);
    tmpM.compose(tmpV, tmpQ, new THREE.Vector3(1, 1, 1));
    outC.set(...k.camL).applyMatrix4(tmpM); outL.set(...k.lookL).applyMatrix4(tmpM);
  } else {
    outC.set(...k.cam); outL.set(...k.look);
    if (mob && !k0.m?.cam) { outC.x = outL.x = 0; outC.z *= 1.5; }
  }
}
const A = { p: new THREE.Vector3(), q: new THREE.Quaternion(), c: new THREE.Vector3(), l: new THREE.Vector3() };
const B = { p: new THREE.Vector3(), q: new THREE.Quaternion(), c: new THREE.Vector3(), l: new THREE.Vector3() };
const ST = { rigP: new THREE.Vector3(), rigQ: new THREE.Quaternion(), cam: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30, explode: 0, iris: 0, tilt: 1, ts: 1, coll: 0, bokeh: 0, fr: 3 };
const ease = f => smooth(0.2, 0.8, f);
const LAYER_DZ = { caseback: -2.3, case: -1.8, plate: -1.15, fixed: -0.72, barrel: -0.3, train: 0.14, cage: 0.55, bridges: 1.02, winding: 1.4, dial: 1.8, hands: 2.15, crystal: 2.6 };
const GAP = Object.fromEntries(Object.keys(LAYER_DZ).map(k => [k, 0]));
function gapOf(k, name) {
  if (!k.focus || !k.gap) return 0;
  const d = LAYER_DZ[name] - LAYER_DZ[k.focus];
  const [down, up] = Array.isArray(k.gap) ? k.gap : [k.gap, k.gap];
  return Math.abs(d) < 1e-3 ? 0 : d > 0 ? up : -down;
}
function evalState(s) {
  const i = clamp(Math.floor(s), 0, KF.length - 1), j = Math.min(i + 1, KF.length - 1), f = s - i;
  const a = KF[i], b = KF[j], e = b.ease ? smooth(b.ease[0], b.ease[1], f) : ease(f);
  kfRig(a, A.p, A.q); kfRig(b, B.p, B.q); kfCam(a, A.c, A.l); kfCam(b, B.c, B.l);
  ST.rigP.lerpVectors(A.p, B.p, e); ST.rigQ.slerpQuaternions(A.q, B.q, e);
  ST.cam.lerpVectors(A.c, B.c, e); ST.look.lerpVectors(A.l, B.l, e);
  // Between two close-ups, pull out and push back in so the mid-flight frame still shows the stack.
  if (a.orbit && b.orbit) { const k = 1 + 0.75 * Math.sin(e * Math.PI); tmpV.subVectors(ST.cam, ST.look).multiplyScalar(k); ST.cam.copy(ST.look).add(tmpV); }
  else ST.cam.y += Math.sin(e * Math.PI) * A.c.distanceTo(B.c) * 0.06; // arc long moves so they never pass through parts
  ST.fov = lerp(a.fov, b.fov, e);
  ST.explode = lerp(a.explode, b.explode, smooth(0.08, 0.95, f));
  const ie = b.irisEase ? smooth(b.irisEase[0], b.irisEase[1], f) : e;
  ST.iris = lerp(a.iris, b.iris, ie);
  ST.tilt = lerp(a.tilt, b.tilt, e);
  ST.ts = Math.exp(lerp(Math.log(a.ts), Math.log(b.ts), e));
  ST.coll = lerp(a.coll ?? 0, b.coll ?? 0, b.collEase ? smooth(b.collEase[0], b.collEase[1], f) : b.coll ? smooth(0.2, 0.5, f) : smooth(0.08, 0.32, f));
  ST.bokeh = lerp(a.dof ?? 0, b.dof ?? 0, e);
  for (const n in GAP) GAP[n] = lerp(gapOf(a, n), gapOf(b, n), e);
  for (const n in GAP) GAP[n] += lerp(a.fly?.[n] ?? 0, b.fly?.[n] ?? 0, e);
  const bare = lerp(a.bare ?? 0, b.bare ?? 0, e);
  GAP.caseback -= bare * 12; GAP.case -= bare * 10; GAP.crystal += bare * 12;
  ST.bare = bare;
  ST.fr = lerp(a.fr ?? 3, b.fr ?? 3, e);
  return ST;
}

// ─── Labels projected from 3D anchors ────────────────────────────────────────
// side: 'u' = above-left of the stack, 'd' = below-right (perpendicular to the projected axis); off = leader length (px).
const LABELS = [
  { a: 'crystal', t: 'Sapphire crystal', s: 'anti-reflective, both faces', k: [2], side: 'u', off: 70 },
  { a: 'hands', t: 'Hands', s: 'flame-blued steel', k: [], side: 'd', off: 90 },
  { a: 'dial', t: 'Chapter ring', s: 'azurage, applied batons', k: [], side: 'u', off: 90 },
  { a: 'bridges', t: 'Bridges', s: 'Côtes de Genève', k: [2, 6], side: 'd', off: 70 },
  { a: 'winding', t: 'Winding works', s: 'ratchet & crown wheel', k: [3], side: 'u', off: 70 },
  { a: 'barrel', t: 'Barrel', s: '72 h reserve', k: [2, 3, 4], side: 'u', off: 175, offk: { 3: 70, 4: 70 } },
  { a: 'train', t: 'Going train', s: 'centre & third wheels', k: [4], side: 'd', off: 90 },
  { a: 'tourbillon', t: 'Tourbillon', s: 'one turn a minute', k: [2, 4, 5], side: 'd', off: 150, offk: { 4: 80, 5: 80 } },
  { a: 'escapement', t: 'Escapement', s: '28,800 vph', k: [5], side: 'd', off: 90 },
  { a: 'balance', t: 'Balance & hairspring', s: '4 Hz, breathing', k: [5], side: 'u', off: 90 },
  { a: 'plate', t: 'Mainplate', s: 'perlage', k: [2, 7], side: 'u', off: 60 },
  { a: 'crown', t: 'Crown', s: 'press & hold to wind', k: [2], side: 'd', off: 60 },
  { a: 'tbridge', t: 'Tourbillon bridge', s: 'black polish, 45° anglage', k: [8], side: 'u', off: 90 },
  { a: 'caseback', t: 'Caseback', s: 'Nº 07 / 38', k: [2], side: 'd', off: 55 },
];
const labelsEl = document.querySelector('.labels'), svg = labelsEl.querySelector('.leaders');
const NS = 'http://www.w3.org/2000/svg';
for (const L of LABELS) {
  L.el = document.createElement('div'); L.el.className = 'label'; L.el.innerHTML = `<b>${L.t}</b><span>${L.s}</span>`; labelsEl.appendChild(L.el);
  L.path = document.createElementNS(NS, 'path'); L.dot = document.createElementNS(NS, 'circle'); L.ring = document.createElementNS(NS, 'circle');
  L.dot.setAttribute('r', 2.2); L.dot.setAttribute('class', 'dot'); L.ring.setAttribute('r', 6); L.ring.setAttribute('class', 'ring');
  svg.append(L.path, L.dot, L.ring);
  L.w = 0;
}

// ─── Steps (HTML copy tied to keyframes) ─────────────────────────────────────
var steps = [...document.querySelectorAll('[data-k]')].filter(el => !el.closest('.rail'));
for (const el of steps) { const ks = [...el.closest('section').querySelectorAll('[data-k]')].filter(e => !e.closest('.rail')).map(e => +e.dataset.k); el._first = +el.dataset.k === Math.min(...ks); el._last = +el.dataset.k === Math.max(...ks); }
const railItems = [...document.querySelectorAll('.rail li')];
const railEl = document.querySelector('.rail');
const heroEl = document.querySelector('.hero');
const orbitEl = document.querySelector('.orbit');
{
  const g = orbitEl.querySelector('.ob-ticks');
  let h = '';
  for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, big = i % 10 === 0, mid = i % 2 === 0; const r0 = big ? 180 : mid ? 186 : 189, r1 = 193;
    h += `<line x1="${(200 + Math.cos(a) * r0).toFixed(2)}" y1="${(200 + Math.sin(a) * r0).toFixed(2)}" x2="${(200 + Math.cos(a) * r1).toFixed(2)}" y2="${(200 + Math.sin(a) * r1).toFixed(2)}" class="${big ? 'b' : ''}"/>`; }
  g.innerHTML = h;
}
const orbitRot = orbitEl.querySelector('.ob-rot');

// ─── Winding interaction ─────────────────────────────────────────────────────
const reserveEl = document.querySelector('.reserve'), reserveBtn = reserveEl.querySelector('.reserve-btn');
const rvVal = reserveEl.querySelector('.rv-val b');
const crownHintEl = document.querySelector('.crown-hint');
const crownTurnEl = crownHintEl.querySelector('span');
const toastEl = document.querySelector('.toast');
const soundBtn = document.querySelector('.sound');
{
  const g = reserveEl.querySelector('.rv-ticks');
  for (let i = 0; i <= 72; i += 12) { const a = (i / 72) * Math.PI * 2 - Math.PI / 2; g.insertAdjacentHTML('beforeend', `<line x1="${60 + Math.cos(a) * 54}" y1="${60 + Math.sin(a) * 54}" x2="${60 + Math.cos(a) * 57.5}" y2="${60 + Math.sin(a) * 57.5}"/>`); }
}
let toastT;
function toast(msg, ms = 2600) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms); }
soundBtn.addEventListener('click', () => { soundBtn.setAttribute('aria-pressed', soundBtn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); try { ac ??= new AudioContext(); ac.resume?.(); } catch { /* no audio */ } });
let ac = null;
function tick(kind = 'click') {
  if (soundBtn.getAttribute('aria-pressed') !== 'true') return;
  try {
    ac ??= new AudioContext();
    const t = ac.currentTime, len = kind === 'full' ? 0.25 : kind === 'beat' ? 0.06 : 0.03;
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const k = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.exp(-k * (kind === 'full' ? 9 : kind === 'beat' ? 14 : 26)); }
    const src = ac.createBufferSource(); src.buffer = buf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kind === 'full' ? 1800 : kind === 'beat' ? 1150 : 3600 + Math.random() * 900; bp.Q.value = kind === 'full' ? 3 : kind === 'beat' ? 4 : 1.6;
    const g = ac.createGain(); g.gain.value = kind === 'full' ? 0.22 : kind === 'beat' ? 0.1 : 0.14;
    src.connect(bp).connect(g).connect(ac.destination); src.start(t);
  } catch { /* sound is a nicety */ }
}
const wind = { holding: false, from: 0, fx: 0, full: false, wound: false };
let mv = null, cursorApi = null;
function startWind() {
  if (!mv || wind.holding) return;
  wind.holding = true; wind.from = mv.st.w; wind.wound = true;
  reserveEl.classList.add('holding');
  try { ac ??= new AudioContext(); ac.resume?.(); } catch { /* no audio */ }
}
function endWind() {
  if (!wind.holding) return;
  wind.holding = false;
  reserveEl.classList.remove('holding');
  const gained = mv.st.w - wind.from;
  if (gained > 0.01) mv.st.boost = Math.min(1.25, 0.25 + gained * 2.4);
}
reserveBtn.addEventListener('pointerdown', e => { e.preventDefault(); startWind(); });
addEventListener('pointerup', endWind); addEventListener('pointercancel', endWind); addEventListener('blur', endWind);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let overCrown = false;
function crownUnder(e) {
  if (!mv || S < 1.7 || S > 5.6) return false;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObject(mv.crownHit, false).length > 0;
}
canvas.addEventListener('pointerdown', e => { if (crownUnder(e)) { e.preventDefault(); startWind(); } });
addEventListener('pointermove', e => {
  const o = crownUnder(e);
  if (o !== overCrown) { overCrown = o; cursorApi?.set(o ? 'drag' : '', o ? 'Hold' : ''); canvas.style.cursor = o ? 'grab' : ''; }
}, { passive: true });

// ─── Frame loop ───────────────────────────────────────────────────────────────
let S = Q.has('kf') ? +Q.get('kf') : 0;
let started = false, intro = { spin: 0, sweep: 0 }, lastBeat = null;
let watch = null, clones = [];
const tiltQ = new THREE.Quaternion(), footEl = document.querySelector('.foot'), ctaEl = document.querySelector('.cta'), navEl = document.querySelector('.nav');
const irisCenter = new THREE.Vector3();

engine.onTick((dt, t) => {
  if (!mv) return;
  pointer.update(dt);
  if (!Q.has('kf')) S = damp(S, scrollS(), 7, dt);
  const st = evalState(S);
  window.__S = S;

  // Rig: keyframed pose + pointer tilt + a slow float.
  rig.position.copy(st.rigP);
  rig.position.y += Math.sin(t * 0.7) * 0.035 * st.tilt;
  tiltQ.setFromEuler(tmpE.set(-pointer.sy * 0.16 * st.tilt, pointer.sx * 0.3 * st.tilt + intro.spin, 0));
  rig.quaternion.copy(tiltQ).multiply(st.rigQ);

  // Winding: the barrel fills; the camera leans in a touch; a light sweep crosses the metal.
  if (wind.holding) {
    const before = mv.st.clicks;
    mv.st.w = Math.min(1, mv.st.w + dt / 3.2);
    if (mv.st.clicks !== before) { tick(); wind.pulse = 1; }
    if (mv.st.w >= 1 && !wind.full) { wind.full = true; tick('full'); toast('Fully wound · seventy-two hours'); endWind(); }
  } else if (S < 2.2 || S > 5.8) {
    mv.st.w = damp(mv.st.w, 0.34, 0.08, dt); if (mv.st.w < 0.95) wind.full = false;
  }
  wind.fx = damp(wind.fx, wind.holding ? 1 : 0, wind.holding ? 3 : 1.5, dt);
  wind.pulse = damp(wind.pulse ?? 0, 0, 14, dt);
  mv.materials.spring.emissive.setRGB(1.0, 0.5, 0.26).multiplyScalar(wind.fx * (0.9 + 1.1 * wind.pulse));
  mv.materials.roseSun.emissive.setRGB(1.0, 0.6, 0.35).multiplyScalar(wind.fx * 0.12 * wind.pulse);

  camera.position.copy(st.cam);
  camera.position.lerp(st.look, 0.12 * wind.fx);
  camera.lookAt(st.look);
  if (camera.fov !== st.fov) { camera.fov = st.fov; camera.updateProjectionMatrix(); }

  mv.setExplode(st.explode, GAP);
  for (const n of ['caseback', 'case', 'crystal']) mv.layers[n].g.visible = st.bare < 0.6;
  mv.update(dt, { timeScale: st.ts });
  if (dof) { dof.cocMaterial.focusDistance = camera.position.distanceTo(st.look); dof.cocMaterial.focusRange = st.fr; dof.bokehScale = st.bokeh; }

  // Iris between the Meshy watch and the procedural calibre.
  rig.updateMatrixWorld();
  irisCenter.set(0, 0, 0.15).applyMatrix4(rig.matrixWorld);
  irisA.uIris.value = st.iris; irisA.uIrisC.value.copy(irisCenter); irisA.uIrisR.value = 1.2;
  if (watch) watch.holder.visible = st.iris < 0.999;
  mv.root.visible = st.iris > 0.001;
  for (const c of clones) {
    const k = clamp(st.coll);
    c.u.uIris.value = 1 - k;
    c.u.uIrisInv.value = S > 10 ? 1 : 0;
    c.holder.visible = k > 0.001;
    c.holder.position.set(...(MOBILE() ? c.mpos : c.pos));
    c.holder.position.y += Math.sin(t * 0.7 + c.pos[0]) * 0.035;
    c.holder.quaternion.copy(rig.quaternion);
    c.holder.updateMatrixWorld();
    c.u.uIrisC.value.set(0, 0, 0.15).applyMatrix4(c.holder.matrixWorld);
  }

  // Environment turns with the pointer (glints travel across the gold) plus the intro/wind sweeps.
  // Finishing: the studio lights sweep across the stripes and perlage as you scroll.
  const finSweep = smooth(5.3, 6, S) * (1 - smooth(8.3, 9, S)) * (S - 7) * 0.9;
  scene.environmentRotation.y = pointer.sx * 0.45 * st.tilt + intro.sweep + wind.fx * 0.5 * Math.sin(t * 1.4) + finSweep;
  // Escapement at ⅒ speed: a soft tock on every beat, once sound has been unlocked by a gesture.
  if (ac && Math.abs(S - 5) < 0.45 && mv.st.beat !== lastBeat) { if (lastBeat !== null) tick('beat'); }
  lastBeat = mv.st.beat;

  // HTML: hero fade, steps, rail, labels, HUD.
  heroEl.style.opacity = 1 - smooth(0.7, 0.95, S);
  { // editorial dial scale framing the hero watch
    const ov = 1 - smooth(0.02, 0.3, S) + (1 - smooth(0.02, 0.3, Math.abs(S - 12)));
    orbitEl.style.opacity = clamp(ov) * (started ? 1 : 0);
    if (ov > 0.001) {
      tmpV.set(0, 0, 0.1).applyMatrix4(rig.matrixWorld).project(camera);
      tmpV2.set(1.25, 0, 0.1).applyMatrix4(rig.matrixWorld);
      const cx = (tmpV.x + 1) / 2 * innerWidth, cy = (1 - tmpV.y) / 2 * innerHeight;
      const d = camera.position.distanceTo(rig.position), px = 1.62 / (2 * d * Math.tan(camera.fov * D2R / 2)) * innerHeight;
      orbitEl.style.transform = `translate3d(${(cx - px).toFixed(1)}px, ${(cy - px).toFixed(1)}px, 0) scale(${(px / 200).toFixed(4)})`;
      orbitRot.style.transform = `rotate(${(-(mv.st.secs % 60) * 6).toFixed(2)}deg)`;
    }
  }
  heroEl.style.transform = `translate3d(0, ${-smooth(0, 0.6, S) * 40}px, 0)`;
  for (const el of steps) {
    const k = +el.dataset.k;
    // Crossfade only between steps of the same pinned stage; a stage's first/last step scrolls in/out with it, fully opaque.
    let vv = (el._first ? 1 : smooth(k - 0.55, k - 0.45, S)) * (el._last ? 1 : 1 - smooth(k + 0.45, k + 0.55, S));
    const y = scrollY, pinEnd = el._secTop + el._secH - innerHeight;
    const stageTop = !el._sticky ? el._secTop - y : y < el._secTop ? el._secTop - y : y > pinEnd ? pinEnd - y : 0;
    vv *= smooth(64, 150, stageTop + el._y);
    el.style.setProperty('--v', vv.toFixed(3));
    el.classList.toggle('is-v', vv > 0.002);
  }
  railEl.style.setProperty('--rail', smooth(0.6, 1, S) * (1 - smooth(5.4, 5.8, S)));
  railItems.forEach(li => li.classList.toggle('on', Math.round(S) === +li.dataset.k));

  drawLabels();
  const hud = S > 2.55 && S < 5.45;
  reserveEl.classList.toggle('on', hud);
  reserveEl.style.setProperty('--w', mv.st.w.toFixed(4));
  reserveEl.classList.toggle('full', mv.st.w > 0.995);
  rvVal.textContent = Math.round(mv.st.w * 72);
  const crownA = mv.anchors.crown;
  crownA.getWorldPosition(tmpV).project(camera);
  const showHint = (Math.abs(S - 3) < 0.35 && mv.st.w < 0.97) || wind.fx > 0.05;
  crownHintEl.classList.toggle('on', showHint);
  crownHintEl.classList.toggle('winding', wind.holding);
  if (wind.holding) crownTurnEl.textContent = `Turn ${Math.min(30, Math.round(mv.st.w * 30))} / 30`;
  else crownTurnEl.textContent = mv.st.w > 0.97 ? 'Fully wound' : 'Hold to wind';
  // Hover can change under a still pointer while the camera moves.
  if (pointer.active && Math.round(t * 60) % 6 === 0) { const o = crownUnder({ clientX: pointer.px, clientY: pointer.py }); if (o !== overCrown) { overCrown = o; cursorApi?.set(o ? 'drag' : '', o ? 'Hold' : ''); } }
  if (showHint) crownHintEl.style.transform = `translate3d(${((tmpV.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - tmpV.y) / 2 * innerHeight).toFixed(1)}px, 0)`;

  // Contact shadow follows the subject; skip rendering once the footer covers the canvas.
  shadow.setCenter(rig.position.x * 0.8, 0);
  if (!engine.paused && (Math.round(t * 60) % 2 === 0)) shadow.update();
  const footTop = footEl.getBoundingClientRect().top;
  engine.paused = footTop <= 0;
  ctaEl.style.opacity = clamp((footTop - innerHeight * 0.5) / (innerHeight * 0.3)).toFixed(3);
  navEl.classList.toggle('on-dark', footTop < 70);
});

const axA = new THREE.Vector3(), axB = new THREE.Vector3();
function drawLabels() {
  const vw = innerWidth, vh = innerHeight, mob = MOBILE();
  // Screen-space direction of the rig axis → callouts leave perpendicular to it.
  axA.set(0, 0, -1).applyMatrix4(rig.matrixWorld).project(camera);
  axB.set(0, 0, 1).applyMatrix4(rig.matrixWorld).project(camera);
  let ax = (axB.x - axA.x) * vw, ay = -(axB.y - axA.y) * vh;
  const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
  let nx = ay, ny = -ax; // perpendicular; make 'u' point upward
  if (ny > 0) { nx = -nx; ny = -ny; }
  if (al < 30) { nx = -0.5; ny = -0.86; } // axis toward the camera: fall back to up-left
  const scale = mob ? 0.5 : Math.min(1.2, vw / 1440);
  for (const L of LABELS) {
    let w = 0;
    for (const k of L.k) w = Math.max(w, 1 - smooth(0.34, 0.48, Math.abs(S - k)));
    if (mob && Math.abs(S - 2) < 0.5) w = 0; // the overview is too dense on a phone
    w = smooth(0.25, 1, w);
    const o = mv.anchors[L.a];
    if (w < 0.01 || !o) { if (L.w > 0) { L.el.style.opacity = 0; L.path.style.opacity = L.dot.style.opacity = L.ring.style.opacity = 0; } L.w = 0; continue; }
    L.w = w;
    o.getWorldPosition(tmpV).project(camera);
    if (tmpV.z > 1) { L.el.style.opacity = 0; continue; }
    const x = (tmpV.x + 1) / 2 * vw, y = (1 - tmpV.y) / 2 * vh;
    const sg = L.side === 'u' ? 1 : -1, len = (L.offk?.[Math.round(S)] ?? L.off) * scale * (0.55 + 0.45 * w);
    const ex = x + nx * sg * len, ey = y + ny * sg * len;
    const hx = Math.sign(nx * sg || -1), fx = ex + hx * 26 * scale, fy = ey;
    L.path.setAttribute('d', `M${x.toFixed(1)},${y.toFixed(1)}L${ex.toFixed(1)},${ey.toFixed(1)}L${fx.toFixed(1)},${fy.toFixed(1)}`);
    L.dot.setAttribute('cx', x); L.dot.setAttribute('cy', y); L.ring.setAttribute('cx', x); L.ring.setAttribute('cy', y);
    L.path.style.opacity = L.dot.style.opacity = L.ring.style.opacity = w;
    L.lw = L.el.offsetWidth || L.lw || 120;
    const lx = hx > 0 ? fx + 8 : fx - 8 - L.lw;
    L.el.classList.toggle('l', hx < 0); L.el.classList.toggle('r', hx > 0);
    L.el.style.opacity = w;
    L.el.style.transform = `translate3d(${clamp(lx, 8, vw - L.lw - 8).toFixed(1)}px, ${(fy - 11).toFixed(1)}px, 0)`;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
worldNav('horologie', { theme: 'dark', corner: 'bl' });
cursorApi = cursor({
  color: '#E8C6A7',
  blend: 'normal',
  size: 30
});
magnetic();
smoothScroll({ lerp: 0.08 });
measure();
addEventListener('resize', measure);
new ResizeObserver(measure).observe(document.body);

const [gltf, calibre] = await Promise.all([watchLoad, mvBuild]);
mv = calibre;
rig.add(mv.root);
watch = prepWatch(gltf.scene);
rig.add(watch.holder);
prepModel(watch.holder, renderer, { cast: false, receive: true, env: 1.25, onMat: m => patch(m, { iris: 2, u: irisA }) });
// Collection variants share the Meshy geometry with recoloured, independently dissolving materials.
for (const c of COLL) {
  const src = gltf.scene.clone(true);
  const u = irisUniforms();
  u.uIris.value = 1;
  src.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    patch(o.material, { iris: 2, u, recolor: true, params: { uCaseTint: { value: new THREE.Color(...c.tint) }, uStrapTint: { value: new THREE.Color(...c.strap) },
      uDialC: { value: watch.dialC.clone() }, uCaseR: { value: watch.caseR }, uDLC: { value: c.dlc } } });
    o.castShadow = false; o.receiveShadow = true;
  });
  const holder = new THREE.Group(); holder.add(src); scene.add(holder);
  clones.push({ ...c, holder, u });
}
mv.root.traverse(o => { if (o.isMesh && o.material?.isMeshPhysicalMaterial && o.material.transmission > 0) o.castShadow = false; });

// Compile every program in every state before the first frame.
evalState(S);
irisA.uIris.value = 0.5; for (const c of clones) { c.holder.visible = true; c.u.uIris.value = 0.5; }
mv.setExplode(1);
renderer.compile(scene, camera);
engine.render(0); shadow.update();
mv.setExplode(0);
engine.start();
await loader.finish();
started = true;
window.__dbg = () => { const r = {}; for (const k of ['train', 'barrel', 'tourbillon']) { const v = mv.anchors[k].getWorldPosition(new THREE.Vector3()); const p = v.clone().project(camera); r[k] = [v.x.toFixed(2), v.y.toFixed(2), v.z.toFixed(2), p.x.toFixed(2), p.y.toFixed(2)]; } r.look = ST.look.toArray().map(x => x.toFixed(2)); r.cam = camera.position.toArray().map(x => x.toFixed(2)); r.S = S; r.gap = { ...GAP }; r.trainZ = mv.layers.train.g.position.z; return JSON.stringify(r); };
window.__crownXY = () => { const v = mv.crownHit.getWorldPosition(new THREE.Vector3()).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
window.__ready = true;
if (!Q.has('kf') && scrollY < 10) {
  gsap.fromTo(intro, { spin: -1.1, sweep: -1.6 }, { spin: 0, sweep: 0, duration: 2.6, ease: 'expo.out' });
  gsap.from('.hero-title .ln', { yPercent: 60, opacity: 0, duration: 1.8, ease: 'expo.out', stagger: 0.1, delay: 0.1 });
  gsap.from('.eyebrow, .hero-lede, .hero-cta, .hero-spec, .hint, .nav', { opacity: 0, y: 16, duration: 1.4, ease: 'power3.out', stagger: 0.07, delay: 0.5 });
}
