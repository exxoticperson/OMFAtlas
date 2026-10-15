// Adapted from Human Atlas (MIT), ashemag/human-atlas, explosion-layout.ts.
//
// The slider runs in two stages, the way the reference's does. From 0 to 45%
// each tissue moves rigidly out along its own bearing and the whole stack
// stretches vertically about a pivot. From 45% to 100% every part glides from
// that separated position to its own cell in a frontal inventory. The reference
// moves linearly; here each stage eases in and out, so the tissues settle
// before the packing starts instead of the two stages blurring into one drag.
export const TISSUE_ORDER = ["bones", "neck", "muscles", "teeth", "gingiva", "soft", "glands", "arteries", "veins", "nerves", "brain", "eyes", "airway", "skin"];

/** Fraction of the slider at which tissues have finished moving apart. */
export const SEPARATION_END = 0.45;
/** Percent at which the inventory counts as reached. */
export const INVENTORY_PERCENT = 95;
/** How far a tissue travels from the assembled head, in scene units. */
export const SEPARATION_RADIUS = 0.095;
/** Vertical stretch of the separated stack, as a fraction of height above the pivot. */
export const SEPARATION_STRETCH = 0.28;
/** Extra clear space between two tissue blocks in the inventory. */
const BLOCK_GAP = 0.006;

const clamp01 = (value) => Math.max(0, Math.min(1, value));
export const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export const tissueGroup = (part) => part.group === "neck" ? "bones" : part.group;

/** assembled, separating, or inventory: what the slider position is showing. */
export function explosionStage(percent) {
  if (!(percent > 0)) return "assembled";
  return percent >= INVENTORY_PERCENT ? "inventory" : "separating";
}

/** Percent from which the flat inventory is on screen and left-drag pans it. */
export const FLAT_LAYOUT_PERCENT = 80;

/**
 * What the camera controls do at a given separation amount.
 *
 * Separation moves parts, never the controls: rotate, zoom and pan stay on at
 * every amount, and zoom always reaches the cursor. The one thing the flat
 * inventory changes is the primary button, which pans a layout that has no
 * depth to orbit, with the secondary button taking over the orbit. Values are
 * the names of THREE.MOUSE and THREE.TOUCH entries so this stays plain data.
 */
export function explosionControls(percent) {
  const flat = percent >= FLAT_LAYOUT_PERCENT;
  return {
    enableRotate: true,
    enableZoom: true,
    enablePan: true,
    zoomToCursor: true,
    left: flat ? "PAN" : "ROTATE",
    right: flat ? "ROTATE" : "PAN",
    touch: flat ? "PAN" : "ROTATE",
  };
}

/** Eased progress of the two stages for a slider amount between 0 and 1. */
export function explosionPhases(amount) {
  const value = clamp01(amount);
  return {
    separate: smoothstep(value / SEPARATION_END),
    pack: smoothstep((value - SEPARATION_END) / (1 - SEPARATION_END)),
  };
}

export function tissueSeparation(part) {
  const tissues = TISSUE_ORDER.filter((group) => group !== "neck");
  const angle = tissues.indexOf(tissueGroup(part)) / tissues.length * Math.PI * 2;
  return [Math.sin(angle) * SEPARATION_RADIUS, 0, Math.cos(angle) * SEPARATION_RADIUS];
}

/**
 * Where a part sits, as an offset from its assembled position.
 *
 * `center` is the part's assembled bounding-box centre, `pivot` the point the
 * stack stretches about, and `cell` the part's slot in the inventory layout
 * (omitted for a part the layout does not hold, which then stays separated).
 */
export function explodedOffset({ part, center, pivot, cell, amount }) {
  const { separate, pack } = explosionPhases(amount);
  const radial = tissueSeparation(part);
  const separated = [
    radial[0] * separate,
    radial[1] * separate + (center.y - pivot.y) * SEPARATION_STRETCH * separate,
    radial[2] * separate,
  ];
  if (!cell || pack <= 0) return separated;
  const packed = [cell.x - center.x, cell.y + pivot.y - center.y, -center.z];
  return separated.map((from, axis) => from + (packed[axis] - from) * pack);
}

export function createExplosionLayout(parts, aspect = 1) {
  const cards = parts.map((part) => ({
    id: part.id,
    tissue: tissueGroup(part),
    width: Math.max(0.006, part.bounds[1][0] - part.bounds[0][0]) + 0.009,
    height: Math.max(0.006, part.bounds[1][1] - part.bounds[0][1]) + 0.009,
  }));
  const area = cards.reduce((sum, card) => sum + card.width * card.height, 0);
  const targetWidth = Math.max(0.03, ...cards.map((card) => card.width),
    Math.sqrt(area * Math.max(0.4, Math.min(1.8, aspect))) * 1.18);
  cards.sort((a, b) => TISSUE_ORDER.indexOf(a.tissue) - TISSUE_ORDER.indexOf(b.tissue) || b.height - a.height || a.id.localeCompare(b.id));

  // Shelf rows, one tissue to a row at most, so a tissue reads as a block.
  const rows = [];
  let row;
  for (const card of cards) {
    if (!row || card.tissue !== row.tissue || row.width + card.width > targetWidth) {
      row = { tissue: card.tissue, cards: [], width: 0, height: 0 };
      rows.push(row);
    }
    row.cards.push(card);
    row.width += card.width;
    row.height = Math.max(row.height, card.height);
  }

  // Rows are centred on one axis rather than ragged to the left, and a tissue
  // change leaves a little air, which is what makes the blocks legible.
  const width = Math.max(0, ...rows.map((entry) => entry.width));
  const cells = new Map();
  let y = 0;
  rows.forEach((entry, index) => {
    let x = (width - entry.width) / 2;
    for (const card of entry.cards) {
      cells.set(card.id, { x: x + card.width / 2, y: -y - card.height / 2,
        width: card.width, height: card.height });
      x += card.width;
    }
    y += entry.height;
    if (rows[index + 1] && rows[index + 1].tissue !== entry.tissue) y += BLOCK_GAP;
  });
  const height = y;
  for (const cell of cells.values()) { cell.x -= width / 2; cell.y += height / 2; }
  return { cells, width, height };
}
