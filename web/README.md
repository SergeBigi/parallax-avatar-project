# ParallaxView Web PoC

This browser prototype ports the central idea of TheParallaxView to a fixed
Windows display with an ordinary webcam:

`face landmarks -> metric eye estimate -> display calibration -> off-axis projection`

It is intentionally a geometry and tracking prototype. The scenes use lightweight
3D geometry so that an older Surface can validate the depth illusion.

## Select a scene

The **Szene** menu at the top remains available when calibration is collapsed:

- **Balken (Original)**: the existing port of the original bars and grid box.
- **3D-Raum**: an open room with five walls, floor joints, repeated wall ribs and
  a back panel as depth references.
- **3D-Raum mit Puppe**: the same room with a small, full-body wooden doll,
  volumetric limbs, a face and a floor shadow. The doll stays on the floor;
  moving your head changes the viewing position and asymmetric projection.

Both room scenes share a **Raumtiefe** slider (15–100 cm, initially 45 cm).
The scene, room depth and calibration settings are remembered in this browser
when local storage is available. An earlier saved **Avatar** selection opens
the new room with doll. Scene switching does not restart webcam tracking.

For a clear view, collapse calibration with **−** and use **Vollbild**. Start with
slow sideways and up/down head movements; increase room depth to compare the
relative movement of the doll and the back wall. In mouse mode, move over the
scene and use the wheel for viewing distance; interacting with menus and sliders
does not move the simulated viewpoint.

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

3. The browser opens `http://127.0.0.1:5173` automatically. Keep the command
   window open while using the prototype.
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
- **Z-Achse spiegeln** preserves the previous optional inversion of webcam
  depth around 65 cm. It changes the near/far response; mouse-wheel simulation
  continues to control the virtual eye distance directly.
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

All scenes share the same calibrated screen plane at z = 0 and off-axis camera.
The new room is behind that plane. Its architecture fits the entered display
dimensions; the doll scales uniformly to preserve its proportions. Shadow maps
are refreshed only when the selected scene or room dimensions change, since
neither the doll nor the lighting is animated. No extra model downloads or npm
dependencies are required for the two room scenes.
