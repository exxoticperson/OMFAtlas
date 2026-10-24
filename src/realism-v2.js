/**
 * v2 presentation: teaching vs clinical (Astra / BodyParts3D–style specimen look).
 * Geometry unchanged — colors, PBR, and schematic shading only.
 *
 * Color references (educational atlas convention, not copied assets):
 * - Sobotta / Netter-style OMF plates: ivory bone, dry muscle, muted vessel hues
 * - Visible Body / BodyParts3D UI: low-saturation systems on neutral stage
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
    // Core OMF layers: bones, dentition, and neurovasculature.
    // Muscles, skin, brain and eyes are toggleable from layers but off by default so bones/teeth remain visible.
    layers: [
      "bones",
      "teeth",
      "gingiva",
      "neck",
      "nerves",
      "arteries",
      "veins",
      "glands",
      "soft",
      "airway",
    ],
  },
};

/** Specimen-lab palette (clinical). Teaching uses legacy group colors from content.js */
export const GROUP_COLORS_V2 = {
  bones: "#e4ddd0",
  neck: "#d4cfc2",
  teeth: "#f3eee4",
  gingiva: "#c4787e",
  soft: "#b56a72",
  glands: "#c9a86a",
  muscles: "#8f4848",
  arteries: "#9a3834",
  veins: "#4a5878",
  nerves: "#dcc48a",
  brain: "#c4aba4",
  eyes: "#94a8a4",
  airway: "#b07870",
  skin: "#c9a48c",
};

/** Schematic tubes & volumes — matte wax, not emissive neon */
export const SCHEMATIC_COLORS = {
  nerve: "#e8d4a8",
  nerveTrunk: "#dcc890",
  artery: "#8c322e",
  vein: "#4a5568",
  gland: "#c4a066",
  sinus: "#9aa8b8",
  disc: "#d8d0c4",
  duct: "#c9a870",
};

const name = (part) => String(part?.name || "").toLowerCase();

export function schematicKind(part) {
  const n = name(part);
  const g = part.group;
  if (/sinus|antrum|cavity/.test(n)) return "sinus";
  if (/disc|meniscus|articular disc/.test(n)) return "disc";
  if (/duct|parotid duct/.test(n)) return "duct";
  if (g === "glands" || /parotid|submandibular|sublingual|gland/.test(n)) return "gland";
  if (g === "arteries" || /artery|arteria/.test(n)) return "artery";
  if (g === "veins" || /vein|vena|facial vein/.test(n)) return "vein";
  if (g === "nerves" || /nerve|nervus/.test(n)) {
    if (/mandibular nerve|maxillary nerve|facial nerve|v3|v2|vii/.test(n)) return "nerveTrunk";
    return "nerve";
  }
  return "nerve";
}

export function surfaceKind(part) {
  const group = part.group;
  const n = name(part);
  if (part.schematic) return `schematic_${schematicKind(part)}`;
  if (group === "skin") return "skin";
  if (group === "eyes") {
    if (/cornea|lens|iris|pupil/.test(n)) return "cornea";
    if (/sclera|conjunctiva/.test(n)) return "sclera";
    if (/ear|auricle|pinna|cochlea|vestibul|tympanic|auditory/.test(n)) return "ear";
    return "eye";
  }
  if (group === "bones" || group === "neck") return "bone";
  if (group === "teeth") return "enamel";
  if (group === "gingiva") return "gingiva";
  if (group === "muscles") return "muscle";
  if (group === "glands") return "gland";
  if (group === "brain") return "brain";
  if (group === "airway" || group === "soft") return "mucosa";
  if (group === "arteries" || group === "veins" || group === "nerves") return "vessel";
  return "tissue";
}

