import * as THREE from "three";

import { computeOffAxisFrustum, estimateEyePosition, ExponentialPoseFilter, poseTuningFromControls } from "./projectionMath.js";
import { createParallaxScene } from "./scene.js";
import { TrackingClient } from "./trackingClient.js";
import "./style.css";

const MEDIAPIPE_VERSION = "0.10.22-rc.20250304";
const WASM_PATH = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const ROOM_VIEW_KEY = "parallax-local-room-view-v1";
const SETTINGS_KEY = "parallax-view-calibration-v1";
const DEPTH_INVERSION_REFERENCE_METERS = 0.65;

const elements = {
  viewport: document.querySelector("#viewport"),
  canvas: document.querySelector("#scene-canvas"),
  cameraButton: document.querySelector("#camera-button"),
  fullscreenButton: document.querySelector("#fullscreen-button"),
  fullscreenNote: document.querySelector("#fullscreen-note"),
  mouseMode: document.querySelector("#mouse-mode"),
  mirrorX: document.querySelector("#mirror-x"),
  mirrorZ: document.querySelector("#mirror-z"),
  trackedEye: document.querySelector("#tracked-eye"),
  avatarAnimation: document.querySelector("#avatar-animation"),
  sceneSelect: document.querySelector("#scene-select"),
  sceneDescription: document.querySelector("#scene-description"),
  sceneCredit: document.querySelector("#scene-credit"),
  roomControls: document.querySelector("#room-controls"),
  avatarControls: document.querySelector("#avatar-controls"),
  avatarStatus: document.querySelector("#avatar-status"),
  roomFile: document.querySelector("#room-file"),
  roomStatus: document.querySelector("#room-status"),
  roomAngle: document.querySelector("#room-angle"),
  roomZoom: document.querySelector("#room-zoom"),
  roomElevation: document.querySelector("#room-elevation"),
  panelToggle: document.querySelector("#panel-toggle"),
  panelContent: document.querySelector("#panel-content"),
  trackingStatus: document.querySelector("#tracking-status"),
  webcamPreview: document.querySelector("#webcam-preview"),
  renderQuality: document.querySelector("#render-quality"),
  trackingBackend: document.querySelector("#tracking-backend"),
  renderFps: document.querySelector("#render-fps"),
  trackingFps: document.querySelector("#tracking-fps"),
  metricX: document.querySelector("#metric-x"),
  metricY: document.querySelector("#metric-y"),
  metricZ: document.querySelector("#metric-z"),
};

const controlDefinitions = {
  screenWidth: { input: "screen-width", output: "screen-width-output", suffix: " mm", fallback: 286 },
  screenHeight: { input: "screen-height", output: "screen-height-output", suffix: " mm", fallback: 191 },
  cameraY: { input: "camera-y", output: "camera-y-output", suffix: " mm", fallback: 104 },
  ipd: { input: "ipd", output: "ipd-output", suffix: " mm", fallback: 64 },
  fov: { input: "fov", output: "fov-output", suffix: "°", fallback: 60 },
  smoothing: { input: "smoothing", output: "smoothing-output", suffix: " ms", fallback: 60 },
  jitterDeadband: { input: "jitter-deadband", output: "jitter-deadband-output", suffix: " mm", fallback: 3 },
  depthResponse: { input: "depth-response", output: "depth-response-output", suffix: " %", fallback: 45 },
  roomDepth: { input: "room-depth", output: "room-depth-output", suffix: " cm", fallback: 45 },
  avatarDepth: { input: "avatar-depth", output: "avatar-depth-output", suffix: " cm", fallback: 2 },
};

const controls = Object.fromEntries(Object.entries(controlDefinitions).map(([key, definition]) => [key, {
  ...definition,
  input: document.querySelector(`#${definition.input}`),
  output: document.querySelector(`#${definition.output}`),
}]));

