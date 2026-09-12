import * as THREE from "three";

import { computeOffAxisFrustum, estimateEyePosition, ExponentialPoseFilter } from "./projectionMath.js";
import { createParallaxScene } from "./scene.js";
import "./style.css";

const MEDIAPIPE_VERSION = "0.10.22-rc.20250304";
const WASM_PATH = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
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
  sceneSelect: document.querySelector("#scene-select"),
  panelToggle: document.querySelector("#panel-toggle"),
  panelContent: document.querySelector("#panel-content"),
  trackingStatus: document.querySelector("#tracking-status"),
  webcamPreview: document.querySelector("#webcam-preview"),
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
  smoothing: { input: "smoothing", output: "smoothing-output", suffix: " ms", fallback: 90 },
};

const controls = Object.fromEntries(
  Object.entries(controlDefinitions).map(([key, definition]) => [
    key,
    {
      ...definition,
      input: document.querySelector(`#${definition.input}`),
      output: document.querySelector(`#${definition.output}`),
    },
  ]),
);

const renderer = new THREE.WebGLRenderer({
  canvas: elements.canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 10);
camera.rotation.set(0, 0, 0);
const sceneController = createParallaxScene(scene);
const poseFilter = new ExponentialPoseFilter({ x: 0, y: 0.095, z: 0.65 });

let targetPose = { x: 0, y: 0.095, z: 0.65 };
let faceLandmarker = null;
let cameraStream = null;
let lastVideoTime = -1;
let lastTrackingTimestamp = 0;
let trackedFrames = 0;
let trackingWindowStarted = performance.now();
let renderedFrames = 0;
let renderWindowStarted = performance.now();
let lastFrameTimestamp = performance.now();
let trackingBusy = false;

loadSettings();
bindControls();
resizeRenderer();
updateFullscreenState();

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(elements.viewport);

elements.viewport.addEventListener("pointermove", (event) => {
  if (!elements.mouseMode.checked) return;
  const rect = elements.viewport.getBoundingClientRect();
  const nx = event.clientX / rect.width - 0.5;
  const ny = event.clientY / rect.height - 0.5;
  targetPose = {
    x: nx * 0.42,
    y: -ny * 0.25,
    z: targetPose.z,
  };
});

elements.viewport.addEventListener(
  "wheel",
  (event) => {
    if (!elements.mouseMode.checked) return;
    event.preventDefault();
    targetPose.z = THREE.MathUtils.clamp(targetPose.z + event.deltaY * 0.0005, 0.3, 1.5);
  },
  { passive: false },
);

elements.cameraButton.addEventListener("click", startWebcamTracking);
elements.fullscreenButton.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await elements.viewport.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});
document.addEventListener("fullscreenchange", updateFullscreenState);

elements.panelToggle.addEventListener("click", () => {
  const expanded = elements.panelToggle.getAttribute("aria-expanded") === "true";
  elements.panelToggle.setAttribute("aria-expanded", String(!expanded));
  elements.panelToggle.setAttribute(
    "aria-label",
    expanded ? "Kalibrierung ausklappen" : "Kalibrierung einklappen",
  );
  elements.panelToggle.querySelector("span").textContent = expanded ? "+" : "−";
  elements.panelContent.hidden = expanded;
});

renderer.setAnimationLoop(renderFrame);

function bindControls() {
  sceneController.setMode(elements.sceneSelect.value);
  elements.sceneSelect.addEventListener("change", () => {
    sceneController.setMode(elements.sceneSelect.value);
    saveSettings();
  });
  Object.values(controls).forEach((control) => {
    const renderValue = () => {
      control.output.value = `${control.input.value}${control.suffix}`;
    };
    control.input.addEventListener("input", () => {
      renderValue();
      saveSettings();
    });
    renderValue();
  });

  elements.mouseMode.addEventListener("change", () => {
    setTrackingStatus(elements.mouseMode.checked ? "Mausmodus" : cameraStream ? "Webcam aktiv" : "Webcam aus");
  });
  elements.mirrorX.addEventListener("change", saveSettings);
  elements.mirrorZ.addEventListener("change", saveSettings);
}

function readCalibration() {
  return {
    screenWidth: Number(controls.screenWidth.input.value) / 1000,
    screenHeight: Number(controls.screenHeight.input.value) / 1000,
    cameraOffsetY: Number(controls.cameraY.input.value) / 1000,
    ipdMeters: Number(controls.ipd.input.value) / 1000,
    horizontalFovDegrees: Number(controls.fov.input.value),
    smoothingSeconds: Number(controls.smoothing.input.value) / 1000,
    mirrorX: elements.mirrorX.checked,
    mirrorZ: elements.mirrorZ.checked,
  };
}

function saveSettings() {
  const values = Object.fromEntries(
    Object.entries(controls).map(([key, control]) => [key, Number(control.input.value)]),
  );
  values.mirrorX = elements.mirrorX.checked;
  values.mirrorZ = elements.mirrorZ.checked;
  values.scene = elements.sceneSelect.value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(values));
}

