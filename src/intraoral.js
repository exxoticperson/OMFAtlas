/** Intra-oral tab: visibility, camera presets, oral look (lighting + materials). */

import * as THREE from "three";
import { toothNumber } from "./content.js";
import { applyFinishToMaterial, partColor } from "./realism-v2.js";

/** Jaws and palate only — not cranium, cervical spine, or orbit. */
export const INTRAORAL_BONE_IDS = new Set([
  "FJ3289", // mandible
  "FJ3269", // left maxilla
  "FJ3375", // right maxilla
  "FJ3273", // left palatine
  "FJ3379", // right palatine
]);

export const INTRAORAL_LAYERS = ["teeth", "gingiva", "soft"];

export const INTRAORAL_PRESETS = {
  occlusal: {
    label: "Occlusal",
    hint: "Mirror-style view from below the occlusal plane (NBDE / clinical exam orientation).",
    vector: [0.06, -0.97, 0.22],
    distanceScale: 0.88,
  },
  lingual: {
    label: "Lingual",
    hint: "From the tongue side — inspect palatal/lingual gingiva and tooth lingual surfaces.",
    vector: [-0.08, -0.12, -0.98],
    distanceScale: 1.02,
  },
  buccal: {
    label: "Buccal",
    hint: "From the cheek side — buccal corridors and vestibule.",
    vector: [0.05, 0.02, 0.99],
    distanceScale: 1.02,
  },
};

/** @param {object} part */
export function isIntraoralEligible(part) {
  if (part.schematic) return false;
  if (INTRAORAL_LAYERS.includes(part.group)) return true;
  if (part.group === "bones" && INTRAORAL_BONE_IDS.has(part.id)) return true;
  return false;
}

/**
 * @param {object} part
 * @param {object} state
 */
export function intraoralVisible(part, state) {
  if (!isIntraoralEligible(part)) return false;
  if (state.hidden?.has(part.id)) return false;
  if (state.isolated) return part.id === state.selected;
  if (part.group === "bones") return state.intraoralShowBone !== false;
  return state.layers.has(part.group);
}

/** Groups that receive BodyParts3D 99% “original detail” swaps in intra-oral mode. */
export function intraoralHighResEligible(part) {
  return (
    !part.schematic &&
    (part.group === "teeth" || part.group === "gingiva")
  );
}

/** High-res bins shipped in a minimal clone (sparse checkout). */
export const SHIPPED_HR_PART_IDS = new Set([
  "FJ1280",
  "FJ1601",
  "FJ1802",
  "FJ2811",
  "FJ3199",
]);

const CBCT_TISSUE = {
  tooth: { color: "#f4efe6", roughness: 0.22, clearcoat: 0.7, envMapIntensity: 1.05 },
  pdl: { color: "#c96a82", roughness: 0.55, clearcoat: 0.12, envMapIntensity: 0.75 },
  bone: { color: "#ddd2c0", roughness: 0.64, clearcoat: 0.04, envMapIntensity: 0.7 },
  pulp: { color: "#b8455c", roughness: 0.48, envMapIntensity: 0.65 },
  canal: { color: "#dcc48a", roughness: 0.42, envMapIntensity: 0.8 },
};

/** Cache key for oral materials — skip per-frame PBR work when unchanged. */
export function oralLookKey(state, dentalKey = "") {
  return [
    dentalKey,
    state.intraoralModel ?? "openfulljaw",
    state.selected ?? "",
    state.intraoralFocus ? 1 : 0,
    state.intraoralShowBone ? 1 : 0,
    [...(state.layers ?? [])].sort().join(","),
  ].join("|");
}

export function setOralStudioLighting(rig, active) {
  const { ambient, key, fill, rim, oralPoint } = rig;
  if (active) {
    ambient.intensity = 0.38;
    key.intensity = 1.45;
    fill.intensity = 0.55;
    rim.intensity = 1.1;
    oralPoint.intensity = 1.35;
    oralPoint.visible = true;
  } else {
    ambient.intensity = 0.52;
    key.intensity = 2.35;
    fill.intensity = 0.85;
    rim.intensity = 1.65;
    oralPoint.intensity = 0;
    oralPoint.visible = false;
  }
}

