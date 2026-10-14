// Calibre AH-01 — a fully procedural skeleton tourbillon, built at load time.
// Units: the mainplate has radius 1 (≈ 15 mm). Dial side faces +Z. 12 o'clock is +Y, 3 o'clock is +X.
// "Inverted" construction like the Meshy reference: bridges face the dial, the mainplate faces the caseback.
import * as THREE from 'three';
import {
  TAU, clamp, lerp, circle, ring, seg, arm, union, subtract, sdfShape, extrude, gearLoop, rootRadius, escapeLoop,
  ratchetLoop, circleLoop, spokeWindows, wheelGeometry, tentGeometry, latheZ, cylZ, Ribbon, reverseLoop,
} from './geo.js';
import { patch, FINISH } from './finish.js';

const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ─── Layout (pitch radii chosen so every pair meshes at its true centre distance) ──
const O = [0, 0];
const BARREL = { N: 96, rp: 0.39 };                      // m = 0.008125
const CPIN = { N: 12 };                                  // centre pinion meshes the barrel
const B = [0, BARREL.rp + BARREL.rp * CPIN.N / BARREL.N]; // (0, 0.43875)
const CENTER = { N: 80, rp: 0.30 };                      // m = 0.0075, 1 rev / hour
const TPIN = { N: 10, rp: 0.30 * 10 / 80 };              // third pinion
const TH = [Math.cos(225 * Math.PI / 180) * (CENTER.rp + TPIN.rp), Math.sin(225 * Math.PI / 180) * (CENTER.rp + TPIN.rp)];
const T = [0, -0.47];                                    // tourbillon axis
const dTT = Math.hypot(TH[0] - T[0], TH[1] - T[1]);
const THIRD = { N: 75, rp: dTT * 75 / 85 };              // third wheel
const CAGEPIN = { N: 10, rp: dTT * 10 / 85 };            // cage pinion (the 'fourth wheel')
const FIXED = { N: 96, rp: 0.2 * 96 / 104 };             // fixed wheel under the cage
const EPIN = { N: 8, rp: 0.2 * 8 / 104 };                // escape pinion rolls around it
const E_LOCAL = [0, -0.2];                               // escape arbor in the cage frame
const ESC = { N: 20, ra: 0.066 };
const RATCHET = { N: 72, rp: 0.30 };
const CROWNW = { N: 36, rp: 0.15 };
const CW = [B[0] + Math.cos(-35 * Math.PI / 180) * 0.45, B[1] + Math.sin(-35 * Math.PI / 180) * 0.45];
const angleOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
/** Angle of gear B driven by gear A (tooth of A at the contact line sits in a gap of B). */
const mesh = (a, NA, NB, delta) => -(NA / NB) * (a - delta) + delta + Math.PI + Math.PI / NB;

export const SPEC = { B, O, TH, T, CW };

// ─── Materials ────────────────────────────────────────────────────────────────
function materials(u) {
  const S = (o, f = {}) => patch(new THREE.MeshStandardMaterial({ metalness: 1, envMapIntensity: 1, ...o }), { iris: 1, u, ...f });
  const Ph = (o, f = {}) => patch(new THREE.MeshPhysicalMaterial({ metalness: 1, envMapIntensity: 1, ...o }), { iris: 1, u, ...f });
  const rg = new THREE.Color('#f0bb93');
  return {
    roseWheel: S({ color: rg, roughness: 0.24 }, { finish: FINISH.circular, anglage: true, params: { uBevelRough: { value: 0.06 }, uSideRough: { value: 0.3 } } }),
    roseSun: S({ color: rg, roughness: 0.26 }, { finish: FINISH.sunray, anglage: true }),
    rosePolish: Ph({ color: rg, roughness: 0.1, clearcoat: 0.3, clearcoatRoughness: 0.08 }),
    roseSatin: S({ color: rg, roughness: 0.3 }),
    bridge: S({ color: '#98a0ad', roughness: 0.2 }, { finish: FINISH.cotes, anglage: true, params: { uBevelRough: { value: 0.04 } } }),
    plate: S({ color: '#8d929c', roughness: 0.34 }, { finish: FINISH.perlage, anglage: true }),
    mirror: S({ color: '#6a6f79', roughness: 0.03 }, { finish: FINISH.mirror, anglage: true, params: { uBevelRough: { value: 0.03 }, uSideRough: { value: 0.18 } } }),
    cage: S({ color: '#d7dbe1', roughness: 0.12 }, { finish: FINISH.mirror, anglage: true, params: { uSideRough: { value: 0.22 } } }),
    steel: S({ color: '#d9dce1', roughness: 0.16 }, { finish: FINISH.circular, anglage: true, params: { uGrain: { value: 5200 } } }),
    steelPlain: S({ color: '#cfd3d9', roughness: 0.14 }),
    blue: S({ color: '#2a4fd0', roughness: 0.16 }, { finish: FINISH.mirror, anglage: true, params: { uSideRough: { value: 0.2 } } }),
    blueLathe: S({ color: '#2a4fd0', roughness: 0.14 }),
    slot: S({ color: '#0a0c12', roughness: 0.5, metalness: 0.4 }),
    gold: S({ color: '#f0cf95', roughness: 0.18 }, { finish: FINISH.mirror, anglage: true }),
    dial: S({ color: '#39404d', roughness: 0.36, metalness: 0.85 }, { finish: FINISH.snail, anglage: true }),
    print: S({ color: rg, roughness: 0.3 }),
    spring: S({ color: '#c9d2e0', roughness: 0.2, side: THREE.DoubleSide }),
    hair: S({ color: '#8fa6d8', roughness: 0.18, side: THREE.DoubleSide }, { spring: true }),
    ruby: patch(new THREE.MeshPhysicalMaterial({
      color: '#ff3d6a', metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.03, ior: 1.76,
      attenuationColor: new THREE.Color('#a8001f'), attenuationDistance: 0.02, specularIntensity: 1, envMapIntensity: 1.6,
    }), { iris: 1, u }),
    sapphire: patch(new THREE.MeshPhysicalMaterial({
      color: '#ffffff', metalness: 0, roughness: 0.0, transmission: 1, thickness: 0.05, ior: 1.77, envMapIntensity: 1.3,
      specularIntensity: 1, transparent: false,
    }), { iris: 1, u }),
  };
}