export const SURFACE_FINISH_V2 = {
  bone: {
    roughness: 0.62,
    clearcoat: 0.02,
    clearcoatRoughness: 0.7,
    envMapIntensity: 0.72,
  },
  enamel: {
    roughness: 0.18,
    clearcoat: 0.78,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.12,
  },
  gingiva: {
    roughness: 0.48,
    clearcoat: 0.28,
    clearcoatRoughness: 0.35,
    sheen: 0.38,
    sheenRoughness: 0.55,
    sheenColor: "#ffb0b0",
    envMapIntensity: 0.78,
  },
  muscle: {
    roughness: 0.68,
    clearcoat: 0.04,
    clearcoatRoughness: 0.55,
    sheen: 0.22,
    sheenRoughness: 0.72,
    sheenColor: "#c87878",
    envMapIntensity: 0.62,
  },
  mucosa: {
    roughness: 0.52,
    clearcoat: 0.32,
    clearcoatRoughness: 0.4,
    sheen: 0.48,
    sheenRoughness: 0.5,
    sheenColor: "#ffc8c0",
    envMapIntensity: 0.75,
  },
  tissue: {
    roughness: 0.52,
    clearcoat: 0.2,
    clearcoatRoughness: 0.4,
    sheen: 0.35,
    sheenRoughness: 0.55,
    sheenColor: "#ffd0c4",
    envMapIntensity: 0.78,
  },
  gland: {
    roughness: 0.56,
    clearcoat: 0.12,
    clearcoatRoughness: 0.45,
    sheen: 0.18,
    sheenColor: "#e8c890",
    envMapIntensity: 0.68,
  },
  brain: {
    roughness: 0.72,
    clearcoat: 0.06,
    clearcoatRoughness: 0.6,
    envMapIntensity: 0.55,
  },
  skin: {
    roughness: 0.58,
    clearcoat: 0.05,
    clearcoatRoughness: 0.48,
    sheen: 0.52,
    sheenRoughness: 0.68,
    sheenColor: "#ffb89a",
    transmission: 0.05,
    thickness: 0.3,
    envMapIntensity: 0.68,
  },
  vessel: {
    roughness: 0.38,
    clearcoat: 0.42,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.88,
  },
  eye: {
    roughness: 0.18,
    clearcoat: 0.88,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.08,
  },
  sclera: {
    roughness: 0.44,
    clearcoat: 0.32,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.88,
  },
  cornea: {
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    transmission: 0.14,
    thickness: 0.12,
    envMapIntensity: 1.22,
  },
  ear: {
    roughness: 0.5,
    clearcoat: 0.16,
    clearcoatRoughness: 0.34,
    sheen: 0.26,
    sheenColor: "#e8c4b0",
    envMapIntensity: 0.68,
  },
  schematic_nerve: {
    roughness: 0.72,
    clearcoat: 0.06,
    clearcoatRoughness: 0.55,
    sheen: 0.12,
    sheenColor: "#f0e0b8",
    envMapIntensity: 0.55,
  },
  schematic_nerveTrunk: {
    roughness: 0.68,
    clearcoat: 0.1,
    clearcoatRoughness: 0.5,
    sheen: 0.15,
    sheenColor: "#e8d098",
    envMapIntensity: 0.58,
  },
  schematic_artery: {
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.82,
  },
  schematic_vein: {
    roughness: 0.48,
    clearcoat: 0.28,
    clearcoatRoughness: 0.32,
    envMapIntensity: 0.72,
  },
  schematic_gland: {
    roughness: 0.58,
    clearcoat: 0.14,
    clearcoatRoughness: 0.42,
    sheen: 0.2,
    sheenColor: "#d8b878",
    envMapIntensity: 0.65,
  },
  schematic_sinus: {
    roughness: 0.28,
    clearcoat: 0.22,
    clearcoatRoughness: 0.25,
    transmission: 0.72,
    thickness: 0.25,
    envMapIntensity: 0.90,
  },
  schematic_disc: {
    roughness: 0.64,
    clearcoat: 0.08,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.58,
  },
  schematic_duct: {
    roughness: 0.55,
    clearcoat: 0.2,
    clearcoatRoughness: 0.38,
    envMapIntensity: 0.68,
  },
};

