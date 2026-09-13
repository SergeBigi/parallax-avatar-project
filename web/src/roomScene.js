import * as THREE from "three";

import { createTestChanAvatar } from "./testChanAvatar.js";

/** A stationary miniature room, with its open front on the display at z = 0. */
export function createRoomScene(
  scene,
  { onAvatarStatus = () => {}, loadAvatar = typeof window !== "undefined" } = {},
) {
  scene.name = "Miniature room scene";
  scene.background = new THREE.Color(0x182a35);
  const room = new THREE.Group();
  room.name = "Room architecture";
  scene.add(room);

  const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const wallMaterial = material(0x53757d);
  const backMaterial = material(0x708d91);
  const floorMaterial = material(0xb79a73);
  const ceilingMaterial = material(0x344f5a);
  const trimMaterial = material(0xc4d2cf);
  const accentMaterial = material(0xd9ad6d);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  function wall(name, width, height, position, rotation, surface) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), surface);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.receiveShadow = true;
    room.add(mesh);
    return mesh;
  }

  function trim(name, size, position, surface = trimMaterial) {
    const mesh = new THREE.Mesh(boxGeometry, surface);
    mesh.name = name;
    mesh.scale.set(...size);
    mesh.position.set(...position);
    room.add(mesh);
  }

  wall("Room back wall", 1, 1, [0, 0, -1], [0, 0, 0], backMaterial);
  wall("Room left wall", 1, 1, [-0.5, 0, -0.5], [0, Math.PI / 2, 0], wallMaterial);
  wall("Room right wall", 1, 1, [0.5, 0, -0.5], [0, -Math.PI / 2, 0], wallMaterial);
  wall("Room floor", 1, 1, [0, -0.5, -0.5], [-Math.PI / 2, 0, 0], floorMaterial);
  wall("Room ceiling", 1, 1, [0, 0.5, -0.5], [Math.PI / 2, 0, 0], ceilingMaterial);

  for (const z of [0, -0.25, -0.5, -0.75, -0.995]) {
    for (const x of [-0.495, 0.495]) trim("Wall rib", [0.012, 1, 0.004], [x, 0, z]);
    trim("Ceiling rib", [1, 0.012, 0.004], [0, 0.495, z]);
  }
  for (const x of [-0.492, 0.492]) {
    trim("Skirting board", [0.018, 0.025, 1], [x, -0.482, -0.5]);
    trim("Wall accent rail", [0.006, 0.012, 1], [x, -0.12, -0.5], accentMaterial);
  }
  trim("Back skirting board", [1, 0.025, 0.006], [0, -0.482, -0.995]);
  trim("Back accent rail", [1, 0.012, 0.006], [0, -0.12, -0.995], accentMaterial);

  const joints = [];
  for (let i = 1; i < 10; i += 1) {
    const z = -i / 10;
    joints.push(-0.5, -0.499, z, 0.5, -0.499, z);
  }
  for (let i = 1; i < 8; i += 1) {
    const x = -0.5 + i / 8;
    joints.push(x, -0.499, 0, x, -0.499, -1);
  }
  const jointGeometry = new THREE.BufferGeometry();
  jointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(joints, 3));
  const floorJoints = new THREE.LineSegments(
    jointGeometry,
    new THREE.LineBasicMaterial({ color: 0x79684f, transparent: true, opacity: 0.65 }),
  );
  floorJoints.name = "Floor depth grid";
  room.add(floorJoints);

  trim("Back panel", [0.42, 0.43, 0.009], [0, 0.08, -0.991], material(0x365962));
  for (const x of [-0.217, 0.217]) trim("Back panel frame", [0.014, 0.458, 0.014], [x, 0.08, -0.982], accentMaterial);
  for (const y of [-0.142, 0.302]) trim("Back panel frame", [0.448, 0.014, 0.014], [0, y, -0.982], accentMaterial);

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

  scene.add(new THREE.HemisphereLight(0xe4f3ff, 0x776046, 1.5));
  const key = new THREE.DirectionalLight(0xffefd8, 2.4);
  key.name = "Room key light";
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.0003;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xb6e7f0, 0.65);
  fill.position.set(0.4, 0.1, 0.2);
  scene.add(fill);

  let previousLayout = "";
  function update({
    screenWidth = 0.286,
    screenHeight = 0.191,
    roomDepth = 0.45,
    elapsedSeconds = 0,
    avatarAnimation = "idle",
    faceBlendshapes = [],
  } = {}) {
    if (characterVisible && avatarReady) avatar.update({ elapsedSeconds, animation: avatarAnimation, faceBlendshapes });
    const layout = `${screenWidth}/${screenHeight}/${roomDepth}`;
    if (layout === previousLayout) return false;
    previousLayout = layout;

    room.scale.set(screenWidth, screenHeight, roomDepth);

    // Keep the fallback doll as a full-body depth reference.
    const dollHeight = Math.min(screenHeight * 0.72, screenWidth * 0.6);
    doll.scale.setScalar(dollHeight);
    doll.position.set(-screenWidth * 0.035, -screenHeight / 2, -roomDepth * 0.48);

    // Test-Chan is intentionally framed as a close bust shot and placed just
    // behind the display plane. The large near/far separation to the back wall
    // makes head movement produce a much stronger room-depth impression.
    const avatarHeight = Math.min(screenHeight * 0.9, screenWidth * 0.75);
    avatar.object.scale.setScalar(avatarHeight);
    avatar.object.position.set(0, -screenHeight * 0.7, -roomDepth * 0.09);

    key.position.set(-screenWidth * 0.7, screenHeight * 1.8, roomDepth * 0.35);
    key.target.position.set(0, -screenHeight * 0.2, -roomDepth * 0.5);
    const span = Math.max(screenWidth, screenHeight, roomDepth) * 0.9;
    Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.01, far: span * 6 });
    key.shadow.camera.updateProjectionMatrix();
    return true;
  }
  update();

  function syncCharacterVisibility() {
    doll.visible = characterVisible && !avatarReady;
    avatar.object.visible = characterVisible && avatarReady;
  }

  return {
    update,
    setDollVisible(visible) { characterVisible = visible; syncCharacterVisibility(); },
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
