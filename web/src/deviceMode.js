export function detectRuntimeProfile({ userAgent = "", platform = "", maxTouchPoints = 0 } = {}) {
  const ua = String(userAgent);
  const isIOS = /iPad|iPhone|iPod/i.test(ua)
    || (platform === "MacIntel" && Number(maxTouchPoints) > 1);
  const isSilk = /(?:^|\s)Silk\//i.test(ua);
  const isFireDevice = /\b(?:KF[A-Z0-9]+|AFT[A-Z0-9]+)\b/i.test(ua);
  const isEchoSafe = isSilk || isFireDevice;

  return {
    isIOS,
    isSilk,
    isFireDevice,
    isEchoSafe,
    mobileSafe: isIOS || isEchoSafe,
  };
}
