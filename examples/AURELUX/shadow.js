// Soft contact shadow for a floating object over the ivory cyclorama: an orthographic depth pass
// from the floor looking up, blurred twice, laid on the floor as a darkening layer.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';

export class ContactShadow {
  constructor(renderer, scene, { width = 16, depth = 10, y = -2.6, res = 512, far = 5, blur = 3.2, opacity = 0.6, color = 0x1b2236 } = {}) {
    this.renderer = renderer; this.scene = scene; this.blur = blur;
    const opts = { type: THREE.HalfFloatType };
    this.rt = new THREE.WebGLRenderTarget(res, res * depth / width, opts);
    this.rt2 = new THREE.WebGLRenderTarget(res, res * depth / width, opts);
    this.cam = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, far);
    this.cam.rotation.x = Math.PI / 2; // look up (+Y)
    this.cam.position.set(0, y, 0);
    this.depthMat = new THREE.ShaderMaterial({
      uniforms: { uFar: { value: far } },
      vertexShader: `#include <common>
        varying float vH;
        void main(){ vec4 wp = modelMatrix * vec4(position, 1.0);
          #ifdef USE_INSTANCING
            wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          #endif
          vH = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform float uFar; uniform float uY; varying float vH;
        void main(){ float h = clamp((vH - uY) / uFar, 0.0, 1.0); gl_FragColor = vec4(vec3(0.0), pow(1.0 - h, 2.2)); }`,
      side: THREE.DoubleSide,
    });
    this.depthMat.uniforms.uY = { value: y };
    this.blurH = new FullScreenQuad(new THREE.ShaderMaterial(HorizontalBlurShader));
    this.blurV = new FullScreenQuad(new THREE.ShaderMaterial(VerticalBlurShader));
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { map: { value: this.rt.texture }, uOpacity: { value: opacity }, uColor: { value: new THREE.Color(color) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv;
        void main(){ float a = texture2D(map, vec2(vUv.x, 1.0 - vUv.y)).a; vec2 e = smoothstep(0.0, 0.12, vUv) * smoothstep(0.0, 0.12, 1.0 - vUv);
          gl_FragColor = vec4(uColor, a * uOpacity * e.x * e.y); }`,
    }));
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.position.y = y + 0.002;
    this.plane.renderOrder = -1;
    scene.add(this.plane);
    this.hidden = [this.plane];
  }
  setCenter(x, z) { this.cam.position.x = x; this.cam.position.z = z; this.plane.position.x = x; this.plane.position.z = z; }
  update() {
    const { renderer: r, scene } = this;
    const vis = this.hidden.map(o => o.visible);
    this.hidden.forEach(o => { o.visible = false; });
    const prevBg = scene.background, prevOv = scene.overrideMaterial, prevRT = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    const prevAuto = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    scene.background = null; scene.overrideMaterial = this.depthMat;
    r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear();
    r.render(scene, this.cam);
    scene.overrideMaterial = prevOv; scene.background = prevBg;
    for (let i = 0; i < 2; i++) {
      this.blurH.material.uniforms.tDiffuse.value = this.rt.texture; this.blurH.material.uniforms.h.value = this.blur / 256 * (i + 1);
      r.setRenderTarget(this.rt2); this.blurH.render(r);
      this.blurV.material.uniforms.tDiffuse.value = this.rt2.texture; this.blurV.material.uniforms.v.value = this.blur / 256 * (i + 1);
      r.setRenderTarget(this.rt); this.blurV.render(r);
    }
    r.setRenderTarget(prevRT); r.setClearColor(prevClear, prevAlpha);
    r.shadowMap.autoUpdate = prevAuto;
    this.hidden.forEach((o, i) => { o.visible = vis[i]; });
  }
}
