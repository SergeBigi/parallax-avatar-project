import * as THREE from "three";

const STORAGE_KEY = "parallax-room-style-v1";
export const ROOM_STYLE_IDS = Object.freeze(["studio", "stream", "corridor", "imported"]);

export function createRoomStyles(room, { initialStyle = "studio", selector = null } = {}) {
  const styles = new Map([
    ["studio", buildFuturisticStudio()],
    ["stream", buildStreamingStudio()],
    ["corridor", buildSciFiCorridor()],
  ]);
  for (const group of styles.values()) room.add(group);

  let control = selector;
  if (!control && typeof document !== "undefined") control = document.querySelector("#room-style");
  let current = readStoredStyle(initialStyle);

  function setStyle(value, { persist = true } = {}) {
    current = normalizeRoomStyle(value, initialStyle);
    for (const [id, group] of styles) group.visible = id === current;
    if (control && control.value !== current) control.value = current;
    if (persist && typeof localStorage !== "undefined") {
      try { localStorage.setItem(STORAGE_KEY, current); } catch { /* storage is optional */ }
    }
    return current;
  }

  if (control) control.addEventListener("change", () => setStyle(control.value));
  setStyle(current, { persist: false });

  return {
    setStyle,
    getStyle: () => current,
    getGroup: (id) => styles.get(id) ?? null,
  };
}

export function normalizeRoomStyle(value, fallback = "studio") {
  return ROOM_STYLE_IDS.includes(value) ? value : ROOM_STYLE_IDS.includes(fallback) ? fallback : "studio";
}

function readStoredStyle(fallback) {
  if (typeof localStorage === "undefined") return normalizeRoomStyle(fallback);
  try { return normalizeRoomStyle(localStorage.getItem(STORAGE_KEY), fallback); }
  catch { return normalizeRoomStyle(fallback); }
}

function buildFuturisticStudio() {
  const group = namedGroup("Room style · Futuristic studio");
  const dark = standard(0x101a22, 0.76, 0.08);
  const panel = standard(0x172833, 0.62, 0.12);
  const cyan = glow(0x53e8df, 0.85);
  const blue = glow(0x2f8faa, 0.58);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  for (const [z, opacity] of [[-0.2, 0.95], [-0.52, 0.78], [-0.82, 0.6]]) {
    const layerMaterial = glow(0x4bd9d0, opacity);
    addArch(group, boxGeometry, z, 0.025, layerMaterial);
  }

  addBox(group, boxGeometry, "Studio left panel", [0.13, 0.42, 0.045], [-0.405, 0.03, -0.54], panel);
  addBox(group, boxGeometry, "Studio right panel", [0.13, 0.42, 0.045], [0.405, 0.03, -0.54], panel);
  addBox(group, boxGeometry, "Studio left inset", [0.085, 0.27, 0.018], [-0.395, 0.03, -0.505], dark);
  addBox(group, boxGeometry, "Studio right inset", [0.085, 0.27, 0.018], [0.395, 0.03, -0.505], dark);
  for (const x of [-0.315, 0.315]) {
    addBox(group, boxGeometry, "Studio floor light", [0.012, 0.006, 0.72], [x, -0.493, -0.52], blue);
  }
  addHexagon(group, -0.967, 0.18, cyan);
  addBox(group, boxGeometry, "Studio back glow", [0.38, 0.018, 0.012], [0, -0.25, -0.974], cyan);
  return group;
}

