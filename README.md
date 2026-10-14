# Dioramas

**A free, open-source framework for cinematic, interactive 3D websites — with AI-generated hero assets.**

Dioramas is a way of building landing pages where the 3D scene *is* the page: a hyper-detailed object, real lighting,
a choreographed camera, and one interaction you can touch. It ships with **20 complete example sites** built with it.

Everything is free. No paid tier, no account, no CLI to install.

![The twenty examples](docs/media/all-1.jpg)
![The twenty examples](docs/media/all-2.jpg)

## The framework

Dioramas is three layers that work together:

### 1. Asset pipeline — prompt → image → 3D model
Hero objects are generated, not modelled:

1. **Nano Banana 2** (on [fal](https://fal.ai)) renders a clean product plate of the object on white.
2. **Meshy 7.1 image-to-3D** (on fal) turns it into a 60k–250k-triangle PBR model at 4K geometry (optionally rigged + animated).
3. **`scripts/optimize.mjs`** welds, compresses (meshopt) and converts textures to WebP — a 25 MB raw model becomes 3–8 MB.

```bash
cp .env.example .env            # add your FAL_KEY
node scripts/gen.mjs all assets/jobs/<your-job>.json   # images + meshes (resumable)
node scripts/optimize-all.mjs                          # → public/models/<example>/
```
Every prompt used for the 20 examples is in `assets/jobs/` and `assets/manifest.json`. A textured model costs about $1.20; the
whole collection (65 models, 111 images) cost roughly $90.

### 2. Engine — `src/core/`
A small three.js layer that makes generated models look expensive:
HDR post stack (N8AO ambient occlusion, mip-chain bloom, AgX tone mapping, grain, vignette), raymarched **volumetric
spotlights**, **planar reflections** with roughness blur, GPU-baked procedural textures, Lenis + GSAP scroll choreography,
custom cursor, preloader and cross-site navigation. See [`docs/ENGINE.md`](docs/ENGINE.md).

### 3. Method — brief → build → review → revise
Each example started as a one-page brief (`docs/briefs/`) and was built by an AI coding agent against the engine, then
iterated with a headless-GPU screenshot battery (`scripts/review.mjs`) and a brutal art-direction review until every scroll
stop was a composed frame. Hand a brief plus `docs/ENGINE.md` to your agent to build your own world, or re-theme an example.

## The 20 examples

| | Example | Signature interaction |
|---|---|---|
| 01 | Reliquary | Explore a dark museum by lantern; photograph relics to light them |
| 02 | Abyssal | Scroll is an 11 km dive; steer the submersible's floodlights |
| 03 | Hammer & Ember | Scroll heats a damascus blade; click to strike sparks |
| 04 | Bell & Moss | Wipe condensation off a glass cloche |
| 05 | Still Water | A koi pond with real ripple simulation; feed the fish |
| 06 | Florae | 200k-particle flowers that morph and scatter in your breeze |
| 07 | Velocity Lab | An X-ray / thermal / CAD lens that sees through a shoe |
| 08 | Hangar Nine | Press and hold to power up a mech |
| 09 | Maison Sucre | Real physics with photoreal pastries |
| 10 | Monolith | Drag the sun across a cliff house |
| 11 | Low Frequency | Play and scratch a record (synthesized audio) |
| 12 | Gambit | The Immortal Game replayed on scroll, then free play |
| 13 | Atlas of Drifting Isles | Fly between floating islands |
| 14 | Lithos | Press and hold to crack a geode open |
| 15 | Artemis | Scroll to walk a rigged astronaut on the Moon |
| 16 | The Keeper | Aim a lighthouse beam through a storm |
| 17 | Kōen | One bonsai through four seasons |
| 18 | Nocturne | A perfume bottle with sloshing liquid |
| 19 | Nightshift Motor Co. | Hold to rev a café racer in the rain |
| 20 | Aurel Horologie | Take a watch movement apart |

<p>
<img src="docs/media/reliquary.jpg" width="49%"> <img src="docs/media/hangar.jpg" width="49%">
<img src="docs/media/lithos.jpg" width="49%"> <img src="docs/media/sucre.jpg" width="49%">
<img src="docs/media/keeper.jpg" width="49%"> <img src="docs/media/abyssal.jpg" width="49%">
<img src="docs/media/florae.jpg" width="49%"> <img src="docs/media/velocity.jpg" width="49%">
<img src="docs/media/koi.jpg" width="49%"> <img src="docs/media/nocturne.jpg" width="49%">
<img src="docs/media/monolith.jpg" width="49%"> <img src="docs/media/racer.jpg" width="49%">
</p>

## Run it

```bash
git clone https://github.com/blendi-remade/dioramas && cd dioramas
npm install
npm run dev        # http://127.0.0.1:5190 — the gallery; each example at /examples/<name>/
```
Models ship in the repo (plain git, ~330 MB, no LFS). A desktop GPU is recommended; everything is tuned for 60 fps.

## Layout
```
examples/<name>/   the 20 example sites (index.html, main.js, style.css)
src/core/          the engine
src/index/         the gallery
scripts/           asset pipeline + QA (gen, optimize, shot, review, thumbs)
assets/jobs/       every prompt used to generate the assets
public/models/     optimized GLBs     docs/   engine guide, briefs, media
```

## License
Code is MIT. Generated models and images are released under CC BY 4.0 — see [`ASSET-LICENSES.md`](ASSET-LICENSES.md).
Third-party libraries keep their own licenses — see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
