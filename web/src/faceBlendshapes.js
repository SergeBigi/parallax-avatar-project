export function normalizeMorphName(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function morphNameCandidates(name) {
  const normalized = normalizeMorphName(name);
  if (!normalized || normalized === "neutral") return [];
  const candidates = new Set([normalized]);
  candidates.add(normalized.replaceAll("left", "l").replaceAll("right", "r"));
  candidates.add(normalized.replace(/^eye/, "").replace(/^mouth/, "mouth"));
  return [...candidates].filter(Boolean);
}

/**
 * Index morph targets without depending on Three.js internals. This works for
 * ordinary glTF/GLB meshes and therefore also for VRM files loaded by GLTFLoader.
 */
export function indexMorphTargets(root) {
  const index = new Map();
  root?.traverse?.((object) => {
    if (!object?.morphTargetDictionary || !Array.isArray(object.morphTargetInfluences)) return;
    for (const [name, morphIndex] of Object.entries(object.morphTargetDictionary)) {
      for (const key of morphNameCandidates(name)) {
        if (!index.has(key)) index.set(key, []);
        index.get(key).push({ object, morphIndex, name });
      }
    }
  });
  return index;
}

export function applyFaceBlendshapes(index, categories = [], weight = 1) {
  let applied = 0;
  for (const category of categories) {
    const name = category?.categoryName ?? category?.displayName ?? "";
    const score = clamp01(Number(category?.score) * weight);
    let targets = null;
    for (const key of morphNameCandidates(name)) {
      targets = index.get(key);
      if (targets?.length) break;
    }
    if (!targets) continue;
    for (const { object, morphIndex } of targets) {
      object.morphTargetInfluences[morphIndex] = score;
      applied += 1;
    }
  }
  return applied;
}

/** Future TTS hook: feed OVR/ARKit/viseme names with values in the 0..1 range. */
export function applyNamedMorphs(index, values = {}) {
  let applied = 0;
  for (const [name, value] of Object.entries(values)) {
    let targets = null;
    for (const key of morphNameCandidates(name)) {
      targets = index.get(key);
      if (targets?.length) break;
    }
    if (!targets) continue;
    for (const { object, morphIndex } of targets) {
      object.morphTargetInfluences[morphIndex] = clamp01(Number(value));
      applied += 1;
    }
  }
  return applied;
}

function clamp01(value) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
