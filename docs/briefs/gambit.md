# 12 · Gambit — "The Immortal Game, replayed in marble"
Brand: **Gambit** — makers of hand-carved marble chess sets and a members' chess salon.

## Signature interaction
Scroll replays **the Immortal Game** (Anderssen vs Kieseritzky, London 1851, 23 moves; hardcode the moves as from/to squares)
on a glossy marble board with planar reflections. Each scroll step plays one move: pieces slide with easing, knights arc
through the air, captured pieces topple, slide off and settle beside the board. The camera choreographs cinematically (low
angles near the action, overhead at key moments, the final mating net framed). A side column shows the notation with the
current move highlighted and one-line annotations ("Anderssen gives up both rooks"). After the replay, **free play**: drag
any piece (raycast pick, lift with shadow, snap to squares) — no chess engine needed.
Pieces: `models/gambit/{king,queen,bishop,knight,rook,pawn}.glb` are white Carrara marble. Make the black set from the same
models with a material transform (onBeforeCompile: remap base colour to nero marquina black with light/gold veins).
Knights must face the opponent.

## Page sections
Nav · Hero ("Some games are never finished.") · The replay (pinned, long) · The set (Carrara & Nero Marquina, walnut board,
€3,900) · The salon (members' evenings) · Footer.

## Art direction
Black, bone, brass `#b89b6a`. Fonts: "Bodoni Moda"/"Playfair Display" + "Inter". Low-key studio lighting, a strong key from
above-side, rim lights for silhouettes. Luxurious and cerebral.

## Must be true
A frame mid-game with a knight in mid-leap over the reflective board, dramatic light, looks like a luxury ad.
