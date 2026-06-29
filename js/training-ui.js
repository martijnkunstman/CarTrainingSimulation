import { trainingManager } from './training.js';
import { saveSummary } from './storage.js';

// ── DOM elements ───────────────────────────────────────────────────────────────
const panel           = document.getElementById('training-panel');
const elGen           = document.getElementById('tp-gen');
const elAlive         = document.getElementById('tp-alive');
const elBest          = document.getElementById('tp-best');
const elEpTime        = document.getElementById('tp-eptime');
const elSaved         = document.getElementById('tp-saved');
const nnCanvas        = document.getElementById('nn-canvas');
const chartCanvas     = document.getElementById('chart-canvas');
const nnCtx           = nnCanvas.getContext('2d');
const chartCtx        = chartCanvas.getContext('2d');
const resetTrainingBtn = document.getElementById('reset-training-btn');

resetTrainingBtn.addEventListener('click', () => {
  if (confirm('Reset all training data? This cannot be undone.')) {
    trainingManager.resetTraining();
  }
});

// ── NN Visualizer ──────────────────────────────────────────────────────────────
const NN_W = nnCanvas.width;
const NN_H = nnCanvas.height;

const INPUT_LABELS  = ['-90°','-60°','-35°','-15°','0°','+15°','+35°','+60°','+90°','spd'];
const OUTPUT_LABELS = ['FL','FR','RL','RR'];
const COLS = [40, NN_W / 2, NN_W - 40]; // x centres: input, hidden, output

function nodeY(idx, total) {
  const margin = 16;
  const step = (NN_H - margin * 2) / Math.max(total - 1, 1);
  return margin + idx * step;
}

function drawNN(inputs, hidden, outputs, genome, I, H, O) {
  nnCtx.clearRect(0, 0, NN_W, NN_H);

  // Edges input→hidden
  for (let h = 0; h < H; h++) {
    const yH = nodeY(h, H);
    for (let i = 0; i < I; i++) {
      const w = genome[h * I + i];
      const alpha = Math.min(0.9, Math.abs(w) * 1.5);
      nnCtx.beginPath();
      nnCtx.moveTo(COLS[0], nodeY(i, I));
      nnCtx.lineTo(COLS[1], yH);
      nnCtx.strokeStyle = w >= 0
        ? `rgba(60,200,80,${alpha.toFixed(2)})`
        : `rgba(220,60,60,${alpha.toFixed(2)})`;
      nnCtx.lineWidth = 1;
      nnCtx.stroke();
    }
  }

  // Edges hidden→output
  const base = I * H + H;
  for (let o = 0; o < O; o++) {
    const yO = nodeY(o, O);
    for (let h = 0; h < H; h++) {
      const w = genome[base + o * H + h];
      const alpha = Math.min(0.9, Math.abs(w) * 1.5);
      nnCtx.beginPath();
      nnCtx.moveTo(COLS[1], nodeY(h, H));
      nnCtx.lineTo(COLS[2], yO);
      nnCtx.strokeStyle = w >= 0
        ? `rgba(60,200,80,${alpha.toFixed(2)})`
        : `rgba(220,60,60,${alpha.toFixed(2)})`;
      nnCtx.lineWidth = 1;
      nnCtx.stroke();
    }
  }

  // Input nodes
  inputs.forEach((v, i) => {
    const y = nodeY(i, I);
    const brightness = Math.round(80 + Math.abs(v) * 175);
    nnCtx.beginPath();
    nnCtx.arc(COLS[0], y, 5, 0, Math.PI * 2);
    nnCtx.fillStyle = `rgb(${brightness},${brightness},${Math.round(brightness * 0.6)})`;
    nnCtx.fill();
    nnCtx.fillStyle = 'rgba(200,200,200,0.7)';
    nnCtx.font = '8px monospace';
    nnCtx.textAlign = 'right';
    nnCtx.fillText(INPUT_LABELS[i], COLS[0] - 8, y + 3);
  });

  // Hidden nodes
  hidden.forEach((v, h) => {
    const y = nodeY(h, H);
    const t = (v + 1) / 2; // 0–1
    nnCtx.beginPath();
    nnCtx.arc(COLS[1], y, 4, 0, Math.PI * 2);
    nnCtx.fillStyle = `rgb(${Math.round(t * 80 + 20)},${Math.round(t * 180 + 20)},${Math.round(t * 80 + 20)})`;
    nnCtx.fill();
  });

  // Output nodes
  outputs.forEach((v, o) => {
    const y = nodeY(o, O);
    const r = v < 0 ? Math.round(-v * 200) : 20;
    const g = v > 0 ? Math.round(v * 200) : 20;
    nnCtx.beginPath();
    nnCtx.arc(COLS[2], y, 6, 0, Math.PI * 2);
    nnCtx.fillStyle = `rgb(${r},${g},20)`;
    nnCtx.fill();
    nnCtx.strokeStyle = '#aaa';
    nnCtx.lineWidth = 1;
    nnCtx.stroke();
    nnCtx.fillStyle = '#ccc';
    nnCtx.font = 'bold 9px monospace';
    nnCtx.textAlign = 'left';
    nnCtx.fillText(`${OUTPUT_LABELS[o]} ${v >= 0 ? '+' : ''}${v.toFixed(2)}`, COLS[2] + 10, y + 3);
  });
}