function buildStreamingStudio() {
  const group = namedGroup("Room style · Streaming studio");
  const cabinet = standard(0x243039, 0.82, 0.03);
  const shelf = standard(0x46515a, 0.68, 0.05);
  const screen = standard(0x16252d, 0.52, 0.16);
  const warm = glow(0xffb56f, 0.72);
  const aqua = glow(0x6bd9d1, 0.58);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  for (const x of [-0.455, 0.455]) {
    addBox(group, boxGeometry, "Streaming near column", [0.055, 0.78, 0.07], [x, -0.04, -0.2], cabinet);
    addBox(group, boxGeometry, "Streaming column light", [0.012, 0.56, 0.014], [x * 0.985, 0.02, -0.155], aqua);
  }

  for (const side of [-1, 1]) {
    const x = side * 0.34;
    addBox(group, boxGeometry, "Streaming shelf upper", [0.24, 0.025, 0.14], [x, 0.19, -0.5], shelf);
    addBox(group, boxGeometry, "Streaming shelf lower", [0.22, 0.025, 0.12], [x, -0.09, -0.66], shelf);
  }

  addFlower(group, [-0.39, 0.204, -0.455], 0xff8db4, "Streaming flower left");
  addPictureFrame(group, [-0.285, 0.203, -0.446], 0.085, 0x72d8ff, "Streaming picture frame left");
  addPictureFrame(group, [0.30, 0.203, -0.446], 0.09, 0xffbd75, "Streaming picture frame right");
  addFlower(group, [0.395, -0.078, -0.615], 0x84e4d6, "Streaming flower right");
  addGeometricSculpture(group, [-0.325, -0.073, -0.615]);

  addBox(group, boxGeometry, "Streaming back screen", [0.48, 0.34, 0.025], [0, 0.08, -0.965], screen);
  addBox(group, boxGeometry, "Streaming back top light", [0.5, 0.012, 0.012], [0, 0.265, -0.947], warm);
  addBox(group, boxGeometry, "Streaming back bottom light", [0.34, 0.01, 0.012], [0, -0.125, -0.947], aqua);
  for (const x of [-0.22, 0.22]) {
    addBox(group, boxGeometry, "Streaming floor guide", [0.01, 0.006, 0.55], [x, -0.493, -0.62], warm);
  }
  return group;
}

function buildSciFiCorridor() {
  const group = namedGroup("Room style · Sci-Fi corridor");
  const frame = standard(0x25333d, 0.55, 0.2);
  const cyan = glow(0x56f0e1, 0.92);
  const violet = glow(0x6f85ff, 0.66);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  const depths = [-0.16, -0.36, -0.58, -0.8];
  depths.forEach((z, index) => {
    const inset = 0.025 + index * 0.012;
    addFullFrame(group, boxGeometry, z, inset, 0.035, frame);
    const light = index % 2 === 0 ? cyan : violet;
    addBox(group, boxGeometry, "Corridor left light", [0.009, 0.68 - index * 0.035, 0.012], [-0.455 + inset, 0, z + 0.018], light);
    addBox(group, boxGeometry, "Corridor right light", [0.009, 0.68 - index * 0.035, 0.012], [0.455 - inset, 0, z + 0.018], light);
  });

  for (const x of [-0.31, -0.16, 0.16, 0.31]) {
    addBox(group, boxGeometry, "Corridor floor rail", [0.008, 0.007, 0.78], [x, -0.492, -0.53], x < 0 ? cyan : violet);
  }
  for (const x of [-0.28, 0.28]) {
    addBox(group, boxGeometry, "Corridor ceiling rail", [0.008, 0.007, 0.72], [x, 0.492, -0.58], violet);
  }
  addBox(group, boxGeometry, "Corridor back gate", [0.45, 0.46, 0.025], [0, 0, -0.975], standard(0x101820, 0.48, 0.22));
  addHexagon(group, -0.955, 0.15, cyan);
  return group;
}

function namedGroup(name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

function standard(color, roughness = 0.75, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function glow(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
}

function addBox(group, geometry, name, size, position, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.scale.set(...size);
  mesh.position.set(...position);
  configureShadows(mesh, material);
  group.add(mesh);
  return mesh;
}

function configureShadows(mesh, material = mesh.material) {
  const lit = Array.isArray(material)
    ? material.some((entry) => entry?.isMeshStandardMaterial || entry?.isMeshPhysicalMaterial)
    : material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial;
  mesh.castShadow = Boolean(lit);
  mesh.receiveShadow = Boolean(lit);
  return mesh;
}

function addArch(group, geometry, z, thickness, material) {
  addBox(group, geometry, "Studio arch left", [thickness, 0.83, 0.024], [-0.46, -0.03, z], material);
  addBox(group, geometry, "Studio arch right", [thickness, 0.83, 0.024], [0.46, -0.03, z], material);
  addBox(group, geometry, "Studio arch top", [0.94, thickness, 0.024], [0, 0.39, z], material);
}

function addFullFrame(group, geometry, z, inset, thickness, material) {
  const x = 0.47 - inset;
  const y = 0.46 - inset;
  const width = x * 2;
  const height = y * 2;
  addBox(group, geometry, "Corridor frame left", [thickness, height, 0.038], [-x, 0, z], material);
  addBox(group, geometry, "Corridor frame right", [thickness, height, 0.038], [x, 0, z], material);
  addBox(group, geometry, "Corridor frame top", [width, thickness, 0.038], [0, y, z], material);
  addBox(group, geometry, "Corridor frame bottom", [width, thickness, 0.038], [0, -y, z], material);
}

function addHexagon(group, z, radius, material) {
  const points = [];
  for (let i = 0; i <= 6; i += 1) {
    const angle = Math.PI / 6 + (i / 6) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const color = material.color?.getHex?.() ?? 0x53e8df;
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: material.opacity ?? 1 }));
  line.name = "Back hexagon";
  line.position.z = z;
  group.add(line);
}

