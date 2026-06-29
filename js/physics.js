import * as CANNON from 'cannon-es';

export const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = false;

export const matGround = new CANNON.Material('ground');
export const matWheel  = new CANNON.Material('wheel');
export const matBody   = new CANNON.Material('body');
export const matWall   = new CANNON.Material('wall');

world.addContactMaterial(new CANNON.ContactMaterial(matWheel, matGround, {
  friction: 0.72, restitution: 0.0,
  contactEquationStiffness: 1e8, contactEquationRelaxation: 3,
  frictionEquationStiffness: 1e8,
}));
world.addContactMaterial(new CANNON.ContactMaterial(matBody, matGround, {
  friction: 0.4, restitution: 0.0,
}));
world.addContactMaterial(new CANNON.ContactMaterial(matWheel, matWall, {
  friction: 0.1, restitution: 0.3,
}));
world.addContactMaterial(new CANNON.ContactMaterial(matBody, matWall, {
  friction: 0.05, restitution: 0.35,
}));

const groundBody = new CANNON.Body({ mass: 0, material: matGround });
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);
