import { MAX_MOTOR_SPEED, MAX_MOTOR_FORCE, SPIN_THRESHOLD, WHEEL_RADIUS } from './config.js';
import { carBody, wheelBodies, wheelConstraints, buildCar } from './car.js';

export const sliderValues  = [0, 0, 0, 0];
export const sliderPressed = [false, false, false, false];

const SPRING_RATE = 0.12;
const KEY_RATE    = 0.055;

const keyPress = [0, 0, 0, 0];
const KEY_MAP  = {
  KeyQ: [0,  1], KeyA: [0, -1],
  KeyW: [1,  1], KeyS: [1, -1],
  KeyE: [2,  1], KeyD: [2, -1],
  KeyR: [3,  1], KeyF: [3, -1],
};

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const m = KEY_MAP[e.code];
  if (m) { keyPress[m[0]] = m[1]; sliderPressed[m[0]] = true; }
});
window.addEventListener('keyup', e => {
  const m = KEY_MAP[e.code];
  if (m && keyPress[m[0]] === m[1]) {
    keyPress[m[0]] = 0;
    sliderPressed[m[0]] = false;
  }
});
window.addEventListener('mouseup', () => {
  for (let i = 0; i < 4; i++) {
    if (keyPress[i] === 0) sliderPressed[i] = false;
  }
});

for (let i = 0; i < 4; i++) {
  const slider = document.getElementById(`s${i}`);
  slider.addEventListener('input',       () => { sliderValues[i] = parseInt(slider.value) / 100; });
  slider.addEventListener('mousedown',   () => { sliderPressed[i] = true; });
  slider.addEventListener('touchstart',  () => { sliderPressed[i] = true; }, { passive: true });
  slider.addEventListener('mouseup',     () => { sliderPressed[i] = false; });
  slider.addEventListener('touchend',    () => { sliderPressed[i] = false; });
  slider.addEventListener('touchcancel', () => { sliderPressed[i] = false; });
}

document.getElementById('reset-btn').addEventListener('click', () => {
  buildCar();
  for (let i = 0; i < 4; i++) {
    sliderValues[i] = 0;
    sliderPressed[i] = false;
    document.getElementById(`s${i}`).value = 0;
    document.getElementById(`v${i}`).textContent = '0%';
  }
});

// Called once per frame from the animation loop
export function tickControls() {
  for (let i = 0; i < 4; i++) {
    if (keyPress[i] !== 0) {
      sliderValues[i] = Math.max(-1, Math.min(1, sliderValues[i] + keyPress[i] * KEY_RATE));
    } else if (!sliderPressed[i] && Math.abs(sliderValues[i]) > 0.001) {
      sliderValues[i] *= (1 - SPRING_RATE);
      if (Math.abs(sliderValues[i]) < 0.01) sliderValues[i] = 0;
    }
    const pct = Math.round(sliderValues[i] * 100);
    document.getElementById(`s${i}`).value = pct;
    document.getElementById(`v${i}`).textContent = pct + '%';
  }

  for (let i = 0; i < 4; i++) {
    const v = sliderValues[i];
    wheelConstraints[i].setMotorSpeed(-v * MAX_MOTOR_SPEED);
    wheelConstraints[i].setMotorMaxForce(Math.abs(v) * MAX_MOTOR_FORCE);
  }
}

export function updateSpinIndicators() {
  wheelBodies.forEach((wb, i) => {
    const angSpd   = wb.angularVelocity.length();
    const linSpd   = wb.velocity.length();
    const expected = linSpd / WHEEL_RADIUS;
    const spinning = angSpd > expected + SPIN_THRESHOLD && angSpd > 1;
    document.getElementById(`d${i}`).classList.toggle('spinning', spinning);
  });
}
