# 06 · Florae — "Two hundred thousand petals, one gesture"
Brand: **Florae** — a botanical archive and flower atelier that sends one extraordinary specimen per month.

## Signature interaction
A GPGPU particle sculpture (≥150k particles; `sampleSurface()` on each Meshy model for positions + texture colours).
Scroll morphs between specimens: rose (`models/florae/rose.glb`) → king protea (`protea.glb`) → phalaenopsis orchid
(`orchid.glb`) → blue morpho butterfly (`morpho.glb`, whose wings then flap: rotate particles by wing side). Transitions
are not linear lerps: particles lift into a curl-noise wind, swirl, and settle into the new form (stagger by per-particle
seed). **The cursor is a breeze**: particles near the pointer ray are pushed away and spring back (GPGPU velocity texture or
analytic displacement). Click = a gust that scatters the flower, which then re-blooms.
Soft round particles, size by depth + faux depth-of-field (bigger, fainter out of focus). Colours from the textures,
slightly lifted, on a pale background — pointillist and luminous, not neon.

## Page sections
Nav · Hero (the rose, "Florae — a flower a month, from the edge of the map.") · 4 specimen sections, each with a specimen
label (Latin name, origin, bloom season, notes) pinned while the morph completes · "The archive" (next months) ·
Subscription (€48/month, 3 tiers) · Footer.

## Art direction
Warm cream `#f4efe6`, deep crimson `#d6456b`, ink. Fonts: "Cormorant"/"EB Garamond" italics + "Inter Tight".
Editorial botanical-plate feel, generous whitespace.

## Must be true
Hero: a rose made of glowing points that is clearly a rose, with depth; a mid-morph frame is a swirl of petals.