const renderer = new THREE.WebGLRenderer({ canvas: elements.canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 10);
camera.rotation.set(0, 0, 0);
const sceneController = createParallaxScene(scene, { renderer, onAvatarStatus: updateAvatarStatus, onRoomStatus: updateRoomStatus, onRoomLoaded: updateRoomView });
const poseFilter = new ExponentialPoseFilter({ x: 0, y: 0.095, z: 0.65 });

let targetPose = { x: 0, y: 0.095, z: 0.65 };
let faceLandmarker = null;
let trackingClient = null;
let trackingTimer = null;
let trackingGeneration = 0;
let lastMetricsTimestamp = 0;
let calibration;
let cameraStream = null;
let lastVideoTime = -1;
let trackedFrames = 0;
let trackingWindowStarted = performance.now();
let renderedFrames = 0;
let renderWindowStarted = performance.now();
let lastFrameTimestamp = performance.now();
let trackingBusy = false;
let latestFaceBlendshapes = [];

loadSettings();
bindControls();
applyRenderQuality();
updateFullscreenState();
new ResizeObserver(resizeRenderer).observe(elements.viewport);

elements.viewport.addEventListener("pointermove", (event) => {
  if (!elements.mouseMode.checked || event.target !== elements.canvas) return;
  const rect = elements.viewport.getBoundingClientRect();
  const nx = (event.clientX - rect.left) / rect.width - 0.5;
  const ny = (event.clientY - rect.top) / rect.height - 0.5;
  targetPose = { x: nx * 0.42, y: -ny * 0.25, z: targetPose.z };
});

elements.viewport.addEventListener("wheel", (event) => {
  if (!elements.mouseMode.checked || event.target !== elements.canvas) return;
  event.preventDefault();
  targetPose = { ...targetPose, z: THREE.MathUtils.clamp(targetPose.z + event.deltaY * 0.0005, 0.3, 1.5) };
}, { passive: false });

elements.cameraButton.addEventListener("click", startWebcamTracking);
elements.fullscreenButton.addEventListener("click", async () => {
  if (!document.fullscreenElement) await elements.viewport.requestFullscreen();
  else await document.exitFullscreen();
});
document.addEventListener("fullscreenchange", updateFullscreenState);

elements.panelToggle.addEventListener("click", () => {
  const expanded = elements.panelToggle.getAttribute("aria-expanded") === "true";
  elements.panelToggle.setAttribute("aria-expanded", String(!expanded));
  elements.panelToggle.setAttribute("aria-label", expanded ? "Kalibrierung ausklappen" : "Kalibrierung einklappen");
  elements.panelToggle.querySelector("span").textContent = expanded ? "+" : "−";
  elements.panelContent.hidden = expanded;
});

renderer.setAnimationLoop(renderFrame);

function bindControls() {
  applySceneSelection();
  elements.sceneSelect.addEventListener("change", () => { applySceneSelection(); saveSettings(); });
  Object.values(controls).forEach((control) => {
    const renderValue = () => { control.output.value = `${control.input.value}${control.suffix}`; };
    control.input.addEventListener("input", () => { renderValue(); saveSettings(); });
    renderValue();
  });
  calibration = readCalibration();
  elements.renderQuality.addEventListener("change", () => { applyRenderQuality(); saveSettings(); });
  elements.mouseMode.addEventListener("change", () => {
    trackingGeneration += 1;
    trackedFrames = 0;
    trackingWindowStarted = performance.now();
    if (elements.mouseMode.checked) latestFaceBlendshapes = [];
    setTrackingStatus(elements.mouseMode.checked ? "Mausmodus" : cameraStream ? "Webcam aktiv" : "Webcam aus");
  });
  elements.mirrorX.addEventListener("change", saveSettings);
  elements.mirrorZ.addEventListener("change", saveSettings);
  elements.trackedEye.addEventListener("change", saveSettings);
  elements.avatarAnimation.addEventListener("change", saveSettings);
  elements.roomFile.addEventListener("change", async () => {
    const file = elements.roomFile.files?.[0];
    if (!file) return;
    elements.roomFile.disabled = true;
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error("Bitte eine GLB-Datei bis 64 MB auswählen.");
      const buffer = await file.arrayBuffer();
      if (await sceneController.importRoom(buffer, file.name)) {
        elements.sceneSelect.value = "room-doll";
        applySceneSelection(); saveSettings();
      }
    } catch (error) { updateRoomStatus({ state: "error", message: error.message }); }
    finally { elements.roomFile.disabled = false; elements.roomFile.value = ""; }
  });
  for (const control of [elements.roomAngle, elements.roomZoom, elements.roomElevation]) {
    control.addEventListener("input", () => {
      const view = { angle: Number(elements.roomAngle.value), zoom: Number(elements.roomZoom.value), elevation: Number(elements.roomElevation.value) };
      sceneController.setRoomView(view);
      try { localStorage.setItem(ROOM_VIEW_KEY, JSON.stringify(view)); } catch { /* optional */ }
    });
  }
}

