# 14 · Lithos — "Crack the stone open"
Brand: **Lithos** — a gallery of museum-grade mineral specimens and a fine-jewellery line cut from them.

## Signature interaction
**Crack the geode.** A closed rough geode sits on black velvet: build it from two copies of `models/lithos/geode.glb` (a cut
half, cavity facing up) — the top one mirrored/flipped so the cut faces meet. Press-and-hold: hairline cracks glow violet along
the seam (shader + falling dust particles), the stone trembles, then splits: the top half lifts and turns away revealing the
amethyst cavity sparkling (glint shader: high-frequency noise × specular × view dependence → twinkling facets; bloom).
Then scroll through the collection: clear quartz cluster (`quartz.glb`; blend its material toward MeshPhysicalMaterial
transmission + dispersion + iridescence so it reads as real crystal), pyrite (`pyrite.glb`, mirror metal with sharp studio
reflections), ammonite (`ammonite.glb`, thin-film iridescence). **The cursor is a light**: moving it orbits a small point light
around the specimen producing moving glints and shadows.

## Page sections
Nav · Hero ("Four billion years of patience.") · Crack · The collection (4 specimens: locality, age, weight, price) ·
Jewellery (2–3 NB2 product photos) · Provenance & ethics · Footer.

## Art direction
Velvet black, amethyst violet `#9d6bff`, platinum. Fonts: "Cinzel"/"Italiana" + "Jost". Museum vitrine lighting: small hard key
+ softbox, deep shadow.

## Must be true
The opened-geode frame with glittering amethyst is jaw-dropping; the quartz frame looks like real glassy crystal, not plastic.
