import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFaceBlendshapes,
  applyNamedMorphs,
  indexMorphTargets,
  normalizeMorphName,
} from "./faceBlendshapes.js";

function fakeRoot() {
  const mesh = {
    morphTargetDictionary: {
      JawOpen: 0,
      mouthSmile_L: 1,
      eyeBlinkRight: 2,
      viseme_aa: 3,
    },
    morphTargetInfluences: [0, 0, 0, 0],
  };
  return {
    mesh,
    traverse(callback) { callback(mesh); },
  };
}

test("morph names are normalized across common separator styles", () => {
  assert.equal(normalizeMorphName("mouth_Smile-Left"), "mouthsmileleft");
});

test("MediaPipe ARKit-style scores drive matching Test-Chan morph targets", () => {
  const { mesh, ...root } = fakeRoot();
  root.traverse = (callback) => callback(mesh);
  const index = indexMorphTargets(root);
  const applied = applyFaceBlendshapes(index, [
    { categoryName: "jawOpen", score: 0.72 },
    { categoryName: "mouthSmileLeft", score: 0.43 },
    { categoryName: "eyeBlinkRight", score: 1.2 },
  ]);
  assert.equal(applied, 3);
  assert.deepEqual(mesh.morphTargetInfluences.slice(0, 3), [0.72, 0.43, 1]);
});

test("named morph input provides a later TTS/viseme hook", () => {
  const { mesh, ...root } = fakeRoot();
  root.traverse = (callback) => callback(mesh);
  const index = indexMorphTargets(root);
  assert.equal(applyNamedMorphs(index, { viseme_aa: 0.8 }), 1);
  assert.equal(mesh.morphTargetInfluences[3], 0.8);
});
