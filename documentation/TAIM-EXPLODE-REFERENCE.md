# Taim explode reference (Human Atlas)

Reference site: [https://atlas.taim.best/](https://atlas.taim.best/)  
Upstream interaction model: [ashemag/human-atlas](https://github.com/ashemag/human-atlas) (MIT), documented in `documentation/qa/REFERENCE-UX.md`.

This note is what OMF Atlas copied or adapted for separation UX, 3D presentation, and studio chrome—not a pixel-perfect clone of Taim branding.

## What the reference does

### Assembly slider (0–100%)

- **0–45%:** Each anatomical *system* moves on a fixed bearing (angle from system index). Parts in the same system share the same offset. Vertical stretch grows around a body pivot (~28% of height above pivot at 45%). Radial reach at end of phase: **0.48** scene units in the reference; OMF uses **0.095** scaled to the smaller head model.
- **45–100%:** Every visible mesh interpolates from its separated position to a **frontal inventory cell** (depth flattened toward the layout plane). Packing uses projected X/Y bounds, minimum extent, padding, shelf rows sorted by height, target width from total area and viewport aspect.
- **100%:** Non-overlapping cells for all *visible* meshes only; picking uses screen-space bounds when raycast misses (16px mouse / 24px touch).

### Camera and controls

- Perspective FOV ~34°, damped orbit (damping ~0.085), distance limits tuned to body scale.
- Above ~50% explosion, camera tends toward **front** for inventory readability.
- At high separation, **left drag pans** the flat layout; orbit moves to secondary button (reference disables rotate above ~80%; OMF keeps rotate on right mouse / keeps all gestures enabled via `explosionControls()`).
- Auto-fit reserves space for chrome (layers, dock, inspector)—OMF implements `freeBand()` + `bandShift` in `viewer.js`.

### Rendering (reference bundle)

- Clear color ~`#f2f3f3`, **ACES filmic** tone mapping, exposure ~1.12.
- **RoomEnvironment** PMREM for image-based lighting; hemisphere + two directionals.
- Pixel ratio: `min(devicePixelRatio, 1.5 on small viewports else 2)`.
- Selection: mint/teal tint blended into system color.

### Studio UI (reference)

- Inter/system sans, light neutral stage, flat panels (white / soft gray), restrained shadows.
- Bottom dock: “Explode anatomy” / “Assembled” ↔ “Every piece”, percentage output.
- Systems panel, search, non-modal details sheet; inventory is spatial in 3D, not a list-only view (OMF adds a **parts inventory list at ≥95%** as an extension).

## OMF Atlas mapping

| Concern | Module | Notes |
|--------|--------|--------|
| Two-stage offsets + packing | `src/explosion-layout.js` | `SEPARATION_END = 0.45`, `explosionPhases()` with smoothstep, `explodedOffset()`, centred tissue rows + `BLOCK_GAP`. |
| Control policy | `explosion-layout.js` | `explosionControls()`, `FLAT_LAYOUT_PERCENT = 80`. |
| Stage labels / list threshold | `explosion-layout.js`, `main.js` | `explosionStage()`, `INVENTORY_PERCENT = 95`. |
| Damped slider motion, markers, IBL, tone map, pixel budget | `src/viewer.js` | `shown` vs `explosion`, `followExplosion`, inventory centre dots >75%, ACES + RoomEnvironment. |
| Chrome / typography | `src/style.css`, `main.js` | Refinement layer: flat panels, sentence-case labels, cobalt accent palette block; removed eyebrow/live-dot. |
| Tests | `tests/explosion.test.mjs`, `tests/explosion-motion.test.mjs` | Overlap packing, tissue blocks, control policy, continuous motion. |

## Intentional differences from Taim

- **Scale and content:** OMF head/neck dental atlas (BodyParts3D + schematic layers), not full-body 2,234-piece male atlas.
- **Wheel ↔ separation:** OMF may still tie zoom-out to separation in `viewer.js` in some modes; tests assert zoom does not *write* separation in the current embed MVP policy—verify in product if wheel-driven explode is desired (see `REFERENCE-UX.md` “Proposed wheel progression”).
- **Teaching modes:** Tooth cutaway, dental tabs, age dentition—unchanged; separation disabled when dental/isolated.
- **UI copy:** “Separate structures” / “Parts inventory” rather than “Explode anatomy”.

## Manual check URLs

After `npm run dev` or `npm run build` + preview (ports may shift if busy):

| Surface | Typical URL |
|---------|-------------|
| Main studio | `http://127.0.0.1:3016/` (dev script default) |
| Embed | `http://127.0.0.1:3016/embed.html` |
| Preview (after build) | `http://127.0.0.1:3016/` via `npm run preview` |

**Suggested checks:** slider 0 → 45 → 100; inventory list opens ≥95%; pan at 100% with left drag; reassemble; light/dark theme; resize reflow.

## Related docs

- `documentation/qa/REFERENCE-UX.md` — source-level Human Atlas interaction inventory.
- `documentation/screenshots/separation.png` — OMF separation screenshot (may predate this pass).
