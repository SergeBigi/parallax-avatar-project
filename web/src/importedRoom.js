import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_TEXTURE_SIZE = 1024;
const DB_NAME = "parallax-local-room-v1";
const PREFERRED_SOURCE = "efeff8e4978e489e82dbb06a86f697f8";

// Require a self-contained GLB: selecting a local room must not fetch its resources
// from a third-party host. Validate before giving anything to GLTFLoader.
export function inspectRoomGlb(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20 || buffer.byteLength > MAX_BYTES) {
    throw new Error("Bitte eine GLB-Datei bis 64 MB auswählen.");
  }
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
      || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a) {
    throw new Error("Die Datei ist keine gültige GLB-Datei (Version 2).");
  }
  const length = view.getUint32(12, true);
  if (length > buffer.byteLength - 20) throw new Error("Die GLB-Datei ist unvollständig.");
  let json;
  try { json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length))); }
  catch { throw new Error("Die Modelldaten konnten nicht gelesen werden."); }
  for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (resource.uri && !resource.uri.startsWith("data:")) {
      throw new Error("Bitte GLB mit eingebetteten Texturen verwenden; externe Dateien werden nicht geladen.");
    }
  }
  const extras = json.asset?.extras ?? {};
  return { title: String(extras.title ?? "Eigener Wohnraum"), preferred: String(extras.source ?? "").includes(PREFERRED_SOURCE) };
}

export function fitRoomBounds(bounds, { screenWidth, screenHeight, roomDepth, zoom = 1, elevation = 0 }) {
  const size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every((n) => Number.isFinite(n) && n > 1e-6)) {
    throw new Error("Das Modell enthält keinen räumlichen Innenraum.");
  }
  const scale = Math.max(screenWidth / size.x, screenHeight / size.y) * 1.15 * zoom;
  const depthScale = scale * roomDepth / 0.45;
  const centre = bounds.getCenter(new THREE.Vector3());
  return {
    scale: new THREE.Vector3(scale, scale, depthScale),
    position: new THREE.Vector3(-centre.x * scale, -screenHeight * (0.65 - elevation) - bounds.min.y * scale,
      -bounds.max.z * depthScale - roomDepth * 0.04),
  };
}

export function disposeRoom(object) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), images = new Set();
  object.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => { if (texture.image) images.add(texture.image); texture.dispose(); });
  images.forEach((image) => image.close?.());
  object.userData.roomEnvironment?.dispose();
}

