import * as CANNON from 'cannon-es';
import { TIRE_LAT_ACCEL_CAP, BODY_LAT_ACCEL_CAP, PITCH_SUPPRESSION } from './config.js';

// Reusable vectors — safe because JS is single-threaded
const _axle      = new CANNON.Vec3();
const _pitchAxis = new CANNON.Vec3();

// Convert a "fraction removed per 60fps-equivalent frame" tuning constant into
// a continuous-time decay so the correction stays consistent at any frame dt
// (the raw per-frame constants used to be applied once per animation frame
// regardless of how long that frame actually was).
function decayFraction(perFrameFraction, dt) {
  const rate = -Math.log(1 - perFrameFraction) * 60;
  return 1 - Math.exp(-rate * dt);
}

// Cancel lateral (sideways) velocity to approximate tire grip. This is still
// a velocity-correction hack rather than a real contact-friction force, but
// it now behaves like a bounded tire budget instead of an unconditional snap:
//  - Friction circle: `throttleFractions[i]` (each wheel's current motor
//    command, -1..1) reduces that wheel's cornering grip as it spends more
//    of its budget on acceleration — capFrac = sqrt(1 - throttle^2). A wheel
//    at full throttle has ~zero lateral grip left, so hard acceleration
//    through a corner now costs traction, the way real tires share one
//    friction budget between accelerating and turning.
//  - Progressive slip: the correction is capped to a maximum lateral
//    deceleration (`accelCap`, m/s^2) per step, so a large sudden slip (e.g.
//    a hard side impact) can't be erased in a single frame — the car slides
//    for a moment instead of snapping straight, since real traction can only
//    remove sideways velocity at a bounded rate, not instantly.
// Called before world.step() each frame.
export function applyLateralGrip(carBody, wheelBodies, grip, dt, throttleFractions) {
  _axle.set(1, 0, 0);
  carBody.quaternion.vmult(_axle, _axle);

  const wheelRemoval   = decayFraction(grip, dt);
  const bodyRemoval    = decayFraction(grip * 0.7, dt);
  const wheelCapDeltaV = TIRE_LAT_ACCEL_CAP * dt;
  const bodyCapDeltaV  = BODY_LAT_ACCEL_CAP * dt;

  let maxThrottle = 0;

  wheelBodies.forEach((wb, i) => {
    const throttle = throttleFractions ? Math.min(1, Math.abs(throttleFractions[i])) : 0;
    maxThrottle    = Math.max(maxThrottle, throttle);
    const capFrac  = Math.sqrt(Math.max(0, 1 - throttle * throttle));

    const vDot = wb.velocity.dot(_axle);
    let target = vDot * wheelRemoval * capFrac;
    target = Math.sign(target) * Math.min(Math.abs(target), wheelCapDeltaV);

    wb.velocity.x -= _axle.x * target;
    wb.velocity.y -= _axle.y * target;
    wb.velocity.z -= _axle.z * target;
  });

  // Chassis correction shares the same friction-circle budget (via the
  // hardest-working wheel) but is capped more gently — it's a secondary
  // stabilizer on top of the per-wheel correction, not the primary grip.
  const bodyCapFrac = Math.sqrt(Math.max(0, 1 - maxThrottle * maxThrottle));
  const cbDot = carBody.velocity.dot(_axle);
  let cbTarget = cbDot * bodyRemoval * bodyCapFrac;
  cbTarget = Math.sign(cbTarget) * Math.min(Math.abs(cbTarget), bodyCapDeltaV);

  carBody.velocity.x -= _axle.x * cbTarget;
  carBody.velocity.y -= _axle.y * cbTarget;
  carBody.velocity.z -= _axle.z * cbTarget;
}

// Damp nose-pitch caused by motor reaction torque.
// Called after world.step() each frame.
export function suppressPitch(carBody, dt) {
  _pitchAxis.set(1, 0, 0);
  carBody.quaternion.vmult(_pitchAxis, _pitchAxis);
  const pitchRate = carBody.angularVelocity.dot(_pitchAxis);
  const removal   = decayFraction(PITCH_SUPPRESSION, dt);
  carBody.angularVelocity.x -= _pitchAxis.x * pitchRate * removal;
  carBody.angularVelocity.y -= _pitchAxis.y * pitchRate * removal;
  carBody.angularVelocity.z -= _pitchAxis.z * pitchRate * removal;
}
