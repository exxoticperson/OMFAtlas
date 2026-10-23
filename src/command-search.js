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

  // 2. Add schematic nerves, vessels, ganglia & sinuses
  const schematics = [
    {
      id: "SCH-inferior-alveolar-nerve-l",
      title: "Inferior Alveolar Nerve (Left)",
      subtitle: "Traverses mandibular canal to supply left molars/premolars; exits at mental foramen",
      category: "Nerves & Innervation",
      keywords: "ian inferior alveolar nerve v3 mandibular canal dental block spix anesthesia",
      badge: "CN V3",
    },
    {
      id: "SCH-inferior-alveolar-nerve-r",
      title: "Inferior Alveolar Nerve (Right)",
      subtitle: "Traverses mandibular canal to supply right molars/premolars",
      category: "Nerves & Innervation",
      keywords: "ian inferior alveolar nerve v3 mandibular canal right side spix block",
      badge: "CN V3",
    },
    {
      id: "SCH-lingual-nerve-l",
      title: "Lingual Nerve (Left)",
      subtitle: "Passes 2mm from 3rd molar lingual plate; sensory to floor of mouth & anterior 2/3 tongue",
      category: "Nerves & Innervation",
      keywords: "lingual nerve v3 tongue sensation taste floor mouth lingual plate",
      badge: "CN V3",
    },
    {
      id: "SCH-chorda-tympani-l",
      title: "Chorda Tympani (Left)",
      subtitle: "Branch of CN VII hitchhiking on Lingual Nerve; taste to anterior 2/3 tongue",
      category: "Nerves & Innervation",
      keywords: "chorda tympani lingual taste submandibular gland facial nerve cn7",
      badge: "Special Sensory",
    },
    {
      id: "SCH-v2-l",
      title: "Maxillary Nerve Trunk (V2)",
      subtitle: "Exits via foramen rotundum into pterygopalatine fossa; sensory to midface & upper teeth",
      category: "Nerves & Innervation",
      keywords: "maxillary nerve v2 rotundum pterygopalatine trigeminal midface upper jaw",
      badge: "CN V2",
    },
    {
      id: "SCH-v3-l",
      title: "Mandibular Nerve Trunk (V3)",
      subtitle: "Exits via foramen ovale; motor to muscles of mastication & sensory to lower jaw",
      category: "Nerves & Innervation",
      keywords: "mandibular nerve v3 ovale mastication sensory lower jaw motor",
      badge: "CN V3",
    },
    {
      id: "SCH-hypoglossal-nerve-l",
      title: "Hypoglossal Nerve (CN XII)",
      subtitle: "Motor innervation to intrinsic and extrinsic muscles of the tongue",
      category: "Nerves & Innervation",
      keywords: "hypoglossal nerve cn12 motor tongue speech swallowing",
      badge: "CN XII",
    },
    {
      id: "SCH-otic-ganglion-l",
      title: "Otic Ganglion (Left)",
      subtitle: "Parasympathetic ganglion medial to V3; secretomotor relay to parotid gland via auriculotemporal",
      category: "Autonomic Ganglia",
      keywords: "otic ganglion parasympathetic cn9 glossopharyngeal lesser petrosal auriculotemporal parotid saliva frey",
      badge: "Ganglion",
    },
    {
      id: "SCH-otic-ganglion-r",
      title: "Otic Ganglion (Right)",
      subtitle: "Parasympathetic ganglion medial to V3 under foramen ovale",
      category: "Autonomic Ganglia",
      keywords: "otic ganglion parasympathetic cn9 glossopharyngeal lesser petrosal parotid",
      badge: "Ganglion",
    },
    {
      id: "SCH-pterygopalatine-ganglion-l",
      title: "Pterygopalatine Ganglion (Meckel's Left)",
      subtitle: "Suspended from V2 in pterygopalatine fossa; secretomotor to lacrimal & nasal/palatine glands",
      category: "Autonomic Ganglia",
      keywords: "pterygopalatine sphenopalatine ganglion meckel cn7 greater petrosal vidian spg block lacrimal",
      badge: "Ganglion",
    },
    {
      id: "SCH-pterygopalatine-ganglion-r",
      title: "Pterygopalatine Ganglion (Meckel's Right)",
      subtitle: "Suspended from V2 in pterygopalatine fossa; secretomotor relay for tears and mucosal secretions",
      category: "Autonomic Ganglia",
      keywords: "pterygopalatine sphenopalatine ganglion meckel cn7 spg block",
      badge: "Ganglion",
    },
    {
      id: "SCH-submandibular-ganglion-l",
      title: "Submandibular Ganglion (Left)",
      subtitle: "Suspended from lingual nerve above submandibular gland; secretomotor relay from chorda tympani",
      category: "Autonomic Ganglia",
      keywords: "submandibular ganglion lingual chorda tympani cn7 sublingual salivary gland floor mouth",
      badge: "Ganglion",
    },
    {
      id: "SCH-submandibular-ganglion-r",
      title: "Submandibular Ganglion (Right)",
      subtitle: "Suspended from lingual nerve above submandibular gland",
      category: "Autonomic Ganglia",
      keywords: "submandibular ganglion lingual chorda tympani cn7 salivary",
      badge: "Ganglion",
    },
    {
      id: "SCH-frontal-sinus-l",
      title: "Frontal Sinus (Left)",
      subtitle: "Pneumatic cavity in squama frontalis above nasion; drains to middle meatus via frontonasal duct",
      category: "Sinuses & Airway",
      keywords: "frontal sinus paranasal nasion superciliary middle meatus frontonasal duct potts puffy",
      badge: "Sinus",
    },
    {
      id: "SCH-frontal-sinus-r",
      title: "Frontal Sinus (Right)",
      subtitle: "Pneumatic cavity in squama frontalis above nasion; drains to middle meatus via frontonasal duct",
      category: "Sinuses & Airway",
      keywords: "frontal sinus paranasal nasion superciliary airway",
      badge: "Sinus",
    },
    {
      id: "SCH-sphenoid-sinus-l",
      title: "Sphenoid Sinus (Left)",
      subtitle: "Pneumatic cavity in sphenoid body beneath sella turcica; transsphenoidal surgical corridor",
      category: "Sinuses & Airway",
      keywords: "sphenoid sinus paranasal sella turcica pituitary sphenoethmoidal recess transsphenoidal",
      badge: "Sinus",
    },
    {
      id: "SCH-sphenoid-sinus-r",
      title: "Sphenoid Sinus (Right)",
      subtitle: "Pneumatic cavity in sphenoid body beneath sella turcica",
      category: "Sinuses & Airway",
      keywords: "sphenoid sinus paranasal sella turcica pituitary recess skull base",
      badge: "Sinus",
    },
    {
      id: "SCH-maxillary-sinus-l",
      title: "Maxillary Sinus (Antrum of Highmore Left)",
      subtitle: "Largest paranasal sinus; intimate relation to upper 1st/2nd molar root apices",
      category: "Sinuses & Airway",
      keywords: "maxillary sinus highmore antrum molar apices sinus lift pneumatization oroantral communication oac",
      badge: "Sinus",
    },
    {
      id: "SCH-maxillary-sinus-r",
      title: "Maxillary Sinus (Antrum of Highmore Right)",
      subtitle: "Largest paranasal sinus; floor lies directly above right upper posterior tooth roots",
      category: "Sinuses & Airway",
      keywords: "maxillary sinus highmore antrum molar apices sinus lift oac",
      badge: "Sinus",
    },
    {
      id: "SCH-parotid-gland-l",
      title: "Parotid Gland & Stensen's Duct",
      subtitle: "Largest salivary gland; duct opens opposite upper second molar (FDI 17/27)",
      category: "Sinuses & Glands",
      keywords: "parotid salivary gland stensen duct saliva cheek ramus molar facial nerve",
      badge: "Salivary Gland",
    },
    {
      id: "SCH-articular-disc-l",
      title: "Articular Disc of TMJ (Left)",
      subtitle: "Biconcave fibrocartilage disc between mandibular condyle and glenoid fossa",
      category: "Joint & Musculoskeletal",
      keywords: "tmj temporomandibular joint disc condyle clicking lock jaw glenoid fossa internal derangement",
      badge: "TMJ Joint",
    },
    {
      id: "SCH-articular-disc-r",
      title: "Articular Disc of TMJ (Right)",
      subtitle: "Biconcave fibrocartilage disc between right mandibular condyle and glenoid fossa",
      category: "Joint & Musculoskeletal",
      keywords: "tmj temporomandibular joint disc condyle clicking lock jaw",
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
