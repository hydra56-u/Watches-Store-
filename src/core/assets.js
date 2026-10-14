// Asset loading with one shared progress stream for the preloader.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

export const BASE = import.meta.env.BASE_URL;
export const url = p => (p.startsWith('http') ? p : BASE + p.replace(/^\//, ''));

export class Assets {
  constructor(onProgress) {
    this.manager = new THREE.LoadingManager();
    this.progress = 0;
    this._listeners = onProgress ? [onProgress] : [];
    // Byte-weighted progress: GLBs dominate load time, so count bytes where the server reports them.
    this._bytes = new Map();
    this.manager.onProgress = () => this._emit();
    this.gltfLoader = new GLTFLoader(this.manager);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    this.tex = new THREE.TextureLoader(this.manager);
    this.cache = new Map();
    this._pending = 0;
    this._done = 0;
  }

  onProgress(f) { this._listeners.push(f); }
  _emit() {
    let loaded = 0, total = 0;
    for (const v of this._bytes.values()) { loaded += v.loaded; total += v.total || v.loaded || 1; }
    const byteP = total ? loaded / total : 0;
    const countP = this._pending ? this._done / this._pending : 1;
    this.progress = Math.min(byteP * 0.8 + countP * 0.2, 1);
    for (const f of this._listeners) f(this.progress);
  }

  gltf(path) {
    const u = url(path);
    if (this.cache.has(u)) return this.cache.get(u);
    this._pending++;
    this._bytes.set(u, { loaded: 0, total: 0 });
    const p = new Promise((res, rej) => this.gltfLoader.load(u, g => { this._done++; this._emit(); res(g); },
      e => { this._bytes.set(u, { loaded: e.loaded, total: e.total }); this._emit(); }, rej));
    this.cache.set(u, p);
    return p;
  }

  texture(path, { srgb = true, repeat = null, flipY = true } = {}) {
    const u = url(path);
    this._pending++;
    return new Promise((res, rej) => this.tex.load(u, t => {
      this._done++; this._emit();
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = flipY;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
      t.anisotropy = 8;
      res(t);
    }, undefined, rej));
  }

  hdr(path) {
    const u = url(path);
    this._pending++;
    return new Promise((res, rej) => new RGBELoader(this.manager).load(u, t => { this._done++; this._emit(); t.mapping = THREE.EquirectangularReflectionMapping; res(t); }, undefined, rej));
  }
}

/** First mesh in a glTF scene (Meshy exports a single textured mesh). */
export function firstMesh(root) {
  let m = null;
  root.traverse(o => { if (!m && o.isMesh) m = o; });
  return m;
}

/**
 * Sample N points on a mesh surface, in the mesh's world space, with the texture colour at each point.
 * Returns { position: Float32Array(3N), normal, color, uv }.
 */
export function sampleSurface(mesh, count, { colors = true } = {}) {
  mesh.updateMatrixWorld(true);
  const sampler = new MeshSurfaceSampler(mesh).build();
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color(), uv = new THREE.Vector2();
  const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  let pixels = null, tw = 0, th = 0;
  const map = mesh.material?.map;
  if (colors && map?.image) {
    const img = map.image;
    tw = Math.min(img.width, 1024); th = Math.min(img.height, 1024);
    const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, tw, th);
    pixels = cx.getImageData(0, 0, tw, th).data;
  }
  for (let i = 0; i < count; i++) {
    sampler.sample(p, n, c, uv);
    p.applyMatrix4(mesh.matrixWorld);
    n.applyMatrix3(nm).normalize();
    pos.set([p.x, p.y, p.z], i * 3);
    nor.set([n.x, n.y, n.z], i * 3);
    uvs.set([uv.x, uv.y], i * 2);
    if (pixels) {
      const u = ((uv.x % 1) + 1) % 1, v = ((uv.y % 1) + 1) % 1;
      const x = Math.floor(u * (tw - 1)), y = Math.floor((map.flipY ? 1 - v : v) * (th - 1));
      const k = (y * tw + x) * 4;
      c.setRGB(pixels[k] / 255, pixels[k + 1] / 255, pixels[k + 2] / 255, THREE.SRGBColorSpace);
      col.set([c.r, c.g, c.b], i * 3);
    } else col.set([1, 1, 1], i * 3);
  }
  return { position: pos, normal: nor, color: col, uv: uvs };
}
