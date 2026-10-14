# 15 · Artemis — "Scroll to walk on the Moon"
Brand: **Artemis** — lunar tourism: a seven-day stay at a south-pole outpost.

## Signature interaction
**Scroll to walk.** The astronaut was generated rigged by Meshy. Check `assets/manifest.json` (meshes["artemis-astro"]) and the
raw GLBs: `assets/raw/artemis-astro.glb` may be the static mesh; the rigged + animated files are separate URLs in the fal
result (`rigged_character_glb`, `animation_glb`, `basic_animations` with walking/running). If they are not downloaded yet,
fetch them with a small node script using `scripts/fal.mjs`'s `fal.queue.result('meshy/v7.1/image-to-3d', { requestId })`
(request id is in the manifest) and save to `assets/raw/`. Optimise without simplify (`node scripts/optimize.mjs in out`)
and verify animations survive (`npx gltf-transform inspect`).
Tie the walk cycle to scroll velocity (AnimationMixer timeScale ∝ scroll speed; crossfade to idle when still); the astronaut
advances across the regolith with a low-gravity bounce. **Footprints** are stamped where each foot lands (decals or a
render-target normal painter on the terrain). Dust kicks up in slow ballistic arcs (1/6 g, no drag, no billowing). Harsh single
sun, pitch-black sky with Earth over the horizon (procedural Earth shader with clouds + atmosphere rim, or an NB2 plate), very
long black shadows, only faint earthshine fill. Terrain: large displaced plane with craters and instanced rocks.
The lander (`lander.glb`) appears as the destination.

## Page sections
Nav · Hero ("One small step, repeated 40,000 times.") · The walk (pinned long scroll) · The outpost · The seven days
(itinerary timeline) · Training & medical · Price ("$4.2M, all-inclusive") · Footer.

## Art direction
Stark greyscale, pure black, white, one accent: suit orange. Fonts: "Space Grotesk" + "Barlow Condensed" mission readouts.
NASA-archival meets Apple.

## Must be true
Walking frame: astronaut mid-stride, footprints trailing, long shadow, Earth in the black sky.
