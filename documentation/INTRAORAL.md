# Intra-oral tab

Clinical mirror framing for the oral cavity.

## Surface (one control)

| Value | Behaviour |
|-------|-----------|
| **CBCT · Open-Full-Jaw** | Patient jaws when `public/models/dental/open-full-jaw.bin` is installed; else atlas fallback |
| **CBCT · ToothFairy3** | Full scan dentition when `toothfairy.bin` is installed |
| **Atlas · BodyParts3D** | Teeth, gingiva, soft tissue, alveolar bones only |

Install buffers: `node scripts/import-dental-models.mjs` (and `import-toothfairy.mjs` if needed).

## Performance

- Oral materials update on **selection / layer / model changes**, not every frame (`oralLookKey` in `src/intraoral.js`).
- Camera presets **ease** into place (~450 ms).
- High-res BP3D swaps only for **shipped** bins (`SHIPPED_HR_PART_IDS`).

## Views

Occlusal · Lingual · Buccal — controls above the viewer.

## Embed

`embed.html?scene=intraoral&ui=minimal`