export function partColor(part, groups, { presentation = "clinical", selected = false } = {}) {
  const isSinus = part?.schematic && /sinus|antrum|cavity/i.test(part.name);
  if (selected) {
    if (isSinus) return presentation === "clinical" ? "#d48b8b" : "#38bdf8";
    return presentation === "clinical" ? "#c9a227" : "#5b86ee";
  }
  const n = name(part);

  if (part.schematic) {
    const kind = schematicKind(part);
    const colors = SCHEMATIC_COLORS;
    if (presentation === "teaching") {
      return groups[part.group]?.color ?? colors.nerve;
    }
    switch (kind) {
      case "artery":
        return colors.artery;
      case "vein":
        return colors.vein;
      case "nerveTrunk":
        return colors.nerveTrunk;
      case "gland":
        return colors.gland;
      case "sinus":
        return colors.sinus;
      case "disc":
        return colors.disc;
      case "duct":
        return colors.duct;
      default:
        return colors.nerve;
    }
  }

  const palette = presentation === "clinical" ? GROUP_COLORS_V2 : null;
  let base = palette?.[part.group] ?? groups[part.group]?.color ?? "#cccccc";

  if (part.group === "eyes") {
    if (/cornea|lens/.test(n)) return "#f8fafc";
    if (/iris/.test(n)) return "#1f2937"; // Deep natural iris with dark pupil
    if (/sclera/.test(n)) return "#f3eee6"; // Realistic off-white vascularized sclera
    if (/tarsal/.test(n)) return "#c99a88"; // Eyelid margin flesh tone (not bright red)
    if (/retina|choroid|choroidea/.test(n)) return "#582020";
  }
  if (part.group === "skin") {
    if (/lip|vermilion/.test(n)) return "#c26e74";
    return "#e2b8a2"; // Natural warm lifelike skin complexion
  }
  if (part.group === "bones" || part.group === "neck") {
    if (/mandible|maxilla/.test(n)) return "#e0d8c8";
    if (/zygomatic|temporal bone|sphenoid/.test(n)) return "#ddd4c4";
    if (/tooth|alveolar|process/.test(n)) return "#e8e2d6";
    return base;
  }
  if (part.group === "teeth") return "#f2ece2";
  if (part.group === "muscles") {
    if (/masseter|temporalis|pterygoid|buccinator/.test(n)) return "#8a4444";
    return "#944848";
  }
  if (part.group === "arteries") return presentation === "clinical" ? "#9a3834" : base;
  if (part.group === "veins") return presentation === "clinical" ? "#4a5878" : base;
  if (part.group === "nerves") return presentation === "clinical" ? "#dcc48a" : base;
  if (part.group === "gingiva") return "#c4787e";
  if (part.group === "soft") return "#b56a72";
  if (part.group === "brain") return "#c4aba4";

  return base;
}

/** Emissive for update loop — clinical schematics stay dark (Astra-style). */
export function materialEmissive(part, { presentation = "clinical", selected = false } = {}) {
  const isSinus = part?.schematic && /sinus|antrum|cavity/i.test(part.name);
  if (selected) {
    if (isSinus) return presentation === "clinical" ? "#241212" : "#0a223a";
    return presentation === "clinical" ? "#3d3010" : "#142349";
  }
  if (part.schematic) {
    if (presentation === "clinical") return "#000000";
    return part.group === "nerves"
      ? "#3a3018"
      : part.group === "arteries"
        ? "#2a0808"
        : part.group === "veins"
          ? "#081828"
          : "#000000";
  }
  return "#000000";
}

export function materialEmissiveIntensity(part, { presentation = "clinical", selected = false } = {}) {
  if (selected) return presentation === "clinical" ? 0.07 : 0.09;
  if (part.schematic && presentation === "teaching") return 0.04;
  return 0;
}

export function applyFinishToMaterial(material, part, { schematic = false, presentation = "clinical" } = {}) {
  const kind = surfaceKind(part);
  const finish =
    SURFACE_FINISH_V2[kind] ??
    (schematic ? SURFACE_FINISH_V2.schematic_nerve : SURFACE_FINISH_V2.tissue);

  material.roughness = finish.roughness ?? 0.55;
  if (material.isMeshPhysicalMaterial) {
    material.clearcoat = finish.clearcoat ?? 0;
    material.clearcoatRoughness = finish.clearcoatRoughness ?? 0.5;
    material.sheen = finish.sheen ?? 0;
    material.sheenRoughness = finish.sheenRoughness ?? 1;
    if (finish.sheenColor && material.sheenColor) material.sheenColor.set(finish.sheenColor);
    material.transmission = finish.transmission ?? 0;
    material.thickness = finish.thickness ?? 0;
  }
  material.envMapIntensity = finish.envMapIntensity ?? 0.75;
  material.emissiveIntensity = materialEmissiveIntensity(part, {
    presentation,
    schematic,
  });
}

export function toneMappingExposureFor(presentation) {
  return presentation === "clinical" ? 1.16 : 1.08;
}
