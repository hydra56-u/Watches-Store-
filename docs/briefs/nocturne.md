# 18 · Nocturne — "A fragrance you can pour"
Brand: **Nocturne** — an extrait de parfum ("No. 9, Iris & Oud") from a small Grasse house.

## Signature interaction
A heavy faceted glass flacon (procedural: bevelled box or faceted lathe; MeshPhysicalMaterial transmission, thickness, ior 1.5,
dispersion, attenuation colour) with the cap `models/nocturne/cap.glb`, **full of amber liquid that behaves like liquid**: drag
to tilt/rotate the bottle; the liquid surface stays level in world space and sloshes with a damped spring wobble driven by
angular velocity (classic liquid shader: discard above a world-space plane with wobble; back faces drawn as the liquid top;
fresnel rim/meniscus). Caustic light pools on the black marble floor. **Scroll: the notes arrive** — iris (`iris.glb`),
bergamot (`bergamot.glb`), vanilla (`vanilla.glb`), oud (`oud.glb`) each float in beside the bottle in its own section, then
dissolve into glowing golden particles (`sampleSurface`) that stream into the bottle, raising the liquid level.

## Page sections
Nav · Hero ("Nocturne No. 9 — iris, bergamot, vanilla, oud.") · Top / Heart / Base notes · The house (Grasse, since 1911) ·
Discovery set & 50 ml (€290) · Footer.

## Art direction
Black, champagne gold `#d8b56a`, deep amber. Fonts: "Bodoni Moda"/"Italiana" + "Hanken Grotesk". Studio product lighting:
strip softboxes giving long vertical highlights on the glass (studioEnvironment with tall panels).

## Must be true
Hero: the glass bottle with believable refraction, gold highlights and liquid; a frame where golden particles stream into it.
