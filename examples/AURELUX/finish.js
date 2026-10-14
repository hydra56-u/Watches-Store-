// Haute-horlogerie finishes as live shader code (crisp at any zoom — the macro shots depend on it),
// plus the "iris": a noisy spherical front that dissolves the Meshy watch while the procedural calibre
// appears inside it (complementary discard on the same world-space field).
import * as THREE from 'three';

export const FINISH = { none: 0, cotes: 1, perlage: 2, circular: 3, sunray: 4, snail: 5, mirror: 6 };

const NOISE = /* glsl */`
  float hHash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float hNoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(mix(hHash(i), hHash(i+vec3(1,0,0)), f.x), mix(hHash(i+vec3(0,1,0)), hHash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hHash(i+vec3(0,0,1)), hHash(i+vec3(1,0,1)), f.x), mix(hHash(i+vec3(0,1,1)), hHash(i+vec3(1,1,1)), f.x), f.y), f.z); }
`;

/** Shared iris uniforms (one set per dissolving object). */
export function irisUniforms() {
  return {
    uIris: { value: 0 },
    uIrisC: { value: new THREE.Vector3() },
    uIrisR: { value: 1.2 },
    uIrisGlow: { value: new THREE.Color(2.6, 1.45, 0.8) },
    uIrisInv: { value: 0 },
  };
}

/**
 * Patch a standard/physical material.
 *  finish: FINISH.* on caps (|n.z| > .96 in object space); anglage: polish the 45° chamfers.
 *  iris:   1 = visible inside the front (procedural), 2 = visible outside (Meshy); u = irisUniforms().
 *  spring: hairspring breathing (rotates each vertex by uBal * (1 - aS)).
 *  recolor: case/strap tint for collection variants of the Meshy watch.
 */
