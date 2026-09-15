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

/** Translate user-facing stability controls into axis-specific filter tuning. */
export function poseTuningFromControls(xyDeadbandMeters = 0.003, depthResponse = 0.45) {
  const response = clamp(Number(depthResponse) || 0.45, 0.2, 1);
  return {
    xyDeadbandMeters: Math.max(0, Number(xyDeadbandMeters) || 0),
    // At low depth response, ignore more Z noise and use a longer Z-only time
    // constant. X/Y responsiveness is deliberately unaffected.
    zDeadbandMeters: 0.004 + (1 - response) * 0.016,
    minimumZSmoothingSeconds: 0.07 + (1 - response) * 0.24,
    zSmoothingMultiplier: 1 + (1 - response) * 3,
  };
}

/**
 * Keep tiny measurement changes out of the rendered pose without adding the
 * large latency of a heavy low-pass filter. Once a movement leaves the quiet
 * zone, only the part outside the zone is followed. This produces hysteresis
 * around a stationary head while remaining responsive to intentional motion.
 */
export function followOutsideDeadband(current, measured, radius) {
  if (!Number.isFinite(current) || !Number.isFinite(measured)) return current;
  const deadband = Math.max(0, Number(radius) || 0);
  const delta = measured - current;
  if (Math.abs(delta) <= deadband) return current;
  return measured - Math.sign(delta) * deadband;
}

export class ExponentialPoseFilter {
  constructor(initialPose, {
    xyDeadbandMeters = 0.0025,
    zDeadbandMeters = 0.012,
    minimumZSmoothingSeconds = 0.16,
    zSmoothingMultiplier = 2.4,
  } = {}) {
    this.value = { ...initialPose };
    this.target = { ...initialPose };
    this.lastMeasurement = null;
    this.xyDeadbandMeters = xyDeadbandMeters;
    this.zDeadbandMeters = zDeadbandMeters;
    this.minimumZSmoothingSeconds = minimumZSmoothingSeconds;
    this.zSmoothingMultiplier = zSmoothingMultiplier;
  }

  update(target, deltaSeconds, timeConstantSeconds, tuning = {}) {
    const xyDeadbandMeters = tuning.xyDeadbandMeters ?? this.xyDeadbandMeters;
    const zDeadbandMeters = tuning.zDeadbandMeters ?? this.zDeadbandMeters;
    const minimumZSmoothingSeconds = tuning.minimumZSmoothingSeconds ?? this.minimumZSmoothingSeconds;
    const zSmoothingMultiplier = tuning.zSmoothingMultiplier ?? this.zSmoothingMultiplier;

    // targetPose is replaced whenever a new MediaPipe measurement arrives. Do
    // the deadband work only once per measurement, not once per render frame.
    if (target !== this.lastMeasurement) {
      this.target.x = followOutsideDeadband(this.target.x, target.x, xyDeadbandMeters);
      this.target.y = followOutsideDeadband(this.target.y, target.y, xyDeadbandMeters);
      this.target.z = followOutsideDeadband(this.target.z, target.z, zDeadbandMeters);
      this.lastMeasurement = target;
    }

    const dt = Math.max(deltaSeconds, 0);
    if (timeConstantSeconds <= 0) {
      this.value.x = this.target.x;
      this.value.y = this.target.y;
      this.value.z = this.target.z;
      return this.value;
    }

    const xyAlpha = 1 - Math.exp(-dt / timeConstantSeconds);
    const zTimeConstant = Math.max(
      minimumZSmoothingSeconds,
      timeConstantSeconds * zSmoothingMultiplier,
    );
    const zAlpha = 1 - Math.exp(-dt / zTimeConstant);
    this.value.x += (this.target.x - this.value.x) * xyAlpha;
    this.value.y += (this.target.y - this.value.y) * xyAlpha;
    this.value.z += (this.target.z - this.value.z) * zAlpha;
    return this.value;
  }
}
