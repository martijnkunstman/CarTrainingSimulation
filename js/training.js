import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { scene } from './scene.js';
import { makeSimpleWheelMesh, motorValueToColor } from './car-visual.js';
import { world, matBody, matWheel } from './physics.js';
import { trackCurve, SPAWN_X, SPAWN_Z, SPAWN_ANGLE } from './track.js';
import { NeuralNetwork } from './nn.js';
import { GeneticAlgorithm } from './evolution.js';
import { CHAMPION_GENOME } from './winner-brain.js';
import { save, load, clearSave, saveWinner } from './storage.js';
import { applyLateralGrip, suppressPitch } from './car-physics.js';
import { senseDistancesForBody } from './sensors.js';
import {
  CAR_BODY_W, CAR_BODY_H, CAR_BODY_L, CAR_MASS, WHEEL_MASS,
  WHEEL_RADIUS, WHEEL_WIDTH, START_Y, MAX_MOTOR_SPEED, MAX_MOTOR_FORCE,
  WX, WY, WZ, GRIP, SENSOR_LENGTH, TRACK_HALF_W
} from './config.js';

const POP_SIZE     = 8;
const EPISODE_MAX  = 25;   // seconds
const STUCK_SPEED  = 0.5;  // m/s
const STUCK_TIME   = 4;    // seconds
const CRASH_DIST   = 0.9;  // metres
const SPLINE_N     = 500;

export const AGENT_COLORS = [
  0xff4444, 0x44ff44, 0x4488ff, 0xffcc00,
  0xff44ff, 0x44ffcc, 0xff8800, 0x88ff44,
];

// Pre-sample spline for progress tracking
let splinePts = trackCurve.getSpacedPoints(SPLINE_N);

// Call after the active track changes so progress tracking uses the new layout
export function refreshTrackSpline() { splinePts = trackCurve.getSpacedPoints(SPLINE_N); }

function findSplineIdx(x, z, fromIdx) {
  let best = fromIdx, bestDist = Infinity;
  for (let d = -5; d <= 60; d++) {
    const idx = Math.min(Math.max(fromIdx + d, 0), splinePts.length - 1);
    const p = splinePts[idx];
    const dx = p.x - x, dz = p.z - z;
    const dist = dx * dx + dz * dz;
    if (dist < bestDist) { bestDist = dist; best = idx; }
  }
  return best;
}

const WHEEL_OFFSETS = [
  new CANNON.Vec3(-WX, WY,  WZ),
  new CANNON.Vec3( WX, WY,  WZ),
  new CANNON.Vec3(-WX, WY, -WZ),
  new CANNON.Vec3( WX, WY, -WZ),
];

// Each agent gets a unique power-of-2 group bit starting at bit 4 (value 16).
// mask=3 only covers bits 0-1 (ground=1, walls=2), so no AI group bit can
// ever match any AI body's mask — guaranteed zero AI-vs-AI collision regardless
// of broadphase behaviour.
function agentGroup(id) { return 1 << (4 + id); } // 16,32,64,128,256,512,1024,2048

function spawnPos() {
  return { x: SPAWN_X, z: SPAWN_Z };
}

function buildPhysics(x, z, group) {
  const body = new CANNON.Body({
    mass: CAR_MASS, material: matBody, linearDamping: 0.08, angularDamping: 0.92,
  });
  body.addShape(new CANNON.Box(new CANNON.Vec3(CAR_BODY_W / 2, CAR_BODY_H / 2, CAR_BODY_L / 2)));
  body.position.set(x, START_Y, z);
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), SPAWN_ANGLE);
  body.collisionFilterGroup = group;
  body.collisionFilterMask  = 3; // ground(1) + walls(2) only
  world.addBody(body);

  const wheels = [], constraints = [];
  WHEEL_OFFSETS.forEach(offset => {
    const wb = new CANNON.Body({
      mass: WHEEL_MASS, material: matWheel, linearDamping: 0.05, angularDamping: 0.85,
    });
    const shape = new CANNON.Cylinder(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 16);
    const sq = new CANNON.Quaternion();
    sq.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
    wb.addShape(shape, new CANNON.Vec3(), sq);
    const wo = new CANNON.Vec3();
    body.quaternion.vmult(offset, wo);
    wb.position.set(body.position.x + wo.x, body.position.y + wo.y, body.position.z + wo.z);
    wb.quaternion.copy(body.quaternion);
    wb.collisionFilterGroup = group; // same unique bit as car body
    wb.collisionFilterMask  = 3;
    world.addBody(wb);
    wheels.push(wb);

    const c = new CANNON.HingeConstraint(body, wb, {
      pivotA: offset, axisA: new CANNON.Vec3(1, 0, 0),
      pivotB: new CANNON.Vec3(), axisB: new CANNON.Vec3(1, 0, 0),
      collideConnected: false,
    });
    c.enableMotor();
    c.setMotorSpeed(0);
    c.setMotorMaxForce(0);
    world.addConstraint(c);
    constraints.push(c);
  });

  return { body, wheels, constraints };
}

