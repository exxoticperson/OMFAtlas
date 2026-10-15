# Realism v2 (fakarny presentation)

## What changed

- **Clinical surface** presentation: enables **skin** (4 meshes) and **eyes & ears** (36 meshes) from BodyParts3D, plus muscles and soft tissue, with tuned PBR (sheen/transmission on skin, cornea/sclera tints on ocular parts, ear cartilage as soft tissue).
- **Teaching** presentation: original default layers (no skin/eyes/brain on first load).
- Toggle **Teaching | Clinical** in the layers panel, press **Full head** preset, or keyboard **`P`**.
- Keyboard **`?`** opens the shortcut list; **`Alt`+click** a structure to solo its layer.

## Performance

- The viewer **does not render when idle** (orbit damping budgeted; no 60fps spin on a static scene).
- **Clinical** preset skips **muscles** by default (175 meshes) — turn the muscle layer on when you need it.
- Vessels/nerves use lighter materials; skin/bone/teeth keep richer shading.

## Limits (important)

This is still **educational mesh data**, not photogrammetry or patient scans. BodyParts3D 4.0 is ~99% reduced; “photoreal” means **believable materials and lighting**, not new anatomy. Schematic nerves/vessels remain stylized. See `documentation/qa/MODEL-COVERAGE.md` for known omissions (tympanic chorda tympani, tonsils, etc.).

## References

- **BodyParts3D / CC BY 4.0** — same mesh lineage as [Astra Human Body Atlas](https://app.astra-ai.co/en-US/lab/human-body-3d) (credited in their UI).
- **Atlas color discipline:** Sobotta / Netter-style OMF plates (ivory bone, dry muscle, muted artery/vein/nerve) and specimen photography — saturated “diagram neon” avoided in **Clinical surface**.
- **Schematic OMF paths** (`schematic-anatomy.js`): wax-like tubes (matte nerve, satin artery, blue-grey vein), no emissive bloom in clinical mode — reads closer to a pro atlas than glowing CAD.
- **Astra comparison:** They win on full-body scope and polish shell; we target **head/neck + OMF schematics** with richer PBR on skin/eyes and honest schematic shading on nerves/vessels the source scan omits.
