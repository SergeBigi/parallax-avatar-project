# ParallaxView Web PoC

This browser prototype ports the central idea of TheParallaxView to a fixed
Windows display with an ordinary webcam:

`face landmarks -> metric eye estimate -> display calibration -> off-axis projection`

It is intentionally a geometry and tracking prototype. The rendered person is
a lightweight proxy avatar so that an older Surface can validate the depth
illusion before a production avatar is introduced.

## Requirements

- Windows 11;
- current Microsoft Edge or Google Chrome;
- integrated or USB webcam;
- Node.js 20.19 or newer;
- internet access during the first start to download the MediaPipe WASM and
  face-landmark model.

## Start on Windows

1. Clone the repository with its reference submodule:

   ```powershell
   git clone --recurse-submodules https://github.com/SergeBigi/parallax-avatar-project.git
   cd parallax-avatar-project\web
   ```

2. Double-click `start-webview.cmd`, or run:

   ```powershell
   npm install
   npm run dev
   ```

3. Open `http://127.0.0.1:5173` if the browser does not open it automatically.
4. Test the projection with the mouse first. The mouse wheel changes the
   simulated viewing distance.
5. Select **Webcam starten**, grant camera access, then disable mouse
   simulation if it is still enabled.
6. Use full-screen mode and enter the measured width and height of the visible
   display area. Enter the distance from the display centre to the webcam.

The browser must run on `localhost` or HTTPS for camera access. The face model
runs in the browser; webcam frames are not uploaded by this application.

## Calibration notes

- Measure only the visible display surface, excluding the bezel.
- The webcam offset is positive when the camera is above the display centre.
- Start with an assumed IPD of 64 mm if the actual value is unknown.
- Adjust webcam horizontal field of view until the displayed distance roughly
  matches the real eye-to-screen distance.
- If the virtual scene moves in the wrong horizontal direction, change
  **X-Achse spiegeln**.
- The illusion is geometrically correct for one viewer only.

## Development checks

```powershell
npm test
npm run build
```

The implementation uses Three.js for WebGL rendering and MediaPipe Face
Landmarker for single-camera facial landmarks. Depth is estimated from the
apparent eye separation, the configured IPD and the approximate webcam field
of view; therefore it is less accurate than a depth or infrared tracker.
