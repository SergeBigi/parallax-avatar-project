# ParallaxView Web PoC

Browser prototype of the TheParallaxView idea for a fixed Windows display and a normal webcam:

`face landmarks -> selected eye -> display calibration -> off-axis projection`

## Scenes

- **Balken (Original)** – port of the original bar/grid scene.
- **3D-Raum** – open depth-reference room.
- **3D-Raum mit Test-Chan** – humanoid VRM avatar with selectable Idle, Walk and Jump motion plus webcam-driven facial blendshapes.

The room depth, selected tracking eye and calibration values are stored locally in the browser.

## Test-Chan asset

The app expects the advanced Test-Chan v1.3 VRM here:

`public/models/test-chan/Test-Chan.vrm`

Source: https://booth.pm/en/items/5419110

BOOTH requires a free pixiv/BOOTH sign-in for the download. Download the v1.3 package with ARKit / Vive Lip Tracker / OVRLipSync blendshapes, extract the `.vrm`, rename it to `Test-Chan.vrm` if necessary and put it at the path above. Until the file is present, the old wooden doll remains visible as a fallback and the UI reports that the VRM is missing.

## Avatar pipeline

- Three.js `GLTFLoader` loads the VRM directly, so no additional npm dependency is needed.
- MediaPipe Face Landmarker runs with `outputFaceBlendshapes: true`.
- ARKit-style categories such as `jawOpen`, `mouthSmileLeft` and `eyeBlinkRight` are matched against the VRM's morph targets.
- A named-morph API is already available for the later TTS/viseme pipeline.
- Idle, Walk and Jump use lightweight procedural humanoid bone animation for this PoC.
- **Tracking-Auge** switches the monoscopic off-axis viewpoint between the physical right and left eye. Depth estimation still uses the separation of both eyes.

## Start on Windows

Requirements: Windows 11, current Edge/Chrome, webcam, Node.js 20.19+.

```powershell
git clone --recurse-submodules https://github.com/SergeBigi/parallax-avatar-project.git
cd parallax-avatar-project\web
npm install
npm run dev
```

Or double-click `start-webview.cmd` after dependencies are installed. The browser opens `http://127.0.0.1:5173`.

Use mouse mode first, then start the webcam. For the strongest geometry effect use fullscreen and enter the visible display width/height and webcam offset accurately. Webcam frames stay local in the browser.

## Development checks

```powershell
npm test
npm run build
```

The implementation uses Three.js and MediaPipe Face Landmarker. Webcam-only depth is estimated from apparent eye separation, configured IPD and approximate webcam field of view, so it is less accurate than a dedicated depth/IR tracker.
