import assert from "node:assert/strict";
import test from "node:test";

import { cameraErrorDetails, publicTrackDetails, summarizeDevices } from "./cameraDiagnostics.js";

test("cameraErrorDetails preserves the exact browser error", () => {
  const error = Object.assign(new Error("Permission denied by system"), { name: "NotAllowedError" });
  assert.deepEqual(cameraErrorDetails(error), {
    name: "NotAllowedError",
    message: "Permission denied by system",
    constraint: null,
    diagnosis: "Der Browser oder das Betriebssystem hat den Kamerazugriff blockiert.",
  });
});

test("cameraErrorDetails prioritizes an insecure context", () => {
  const result = cameraErrorDetails(new TypeError("mediaDevices is undefined"), false);
  assert.equal(result.name, "TypeError");
  assert.match(result.diagnosis, /HTTPS/);
});

test("summarizeDevices groups browser media device kinds", () => {
  assert.deepEqual(summarizeDevices([
    { kind: "videoinput" },
    { kind: "videoinput" },
    { kind: "audioinput" },
    { kind: "unknown" },
  ]), { videoinput: 2, audioinput: 1, audiooutput: 0, other: 1 });
});

test("publicTrackDetails omits device identifiers", () => {
  const details = publicTrackDetails({
    label: "Front Camera",
    readyState: "live",
    muted: false,
    enabled: true,
    getSettings: () => ({ width: 640, height: 480, frameRate: 30, deviceId: "private-id" }),
  });
  assert.equal(details.width, 640);
  assert.equal(details.height, 480);
  assert.equal("deviceId" in details, false);
});
