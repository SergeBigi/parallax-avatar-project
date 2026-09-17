export const CAMERA_CONSTRAINTS = Object.freeze({ audio: false, video: true });

const ERROR_DIAGNOSES = Object.freeze({
  NotAllowedError: "Der Browser oder das Betriebssystem hat den Kamerazugriff blockiert.",
  PermissionDeniedError: "Der Browser oder das Betriebssystem hat den Kamerazugriff blockiert.",
  NotFoundError: "Der Browser meldet keine passende Kamera.",
  DevicesNotFoundError: "Der Browser meldet keine passende Kamera.",
  NotReadableError: "Die Kamera wurde gefunden, konnte aber nicht geöffnet werden. Sie kann gesperrt oder bereits belegt sein.",
  TrackStartError: "Die Kamera wurde gefunden, konnte aber nicht geöffnet werden. Sie kann gesperrt oder bereits belegt sein.",
  OverconstrainedError: "Die angeforderten Kameraeigenschaften werden nicht unterstützt.",
  ConstraintNotSatisfiedError: "Die angeforderten Kameraeigenschaften werden nicht unterstützt.",
  SecurityError: "Eine Sicherheitsrichtlinie verhindert den Kamerazugriff.",
  AbortError: "Der Browser hat das Öffnen der Kamera abgebrochen.",
  TypeError: "Die Seite läuft möglicherweise nicht in einem sicheren Kontext (HTTPS oder localhost).",
});

export function cameraErrorDetails(error, isSecureContext = true) {
  const name = typeof error?.name === "string" && error.name ? error.name : "Unbekannter Fehler";
  const message = typeof error?.message === "string" && error.message ? error.message : String(error ?? "Keine Fehlerdetails");
  const constraint = typeof error?.constraint === "string" && error.constraint ? error.constraint : null;
  const diagnosis = !isSecureContext
    ? "Die Seite läuft nicht über HTTPS oder localhost. Browser dürfen hier normalerweise keine Kamera freigeben."
    : ERROR_DIAGNOSES[name] ?? "Der Browser hat einen nicht näher klassifizierten Kamerafehler gemeldet.";

  return { name, message, constraint, diagnosis };
}

export function summarizeDevices(devices) {
  const counts = { videoinput: 0, audioinput: 0, audiooutput: 0, other: 0 };
  for (const device of devices ?? []) {
    if (Object.prototype.hasOwnProperty.call(counts, device.kind)) counts[device.kind] += 1;
    else counts.other += 1;
  }
  return counts;
}

export function publicTrackDetails(track) {
  if (!track) return null;
  const settings = typeof track.getSettings === "function" ? track.getSettings() : {};
  return {
    label: track.label || "(kein Kameraname)",
    readyState: track.readyState || "unbekannt",
    muted: Boolean(track.muted),
    enabled: Boolean(track.enabled),
    width: settings.width ?? null,
    height: settings.height ?? null,
    frameRate: settings.frameRate ?? null,
    facingMode: settings.facingMode ?? null,
    resizeMode: settings.resizeMode ?? null,
  };
}
