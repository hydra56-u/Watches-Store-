# 08 · Hangar Nine — "Power up a forty-ton machine"
Brand: **Hangar Nine** — a (fictional) mech manufacturer's recruitment site for its test-pilot program.

## Signature interaction
**Press and hold to power up.** The hangar starts almost black (the mech `models/hangar/mech.glb` barely visible, rim-lit by
emergency red strobes). Holding mouse/space fills a radial "INITIATE" gauge; on completion: overhead floodlights clank on bay
by bay (VolumetricSpotEffect beams, dust in the beams), the cockpit visor glows, steam bursts from vents, a HUD overlay boots
(scan line sweep, reticles, readouts), and a **scan plane** travels up the mech revealing a glowing hologram/wire overlay on the
mesh (shader using world height; barycentric-free wire via fwidth of a triplanar grid is fine). After power-up the scroll orbits
the camera around the mech with hotspots (Reactor, Actuators, Armour, Weapons) projected from 3D. The drone (`drone.glb`)
circles with its own sweeping spotlight.

## Scene
Industrial hangar: procedural gantries, catwalks, hazard-striped floor markings, reflective wet concrete (PlanarReflection),
fog, welding sparks from a gantry arm.

## Page sections
Nav · Hero ("HN-9 'Warden'. Forty tons. One pilot.") · Power-up · Specifications (hotspots) · Stats (height 11.4 m, reactor
42 MW, top speed 68 km/h) · Test-pilot program application CTA · Footer.

## Art direction
Gunmetal, fog grey, hazard amber `#ffb000`, sparing HUD cyan. Fonts: "Chakra Petch"/"Rajdhani" + "Share Tech Mono".
Cinematic — Titanfall / Pacific Rim title sequences.

## Must be true
Powered frame: towering mech under crossing volumetric floodlights, reflections on the floor, HUD overlay. Pre-power frame:
moody black with red strobes and the hold hint.
