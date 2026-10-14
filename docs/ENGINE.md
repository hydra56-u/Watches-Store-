# Twenty Worlds — engine & quality guide

Twenty interactive 3D landing pages, each a complete, fictional brand website whose 3D scene carries the whole page
(not a hero-only canvas). Built on three.js r186 + pmndrs postprocessing + N8AO + GSAP/Lenis, with hyper-detailed
Meshy 7.1 GLB assets. The benchmark we must beat by a wide margin is ThreeUI (threeui.com): procedural, stylised
3D heroes next to conventional UI sections. Our pages must feel like Awwwards Site-of-the-Day work: cinematic lighting,
real materials, choreographed camera, a signature interaction nobody has seen on a landing page, and flawless UI.

The reference implementation is `pages/reliquary/` — read it first. It shows the page structure, the boot sequence
(loader → compile → start → intro), scroll choreography, HTML cards projected from 3D, post-render capture, etc.

## Layout
- `pages/<slug>/index.html | main.js | style.css` — each world is self-contained. Put page-only images in
  `public/img/<slug>/`, extra models in `public/models/<slug>/`.
- `src/core/*` — shared engine. **Do not edit files in src/core** (other pages are being built in parallel).
  If you need different behaviour, copy the function into your page folder and change it there.
- Dev server is already running: `http://127.0.0.1:5190/pages/<slug>/` (Vite, HMR). Do not start another.
  If it is down, tell the lead in your report instead of starting one.
- Model viewer: `http://127.0.0.1:5190/pages/_viewer/?m=models/<slug>/<file>.glb&rot=-30&d=4&h=1.4`

## Core API (src/core)
- `engine.js`
  - `new Engine({ canvas, fov, near, far, dpr, background, shadows, post })` → `{ renderer, scene, camera, time }`.
    `post` = `{ ao: {aoRadius, intensity, distanceFalloff} | false, bloom: {intensity, luminanceThreshold, luminanceSmoothing, radius} | false,
    pre: (camera, scene) => [effects before tone mapping], extra: (camera, scene) => [effects after tone mapping],
    tone: 'agx'|'aces'|'neutral'|'reinhard'|'linear', vignette: {offset, darkness} | false, noise: 0.06 | false, ca: 0.001, smaa }`.
    Tone mapping happens in post; renderer.toneMapping stays NoToneMapping. HalfFloat HDR buffers.
  - `engine.onTick((dt, t) => …)`, `engine.onAfterRender(fn)`, `engine.onResize((w, h, dpr) => …)`, `engine.start()`,
    `engine.paused = true` skips rendering (use when HTML panels fully cover the canvas).
  - `engine.post.{bloom, ao, vignette, noise, tone, ca}` for live tweaks.
  - `studioEnvironment(renderer, { top, bottom, panels:[{pos,size,intensity,color}] })` → PMREM env texture (softboxes).
  - `normalize(obj, size, { ground=true, axis='max'|'y'|'x' })` fits a model into `size` and rests it on y=0.
  - `prepModel(obj, renderer, { cast, receive, env, rough, metal, onMat(mat, mesh) })`.
  - `damp(a,b,lambda,dt)`, `clamp`, `lerp`, `smooth(a,b,v)` (smoothstep), `range(v,a,b)`.
- `assets.js`: `const assets = new Assets()`; `await assets.gltf('models/<slug>/x.glb')`, `assets.texture('img/..')`,
  `assets.progress` (0..1). `sampleSurface(mesh, count)` → `{position, normal, color, uv}` Float32Arrays in world space
  (colours read from the base-colour texture) — for particle systems. `firstMesh(root)`.
- `input.js`: `new Pointer()` → `x,y` NDC raw, `sx,sy` damped, `px,py` pixels, `vx,vy` velocity, `down`, `.on('down'|'up'|'move', fn)`;
  call `pointer.update(dt)` each tick.
