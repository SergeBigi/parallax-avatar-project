import { installSpaceFreezeDemo } from "./freezeDemo.js";

const userAgent = navigator.userAgent ?? "";
const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

globalThis.__PARALLAX_MOBILE_SAFE__ = isIOS;

if (isIOS) {
  try {
    const key = "parallax-view-calibration-v1";
    const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
    localStorage.setItem(key, JSON.stringify({ ...saved, renderQuality: "0.75" }));
  } catch {
    // Local storage is optional. The app still uses the mobile-safe avatar path.
  }
}

installSpaceFreezeDemo();
await import("./main.js");
