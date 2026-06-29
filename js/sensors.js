import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SENSOR_ANGLES, SENSOR_LENGTH } from './config.js';
import { scene } from './scene.js';
import { world } from './physics.js';
import { carBody } from './car.js';

// Build sensor HUD rows
const sensorHud = document.getElementById('sensor-hud');
export const sensorBarEls  = [];
export const sensorDistEls = [];

SENSOR_ANGLES.forEach((deg, i) => {
  const row = document.createElement('div');
  row.className = 's-row';
  row.innerHTML = `
    <span class="s-label">${deg > 0 ? '+' : ''}${deg}°</span>
    <div class="s-bar-bg"><div class="s-bar-fill" id="sb${i}"></div></div>
    <span class="s-dist" id="sd${i}">—</span>
  `;
  sensorHud.appendChild(row);
  sensorBarEls.push(row.querySelector(`#sb${i}`));
  sensorDistEls.push(row.querySelector(`#sd${i}`));
});

// 3D sensor ray lines
const sensorLineMat = new THREE.LineBasicMaterial({ vertexColors: true });
const sensorLines = SENSOR_ANGLES.map(() => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,1], 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute([1,1,0, 1,0,0], 3));
  const line = new THREE.Line(geo, sensorLineMat);
  line.frustumCulled = false;  // bounding sphere goes stale when vertices update each frame
  scene.add(line);
  return line;
});

const _rayFrom   = new CANNON.Vec3();
const _rayTo     = new CANNON.Vec3();
const _rayResult = new CANNON.RaycastResult();

export function updateSensors() {
  const pos = carBody.position;
  const SY  = pos.y;

  const fwd = carBody.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
  const rgt = carBody.quaternion.vmult(new CANNON.Vec3(1, 0, 0));

  SENSOR_ANGLES.forEach((deg, i) => {
    const rad  = deg * Math.PI / 180;
    const cosA = Math.cos(rad), sinA = Math.sin(rad);
    const dx = fwd.x * cosA + rgt.x * sinA;
    const dz = fwd.z * cosA + rgt.z * sinA;

    _rayFrom.set(pos.x, SY, pos.z);
    _rayTo.set(pos.x + dx * SENSOR_LENGTH, SY, pos.z + dz * SENSOR_LENGTH);
    _rayResult.reset();
    // collisionFilterMask: 2 → only test against wall bodies (group 2), skipping car/wheels
    world.raycastClosest(_rayFrom, _rayTo, { collisionFilterGroup: -1, collisionFilterMask: 2 }, _rayResult);

    let dist = SENSOR_LENGTH;
    let hitX = _rayTo.x, hitZ = _rayTo.z;
    if (_rayResult.hasHit) {
      dist = _rayResult.distance;
      hitX = _rayResult.hitPointWorld.x;
      hitZ = _rayResult.hitPointWorld.z;
    }

    // HUD bars
    const ratio = dist / SENSOR_LENGTH;
    const r = Math.min(1, 2 * (1 - ratio));
    const g = Math.min(1, 2 * ratio);
    const hex = `#${Math.round(r*255).toString(16).padStart(2,'0')}${Math.round(g*255).toString(16).padStart(2,'0')}00`;
    sensorBarEls[i].style.width      = `${(ratio * 100).toFixed(0)}%`;
    sensorBarEls[i].style.background = hex;
    sensorDistEls[i].textContent     = dist.toFixed(1);

    // 3D line
    const posArr = sensorLines[i].geometry.attributes.position.array;
    posArr[0] = pos.x; posArr[1] = SY; posArr[2] = pos.z;
    posArr[3] = hitX;  posArr[4] = SY; posArr[5] = hitZ;
    sensorLines[i].geometry.attributes.position.needsUpdate = true;

    const colArr = sensorLines[i].geometry.attributes.color.array;
    colArr[0] = r; colArr[1] = g; colArr[2] = 0;
    colArr[3] = r; colArr[4] = g; colArr[5] = 0;
    sensorLines[i].geometry.attributes.color.needsUpdate = true;
  });
}
