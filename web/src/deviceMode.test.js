import assert from "node:assert/strict";
import test from "node:test";

import { detectRuntimeProfile } from "./deviceMode.js";

test("Amazon Silk enables Echo-safe and mobile-safe rendering", () => {
  const profile = detectRuntimeProfile({
    userAgent: "Mozilla/5.0 (Linux; U; en-US) AppleWebKit/537.36 Silk/126.4 like Chrome Safari/537.36",
  });
  assert.equal(profile.isSilk, true);
  assert.equal(profile.isEchoSafe, true);
  assert.equal(profile.mobileSafe, true);
});

test("Fire device identifiers enable Echo-safe rendering even without Silk token", () => {
  const profile = detectRuntimeProfile({ userAgent: "Mozilla/5.0 Linux AFTMM Build/PS7669" });
  assert.equal(profile.isFireDevice, true);
  assert.equal(profile.isEchoSafe, true);
});

test("ordinary desktop Chrome stays on the full rendering path", () => {
  const profile = detectRuntimeProfile({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0 Safari/537.36",
    platform: "Win32",
  });
  assert.equal(profile.mobileSafe, false);
  assert.equal(profile.isEchoSafe, false);
});

test("touch iPad compatibility detection is preserved", () => {
  const profile = detectRuntimeProfile({ userAgent: "Mozilla/5.0", platform: "MacIntel", maxTouchPoints: 5 });
  assert.equal(profile.isIOS, true);
  assert.equal(profile.mobileSafe, true);
});
