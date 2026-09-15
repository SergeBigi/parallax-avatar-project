/* Classic worker: MediaPipe's WASM loader uses importScripts. */
const VERSION = "0.10.22-rc.20250304";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const REQUIRED_LANDMARKS = [33, 133, 362, 263];
let landmarker;

function compactResult(result) {
  const face = result.faceLandmarks?.[0];
  const compactLandmarks = [];
  if (face) {
    // Preserve MediaPipe indices while cloning only the four points used by
    // estimateEyePosition. Sparse arrays keep the existing main-thread API.
    compactLandmarks.length = 363;
    for (const index of REQUIRED_LANDMARKS) {
      const point = face[index];
      if (point) compactLandmarks[index] = { x: point.x, y: point.y };
    }
  }

  const categories = result.faceBlendshapes?.[0]?.categories?.map((category) => ({
    categoryName: category.categoryName,
    displayName: category.displayName,
    score: category.score,
  })) ?? [];

  return {
    faceLandmarks: face ? [compactLandmarks] : [],
    faceBlendshapes: categories.length ? [{ categories }] : [],
  };
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      const { FaceLandmarker, FilesetResolver } = await import(`${CDN}/vision_bundle.mjs`);
      const vision = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const options = {
        baseOptions: { modelAssetPath: data.modelPath, delegate: "GPU" },
        canvas: new OffscreenCanvas(384, 288),
        runningMode: "VIDEO", numFaces: 1,
        minFaceDetectionConfidence: 0.55, minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55, outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      };
      let delegate = "GPU";
      try { landmarker = await FaceLandmarker.createFromOptions(vision, options); }
      catch {
        delegate = "CPU";
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          ...options, canvas: new OffscreenCanvas(384, 288),
          baseOptions: { ...options.baseOptions, delegate },
        });
      }
      self.postMessage({ type: "ready", delegate });
    } catch (error) {
      self.postMessage({ type: "error", message: String(error.message || error) });
    }
    return;
  }
  if (data.type !== "frame") return;
  const started = performance.now();
  try {
    const result = landmarker.detectForVideo(data.bitmap, data.timestamp);
    self.postMessage({ type: "result", result: compactResult(result), duration: performance.now() - started });
  } catch (error) {
    self.postMessage({ type: "error", message: String(error.message || error) });
  } finally {
    data.bitmap.close();
  }
};
