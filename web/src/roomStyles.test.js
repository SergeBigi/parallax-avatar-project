import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRoomStyle, ROOM_STYLE_IDS } from "./roomStyles.js";

test("built-in designs and the imported room are selectable", () => {
  assert.deepEqual(ROOM_STYLE_IDS, ["studio", "stream", "corridor", "imported"]);
  for (const id of ROOM_STYLE_IDS) assert.equal(normalizeRoomStyle(id), id);
});

test("invalid room designs fall back to the futuristic studio", () => {
  assert.equal(normalizeRoomStyle("unknown"), "studio");
  assert.equal(normalizeRoomStyle(null), "studio");
});

test("a valid custom fallback is respected", () => {
  assert.equal(normalizeRoomStyle("unknown", "corridor"), "corridor");
});