function buildMesh() {
  const group   = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(CAR_BODY_W, CAR_BODY_H, CAR_BODY_L), bodyMat));
  scene.add(group);

  const wheelEntries = WHEEL_OFFSETS.map(() => {
    const { mesh, mat } = makeSimpleWheelMesh();
    scene.add(mesh);
    return { mesh, mat };
  });

  return { group, bodyMat, wheelEntries };
}

// ── AIAgent ────────────────────────────────────────────────────────────────────

class AIAgent {
  constructor(id, nn) {
    this.id = id;
    this.nn = nn;

    const { x, z } = spawnPos();
    const { body, wheels, constraints } = buildPhysics(x, z, agentGroup(id));
    this.body        = body;
    this.wheels      = wheels;
    this.constraints = constraints;

    const { group, bodyMat, wheelEntries } = buildMesh();
    this.meshGroup    = group;
    this.bodyMat      = bodyMat;
    this.wheelEntries = wheelEntries;
    this.wheelMeshes  = wheelEntries.map(e => e.mesh); // kept for visibility toggles

    this._reset(nn);
  }

  _reset(nn) {
    this.nn            = nn;
    this.alive         = true;
    this.fitness       = 0;
    this.maxSplineIdx  = 0;
    this.curSplineIdx  = 0;
    this.episodeTime   = 0;
    this.stuckTimer    = 0;
    this.lastInputs    = null;
    this.lastHidden    = null;
    this.lastOutputs   = null;
    this.forwardBonus  = 0;
  }