function primeOralPhysical(mesh) {
  if (mesh.userData.oralPrimed) return mesh.material;
  const prev = mesh.material;
  if (!prev?.isMeshPhysicalMaterial) {
    const next = new THREE.MeshPhysicalMaterial({
      color: prev.color,
      roughness: prev.roughness ?? 0.5,
      metalness: prev.metalness ?? 0,
      side: prev.side ?? THREE.DoubleSide,
      transparent: prev.transparent,
      opacity: prev.opacity,
      envMapIntensity: prev.envMapIntensity ?? 1,
    });
    if (prev.map) next.map = prev.map;
    prev.dispose();
    mesh.material = next;
  }
  mesh.userData.oralPrimed = true;
  return mesh.material;
}

export function selectedFdiFromState(state, atlasParts) {
  if (!state?.selected || !atlasParts?.length) return null;
  const p = atlasParts.find((x) => x.id === state.selected);
  if (!p || p.group !== "teeth") return null;
  return toothNumber(p.name) || null;
}

export function intraoralStatusMessage({ cbctReady, archSource }) {
  if (cbctReady) {
    return archSource === "toothfairy"
      ? "CBCT · ToothFairy3"
      : "CBCT · Open-Full-Jaw";
  }
  return "Atlas oral view · import dental bins for CBCT";
}

/**
 * Apply oral look once per {@link oralLookKey} change (not every frame).
 * @param {object} ctx
 */
export function syncOralLook(ctx) {
  const {
    state,
    groups,
    atlasParts,
    meshes,
    dentalModel,
    lightRig,
  } = ctx;
  setOralStudioLighting(lightRig, true);
  const presentation = "clinical";
  const selFdi = selectedFdiFromState(state, atlasParts);

  if (dentalModel?.userData.publishedArch) {
    for (const mesh of dentalModel.children) {
      primeOralPhysical(mesh);
      const tissue = mesh.userData.tissue;
      const style = CBCT_TISSUE[tissue] || CBCT_TISSUE.tooth;
      const mat = mesh.material;
      mat.color.set(style.color);
      mat.roughness = style.roughness;
      mat.clearcoat = style.clearcoat ?? 0;
      mat.envMapIntensity = style.envMapIntensity ?? 0.85;
      const fdi = mesh.userData.fdi;
      const selected = fdi && selFdi && fdi === selFdi;
      const focus = state.intraoralFocus && selFdi && fdi && !selected;
      if (focus) {
        mat.transparent = true;
        mat.opacity = 0.22;
        mat.depthWrite = false;
      } else {
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthWrite = true;
        mat.emissive.set(selected ? "#3d3010" : "#000000");
        mat.emissiveIntensity = selected ? 0.06 : 0;
      }
    }
    return;
  }

  for (const mesh of meshes) {
    const part = mesh.userData.part;
    if (!isIntraoralEligible(part)) continue;
    primeOralPhysical(mesh);
    const mat = mesh.material;
    const selected = part.id === state.selected;
    const focus =
      state.intraoralFocus &&
      state.selected &&
      part.group === "teeth" &&
      !selected;
    mat.color.set(partColor(part, groups, { presentation, selected }));
    applyFinishToMaterial(mat, part, { schematic: false, presentation });
    if (focus) {
      mat.transparent = true;
      mat.opacity = 0.28;
      mat.depthWrite = false;
    } else {
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
    }
  }
}

export const INTRAORAL_LITERATURE = [
  {
    title: "Tooth & periodontium",
    cite: "StatPearls — Tooth anatomy (NBK557543); Periodontium (NBK553122)",
  },
  {
    title: "Local anaesthesia",
    cite: "StatPearls — Inferior alveolar & maxillary nerve blocks (NBK557988, NBK532292)",
  },
  {
    title: "OMF schematic nerves",
    cite: "Teaching paths fitted to this BodyParts3D assembly — compare Netter/Sobotta head & neck plates; not patient-specific imaging.",
  },
];