function applySceneSelection() {
  const mode = sceneController.setMode(elements.sceneSelect.value);
  elements.sceneSelect.value = mode;
  elements.sceneDescription.textContent = elements.sceneSelect.selectedOptions[0].dataset.description;
  elements.sceneCredit.hidden = mode !== "bars";
  elements.roomControls.hidden = mode === "bars";
  elements.avatarControls.hidden = mode !== "room-doll";
}

function readCalibration() {
  const jitterDeadbandMeters = Number(controls.jitterDeadband.input.value) / 1000;
  const depthResponse = Number(controls.depthResponse.input.value) / 100;
  return {
    screenWidth: Number(controls.screenWidth.input.value) / 1000,
    screenHeight: Number(controls.screenHeight.input.value) / 1000,
    cameraOffsetY: Number(controls.cameraY.input.value) / 1000,
    ipdMeters: Number(controls.ipd.input.value) / 1000,
    horizontalFovDegrees: Number(controls.fov.input.value),
    smoothingSeconds: Number(controls.smoothing.input.value) / 1000,
    jitterDeadbandMeters,
    depthResponse,
    poseTuning: poseTuningFromControls(jitterDeadbandMeters, depthResponse),
    roomDepth: Number(controls.roomDepth.input.value) / 100,
    avatarDepth: Number(controls.avatarDepth.input.value) / 100,
    mirrorX: elements.mirrorX.checked,
    mirrorZ: elements.mirrorZ.checked,
    trackedEye: elements.trackedEye.value,
    avatarAnimation: elements.avatarAnimation.value,
  };
}

function saveSettings() {
  trackingGeneration += 1;
  calibration = readCalibration();
  const values = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, Number(control.input.value)]));
  values.mirrorX = elements.mirrorX.checked;
  values.mirrorZ = elements.mirrorZ.checked;
  values.trackedEye = elements.trackedEye.value;
  values.avatarAnimation = elements.avatarAnimation.value;
  values.renderQuality = elements.renderQuality.value;
  values.scene = elements.sceneSelect.value;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(values)); } catch { /* storage is optional */ }
}

function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
  } catch { saved = {}; }
  Object.entries(controls).forEach(([key, control]) => {
    const value = Number(saved[key]);
    control.input.value = Number.isFinite(value) ? String(value) : String(control.fallback);
  });
  elements.renderQuality.value = ["0.75", "1", "1.5"].includes(saved.renderQuality) ? saved.renderQuality : "1";
  elements.mirrorX.checked = saved.mirrorX ?? true;
  elements.mirrorZ.checked = saved.mirrorZ ?? true;
  elements.trackedEye.value = ["right", "left"].includes(saved.trackedEye) ? saved.trackedEye : "right";
  elements.avatarAnimation.value = ["idle", "walk", "jump"].includes(saved.avatarAnimation) ? saved.avatarAnimation : "idle";
  const savedScene = saved.scene === "avatar" ? "room-doll" : saved.scene;
  elements.sceneSelect.value = ["bars", "room", "room-doll"].includes(savedScene) ? savedScene : "bars";
}

async function startWebcamTracking() {
  if (!navigator.mediaDevices?.getUserMedia) { setTrackingStatus("Webcam im Browser nicht verfügbar", true); return; }
  elements.cameraButton.disabled = true;
  elements.cameraButton.textContent = "Webcam wird vorbereitet …";
  setTrackingStatus("Modell wird geladen");
  try {
    cameraStream = await openCamera();
    elements.webcamPreview.srcObject = cameraStream;
    await elements.webcamPreview.play();
    await prepareTracking();
    lastVideoTime = -1;
    trackingWindowStarted = performance.now();
    scheduleTracking();
    elements.mouseMode.checked = false;
    elements.cameraButton.textContent = "Webcam aktiv";
    setTrackingStatus("Gesicht suchen …");
  } catch (error) {
    console.error(error);
    stopTracking();
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    setTrackingStatus(cameraErrorMessage(error), true);
    elements.cameraButton.textContent = "Erneut versuchen";
    elements.cameraButton.disabled = false;
  }
}

