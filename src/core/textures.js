// Procedural tileable textures rendered on the GPU once at startup (fbm noise, height -> normal).
import * as THREE from 'three';

const NOISE_GLSL = /* glsl */`
  // Periodic gradient noise so the textures tile seamlessly.
  vec2 hash2(vec2 p, float per){ p = mod(p, per); p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
  float pnoise(vec2 p, float per){
    vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.-15.)+10.);
    return mix(mix(dot(hash2(i,per), f), dot(hash2(i+vec2(1,0),per), f-vec2(1,0)), u.x),
               mix(dot(hash2(i+vec2(0,1),per), f-vec2(0,1)), dot(hash2(i+vec2(1,1),per), f-vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p, float per, int oct, float gain){ float a = .5, s = 0.; for(int i=0;i<10;i++){ if(i>=oct) break; s += a*pnoise(p, per); p *= 2.; per *= 2.; a *= gain; } return s; }
  float ridge(vec2 p, float per, int oct){ float a=.5, s=0.; for(int i=0;i<10;i++){ if(i>=oct) break; s += a*(1.-abs(pnoise(p,per))); p*=2.; per*=2.; a*=.5; } return s; }
`;

function bake(renderer, size, frag, uniforms = {}) {
  const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `precision highp float; varying vec2 vUv; ${NOISE_GLSL}\n${frag}`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  mat.dispose(); quad.geometry.dispose();
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping;
  rt.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return rt.texture;
}

/** Greyscale fbm. `frag` override lets a page write its own height function h(uv). */
export function fbmTexture(renderer, { size = 1024, scale = 6, octaves = 6, gain = 0.5, contrast = 1, bias = 0.5, ridged = false } = {}) {
  return bake(renderer, size, `
    void main(){
      float n = ${ridged ? 'ridge(vUv*' + scale.toFixed(1) + ',' + scale.toFixed(1) + ',' + octaves + ')' : 'fbm(vUv*' + scale.toFixed(1) + ',' + scale.toFixed(1) + ',' + octaves + ',' + gain.toFixed(2) + ')'};
      float v = clamp(${bias.toFixed(3)} + n * ${contrast.toFixed(3)}, 0., 1.);
      gl_FragColor = vec4(vec3(v), 1.);
    }`);
}

/** Tangent-space normal map from an fbm height field. */
export function fbmNormal(renderer, { size = 1024, scale = 6, octaves = 6, strength = 2, ridged = false, gain = 0.5 } = {}) {
  const h = ridged ? `ridge(p*${scale.toFixed(1)}, ${scale.toFixed(1)}, ${octaves})` : `fbm(p*${scale.toFixed(1)}, ${scale.toFixed(1)}, ${octaves}, ${gain.toFixed(2)})`;
  return bake(renderer, size, `
    float H(vec2 p){ return ${h}; }
    void main(){
      float e = 1.0 / ${size.toFixed(1)};
      float hx = H(vUv + vec2(e,0.)) - H(vUv - vec2(e,0.));
      float hy = H(vUv + vec2(0.,e)) - H(vUv - vec2(0.,e));
      vec3 n = normalize(vec3(-hx * ${strength.toFixed(2)} * ${size.toFixed(1)} * 0.02, -hy * ${strength.toFixed(2)} * ${size.toFixed(1)} * 0.02, 1.));
      gl_FragColor = vec4(n * 0.5 + 0.5, 1.);
    }`);
}

/** Bake any custom shader to a texture: body must set gl_FragColor from vUv; noise helpers available. */
export function bakeTexture(renderer, size, body, uniforms) { return bake(renderer, size, body, uniforms); }
export { NOISE_GLSL };
