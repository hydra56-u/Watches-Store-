// Studio for metals on ivory: long softboxes over a mid-dark dome so polished parts carry both
// bright strip highlights and deep reflections. Shared by the page and the lab.
import { THREE, studioEnvironment } from '../../src/core/engine.js';

export function makeEnv(renderer, { front = 1.4, dome = 1 } = {}) {
  return studioEnvironment(renderer, {
    top: new THREE.Color(0x343039).multiplyScalar(dome).getHex(),
bottom: 0x08080c,
  panels: [

  // Main overhead softbox
  {
    pos: [0, 8, 2],
    size: [14, 1.6],
    intensity: 6,
    color: 0xffffff
  },

  // Soft champagne light
  {
    pos: [2, 7, -3],
    size: [6, 4],
    intensity: 2.5,
    color: 0xffe4cc
  },

  // Rose gold reflection - left side
  {
    pos: [-8, 2, 3],
    size: [1.4, 10],
    intensity: 5,
    color: 0xffb59c
  },

  // Cool white reflection - right side
  {
    pos: [7, 3, -1],
    size: [1.0, 9],
    intensity: 4,
    color: 0xe8efff
  },

  // Front softbox
  {
    pos: [0, 2, 10],
    size: [9, 5],
    intensity: front,
    color: 0xfff1e8
  },

  // Rear highlight
  {
    pos: [0, 5, -8],
    size: [10, 1.4],
    intensity: 4,
    color: 0xffffff
  },

  // Lower rose gold reflection
  {
    pos: [-5, -4, 5],
    size: [6, 1.2],
    intensity: 2,
    color: 0xe8a98f
  }

],
blur: 0.035,
    blur: 0.035,
  });
}

export function makeStudio(renderer, scene, opts = {}) {
  const env = makeEnv(renderer, opts);
  scene.environment = env;
  // A lost/restored context (heavy GPU contention) wipes the PMREM target: rebuild it.
  renderer.domElement.addEventListener('webglcontextrestored', () => { scene.environment = makeEnv(renderer, opts); });
  scene.environmentIntensity = 1;
  const key = new THREE.DirectionalLight(0xfff3e6, 2.4);
  key.position.set(-3.5, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3.6, right: 3.6, top: 3.6, bottom: -3.6, near: 0.5, far: 24 });
  key.shadow.bias = -0.0002; key.shadow.normalBias = 0.004; key.shadow.radius = 2;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xdce6ff, 1.8);
  rim.position.set(5, 2.5, -6);
  scene.add(rim, rim.target);
  const fill = new THREE.HemisphereLight(
  0xffe6dc,
  0x17141a,
  0.4
);
  scene.add(fill);
  return { env, key, rim, fill };
}

// Tone-mapped (Khronos neutral) HDR value that lands on ivory #f3efe7 after the post stack.
export const IVORY_HDR = new THREE.Color(1.114, 1.073, 0.995);
