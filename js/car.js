import * as CANNON from 'cannon-es';
import { CAR_BODY_W, CAR_BODY_H, CAR_BODY_L, CAR_MASS, WHEEL_MASS, WHEEL_RADIUS, WHEEL_WIDTH, START_Y, MAX_MOTOR_SPEED, WX, WY, WZ } from './config.js';
import { world, matBody, matWheel } from './physics.js';
import { SPAWN_X, SPAWN_Z, SPAWN_ANGLE } from './track.js';

export const WHEEL_OFFSETS = [
  new CANNON.Vec3(-WX, WY,  WZ),  // front-left
  new CANNON.Vec3( WX, WY,  WZ),  // front-right
  new CANNON.Vec3(-WX, WY, -WZ),  // rear-left
  new CANNON.Vec3( WX, WY, -WZ),  // rear-right
];

export let carBody          = null;
export let wheelBodies      = [];
export let wheelConstraints = [];

export function buildCar() {
  if (carBody) {
    world.removeBody(carBody);
    wheelBodies.forEach(wb => world.removeBody(wb));
    wheelConstraints.forEach(c => world.removeConstraint(c));
  }

  carBody = new CANNON.Body({
    mass:           CAR_MASS,
    material:       matBody,
    linearDamping:  0.08,
    angularDamping: 0.92,
  });
  carBody.addShape(new CANNON.Box(new CANNON.Vec3(CAR_BODY_W / 2, CAR_BODY_H / 2, CAR_BODY_L / 2)));
  carBody.position.set(SPAWN_X, START_Y, SPAWN_Z);
  carBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), SPAWN_ANGLE);
  world.addBody(carBody);

  wheelBodies      = [];
  wheelConstraints = [];

  WHEEL_OFFSETS.forEach(offset => {
    const wb = new CANNON.Body({
      mass:           WHEEL_MASS,
      material:       matWheel,
      linearDamping:  0.05,
      angularDamping: 0.85,
    });

    const shape = new CANNON.Cylinder(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 24);
    const sq    = new CANNON.Quaternion();
    sq.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
    wb.addShape(shape, new CANNON.Vec3(), sq);

    const worldOffset = new CANNON.Vec3();
    carBody.quaternion.vmult(offset, worldOffset);
    wb.position.set(
      carBody.position.x + worldOffset.x,
      carBody.position.y + worldOffset.y,
      carBody.position.z + worldOffset.z
    );
    wb.quaternion.copy(carBody.quaternion);
    world.addBody(wb);
    wheelBodies.push(wb);

    const c = new CANNON.HingeConstraint(carBody, wb, {
      pivotA: offset,
      axisA:  new CANNON.Vec3(1, 0, 0),
      pivotB: new CANNON.Vec3(0, 0, 0),
      axisB:  new CANNON.Vec3(1, 0, 0),
      collideConnected: false,
    });
    c.enableMotor();
    c.setMotorSpeed(0);
    c.setMotorMaxForce(0);
    world.addConstraint(c);
    wheelConstraints.push(c);
  });
}
