import assert from "node:assert/strict";
import test from "node:test";

import { computeOffAxisFrustum, estimateEyePosition, ExponentialPoseFilter } from "./projectionMath.js";

test("centred eye produces a symmetric frustum", () => {
  const result = computeOffAxisFrustum({
    eye: { x: 0, y: 0, z: 0.5 },
    screenWidth: 0.3,
    screenHeight: 0.2,
  });

  assert.equal(result.left, -result.right);
  assert.equal(result.bottom, -result.top);
});

test("moving the eye right shifts the frustum left", () => {
  const result = computeOffAxisFrustum({
    eye: { x: 0.05, y: 0, z: 0.5 },
    screenWidth: 0.3,
    screenHeight: 0.2,
  });

  assert.ok(Math.abs(result.left) > Math.abs(result.right));
});

test("eye separation yields a finite metric pose", () => {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  landmarks[33] = landmarks[133] = { x: 0.45, y: 0.5 };
  landmarks[362] = landmarks[263] = { x: 0.55, y: 0.5 };

  const pose = estimateEyePosition({
    landmarks,
    videoWidth: 640,
    videoHeight: 480,
    ipdMeters: 0.064,
    horizontalFovDegrees: 60,
    cameraOffsetY: 0.1,
    trackedEye: "midpoint",
  });

  assert.ok(pose.z > 0.5 && pose.z < 0.6);
  assert.ok(Math.abs(pose.x) < Number.EPSILON);
  assert.equal(pose.y, 0.1);
});

test("right and left eye selections produce opposite monoscopic x offsets", () => {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  landmarks[33] = landmarks[133] = { x: 0.45, y: 0.5 };
  landmarks[362] = landmarks[263] = { x: 0.55, y: 0.5 };
  const base = {
    landmarks,
    videoWidth: 640,
    videoHeight: 480,
    ipdMeters: 0.064,
    horizontalFovDegrees: 60,
    cameraOffsetY: 0.1,
    mirrorX: false,
  };

  const right = estimateEyePosition({ ...base, trackedEye: "right" });
  const left = estimateEyePosition({ ...base, trackedEye: "left" });
  assert.ok(right.x < 0);
  assert.ok(left.x > 0);
  assert.ok(Math.abs(right.x + left.x) < 1e-12);
  assert.equal(right.z, left.z);
});

test("pose filter converges without overshooting", () => {
  const filter = new ExponentialPoseFilter({ x: 0, y: 0, z: 0.5 });
  const result = filter.update({ x: 1, y: -1, z: 1 }, 0.016, 0.09);

  assert.ok(result.x > 0 && result.x < 1);
  assert.ok(result.y < 0 && result.y > -1);
  assert.ok(result.z > 0.5 && result.z < 1);
});
