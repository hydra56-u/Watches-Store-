# 11 · Low Frequency — "Put your hand on the record"
Brand: **Low Frequency** — a Tokyo-style listening bar and record label.

## Signature interaction
A turntable (`models/lowfreq/turntable.glb`) you can play. Overlay a procedural vinyl record (fine grooves: anisotropic-looking
rotating radial highlight, printed label) and animate it. **Press play → the record spins up and music plays**: synthesize an
original lo-fi house/jazz loop in WebAudio (kick, snare, hats, bass, Rhodes-like chords) rendered into an AudioBuffer via
OfflineAudioContext, played by an AudioBufferSourceNode. **Drag the record to scratch**: playbackRate follows drag angular
velocity (backward via a reversed-buffer swap), releasing lets it spin back up. Audio-reactive visuals from an AnalyserNode:
the speaker (`speaker.glb`) woofer pulses, room light breathes, dust in the light beam dances, a circular spectrum ring around
the platter. The muted/no-audio state must still look alive (idle spin + fake spectrum).

## Scene
A dim listening bar: wall of records (procedural sleeves with generated cover art — you may generate a few NB2 covers),
warm tube-amp glow, a single warm spotlight over the deck, haze. Purple/amber night palette.

## Page sections
Nav · Hero ("Put your hand on the record.") · This week's pressing (tracklist with play buttons that cue the deck) ·
The bar (hours, 12 seats, "no phones on the counter") · Label catalogue (sleeves that tilt on hover) · Record club
membership · Footer.

## Art direction
Near-black aubergine, amber, lavender `#a78bfa`. Fonts: "Syne"/"Unbounded" + "Space Mono". Grainy, analog.

## Must be true
Hero: moody close-up of the spinning record under a warm spotlight with the spectrum ring; UI clearly invites "drag to scratch".
