// Studio for metals on ivory: long softboxes over a mid-dark dome so polished parts carry both
// bright strip highlights and deep reflections. Shared by the page and the lab.
import { THREE, studioEnvironment } from '../../src/core/engine.js';

export function makeEnv(renderer, { front = 1.4, dome = 1 } = {}) {
  return studioEnvironment(renderer, {
    top: new THREE.Color(0x6e6e74).multiplyScalar(dome).getHex(), bottom: 0x121214,
    panels: [
      { pos: [0, 8, 2], size: [14, 1.6], intensity: 7, color: 0xffffff },      // long overhead strip
      { pos: [2, 7, -3], size: [6, 4], intensity: 2.2, color: 0xfffaf4 },       // broad overhead box
      { pos: [-8, 2, 3], size: [1.4, 10], intensity: 5.5, color: 0xfff1e4 },    // warm left strip
      { pos: [7, 3, -1], size: [1.0, 9], intensity: 4.5, color: 0xe9f0ff },     // cool right strip
      { pos: [0, 2, 10], size: [9, 5], intensity: front, color: 0xfff6ee },      // front diffuser
      { pos: [0, 5, -8], size: [10, 1.4], intensity: 4, color: 0xffffff },      // back strip (rims)
      { pos: [-5, -4, 5], size: [6, 1.2], intensity: 1.6, color: 0xffe8d6 },    // low warm kicker
    ],
    blur: 0.035,
  });
}

export function makeStudio(renderer, scene, opts = {}) {
  const env = makeEnv(renderer, opts);
  scene.environment = env;
  // A lost/restored context (heavy GPU contention) wipes the PMREM target: rebuild it.
  renderer.domElement.addEventListener('webglcontextrestored', () => { scene.environment = makeEnv(renderer, opts); });
  scene.environmentIntensity = 1;
  const key = new THREE.DirectionalLight(0xfff3e6, 2.6);
  key.position.set(-3.5, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3.6, right: 3.6, top: 3.6, bottom: -3.6, near: 0.5, far: 24 });
  key.shadow.bias = -0.0002; key.shadow.normalBias = 0.004; key.shadow.radius = 2;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xdce6ff, 1.6);
  rim.position.set(5, 2.5, -6);
  scene.add(rim, rim.target);
  const fill = new THREE.HemisphereLight(0xfff6ec, 0x2a2c33, 0.35);
  scene.add(fill);
  return { env, key, rim, fill };
}

// Tone-mapped (Khronos neutral) HDR value that lands on ivory #f3efe7 after the post stack.
export const IVORY_HDR = new THREE.Color(1.114, 1.073, 0.995);
