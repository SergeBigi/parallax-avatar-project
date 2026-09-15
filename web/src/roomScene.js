import * as THREE from "three";

import { createImportedRoom } from "./importedRoom.js";
import { createRoomStyles } from "./roomStyles.js";
import { createTestChanAvatar } from "./testChanAvatar.js";

const DYNAMIC_SHADOW_INTERVAL_SECONDS = 1 / 10;

/** A stationary miniature room, with its open front on the display at z = 0. */
export function createRoomScene(
  scene,
  { renderer, onAvatarStatus = () => {}, onRoomStatus = () => {}, onRoomLoaded = () => {}, loadAvatar = typeof window !== "undefined" } = {},
) {
  scene.name = "Miniature room scene";
  scene.background = new THREE.Color(0x091219);
  const room = new THREE.Group();
  room.name = "Room architecture";
  scene.add(room);

  const material = (color, roughness = 0.88, metalness = 0.03) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const wallMaterial = material(0x17242c);
  const backMaterial = material(0x0c151c, 0.82, 0.08);
  const floorMaterial = material(0x1c252a, 0.92, 0.02);
  const ceilingMaterial = material(0x101a21, 0.86, 0.05);

  function wall(name, width, height, position, rotation, surface) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), surface);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.receiveShadow = true;
    room.add(mesh);
    return mesh;
  }

  wall("Room back wall", 1, 1, [0, 0, -1], [0, 0, 0], backMaterial);
  wall("Room left wall", 1, 1, [-0.5, 0, -0.5], [0, Math.PI / 2, 0], wallMaterial);
  wall("Room right wall", 1, 1, [0.5, 0, -0.5], [0, -Math.PI / 2, 0], wallMaterial);
  wall("Room floor", 1, 1, [0, -0.5, -0.5], [-Math.PI / 2, 0, 0], floorMaterial);
  wall("Room ceiling", 1, 1, [0, 0.5, -0.5], [Math.PI / 2, 0, 0], ceilingMaterial);

  const joints = [];
  for (let i = 1; i < 9; i += 1) {
    const z = -i / 9;
    joints.push(-0.5, -0.499, z, 0.5, -0.499, z);
  }
  for (const x of [-0.32, -0.16, 0, 0.16, 0.32]) {
    joints.push(x, -0.499, 0, x, -0.499, -1);
  }
  const jointGeometry = new THREE.BufferGeometry();
  jointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(joints, 3));
  const floorJoints = new THREE.LineSegments(
    jointGeometry,
    new THREE.LineBasicMaterial({ color: 0x52656d, transparent: true, opacity: 0.32 }),
  );
  floorJoints.name = "Floor depth grid";
  room.add(floorJoints);

  const roomStyles = createRoomStyles(room);
  const importedRoom = createImportedRoom(scene, { renderer, onStatus: onRoomStatus, onLoaded: onRoomLoaded });

  const importedControls = typeof document !== "undefined" && document.querySelector("#imported-room-view");

  const doll = createDoll();
  scene.add(doll);
  let characterVisible = true;
  let avatarReady = false;
  const avatar = createTestChanAvatar({
    autoload: loadAvatar,
    onStatus(status) {
      avatarReady = status.state === "ready";
      if (status.state !== "loading") syncCharacterVisibility();
      onAvatarStatus(status);
    },
  });
  avatar.object.visible = false;
  scene.add(avatar.object);

  scene.add(new THREE.HemisphereLight(0xc9e1eb, 0x101217, 1.18));
  const key = new THREE.DirectionalLight(0xe7f5ff, 2.15);
  key.name = "Room key light";
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.0012;
  key.shadow.radius = 2;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0x7ce6de, 0.44);
  fill.name = "Room fill light";
  fill.position.set(0.45, 0.12, 0.15);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x8aa7ff, 0.34);
  rim.name = "Avatar rim light";
  rim.position.set(0.28, 0.32, -0.28);
  rim.target.position.set(0, 0.02, -0.05);
  scene.add(rim, rim.target);

  let previousLayout = "";
  let previousStyle = roomStyles.getStyle();
  let lastDynamicShadowRefresh = -Infinity;
  function update({
    screenWidth = 0.286,
    screenHeight = 0.191,
    roomDepth = 0.45,
    elapsedSeconds = 0,
    avatarAnimation = "idle",
    faceBlendshapes = [],
  } = {}) {
    const avatarAnimated = characterVisible && avatarReady;
    if (avatarAnimated) avatar.update({ elapsedSeconds, animation: avatarAnimation, faceBlendshapes });

    let shadowsDirty = false;
    const currentStyle = roomStyles.getStyle();
    const wantsImported = currentStyle === "imported";
    if (wantsImported && typeof window !== "undefined") importedRoom.restore();
    importedRoom.object.visible = wantsImported && importedRoom.isReady();
    room.visible = !importedRoom.object.visible;
    if (importedRoom.object.visible) {
      shadowsDirty = importedRoom.update({ screenWidth, screenHeight, roomDepth }) || shadowsDirty;
    }
    if (importedControls) importedControls.hidden = !wantsImported;

    if (currentStyle !== previousStyle) {
      previousStyle = currentStyle;
      shadowsDirty = true;
    }

    const layout = `${screenWidth}/${screenHeight}/${roomDepth}`;
    if (layout !== previousLayout) {
      previousLayout = layout;
      shadowsDirty = true;
      room.scale.set(screenWidth, screenHeight, roomDepth);

      const dollHeight = Math.min(screenHeight * 0.72, screenWidth * 0.6);
      doll.scale.setScalar(dollHeight);
      doll.position.set(-screenWidth * 0.035, -screenHeight / 2, -roomDepth * 0.48);

      const avatarHeight = Math.min(screenHeight * 0.9, screenWidth * 0.75);
      avatar.object.scale.setScalar(avatarHeight);
      avatar.object.position.set(0, -screenHeight * 0.7, -roomDepth * 0.09);

      key.position.set(-screenWidth * 0.68, screenHeight * 1.62, roomDepth * 0.28);
      key.target.position.set(0, -screenHeight * 0.1, -roomDepth * 0.16);
      fill.position.set(screenWidth * 0.62, screenHeight * 0.42, roomDepth * 0.12);
      rim.position.set(screenWidth * 0.46, screenHeight * 0.78, -roomDepth * 0.34);
      rim.target.position.set(0, screenHeight * 0.06, -roomDepth * 0.08);

      const span = Math.max(screenWidth, screenHeight, roomDepth) * 0.95;
      Object.assign(key.shadow.camera, {
        left: -span,
        right: span,
        top: span,
        bottom: -span,
        near: 0.01,
        far: span * 6,
      });
      key.shadow.camera.updateProjectionMatrix();
    }

    if (avatarAnimated && elapsedSeconds - lastDynamicShadowRefresh >= DYNAMIC_SHADOW_INTERVAL_SECONDS) {
      lastDynamicShadowRefresh = elapsedSeconds;
      shadowsDirty = true;
    }
    return shadowsDirty;
  }
  update();
  previousLayout = "";

  function syncCharacterVisibility() {
    doll.visible = characterVisible && !avatarReady;
    avatar.object.visible = characterVisible && avatarReady;
  }

  return {
    update,
    setDollVisible(visible) { characterVisible = visible; syncCharacterVisibility(); },
    setRoomStyle(style) { return roomStyles.setStyle(style); },
    getRoomStyle() { return roomStyles.getStyle(); },
    async importRoom(buffer, name) {
      const loaded = await importedRoom.install(buffer, name);
      if (loaded) roomStyles.setStyle("imported");
      return loaded;
    },
    setRoomView(view) { importedRoom.setView(view); },
    applyAvatarMorphs(values) { return avatar.applyNamedMorphs(values); },
  };
}

