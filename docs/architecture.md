# Initial architecture

## Functional pipeline

1. **Tracker adapter** receives face/head landmarks or a 3D head pose.
2. **Eye estimator** calculates a stable cyclopean-eye position or a selected
   physical eye.
3. **Calibration transform** maps tracker coordinates into the physical
   display coordinate system.
4. **Pose filter and predictor** suppresses jitter and compensates part of the
   camera/render/display latency.
5. **Off-axis projection component** calculates the Unreal view and projection
   from the eye position and calibrated screen corners.
6. **Unreal renderer** draws the room and avatar for that viewpoint.
7. **Avatar behavior** uses the tracked viewer position as its gaze target.
8. **Conversation pipeline** later adds microphone input, speech recognition,
   an LLM, speech synthesis and audio-driven facial animation.

## Recommended delivery stages

| Stage | Scope | Exit criterion |
|---|---|---|
| 0 — Geometry test | Mouse-controlled eye point, grid room, normal monitor | Perspective remains geometrically plausible across the intended viewing box |
| 1 — Webcam tracking | One face, estimated 3D head pose, filtering and calibration UI | Stable illusion at 60 fps with acceptable jitter and latency |
| 2 — Avatar | MetaHuman or lightweight placeholder, lighting and gaze target | Avatar appears consistently located behind the display plane |
| 3 — Better tracking | Depth/IR tracker if webcam accuracy is insufficient | Reliable X/Y/Z over the required distance and lighting range |
| 4 — Conversation | STT, LLM, streaming TTS, lip sync and interruption handling | Natural turn-taking with measured end-to-end response latency |

## Early design decisions

- Use a Windows 11 laptop as the first proof-of-concept platform.
- Target one viewer; multi-viewer support is out of scope for a normal display.
- Start monoscopic and without glasses.
- Keep tracking behind an interface so webcam, TrueDepth and dedicated tracker
  implementations can be exchanged.
- Keep the projection kernel and calibration model independent of Unreal scene
  content so that a later tablet implementation can reuse the same geometry.
- Treat tablet and Echo Show deployment as separate paths. The Echo Show path
  requires an explicit feasibility check for camera/head-pose access and
  end-to-end streaming latency.
- Store all physical dimensions in metres and document coordinate conventions.
- Separate display calibration from personal eye/IPD calibration.
- Provide diagnostic overlays for the screen plane, tracked eye, raw/filtered
  pose, frustum and latency.

## Primary technical risks

| Risk | Why it matters | First mitigation |
|---|---|---|
| Incorrect tracker-to-screen transform | The virtual world swims or shears during head movement | Guided calibration plus a grid-room validation scene |
| Z-position error | Apparent scale and depth become unstable | Compare monocular webcam estimate with a depth-capable tracker |
| Jitter versus lag | Heavy smoothing feels delayed; light smoothing shakes | Timestamped samples, tunable filter and short-horizon prediction |
| Render/display latency | Perspective trails the user's head motion | 60+ fps target, low-latency display mode and latency measurement |
| MetaHuman performance | Face rendering may consume the frame budget | Validate geometry using a lightweight proxy first |
| Conflicting binocular cues | A single image cannot match both eyes | Optimize viewing distance and depth range; assess with both eyes open |
