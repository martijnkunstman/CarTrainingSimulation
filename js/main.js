import * as THREE from 'three';
import { GRIP } from './config.js';
import { renderer, scene, camera, updateCamera } from './scene.js';
import { world } from './physics.js';
import { buildTrack } from './track.js';
import { carBody, wheelBodies, buildCar } from './car.js';
import { syncVisuals, carGroup } from './car-visual.js';
import { updateSensors } from './sensors.js';
import { drawMinimap } from './minimap.js';
import { tickControls, updateSpinIndicators, sliderValues } from './controls.js';
import { applyLateralGrip, suppressPitch } from './car-physics.js';
import { trainingManager } from './training.js';
import { updateTrainingUI, showTrainingPanel, hideTrainingPanel, resetEpisodeTimer } from './training-ui.js';

// ── Init ───────────────────────────────────────────────────────────────────────
buildTrack();
buildCar();

// ── AI mode toggle ─────────────────────────────────────────────────────────────
let aiMode = false;

const aiToggleBtn = document.getElementById('ai-toggle-btn');
aiToggleBtn.addEventListener('click', () => {
  aiMode = !aiMode;
  aiToggleBtn.textContent = aiMode ? '⬛ Stop AI' : '▶ Train AI';
  aiToggleBtn.classList.toggle('active', aiMode);

  if (aiMode) {
    showTrainingPanel();
    document.getElementById('sensor-hud').style.display = 'none';
    document.getElementById('controls').style.display   = 'none';
    resetEpisodeTimer();
    trainingManager.start();
  } else {
    hideTrainingPanel();
    document.getElementById('sensor-hud').style.display = '';
    document.getElementById('controls').style.display   = '';
    trainingManager.stop();
    // Re-seat manual car
    buildCar();
  }
});

// ── Finish overlay ─────────────────────────────────────────────────────────────
const finishOverlay = document.getElementById('finish-overlay');
window.addEventListener('trainingFinished', ({ detail }) => {
  document.getElementById('finish-detail').textContent =
    `Generation ${detail.generation} — fitness ${detail.fitness.toFixed(0)}`;
  finishOverlay.style.display = 'flex';
  aiToggleBtn.textContent = '▶ Train AI';
  aiToggleBtn.classList.remove('active');
  aiMode = false;
  hideTrainingPanel();
  document.getElementById('sensor-hud').style.display = '';
  document.getElementById('controls').style.display   = '';
});

finishOverlay.addEventListener('click', () => { finishOverlay.style.display = 'none'; });

// ── Helpers ────────────────────────────────────────────────────────────────────
const _fwd = new THREE.Vector3(0, 0, 1);
let lastTime = null;

function updateHud(body, quaternion) {
  const vel = body.velocity;
  document.getElementById('speed').textContent = Math.sqrt(vel.x * vel.x + vel.z * vel.z).toFixed(2);
  const fwdWorld = _fwd.clone().applyQuaternion(quaternion);
  const heading  = Math.round(Math.atan2(fwdWorld.x, fwdWorld.z) * 180 / Math.PI);
  document.getElementById('heading').textContent = ((heading % 360) + 360) % 360;
}

// ── Animation loop ─────────────────────────────────────────────────────────────
function animate(time) {
  requestAnimationFrame(animate);
  const dt = lastTime !== null ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
  lastTime = time;

  if (aiMode) {
    // Pre-step: AI sense + motors + lateral grip
    trainingManager.preStep();

    world.step(1 / 60, dt, 3);

    // Post-step: pitch suppression, kill checks, visuals
    trainingManager.postStep(dt);

    // Camera: follow best alive agent
    const best = trainingManager.getBestAlive();
    if (best) {
      updateCamera(best.meshGroup);
      drawMinimap(best.body, best.lastDists, trainingManager.agents);
      updateSensors(best.body);
      updateHud(best.body, best.meshGroup.quaternion);
    }

    updateTrainingUI();
  } else {
    // Manual mode
    tickControls();
    applyLateralGrip(carBody, wheelBodies, GRIP);

    world.step(1 / 60, dt, 3);

    suppressPitch(carBody);
    syncVisuals(carBody, wheelBodies, sliderValues);
    updateSensors();
    drawMinimap();
    updateSpinIndicators();
    updateCamera(carGroup);
    updateHud(carBody, carGroup.quaternion);
  }

  renderer.render(scene, camera);
}

animate(0);
