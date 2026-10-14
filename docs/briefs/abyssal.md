# 02 · Abyssal — "Descend eleven thousand metres"
Brand: **Abyssal** — a private deep-ocean expedition house that takes 3 guests per dive to the Challenger Deep in the submersible *Pelagia*.

## Signature interaction
Scroll IS the descent. A fixed depth gauge counts 0 → 10,935 m (numbers roll like an instrument). The ocean changes
physically with depth: surface = bright turquoise with animated caustics dancing on everything and god-ray shafts from
the surface; 200 m twilight blue; 1,000 m black. Red/orange wavelengths fade first (tint materials/fog by depth).
From ~800 m the submersible's floodlights (VolumetricSpotEffect, 2–3 beams) are the only light and **the cursor steers
the floodlights** — you search the dark. Moving the cursor fast leaves a trail of bioluminescent plankton (additive
particles spawned along the pointer ray that flash cyan and fade).

## Scene & choreography
- The submersible (`models/abyssal/sub.glb`) descends with the camera, framed off-centre, slowly rotating, lights on.
- Zones (each a section with copy): Sunlight 0–200 m (nautilus `nautilus.glb` drifting), Twilight 200–1,000 m (procedural
  jellyfish: translucent bell shader + trailing tentacle lines, pulsing), Midnight 1,000–4,000 m (anglerfish `angler.glb`
  looms out of the dark — its lure is an emissive bulb + small point light; it turns toward the beam), Abyss
  4,000–6,000 m (hydrothermal vent `vent.glb` on the seabed with shimmering heat haze, rising mineral particles and a
  warm glow), Hadal 6,000–10,935 m (trench floor: silt, a lone marker beacon at the bottom).
- Marine snow: thousands of drifting particles that rush upward relative to the descending camera (speed = scroll speed).
- Fog colour/density driven by depth; seabed appears near the end.

## Page sections
Nav (Abyssal logo, Dives, Pelagia, Science, Book) · Hero ("The last unexplored place on Earth is 11 km down") · the 5
zones (each: depth range, temperature, pressure in atm, what you'll see) · "Pelagia" vessel specs with 3–4 hotspots
projected from the 3D sub (titanium sphere, 16 h life support, …) · Expedition pricing / dates · Crew & safety · Footer ("Surface").

## Art direction
Deep navy → absolute black; accents bioluminescent cyan `#3fd6c9` and the sub's safety orange. Fonts: "Space Grotesk"
display + "IBM Plex Mono" readouts. Instrument-panel UI: thin rules, tabular numbers.

## Must be true in screenshots
Surface frame glows with caustics and light shafts; midnight frame is black except beams, the anglerfish and its lure;
the vent frame has warm glow and haze. Readable depth gauge in every frame.
