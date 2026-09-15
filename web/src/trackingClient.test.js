import test from "node:test";
import assert from "node:assert/strict";
import { TrackingClient } from "./trackingClient.js";

function setup(options = {}) {
  const messages = [];
  const worker = { postMessage: (message) => messages.push(message), terminate() { this.terminated = true; } };
  const client = new TrackingClient(worker, options);
  const reply = (data) => worker.onmessage({ data });
  return { worker, client, messages, reply };
}

test("slow capture and inference cannot queue extra frames", async () => {
  let finishCapture;
  let closed = 0;
  const bitmap = { close() { closed++; } };
  const { client, messages, reply } = setup({ capture: () => new Promise(resolve => { finishCapture = resolve; }) });
  const first = client.detect({}, 10);
  assert.equal(await client.detect({}, 20), null);
  assert.equal(messages.length, 0);
  finishCapture(bitmap);
  await Promise.resolve();
  assert.equal(messages.length, 1);
  assert.equal(await client.detect({}, 30), null);
  reply({ type: "result", result: { faceLandmarks: [] } });
  assert.deepEqual((await first).result.faceLandmarks, []);
  assert.equal(closed, 1);
  assert.equal(client.busy, false);
  client.close();
});

test("worker failure releases the pending frame and permits a clean restart", async () => {
  let closed = false;
  const { client, worker, reply } = setup({ capture: async () => ({ close() { closed = true; } }) });
  const frame = client.detect({}, 10);
  await Promise.resolve();
  reply({ type: "error", message: "GPU lost" });
  await assert.rejects(frame, /GPU lost/);
  assert.ok(closed && worker.terminated && client.closed);
  assert.equal(client.busy, false);
});

test("closing during capture does not send a stale frame", async () => {
  let finishCapture;
  let closed = false;
  const { client, messages } = setup({ capture: () => new Promise(resolve => { finishCapture = resolve; }) });
  const frame = client.detect({}, 10);
  client.close();
  finishCapture({ close() { closed = true; } });
  await assert.rejects(frame, /closed/);
  assert.ok(closed);
  assert.equal(messages.length, 0);
});

test("worker initialization timeout rejects and terminates the worker", async () => {
  const { client, worker } = setup({ timeoutMs: 10 });
  await assert.rejects(client.init("model"), /timed out/);
  assert.ok(worker.terminated);
});

test("transfer failure closes the bitmap and clears the request", async () => {
  let closed = false;
  const { client, worker } = setup({ capture: async () => ({ close() { closed = true; } }) });
  worker.postMessage = () => { throw new Error("transfer failed"); };
  await assert.rejects(client.detect({}, 10), /transfer failed/);
  assert.ok(closed && worker.terminated);
  assert.equal(client.pending, null);
});

test("tracking is capped without queueing unnecessary camera captures", async () => {
  let captures = 0;
  const { client, reply } = setup({
    minIntervalMs: 50,
    capture: async () => { captures += 1; return { close() {} }; },
  });
  const first = client.detect({}, 100);
  await Promise.resolve();
  reply({ type: "result", result: { faceLandmarks: [] } });
  await first;
  assert.equal(await client.detect({}, 120), null);
  assert.equal(captures, 1);
  const second = client.detect({}, 151);
  await Promise.resolve();
  reply({ type: "result", result: { faceLandmarks: [] } });
  await second;
  assert.equal(captures, 2);
  client.close();
});
