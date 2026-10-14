# 04 · Bell & Moss — "Wipe the glass. Meet the world inside."
Brand: **Bell & Moss** — a London studio building sealed glass-cloche terrariums that live for decades without watering.

## Signature interaction
A hand-blown glass cloche (procedural LatheGeometry bell with a knob; MeshPhysicalMaterial transmission, thickness, ior 1.5,
slight dispersion) covers a living miniature world. **The inside of the glass is fogged with condensation and the cursor
wipes it clear**: raycast the cloche, paint the hit UVs into a canvas/render-target mask; the mask drives glass roughness
and a milky condensation tint (fogged = frosted, wiped = crystal clear) plus a droplet normal map; the fog slowly re-forms
over ~8 s; droplets bead at wiped edges and run down. It must be obvious and satisfying.
- **Three climates**: moss forest (`models/terrarium/moss.glb`), desert (`desert.glb`), tropical (`tropic.glb`). Switching lifts
  the cloche (animated), the walnut base turns, the world swaps, the cloche descends and fogs over again.
- Tiny floating spores/fireflies inside; soft window light from the left with a real shadow, gentle AO.

## Page sections
Nav · Hero ("A whole climate under glass. Water it once, in 2031.") · Climates (3 tabs driving the 3D) · "Inside the glass":
exploded layer diagram — on scroll the world lifts and procedural layers separate below it (drainage stones, charcoal, mesh,
soil, moss) with labels · Care ("Light: bright, indirect. Water: never.") · Shop (3 terrariums £240–£680) · Footer.

## Art direction
Warm linen `#efe9dd`, sage and moss greens, walnut. Fonts: "Fraunces" (soft serif display) + "Manrope".
Soft, calm, tactile — the opposite of the dark pages.

## Must be true
A frame showing a fogged cloche with one clear wiped streak revealing the moss world is the hero shot.
