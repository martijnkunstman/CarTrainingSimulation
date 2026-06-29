import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TRACK_HALF_W, WALL_H, WALL_T, N_ROAD, N_WALLS } from './config.js';
import { scene } from './scene.js';
import { world, matWall } from './physics.js';

// Open track — start ≠ finish.  Designed as one large non-crossing loop:
//   • Left channel runs north  (x ≈ -10 .. 30)
//   • Top sweeper connects     (x ≈ 30 .. 175)
//   • Right channel runs south (x ≈ 155 .. 180)
//   • Bottom return runs west  (x ≈ 40 .. 155, z < 38)
// The left channel and bottom return are at least 32 m apart, so the
// 11 m wide road never overlaps itself.
const trackCtrl = [
  // START — heading North up left channel
  [ 10,   0],
  [ 10,  35],
  [ 10,  72],
  [ 10, 110],
  // Tight hairpin top-left (N → E)
  [ 10, 138],
  [ 14, 156],
  [ 28, 166],
  [ 45, 162],  // hairpin apex
  [ 58, 155],
  // S-bend top section heading E
  [ 80, 162],
  [100, 172],
  [122, 162],
  [142, 170],
  // Tight corner top-right (E → S)
  [160, 164],
  [172, 152],
  [175, 136],
  [170, 120],  // corner apex
  // Right channel heading S with chicane
  [174,  95],
  [168,  70],
  // Tight corner bottom-right (S → W)
  [162,  46],
  [150,  30],
  [132,  22],  // corner apex
  // Bottom return heading W
  [108,  14],
  [ 82,  10],
  [ 60,  14],
  // FINISH
  [ 42,  26],
].map(([x, z]) => new THREE.Vector3(x, 0, z));

export const trackCurve = new THREE.CatmullRomCurve3(trackCtrl, false, 'catmullrom', 0.5);

// Spawn a little way into the track so side sensors immediately see walls
const startPt  = trackCurve.getPoint(0.04);
const startTan = trackCurve.getTangent(0.04);
export const SPAWN_X     = startPt.x;
export const SPAWN_Z     = startPt.z;
export const SPAWN_ANGLE = Math.atan2(startTan.x, startTan.z);

export function buildTrack() {
  _buildRoadRibbon();
  _buildEdgeLines();
  _buildWalls();
}

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
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr), edgeMat));
  });

  const cLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(centerPts), centerMat);
  cLine.computeLineDistances();
  scene.add(cLine);
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
    }
  }
}
