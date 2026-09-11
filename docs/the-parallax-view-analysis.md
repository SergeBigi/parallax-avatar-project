# TheParallaxView — technical analysis

## Repository state

- Upstream: `https://github.com/algomystic/TheParallaxView.git`
- Default branch: `master`
- `master` head: `1af9570` from 2019-02-19
- Newer unmerged branch: `dev`, head `01ae0f1` from 2019-10-04
- Original project: Unity 2017.4.20f2, UnityARKitPlugin and Xcode 10.1
- `dev`: migration to Unity 2019.2.6f1, embedded UnityARKitPlugin and an
  additional HoloCubes scene

The repository is useful as a compact explanation of the geometry, but it is
not a suitable modern dependency. Its ARKit integration predates Unity AR
Foundation, its device checks target early TrueDepth iPhones, and both Unity
versions are obsolete.

## What the original application does

The application estimates the viewer's head pose with ARKit Face Tracking. It
then offsets a virtual eye from the face anchor, positions the render camera at
that eye and computes an asymmetric projection from the eye to the physical
iPhone screen rectangle.

The result is a monoscopic, head-coupled perspective. The screen behaves like a
window into a 3D scene. This is motion parallax, not binocular stereo.

## Relevant code

| File | Responsibility | Reuse assessment |
|---|---|---|
| `HeadTrackManager.cs` | Starts ARKit face tracking, receives face pose, corrects mirrored coordinates and exposes eye-selection data | Concept only; replace the obsolete Unity ARKit API |
| `SelectEye.cs` | Converts configured IPD and eye height from millimetres to a local eye offset | Reuse the calibration concept, not the implementation |
| `OffAxisProjection.cs` | Treats the device screen as a plane and builds the off-centre projection matrix | Main mathematical reference; reimplement and verify in Unreal coordinates |
| `CameraTracker.cs` | Copies the tracked iOS device pose and projection | Not required for a fixed desktop display |
| `CameraManager.cs` | Switches between diagnostic cameras | Useful pattern for debug views |
| `SceneManager.cs`, `SceneInfo.cs`, `UIManager.cs` | Demo content and settings | Not relevant to the core algorithm |

## Projection flow

1. ARKit delivers the face-anchor position and orientation in metres.
2. The code mirrors the X coordinate and parts of the quaternion to undo the
   mirrored front-camera convention.
3. A configured half-IPD offset selects one eye as the render viewpoint.
4. The physical screen is represented by the tracked device-camera plane.
5. The perpendicular eye-to-screen distance becomes the initial near distance.
6. Measured iPhone screen edges produce `left`, `right`, `top` and `bottom`.
7. All four extents are scaled to a 1 cm render near plane without changing
   their angular relationship.
8. `PerspectiveOffCenter()` writes the asymmetric projection matrix used by the
   eye camera.

The hard-coded screen measurements in `OffAxisProjection.cs` are specific to
the iPhone X landscape arrangement and camera-origin convention. They must not
be copied into a monitor implementation.

## Important limitations

- Only one eye view is rendered. Motion parallax works with both eyes open, but
  binocular disparity conflicts with the single rendered viewpoint. The author
  reports the strongest illusion when the unused eye is closed.
- Only one tracked viewer can receive geometrically correct perspective.
- Tracking quality, latency and physical calibration directly affect whether
  the virtual world appears stable.
- The original implementation uses hard-coded display geometry and contains
  explicit comments that experimental errors may cancel each other out.
- The scene is effectively attached to the mobile device because the original
  face-tracking mode did not provide the required device 6-DoF behavior.
- Art assets are not covered by the MIT software license and are restricted to
  non-commercial use with attribution.

## Transfer to the avatar project

The reusable idea is the mapping

`tracked eye position -> calibrated screen rectangle -> off-axis projection`.

For a fixed desktop monitor the problem becomes simpler in one respect: the
screen plane does not move. We need a one-time calibration of its width, height,
centre, orientation and tracker-to-screen transform. Each frame, the tracker
updates the eye position in the same coordinate system and Unreal renders from
that point through the screen rectangle.

The MetaHuman is ordinary scene geometry from the renderer's perspective. It
does not require a special parallax implementation. The difficult parts are
stable eye-position tracking, coordinate calibration, prediction/filtering and
low end-to-end latency.

## Recommendation

Do not port the full Unity project. Reimplement the small projection kernel in
Unreal Engine and use the original application as a behavioral reference.
Validate the projection first with a simple grid room and known dimensions.
Only then add a MetaHuman, gaze behavior and the conversational audio pipeline.
