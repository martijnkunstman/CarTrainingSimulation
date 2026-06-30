import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TRACK_HALF_W, WALL_H, WALL_T, N_ROAD, N_WALLS } from './config.js';
import { scene } from './scene.js';
import { world, matWall } from './physics.js';

// Default track — open, non-crossing loop:
//   • Left channel runs north  (x ≈ -10 .. 30)
//   • Top sweeper connects     (x ≈ 30 .. 175)
//   • Right channel runs south (x ≈ 155 .. 180)
//   • Bottom return runs west  (x ≈ 40 .. 155, z < 38)
const DEFAULT_CTRL = [
  [ 10,   0], [ 10,  35], [ 10,  72], [ 10, 110],
  [ 10, 138], [ 14, 156], [ 28, 166], [ 45, 162], [ 58, 155],
  [ 80, 162], [100, 172], [122, 162], [142, 170],
  [160, 164], [172, 152], [175, 136], [170, 120],
  [174,  95], [168,  70],
  [162,  46], [150,  30], [132,  22],
  [108,  14], [ 82,  10], [ 60,  14],
  [ 42,  26],
].map(([x, z]) => new THREE.Vector3(x, 0, z));

const DEFAULT_CURVE = new THREE.CatmullRomCurve3(DEFAULT_CTRL, false, 'catmullrom', 0.5);

export let trackCurve   = DEFAULT_CURVE;
export let SPAWN_X      = 0;
export let SPAWN_Z      = 0;
export let SPAWN_ANGLE  = 0;

function _updateSpawn() {
  // Spawn a little way into the track so side sensors immediately see walls
  const pt  = trackCurve.getPoint(0.04);
  const tan = trackCurve.getTangent(0.04);
  SPAWN_X     = pt.x;
  SPAWN_Z     = pt.z;
  SPAWN_ANGLE = Math.atan2(tan.x, tan.z);
}
_updateSpawn();

// ── Lifecycle: build / clear / replace ──────────────────────────────────────────

const _meshes = [];
const _bodies = [];

function _disposeObject(obj) {
  scene.remove(obj);
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
  }
}

export function clearTrack() {
  _meshes.forEach(_disposeObject);
  _bodies.forEach(b => world.removeBody(b));
  _meshes.length = 0;
  _bodies.length = 0;
}

export function buildTrack() {
  _buildRoadRibbon();
  _buildEdgeLines();
  _buildWalls();
}

// Replace the active track with a new curve: clears old geometry/physics,
// recomputes the spawn point, and rebuilds. Callers are responsible for
// repositioning any cars and refreshing dependent caches (minimap, spline).
export function setTrack(curve) {
  trackCurve = curve;
  _updateSpawn();
  clearTrack();
  buildTrack();
}

export function resetToDefaultTrack() {
  setTrack(DEFAULT_CURVE);
}

// ── Builders ─────────────────────────────────────────────────────────────────

function _buildRoadRibbon() {
  const pts      = trackCurve.getSpacedPoints(N_ROAD);
  const verts    = [];
  const uvs      = [];
  const indices  = [];

  for (let i = 0; i <= N_ROAD; i++) {
    const p  = pts[i];
    const p1 = pts[Math.min(i + 1, N_ROAD)];  // clamp at end for open curve
    const tx = p1.x - p.x, tz = p1.z - p.z;
    const len = Math.sqrt(tx * tx + tz * tz) || 1;
    const nx = -tz / len, nz = tx / len;

    verts.push(
      p.x + nx * TRACK_HALF_W, 0.01, p.z + nz * TRACK_HALF_W,
      p.x - nx * TRACK_HALF_W, 0.01, p.z - nz * TRACK_HALF_W,
    );
    const t = i / N_ROAD;
    uvs.push(0, t,  1, t);
  }

  for (let i = 0; i < N_ROAD; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, b, c,  b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x444444, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  _meshes.push(mesh);
}

function _buildEdgeLines() {
  const pts       = trackCurve.getSpacedPoints(N_ROAD);
  const leftPts   = [], rightPts = [], centerPts = [];

  for (let i = 0; i <= N_ROAD; i++) {
    const p  = pts[i];
    const p1 = pts[Math.min(i + 1, N_ROAD)];
    const tx = p1.x - p.x, tz = p1.z - p.z;
    const len = Math.sqrt(tx * tx + tz * tz) || 1;
    const nx = -tz / len, nz = tx / len;
    leftPts.push(new THREE.Vector3(p.x + nx * TRACK_HALF_W, 0.04, p.z + nz * TRACK_HALF_W));
    rightPts.push(new THREE.Vector3(p.x - nx * TRACK_HALF_W, 0.04, p.z - nz * TRACK_HALF_W));
    centerPts.push(new THREE.Vector3(p.x, 0.04, p.z));
  }

  const edgeMat   = new THREE.LineBasicMaterial({ color: 0xffdd00 });
  const centerMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 1.5, gapSize: 1.5 });

  [leftPts, rightPts].forEach(arr => {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr), edgeMat);
    scene.add(line);
    _meshes.push(line);
  });

  const cLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(centerPts), centerMat);
  cLine.computeLineDistances();
  scene.add(cLine);
  _meshes.push(cLine);
}

function _buildWalls() {
  const wallPts = trackCurve.getSpacedPoints(N_WALLS);

  for (let side = -1; side <= 1; side += 2) {  // +1 = left, -1 = right
    for (let i = 0; i < N_WALLS - 1; i++) {    // N_WALLS-1 segments for open curve
      const p  = wallPts[i];
      const p1 = wallPts[i + 1];

      const tx = p1.x - p.x, tz = p1.z - p.z;
      const segLen = Math.sqrt(tx * tx + tz * tz);
      if (segLen < 0.001) continue;
      const tdx = tx / segLen, tdz = tz / segLen;
      const nx = -tdz, nz = tdx;  // left perpendicular

      const mx = (p.x + p1.x) * 0.5 + nx * side * (TRACK_HALF_W + WALL_T * 0.5);
      const mz = (p.z + p1.z) * 0.5 + nz * side * (TRACK_HALF_W + WALL_T * 0.5);
      const angle = Math.atan2(-tdz, tdx);

      // Extend each segment by 0.5 m per end so adjacent segments overlap at
      // corners and sensors never see a gap between wall pieces.
      const overlap = 0.5;

      // Physics body
      const body = new CANNON.Body({ mass: 0, material: matWall });
      body.addShape(new CANNON.Box(new CANNON.Vec3(segLen * 0.5 + overlap, WALL_H * 0.5, WALL_T * 0.5)));
      body.position.set(mx, WALL_H * 0.5, mz);
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
      body.collisionFilterGroup = 2;  // walls in their own group
      body.collisionFilterMask  = -1; // walls still collide with car/wheels
      world.addBody(body);
      _bodies.push(body);

      // Visual mesh
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(segLen + overlap * 2, WALL_H, WALL_T),
        new THREE.MeshPhongMaterial({ color: side > 0 ? 0x3355aa : 0x993322, shininess: 60 })
      );
      mesh.position.set(mx, WALL_H * 0.5, mz);
      mesh.rotation.y = angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      _meshes.push(mesh);
    }
  }
}
