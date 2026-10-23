/**
 * Command Search Engine (Cmd+K / Quick Search) for OMFAtlas 2.0.
 * Senior-designer fuzzy search index over teeth, nerves, vessels, bones,
 * and clinical landmarks with keyboard shortcuts.
 */

import { TOOTH_CLINICAL_GRAPH } from "./anatomy-graph.js";

export function createSearchIndex(atlas) {
  const items = [];

  // 1. Add all teeth with clinical data
  for (const [fdiStr, tooth] of Object.entries(TOOTH_CLINICAL_GRAPH)) {
    const fdi = parseInt(fdiStr, 10);
    items.push({
      id: tooth.bp3dId || `tooth-${fdi}`,
      type: "tooth",
      title: `${tooth.shortName} (#${fdi} · Univ #${tooth.universal})`,
      subtitle: `${tooth.canals} · Innervated by ${tooth.nerve.split("(")[0].trim()}`,
      fdi,
      universal: tooth.universal,
      keywords: `${fdi} ${tooth.universal} tooth molar incisor canine premolar wisdom ${tooth.name} ${tooth.shortName} ${tooth.nerve} ${tooth.arch} ${tooth.bp3dId}`,
      action: { type: "selectTooth", fdi, partId: tooth.bp3dId },
      category: "Teeth & Dentition",
      badge: `FDI #${fdi}`,
    });
  }

  // 2. Add schematic nerves & vessels
  const schematics = [
    {
      id: "IAN_L",
      title: "Inferior Alveolar Nerve (Left)",
      subtitle: "Traverses mandibular canal to supply left molars/premolars; exits at mental foramen",
      category: "Nerves & Innervation",
      keywords: "ian inferior alveolar nerve v3 mandibular canal dental block spix anesthesia",
      badge: "OMF Nerve",
    },
    {
      id: "IAN_R",
      title: "Inferior Alveolar Nerve (Right)",
      subtitle: "Traverses mandibular canal to supply right molars/premolars",
      category: "Nerves & Innervation",
      keywords: "ian inferior alveolar nerve v3 mandibular canal right side",
      badge: "OMF Nerve",
    },
    {
      id: "chorda_tympani_L",
      title: "Chorda Tympani (Left)",
      subtitle: "Branch of CN VII hitchhiking on Lingual Nerve; taste to anterior 2/3 tongue",
      category: "Nerves & Innervation",
      keywords: "chorda tympani lingual taste submandibular gland facial nerve cn7",
      badge: "Special Sensory",
    },
    {
      id: "V2_trunk_L",
      title: "Maxillary Nerve Trunk (V2)",
      subtitle: "Exits via foramen rotundum into pterygopalatine fossa; sensory to midface",
      category: "Nerves & Innervation",
      keywords: "maxillary nerve v2 rotundum pterygopalatine trigeminal midface upper jaw",
      badge: "CN V2",
    },
    {
      id: "V3_trunk_L",
      title: "Mandibular Nerve Trunk (V3)",
      subtitle: "Exits via foramen ovale; motor to muscles of mastication & sensory to lower jaw",
      category: "Nerves & Innervation",
      keywords: "mandibular nerve v3 ovale mastication sensory lower jaw motor",
      badge: "CN V3",
    },
    {
      id: "hypoglossal_L",
      title: "Hypoglossal Nerve (CN XII)",
      subtitle: "Motor innervation to intrinsic and extrinsic muscles of the tongue",
      category: "Nerves & Innervation",
      keywords: "hypoglossal nerve cn12 motor tongue speech swallowing",
      badge: "CN XII",
    },
    {
      id: "maxillary_sinus_L",
      title: "Maxillary Sinus (Antrum of Highmore)",
      subtitle: "Largest paranasal sinus; close proximity to upper molar root apices",
      category: "Sinuses & Glands",
      keywords: "maxillary sinus highmore antrum molar apices sinus lift pneumatization",
      badge: "Sinus",
    },
    {
      id: "parotid_gland_L",
      title: "Parotid Gland & Stensen's Duct",
      subtitle: "Largest salivary gland; duct opens opposite upper second molar (FDI 17/27)",
      category: "Sinuses & Glands",
      keywords: "parotid salivary gland stensen duct saliva cheek ramus molar",
      badge: "Salivary Gland",
    },
    {
      id: "tmj_disc_L",
      title: "Articular Disc of TMJ",
      subtitle: "Biconcave fibrocartilage disc between mandibular condyle and glenoid fossa",
      category: "Joint & Musculoskeletal",
      keywords: "tmj temporomandibular joint disc condyle clicking lock jaw glenoid fossa",
      badge: "TMJ Joint",
    },
  ];

  for (const s of schematics) {
    items.push({
      ...s,
      type: "schematic",
      action: { type: "selectPart", partId: s.id },
    });
  }

  // 3. Add core BodyParts3D bones and landmarks
  if (atlas?.parts) {
    for (const part of atlas.parts) {
      if (part.schematic) continue;
      // Index primary bones, muscles, glands
      if (part.group === "bones" || part.group === "muscles" || part.group === "glands") {
        items.push({
          id: part.id,
          type: "bp3d",
          title: part.name,
          subtitle: `${part.group.toUpperCase()} · BodyParts3D (${part.id})`,
          category: part.group === "bones" ? "Skeletal Anatomy" : "Muscles & Soft Tissue",
          keywords: `${part.name} ${part.id} ${part.group} ${part.system || ""}`,
          badge: part.group,
          action: { type: "selectPart", partId: part.id },
        });
      }
    }
  }

  return items;
}

/**
 * Fast search query matching.
 */
export function queryIndex(index, query) {
  if (!query || !query.trim()) return [];
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  const matched = [];
  for (const item of index) {
    const text = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
    let score = 0;
    let allMatched = true;

    for (const term of terms) {
      if (!text.includes(term)) {
        allMatched = false;
        break;
      }
      if (item.fdi && String(item.fdi) === term) score += 100;
      if (item.universal && String(item.universal) === term) score += 90;
      if (item.title.toLowerCase().startsWith(term)) score += 50;
      else if (item.title.toLowerCase().includes(term)) score += 20;
    }

    if (allMatched) {
      matched.push({ item, score });
    }
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.slice(0, 15).map((m) => m.item);
}
