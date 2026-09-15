import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createImportedRoom, inspectRoomGlb, fitRoomBounds } from "./importedRoom.js";

function glb(json = { asset: { version: "2.0" } }) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const length = Math.ceil(text.length / 4) * 4;
  const buffer = new ArrayBuffer(length + 20);
  const view = new DataView(buffer);
  [0x46546c67, 2, buffer.byteLength, length, 0x4e4f534a].forEach((n, i) => view.setUint32(i * 4, n, true));
  const bytes = new Uint8Array(buffer, 20); bytes.fill(32); bytes.set(text);
  return buffer;
}
function model() {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(4, 3, 5), new THREE.MeshStandardMaterial()));
  return { scene };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { resolve, promise };
}

test("local imports reject truncated GLB and remote or relative texture requests", () => {
  assert.throws(() => inspectRoomGlb(new ArrayBuffer(5)));
  const broken = glb(); new DataView(broken).setUint32(12, 10000, true);
  assert.throws(() => inspectRoomGlb(broken));
  for (const uri of ["https://example.com/track.png", "../texture.png"]) {
    assert.throws(() => inspectRoomGlb(glb({ asset: { version: "2.0" }, images: [{ uri }] })), /externe/);
  }
  assert.equal(inspectRoomGlb(glb()).title, "Eigener Wohnraum");
});

test("default fit preserves proportions and keeps the room behind the display at laptop and phone sizes", () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-2, -1, -3), new THREE.Vector3(2, 2, 2));
  for (const [screenWidth, screenHeight] of [[0.494, 0.298], [0.286, 0.191], [0.07, 0.15]]) {
    const fit = fitRoomBounds(bounds, { screenWidth, screenHeight, roomDepth: 0.45 });
    assert.equal(fit.scale.x, fit.scale.y);
    assert.equal(fit.scale.y, fit.scale.z);
    assert.ok(bounds.max.z * fit.scale.z + fit.position.z < 0);
    assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).x * fit.scale.x + fit.position.x) < 1e-9);
  }
});

test("a failed replacement leaves the working room and stored model intact", async () => {
  const writes = [], statuses = [];
  const room = createImportedRoom(new THREE.Scene(), {
    loadModel: async () => model(), prepare: () => {},
    storage: async (mode, record) => { if (mode === "write") writes.push(record); },
    onStatus: (status) => statuses.push(status),
  });
  assert.equal(await room.install(glb(), "room.glb"), true);
  const previous = room.object.children[0].children[0];
  assert.equal(await room.install(new ArrayBuffer(5), "broken.glb"), false);
  assert.equal(room.isReady(), true);
  assert.equal(room.object.children[0].children[0], previous);
  assert.equal(writes.length, 1);
  assert.equal(statuses.at(-1).state, "error");
});

test("a slow cached restore cannot overwrite a newly selected file", async () => {
  const read = deferred(); const installed = [];
  const room = createImportedRoom(new THREE.Scene(), {
    storage: (mode) => mode === "read" ? read.promise : Promise.resolve(),
    loadModel: async () => model(), prepare: () => {}, onLoaded: (info) => installed.push(info.name),
  });
  const restore = room.restore();
  await room.install(glb(), "new.glb");
  read.resolve({ buffer: glb(), name: "old.glb" }); await restore;
  assert.deepEqual(installed, ["new.glb"]);
});

test("storage failure still displays the room and repeated layouts do not recalculate", async () => {
  const statuses = [];
  const room = createImportedRoom(new THREE.Scene(), {
    storage: async () => { throw new Error("quota"); }, loadModel: async () => model(), prepare: () => {},
    onStatus: (status) => statuses.push(status),
  });
  assert.equal(await room.install(glb(), "room.glb"), true);
  assert.match(statuses.at(-1).message, /erneut auswählen/);
  const context = { screenWidth: 0.494, screenHeight: 0.298, roomDepth: 0.45 };
  assert.equal(room.update(context), true);
  assert.equal(room.update(context), false);
  room.setView({ angle: 90 });
  assert.equal(room.update(context), true);
  const size = new THREE.Box3().setFromObject(room.object, true).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x / size.z - 5 / 4) < 1e-6, "rotation is fitted before scaling");
});
