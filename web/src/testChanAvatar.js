import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { applyFaceBlendshapes, applyNamedMorphs, indexMorphTargets } from "./faceBlendshapes.js";

const DEFAULT_URL = `${import.meta.env.BASE_URL}models/test-chan/Test-Chan.vrm`;
const BONE_NAMES = {
  chest: ["J_Bip_C_Chest", "Chest", "UpperChest"],
  head: ["J_Bip_C_Head", "Head"],
  leftArm: ["J_Bip_L_UpperArm", "LeftUpperArm"],
  rightArm: ["J_Bip_R_UpperArm", "RightUpperArm"],
  leftLeg: ["J_Bip_L_UpperLeg", "LeftUpperLeg"],
  rightLeg: ["J_Bip_R_UpperLeg", "RightUpperLeg"],
};

export function createTestChanAvatar({ modelUrl = DEFAULT_URL, onStatus = () => {}, autoload = true } = {}) {
  const root = new THREE.Group();
  root.name = "Test-Chan avatar";
  const motion = new THREE.Group();
  root.add(motion);

  let morphs = new Map();
  let bones = {};
  let bases = new Map();
  let previousFace = [];
  let ready = false;

  if (autoload) load();

  function load() {
    onStatus({ state: "loading", message: "Test-Chan wird geladen …" });
    new GLTFLoader().load(modelUrl, (gltf) => {
      const model = gltf.scene;
      model.name = "Test-Chan model";
      if (gltf.parser?.json?.extensions?.VRM) model.rotation.y = Math.PI;
      fitToUnitHeight(model);
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = false;
        object.receiveShadow = false;
      });
      motion.add(model);
      morphs = indexMorphTargets(model);
      bones = findBones(model);
      bases = new Map(Object.values(bones).filter(Boolean).map((bone) => [bone, bone.quaternion.clone()]));
      ready = true;
      const count = new Set([...morphs.values()].flat().map((entry) => entry.name)).size;
      onStatus({ state: "ready", message: `Test-Chan bereit · ${count} Morph Targets erkannt`, morphTargetCount: count });
    }, undefined, (error) => {
      console.error("Test-Chan konnte nicht geladen werden", error);
      onStatus({ state: "missing", message: "Test-Chan.vrm fehlt im Ordner public/models/test-chan", error });
    });
  }

  function update({ elapsedSeconds = 0, animation = "idle", faceBlendshapes = [] } = {}) {
    if (!ready) return false;
    for (const [bone, base] of bases) bone.quaternion.copy(base);
    motion.position.y = 0;
    animate(animation, elapsedSeconds, bones, motion, bases);
    if (previousFace.length) {
      applyFaceBlendshapes(morphs, previousFace.map((item) => ({ ...item, score: 0 })));
    }
    applyFaceBlendshapes(morphs, faceBlendshapes);
    previousFace = faceBlendshapes;
    return true;
  }

  return {
    object: root,
    update,
    load,
    isReady: () => ready,
    applyNamedMorphs: (values) => applyNamedMorphs(morphs, values),
  };
}

function fitToUnitHeight(model) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 1e-6) return;
  const scale = 1 / size.y;
  model.scale.setScalar(scale);
  model.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
}

function findBones(model) {
  const byName = new Map();
  model.traverse((object) => {
    if (object.isBone) byName.set(clean(object.name), object);
  });
  return Object.fromEntries(Object.entries(BONE_NAMES).map(([role, names]) => [
    role,
    names.map((name) => byName.get(clean(name))).find(Boolean) ?? null,
  ]));
}

function clean(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function animate(mode, time, bones, motion, bases) {
  const wave = Math.sin(time * (mode === "walk" ? 6.2 : 1.7));
  if (mode === "walk") {
    rotate(bones.leftArm, bases, -wave * 0.45, 0, 0);
    rotate(bones.rightArm, bases, wave * 0.45, 0, 0);
    rotate(bones.leftLeg, bases, wave * 0.42, 0, 0);
    rotate(bones.rightLeg, bases, -wave * 0.42, 0, 0);
    motion.position.y = Math.abs(wave) * 0.012;
    return;
  }
  if (mode === "jump") {
    const phase = (time % 2.2) / 2.2;
    motion.position.y = phase > 0.18 && phase < 0.72 ? Math.sin(((phase - 0.18) / 0.54) * Math.PI) * 0.13 : 0;
    const arms = motion.position.y > 0 ? -1.35 : -0.15;
    rotate(bones.leftArm, bases, arms, 0, -0.15);
    rotate(bones.rightArm, bases, arms, 0, 0.15);
    return;
  }
  rotate(bones.chest, bases, wave * 0.018, 0, wave * 0.01);
  rotate(bones.head, bases, 0, Math.sin(time * 0.55) * 0.035, 0);
  motion.position.y = (wave + 1) * 0.002;
}

function rotate(bone, bases, x, y, z) {
  if (!bone) return;
  const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
  bone.quaternion.copy(bases.get(bone)).multiply(delta);
}