- `scroll.js`: `smoothScroll()` (Lenis, sets `window.__lenis`), `gsap`, `ScrollTrigger`, `SplitText`,
  `elementProgress(el)` (0..1 through an element's scroll span), `pageProgress()`, `reveal(selector, {type:'lines'|'words'|'chars'})`.
- `ui.js`: `preloader({ assets, el, onValue, minTime, exit })` → `.finish()`; `cursor({ color, blend, size })` →
  `.set(state, label)` states: '', 'link', 'drag', 'label', 'hidden'; `magnetic('[data-magnetic]')`;
  **`worldNav(slug, { theme: 'dark'|'light', corner: 'bl'|'br'|'tl'|'tr' })` is mandatory on every page.**
- `reflector.js`: `new PlanarReflection(renderer, { resolution })`, `.hidden.push(floorMesh)`, `.patch(material, { strength, distort, lodScale, lodBias, f0 })`,
  `.setSize(w,h,dpr)` in onResize, `.update(scene, camera)` each tick. Roughness map drives blur.
- `volumetric.js`: `new VolumetricSpotEffect(camera, { density, noise, noiseScale, maxDist, wind, floorY })` — put it in
  `post.pre`; `.add(spotLight, { scale, range, softness })` (max 4). Raymarched beams that stop at scene depth.
- `textures.js`: `fbmTexture`, `fbmNormal`, `bakeTexture(renderer, size, glslBody)` — tileable GPU-baked noise textures.
  In `bakeTexture` bodies you can use `vUv`, `pnoise(p, period)`, `fbm(p, period, octaves, gain)`, `ridge(p, period, octaves)`.
- `worlds.js`: the list of 20 worlds (slug, name, line, hue).

## Assets
- Meshy 7.1 GLBs are already optimised in `public/models/<slug>/` (meshopt + WebP, 2048² base/normal/metalRough PBR,
  60k–250k triangles). Models face **+Z**, are single meshes, arbitrary scale — always `normalize()`.
- The clean reference image each model was built from: `assets/src/<prefix>-<name>.png` (look at it!).
- Viewer renders of every model: `shots/models/<slug>-<name>.png`.
- You may generate extra 2D images with Nano Banana 2 (backgrounds, plates, product photos, textures):
  write a job file `assets/jobs/<slug>-extra.json` like `{ "images": [{ "id": "<slug>-foo", "raw": true, "prompt": "…", "aspect_ratio": "16:9", "resolution": "2K" }] }`
  and run `node scripts/gen.mjs images assets/jobs/<slug>-extra.json`; output lands in `assets/src/<id>.png`. Convert to WebP into
  `public/img/<slug>/` with sharp. Budget: at most 6 images per page. `raw: true` skips the white-background product suffix.
- Do **not** start new Meshy generations without asking the lead; if a model is unusable, say so in your report.
- Heavy models: prefer ≤1.6M triangles on screen, ≤45 MB total download per page.

## QA tooling (use it constantly — you cannot see the page otherwise)
- `node scripts/shot.mjs "<url>" shots/<slug>/<name> --wait 6000 --mouse 0.6,0.45 --scrolls 0,0.2,0.5,0.8,1 [--click 0.5,0.5 --clickwait 1500] [--mobile] [--settle 1800]`
  → one PNG per scroll stop (headless Chrome on the RTX 4090, real WebGL), prints `{gl, docH, fps, loadMs}` and console errors.
  `--actions "js"` evaluates JS after load (e.g. to trigger a state). The page receives real mouse moves/clicks.
- `node scripts/contact.mjs shots/sheets/<name> 2 720 a.png b.png …` → contact sheet JPG (cheaper to review than many PNGs).
- Harmless console noise: `THREE.Clock deprecated`, D3D shader warnings `X3595`/`X4122`, a favicon 404.
- `window.__fps` is set by the engine; aim for 60 at 1440×900 on the 4090 (it will be ~2–3× slower on laptops, so budget).

## Quality bar — be brutal
Review every screenshot as a picky art director would. Iterate until every answer is yes:
1. Would this stop someone scrolling on Awwwards? Is the hero frame a poster you'd print?
2. Lighting: motivated key light, rim/fill, real shadows and AO contact; nothing looks flat, grey or "default three.js".
3. Materials: Meshy PBR maps used; env map present; no blown-out whites, no crushed blacks without intent, no plastic look.
4. Composition: the 3D subject and the typography are designed together; nothing overlaps awkwardly; clear hierarchy; generous spacing.
5. The signature interaction works, is discoverable within 3 seconds (hint UI), and looks spectacular in a still frame.
6. Scroll choreography: every section has a distinct camera/scene state; transitions are eased, never jumpy.
7. Complete landing page: nav, hero, ≥4 content sections with real (fictional but specific, well-written) copy, CTA, footer. No lorem ipsum.
8. Typography: a deliberate Google Fonts pairing unique to this world; sizes fluid (clamp); legible over 3D.
9. Loader that fits the world; intro animation after load; `renderer.compile()` before start to avoid hitches.
10. Mobile (`--mobile`): layout holds at 390×844, interaction has a touch equivalent, no horizontal scroll.
11. No console errors. 60 fps on the 4090.
Distinctiveness: every world must look and feel unlike the others (palette, type, layout, motion language).

## Gotchas
- `PCFSoftShadowMap` was removed in r186 (engine uses PCFShadowMap). Set `light.shadow.radius`/bias as needed.
- Give spot/dir lights a `.target` added to the scene.
- When the camera is inside a volumetric beam the whole view hazes — keep density low (0.02–0.05) and let noise shape it.
- Canvas is `position: fixed`; HTML sections scroll over it. Put `pointer-events: none` on overlay text wrappers that sit
  over interactive 3D, re-enable on buttons/links.
- AudioContext needs a user gesture; audio must be optional and never auto-start loudly; give a mute toggle if used.
- Keep the page's JS in one `main.js` (split into more files in the page folder if it gets long).

## Lessons from the build (added after all twenty worlds shipped)
- **Chromatic aberration** samples its input buffer directly, so it now runs in its own EffectPass after tone mapping
  (fixed in `engine.js`); before that it re-sampled un-tone-mapped HDR for the red/blue channels.
- **Env strength:** in r186 `material.envMapIntensity` only applies when the material has its own `envMap`; with
  `scene.environment` use `scene.environmentIntensity` (so `prepModel({ env })` is effectively a no-op).
- **Transmission glass** refracts the clear colour; with the post stack's clear alpha of 0 that is a white void —
  give scenes with glass a `scene.background` (or a backdrop mesh).
- **Dev server** runs with `hmr: false`: with many pages edited in parallel every save used to full-reload every tab.
- **Planar reflections** skip their first two frames so the shadow maps exist before the mirrored render.
- Meshy rigged characters: the idle preset can be broken (hip scale); the rigged GLB carries only base colour — reuse the
  static model's normal/roughness maps (same UV layout).
