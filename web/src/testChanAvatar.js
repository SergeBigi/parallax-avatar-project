import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { applyFaceBlendshapes, applyNamedMorphs, indexMorphTargets } from "./faceBlendshapes.js";

const DEFAULT_URL = `${(import.meta.env?.BASE_URL ?? "/")}models/test-chan/Test-Chan.vrm`;
const RELAXED_ARM_ANGLE = Math.PI / 2;
const PORTRAIT_SCALE = 2.3;
const PORTRAIT_OFFSET_Y = -0.96;
const LIT_MATERIALS = new Map([
  ["body", { roughness: 0.86, metalness: 0 }],
  ["face", { roughness: 0.92, metalness: 0 }],
  ["hair", { roughness: 0.48, metalness: 0.02 }],
  ["hairback", { roughness: 0.52, metalness: 0.02 }],
  ["shirt", { roughness: 0.78, metalness: 0 }],
  ["shorts", { roughness: 0.8, metalness: 0 }],
  ["shoes", { roughness: 0.52, metalness: 0.08 }],
  ["glasses", { roughness: 0.32, metalness: 0.28 }],
]);
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
  const framing = new THREE.Group();
  framing.name = "Test-Chan portrait framing";
  framing.scale.setScalar(PORTRAIT_SCALE);
  framing.position.y = PORTRAIT_OFFSET_Y;
  root.add(framing);

  const motion = new THREE.Group();
  framing.add(motion);

  let morphs = new Map();
  let bones = {};
  let bases = new Map();
  let previousFace = null;
  let ready = false;

  const mobileSafeMode = Boolean(globalThis.__PARALLAX_MOBILE_SAFE__);
  if (autoload && !mobileSafeMode) load();
  else if (mobileSafeMode) {
    onStatus({
      state: "mobile-safe",
      message: "Mobiler Sicherheitsmodus · leichter Avatar aktiv",
    });
  }

  function load() {
    onStatus({ state: "loading", message: "Test-Chan wird geladen …" });
    new GLTFLoader().load(modelUrl, (gltf) => {
      const model = gltf.scene;
      model.name = "Test-Chan model";
      if (gltf.parser?.json?.extensions?.VRM) model.rotation.y = Math.PI;
      fitToUnitHeight(model);
      enhanceAvatarLighting(model);
      motion.add(model);
      morphs = indexMorphTargets(model);
      bones = findBones(model);
      bases = createRelaxedBases(bones);
      for (const [bone, base] of bases) bone.quaternion.copy(base);
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
    if (previousFace !== faceBlendshapes) {
      if (previousFace?.length) applyFaceBlendshapes(morphs, previousFace, 0);
      applyFaceBlendshapes(morphs, faceBlendshapes);
      previousFace = faceBlendshapes;
    }
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

export function enhanceAvatarLighting(model) {
  const converted = new Map();
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => convertAvatarMaterial(material, converted));
    } else {
      object.material = convertAvatarMaterial(object.material, converted);
    }
  });
  return model;
}

function convertAvatarMaterial(material, cache) {
  if (!material) return material;
  if (cache.has(material)) return cache.get(material);
  const profile = LIT_MATERIALS.get(clean(material.name));
  if (!profile || material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
    cache.set(material, material);
    return material;
  }

  const lit = new THREE.MeshStandardMaterial({
    name: material.name,
    color: material.color?.clone?.() ?? new THREE.Color(0xffffff),
    map: material.map ?? null,
    alphaMap: material.alphaMap ?? null,
    transparent: material.transparent,
    opacity: material.opacity,
    alphaTest: material.alphaTest,
    side: material.side,
    depthWrite: material.depthWrite,
    depthTest: material.depthTest,
    blending: material.blending,
    vertexColors: material.vertexColors,
    roughness: profile.roughness,
    metalness: profile.metalness,
  });
  lit.premultipliedAlpha = material.premultipliedAlpha;
  lit.toneMapped = material.toneMapped;
  lit.needsUpdate = true;
  cache.set(material, lit);
  return lit;
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

function createRelaxedBases(bones) {
  const result = new Map(Object.values(bones).filter(Boolean).map((bone) => [bone, bone.quaternion.clone()]));
  offsetBase(bones.leftArm, result, 0, 0, RELAXED_ARM_ANGLE);
  offsetBase(bones.rightArm, result, 0, 0, -RELAXED_ARM_ANGLE);
  return result;
}

function offsetBase(bone, bases, x, y, z) {
  if (!bone || !bases.has(bone)) return;
  const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
  bases.get(bone).multiply(delta);
}

function clean(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function animate(mode, time, bones, motion, bases) {
  const wave = Math.sin(time * (mode === "walk" ? 6.2 : 1.7));
  if (mode === "walk") {
    rotate(bones.leftArm, bases, 0, wave * 0.34, 0);
    rotate(bones.rightArm, bases, 0, wave * 0.34, 0);
    rotate(bones.leftLeg, bases, wave * 0.42, 0, 0);
    rotate(bones.rightLeg, bases, -wave * 0.42, 0, 0);
    motion.position.y = Math.abs(wave) * 0.012;
    return;
  }
  if (mode === "jump") {
    const phase = (time % 2.2) / 2.2;
    motion.position.y = phase > 0.18 && phase < 0.72 ? Math.sin(((phase - 0.18) / 0.54) * Math.PI) * 0.13 : 0;
    const lift = motion.position.y > 0 ? 2.15 : 0;
    rotate(bones.leftArm, bases, 0, 0, -lift);
    rotate(bones.rightArm, bases, 0, 0, lift);
    return;
  }
  rotate(bones.chest, bases, wave * 0.018, 0, wave * 0.01);
  rotate(bones.head, bases, 0, Math.sin(time * 0.55) * 0.035, 0);
  motion.position.y = (wave + 1) * 0.002;
}

const animationEuler = new THREE.Euler();
const animationDelta = new THREE.Quaternion();

function rotate(bone, bases, x, y, z) {
  if (!bone) return;
  animationDelta.setFromEuler(animationEuler.set(x, y, z, "XYZ"));
  bone.quaternion.copy(bases.get(bone)).multiply(animationDelta);
}
