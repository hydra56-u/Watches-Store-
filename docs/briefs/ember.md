# 03 · Hammer & Ember — "Heat the blade. Strike the steel."
Brand: **Hammer & Ember** — a two-person bladesmith atelier forging pattern-welded (damascus) swords to commission.

## Signature interaction
The Viking sword (`models/ember/sword.glb`) lies across the anvil (`anvil.glb`) in a dark smithy lit by a coal forge.
- **Scroll heats the steel**: patch the sword's material (onBeforeCompile) to add blackbody emission — heat spreads from
  the tip region toward the guard with noise-broken edges: dull red → cherry → orange → yellow-white (proper blackbody
  ramp, HDR emission so bloom catches it), plus heat shimmer (screen-space distortion above the hot zone) and glowing scale flakes.
- **Click to strike**: the hammer (`hammer.glb`) swings down on the hot spot (anticipation → impact), a burst of GPU spark
  particles (hundreds, stretched along velocity, gravity + floor bounce, cooling colour), camera shake, a flash of light
  on the walls, a synthesized metallic clang (WebAudio, optional, mute toggle). Counter "folds: 3/512".
- **Hold to pump the bellows**: the forge coals brighten, embers roar upward, heat spreads faster.
- End of scroll: the quench — steam billows (soft particle sprites), heat dies out and the cooled blade shows its damascus pattern.

## Scene
Stone/brick forge with glowing coals (emissive animated noise, flickering orange point lights, one shadow-casting),
tools on the wall catching rim light, embers always drifting upward. Soot-dark floor.

## Page sections
Nav · Hero ("Every blade is folded 512 times. None are made twice.") · The process (Fold / Forge / Quench / Polish, each a
camera state around the anvil) · The steel (layer count, carbon %, hardness HRC 58–60, big numbers) · Commissions
(blade types & price from €4,800) · Testimonials · Footer.

## Art direction
Black and soot, molten orange `#ff6a1f`, bone white. Fonts: a condensed display ("Oswald"/"Bebas Neue") + "Crimson Pro".
Grain and heat glow. Must feel heavy, hot and loud even when silent.

## Must be true
A mid-scroll frame where the blade glows orange-white on the anvil with sparks in the air is poster-worthy.