function prepareMaterials(model, renderer) {
  const materials = new Set(), textures = new Set();
  model.traverse((node) => {
    if (!node.isMesh) return;
    // Static room geometry does not need to be re-rendered in the avatar's
    // dynamic shadow pass. Preserve depth testing so furniture occludes correctly.
    node.castShadow = false;
    node.receiveShadow = false;
    for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
      materials.add(material);
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  }
  if (renderer) {
    const generator = new THREE.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    try {
      const target = generator.fromScene(environment, 0.04);
      model.userData.roomEnvironment = target;
      for (const material of materials) {
        if (material.isMeshStandardMaterial) {
          material.envMap = target.texture;
          material.envMapIntensity = 0.65;
        }
      }
    } finally { environment.dispose(); generator.dispose(); }
  }
  // Resize once at import, never during tracking or rendering. Canvas/Image
  // decoding is supported by both Safari and desktop browsers.
  const resized = new Map();
  for (const texture of textures) {
    const image = texture.image;
    if (!image || Math.max(image.width, image.height) <= MAX_TEXTURE_SIZE) continue;
    if (!resized.has(image)) {
      const ratio = MAX_TEXTURE_SIZE / Math.max(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resized.set(image, canvas);
    }
    texture.image = resized.get(image);
    texture.needsUpdate = true;
  }
  resized.forEach((_, image) => image.close?.());
}

async function roomStorage(mode, record) {
  if (typeof indexedDB === "undefined") throw new Error("Lokaler Speicher ist nicht verfügbar.");
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("rooms");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Lokaler Speicher ist blockiert."));
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("rooms", mode === "read" ? "readonly" : "readwrite");
      const store = transaction.objectStore("rooms");
      const request = mode === "read" ? store.get("current") : store.put(record, "current");
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export function createImportedRoom(scene, { renderer, onStatus = () => {}, onLoaded = () => {},
  loadModel = (buffer) => new GLTFLoader().parseAsync(buffer, ""),
  storage = roomStorage, prepare = prepareMaterials,
} = {}) {
  const object = new THREE.Group();
  object.name = "Imported living room";
  object.visible = false;
  scene.add(object);
  const orientation = new THREE.Group();
  object.add(orientation);
  let model = null, generation = 0, attemptedRestore = false, layoutKey = "";
  let angle = 270, zoom = 1, elevation = 0;
  const bounds = new THREE.Box3();

  function recomputeBounds() {
    orientation.rotation.y = THREE.MathUtils.degToRad(angle);
    // Compute in room-local space, independently of the previous display fit.
    object.position.set(0, 0, 0); object.scale.setScalar(1);
    object.updateMatrixWorld(true);
    bounds.setFromObject(orientation, true);
    layoutKey = "";
  }

  async function install(buffer, name, { persist = true, token = ++generation } = {}) {
    attemptedRestore = true;
    onStatus({ state: "loading", message: "Wohnraum wird vorbereitet …" });
    let candidate;
    try {
      const metadata = inspectRoomGlb(buffer);
      candidate = (await loadModel(buffer)).scene;
      if (token !== generation) { disposeRoom(candidate); return false; }
      prepare(candidate, renderer);
      candidate.updateMatrixWorld(true);
      const candidateBounds = new THREE.Box3().setFromObject(candidate, true);
      fitRoomBounds(candidateBounds, { screenWidth: 0.494, screenHeight: 0.298, roomDepth: 0.45 });
      const previous = model;
      model = candidate;
      if (previous) { orientation.remove(previous); disposeRoom(previous); }
      orientation.add(model);
      angle = metadata.preferred ? 270 : 0; zoom = 1; elevation = 0;
      recomputeBounds();
      onLoaded({ name, angle, zoom, elevation, restored: !persist });
      let remembered = true;
      if (persist) {
        try { await storage("write", { buffer, name }); } catch { remembered = false; }
      }
      if (token !== generation) return false;
      onStatus({ state: "ready", message: `${name} · ${remembered ? "lokal gespeichert" : "aktiv; bitte beim nächsten Besuch erneut auswählen"}` });
      return true;
    } catch (error) {
      if (candidate && candidate !== model) disposeRoom(candidate);
      if (token === generation) onStatus({ state: "error", message: error.message || "Der Wohnraum konnte nicht geladen werden." });
      return false;
    }
  }

  async function restore() {
    if (attemptedRestore) return;
    attemptedRestore = true;
    const token = ++generation;
    try {
      const record = await storage("read");
      if (token !== generation) return;
      if (record) await install(record.buffer, record.name, { persist: false, token });
      else onStatus({ state: "empty", message: "GLB auswählen, um deinen Wohnraum zu öffnen." });
    } catch {
      if (token === generation) onStatus({ state: "empty", message: "GLB auswählen. Lokaler Speicher ist hier nicht verfügbar." });
    }
  }

  return {
    object, restore, install,
    isReady: () => Boolean(model),
    setView(view) {
      if (Number.isFinite(view.angle)) angle = view.angle;
      if (Number.isFinite(view.zoom)) zoom = THREE.MathUtils.clamp(view.zoom, 0.7, 2);
      if (Number.isFinite(view.elevation)) elevation = THREE.MathUtils.clamp(view.elevation, -0.5, 0.5);
      if (model) recomputeBounds();
    },
    update(context) {
      if (!model) return false;
      const key = `${context.screenWidth}/${context.screenHeight}/${context.roomDepth}/${angle}/${zoom}/${elevation}`;
      if (key === layoutKey) return false;
      const fitted = fitRoomBounds(bounds, { ...context, zoom, elevation });
      object.scale.copy(fitted.scale); object.position.copy(fitted.position);
      layoutKey = key;
      return true;
    },
  };
}
