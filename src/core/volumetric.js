// Raymarched volumetric spotlights as a post effect. The march stops at scene depth, so beams end on
// surfaces and pass behind objects correctly; noise gives drifting dust. Up to 4 lights.
import * as THREE from 'three';
import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';

const frag = /* glsl */`
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform int uCount;
uniform vec3 uLPos[4];
uniform vec3 uLDir[4];
uniform vec3 uLCol[4];
uniform vec2 uLCone[4];
uniform float uLRange[4];
uniform float uDensity;
uniform float uTime;
uniform float uNoise;
uniform float uNoiseScale;
uniform float uMaxDist;
uniform vec3 uWind;
uniform float uFloorY;

float vhash(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(vhash(i), vhash(i + vec3(1,0,0)), f.x), mix(vhash(i + vec3(0,1,0)), vhash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(vhash(i + vec3(0,0,1)), vhash(i + vec3(1,0,1)), f.x), mix(vhash(i + vec3(0,1,1)), vhash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 clip = vec4(uv * 2. - 1., depth * 2. - 1., 1.);
  vec4 vp = uProjInv * clip; vp /= vp.w;
  vec3 wp = (uCamWorld * vec4(vp.xyz, 1.)).xyz;
  vec3 ro = uCamPos;
  vec3 rd = wp - ro;
  float len = min(length(rd), uMaxDist);
  rd = normalize(rd);
  const int STEPS = 32;
  float stepL = len / float(STEPS);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 acc = vec3(0.);
  for (int i = 0; i < STEPS; i++) {
    float t = (float(i) + jitter) * stepL;
    vec3 p = ro + rd * t;
    vec3 q = p * uNoiseScale + uWind * uTime;
    float n = vnoise(q) * 0.65 + vnoise(q * 2.7 + 7.1) * 0.35;
    float dens = uDensity * mix(1.0, n * n * 2.4, uNoise) * smoothstep(uFloorY - 0.2, uFloorY + 0.6, p.y);
    for (int l = 0; l < 4; l++) {
      if (l >= uCount) break;
      vec3 d = p - uLPos[l];
      float dist = max(length(d), 1e-3);
      float c = dot(d / dist, uLDir[l]);
      float cone = smoothstep(uLCone[l].x, uLCone[l].y, c);
      float att = 1.0 / (1.0 + dist * dist * uLRange[l]);
      acc += uLCol[l] * cone * att * dens * stepL;
    }
  }
  outputColor = vec4(inputColor.rgb + acc, inputColor.a);
}`;

export class VolumetricSpotEffect extends Effect {
  constructor(camera, { density = 0.08, noise = 0.8, noiseScale = 1.4, maxDist = 30, wind = new THREE.Vector3(0.02, 0.05, 0.01), floorY = -100 } = {}) {
    const vec3s = () => [0, 1, 2, 3].map(() => new THREE.Vector3());
    super('VolumetricSpotEffect', frag, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['uProjInv', new THREE.Uniform(new THREE.Matrix4())],
        ['uCamWorld', new THREE.Uniform(new THREE.Matrix4())],
        ['uCamPos', new THREE.Uniform(new THREE.Vector3())],
        ['uCount', new THREE.Uniform(0)],
        ['uLPos', new THREE.Uniform(vec3s())],
        ['uLDir', new THREE.Uniform(vec3s())],
        ['uLCol', new THREE.Uniform(vec3s())],
        ['uLCone', new THREE.Uniform([0, 1, 2, 3].map(() => new THREE.Vector2(0.9, 0.95)))],
        ['uLRange', new THREE.Uniform([0.05, 0.05, 0.05, 0.05])],
        ['uDensity', new THREE.Uniform(density)],
        ['uTime', new THREE.Uniform(0)],
        ['uNoise', new THREE.Uniform(noise)],
        ['uNoiseScale', new THREE.Uniform(noiseScale)],
        ['uMaxDist', new THREE.Uniform(maxDist)],
        ['uWind', new THREE.Uniform(wind)],
        ['uFloorY', new THREE.Uniform(floorY)],
      ]),
    });
    this.camera = camera;
    this.lights = [];
    this._d = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  /** Track a THREE.SpotLight. `scale` multiplies its colour*intensity into the fog; `range` is quadratic falloff. */
  add(light, { scale = 0.02, range = 0.04, softness = 0.12 } = {}) {
    this.lights.push({ light, scale, range, softness });
    return this;
  }

  update(renderer, inputBuffer, dt) {
    const u = this.uniforms;
    const cam = this.camera;
    u.get('uProjInv').value.copy(cam.projectionMatrixInverse);
    u.get('uCamWorld').value.copy(cam.matrixWorld);
    u.get('uCamPos').value.setFromMatrixPosition(cam.matrixWorld);
    u.get('uTime').value += dt;
    const n = Math.min(4, this.lights.length);
    u.get('uCount').value = n;
    for (let i = 0; i < n; i++) {
      const { light, scale, range, softness } = this.lights[i];
      light.updateMatrixWorld();
      light.target.updateMatrixWorld();
      this._p.setFromMatrixPosition(light.matrixWorld);
      this._d.setFromMatrixPosition(light.target.matrixWorld).sub(this._p).normalize();
      u.get('uLPos').value[i].copy(this._p);
      u.get('uLDir').value[i].copy(this._d);
      const on = light.visible ? light.intensity * scale : 0;
      u.get('uLCol').value[i].set(light.color.r * on, light.color.g * on, light.color.b * on);
      const outer = Math.cos(light.angle);
      const inner = Math.cos(light.angle * (1 - Math.max(light.penumbra, softness)));
      u.get('uLCone').value[i].set(outer, inner);
      u.get('uLRange').value[i] = range;
    }
  }
}
