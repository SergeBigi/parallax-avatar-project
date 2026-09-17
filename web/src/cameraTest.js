import { CAMERA_CONSTRAINTS, cameraErrorDetails, publicTrackDetails, summarizeDevices } from "./cameraDiagnostics.js";
import "./camera-test.css";

const elements = {
  title: document.querySelector("#result-title"),
  code: document.querySelector("#result-code"),
  detail: document.querySelector("#result-detail"),
  dot: document.querySelector("#status-dot"),
  video: document.querySelector("#camera-preview"),
  placeholder: document.querySelector("#video-placeholder"),
  videoMetrics: document.querySelector("#video-metrics"),
  start: document.querySelector("#start-button"),
  stop: document.querySelector("#stop-button"),
  refresh: document.querySelector("#refresh-button"),
  copy: document.querySelector("#copy-button"),
  capabilities: document.querySelector("#capability-list"),
  devices: document.querySelector("#device-list"),
  log: document.querySelector("#diagnostic-log"),
};

let activeStream = null;
const report = [];

function now() {
  return new Date().toISOString();
}

function appendLog(message, data) {
  const suffix = data === undefined ? "" : `\n${JSON.stringify(data, null, 2)}`;
  report.push(`[${now()}] ${message}${suffix}`);
  elements.log.textContent = report.join("\n\n");
}

function setResult(state, title, code, detail) {
  elements.dot.dataset.state = state;
  elements.title.textContent = title;
  elements.code.textContent = code;
  elements.code.dataset.state = state;
  elements.detail.textContent = detail;
}

function addCapability(label, value, state = "neutral") {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  description.dataset.state = state;
  row.append(term, description);
  elements.capabilities.append(row);
}

async function permissionState() {
  if (!navigator.permissions?.query) return "API nicht verfügbar";
  try {
    const permission = await navigator.permissions.query({ name: "camera" });
    return permission.state;
  } catch (error) {
    return `nicht abfragbar (${error.name || "Fehler"})`;
  }
}

async function inspectCapabilities() {
  elements.capabilities.replaceChildren();
  const mediaDevicesAvailable = Boolean(navigator.mediaDevices);
  const getUserMediaAvailable = typeof navigator.mediaDevices?.getUserMedia === "function";
  const enumerateAvailable = typeof navigator.mediaDevices?.enumerateDevices === "function";
  const permission = await permissionState();

  addCapability("Sicherer Kontext", window.isSecureContext ? "Ja" : "Nein", window.isSecureContext ? "ok" : "error");
  addCapability("mediaDevices", mediaDevicesAvailable ? "Vorhanden" : "Fehlt", mediaDevicesAvailable ? "ok" : "error");
  addCapability("getUserMedia", getUserMediaAvailable ? "Vorhanden" : "Fehlt", getUserMediaAvailable ? "ok" : "error");
  addCapability("enumerateDevices", enumerateAvailable ? "Vorhanden" : "Fehlt", enumerateAvailable ? "ok" : "error");
  addCapability("Kameraberechtigung", permission, permission === "denied" ? "error" : "neutral");
  addCapability("Browserkennung", navigator.userAgent || "nicht gemeldet");
  addCapability("Seitenadresse", window.location.href);

  appendLog("Browser-Funktionen geprüft", {
    secureContext: window.isSecureContext,
    mediaDevices: mediaDevicesAvailable,
    getUserMedia: getUserMediaAvailable,
    enumerateDevices: enumerateAvailable,
    cameraPermission: permission,
    userAgent: navigator.userAgent,
    location: window.location.href,
  });
}

async function inspectDevices() {
  elements.devices.replaceChildren();
  if (typeof navigator.mediaDevices?.enumerateDevices !== "function") {
    const item = document.createElement("li");
    item.textContent = "enumerateDevices() ist nicht verfügbar.";
    elements.devices.append(item);
    appendLog("Geräteliste nicht verfügbar");
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    if (cameras.length === 0) {
      const item = document.createElement("li");
      item.textContent = "Keine Videoeingabe aufgelistet.";
      elements.devices.append(item);
    } else {
      cameras.forEach((camera, index) => {
        const item = document.createElement("li");
        item.textContent = `${index + 1}. ${camera.label || "Kamera ohne freigegebenen Namen"}`;
        elements.devices.append(item);
      });
    }
    appendLog("Mediengeräte aufgelistet", summarizeDevices(devices));
    return devices;
  } catch (error) {
    const details = cameraErrorDetails(error, window.isSecureContext);
    const item = document.createElement("li");
    item.textContent = `${details.name}: ${details.message}`;
    elements.devices.append(item);
    appendLog("enumerateDevices() fehlgeschlagen", details);
    return [];
  }
}

