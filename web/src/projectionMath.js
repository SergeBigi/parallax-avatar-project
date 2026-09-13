const MIN_EYE_DISTANCE_METERS = 0.12;

/**
 * Calculate the asymmetric frustum created by an eye looking through a
 * rectangular screen plane. The screen is centred on the origin at z = 0;
 * the viewer is in front of it on positive z and the scene is behind it.
 */
export function computeOffAxisFrustum({
  eye,
  screenWidth,
  screenHeight,
  near = 0.01,
  far = 10,
}) {
  if (!eye || !Number.isFinite(eye.x) || !Number.isFinite(eye.y) || !Number.isFinite(eye.z)) {
    throw new TypeError("eye must contain finite x, y and z coordinates");
  }
  if (screenWidth <= 0 || screenHeight <= 0) {
    throw new RangeError("screen dimensions must be positive");
  }
  if (near <= 0 || far <= near) {
    throw new RangeError("clipping distances are invalid");
  }

  const distance = Math.max(eye.z, MIN_EYE_DISTANCE_METERS);
  const scale = near / distance;

  return {
    left: (-screenWidth / 2 - eye.x) * scale,
    right: (screenWidth / 2 - eye.x) * scale,
    bottom: (-screenHeight / 2 - eye.y) * scale,
    top: (screenHeight / 2 - eye.y) * scale,
    near,
    far,
    distance,
  };
}

/**
 * Estimate a metric viewer position from MediaPipe face landmarks. Depth is
 * still derived from the apparent separation of both eyes, while x/y can use
 * either physical eye as the monoscopic off-axis viewpoint.
 */
export function estimateEyePosition({
  landmarks,
  videoWidth,
  videoHeight,
  ipdMeters,
  horizontalFovDegrees,
  cameraOffsetY,
  mirrorX = true,
  trackedEye = "right",
}) {
  if (!landmarks || landmarks.length < 363 || videoWidth <= 0 || videoHeight <= 0) {
    return null;
  }

  const average = (a, b) => ({
    x: (landmarks[a].x + landmarks[b].x) / 2,
    y: (landmarks[a].y + landmarks[b].y) / 2,
  });

  // MediaPipe landmark indices refer to the subject's physical eyes.
  const rightEye = average(33, 133);
  const leftEye = average(362, 263);
  const dxPixels = (rightEye.x - leftEye.x) * videoWidth;
  const dyPixels = (rightEye.y - leftEye.y) * videoHeight;
  const eyeDistancePixels = Math.hypot(dxPixels, dyPixels);

  if (!Number.isFinite(eyeDistancePixels) || eyeDistancePixels < 4) {
    return null;
  }

  const horizontalFovRadians = (horizontalFovDegrees * Math.PI) / 180;
  const focalPixels = videoWidth / (2 * Math.tan(horizontalFovRadians / 2));
  const z = clamp((focalPixels * ipdMeters) / eyeDistancePixels, 0.25, 2.5);

  const selectedEye = trackedEye === "left"
    ? leftEye
    : trackedEye === "midpoint"
      ? { x: (rightEye.x + leftEye.x) / 2, y: (rightEye.y + leftEye.y) / 2 }
      : rightEye;
  const centreX = selectedEye.x * videoWidth;
  const centreY = selectedEye.y * videoHeight;
  const xFromCamera = ((centreX - videoWidth / 2) * z) / focalPixels;
  const yFromCamera = (-(centreY - videoHeight / 2) * z) / focalPixels;

  return {
    x: (mirrorX ? -1 : 1) * xFromCamera,
    y: cameraOffsetY + yFromCamera,
    z,
  };
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export class ExponentialPoseFilter {
  constructor(initialPose) {
    this.value = { ...initialPose };
  }

  update(target, deltaSeconds, timeConstantSeconds) {
    if (timeConstantSeconds <= 0) {
      this.value = { ...target };
      return this.value;
    }

    const alpha = 1 - Math.exp(-Math.max(deltaSeconds, 0) / timeConstantSeconds);
    this.value.x += (target.x - this.value.x) * alpha;
    this.value.y += (target.y - this.value.y) * alpha;
    this.value.z += (target.z - this.value.z) * alpha;
    return this.value;
  }
}
