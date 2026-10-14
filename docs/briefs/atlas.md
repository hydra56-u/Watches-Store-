# 13 · Atlas of Drifting Isles — "Travel between floating islands"
Brand: **Atlas of Drifting Isles** — a whimsical sky-travel agency (airship tours) for a fantasy archipelago.

## Signature interaction
Four floating islands (`models/atlas/{lighthouse,falls,pagoda,windmill}.glb`, stylised hand-painted) drift in an endless sky
of soft layered clouds. **Click an island (or a map dot) and the camera flies there** along a curved path through the clouds
(banking, FOV breathing), then orbits it gently while its destination panel slides in. Scroll also advances the tour island to
island. Islands bob; waterfalls pour off edges (particle streams + mist); birds flock between islands (boids, instanced);
a procedural airship crosses the sky. Hover an island → soft rim glow and a label pin.
Clouds: many soft sprite billboards with depth-fade (soft particles) or a raymarched layer — must look soft and volumetric,
never like flat cards. Sky gradient with a warm sun and atmospheric haze.

## Page sections
Nav · Hero ("The map is not the territory. The territory floats.") · 4 destination sections (name, "3 h from Port Aubade",
highlights, price) · The airship fleet · Booking CTA · Footer.

## Art direction
Soft sky blue `#7cc4ff`, peach, cream; storybook but premium. Fonts: "Young Serif" + "Nunito Sans". Lighting that respects the
painted textures (lower env, soft key, gentle rim).

## Must be true
Hero: all four islands in a luminous cloudscape with depth; a fly-to frame mid-bank through clouds.