  respawn(nn) {
    this._reset(nn);

    const { x, z } = spawnPos();
    this.body.position.set(x, START_Y, z);
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), SPAWN_ANGLE);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.wakeUp();

    WHEEL_OFFSETS.forEach((offset, i) => {
      const wo = new CANNON.Vec3();
      this.body.quaternion.vmult(offset, wo);
      this.wheels[i].position.set(
        this.body.position.x + wo.x,
        this.body.position.y + wo.y,
        this.body.position.z + wo.z,
      );
      this.wheels[i].quaternion.copy(this.body.quaternion);
      this.wheels[i].velocity.set(0, 0, 0);
      this.wheels[i].angularVelocity.set(0, 0, 0);
      this.wheels[i].wakeUp();
    });

    this.meshGroup.visible = true;
    this.wheelEntries.forEach(e => (e.mesh.visible = true));
    this.bodyMat.color.set(0x666666);
  }

  kill() {
    this.alive = false;
    this.meshGroup.visible = false;
    this.wheelMeshes.forEach(wm => (wm.visible = false));
    this.constraints.forEach(c => { c.setMotorSpeed(0); c.setMotorMaxForce(0); });
    // Move underground so body doesn't drift around
    this.body.position.set(0, -50, 0);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.wheels.forEach(wb => {
      wb.position.set(0, -50, 0);
      wb.velocity.set(0, 0, 0);
    });
  }

  // Called before world.step()
  sense(dists) {
    const vel   = this.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

    const inputs = new Float32Array(10);
    for (let i = 0; i < 9; i++) inputs[i] = Math.min(1, dists[i] / SENSOR_LENGTH);
    inputs[9] = Math.min(1, speed / 10);

    const { hidden, outputs } = this.nn.forwardDetailed(inputs);
    this.lastInputs  = inputs;
    this.lastHidden  = hidden;
    this.lastOutputs = outputs;

    for (let i = 0; i < 4; i++) {
      const v     = outputs[i];
      const force = i >= 2 ? MAX_MOTOR_FORCE * 0.5 : MAX_MOTOR_FORCE;
      this.constraints[i].setMotorSpeed(-v * MAX_MOTOR_SPEED);
      this.constraints[i].setMotorMaxForce(Math.abs(v) * force);
    }

    return speed;
  }

  // Called after world.step()
  evaluate(dt, dists, speed, episodeMax, generation) {
    if (!this.alive) return;
    this.episodeTime += dt;

    // Track progress
    this.curSplineIdx = findSplineIdx(this.body.position.x, this.body.position.z, this.curSplineIdx);
    if (this.curSplineIdx > this.maxSplineIdx) this.maxSplineIdx = this.curSplineIdx;

    // Forward-wheel bonus: reward all wheels spinning forward in early generations
    if (generation <= 5 && this.lastOutputs) {
      const factor = (6 - generation) / 5; // 1.0 at gen 1 → 0.2 at gen 5
      let bonus = 0;
      for (let i = 0; i < 4; i++) bonus += Math.max(0, this.lastOutputs[i]);
      this.forwardBonus += bonus * factor * dt; // accumulates per second
    }

    this.fitness = this.maxSplineIdx * 10 + speed * 0.1 + this.forwardBonus;

    // Kill checks
    const crashed = dists.some(d => d < CRASH_DIST);
    if (speed < STUCK_SPEED) { this.stuckTimer += dt; } else { this.stuckTimer = 0; }
    const stuck   = this.stuckTimer > STUCK_TIME;
    const timeout = this.episodeTime > episodeMax;
    const oob     = this.body.position.y < -10;

    // Off-track: too far from nearest spline centre point
    const np = splinePts[this.curSplineIdx];
    const ndx = this.body.position.x - np.x, ndz = this.body.position.z - np.z;
    const offTrack = (ndx * ndx + ndz * ndz) > (TRACK_HALF_W + 1) * (TRACK_HALF_W + 1);

    if (crashed || stuck || timeout || oob || offTrack) { this.kill(); return false; }

    // Reached the end of the track (last 5 spline points)
    if (this.curSplineIdx >= splinePts.length - 6) return true;

    return false;
  }

  syncVisuals() {
    if (!this.alive) return;
    const b = this.body;
    this.meshGroup.position.set(b.position.x, b.position.y, b.position.z);
    this.meshGroup.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    this.wheelEntries.forEach(({ mesh, mat }, i) => {
      const wb = this.wheels[i];
      mesh.position.set(wb.position.x, wb.position.y, wb.position.z);
      mesh.quaternion.set(wb.quaternion.x, wb.quaternion.y, wb.quaternion.z, wb.quaternion.w);
      if (this.lastOutputs) mat.color.copy(motorValueToColor(this.lastOutputs[i]));
    });
  }
}

// ── TrainingManager ────────────────────────────────────────────────────────────

export class TrainingManager {
  constructor() {
    this.ga           = new GeneticAlgorithm({ popSize: POP_SIZE, eliteCount: 2, mutationRate: 0.12, mutationStrength: 0.35 });
    this.agents       = [];
    this.active       = false;
    this.generation   = 1;
    this.bestEver     = 0;
    this._built       = false;
    this._agentSpeeds = new Array(POP_SIZE).fill(0);
    this._agentDists  = Array.from({ length: POP_SIZE }, () => []);

    // Restore from localStorage if a save exists
    const saved = load();
    if (saved) {
      this.ga.networks       = saved.networks;
      this.ga.generation     = saved.generation;
      this.ga.fitnessHistory = saved.fitnessHistory;
      this.generation        = saved.generation + 1;
      this.bestEver          = saved.bestEver;
      console.log(`Resumed training from generation ${saved.generation}, best fitness ${saved.bestEver.toFixed(0)}`);
    }
  }

