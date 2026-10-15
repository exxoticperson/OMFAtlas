import test from "node:test";
import assert from "node:assert/strict";
import {
  SOURCE_CHILD,
  SOURCE_PARENT,
  PROTOCOL_VERSION,
  createParentOriginGuard,
} from "../src/embed-bridge.js";

test("postMessage v1 constants", () => {
  assert.equal(SOURCE_CHILD, "omf-atlas");
  assert.equal(SOURCE_PARENT, "fakarny");
  assert.equal(PROTOCOL_VERSION, 1);
});

test("createParentOriginGuard enforces configured origin in production mode", () => {
  const guard = createParentOriginGuard("https://app.fakarny.example");
  assert.equal(guard("https://app.fakarny.example"), true);
  assert.equal(guard("https://evil.example"), false);
});