function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
  } catch {
    saved = {};
  }

  Object.entries(controls).forEach(([key, control]) => {
    const value = Number(saved[key]);
    control.input.value = Number.isFinite(value) ? String(value) : String(control.fallback);
  });
  elements.mirrorX.checked = saved.mirrorX ?? true;
  elements.mirrorZ.checked = saved.mirrorZ ?? true;
  elements.sceneSelect.value = saved.scene === "avatar" ? "avatar" : "bars";
}

async function startWebcamTracking() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setTrackingStatus("Webcam im Browser nicht verfügbar", true);
    return;
  }

  elements.cameraButton.disabled = true;
  elements.cameraButton.textContent = "Webcam wird vorbereitet …";
  setTrackingStatus("Modell wird geladen");

  try {
    const [stream, landmarker] = await Promise.all([openCamera(), createFaceLandmarker()]);
    cameraStream = stream;
    faceLandmarker = landmarker;
    elements.webcamPreview.srcObject = stream;
    await elements.webcamPreview.play();
    elements.mouseMode.checked = false;
    elements.cameraButton.textContent = "Webcam aktiv";
    setTrackingStatus("Gesicht suchen …");
  } catch (error) {
    console.error(error);
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    setTrackingStatus(cameraErrorMessage(error), true);
    elements.cameraButton.textContent = "Erneut versuchen";
    elements.cameraButton.disabled = false;
  }
}

function openCamera() {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
    },
  });
}

async function createFaceLandmarker() {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const commonOptions = {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.55,
    minFacePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  };

  try {
    return await FaceLandmarker.createFromOptions(vision, commonOptions);
  } catch (gpuError) {
    console.warn("GPU face tracking unavailable; using CPU.", gpuError);
    return FaceLandmarker.createFromOptions(vision, {
      ...commonOptions,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
    });
  }
}

function updateTracking(now) {
  const video = elements.webcamPreview;
  if (
    elements.mouseMode.checked ||
    !faceLandmarker ||
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.currentTime === lastVideoTime ||
    now - lastTrackingTimestamp < 40 ||
    trackingBusy
  ) {
    return;
  }

  trackingBusy = true;
  lastVideoTime = video.currentTime;
  lastTrackingTimestamp = now;

  try {
    const result = faceLandmarker.detectForVideo(video, now);
    const landmarks = result.faceLandmarks?.[0];
    const calibration = readCalibration();
    const estimatedPose = estimateEyePosition({
      landmarks,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      ipdMeters: calibration.ipdMeters,
      horizontalFovDegrees: calibration.horizontalFovDegrees,
      cameraOffsetY: calibration.cameraOffsetY,
      mirrorX: calibration.mirrorX,
    });

    if (estimatedPose) {
      // Reverse only the tracked depth response around the default viewing
      // distance. Moving closer now enlarges the scene; moving away shrinks it.
      if (calibration.mirrorZ) {
        estimatedPose.z = THREE.MathUtils.clamp(
          (DEPTH_INVERSION_REFERENCE_METERS ** 2) / estimatedPose.z,
          0.25,
          2.5,
        );
      }
      targetPose = estimatedPose;
      trackedFrames += 1;
      setTrackingStatus("Webcam-Tracking");
    } else {
      setTrackingStatus("Kein Gesicht erkannt");
    }
  } catch (error) {
    console.error(error);
    setTrackingStatus("Trackingfehler", true);
  } finally {
    trackingBusy = false;
  }
}

function renderFrame(now) {
  const deltaSeconds = Math.min((now - lastFrameTimestamp) / 1000, 0.1);
  lastFrameTimestamp = now;
  updateTracking(now);

  const calibration = readCalibration();
  const eye = poseFilter.update(targetPose, deltaSeconds, calibration.smoothingSeconds);
  const frustum = computeOffAxisFrustum({
    eye,
    screenWidth: calibration.screenWidth,
    screenHeight: calibration.screenHeight,
    near: 0.01,
    far: 10,
  });

  camera.position.set(eye.x, eye.y, eye.z);
  camera.rotation.set(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.projectionMatrix.makePerspective(
    frustum.left,
    frustum.right,
    frustum.top,
    frustum.bottom,
    frustum.near,
    frustum.far,
    camera.coordinateSystem,
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  sceneController.update(now / 1000, calibration);
  renderer.render(scene, camera);
  updateMetrics(eye);
  updateFps(now);
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = elements.viewport;
  renderer.setSize(clientWidth, clientHeight, false);
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
    renderedFrames = 0;
    renderWindowStarted = now;
  }
  if (now - trackingWindowStarted >= 1000) {
    elements.trackingFps.textContent = faceLandmarker
      ? `${Math.round((trackedFrames * 1000) / (now - trackingWindowStarted))} fps`
      : "–";
    trackedFrames = 0;
    trackingWindowStarted = now;
  }
}

function setTrackingStatus(message, isError = false) {
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
