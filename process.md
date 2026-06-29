# Car Training Simulation — Development Process Log

---

## 2026-06-29

### Neural Network Training System — Design & Implementation

**Goal:** Add a genetic-evolution based neural network that learns to drive the car around the track using sensor inputs.

**Architecture decisions:**
- Genetic evolution (not backpropagation) — avoids the need for labelled training data and works well for continuous control tasks
- 10 inputs: 9 sensor distances (each normalized 0–1 by dividing by SENSOR_LENGTH) + forward speed (normalized 0–1 by dividing by 10 m/s cap)
- 16 hidden neurons with tanh activation
- 4 outputs: FL, FR, RL, RR motor values (tanh → −1 to +1)
- Total genome size: 10×16 + 16 + 16×4 + 4 = 244 parameters

**Population & evolution:**
- 8 cars simultaneously in the same physics world
- 2 elites kept unchanged each generation
- Remaining 6 bred via uniform crossover from top-half parents + Gaussian mutation (rate 0.12, strength 0.35)
- Fitness = maxSplineIndex × 10 + speed × 0.1

**Kill conditions (per agent):**
- Any sensor < 0.9 m (crashed into wall)
- Speed < 0.5 m/s for 4 consecutive seconds (stuck)
- Episode time > 25 s (timeout)

**Collision filtering:**
- Manual car: group=8, mask=−1 (collides with everything)
- AI cars: group=4, mask=3 (only ground=1 and walls=2; not each other, not manual car)
- Sensor raycasts: mask=2 (walls only) — unchanged

**Physics helpers (extracted to car-physics.js):**
- `applyLateralGrip(body, wheels, grip)` — called before world.step(), per agent
- `suppressPitch(body)` — called after world.step(), per agent

**New files created:**
- `js/nn.js` — NeuralNetwork class (genome as Float32Array, forward pass, clone, mutate, crossover)
- `js/evolution.js` — GeneticAlgorithm class (elitism, crossover, mutation, fitness history)
- `js/car-physics.js` — extracted physics helpers, parameterized
- `js/training.js` — TrainingManager, AIAgent classes
- `js/training-ui.js` — NN visualizer canvas + fitness chart + stats panel

**Modified files:**
- `js/sensors.js` — added `senseDistancesForBody(body)` export (raycast without HUD update)
- `js/car.js` — manual car collision group changed to 8
- `js/minimap.js` — `drawMinimap(body?)` accepts optional body (shows best AI agent in AI mode)
- `js/main.js` — AI mode toggle, conditional animate path
- `index.html` — AI toggle button in HUD, training panel div
- `css/style.css` — training panel styles

**Camera in AI mode:** follows the best alive agent's mesh group. If all agents dead (between generations), holds last position.

**UI in AI mode:** sensor HUD hidden, training panel shown top-right with: generation counter, alive count, best fitness ever, episode timer, NN visualizer (edge colors = weight sign/magnitude), fitness chart (best + avg per generation).

**Version bump:** v2.0 → v2.1

---

## 2026-06-29 (continued)

### localStorage persistence + reset button (v2.1 → v2.1, no version bump at time)

- `js/storage.js` — new module: `save()`, `load()`, `clearSave()`, `saveSummary()`. Genomes serialised as plain JSON arrays (Float32Array is not JSON-serialisable); restored to Float32Array on load.
- `training.js` — constructor calls `load()` on startup and restores networks, generation, fitnessHistory, bestEver. `_nextGen()` calls `save()` after every generation so progress survives page reload.
- `training.js` — new `resetTraining()` method: calls `clearSave()`, reinitialises GA from scratch, respawns agents if training is active.
- `training-ui.js` — wires `#reset-training-btn` with a confirmation dialog; shows last saved generation in a "Saved" stats row via `saveSummary()`.
- `index.html` — added "Saved" stat row and red "↺ Reset training data" button inside training panel.
- `css/style.css` — red-tinted reset training button style.

---

### AI cars colliding with each other — fix (v3.0)

**Root cause:** All 8 agents shared `collisionFilterGroup = 4`. cannon-es SAPBroadphase does not reliably filter same-group pairs; contacts leaked through to the narrowphase.

**Fix:** Each agent now gets a unique power-of-2 group bit: `1 << (4 + id)` = 16, 32, 64 … 2048. Since every agent's `mask = 3` (binary 011) only covers bits 0–1, no AI group bit can ever appear in another AI body's mask — zero AI-vs-AI collisions guaranteed at broadphase level.

**Also fixed:** Spawn stagger changed to 2 rows of 4 (2.5 m lateral, 5 m row separation) to avoid bodies overlapping at spawn.

---

### Minimap, spawn, and off-track kill improvements (v3.0 → v3.1)

- All AI cars now spawn at the same single point (unique group bits make physical overlap harmless).
- Minimap circular clip removed — full square canvas used.
- `drawMinimap()` now accepts `agents[]` and draws a coloured dot for each alive AI agent at its world position; focused car (best alive) still rendered as white-outlined triangle on top.
- Off-track kill condition added in `AIAgent.evaluate()`: if distance from nearest spline centre point > `TRACK_HALF_W + 1 m`, agent is killed.
- Spawn point moved from `t = 0` to `t = 0.04` along the spline so side sensors immediately see walls at start.
- `AGENT_COLORS` exported from `training.js` so minimap can use same palette.

**Bug fixed (v3.1):** `TRACK_HALF_W` was used in `training.js` off-track check but missing from the `config.js` import — caused `ReferenceError` on training start.

---