// ─── Build ───────────────────────────────────────────────────────────────────
export async function buildMovement({ u, yieldFn = () => new Promise(r => setTimeout(r, 0)) }) {
  const M = materials(u);
  const root = new THREE.Group();
  root.name = 'calibre';
  const layers = {};
  const layer = (name, dz, delay = 0) => { const g = new THREE.Group(); g.name = name; root.add(g); layers[name] = { g, dz, delay, sub: [] }; return g; };
  const put = (parent, geo, mat, x = 0, y = 0, z = 0, name = '') => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; m.name = name; parent.add(m); return m;
  };
  const anchors = {};
  const anchor = (name, parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); anchors[name] = o; return o; };

  // Shared small parts.
  const jewelGeo = latheZ([[0, 0.0075], [0.006, 0.0078], [0.012, 0.0074], [0.019, 0.006], [0.02, 0.0], [0.0001, 0.0]], 40);
  const chatonGeo = latheZ([[0.019, 0.0072], [0.03, 0.0068], [0.034, 0.004], [0.034, 0.0], [0.019, 0.0]], 48);
  const screwGeo = latheZ([[0, 0.013], [0.012, 0.0122], [0.02, 0.009], [0.024, 0.004], [0.024, 0.0], [0.0001, 0]], 40);
  const slotGeo = new THREE.BoxGeometry(0.05, 0.0055, 0.006); slotGeo.translate(0, 0, 0.0112);
  const jewel = (parent, x, y, z, big = 1) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(big); parent.add(g);
    const c = put(g, chatonGeo, M.rosePolish); c.castShadow = false;
    const j = put(g, jewelGeo, M.ruby, 0, 0, 0.0005); j.castShadow = false;
    return g;
  };
  const screw = (parent, x, y, z, rot = Math.random() * Math.PI, mat = M.blueLathe) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = rot; parent.add(g);
    put(g, screwGeo, mat); const s = put(g, slotGeo, M.slot); s.castShadow = false;
    return g;
  };
  const arbor = (parent, x, y, z0, z1, r = 0.011) => put(parent, cylZ(r, z0, z1, 20), M.steelPlain, x, y, 0);

  // ── Layers (dz = offset when fully exploded) ──
  const Lback = layer('caseback', -2.3, 0.0);
  const Lcase = layer('case', -1.8, 0.05);
  const Lplate = layer('plate', -1.15, 0.12);
  const Lfixed = layer('fixed', -0.72, 0.18);
  const Lbarrel = layer('barrel', -0.3, 0.2);
  const Ltrain = layer('train', 0.14, 0.2);
  const Lcage = layer('cage', 0.55, 0.18);
  const Lbridges = layer('bridges', 1.02, 0.12);
  const Lwind = layer('winding', 1.4, 0.1);
  const Ldial = layer('dial', 1.8, 0.06);
  const Lhands = layer('hands', 2.15, 0.03);
  const Ltop = layer('crystal', 2.6, 0.0);

  // ── Mainplate (perlage, skeletonised) ──
  const plateSdf = union([
    ring(0, 0, 0.86, 1.0),
    circle(...O, 0.095), circle(...B, 0.1), circle(...TH, 0.075), ring(...T, 0.325, 0.385),
    seg(...O, ...B, 0.042), seg(...O, ...TH, 0.036), seg(...O, 0.93, -0.06, 0.04, 0.05), seg(...O, 0, -0.1, 0.05),
    arm(...B, -0.45, 0.72, -0.72, 0.6, 0.038, 0.05), arm(...B, 0.45, 0.72, 0.72, 0.6, 0.038, 0.05),
    arm(...TH, -0.6, -0.2, -0.9, -0.2, 0.034, 0.05), seg(...O, -0.92, 0.1, 0.03, 0.045),
    seg(...T, T[0], T[1] + 0.34, 0.018), seg(...T, T[0] + 0.3, T[1] - 0.17, 0.018), seg(...T, T[0] - 0.3, T[1] - 0.17, 0.018), circle(...T, 0.05),
  ], 0.05);
  const plateGeo = extrude(sdfShape(plateSdf, [-1, -1, 1, 1], 0.0032), { depth: 0.06, chamfer: 0.009 });
  put(Lplate, plateGeo, M.plate, 0, 0, -0.2, 'mainplate');
  anchor('plate', Lplate, -0.83, 0.48, -0.14);
  for (const [x, y] of [O, B, TH, T]) jewel(Lplate, x, y, -0.198, 1.0).rotation.x = Math.PI;
  await yieldFn();

  // ── Fixed wheel (stationary; the escape pinion rolls around it) ──
  const fixedGeo = wheelGeometry({ outline: gearLoop(FIXED.N, FIXED.rp, { tip: 3, root: 2 }), rOut: FIXED.rp,
    windows: spokeWindows({ n: 3, rIn: 0.055, rOut: rootRadius(FIXED.N, FIXED.rp) - 0.018, w: 0.022, curve: 0.5 }), depth: 0.014, chamfer: 0.0016 });
  const fixedWheel = put(Lfixed, fixedGeo, M.steel, T[0], T[1], -0.14, 'fixed');
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.3; screw(Lfixed, T[0] + Math.cos(a) * 0.036, T[1] + Math.sin(a) * 0.036, -0.126, a, M.steelPlain).scale.setScalar(0.55); }
  await yieldFn();

  // ── Barrel: drum teeth, wall, spoked floor & cover, mainspring, arbor ──
  const barrel = new THREE.Group(); barrel.position.set(B[0], B[1], 0); Lbarrel.add(barrel);
  const drumTeeth = wheelGeometry({ outline: gearLoop(BARREL.N, BARREL.rp, { tip: 3, root: 2 }), rOut: BARREL.rp,
    windows: spokeWindows({ n: 5, rIn: 0.075, rOut: 0.33, w: 0.03, curve: 0.9, round: 0.012 }), depth: 0.022, chamfer: 0.0022 });
  const drum = new THREE.Group(); barrel.add(drum);
  put(drum, drumTeeth, M.roseWheel, 0, 0, -0.135);
  put(drum, extrude([{ outer: circleLoop(0.37, 220), holes: [circleLoop(0.345, 220, true)] }], { depth: 0.085, chamfer: 0.003 }), M.roseWheel, 0, 0, -0.113);
  const coverGeo = wheelGeometry({ outline: circleLoop(0.372, 240), rOut: 0.372,
    windows: spokeWindows({ n: 5, rIn: 0.075, rOut: 0.325, w: 0.03, curve: -0.9, round: 0.012 }), depth: 0.012, chamfer: 0.0025 });
  const cover = new THREE.Group(); barrel.add(cover);
  put(cover, coverGeo, M.roseSun, 0, 0, -0.026);
  layers.barrel.sub.push({ g: cover, dz: 0.3 });
  const springRib = new Ribbon(900, { width: 0.0062, z0: -0.106, z1: -0.04 });
  const springMesh = put(barrel, springRib.geo, M.spring); springMesh.frustumCulled = false;
  const springG = new THREE.Group(); barrel.add(springG); springG.add(springMesh);
  layers.barrel.sub.push({ g: springG, dz: 0.15 });
  const barrelArbor = new THREE.Group(); barrel.add(barrelArbor);
  put(barrelArbor, cylZ(0.05, -0.12, -0.02, 36), M.steel);
  put(barrelArbor, cylZ(0.022, -0.2, 0.1, 24), M.steelPlain);
  put(barrelArbor, new THREE.BoxGeometry(0.02, 0.012, 0.06), M.steelPlain, 0.052, 0, -0.07);
  anchor('barrel', barrel, -0.26, 0.26, -0.03);
  await yieldFn();

  // ── Going train: centre wheel + pinion, third wheel + pinion ──
  const center = new THREE.Group(); Ltrain.add(center);
  put(center, wheelGeometry({ outline: gearLoop(CENTER.N, CENTER.rp, { tip: 3, root: 2 }), rOut: CENTER.rp,
    windows: spokeWindows({ n: 5, rIn: 0.05, rOut: rootRadius(CENTER.N, CENTER.rp) - 0.02, w: 0.024, curve: 1.1, round: 0.01 }), depth: 0.016, chamfer: 0.002 }), M.roseWheel, 0, 0, -0.052);
  put(center, extrude([{ outer: gearLoop(CPIN.N, BARREL.rp * CPIN.N / BARREL.N, { add: 0.95, ded: 1.3, thick: 0.44, tip: 4 }), holes: [] }], { depth: 0.036, chamfer: 0.0012 }), M.steel, 0, 0, -0.14);
  arbor(center, 0, 0, -0.205, 0.215, 0.012);
  put(center, cylZ(0.03, -0.058, -0.03, 32), M.steel);
  const third = new THREE.Group(); third.position.set(TH[0], TH[1], 0); Ltrain.add(third);
  put(third, wheelGeometry({ outline: gearLoop(THIRD.N, THIRD.rp, { tip: 3, root: 2 }), rOut: THIRD.rp,
    windows: spokeWindows({ n: 4, rIn: 0.045, rOut: rootRadius(THIRD.N, THIRD.rp) - 0.018, w: 0.022, curve: 0.9, round: 0.01 }), depth: 0.014, chamfer: 0.0018 }), M.roseWheel, 0, 0, -0.032);
  put(third, extrude([{ outer: gearLoop(TPIN.N, TPIN.rp, { add: 0.95, ded: 1.3, thick: 0.44, tip: 4 }), holes: [] }], { depth: 0.03, chamfer: 0.001 }), M.steel, 0, 0, -0.06);
  arbor(third, 0, 0, -0.2, 0.09, 0.009);
  put(third, cylZ(0.024, -0.036, -0.016, 28), M.steel);
  anchor('train', third, -0.2, -0.05, -0.016);
  await yieldFn();

  // ── Tourbillon cage: pinion, frames, pillars, escape wheel, pallet fork, balance, hairspring ──
  const cageRoot = new THREE.Group(); cageRoot.position.set(T[0], T[1], -0.02); Lcage.add(cageRoot);
  const cage = new THREE.Group(); cageRoot.add(cage);
  put(cage, extrude([{ outer: gearLoop(CAGEPIN.N, CAGEPIN.rp, { add: 0.95, ded: 1.3, thick: 0.44, tip: 4 }), holes: [] }], { depth: 0.028, chamfer: 0.001 }), M.steel, 0, 0, -0.022);
  const frameSdf = top => subtract(union([
    ring(0, 0, 0.268, 0.3),
    ...[90, 210, 330].map(d => { const a = d * Math.PI / 180; const c = Math.cos(a), s = Math.sin(a);
      return top ? arm(0, 0, 0.12 * Math.cos(a + 0.6), 0.12 * Math.sin(a + 0.6), 0.284 * c, 0.284 * s, 0.03, 0.016) : seg(0, 0, 0.284 * c, 0.284 * s, 0.016, 0.022); }),
    circle(0, 0, 0.045),
    ...(top ? [] : [circle(...E_LOCAL, 0.03), seg(0, 0, ...E_LOCAL, 0.013), circle(0, -0.115, 0.022)]),
    ...[30, 150, 270].map(d => circle(0.284 * Math.cos(d * Math.PI / 180), 0.284 * Math.sin(d * Math.PI / 180), 0.026)),
  ], 0.028), circle(0, 0, 0.012));
  const lowerFrame = put(cage, extrude(sdfShape(frameSdf(false), [-0.31, -0.31, 0.31, 0.31], 0.0012), { depth: 0.018, chamfer: 0.0035 }), M.cage, 0, 0, 0.012);
  const upper = new THREE.Group(); cage.add(upper);
  put(upper, extrude(sdfShape(frameSdf(true), [-0.31, -0.31, 0.31, 0.31], 0.0012), { depth: 0.018, chamfer: 0.0035 }), M.cage, 0, 0, 0.13);
  for (const d of [30, 150, 270]) { const a = d * Math.PI / 180; put(upper, cylZ(0.011, 0.03, 0.13, 18), M.cage, 0.284 * Math.cos(a), 0.284 * Math.sin(a), 0); }
  jewel(upper, 0, 0, 0.148, 0.8);
  // Seconds pointer riding on the cage.
  const pointer = put(upper, tentGeometry([[0.03, 0], [0.05, 0.009], [0.2, 0.006], [0.262, 0]], { base: 0.003, ridge: 0.003 }), M.blue, 0, 0, 0.149);
  pointer.rotation.z = Math.PI / 2;
  layers.cage.sub.push({ g: upper, dz: 0.34 });
  // Escape wheel + pinion.
  const esc = new THREE.Group(); esc.position.set(...E_LOCAL, 0); cage.add(esc);
  put(esc, wheelGeometry({ outline: escapeLoop(ESC.N, ESC.ra), rOut: ESC.ra,
    windows: spokeWindows({ n: 4, rIn: 0.014, rOut: ESC.ra * 0.62, w: 0.008, curve: 0.8, round: 0.003 }), depth: 0.01, chamfer: 0.0009 }), M.steel, 0, 0, 0.042);
  put(esc, extrude([{ outer: gearLoop(EPIN.N, EPIN.rp, { add: 0.95, ded: 1.3, thick: 0.44, tip: 4 }), holes: [] }], { depth: 0.03, chamfer: 0.0007 }), M.steel, 0, 0, -0.123);
  arbor(esc, 0, 0, -0.125, 0.07, 0.005);
  jewel(cage, ...E_LOCAL, 0.03, 0.5);
  // Pallet fork: pivot between escape wheel and balance, lever toward the roller.
  const fork = new THREE.Group(); fork.position.set(0, -0.115, 0); cage.add(fork);
  const fk = (x, y) => [y, -x]; // design along +x (toward the escape wheel) → world −Y
  const forkLocal = union([
    circle(0, 0, 0.011), seg(0, 0, 0.034, 0.044, 0.0062, 0.0045), seg(0, 0, 0.034, -0.044, 0.0062, 0.0045),
    seg(0, 0, -0.07, 0, 0.0055, 0.0035), seg(-0.066, 0.004, -0.081, 0.009, 0.0026), seg(-0.066, -0.004, -0.081, -0.009, 0.0026),
  ], 0.006);
  const forkSdf = (x, y) => forkLocal(-y, x); // rotate design −90°
  put(fork, extrude(sdfShape((x, y) => forkSdf(x, y), [-0.06, -0.06, 0.06, 0.1], 0.0005), { depth: 0.008, chamfer: 0.0012 }), M.steel, 0, 0, 0.045);
  for (const s of [1, -1]) {
    const st = put(fork, new THREE.BoxGeometry(0.012, 0.007, 0.008), M.ruby, ...fk(0.037, s * 0.046), 0.049); st.rotation.z = s * 0.5; st.castShadow = false;
  }
  jewel(cage, 0, -0.115, 0.03, 0.4);
  // Balance: glucydur rim, three spokes, timing screws; hairspring breathing above it.
  const bal = new THREE.Group(); bal.position.z = 0.07; cage.add(bal);
  const balSdf = union([ring(0, 0, 0.165, 0.186), ...[0, 120, 240].map(d => { const a = (d + 90) * Math.PI / 180; return seg(0, 0, 0.175 * Math.cos(a), 0.175 * Math.sin(a), 0.009, 0.007); }), circle(0, 0, 0.026)], 0.012);
  put(bal, extrude(sdfShape(balSdf, [-0.19, -0.19, 0.19, 0.19], 0.0009), { depth: 0.014, chamfer: 0.0022 }), M.gold, 0, 0, 0);
  const balScrewGeo = latheZ([[0, 0.009], [0.006, 0.0085], [0.0085, 0.005], [0.0085, 0], [0.0001, 0]], 20);
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + 0.3; put(bal, balScrewGeo, M.gold, Math.cos(a) * 0.1755, Math.sin(a) * 0.1755, 0.014); }
  put(bal, cylZ(0.006, -0.05, 0.075, 16), M.steelPlain);
  put(bal, cylZ(0.022, -0.012, 0.0, 28), M.steelPlain); // roller
  const hairRib = new Ribbon(760, { width: 0.0036, z0: 0.022, z1: 0.034, attr: true });
  { const rs = new Float32Array(760), ths = new Float32Array(760);
    for (let i = 0; i < 760; i++) { const s = i / 759; rs[i] = lerp(0.032, 0.13, s) + (s > 0.93 ? (s - 0.93) * 0.3 : 0); ths[i] = s * 7.5 * TAU; }
    hairRib.pose(rs, ths); }
  const hair = new THREE.Mesh(hairRib.geo, M.hair); hair.frustumCulled = false; hair.castShadow = true;
  const hairG = new THREE.Group(); hairG.position.z = 0.07; cage.add(hairG); hairG.add(hair);
  put(hairG, new THREE.BoxGeometry(0.018, 0.012, 0.02), M.steelPlain, 0.14, 0.025, 0.028); // stud
  layers.cage.sub.push({ g: bal, dz: 0.2 }, { g: hairG, dz: 0.24 });
  anchor('escapement', cage, 0, -0.2, 0.05);
  anchor('balance', bal, -0.16, 0.08, 0.014);
  anchor('tourbillon', cageRoot, 0.26, -0.15, 0.08);
  await yieldFn();

  // ── Bridges (Côtes de Genève, anglage, blued screws, jewels in gold chatons) ──
  const F1 = [-0.74, 0.54], F2 = [0.88, 0.2], F3 = [-0.88, -0.22], F4 = [0.87, -0.2], F5 = [-0.9, 0.14], F6 = [-0.63, -0.64], F7 = [0.63, -0.64];
  const barrelBridge = union([
    ring(...B, 0.335, 0.405), circle(...B, 0.1),
    ...[100, 220, 340].map(d => { const r = d * Math.PI / 180; return seg(...B, B[0] + Math.cos(r) * 0.37, B[1] + Math.sin(r) * 0.37, 0.05, 0.034); }),
    arm(-0.33, 0.62, -0.62, 0.66, ...F1, 0.06, 0.07), circle(...F1, 0.075),
    seg(...B, ...CW, 0.05), circle(...CW, 0.075), arm(...CW, 0.66, 0.2, ...F2, 0.058, 0.07), circle(...F2, 0.075),
  ], 0.07);
  const trainBridge = union([
    circle(...O, 0.085), circle(...TH, 0.072), seg(...O, ...TH, 0.058, 0.052), arm(...TH, -0.62, -0.13, ...F3, 0.052, 0.068),
    arm(...O, 0.42, 0.04, ...F4, 0.058, 0.066), arm(...O, -0.4, 0.12, ...F5, 0.044, 0.062), circle(...F3, 0.075), circle(...F4, 0.075), circle(...F5, 0.07),
  ], 0.07);
  const tBridge = union([
    circle(...T, 0.078), arm(...F6, -0.42, -0.14, ...T, 0.074, 0.05), arm(...T, 0.42, -0.14, ...F7, 0.05, 0.074), circle(...F6, 0.08), circle(...F7, 0.08),
  ], 0.06);
  const bb = put(Lbridges, extrude(sdfShape(subtract(barrelBridge, circle(...B, 0.024)), [-0.9, -0.05, 1.0, 0.95], 0.0026), { depth: 0.06, chamfer: 0.008 }), M.bridge, 0, 0, 0.03, 'barrel bridge');
  await yieldFn();
  put(Lbridges, extrude(sdfShape(trainBridge, [-1, -0.4, 1, 0.3], 0.0026), { depth: 0.06, chamfer: 0.008 }), M.bridge, 0, 0, 0.03, 'train bridge');
  await yieldFn();
  put(Lbridges, extrude(sdfShape(tBridge, [-0.78, -0.78, 0.78, -0.3], 0.0022), { depth: 0.055, chamfer: 0.016 }), M.mirror, 0, 0, 0.14, 'tourbillon bridge');
  for (const p of [F1, F2, F3, F4, F5]) screw(Lbridges, ...p, 0.09);
  for (const p of [F6, F7]) screw(Lbridges, ...p, 0.19);
  for (const p of [O, TH, CW]) jewel(Lbridges, ...p, 0.09, p === O ? 1.15 : 1);
  jewel(Lbridges, ...T, 0.19, 1.1);
  anchor('bridges', Lbridges, 0.8, -0.22, 0.09);
  anchor('tbridge', Lbridges, 0.42, -0.42, 0.19);
  await yieldFn();

  // ── Winding works on top of the barrel bridge: ratchet (sunray), crown wheel, click ──
  const ratchet = new THREE.Group(); ratchet.position.set(B[0], B[1], 0.092); Lwind.add(ratchet);
  put(ratchet, wheelGeometry({ outline: ratchetLoop(RATCHET.N, RATCHET.rp), rOut: RATCHET.rp,
    windows: spokeWindows({ n: 6, rIn: 0.07, rOut: 0.255, w: 0.028, curve: 0.7, round: 0.012 }), depth: 0.018, chamfer: 0.0028 }), M.roseSun, 0, 0, 0);
  screw(ratchet, 0, 0, 0.018, 0.3, M.blueLathe).scale.setScalar(1.6);
  const crownWheel = new THREE.Group(); crownWheel.position.set(CW[0], CW[1], 0.092); Lwind.add(crownWheel);
  put(crownWheel, wheelGeometry({ outline: gearLoop(CROWNW.N, CROWNW.rp, { tip: 3, root: 2 }), rOut: CROWNW.rp,
    windows: spokeWindows({ n: 4, rIn: 0.04, rOut: 0.118, w: 0.022, curve: 0.6, round: 0.01 }), depth: 0.016, chamfer: 0.0024 }), M.roseSun, 0, 0, 0);
  screw(crownWheel, 0, 0, 0.016, 0.9, M.blueLathe).scale.setScalar(1.2);
  // Click: pivoted pawl that drops into each ratchet tooth.
  const clickPivot = [B[0] - 0.36, B[1] + 0.06];
  const click = new THREE.Group(); click.position.set(...clickPivot, 0.092); Lwind.add(click);
  const clickSdf = union([circle(0, 0, 0.026), arm(0, 0, 0.03, 0.06, 0.07, 0.07, 0.016, 0.008)], 0.012);
  put(click, extrude(sdfShape(clickSdf, [-0.04, -0.04, 0.09, 0.1], 0.0008), { depth: 0.014, chamfer: 0.0022 }), M.steel, 0, 0, 0);
  screw(click, 0, 0, 0.014, 0.2).scale.setScalar(0.75);
  anchor('winding', Lwind, CW[0] + 0.1, CW[1] - 0.08, 0.11);
  await yieldFn();

  // ── Chapter ring with applied rose-gold batons and a printed minute track ──
  put(Ldial, extrude([{ outer: circleLoop(1.0, 360), holes: [circleLoop(0.86, 320, true)] }], { depth: 0.018, chamfer: 0.004 }), M.dial, 0, 0, 0.19);
  const baton = tentGeometry([[0, 0], [0.004, 0.009], [0.07, 0.009], [0.078, 0]], { base: 0.006, ridge: 0.006 });
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 - i * TAU / 12;
    for (const off of i === 0 ? [-0.022, 0.022] : [0]) {
      const m = put(Ldial, baton, M.rosePolish, 0, 0, 0.208);
      const r = 0.885, ox = Math.cos(a - Math.PI / 2) * off, oy = Math.sin(a - Math.PI / 2) * off;
      m.position.set(Math.cos(a) * r + ox, Math.sin(a) * r + oy, 0.208); m.rotation.z = a - Math.PI / 2;
    }
  }
  { const g = []; for (let i = 0; i < 60; i++) { if (i % 5 === 0) continue; const a = i * TAU / 60; const b = new THREE.BoxGeometry(0.0035, 0.022, 0.0016); b.translate(0, 0.978, 0.0008); b.rotateZ(-a); g.push(b); }
    const merged = mergeGeos(g); put(Ldial, merged, M.print, 0, 0, 0.208); }
  anchor('dial', Ldial, -0.7, -0.7, 0.21);

  // ── Hands: flame-blued, faceted ──
  const minute = new THREE.Group(); minute.position.z = 0.236; Lhands.add(minute);
  const hour = new THREE.Group(); hour.position.z = 0.222; Lhands.add(hour);
  const handProfile = (L, W, tail) => { const p = [[-tail, 0], [-tail + 0.012, W * 0.55], [-0.04, W * 0.5], [0, W * 1.25], [0.05, W * 0.8]];
    for (let i = 1; i <= 10; i++) { const t = i / 10; p.push([lerp(0.05, L, t), W * Math.pow(Math.sin(Math.PI * (0.14 + t * 0.86)), 0.7) * (1 - t * 0.2)]); }
    p[p.length - 1][1] = 0; return p; };
  put(minute, tentGeometry(handProfile(0.8, 0.026, 0.15), { base: 0.003, ridge: 0.006 }), M.blue);
  put(hour, tentGeometry(handProfile(0.56, 0.034, 0.12), { base: 0.003, ridge: 0.007 }), M.blue);
  put(minute, cylZ(0.024, 0, 0.007, 36), M.blue);
  put(hour, cylZ(0.034, 0, 0.006, 36), M.blue);
  put(Lhands, cylZ(0.012, 0.215, 0.248, 20), M.steelPlain);
  anchor('hands', minute, 0, 0.5, 0.01);

  // ── Case: bezel + sapphire (top), case middle + lugs + crown (middle), caseback (bottom) ──
  const bezel = latheZ([[1.005, 0.275], [1.015, 0.318], [1.05, 0.33], [1.12, 0.326], [1.175, 0.31], [1.205, 0.28], [1.212, 0.24], [1.206, 0.2], [1.19, 0.2], [1.01, 0.2], [1.005, 0.275]], 220);
  put(Ltop, bezel, M.rosePolish);
  put(Ltop, latheZ([[0, 0.318], [0.6, 0.314], [0.9, 0.305], [1.012, 0.296], [1.012, 0.27], [0, 0.272]], 160), M.sapphire).castShadow = false;
  anchor('crystal', Ltop, -0.9, 0.52, 0.33);
  put(Lcase, latheZ([[1.03, 0.19], [1.19, 0.19], [1.215, 0.13], [1.222, 0.0], [1.21, -0.14], [1.18, -0.24], [1.14, -0.27], [1.03, -0.27], [1.03, 0.19]], 220), M.rosePolish);
  const crown = new THREE.Group(); crown.position.set(1.222, 0, -0.04); Lbarrel.add(crown); // keyless works explode with the movement
  { const neck = cylZ(0.055, 0, 0.06, 32); neck.rotateY(Math.PI / 2); put(crown, neck, M.rosePolish);
    const fl = extrude([{ outer: gearLoop(26, 0.125, { add: 0.5, ded: 0.55, thick: 0.62, tip: 3, root: 3 }), holes: [] }], { depth: 0.1, chamfer: 0.012 });
    fl.rotateY(Math.PI / 2); fl.translate(0.055, 0, 0);
    const flutes = put(crown, fl, M.rosePolish);
    const cap = latheZ([[0, 0.03], [0.07, 0.026], [0.105, 0.012], [0.112, 0], [0.0001, 0]], 48); cap.rotateY(Math.PI / 2); cap.translate(0.155, 0, 0);
    put(crown, cap, M.rosePolish);
    const stem = cylZ(0.012, 0, 0.72, 16); stem.rotateY(-Math.PI / 2); stem.translate(0.02, 0, 0); put(crown, stem, M.steelPlain);
    crown.userData.flutes = flutes; }
  const crownHit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
  crownHit.position.set(0.12, 0, 0); crown.add(crownHit);
  anchor('crown', crown, 0.2, 0.0, 0.08);
  put(Lback, latheZ([[0.84, -0.27], [1.16, -0.27], [1.19, -0.29], [1.17, -0.33], [1.1, -0.345], [0.86, -0.34], [0.84, -0.3], [0.84, -0.27]], 220), M.rosePolish);
  put(Lback, latheZ([[0, -0.29], [0.86, -0.29], [0.86, -0.325], [0, -0.33]], 120), M.sapphire).castShadow = false;
  anchor('caseback', Lback, 1.0, -0.58, -0.3);

  // ─── Animation state ──
  const st = {
    psi: 0, boost: 0, w: 0.34, t0: 0, explode: 0, windRate: 0,
    arbor: 0, ratchetPhase: 0, clicks: 0, amp: 0,
  };
  const now = new Date();
  st.t0 = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
  const dOT = angleOf(O, TH), dThT = angleOf(TH, T), dOB = angleOf(O, B), dBC = angleOf(B, CW), dE = Math.atan2(E_LOCAL[1], E_LOCAL[0]);

  // Mainspring posing: area-conserving packs on the arbor (wound) and on the drum wall (let down).
  const ra = 0.05, rw = 0.338, pitch = 0.0112, rb = ra + 12 * pitch, A = rb * rb - ra * ra;
  const NS = springRib.n, rs = new Float32Array(NS), ths = new Float32Array(NS);
  let posedW = -1;
  function poseSpring(w, arborAngle) {
    const ww = clamp(w, 0.02, 0.98);
    let th = 0;
    for (let i = 0; i < NS; i++) {
      const s = i / (NS - 1);
      const rA = Math.sqrt(ra * ra + Math.min(s, ww) * A + Math.max(0, s - ww) * A * 0.02);
      const rW = Math.sqrt(Math.max(ra * ra, rw * rw - (1 - s) * A));
      const k = smooth(ww - 0.035, ww + 0.035, s);
      const r = lerp(rA, rW, k);
      rs[i] = r;
      if (i > 0) th += (A / pitch) / (NS - 1) / ((r + rs[i - 1]) / 2);
      ths[i] = th;
    }
    // inner end rides on the arbor
    for (let i = 0; i < NS; i++) ths[i] += arborAngle;
    springRib.pose(rs, ths);
  }

  // extra: { layerName: additional z } — used to open the stack around the part in focus.
  function setExplode(e, extra = null) {
    st.explode = e;
    for (const k in layers) {
      const L = layers[k];
      const p = smooth(L.delay, L.delay + 0.72, e);
      L.g.position.z = L.dz * p + (extra?.[k] ?? 0);
      for (const s of L.sub) s.g.position.z = s.dz * p;
    }
    crown.position.x = 1.222 + 0.62 * smooth(0.1, 0.8, e);
  }

  function update(dt, { timeScale = 1 } = {}) {
    st.boost *= Math.exp(-dt * 1.6);
    const rate = timeScale * (1 + st.boost * 1.6);
    const amp = (205 + 105 * st.w + 25 * st.boost) * Math.PI / 180;
    st.amp = amp;
    st.psi += TAU * 4 * rate * dt;
    const uu = st.psi / Math.PI, n = Math.floor(uu + 0.5), s = uu - n;
    const k = smooth(-0.075, 0.075, s);
    const half = n - 1 + k;
    const secs = st.t0 + half / 8;
    st.secs = secs;
    const side = (n % 2 === 0) ? 1 : -1;
    st.beat = n;
    // Balance & hairspring
    const balA = amp * Math.sin(st.psi);
    bal.rotation.z = balA;
    M.hair.userData.u.uBal.value = balA;
    fork.rotation.z = 0.16 * side * (2 * k - 1);
    // Train (centre wheel is the master: it carries the minutes)
    const cA = -TAU * secs / 3600;
    center.rotation.z = cA;
    const thA = mesh(cA, CENTER.N, TPIN.N, dOT);
    third.rotation.z = thA;
    const cageA = mesh(thA, THIRD.N, CAGEPIN.N, dThT);
    cage.rotation.z = cageA;
    esc.rotation.z = mesh(-cageA, FIXED.N, EPIN.N, dE);
    drum.rotation.z = mesh(cA, CPIN.N, BARREL.N, dOB);
    cover.rotation.z = drum.rotation.z;
    minute.rotation.z = cA;
    hour.rotation.z = -TAU * secs / 43200;
    // Winding: 8 arbor turns from let-down to fully wound.
    const arborA = -TAU * 8 * st.w;
    barrelArbor.rotation.z = arborA;
    ratchet.rotation.z = arborA;
    crownWheel.rotation.z = mesh(arborA, RATCHET.N, CROWNW.N, dBC);
    crown.rotation.x = -crownWheel.rotation.z * 2;
    const tooth = (-arborA / (TAU / RATCHET.N));
    const ph = tooth - Math.floor(tooth);
    click.rotation.z = -0.1 * (1 - ph) * (1 - ph) + 0.02;
    st.clicks = Math.floor(tooth);
    if (Math.abs(posedW - st.w) > 1e-5) { poseSpring(st.w, arborA); posedW = st.w; }
  }
  update(0);
  setExplode(0);

  return { root, layers, anchors, crown, crownHit, st, update, setExplode, materials: M };
}

function flipWinding(geo) {
  const idx = geo.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const n = geo.attributes.normal;
  geo.index.needsUpdate = true; n.needsUpdate = true;
}

function mergeGeos(list) {
  let count = 0, icount = 0;
  for (const g of list) { count += g.attributes.position.count; icount += g.index.count; }
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), idx = new Uint32Array(icount);
  let o = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    const gi = g.index.array; for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + o;
    o += g.attributes.position.count; io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
