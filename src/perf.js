/** Device-aware caps for fill rate and material cost. */

export function performanceTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = devicePixelRatio || 1;
  if (cores <= 4 || dpr > 2) return "low";
  if (cores <= 8) return "medium";
  return "high";
}

export function pixelRatioCap(tier) {
  if (tier === "low") return 1.25;
  if (tier === "medium") return 1.65;
  return 2;
}

/** Small / numerous structures do not need transmission or sheen. */
export function preferLiteMaterial(part) {
  if (part.schematic) return true;
  const g = part.group;
  return (
    g === "nerves" ||
    g === "veins" ||
    g === "arteries" ||
    g === "brain" ||
    g === "airway"
  );
}
