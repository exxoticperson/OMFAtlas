import assert from "node:assert/strict";
import { test } from "node:test";
import {
  materialEmissive,
  materialEmissiveIntensity,
  partColor,
  schematicKind,
} from "../src/realism-v2.js";
import { groups } from "../src/content.js";

test("clinical schematics use specimen colors and no emissive glow", () => {
  const nerve = {
    schematic: true,
    group: "nerves",
    name: "Inferior alveolar nerve",
  };
  assert.equal(schematicKind(nerve), "nerve");
  assert.equal(partColor(nerve, groups, { presentation: "clinical" }), "#e8d4a8");
  assert.equal(materialEmissive(nerve, { presentation: "clinical" }), "#000000");
  assert.equal(materialEmissiveIntensity(nerve, { presentation: "clinical" }), 0);

  const artery = {
    schematic: true,
    group: "arteries",
    name: "Facial artery",
  };
  assert.equal(partColor(artery, groups, { presentation: "clinical" }), "#8c322e");
});

test("teaching mode keeps subtle schematic emissive for layer contrast", () => {
  const nerve = {
    schematic: true,
    group: "nerves",
    name: "Mental nerve",
  };
  assert.equal(materialEmissiveIntensity(nerve, { presentation: "teaching" }), 0.04);
});
