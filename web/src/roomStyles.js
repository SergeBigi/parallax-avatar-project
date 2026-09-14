import * as THREE from "three";

const STORAGE_KEY = "parallax-room-style-v1";
export const ROOM_STYLE_IDS = Object.freeze(["studio", "stream", "corridor"]);

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

  // Three architectural layers provide obvious near/mid/far references.
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

  // Near side columns make the portrait feel framed without blocking the avatar.
  for (const x of [-0.455, 0.455]) {
    addBox(group, boxGeometry, "Streaming near column", [0.055, 0.78, 0.07], [x, -0.04, -0.2], cabinet);
    addBox(group, boxGeometry, "Streaming column light", [0.012, 0.56, 0.014], [x * 0.985, 0.02, -0.155], aqua);
  }

  // Mid-depth floating shelves and props intentionally sit at different z values.
  for (const side of [-1, 1]) {
    const x = side * 0.34;
    addBox(group, boxGeometry, "Streaming shelf upper", [0.24, 0.025, 0.14], [x, 0.19, -0.5], shelf);
    addBox(group, boxGeometry, "Streaming shelf lower", [0.22, 0.025, 0.12], [x, -0.09, -0.66], shelf);
    addBox(group, boxGeometry, "Streaming prop", [0.065, 0.11, 0.07], [x - side * 0.055, 0.255, -0.49], side < 0 ? warm : aqua);
    addBox(group, boxGeometry, "Streaming prop small", [0.05, 0.07, 0.05], [x + side * 0.06, -0.04, -0.64], side < 0 ? aqua : warm);
  }

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

  // Long rails exaggerate motion along the depth axis while staying very cheap to render.
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
  group.add(mesh);
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
