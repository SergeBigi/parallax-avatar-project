import * as THREE from "three";

export function createParallaxScene(scene) {
  scene.background = new THREE.Color(0x070a10);
  scene.fog = new THREE.Fog(0x070a10, 2.4, 5.5);

  scene.add(new THREE.HemisphereLight(0xb6d6ff, 0x11131b, 1.35));

  const keyLight = new THREE.DirectionalLight(0xd7eaff, 3.2);
  keyLight.position.set(-0.6, 1.4, 0.6);
  scene.add(keyLight);

  const accentLight = new THREE.PointLight(0x4de1c1, 8, 2.2, 2);
  accentLight.position.set(0.6, 0.1, -0.25);
  scene.add(accentLight);

  const floor = new THREE.GridHelper(3.6, 30, 0x2dd8bd, 0x213246);
  floor.position.set(0, -0.48, -1.35);
  scene.add(floor);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.2, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x0c1421, wireframe: true, transparent: true, opacity: 0.55 }),
  );
  backWall.position.set(0, 0.35, -2.1);
  scene.add(backWall);

  const depthMaterial = new THREE.MeshStandardMaterial({
    color: 0x233854,
    roughness: 0.58,
    metalness: 0.18,
  });

  [
    [-0.72, -0.28, -0.55, 0.17],
    [0.72, -0.2, -1.15, 0.24],
    [-0.92, -0.08, -1.72, 0.31],
  ].forEach(([x, y, z, size]) => {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), depthMaterial);
    marker.position.set(x, y, z);
    marker.rotation.set(0.2, 0.45, 0.08);
    scene.add(marker);
  });

  const avatar = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x172c43,
    roughness: 0.42,
    metalness: 0.08,
  });
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0x83a8bd,
    roughness: 0.7,
  });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x9fffea });

  const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.42, 6, 14), bodyMaterial);
  shoulders.scale.set(1.35, 1, 0.68);
  shoulders.position.y = -0.3;
  avatar.add(shoulders);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.16, 16), skinMaterial);
  neck.position.y = 0.04;
  avatar.add(neck);

  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.12, 8, 18), skinMaterial);
  head.scale.set(0.82, 1.05, 0.88);
  head.position.y = 0.25;
  avatar.add(head);

  [-0.055, 0.055].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), eyeMaterial);
    eye.position.set(x, 0.28, 0.132);
    avatar.add(eye);
  });

  avatar.position.set(0, 0, -0.9);
  scene.add(avatar);

  const frameGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.42, -0.28, -0.42),
    new THREE.Vector3(-0.42, 0.5, -0.42),
    new THREE.Vector3(0.42, 0.5, -0.42),
    new THREE.Vector3(0.42, -0.28, -0.42),
    new THREE.Vector3(-0.42, -0.28, -0.42),
  ]);
  const portal = new THREE.Line(
    frameGeometry,
    new THREE.LineBasicMaterial({ color: 0xf0a55a, transparent: true, opacity: 0.8 }),
  );
  scene.add(portal);

  return {
    update(elapsedSeconds) {
      avatar.position.y = Math.sin(elapsedSeconds * 1.25) * 0.006;
      accentLight.intensity = 7.5 + Math.sin(elapsedSeconds * 1.8) * 0.7;
    },
  };
}
