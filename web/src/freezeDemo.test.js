import assert from "node:assert/strict";
import test from "node:test";

import { createAnimationFreezeGate, isFreezeShortcut } from "./freezeDemo.js";

test("space is handled outside form controls", () => {
  assert.equal(isFreezeShortcut({ code: "Space", target: { tagName: "DIV" } }), true);
  assert.equal(isFreezeShortcut({ key: " ", target: { tagName: "CANVAS" } }), true);
  assert.equal(isFreezeShortcut({ code: "Space", target: { tagName: "INPUT" } }), false);
  assert.equal(isFreezeShortcut({ code: "Enter", target: { tagName: "DIV" } }), false);
});

test("animation callbacks stay pending while frozen and resume afterwards", () => {
  let nextId = 1;
  const pending = new Map();
  const request = (callback) => { const id = nextId++; pending.set(id, callback); return id; };
  const cancel = (id) => pending.delete(id);
  const step = (time) => {
    const batch = [...pending.entries()];
    pending.clear();
    for (const [, callback] of batch) callback(time);
  };
  const gate = createAnimationFreezeGate(request, cancel);
  let calls = 0;
  gate.requestAnimationFrame(() => { calls += 1; });
  gate.setFrozen(true);
  step(10);
  assert.equal(calls, 0);
  assert.equal(pending.size, 1);
  gate.setFrozen(false);
  step(20);
  assert.equal(calls, 1);
  assert.equal(pending.size, 0);
});

test("cancelAnimationFrame cancels a callback while frozen", () => {
  let nextId = 1;
  const pending = new Map();
  const request = (callback) => { const id = nextId++; pending.set(id, callback); return id; };
  const cancel = (id) => pending.delete(id);
  const gate = createAnimationFreezeGate(request, cancel);
  const token = gate.requestAnimationFrame(() => assert.fail("cancelled callback ran"));
  gate.setFrozen(true);
  gate.cancelAnimationFrame(token);
  assert.equal(pending.size, 0);
});