function addPictureFrame(group, position, size, accentColor, name) {
  const frame = namedGroup(name);
  frame.position.set(...position);
  const border = standard(0x9a7f62, 0.62, 0.08);
  const backing = standard(0x10161b, 0.88, 0.02);
  const art = standard(accentColor, 0.72, 0.03);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const width = size;
  const height = size * 1.22;
  const t = size * 0.09;
  addBox(frame, box, `${name} left`, [t, height, 0.014], [-width / 2, height / 2, 0], border);
  addBox(frame, box, `${name} right`, [t, height, 0.014], [width / 2, height / 2, 0], border);
  addBox(frame, box, `${name} top`, [width + t, t, 0.014], [0, height, 0], border);
  addBox(frame, box, `${name} bottom`, [width + t, t, 0.014], [0, 0, 0], border);
  addBox(frame, box, `${name} backing`, [width * 0.9, height * 0.88, 0.009], [0, height * 0.51, -0.006], backing);
  addBox(frame, box, `${name} art`, [width * 0.56, height * 0.28, 0.01], [-width * 0.08, height * 0.55, 0.003], art);
  addBox(frame, box, `${name} art accent`, [width * 0.24, height * 0.17, 0.011], [width * 0.18, height * 0.37, 0.004], standard(0xf1e6c8, 0.86, 0.01));
  group.add(frame);
}

function addFlower(group, position, petalColor, name) {
  const flower = namedGroup(name);
  flower.position.set(...position);
  const potMaterial = standard(0x9e6a55, 0.82, 0.02);
  const stemMaterial = standard(0x4c8b62, 0.9, 0.01);
  const petalMaterial = standard(petalColor, 0.78, 0.01);
  const centreMaterial = standard(0xf6cf67, 0.72, 0.01);

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.031, 0.054, 10), potMaterial);
  pot.name = `${name} pot`;
  pot.position.y = 0.027;
  configureShadows(pot);
  flower.add(pot);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.005, 0.082, 7), stemMaterial);
  stem.name = `${name} stem`;
  stem.position.y = 0.088;
  configureShadows(stem);
  flower.add(stem);

  const headY = 0.137;
  const petalGeometry = new THREE.SphereGeometry(1, 8, 6);
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeometry, petalMaterial);
    petal.name = `${name} petal`;
    petal.scale.set(0.015, 0.022, 0.008);
    petal.position.set(Math.cos(angle) * 0.019, headY + Math.sin(angle) * 0.021, 0);
    petal.rotation.z = angle - Math.PI / 2;
    configureShadows(petal);
    flower.add(petal);
  }
  const centre = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), centreMaterial);
  centre.name = `${name} centre`;
  centre.position.set(0, headY, 0.006);
  configureShadows(centre);
  flower.add(centre);

  const leaf = new THREE.Mesh(petalGeometry, stemMaterial);
  leaf.name = `${name} leaf`;
  leaf.scale.set(0.012, 0.026, 0.006);
  leaf.position.set(0.012, 0.085, 0);
  leaf.rotation.z = -0.65;
  configureShadows(leaf);
  flower.add(leaf);
  group.add(flower);
}

function addGeometricSculpture(group, position) {
  const sculpture = namedGroup("Streaming geometric sculpture");
  sculpture.position.set(...position);
  const material = standard(0x77cfd3, 0.38, 0.42);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.033, 0.025, 10), standard(0x343f46, 0.74, 0.15));
  base.position.y = 0.0125;
  configureShadows(base);
  sculpture.add(base);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), material);
  gem.position.y = 0.064;
  gem.rotation.set(0.25, 0.4, 0.12);
  configureShadows(gem);
  sculpture.add(gem);
  group.add(sculpture);
}