function stopCamera({ updateResult = true } = {}) {
  activeStream?.getTracks().forEach((track) => track.stop());
  activeStream = null;
  elements.video.srcObject = null;
  elements.video.classList.remove("is-live");
  elements.placeholder.hidden = false;
  elements.videoMetrics.textContent = "–";
  elements.start.disabled = false;
  elements.start.textContent = "Kamera erneut testen";
  elements.stop.disabled = true;
  if (updateResult) {
    setResult("neutral", "Stream gestoppt", "GESTOPPT", "Der Kamerastream wurde beendet. Der vorherige Diagnosebericht bleibt erhalten.");
    appendLog("Kamerastream gestoppt");
  }
}

async function startCamera() {
  stopCamera({ updateResult: false });
  elements.start.disabled = true;
  elements.start.textContent = "Kamera wird geöffnet …";
  setResult("working", "Kamera wird angefordert", "LÄUFT", "Bitte bestätige einen eventuell angezeigten Berechtigungsdialog.");
  appendLog("getUserMedia() gestartet", CAMERA_CONSTRAINTS);

  if (!window.isSecureContext || typeof navigator.mediaDevices?.getUserMedia !== "function") {
    const error = new TypeError("navigator.mediaDevices.getUserMedia ist nicht verfügbar");
    showCameraError(error);
    return;
  }

  try {
    activeStream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    const videoTracks = activeStream.getVideoTracks();
    appendLog("getUserMedia() erfolgreich", { videoTracks: videoTracks.length, audioTracks: activeStream.getAudioTracks().length });

    if (videoTracks.length === 0) throw new DOMException("Der Stream enthält keinen Video-Track.", "NotReadableError");

    const track = videoTracks[0];
    track.addEventListener("ended", () => {
      appendLog("Video-Track wurde vom Browser oder Betriebssystem beendet");
      if (activeStream) stopCamera({ updateResult: false });
      setResult("error", "Kamerastream beendet", "TRACK_ENDED", "Der Video-Track wurde nach erfolgreichem Start extern beendet.");
    }, { once: true });

    elements.video.srcObject = activeStream;
    await elements.video.play();
    elements.video.classList.add("is-live");
    elements.placeholder.hidden = true;
    elements.stop.disabled = false;
    elements.start.textContent = "Kamera aktiv";

    const trackDetails = publicTrackDetails(track);
    const videoSize = `${elements.video.videoWidth || trackDetails.width || "?"} × ${elements.video.videoHeight || trackDetails.height || "?"}`;
    const frameRate = trackDetails.frameRate ? ` · ${Math.round(trackDetails.frameRate)} fps` : "";
    elements.videoMetrics.textContent = `${videoSize}${frameRate}`;
    appendLog("HTML-Video gibt den Kamerastream wieder", trackDetails);
    setResult("success", "Kamera funktioniert", "STREAM_OK", "Silk/Fire OS hat der Webseite einen Videostream übergeben. Falls das Eye-Tracking trotzdem scheitert, liegt der Fehler erst in einer späteren Verarbeitungsschicht.");
    await inspectCapabilities();
    await inspectDevices();
  } catch (error) {
    activeStream?.getTracks().forEach((track) => track.stop());
    activeStream = null;
    showCameraError(error);
  }
}

function showCameraError(error) {
  const details = cameraErrorDetails(error, window.isSecureContext);
  elements.start.disabled = false;
  elements.start.textContent = "Erneut versuchen";
  elements.stop.disabled = true;
  setResult("error", "Kameratest fehlgeschlagen", details.name, `${details.diagnosis} Browsermeldung: ${details.message}`);
  appendLog("Kameratest fehlgeschlagen", details);
}

async function copyReport() {
  const text = [
    "ParallaxView Kamera-Diagnose",
    `Ergebnis: ${elements.code.textContent} – ${elements.title.textContent}`,
    `Details: ${elements.detail.textContent}`,
    "",
    ...report,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    const previous = elements.copy.textContent;
    elements.copy.textContent = "Bericht kopiert";
    setTimeout(() => { elements.copy.textContent = previous; }, 1800);
  } catch (error) {
    appendLog("Bericht konnte nicht kopiert werden", cameraErrorDetails(error, window.isSecureContext));
    elements.copy.textContent = "Kopieren fehlgeschlagen";
  }
}

elements.start.addEventListener("click", startCamera);
elements.stop.addEventListener("click", () => stopCamera());
elements.refresh.addEventListener("click", async () => {
  await inspectCapabilities();
  await inspectDevices();
});
elements.copy.addEventListener("click", copyReport);
window.addEventListener("pagehide", () => stopCamera({ updateResult: false }));

async function initialize() {
  appendLog("Diagnoseseite geladen");
  await inspectCapabilities();
  await inspectDevices();
}

void initialize();
