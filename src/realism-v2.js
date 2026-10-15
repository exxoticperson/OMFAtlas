/**
 * v2 presentation: teaching (layer defaults) vs clinical (skin, eyes, richer PBR).
 * Geometry stays BodyParts3D + schematics — this module only adjusts look and presets.
 */

export const PRESENTATIONS = {
  teaching: {
    label: "Teaching",
    layers: [
      "bones",
      "teeth",
      "gingiva",
      "neck",
      "arteries",
      "veins",
      "nerves",
      "glands",
      "soft",
      "airway",
    ],
  },
  clinical: {
    label: "Clinical surface",
    // Muscles off by default — 175 meshes; toggle in Layers when needed.
    layers: [
      "skin",
      "eyes",
      "bones",
      "teeth",
      "gingiva",
      "neck",
      "soft",
      "airway",
      "glands",
    ],
  },
};

/** Muted, specimen-lab palette (not saturated “medical app” primaries). */
export const GROUP_COLORS_V2 = {
  bones: "#e8e0d4",
  neck: "#d8d2c4",
  teeth: "#f5f0e6",
  gingiva: "#c97b82",
  soft: "#b85c66",
  glands: "#c4a574",
  muscles: "#9e4545",
  arteries: "#c04a42",
  veins: "#4a6a9a",
  nerves: "#d4a832",
  brain: "#c9b0aa",
  eyes: "#8fa8a6",
  airway: "#b88278",
  skin: "#c4a088",
};

const name = (part) => String(part?.name || "").toLowerCase();

export function surfaceKind(part) {
  const group = part.group;
  const n = name(part);
  if (group === "skin") return "skin";
  if (group === "eyes") {
    if (/cornea|lens|iris|pupil/.test(n)) return "cornea";
    if (/sclera|conjunctiva/.test(n)) return "sclera";
    if (/ear|auricle|pinna|cochlea|vestibul|tympanic|auditory/.test(n)) return "ear";
    return "eye";
  }
  if (group === "bones" || group === "neck") return "bone";
  if (group === "teeth") return "enamel";
  if (group === "arteries" || group === "veins" || group === "nerves") return "vessel";
  return "tissue";
}

export const SURFACE_FINISH_V2 = {
  bone: {
    roughness: 0.58,
    clearcoat: 0.04,
    clearcoatRoughness: 0.62,
    envMapIntensity: 0.75,
  },
  enamel: {
    roughness: 0.22,
    clearcoat: 0.72,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.15,
  },
  tissue: {
    roughness: 0.5,
    clearcoat: 0.22,
    clearcoatRoughness: 0.38,
    sheen: 0.42,
    sheenRoughness: 0.52,
    sheenColor: "#ffd0c4",
    envMapIntensity: 0.8,
  },
  skin: {
    roughness: 0.55,
    clearcoat: 0.06,
    clearcoatRoughness: 0.45,
    sheen: 0.55,
    sheenRoughness: 0.65,
    sheenColor: "#ffb89a",
    transmission: 0.06,
    thickness: 0.35,
    envMapIntensity: 0.65,
  },
  vessel: {
    roughness: 0.34,
    clearcoat: 0.48,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.95,
  },
  eye: {
    roughness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.1,
  },
  sclera: {
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.9,
  },
  cornea: {
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transmission: 0.12,
    thickness: 0.15,
    envMapIntensity: 1.25,
  },
  ear: {
    roughness: 0.48,
    clearcoat: 0.18,
    clearcoatRoughness: 0.32,
    sheen: 0.28,
    sheenColor: "#e8c4b0",
    envMapIntensity: 0.7,
  },
};

export function partColor(part, groups, { presentation = "clinical", selected = false } = {}) {
  if (selected) return presentation === "clinical" ? "#c9a227" : "#5b86ee";
  const palette = presentation === "clinical" ? GROUP_COLORS_V2 : null;
  const base = palette?.[part.group] ?? groups[part.group]?.color ?? "#cccccc";
  const n = name(part);
  if (part.group === "eyes") {
    if (/cornea|lens/.test(n)) return "#e8f4ff";
    if (/iris/.test(n)) return "#4a6a5a";
    if (/sclera/.test(n)) return "#f2f0eb";
  }
  if (part.group === "skin") return "#c4a088";
  return base;
}

export function applyFinishToMaterial(material, part, { schematic = false, presentation = "clinical" } = {}) {
  const kind = surfaceKind(part);
  const finish = SURFACE_FINISH_V2[kind] ?? SURFACE_FINISH_V2.tissue;
  if (schematic && presentation === "clinical") {
    material.roughness = 0.78;
    if ("clearcoat" in material) material.clearcoat = 0.08;
    if ("transmission" in material) material.transmission = 0;
    material.emissiveIntensity = 0.06;
    material.envMapIntensity = 0.5;
    return;
  }
  if (schematic) {
    material.roughness = 0.82;
    material.emissiveIntensity = 0.12;
    material.envMapIntensity = 0.45;
    return;
  }
  material.roughness = finish.roughness;
  if ("clearcoat" in material) {
    material.clearcoat = finish.clearcoat ?? 0;
    material.clearcoatRoughness = finish.clearcoatRoughness ?? 0.5;
  }
  if ("sheen" in material) {
    material.sheen = finish.sheen ?? 0;
    material.sheenRoughness = finish.sheenRoughness ?? 1;
    if (finish.sheenColor) material.sheenColor.set(finish.sheenColor);
  }
  if ("transmission" in material) {
    material.transmission = finish.transmission ?? 0;
    material.thickness = finish.thickness ?? 0;
  }
  material.envMapIntensity = finish.envMapIntensity ?? 1;
  material.emissiveIntensity = 0;
}
