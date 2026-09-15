import * as THREE from "three";
import { createRoomScene } from "./roomScene.js";

// Original BoxScene / GridBox / Boxes, in Unity scene order.
// Coordinates in metres; GridBox and Boxes scales cancel each other.
// Source and art attribution: ../THIRD_PARTY_NOTICES.md.
const BOXES = [
  [-0.0667, -0.0106, 0.06, 0.005, 0.005, 0.15],
  [-0.08, -0.0141, 0.0303, 0.005, 0.005, 0.1],
  [-0.0696, 0, 0.0146, 0.001, 0.01, 0.1],
  [-0.0691, -0.0059, -0.0304, 0.05, 0.05, 0.01],
  [-0.0705, -0.0046, -0.02, 0.03, 0.03, 0.03],
  [-0.0772, -0.0125, -0.02, 0.02, 0.02, 0.05],
  [-0.0705, 0.001, -0.02, 0.02, 0.02, 0.04],
  [-0.0675, -0.0089, 0.0001, 0.01, 0.01, 0.1],
  [-0.0691, 0.0032, 0.0001, 0.01, 0.01, 0.05],
  [-0.072, -0.0209, 0.0092, 0.001, 0.01, 0.03],
  [-0.0869, -0.0019, -0.0286, 0.01, 0.01, 0.05],
  [-0.0535, -0.0019, -0.0286, 0.01, 0.01, 0.05],
  [-0.0581, -0.0111, -0.0359, 0.01, 0.01, 0.05],
];

export function createParallaxScene(scene, { renderer, onAvatarStatus = () => {}, onRoomStatus = () => {}, onRoomLoaded = () => {} } = {}) {
  const roomScene = new THREE.Scene();
  const room = createRoomScene(roomScene, { renderer, onAvatarStatus, onRoomStatus, onRoomLoaded });
  const boxScene = new THREE.Scene();
  boxScene.name = "Original bars scene";
  const box = createBoxScene(boxScene);
  scene.add(boxScene, roomScene);
  let mode = "bars";
  let shadowsDirty = true;

  function setMode(value) {
    if (value === "avatar") value = "room-doll";
    mode = ["room", "room-doll"].includes(value) ? value : "bars";
    boxScene.visible = mode === "bars";
    roomScene.visible = mode !== "bars";
    room.setDollVisible(mode === "room-doll");
    scene.background = mode === "bars" ? new THREE.Color(0x151515) : roomScene.background;
    scene.fog = null;
    shadowsDirty = true;
    return mode;
  }
  setMode(mode);
  return {
    setMode,
    update(context) {
      let layoutChanged = false;
      if (mode === "bars") box.update(context);
      else layoutChanged = room.update(context);
      const refreshShadows = shadowsDirty || layoutChanged;
      shadowsDirty = false;
      return refreshShadows;
    },
    importRoom(buffer, name) { return room.importRoom(buffer, name); },
    setRoomView(view) { room.setRoomView(view); },
    applyAvatarMorphs(values) { return room.applyAvatarMorphs(values); },
  };
}

function createBoxScene(scene) {
  const room = new THREE.Group();
  room.name = "Original Box Scene";
  scene.add(room);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = [0xffffff, 0xeeeeee, 0xf9f9f9].map(
    (color) => new THREE.MeshLambertMaterial({ color }),
  );
  BOXES.forEach(([x, y, z, width, height, depth], index) => {
    const material = index === 3 ? materials[2] : [4, 5].includes(index) ? materials[1] : materials[0];
    const bar = new THREE.Mesh(geometry, material);
    bar.name = `Original bar ${index + 1}`;
    bar.position.set(x + 0.06735, y + 0.009, z);
    bar.scale.set(width, height, depth);
    room.add(bar);
  });

  const loader = new THREE.TextureLoader();
  function wallTexture(name, rotate = false) {
    const texture = loader.load(`${import.meta.env.BASE_URL}scenes/box/${name}.jpg`);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (rotate) {
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.PI / 2;
    }
    return new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  }
  const back = wallTexture("box_back", true);
  const side = wallTexture("box_side");
  const top = wallTexture("box_top");
  function wall(name, width, height, position, rotation, material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    room.add(mesh);
  }
  wall("Back", 0.1347, 0.062, [0, 0, -0.0312], [0, 0, 0], back);
  wall("Left", 0.0312, 0.062, [-0.06735, 0, -0.0156], [0, Math.PI / 2, 0], side);
  wall("Right", 0.0312, 0.062, [0.06735, 0, -0.0156], [0, -Math.PI / 2, 0], side);
  wall("Floor", 0.1347, 0.0312, [0, -0.031, -0.0156], [-Math.PI / 2, 0, 0], top);
  wall("Ceiling", 0.1347, 0.0312, [0, 0.031, -0.0156], [Math.PI / 2, 0, 0], top);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-0.4, 0.8, 1);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(0.6, -0.2, 0.5);
  scene.add(fill);

  function update({ screenWidth = 0.286, screenHeight = 0.191 } = {}) {
    room.scale.set(screenWidth / 0.1347, screenHeight / 0.062, 1.5);
  }
  update();
  return { update };
}