function openCamera() {
  return navigator.mediaDevices.getUserMedia({ audio: false, video: {
    facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 },
  } });
}

async function createFaceLandmarker() {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const commonOptions = {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" }, runningMode: "VIDEO", numFaces: 1,
    minFaceDetectionConfidence: 0.55, minFacePresenceConfidence: 0.55, minTrackingConfidence: 0.55,
    outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false,
  };
  try { return await FaceLandmarker.createFromOptions(vision, commonOptions); }
  catch (gpuError) {
    console.warn("GPU face tracking unavailable; using CPU.", gpuError);
    return FaceLandmarker.createFromOptions(vision, { ...commonOptions, baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" } });
  }
}

async function prepareTracking() {
  if (typeof Worker !== "undefined" && typeof createImageBitmap === "function" && typeof OffscreenCanvas !== "undefined") {
    try {
      trackingClient = new TrackingClient(new Worker(`${import.meta.env.BASE_URL}tracking-worker.js`));
      await trackingClient.init(MODEL_PATH);
      elements.trackingBackend.textContent = `Separat · ${trackingClient.delegate}`;
      return;
    } catch (error) {
      console.warn("Separate tracking unavailable; using compatibility mode.", error);
      trackingClient?.close();
      trackingClient = null;
    }
  }
  faceLandmarker = await createFaceLandmarker();
  elements.trackingBackend.textContent = "Kompatibilitätsmodus";
}

function scheduleTracking() {
  clearTimeout(trackingTimer);
  const tick = async () => {
    const started = performance.now();
    await updateTracking(started);
    // Tracking measurements are capped at 20 Hz. Rendering keeps running at
    // display refresh rate and interpolates between these measurements.
    if (cameraStream) trackingTimer = setTimeout(tick, Math.max(0, 50 - (performance.now() - started)));
  };
  trackingTimer = setTimeout(tick, 0);
}

async function updateTracking(now) {
  const video = elements.webcamPreview;
  if (document.hidden || elements.mouseMode.checked || (!trackingClient && !faceLandmarker) || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.currentTime === lastVideoTime || trackingBusy) return;
  trackingBusy = true;
  lastVideoTime = video.currentTime;
  const generation = trackingGeneration;
  const frameCalibration = calibration;
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  try {
    const response = trackingClient ? await trackingClient.detect(video, now) : { result: faceLandmarker.detectForVideo(video, now) };
    if (!response || generation !== trackingGeneration || elements.mouseMode.checked || document.hidden) return;
    const result = response.result;
    const landmarks = result.faceLandmarks?.[0];
    latestFaceBlendshapes = result.faceBlendshapes?.[0]?.categories ?? [];
    const estimatedPose = estimateEyePosition({
      landmarks, videoWidth, videoHeight, ipdMeters: frameCalibration.ipdMeters,
      horizontalFovDegrees: frameCalibration.horizontalFovDegrees, cameraOffsetY: frameCalibration.cameraOffsetY,
      mirrorX: frameCalibration.mirrorX, trackedEye: frameCalibration.trackedEye,
    });
    if (estimatedPose) {
      if (frameCalibration.mirrorZ) estimatedPose.z = THREE.MathUtils.clamp((DEPTH_INVERSION_REFERENCE_METERS ** 2) / estimatedPose.z, 0.25, 2.5);
      targetPose = estimatedPose;
      trackedFrames += 1;
      setTrackingStatus("Webcam-Tracking");
    } else {
      latestFaceBlendshapes = [];
      setTrackingStatus("Kein Gesicht erkannt");
    }
  } catch (error) {
    console.error(error);
    latestFaceBlendshapes = [];
    stopTracking();
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    elements.webcamPreview.srcObject = null;
    elements.cameraButton.disabled = false;
    elements.cameraButton.textContent = "Erneut versuchen";
    setTrackingStatus("Trackingfehler – bitte erneut starten", true);
  } finally { trackingBusy = false; }
}

function stopTracking() {
  trackingGeneration += 1;
  clearTimeout(trackingTimer);
  trackingClient?.close();
  trackingClient = null;
  faceLandmarker?.close();
  faceLandmarker = null;
}

function applyRenderQuality() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, Number(elements.renderQuality.value)));
  resizeRenderer();
}

