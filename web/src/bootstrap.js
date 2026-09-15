import { detectRuntimeProfile } from "./deviceMode.js";
import { installSpaceFreezeDemo } from "./freezeDemo.js";

const profile = detectRuntimeProfile({
  userAgent: navigator.userAgent ?? "",
  platform: navigator.platform ?? "",
  maxTouchPoints: navigator.maxTouchPoints ?? 0,
});

globalThis.__PARALLAX_MOBILE_SAFE__ = profile.mobileSafe;
globalThis.__PARALLAX_ECHO_SAFE__ = profile.isEchoSafe;

if (profile.mobileSafe) {
  try {
    const key = "parallax-view-calibration-v1";
    const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
    localStorage.setItem(key, JSON.stringify({ ...saved, renderQuality: "0.75" }));

    if (profile.isEchoSafe) {
      // Do not restore a previously imported heavy GLB on constrained Fire/Silk
      // hardware. Start from the lightweight built-in room for a stable baseline.
      localStorage.setItem("parallax-room-style-v1", "studio");
      const echoSettings = JSON.parse(localStorage.getItem(key) ?? "{}");
      localStorage.setItem(key, JSON.stringify({ ...echoSettings, scene: "room-doll" }));
    }
  } catch {
    // Local storage is optional. The app still uses the safe rendering path.
  }
}

installSpaceFreezeDemo();
await import("./main.js");