  _build() {
    if (this._built) return;
    this._built = true;
    for (let i = 0; i < POP_SIZE; i++) {
      this.agents.push(new AIAgent(i, this.ga.networks[i]));
    }
  }

  start() {
    this._build();
    this.active = true;
    this.agents.forEach((a, i) => a.respawn(this.ga.networks[i]));
  }

  stop() {
    this.active = false;
    this.agents.forEach(a => {
      a.meshGroup.visible = false;
      a.wheelMeshes.forEach(wm => (wm.visible = false));
    });
  }

  get aliveCount() { return this.agents.filter(a => a.alive).length; }

  getBestAlive() {
    let best = null, bestF = -Infinity;
    for (const a of this.agents) {
      if (a.alive && a.fitness > bestF) { bestF = a.fitness; best = a; }
    }
    return best;
  }

  // Before world.step(): sense each alive agent and apply motors + lateral grip
  preStep() {
    if (!this.active) return;
    for (let i = 0; i < POP_SIZE; i++) {
      const a = this.agents[i];
      if (!a.alive) continue;
      const dists = senseDistancesForBody(a.body);
      a.lastDists          = dists;
      this._agentDists[i]  = dists;
      this._agentSpeeds[i] = a.sense(dists);
      applyLateralGrip(a.body, a.wheels, GRIP);
    }
  }

  // After world.step(): suppress pitch, check kills, sync visuals
  postStep(dt) {
    if (!this.active) return;
    for (let i = 0; i < POP_SIZE; i++) {
      const a = this.agents[i];
      if (!a.alive) continue;
      suppressPitch(a.body);
      const finished = a.evaluate(dt, this._agentDists[i], this._agentSpeeds[i], EPISODE_MAX + this.generation, this.generation);
      a.syncVisuals();
      if (finished) { this._onFinish(a); return; }
    }

    // Color best alive red, rest gray
    const best = this.getBestAlive();
    this.agents.forEach(a => {
      if (a.bodyMat) a.bodyMat.color.set(a === best ? 0xff2200 : 0x666666);
    });

    if (this.agents.every(a => !a.alive)) {
      this._nextGen();
    }
  }

  _onFinish(agent) {
    this.active = false;
    saveWinner(agent.nn, this.generation);
    this.agents.forEach(a => a.kill());
    window.dispatchEvent(new CustomEvent('trainingFinished', {
      detail: { generation: this.generation, fitness: agent.fitness },
    }));
  }

  _nextGen() {
    const fitnesses = this.agents.map(a => a.fitness);
    const best = Math.max(...fitnesses);
    if (best > this.bestEver) this.bestEver = best;

    const newNets = this.ga.nextGeneration(fitnesses);
    this.generation = this.ga.generation + 1;
    this.agents.forEach((a, i) => a.respawn(newNets[i]));

    // Persist after every generation so progress is never lost
    save(this.ga, this.bestEver);
  }

  // Seed population with the bundled champion genome (1 exact copy + 7 mutated clones)
  loadChampion() {
    clearSave();
    this.ga           = new GeneticAlgorithm({ popSize: POP_SIZE, eliteCount: 2, mutationRate: 0.12, mutationStrength: 0.35 });
    this.generation   = 1;
    this.bestEver     = 0;
    this.ga.networks.forEach((nn, i) => {
      nn.genome.set(CHAMPION_GENOME);
      if (i > 0) NeuralNetwork.mutate(nn.genome, 0.1, 0.2); // gentle mutation for diversity
    });
    if (this.active && this._built) {
      this.agents.forEach((a, i) => a.respawn(this.ga.networks[i]));
    }
  }

  // Wipe localStorage and restart from generation 1 with fresh random networks
  resetTraining() {
    clearSave();
    this.ga           = new GeneticAlgorithm({ popSize: POP_SIZE, eliteCount: 2, mutationRate: 0.12, mutationStrength: 0.35 });
    this.generation   = 1;
    this.bestEver     = 0;
    if (this.active && this._built) {
      this.agents.forEach((a, i) => a.respawn(this.ga.networks[i]));
    }
  }
}

export const trainingManager = new TrainingManager();