function renderFrame(now) {
  const deltaSeconds = Math.min((now - lastFrameTimestamp) / 1000, 0.1);
  lastFrameTimestamp = now;

  const eye = poseFilter.update(targetPose, deltaSeconds, calibration.smoothingSeconds, calibration.poseTuning);
  const frustum = computeOffAxisFrustum({ eye, screenWidth: calibration.screenWidth, screenHeight: calibration.screenHeight, near: 0.01, far: 10 });
  camera.position.set(eye.x, eye.y, eye.z);
  camera.rotation.set(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.projectionMatrix.makePerspective(frustum.left, frustum.right, frustum.top, frustum.bottom, frustum.near, frustum.far, camera.coordinateSystem);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  if (sceneController.update({ ...calibration, elapsedSeconds: now / 1000, faceBlendshapes: latestFaceBlendshapes })) renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  if (now - lastMetricsTimestamp >= 200) {
    updateMetrics(eye);
    lastMetricsTimestamp = now;
  }
  updateFps(now);
}

function resizeRenderer() {
  renderer.setSize(elements.viewport.clientWidth, elements.viewport.clientHeight, false);
}
function updateMetrics(eye) {
  elements.metricX.textContent = `${Math.round(eye.x * 1000)} mm`;
  elements.metricY.textContent = `${Math.round(eye.y * 1000)} mm`;
  elements.metricZ.textContent = `${Math.round(eye.z * 1000)} mm`;
}
function updateFps(now) {
  renderedFrames += 1;
  if (now - renderWindowStarted >= 1000) {
    elements.renderFps.textContent = `${Math.round((renderedFrames * 1000) / (now - renderWindowStarted))} fps`;
    renderedFrames = 0; renderWindowStarted = now;
  }
  if (now - trackingWindowStarted >= 1000) {
    elements.trackingFps.textContent = (faceLandmarker || trackingClient) && !elements.mouseMode.checked ? `${Math.round((trackedFrames * 1000) / (now - trackingWindowStarted))} fps` : "–";
    trackedFrames = 0; trackingWindowStarted = now;
  }
}
function updateRoomStatus(status) {
  elements.roomStatus.dataset.state = status.state;
  elements.roomStatus.textContent = status.message;
}
function updateRoomView(view) {
  if (view.restored) {
    try { Object.assign(view, JSON.parse(localStorage.getItem(ROOM_VIEW_KEY) ?? "{}")); } catch { /* optional */ }
  } else {
    try { localStorage.removeItem(ROOM_VIEW_KEY); } catch { /* optional */ }
  }
  elements.roomAngle.value = String(view.angle);
  elements.roomZoom.value = String(view.zoom);
  elements.roomElevation.value = String(view.elevation);
  sceneController.setRoomView(view);
}
function updateAvatarStatus(status) {
  if (!elements.avatarStatus) return;
  elements.avatarStatus.dataset.state = status.state;
  elements.avatarStatus.textContent = status.message;
}
function setTrackingStatus(message, isError = false) {
  if (elements.trackingStatus.dataset.message === message && elements.trackingStatus.classList.contains("is-error") === isError) return;
  elements.trackingStatus.dataset.message = message;
  elements.trackingStatus.classList.toggle("is-error", isError);
  elements.trackingStatus.classList.toggle("is-live", message === "Webcam-Tracking");
  elements.trackingStatus.querySelector("span:last-child").textContent = message;
}
function updateFullscreenState() {
  const fullscreen = Boolean(document.fullscreenElement);
  elements.fullscreenButton.textContent = fullscreen ? "Vollbild verlassen" : "Vollbild";
  elements.fullscreenNote.hidden = fullscreen;
}
function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") return "Webcam-Berechtigung verweigert";
  if (error?.name === "NotFoundError") return "Keine Webcam gefunden";
  if (!window.isSecureContext) return "Webcam benötigt localhost oder HTTPS";
  return "Webcam konnte nicht gestartet werden";
}
