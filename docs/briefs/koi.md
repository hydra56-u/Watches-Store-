# 05 · Still Water — "Touch the pond"
Brand: **Still Water** — a seven-room ryokan in Kyoto built around a 200-year-old koi pond.

## Signature interaction
Top-down (slightly tilted) koi pond filling the viewport with a **real-time GPGPU ripple simulation** (height-field wave
equation in ping-pong float render targets, ~512²). The cursor drags through the water leaving wakes; clicking drops a food
pellet (splash + ring ripple) and the koi turn and swim to it (steering: wander, separation, seek).
- Koi: `models/koi/kohaku.glb` and `showa.glb`, 6–10 instances with vertex-shader body undulation (sine wave along the body's
  long axis, amplitude growing toward the tail; tail flicks harder when swimming fast). Render them below the surface so they
  are refracted and darkened by depth.
- Water: refraction of the pond floor (dark river stones + sand, procedural) using the ripple normals, fresnel sky reflection
  with overhanging maple silhouettes (you may generate a plate), sun glints, caustics on the floor.
- Floating: lotus `lotus.glb` bobbing with the ripples; maple leaves that fall, land, spin and float.
- Stone lantern `lantern.glb` on a rock at the pond edge; moss.

## Page sections
Nav · Hero ("Seven rooms. One pond. No clocks.") · The rooms (3 cards: Moss, Maple, Moon, from ¥68,000) · Kaiseki & tea ·
The seasons at Still Water · Booking CTA · Footer. As you scroll the camera drifts across the pond.

## Art direction
Ink-green water, vermilion `#e0503a` accents, washi paper `#f3efe6` panels. Fonts: "Shippori Mincho" + "Zen Kaku Gothic New";
small vertical Japanese text accents. Quiet, meditative motion.

## Must be true
The hero shot looks like a photograph of a real pond with koi under rippling water.
