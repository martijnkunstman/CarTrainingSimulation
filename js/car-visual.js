import * as THREE from 'three';
import { CAR_BODY_W, CAR_BODY_H, CAR_BODY_L, WHEEL_RADIUS, WHEEL_WIDTH } from './config.js';
import { scene } from './scene.js';
import { WHEEL_OFFSETS } from './car.js';

// ── Shared wheel-color helpers ─────────────────────────────────────────────────

const _cZero = new THREE.Color(0x000000);
const _cFwd  = new THREE.Color(0xff2200);  // red  = full forward
const _cBwd  = new THREE.Color(0x0044ff);  // blue = full backward

export function motorValueToColor(val) {  // val: -1..+1
  const c = new THREE.Color();
  if (val >= 0) c.lerpColors(_cZero, _cFwd, val);
  else           c.lerpColors(_cZero, _cBwd, -val);
  return c;
}

// ── Simple wheel mesh factory (used by both manual and AI cars) ────────────────

export function makeSimpleWheelMesh() {
  const mat  = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 16),
    mat,
  );
  mesh.rotation.z = Math.PI / 2;
  return { mesh, mat };
}

// ── Manual car ─────────────────────────────────────────────────────────────────

export const carGroup = new THREE.Group();
scene.add(carGroup);

const _carBodyMat = new THREE.MeshLambertMaterial({ color: 0xff2200 }); // manual car always red
carGroup.add(new THREE.Mesh(
  new THREE.BoxGeometry(CAR_BODY_W, CAR_BODY_H, CAR_BODY_L),
  _carBodyMat,
));

// Wheels — each has its own material for per-wheel color
const _wheelEntries = WHEEL_OFFSETS.map(() => {
  const { mesh, mat } = makeSimpleWheelMesh();
  scene.add(mesh);
  return { mesh, mat };
});

export const wheelMeshes = _wheelEntries.map(e => e.mesh); // kept for any external ref

export function syncVisuals(carBody, wheelBodies, motorValues) {
  carGroup.position.copy(carBody.position);
  carGroup.quaternion.copy(carBody.quaternion);

  wheelBodies.forEach((wb, i) => {
    _wheelEntries[i].mesh.position.copy(wb.position);
    _wheelEntries[i].mesh.quaternion.copy(wb.quaternion);
    if (motorValues) {
      _wheelEntries[i].mat.color.copy(motorValueToColor(motorValues[i]));
    }
  });
}
