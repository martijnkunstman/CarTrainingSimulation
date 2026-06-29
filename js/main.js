import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GRIP } from './config.js';
import { renderer, scene, camera, updateCamera } from './scene.js';
import { world } from './physics.js';
import { buildTrack } from './track.js';
import { carBody, wheelBodies, buildCar } from './car.js';
import { syncVisuals, carGroup } from './car-visual.js';
import { updateSensors } from './sensors.js';
import { drawMinimap } from './minimap.js';
import { tickControls, updateSpinIndicators } from './controls.js';

// ── Initialization ────────────────────────────────────────────────────────────
buildTrack();
buildCar();

// ── Reusable vectors for lateral grip ────────────────────────────────────────
const _axle = new CANNON.Vec3();
const _latV  = new CANNON.Vec3();
const _fwd   = new THREE.Vector3(0, 0, 1);

// ── Animation loop ────────────────────────────────────────────────────────────
let lastTime = null;

function animate(time) {
  requestAnimationFrame(animate);

  const dt = lastTime !== null ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
  lastTime = time;

  tickControls();
  applyLateralGrip();
  world.step(1 / 60, dt, 3);
  syncVisuals(carBody, wheelBodies);
  updateSensors();
  drawMinimap();
  updateSpinIndicators();
  updateCamera(carGroup);
  updateHud();

  renderer.render(scene, camera);
}

function applyLateralGrip() {
  _axle.set(1, 0, 0);
  carBody.quaternion.vmult(_axle, _axle);

  wheelBodies.forEach(wb => {
    const vDot = wb.velocity.dot(_axle);
    _latV.set(_axle.x * vDot, _axle.y * vDot, _axle.z * vDot);
    wb.velocity.x -= _latV.x * GRIP;
    wb.velocity.y -= _latV.y * GRIP;
    wb.velocity.z -= _latV.z * GRIP;
  });

  const cbDot = carBody.velocity.dot(_axle);
  carBody.velocity.x -= _axle.x * cbDot * (GRIP * 0.7);
  carBody.velocity.y -= _axle.y * cbDot * (GRIP * 0.7);
  carBody.velocity.z -= _axle.z * cbDot * (GRIP * 0.7);
}

function updateHud() {
  const vel = carBody.velocity;
  document.getElementById('speed').textContent = Math.sqrt(vel.x * vel.x + vel.z * vel.z).toFixed(2);
  const fwdWorld = _fwd.clone().applyQuaternion(carGroup.quaternion);
  const heading  = Math.round(Math.atan2(fwdWorld.x, fwdWorld.z) * 180 / Math.PI);
  document.getElementById('heading').textContent = ((heading % 360) + 360) % 360;
}

animate(0);
