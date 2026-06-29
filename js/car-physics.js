import * as CANNON from 'cannon-es';

// Reusable vectors — safe because JS is single-threaded
const _axle      = new CANNON.Vec3();
const _pitchAxis = new CANNON.Vec3();

// Cancel lateral (sideways) velocity to simulate tire grip.
// Called before world.step() each frame.
export function applyLateralGrip(carBody, wheelBodies, grip) {
  _axle.set(1, 0, 0);
  carBody.quaternion.vmult(_axle, _axle);

  wheelBodies.forEach(wb => {
    const vDot = wb.velocity.dot(_axle);
    wb.velocity.x -= _axle.x * vDot * grip;
    wb.velocity.y -= _axle.y * vDot * grip;
    wb.velocity.z -= _axle.z * vDot * grip;
  });

  const cbDot = carBody.velocity.dot(_axle);
  carBody.velocity.x -= _axle.x * cbDot * (grip * 0.7);
  carBody.velocity.y -= _axle.y * cbDot * (grip * 0.7);
  carBody.velocity.z -= _axle.z * cbDot * (grip * 0.7);
}

// Damp nose-pitch caused by motor reaction torque.
// Called after world.step() each frame.
export function suppressPitch(carBody) {
  _pitchAxis.set(1, 0, 0);
  carBody.quaternion.vmult(_pitchAxis, _pitchAxis);
  const pitchRate = carBody.angularVelocity.dot(_pitchAxis);
  carBody.angularVelocity.x -= _pitchAxis.x * pitchRate * 0.97;
  carBody.angularVelocity.y -= _pitchAxis.y * pitchRate * 0.97;
  carBody.angularVelocity.z -= _pitchAxis.z * pitchRate * 0.97;
}
