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
