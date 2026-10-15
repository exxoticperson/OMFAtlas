import assert from "node:assert/strict";
import { test } from "node:test";
import {
  intraoralHighResEligible,
  intraoralStatusMessage,
  intraoralVisible,
  isIntraoralEligible,
  INTRAORAL_BONE_IDS,
  oralLookKey,
  selectedFdiFromState,
  SHIPPED_HR_PART_IDS,
} from "../src/intraoral.js";

test("intraoral mode shows teeth, gingiva, tongue and jaw bones only", () => {
  const state = {
    layers: new Set(["teeth", "gingiva", "soft"]),
    hidden: new Set(),
    isolated: false,
    intraoralShowBone: true,
  };
  assert.ok(
    intraoralVisible({ id: "t1", group: "teeth", schematic: false }, state),
  );
  assert.ok(
    !intraoralVisible({ id: "n1", group: "nerves", schematic: true }, state),
  );
  assert.ok(
    intraoralVisible({ id: "FJ3289", group: "bones", schematic: false }, state),
  );
  assert.ok(
    !intraoralVisible({ id: "FJ9999", group: "bones", schematic: false }, state),
  );
});

test("high-resolution swap applies to teeth and gingiva", () => {
  assert.ok(intraoralHighResEligible({ group: "teeth", schematic: false }));
  assert.ok(intraoralHighResEligible({ group: "gingiva", schematic: false }));
  assert.ok(!intraoralHighResEligible({ group: "bones", schematic: false }));
});

test("mandible is in oral bone allowlist", () => {
  assert.ok(INTRAORAL_BONE_IDS.has("FJ3289"));
  assert.ok(isIntraoralEligible({ id: "FJ3289", group: "bones", schematic: false }));
});

test("oral look cache key tracks model and selection", () => {
  const a = oralLookKey(
    {
      intraoralModel: "openfulljaw",
      selected: "FJ1",
      intraoralFocus: true,
      intraoralShowBone: true,
      layers: new Set(["teeth", "gingiva"]),
    },
    "intraoral-openfulljaw",
  );
  const b = oralLookKey(
    {
      intraoralModel: "openfulljaw",
      selected: "FJ2",
      intraoralFocus: true,
      intraoralShowBone: true,
      layers: new Set(["teeth", "gingiva"]),
    },
    "intraoral-openfulljaw",
  );
  assert.notEqual(a, b);
});

test("shipped HR ids and status copy", () => {
  assert.equal(SHIPPED_HR_PART_IDS.size, 5);
  assert.match(intraoralStatusMessage({ cbctReady: false }), /Atlas oral/);
  assert.match(
    intraoralStatusMessage({ cbctReady: true, archSource: "openfulljaw" }),
    /Open-Full-Jaw/,
  );
  const parts = [
    {
      id: "FJ1",
      group: "teeth",
      name: "Right upper central secondary incisor tooth",
    },
  ];
  assert.equal(
    selectedFdiFromState({ selected: "FJ1", tab: "intraoral" }, parts),
    11,
  );
});
