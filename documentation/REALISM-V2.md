# Realism v2 (fakarny presentation)

## What changed

- **Clinical surface** presentation: enables **skin** (4 meshes) and **eyes & ears** (36 meshes) from BodyParts3D, plus muscles and soft tissue, with tuned PBR (sheen/transmission on skin, cornea/sclera tints on ocular parts, ear cartilage as soft tissue).
- **Teaching** presentation: original default layers (no skin/eyes/brain on first load).
- Toggle **Teaching | Clinical** in the layers panel, or press **Full head** preset.

## Limits (important)

This is still **educational mesh data**, not photogrammetry or patient scans. BodyParts3D 4.0 is ~99% reduced; “photoreal” means **believable materials and lighting**, not new anatomy. Schematic nerves/vessels remain stylized. See `documentation/qa/MODEL-COVERAGE.md` for known omissions (tympanic chorda tympani, tonsils, etc.).

## References

- BodyParts3D / CC BY 4.0 — base meshes
- Material tuning informed by clinical atlas presentation (specimen + studio lighting), not copied assets from third-party apps