export function patch(mat, { finish = 0, anglage = false, iris = 0, u = null, spring = false, recolor = null, params = {} } = {}) {
  const P = {
    uCotes: { value: new THREE.Vector3(Math.cos(0.42), Math.sin(0.42), 0.105) },
    uPerl: { value: 0.046 },
    uGrain: { value: 2400 },
    uBevelRough: { value: 0.05 },
    uSideRough: { value: 0.34 },
    uCapRough: { value: mat.roughness },
    uBal: { value: 0 },
    uCaseTint: { value: new THREE.Color(1, 1, 1) },
    uStrapTint: { value: new THREE.Color(1, 1, 1) },
    uDialC: { value: new THREE.Vector3() },
    uCaseR: { value: 1 },
    uDLC: { value: 0 },
    ...params,
  };
  mat.userData.u = P;
  mat.defines = mat.defines || {};
  if (finish || anglage) mat.defines.HORO_FINISH = finish;
  if (anglage) mat.defines.HORO_ANGLAGE = 1;
  if (iris) mat.defines.HORO_IRIS = iris;
  if (spring) mat.defines.HORO_SPRING = 1;
  if (recolor) mat.defines.HORO_RECOLOR = 1;
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, P);
    if (u) Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOP; varying vec3 vON; varying vec3 vAX; varying vec3 vAY; varying vec3 vIrisW;
        uniform float uBal;
        #ifdef HORO_SPRING
          attribute float aS;
        #endif`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        #ifdef HORO_SPRING
          float hsA = uBal * (1.0 - aS); float hsC = cos(hsA), hsS = sin(hsA);
          objectNormal.xy = mat2(hsC, hsS, -hsS, hsC) * objectNormal.xy;
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef HORO_SPRING
          transformed.xy = mat2(hsC, hsS, -hsS, hsC) * transformed.xy * (1.0 + 0.012 * sin(uBal) * (1.0 - aS));
        #endif
        vOP = transformed; vON = objectNormal;
        mat3 hM = mat3(modelViewMatrix);
        vec4 hW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          hM = hM * mat3(instanceMatrix); hW = instanceMatrix * hW;
        #endif
        vAX = normalize(hM * vec3(1.0, 0.0, 0.0)); vAY = normalize(hM * vec3(0.0, 1.0, 0.0));
        vIrisW = (modelMatrix * hW).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOP; varying vec3 vON; varying vec3 vAX; varying vec3 vAY; varying vec3 vIrisW;
        uniform vec3 uCotes; uniform float uPerl, uGrain, uBevelRough, uSideRough, uCapRough, uDLC, uCaseR;
        uniform vec3 uCaseTint, uStrapTint, uDialC;
        uniform float uIris, uIrisR, uIrisInv; uniform vec3 uIrisC, uIrisGlow;
        ${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float irisEdge = 0.0;
        #ifdef HORO_IRIS
        {
          // Fine, mostly geometric front: a clean sphere with a slight hand-drawn waver, thin warm edge.
          vec3 ip = vIrisW / uIrisR;
          float d = length(vIrisW - uIrisC) / uIrisR;
          d += (hNoise(ip * 7.0) - 0.5) * 0.06 + (hNoise(ip * 23.0) - 0.5) * 0.018;
          if (uIrisInv > 0.5) d = 2.2 - d; // recede from the outside in
          float front = uIris * 2.3 - 0.12;
          #if HORO_IRIS == 1
            if (d > front && uIris < 0.998) discard;
            irisEdge = 1.0 - smoothstep(0.0, 0.011, front - d);
          #else
            if (d < front && uIris > 0.002) discard;
            irisEdge = 1.0 - smoothstep(0.0, 0.011, d - front);
          #endif
          irisEdge *= step(0.002, uIris) * step(uIris, 0.998);
        }
        #endif`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        #ifdef HORO_RECOLOR
        {
          vec3 c = diffuseColor.rgb;
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
          float sat = (mx - mn) / max(mx, 1e-4);
          float warm = step(c.b, c.g) * step(c.g, c.r);
          vec3 q = (vOP - uDialC) / uCaseR;
          float outer = max(smoothstep(0.75, 0.81, length(q.xy)), step(q.z, -0.3));
          float metal = smoothstep(0.35, 0.7, metalnessFactor);
          float caseW = metal * smoothstep(0.1, 0.26, sat) * warm * outer;
          float strapW = (1.0 - metal) * (1.0 - smoothstep(0.1, 0.28, lum)) * outer;
          diffuseColor.rgb = mix(diffuseColor.rgb, uCaseTint * clamp(lum / 0.42, 0.25, 1.6), caseW);
          diffuseColor.rgb = mix(diffuseColor.rgb, uStrapTint * clamp(lum / 0.035, 0.3, 2.5), strapW);
          roughnessFactor = mix(roughnessFactor, max(roughnessFactor, 0.34), caseW * uDLC);
        }
        #endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef HORO_FINISH
        {
          vec3 on = normalize(vON);
          float az = abs(on.z);
          vec2 pert = vec2(0.0);
          if (az > 0.96) {
            vec2 p = vOP.xy;
            roughnessFactor = uCapRough;
            #if HORO_FINISH == 1
              // Côtes de Genève: parallel bands, each a slight ramp, with the arcs of the boxwood wheel.
              vec2 q = vec2(p.x * uCotes.x - p.y * uCotes.y, p.x * uCotes.y + p.y * uCotes.x);
              float v = q.y / uCotes.z, f = fract(v);
              float step2 = uCotes.z * 0.55;
              float fx = (fract(q.x / step2) - 0.5) * step2;
              float dd = length(vec2(fx, f * uCotes.z + uCotes.z * 0.75));
              float ph = dd * 1500.0;
              float g = sin(ph) * (1.0 - smoothstep(0.25, 0.9, fwidth(ph) / 6.2832));
              float k = floor(v);
              float jit = fract(sin(k * 91.7) * 4375.5) - 0.5;
              float edge = smoothstep(0.035, 0.0, f) - smoothstep(0.965, 1.0, f);
              vec2 tq = vec2(g * 0.03, (f - 0.5) * 0.3 + jit * 0.03 + edge * 0.22);
              pert = vec2(tq.x * uCotes.x + tq.y * uCotes.y, -tq.x * uCotes.y + tq.y * uCotes.x);
              roughnessFactor = mix(uCapRough * 0.75, uCapRough * 1.2, smoothstep(0.0, 1.0, f));
            #elif HORO_FINISH == 2
              // Perlage: overlapping grained circles, later rows on top.
              vec2 q = p / uPerl, fq = floor(q), bl = vec2(0.0);
              float best = -1e9;
              for (int j = -1; j <= 1; j++) for (int i = -2; i <= 1; i++) {
                vec2 cell = fq + vec2(float(i), float(j));
                vec2 l = q - (cell + vec2(0.5 + mod(cell.y, 2.0) * 0.5, 0.5));
                float o = cell.y * 173.0 + cell.x;
                if (dot(l, l) < 0.62 && o > best) { best = o; bl = l; }
              }
              float rr = length(bl);
              vec2 rad = bl / max(rr, 1e-4);
              vec2 cid = floor(q - bl + 0.001);
              vec2 tilt = vec2(fract(sin(dot(cid, vec2(12.99, 78.23))) * 43758.5), fract(sin(dot(cid, vec2(39.35, 11.13))) * 24634.6)) - 0.5;
              float ph = rr * 70.0;
              float g = sin(ph) * (1.0 - smoothstep(0.3, 0.9, fwidth(ph) / 6.2832));
              pert = tilt * 0.22 + rad * 0.07 * smoothstep(0.0, 0.79, rr) + vec2(-rad.y, rad.x) * g * 0.06;
              roughnessFactor = uCapRough * (0.8 + rr * 0.4);
            #elif HORO_FINISH == 3
              // Circular satin graining.
              float rr = length(p); vec2 rad = p / max(rr, 1e-5);
              float ph = rr * uGrain;
              float g = sin(ph) * (1.0 - smoothstep(0.3, 0.9, fwidth(ph) / 6.2832));
              float g2 = sin(rr * uGrain * 0.137 + 1.3);
              pert = rad * (g * 0.045 + g2 * 0.018);
            #elif HORO_FINISH == 4
              // Sunray (soleil) brushing.
              float rr = length(p); vec2 rad = p / max(rr, 1e-5);
              float ph = atan(p.y, p.x) * 260.0;
              float g = sin(ph) * (1.0 - smoothstep(0.3, 0.9, fwidth(ph) / 6.2832));
              pert = vec2(-rad.y, rad.x) * g * 0.06;
            #elif HORO_FINISH == 5
              // Snailing / azurage: concentric guilloché grooves.
              float rr = length(p); vec2 rad = p / max(rr, 1e-5);
              float ph = rr * 640.0;
              float g = sin(ph) * (1.0 - smoothstep(0.3, 0.9, fwidth(ph) / 6.2832));
              pert = rad * g * 0.14;
            #elif HORO_FINISH == 6
              roughnessFactor = uCapRough;
            #endif
          }
          #ifdef HORO_ANGLAGE
          else if (az > 0.3) { roughnessFactor = uBevelRough; }
          else { roughnessFactor = uSideRough; }
          #endif
          normal = normalize(normal + (vAX * pert.x + vAY * pert.y));
        }
        #endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uIrisGlow * irisEdge;`);
  };
  mat.customProgramCacheKey = () => `horo:${finish}:${anglage ? 1 : 0}:${iris}:${spring ? 1 : 0}:${recolor ? 1 : 0}`;
  return mat;
}
