// Planar reflections for glossy floors (polished stone, wet asphalt, lacquered boards).
// Renders a mirrored camera into a mipmapped HDR target; the floor samples it with a roughness-driven LOD,
// so blur is essentially free and follows the material's roughness map.
import * as THREE from 'three';

export class PlanarReflection {
  constructor(renderer, { resolution = 0.5, normal = new THREE.Vector3(0, 1, 0), point = new THREE.Vector3(), clipBias = 0.003 } = {}) {
    this.renderer = renderer;
    this.resolution = resolution;
    this.normal = normal.clone().normalize();
    this.point = point.clone();
    this.clipBias = clipBias;
    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
      colorSpace: THREE.LinearSRGBColorSpace, samples: 0,
    });
    this.cam = new THREE.PerspectiveCamera();
    this.texMatrix = new THREE.Matrix4();
    this.hidden = [];
    this.enabled = true;
    this.uniforms = { uRefl: { value: this.rt.texture }, uReflMat: { value: this.texMatrix } };
    this._v = { rp: new THREE.Vector3(), cp: new THREE.Vector3(), rot: new THREE.Matrix4(), look: new THREE.Vector3(), view: new THREE.Vector3(), target: new THREE.Vector3(), plane: new THREE.Plane(), clip: new THREE.Vector4(), q: new THREE.Vector4() };
  }

  setSize(w, h, dpr) {
    this.rt.setSize(Math.max(2, Math.round(w * dpr * this.resolution)), Math.max(2, Math.round(h * dpr * this.resolution)));
  }

  update(scene, camera) {
    if (!this.enabled) return;
    // Shadow maps are created by the first main render; rendering before that binds an empty shadow sampler.
    if ((this._n = (this._n ?? 0) + 1) < 3) return;
    const { rp, cp, rot, look, view, target, plane, clip, q } = this._v;
    const n = this.normal;
    rp.copy(this.point);
    cp.setFromMatrixPosition(camera.matrixWorld);
    view.subVectors(rp, cp);
    if (view.dot(n) > 0) return;
    view.reflect(n).negate().add(rp);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(cp);
    target.subVectors(rp, look).reflect(n).negate().add(rp);
    const vc = this.cam;
    vc.position.copy(view);
    vc.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
    vc.lookAt(target);
    vc.far = camera.far; vc.near = camera.near;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);
    this.texMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.texMatrix.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    // Oblique near plane so nothing below the floor leaks into the reflection.
    plane.setFromNormalAndCoplanarPoint(n, rp).applyMatrix4(vc.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = vc.projectionMatrix.elements;
    q.x = (Math.sign(clip.x) + e[8]) / e[0];
    q.y = (Math.sign(clip.y) + e[9]) / e[5];
    q.z = -1; q.w = (1 + e[10]) / e[14];
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1 - this.clipBias; e[14] = clip.w;
    vc.projectionMatrixInverse.copy(vc.projectionMatrix).invert();

    const r = this.renderer;
    const prevRT = r.getRenderTarget();
    const prevShadow = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    for (const o of this.hidden) o.visible = false;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, vc);
    for (const o of this.hidden) o.visible = true;
    r.setRenderTarget(prevRT);
    r.shadowMap.autoUpdate = prevShadow;
  }

  /** Patch a MeshStandard/Physical material so it reflects this target. */
  patch(material, { strength = 1, distort = 0.04, lodScale = 7, lodBias = 0.5, f0 = 0.04, tint = new THREE.Color(1, 1, 1) } = {}) {
    const u = this.uniforms;
    material.userData.reflUniforms = Object.assign(u, {
      uReflStrength: { value: strength }, uReflDistort: { value: distort }, uReflLod: { value: lodScale }, uReflBias: { value: lodBias },
      uReflF0: { value: f0 }, uReflTint: { value: tint },
    });
    material.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, material.userData.reflUniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vReflW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvReflW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vReflW; uniform sampler2D uRefl; uniform mat4 uReflMat; uniform float uReflStrength, uReflDistort, uReflLod, uReflBias, uReflF0; uniform vec3 uReflTint;`)
        .replace('#include <opaque_fragment>', `
          {
            vec4 rp = uReflMat * vec4(vReflW, 1.0);
            vec2 ruv = rp.xy / rp.w + normal.xy * uReflDistort;
            float lod = uReflBias + roughnessFactor * uReflLod;
            vec2 texel = exp2(lod) / vec2(textureSize(uRefl, 0));
            float l1 = max(lod - 1.0, 0.0);
            vec3 refl = textureLod(uRefl, ruv, l1).rgb * 0.28
              + textureLod(uRefl, ruv + vec2( 0.9,  0.5) * texel, l1).rgb * 0.18
              + textureLod(uRefl, ruv + vec2(-0.9, -0.5) * texel, l1).rgb * 0.18
              + textureLod(uRefl, ruv + vec2(-0.5,  0.9) * texel, l1).rgb * 0.18
              + textureLod(uRefl, ruv + vec2( 0.5, -0.9) * texel, l1).rgb * 0.18;
            float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
            float fres = uReflF0 + (1.0 - uReflF0) * pow(1.0 - ndv, 5.0);
            float edge = smoothstep(0.0, 0.04, ruv.x) * smoothstep(1.0, 0.96, ruv.x) * smoothstep(0.0, 0.04, ruv.y) * smoothstep(1.0, 0.96, ruv.y);
            outgoingLight += refl * uReflTint * uReflStrength * fres * (1.0 - roughnessFactor * 0.6) * edge;
          }
          #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => 'planar-refl';
    material.needsUpdate = true;
    return material;
  }
}
