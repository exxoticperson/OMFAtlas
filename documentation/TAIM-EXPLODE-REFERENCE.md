# Taim Human Atlas — explode UX reference (patterns only)

**Source:** [atlas.taim.best](https://atlas.taim.best/) — observed for fakarny OMF fork. No assets or code copied.

## What to borrow

| Pattern | Taim | OMF fork |
|---------|------|----------|
| Scene-first chrome | Flat panels, minimal blur, one accent | Refinement layer in `style.css` + `shell-compact` |
| Explode control | Bottom-centre slider, assembled ↔ spread | `#explode` + `explosion-layout.js` |
| Zoom vs explode | Orbit/zoom independent of spread amount | `tests/explosion-motion.test.mjs` guards |
| Inventory phase | High spread → spatial + searchable list | `INVENTORY_PERCENT` + sidebar browser |
| Labels | Stay readable during spread | Label pass in viewer frame loop |

## Interaction notes

- Spread is **layout**, not dissection order — same as upstream OMF copy.
- Wheel over **canvas** adjusts camera or spread per policy; wheel over **list** scrolls list.
- Reset returns spread to 0 and refits camera without disabling orbit.

## fakarny embed

Use `embed.html?ui=minimal&scene=head` — layers/details via floating buttons, not three persistent columns.