// ── Fitness Chart ──────────────────────────────────────────────────────────────
const CHART_W = chartCanvas.width;
const CHART_H = chartCanvas.height;

function drawChart(history) {
  chartCtx.clearRect(0, 0, CHART_W, CHART_H);
  if (history.length < 2) {
    chartCtx.fillStyle = 'rgba(140,140,140,0.5)';
    chartCtx.font = '9px sans-serif';
    chartCtx.textAlign = 'center';
    chartCtx.fillText('Fitness chart — needs 2+ generations', CHART_W / 2, CHART_H / 2);
    return;
  }

  const maxF = Math.max(...history.map(h => h.best), 1);
  const pad  = { t: 6, b: 16, l: 4, r: 4 };
  const gw   = CHART_W - pad.l - pad.r;
  const gh   = CHART_H - pad.t - pad.b;

  function toX(i) { return pad.l + (i / (history.length - 1)) * gw; }
  function toY(v) { return pad.t + gh - (v / maxF) * gh; }

  // Avg line
  chartCtx.beginPath();
  history.forEach((h, i) => {
    i === 0 ? chartCtx.moveTo(toX(i), toY(h.avg)) : chartCtx.lineTo(toX(i), toY(h.avg));
  });
  chartCtx.strokeStyle = 'rgba(88,166,255,0.45)';
  chartCtx.lineWidth = 1;
  chartCtx.stroke();

  // Best line
  chartCtx.beginPath();
  history.forEach((h, i) => {
    i === 0 ? chartCtx.moveTo(toX(i), toY(h.best)) : chartCtx.lineTo(toX(i), toY(h.best));
  });
  chartCtx.strokeStyle = '#58a6ff';
  chartCtx.lineWidth = 1.5;
  chartCtx.stroke();

  // X-axis labels
  chartCtx.fillStyle = 'rgba(140,140,140,0.8)';
  chartCtx.font = '8px sans-serif';
  chartCtx.textAlign = 'center';
  chartCtx.fillText('Gen 1', toX(0), CHART_H - 3);
  chartCtx.fillText(`Gen ${history.length}`, toX(history.length - 1), CHART_H - 3);
}

// ── Public update ──────────────────────────────────────────────────────────────
let _episodeStart = performance.now();

export function resetEpisodeTimer() {
  _episodeStart = performance.now();
}

export function updateTrainingUI() {
  const tm   = trainingManager;
  const best = tm.getBestAlive();

  elGen.textContent    = tm.generation;
  elAlive.textContent  = `${tm.aliveCount} / 8`;
  elBest.textContent   = tm.bestEver.toFixed(0);
  elEpTime.textContent = ((performance.now() - _episodeStart) / 1000).toFixed(1) + 's';

  const sv = saveSummary();
  elSaved.textContent = sv ? `gen ${sv.generation}` : 'none';

  // NN visualizer: use best alive agent's last activation
  if (best && best.lastInputs) {
    const nn = best.nn;
    drawNN(best.lastInputs, best.lastHidden, best.lastOutputs, nn.genome, nn.inputSize, nn.hiddenSize, nn.outputSize);
  }

  drawChart(tm.ga.fitnessHistory);
}

export function showTrainingPanel() { panel.style.display = 'block'; }
export function hideTrainingPanel() { panel.style.display = 'none'; }
