import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INVENTORY_PERCENT,
  SEPARATION_END,
  SEPARATION_RADIUS,
  createExplosionLayout,
  explodedOffset,
  explosionPhases,
  explosionStage,
  smoothstep,
  tissueSeparation,
} from "../src/explosion-layout.js";

const atlas = () => JSON.parse(readFileSync(new URL("../public/models/atlas.json", import.meta.url))).parts;
const centreOf = (part) => ({
  x: (part.bounds[0][0] + part.bounds[1][0]) / 2,
  y: (part.bounds[0][1] + part.bounds[1][1]) / 2,
  z: (part.bounds[0][2] + part.bounds[1][2]) / 2,
});

test("each stage eases: slow at its ends, fastest in the middle, never overshooting", () => {
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.equal(smoothstep(-3), 0);
  assert.equal(smoothstep(9), 1);
  let previous = explosionPhases(0);
  assert.deepEqual(previous, { separate: 0, pack: 0 });
  for (let i = 1; i <= 100; i++) {
    const next = explosionPhases(i / 100);
    assert.ok(next.separate >= previous.separate, `separation never reverses at ${i}%`);
    assert.ok(next.pack >= previous.pack, `packing never reverses at ${i}%`);
    assert.ok(next.separate <= 1 && next.pack <= 1);
    previous = next;
  }
  // Tissues finish separating exactly where packing begins.
  assert.equal(explosionPhases(SEPARATION_END).separate, 1);
  assert.equal(explosionPhases(SEPARATION_END).pack, 0);
  assert.deepEqual(explosionPhases(1), { separate: 1, pack: 1 });
  assert.ok(Math.abs(explosionPhases(SEPARATION_END / 2).separate - 0.5) < 1e-9);
});

test("the stage names follow the slider and the inventory threshold", () => {
  assert.equal(explosionStage(0), "assembled");
  assert.equal(explosionStage(1), "separating");
  assert.equal(explosionStage(INVENTORY_PERCENT - 1), "separating");
  assert.equal(explosionStage(INVENTORY_PERCENT), "inventory");
  assert.equal(explosionStage(100), "inventory");
  assert.equal(explosionStage(Number.NaN), "assembled");
});

test("a part starts at home, ends in its own cell, and moves continuously between", () => {
  const parts = atlas();
  const pivot = { y: 1.543 };
  const { cells } = createExplosionLayout(parts, 1.4);
  for (const part of parts.slice(0, 40)) {
    const center = centreOf(part);
    const cell = cells.get(part.id);
    const args = { part, center, pivot, cell };
    assert.ok(explodedOffset({ ...args, amount: 0 }).every((value) => Math.abs(value) < 1e-12), "assembled is home");
    const end = explodedOffset({ ...args, amount: 1 });
    assert.ok(Math.abs(center.x + end[0] - cell.x) < 1e-9, "centre lands on the cell in x");
    assert.ok(Math.abs(center.y + end[1] - (cell.y + pivot.y)) < 1e-9, "centre lands on the cell in y");
    assert.ok(Math.abs(center.z + end[2]) < 1e-9, "depth is flattened onto the inventory plane");
    let last = explodedOffset({ ...args, amount: 0 });
    for (let i = 1; i <= 200; i++) {
      const next = explodedOffset({ ...args, amount: i / 200 });
      const step = Math.hypot(...next.map((value, axis) => value - last[axis]));
      assert.ok(step < 0.05, `no jump larger than 5cm at ${i / 2}%`);
      last = next;
    }
  }
});

test("the separated stage is a rigid bearing per tissue with a vertical stretch about the pivot", () => {
  const parts = atlas();
  const pivot = { y: 1.543 };
  const first = parts.find((part) => part.group === "muscles");
  const high = { ...centreOf(first), y: pivot.y + 0.1 };
  const low = { ...centreOf(first), y: pivot.y - 0.1 };
  const [hx, hy, hz] = explodedOffset({ part: first, center: high, pivot, amount: SEPARATION_END });
  const [lx, ly, lz] = explodedOffset({ part: first, center: low, pivot, amount: SEPARATION_END });
  assert.equal(hx, lx, "same tissue, same horizontal bearing");
  assert.equal(hz, lz);
  assert.ok(hy > 0 && ly < 0, "parts above the pivot rise and parts below it sink");
  assert.ok(Math.abs(hy + ly) < 1e-12, "the stretch is symmetric about the pivot");
  const radial = Math.hypot(hx, hz);
  assert.ok(Math.abs(radial - SEPARATION_RADIUS) < 1e-12);
  assert.deepEqual([hx, hz], [tissueSeparation(first)[0], tissueSeparation(first)[2]]);
});

test("a part the layout does not hold stays separated instead of vanishing", () => {
  const part = atlas()[0];
  const center = centreOf(part);
  const pivot = { y: 1.543 };
  const atEnd = explodedOffset({ part, center, pivot, amount: 1 });
  const atSeparated = explodedOffset({ part, center, pivot, amount: SEPARATION_END });
  assert.deepEqual(atEnd, atSeparated);
});

test("inventory rows are centred and tissue blocks are set apart", () => {
  const parts = atlas();
  for (const aspect of [0.5, 1, 1.7]) {
    const { cells, width } = createExplosionLayout(parts, aspect);
    const rows = new Map();
    for (const part of parts) {
      const cell = cells.get(part.id);
      const key = (cell.y + cell.height / 2).toFixed(9);
      rows.set(key, [...(rows.get(key) || []), cell]);
    }
    for (const row of rows.values()) {
      const left = Math.min(...row.map((cell) => cell.x - cell.width / 2));
      const right = Math.max(...row.map((cell) => cell.x + cell.width / 2));
      assert.ok(Math.abs(left + right) < 1e-8, "each row is centred on the layout axis");
      assert.ok(right - left <= width + 1e-8);
    }
  }
});
