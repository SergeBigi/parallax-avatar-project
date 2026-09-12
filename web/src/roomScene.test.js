import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createRoomScene } from "./roomScene.js";
import { computeOffAxisFrustum } from "./projectionMath.js";

function cameraAt(eye, screenWidth = 0.286, screenHeight = 0.191) {
  const camera = new THREE.PerspectiveCamera();
  const frustum = computeOffAxisFrustum({ eye, screenWidth, screenHeight });
  camera.position.set(eye.x, eye.y, eye.z);
  camera.updateMatrixWorld(true);
  camera.projectionMatrix.makePerspective(
    frustum.left, frustum.right, frustum.top, frustum.bottom, frustum.near, frustum.far,
  );
  return camera;
}

test("room opening stays attached to all four display corners as the eye moves", () => {
  const scene = new THREE.Scene();
  const room = createRoomScene(scene);
  room.update({ screenWidth: 0.286, screenHeight: 0.191, roomDepth: 0.45 });
  scene.updateMatrixWorld(true);
  const architecture = scene.getObjectByName("Room architecture");
  for (const eye of [
    { x: 0, y: 0.095, z: 0.65 },
    { x: -0.15, y: 0.12, z: 0.25 },
    { x: 0.2, y: -0.08, z: 2.5 },
  ]) {
    const camera = cameraAt(eye);
    for (const x of [-0.5, 0.5]) {
      for (const y of [-0.5, 0.5]) {
        const corner = architecture.localToWorld(new THREE.Vector3(x, y, 0)).project(camera);
        assert.ok(Math.abs(corner.x - x * 2) < 1e-6);
        assert.ok(Math.abs(corner.y - y * 2) < 1e-6);
      }
    }
  }
});

test("the complete doll stands on the floor and fits inside every supported room size", () => {
  const scene = new THREE.Scene();
  const room = createRoomScene(scene);
  const doll = scene.getObjectByName("Wooden doll");
  for (const screenWidth of [0.18, 0.286, 0.8]) {
    for (const screenHeight of [0.12, 0.191, 0.5]) {
      for (const roomDepth of [0.15, 0.45, 1]) {
        room.update({ screenWidth, screenHeight, roomDepth });
        scene.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(doll, true);
        assert.ok(Math.abs(bounds.min.y + screenHeight / 2) < 1e-6, "feet touch the floor");
        assert.ok(bounds.max.y < screenHeight / 2, "head below ceiling");
        assert.ok(bounds.min.x > -screenWidth / 2 && bounds.max.x < screenWidth / 2);
        assert.ok(bounds.min.z > -roomDepth && bounds.max.z < 0, "doll behind the display");
        assert.equal(doll.scale.x, doll.scale.y, "no stretched doll");
        assert.equal(doll.scale.y, doll.scale.z);
      }
    }
  }
});

test("near and far features have different horizontal and vertical parallax without moving the doll", () => {
  const scene = new THREE.Scene();
  createRoomScene(scene);
  scene.updateMatrixWorld(true);
  const doll = scene.getObjectByName("Wooden doll");
  const originalTransform = doll.matrixWorld.clone();
  const head = scene.getObjectByName("Doll head").getWorldPosition(new THREE.Vector3());
  const wall = new THREE.Vector3(head.x, head.y, -0.45);
  const centre = cameraAt({ x: 0, y: 0, z: 0.65 });
  for (const axis of ["x", "y"]) {
    const shifted = cameraAt({ x: 0, y: 0, z: 0.65, [axis]: 0.08 });
    const headShift = head.clone().project(shifted)[axis] - head.clone().project(centre)[axis];
    const wallShift = wall.clone().project(shifted)[axis] - wall.clone().project(centre)[axis];
    assert.ok(headShift > 0);
    assert.ok(wallShift > headShift, "back wall shifts farther than the nearer doll");
  }
  const nearEye = cameraAt({ x: 0, y: 0, z: 0.3 });
  const farEye = cameraAt({ x: 0, y: 0, z: 1.2 });
  const sizeAt = (camera) => head.clone().add(new THREE.Vector3(0.05, 0, 0)).project(camera).x
    - head.clone().project(camera).x;
  assert.ok(sizeAt(farEye) > sizeAt(nearEye), "off-axis depth response through a fixed window");
  assert.ok(doll.matrixWorld.equals(originalTransform), "only the viewpoint changes");
});

test("hiding the doll preserves the room and changing room depth refreshes static shadows", () => {
  const scene = new THREE.Scene();
  const room = createRoomScene(scene);
  const doll = scene.getObjectByName("Wooden doll");
  room.setDollVisible(false);
  assert.equal(doll.visible, false);
  assert.equal(scene.getObjectByName("Room architecture").visible, true);
  room.setDollVisible(true);
  assert.equal(doll.visible, true);
  assert.equal(room.update({ roomDepth: 0.8 }), true);
  assert.equal(room.update({ roomDepth: 0.8 }), false);
  assert.equal(room.update({ roomDepth: 0.15 }), true);
});