function createDoll() {
  const doll = new THREE.Group();
  doll.name = "Wooden doll";
  const wood = new THREE.MeshStandardMaterial({ color: 0xe5b477, roughness: 0.65 });
  const joints = new THREE.MeshStandardMaterial({ color: 0xb88049, roughness: 0.75 });
  const clothes = new THREE.MeshStandardMaterial({ color: 0x247e96, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x242b33, roughness: 0.65 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xffe6b7, roughness: 0.6 });
  const sphere = new THREE.SphereGeometry(1, 20, 14);

  function ellipsoid(name, position, scale, surface) {
    const mesh = new THREE.Mesh(sphere, surface);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    doll.add(mesh);
    return mesh;
  }
  function limb(name, from, to, radius, surface) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.88, radius, direction.length(), 12), surface);
    mesh.name = name;
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    doll.add(mesh);
  }

  ellipsoid("Doll body", [0, 0.51, 0], [0.126, 0.163, 0.078], clothes);
  ellipsoid("Doll hips", [0, 0.385, 0], [0.112, 0.064, 0.073], clothes);
  limb("Doll neck", [0, 0.64, 0], [0, 0.727, 0], 0.043, wood);
  ellipsoid("Doll head", [0, 0.823, 0.01], [0.147, 0.157, 0.133], wood);

  for (const side of [-1, 1]) {
    const shoulder = [side * 0.132, 0.614, 0];
    const elbow = [side * 0.205, 0.49, 0.008];
    const wrist = [side * 0.18, 0.385, 0.038];
    ellipsoid("Doll shoulder joint", shoulder, [0.042, 0.042, 0.042], joints);
    limb("Doll upper arm", shoulder, elbow, 0.034, wood);
    ellipsoid("Doll elbow joint", elbow, [0.034, 0.034, 0.034], joints);
    limb("Doll forearm", elbow, wrist, 0.028, wood);
    ellipsoid("Doll hand", [side * 0.18, 0.361, 0.039], [0.033, 0.044, 0.028], wood);
    const hip = [side * 0.07, 0.369, 0];
    const knee = [side * 0.085, 0.213, 0.014];
    const ankle = [side * 0.091, 0.065, 0.017];
    limb("Doll thigh", hip, knee, 0.046, clothes);
    ellipsoid("Doll knee joint", knee, [0.038, 0.038, 0.038], joints);
    limb("Doll shin", knee, ankle, 0.032, wood);
    ellipsoid("Doll shoe", [side * 0.091, 0.034, 0.046], [0.054, 0.034, 0.088], dark);
    ellipsoid("Doll ear", [side * 0.145, 0.816, 0.005], [0.022, 0.035, 0.022], joints);
    ellipsoid("Doll eye", [side * 0.049, 0.85, 0.133], [0.016, 0.022, 0.009], dark);
    ellipsoid("Doll eye highlight", [side * 0.049 - 0.004, 0.857, 0.141], [0.004, 0.005, 0.003], cream);
  }
  ellipsoid("Doll nose", [0, 0.813, 0.143], [0.02, 0.023, 0.025], joints);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.004, 6, 16, Math.PI), dark);
  smile.name = "Doll smile";
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.795, 0.14);
  doll.add(smile);
  for (const y of [0.555, 0.485]) ellipsoid("Outfit button", [0, y, 0.078], [0.01, 0.01, 0.006], cream);
  return doll;
}
