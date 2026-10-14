# 09 · Maison Sucre — "A patisserie with gravity"
Brand: **Maison Sucre** — a Parisian patisserie famous for its macarons.

## Signature interaction
Real physics (Rapier: `import RAPIER from '@dimforge/rapier3d-compat'; await RAPIER.init()`). Pastries rain onto a pale pink
marble counter and pile up with believable bounces: pink & pistachio macarons (`models/sucre/macaron.glb`, `macaron2.glb`),
strawberries (`strawberry.glb`), croissants (`croissant.glb`), tarts (`tart.glb`). InstancedMesh per type, simplified
colliders (cylinder for macarons, ball for strawberries, capsule/convex hull for croissants). **The cursor is a kinematic body
that nudges them** (an invisible sphere following the pointer on the counter plane); click-drag picks one up (spring) and you
can toss it. "Build a box": drop 6 macarons into a gift box (procedural box with slots) — filled slots snap and the box closes
with a ribbon when full (counter + CTA "Order this box — €24"). The hero centrepiece: the tiered cake (`cake.glb`) slowly
turning on its stand, lit like a magazine cover.

## Page sections
Nav · Hero ("Sugar, almonds, and a little gravity.") · La Carte (menu; hovering an item makes it hop on the counter) ·
Build a box (interactive) · L'Atelier (story, since 1962, rue du Bac) · Visit (hours, address) · Footer.

## Art direction
Pastel pink `#f6d9df`, pistachio, cream, gold foil. Fonts: "Playfair Display" italic + "DM Sans". Soft daylight, soft shadows,
subtle depth of field. Joyful, tactile, pristine.

## Must be true
A frame with a delightful pile of photoreal macarons and strawberries on marble, mid-bounce, that makes you hungry.
Keep 60 fps: ≤120 bodies; simplify meshes if needed (`node scripts/optimize.mjs assets/raw/sucre-x.glb public/models/sucre/x-lo.glb --ratio 0.3 --tex 1024`).
