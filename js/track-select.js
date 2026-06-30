import { TRACK_HALF_W } from './config.js';
import { generateRandomTrack } from './track-generator.js';

const PREVIEW_SAMPLES = 200;

export class TrackSelectUI {
  constructor({ onApply, onCancel }) {
    this._onApply  = onApply;
    this._onCancel = onCancel;
    this._current  = null;

    this._overlay  = document.getElementById('track-select-overlay');
    this._canvas   = document.getElementById('track-preview-canvas');
    this._ctx      = this._canvas.getContext('2d');
    this._seedInfo = document.getElementById('track-seed-info');

    document.getElementById('track-generate-btn').addEventListener('click', () => this.generate());
    document.getElementById('track-use-btn').addEventListener('click', () => this._apply());
    document.getElementById('track-cancel-btn').addEventListener('click', () => this._cancel());
  }

  show() {
    this._overlay.style.display = 'flex';
    this.generate();
  }

  hide() {
    this._overlay.style.display = 'none';
  }

  generate(seed) {
    this._current = generateRandomTrack(seed);
    this._seedInfo.textContent = `Seed: ${this._current.seed}`;
    this._drawPreview(this._current.curve);
  }

  _apply() {
    if (this._current) this._onApply(this._current.curve);
    this.hide();
  }

  _cancel() {
    this._onCancel();
    this.hide();
  }

  _drawPreview(curve) {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    const N   = PREVIEW_SAMPLES;
    const pts = curve.getSpacedPoints(N);

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    pts.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    });
    const pad = TRACK_HALF_W * 3;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;

    const scale = Math.min((W - 20) / (maxX - minX), (H - 20) / (maxZ - minZ));
    const ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
    const oz = (H - (maxZ - minZ) * scale) / 2 - minZ * scale;
    const toC = (x, z) => [ox + x * scale, oz + z * scale];

    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const p  = pts[i];
      const p1 = pts[Math.min(i + 1, N)];
      const tx = p1.x - p.x, tz = p1.z - p.z;
      const len = Math.sqrt(tx * tx + tz * tz) || 1;
      const nx = -tz / len, nz = tx / len;
      left.push(toC(p.x + nx * TRACK_HALF_W, p.z + nz * TRACK_HALF_W));
      right.push(toC(p.x - nx * TRACK_HALF_W, p.z - nz * TRACK_HALF_W));
    }

    // Road fill
    ctx.beginPath();
    left.forEach(([x, z], i) => i === 0 ? ctx.moveTo(x, z) : ctx.lineTo(x, z));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fillStyle = '#444455';
    ctx.fill();

    // Edge lines
    for (const [ps, col] of [[left, '#ffdd00'], [right, '#cc3322']]) {
      ctx.beginPath();
      ps.forEach(([x, z], i) => i === 0 ? ctx.moveTo(x, z) : ctx.lineTo(x, z));
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Centre dashes
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, z] = toC(p.x, p.z);
      i === 0 ? ctx.moveTo(x, z) : ctx.lineTo(x, z);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start marker
    const [sx, sz] = toC(pts[0].x, pts[0].z);
    ctx.beginPath();
    ctx.arc(sx, sz, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#44ff66';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#44ff66';
    ctx.font = '11px Segoe UI, Arial';
    ctx.fillText('START', sx + 9, sz + 4);

    // Finish marker (checkered)
    const [fx, fz] = toC(pts[N].x, pts[N].z);
    ctx.beginPath();
    ctx.arc(fx, fz, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(fx, fz, 7, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#000';
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        if ((r + c) % 2 === 0) ctx.fillRect(fx + c * 4, fz + r * 4, 4, 4);
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(fx, fz, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('FINISH', fx + 9, fz + 4);
  }
}
