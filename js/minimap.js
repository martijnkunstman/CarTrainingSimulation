import * as CANNON from 'cannon-es';
import { TRACK_HALF_W, SENSOR_ANGLES, SENSOR_LENGTH } from './config.js';
import { trackCurve } from './track.js';
import { carBody } from './car.js';
import { sensorDistEls } from './sensors.js';

const mmCanvas = document.getElementById('minimap');
const mmCtx    = mmCanvas.getContext('2d');
const MM_W     = mmCanvas.width;
const MM_H     = mmCanvas.height;
const MM_CX    = MM_W / 2;
const MM_CZ    = MM_H / 2;
export let mmView = 60;  // world metres visible from centre to canvas edge

// Zoom controls
mmCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  mmView = Math.max(15, Math.min(220, mmView * (e.deltaY > 0 ? 1.18 : 0.847)));
}, { passive: false });

document.getElementById('mm-plus') .addEventListener('click', () => { mmView = Math.max(15,  mmView * 0.75); });
document.getElementById('mm-minus').addEventListener('click', () => { mmView = Math.min(220, mmView * 1.33); });

// Pre-sample track edges
const MM_SAMPLES  = 250;
const mmCenterPts = trackCurve.getSpacedPoints(MM_SAMPLES);
const mmLeftPts   = [];
const mmRightPts  = [];

for (let i = 0; i < MM_SAMPLES; i++) {
  const p  = mmCenterPts[i];
  const p1 = mmCenterPts[Math.min(i + 1, MM_SAMPLES)];
  const tx = p1.x - p.x, tz = p1.z - p.z;
  const len = Math.sqrt(tx * tx + tz * tz) || 1;
  const nx = -tz / len, nz = tx / len;
  mmLeftPts.push([p.x + nx * TRACK_HALF_W, p.z + nz * TRACK_HALF_W]);
  mmRightPts.push([p.x - nx * TRACK_HALF_W, p.z - nz * TRACK_HALF_W]);
}

let _mmFwdX = 0, _mmFwdZ = 1, _mmRgtX = 1, _mmRgtZ = 0;
let _mmCarX = 0, _mmCarZ = 0;

// Transform a world (wx, wz) into minimap canvas coords.
// Minimap is centred on car, rotated so car forward = up.
function worldToMM(wx, wz) {
  const scale = MM_CX / mmView;
  const dx = wx - _mmCarX, dz = wz - _mmCarZ;
  const r  =  dx * _mmRgtX + dz * _mmRgtZ;
  const f  =  dx * _mmFwdX + dz * _mmFwdZ;
  return [MM_CX - r * scale, MM_CZ - f * scale];  // negate r: canvas x+ = screen right = car left
}

export function drawMinimap() {
  const cpos = carBody.position;
  _mmCarX = cpos.x; _mmCarZ = cpos.z;

  const fwd = carBody.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
  const rgt = carBody.quaternion.vmult(new CANNON.Vec3(1, 0, 0));
  _mmFwdX = fwd.x; _mmFwdZ = fwd.z;
  _mmRgtX = rgt.x; _mmRgtZ = rgt.z;

  mmCtx.clearRect(0, 0, MM_W, MM_H);

  // Circular clip
  mmCtx.save();
  mmCtx.beginPath();
  mmCtx.arc(MM_CX, MM_CZ, MM_CX - 1, 0, Math.PI * 2);
  mmCtx.clip();

  // Road fill
  mmCtx.beginPath();
  mmLeftPts.forEach(([x, z], i) => {
    const [px, pz] = worldToMM(x, z);
    i === 0 ? mmCtx.moveTo(px, pz) : mmCtx.lineTo(px, pz);
  });
  for (let i = mmRightPts.length - 1; i >= 0; i--) {
    const [x, z] = mmRightPts[i];
    const [px, pz] = worldToMM(x, z);
    mmCtx.lineTo(px, pz);
  }
  mmCtx.closePath();
  mmCtx.fillStyle = 'rgba(80,80,95,0.85)';
  mmCtx.fill();

  // Edge lines
  [['#ffdd00', mmLeftPts], ['#cc3322', mmRightPts]].forEach(([color, pts]) => {
    mmCtx.beginPath();
    pts.forEach(([x, z], i) => {
      const [px, pz] = worldToMM(x, z);
      i === 0 ? mmCtx.moveTo(px, pz) : mmCtx.lineTo(px, pz);
    });
    mmCtx.strokeStyle = color;
    mmCtx.lineWidth = 1.5;
    mmCtx.stroke();
  });

  // Sensor rays
  SENSOR_ANGLES.forEach((deg, i) => {
    const rad = deg * Math.PI / 180;
    const cosA = Math.cos(rad), sinA = Math.sin(rad);
    const dx = fwd.x * cosA + rgt.x * sinA;
    const dz = fwd.z * cosA + rgt.z * sinA;
    const dist = parseFloat(sensorDistEls[i].textContent) || SENSOR_LENGTH;
    const [epx, epz] = worldToMM(cpos.x + dx * dist, cpos.z + dz * dist);
    const ratio = dist / SENSOR_LENGTH;
    const r = Math.min(1, 2 * (1 - ratio));
    const g = Math.min(1, 2 * ratio);
    mmCtx.beginPath();
    mmCtx.moveTo(MM_CX, MM_CZ);
    mmCtx.lineTo(epx, epz);
    mmCtx.strokeStyle = `rgba(${Math.round(r*255)},${Math.round(g*255)},0,0.7)`;
    mmCtx.lineWidth = 1;
    mmCtx.stroke();
  });

  // Car icon — always centred, pointing up
  const carSize = 6;
  mmCtx.beginPath();
  mmCtx.moveTo(MM_CX,           MM_CZ - carSize * 1.6);
  mmCtx.lineTo(MM_CX - carSize, MM_CZ + carSize);
  mmCtx.lineTo(MM_CX + carSize, MM_CZ + carSize);
  mmCtx.closePath();
  mmCtx.fillStyle   = '#cc2233';
  mmCtx.strokeStyle = '#ffffff';
  mmCtx.lineWidth   = 1.5;
  mmCtx.fill();
  mmCtx.stroke();

  mmCtx.restore();

  // Circle border
  mmCtx.beginPath();
  mmCtx.arc(MM_CX, MM_CZ, MM_CX - 1, 0, Math.PI * 2);
  mmCtx.strokeStyle = 'rgba(255,255,255,0.25)';
  mmCtx.lineWidth   = 1.5;
  mmCtx.stroke();
}
