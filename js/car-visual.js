import * as THREE from 'three';
import { CAR_BODY_W, CAR_BODY_H, CAR_BODY_L, WHEEL_RADIUS, WHEEL_WIDTH } from './config.js';
import { scene } from './scene.js';
import { WHEEL_OFFSETS } from './car.js';

export const carGroup = new THREE.Group();
scene.add(carGroup);

// Chassis
const chassisMesh = new THREE.Mesh(
  new THREE.BoxGeometry(CAR_BODY_W, CAR_BODY_H, CAR_BODY_L),
  new THREE.MeshPhongMaterial({ color: 0xcc2233, shininess: 120 })
);
chassissMesh.castShadow = true;
chassissMesh.receiveShadow = true;
carGroup.add(chassisMesh);

// Cabin
const cabinMesh = new THREE.Mesh(
  new THREE.BoxGeometry(CAR_BODY_W * 0.72, CAR_BODY_H * 1.4, CAR_BODY_L * 0.48),
  new THREE.MeshPhongMaterial({ color: 0x223344, shininess: 200, transparent: true, opacity: 0.85 })
);
cabinMesh.position.set(0, CAR_BODY_H * 1.2, -CAR_BODY_L * 0.04);
cabinMesh.castShadow = true;
carGroup.add(cabinMesh);

// Front bumper
const frontBumper = new THREE.Mesh(
  new THREE.BoxGeometry(CAR_BODY_W * 0.9, CAR_BODY_H * 0.5, 0.1),
  new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 200 })
);
frontBumper.position.set(0, -CAR_BODY_H * 0.25, CAR_BODY_L * 0.5 + 0.05);
carGroup.add(frontBumper);

// Headlights
[-0.5, 0.5].forEach(sx => {
  const h = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.1, 0.06),
    new THREE.MeshPhongMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 0.8 })
  );
  h.position.set(sx * CAR_BODY_W * 0.72, -CAR_BODY_H * 0.05, CAR_BODY_L * 0.5 + 0.04);
  carGroup.add(h);
});

// Taillights
[-0.5, 0.5].forEach(sx => {
  const t = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.1, 0.06),
    new THREE.MeshPhongMaterial({ color: 0xff2200, emissive: 0xff1100, emissiveIntensity: 0.5 })
  );
  t.position.set(sx * CAR_BODY_W * 0.72, -CAR_BODY_H * 0.05, -CAR_BODY_L * 0.5 - 0.04);
  carGroup.add(t);
});

function makeWheelMesh() {
  const group   = new THREE.Group();
  const rimMat  = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 300 });

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 28),
    new THREE.MeshPhongMaterial({ color: 0x151515, shininess: 20 })
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  group.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS * 0.62, WHEEL_RADIUS * 0.62, WHEEL_WIDTH + 0.01, 16),
    rimMat
  );
  rim.rotation.z = Math.PI / 2;
  group.add(rim);

  for (let s = 0; s < 5; s++) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(WHEEL_WIDTH + 0.02, WHEEL_RADIUS * 0.08, WHEEL_RADIUS * 1.1),
      rimMat
    );
    spoke.rotation.x = (s / 5) * Math.PI * 2;
    group.add(spoke);
  }

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS * 0.18, WHEEL_RADIUS * 0.18, WHEEL_WIDTH + 0.02, 12),
    new THREE.MeshPhongMaterial({ color: 0x444466, shininess: 200 })
  );
  hub.rotation.z = Math.PI / 2;
  group.add(hub);

  return group;
}

export const wheelMeshes = WHEEL_OFFSETS.map(() => {
  const m = makeWheelMesh();
  scene.add(m);
  return m;
});

export function syncVisuals(carBody, wheelBodies) {
  carGroup.position.copy(carBody.position);
  carGroup.quaternion.copy(carBody.quaternion);
  wheelBodies.forEach((wb, i) => {
    wheelMeshes[i].position.copy(wb.position);
    wheelMeshes[i].quaternion.copy(wb.quaternion);
  });
}
