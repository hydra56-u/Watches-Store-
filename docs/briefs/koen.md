# 17 · Kōen — "One tree, four seasons"
Brand: **Kōen** — a bonsai nursery in Saitama with trees older than the country's railways.

## Signature interaction
A Japanese maple bonsai (`models/koen/maple.glb`). **Scroll (and a draggable season dial) turns the year**: spring (fresh lime
leaves + a few falling blossoms), summer (deep green, haze), autumn (foliage turns crimson/orange — a shader hue remap that
affects only foliage-coloured texels; leaves fall as instanced particles with tumbling motion and pile on the moss), winter
(leaves dissolve via a noise threshold leaving the branch structure — check what's under the foliage in the mesh; if there is
little, fake it with sparse foliage + procedural twig lines; snow accumulates on top-facing surfaces via a normal·up shader;
snowfall particles). Background colour, light temperature, shadow softness and ambient particles change per season. Hovering
the tree: a soft breeze (vertex sway on foliage by height).

## Page sections
Nav · Hero ("This tree has seen 180 autumns.") · Four seasons (pinned, with vertical labels 春 夏 秋 冬) · The nursery (trees for
adoption with age & price, ¥380,000+) · The craft (pruning, wiring, repotting) · Visit · Footer.

## Art direction
Washi paper `#f1ece2`, sumi ink, seasonal accents (autumn `#d2553b`). Fonts: "Noto Serif JP" + "Cormorant Garamond". Ink-brush
SVG dividers. Extremely restrained, meditative.

## Must be true
Autumn frame: crimson canopy with leaves falling onto moss, soft side light; winter frame: bare branches with snow.
