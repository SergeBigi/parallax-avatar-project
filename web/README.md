# ParallaxView Web PoC

Browser prototype of the TheParallaxView idea for a fixed Windows display and a normal webcam:

`face landmarks -> selected eye -> display calibration -> off-axis projection`

## Scenes

- **Balken (Original)** – port of the original bar/grid scene.
- **3D-Raum** – open depth-reference room.
- **3D-Raum mit Test-Chan** – humanoid VRM avatar with selectable Idle, Walk and Jump motion plus webcam-driven facial blendshapes.

The room depth, selected tracking eye and calibration values are stored locally in the browser.

## Minimal camera diagnostic

Open `camera-test.html` (or use **Kamera-Test** in the app header) to test the
browser camera without loading Three.js, the avatar, MediaPipe or a tracking
worker. This is intended for constrained devices such as Echo Show with Silk.

The diagnostic checks the secure-context state, `mediaDevices`,
`enumerateDevices()` and the camera permission, then requests only
`getUserMedia({ video: true, audio: false })`. A successful stream is rendered
directly in a normal HTML `<video>`. Browser error name and message, public track
settings and a privacy-safe device summary can be copied from the page.

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


## Flüssige Darstellung

- Unter **Leistung → Grafikqualität** startet die App mit **Flüssig** (Pixelfaktor 1).
  **Sparsam** (0,75) reduziert die Grafiklast weiter; **Hohe Auflösung** entspricht
  dem bisherigen Maximum (1,5). Die Auswahl bleibt gespeichert.
- Gesichtserkennung läuft in einem separaten klassischen Web Worker mit GPU,
  bei fehlender GPU-Unterstützung mit CPU. Die Anzeige nennt den aktiven Modus.
  Falls der Worker nicht gestartet werden kann, bleibt ein langsamerer
  Kompatibilitätsmodus verfügbar.
- Maximal 30 Tracking-Auswertungen pro Sekunde, maximal ein Bild gleichzeitig.
  Langsame Auswertungen erzeugen keine Warteschlange. Rendering und
  Bewegungsglättung laufen unabhängig davon im Animationstakt des Browsers.
- Mausmodus und ausgeblendete Tabs pausieren neue Tracking-Aufträge.
- Neue Kalibrierungen starten mit 60 ms Glättung; gespeicherte Werte bleiben
  erhalten. Bei bisherigen Einstellungen gegebenenfalls unter Tracking auf
  60 ms stellen. Mehr Glättung beruhigt das Bild, erhöht aber die Verzögerung.
- Mimik wird nur bei neuen Messwerten zugewiesen; unsichtbare Avatare werden
  nicht animiert und Diagnosewerte nur fünfmal pro Sekunde aktualisiert.

Nach einem Update den lokalen Server neu starten und den Browser mit Strg+F5
neu laden. Das MediaPipe-Modell und seine Laufzeit werden weiterhin beim
Webcam-Start aus dem Internet geladen; Kamerabilder bleiben lokal.

Entwicklertests: `npm test` und `npm run build`. FPS hängen weiterhin von
Grafikchip, Bildschirmgröße, Kamera, Browser und Energiesparmodus ab.

## Eigener Wohnraum (GLB)

Unter **Raumdesign → Eigener Wohnraum (GLB)** bzw. **Wohnraum öffnen** eine
selbst enthaltene `.glb` auswählen. Der Raum erscheint mit dem vorhandenen Avatar
und derselben Off-Axis-Projektion wie die bisherigen Raumdesigns. Der Import ist
auch in der Szene ohne Avatar verfügbar. Blickrichtung, Raumgröße und Raumhöhe
lassen sich anpassen; die Raumtiefe steuert weiterhin die Tiefe hinter dem Display.

Die Datei wird ausschließlich im Browser gelesen und in IndexedDB gespeichert.
Beim nächsten Besuch wird sie wieder geladen, wenn der eigene Wohnraum ausgewählt
ist. Jedes Gerät und jeder Browser benötigt einen eigenen Import. Gelöschte
Website-Daten oder privates Browsen können einen erneuten Import erforderlich
machen. Wenn das Speichern fehlschlägt, bleibt der aktuelle Raum trotzdem nutzbar.
Die Ausrichtung wird separat lokal gespeichert.

Der Nutzerraum `living room interior FREE` von dasy444 wurde als Referenz getestet.
Er hat rund 23.230 Dreiecke und enthält seine Texturen direkt in der GLB. Seine
Standardlizenz erlaubt keine Weitergabe als frei zugängliche Modelldatei; deshalb
gehört die Binärdatei nicht zum öffentlichen Repository oder zum Pages-Build.
Die App liest auch keine Modelldatei von Sketchfab im Hintergrund nach.

Der bestehende WebGL2-Pfad für Edge/Chrome auf Windows und Safari auf iOS bleibt
erhalten. Texturen werden beim Import auf maximal 1024 Pixel Kantenlänge begrenzt,
der statische Raum wird nicht in jedem Avatar-Schattenpass neu gerendert. Ein
kleines lokal generiertes Umgebungslicht erhält die PBR-Materialien. Die bisherigen
Tracking-, Spiegelungs- und Leistungsoptionen bleiben verfügbar. Die iOS-Auswahl
des leichteren Avatars bleibt erhalten. Tatsächliche FPS auf dem Surface und dem
iPhone müssen auf diesen Geräten gemessen werden.
