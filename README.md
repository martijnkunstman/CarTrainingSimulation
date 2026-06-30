# Car Training Simulation

A browser-based 3D car simulation built with [Three.js](https://threejs.org/) and [cannon-es](https://github.com/pmndrs/cannon-es). Includes a genetic-evolution neural network that trains the car to drive autonomously. No build step required — open `index.html` directly or serve via GitHub Pages.

Live demo: https://martijnkunstman.github.io/CarTrainingSimulation/

---

## Features

- **4-wheel independent motor control** — each wheel has its own throttle slider (FL, FR, RL, RR)
- **Realistic physics** — rigid body dynamics via cannon-es; hinge constraints for wheel axles; lateral grip and pitch suppression
- **Distance sensors** — 9 raycasts (−90° to +90°) visualised as colour-coded lines in 3D and as bars in the HUD
- **Minimap** — car-centred, car-forward-up; scroll-wheel + buttons to zoom
- **Spin indicator** — red dot per wheel when angular velocity diverges from road speed
- **Non-crossing track** — CatmullRom spline with hairpins, S-bends and a chicane
- **Neural network training** — 8 AI cars evolve simultaneously using a genetic algorithm; live NN visualiser and fitness chart
- **Track generator** — generate, preview and switch to a new randomized track at any time via the 🗺 Track button; swapping tracks resets training (genomes are track-specific) and re-seats the manual car at the new spawn point

---

## File Structure

```
index.html              – HTML structure, importmap, entry point
css/
  style.css             – all UI styles
js/
  config.js             – all constants (car dimensions, physics tuning, track/sensor config)
  scene.js              – Three.js renderer, scene, camera, lights, ground mesh
  physics.js            – cannon-es world, materials, contact materials, ground body
  track.js              – active track spline, spawn point, road ribbon, edge lines, wall bodies, setTrack()/clearTrack()
  track-generator.js    – seeded random track generation (generateRandomTrack)
  track-select.js       – TrackSelectUI: preview canvas + generate/use/cancel modal
  car.js                – manual car body, wheel bodies, hinge constraints, buildCar()
  car-visual.js         – Three.js car and wheel meshes, syncVisuals()
  car-physics.js        – applyLateralGrip() and suppressPitch() (shared by manual + AI cars)
  sensors.js            – sensor HUD rows, 3D ray lines, updateSensors(), senseDistancesForBody()
  minimap.js            – minimap canvas, zoom controls, drawMinimap()
  controls.js           – keyboard/slider input, motor application, spin indicators
  nn.js                 – NeuralNetwork class (genome, forward pass, clone, mutate, crossover)
  evolution.js          – GeneticAlgorithm class (elitism, crossover, mutation, fitness history)
  training.js           – TrainingManager and AIAgent (8 simultaneous physics cars)
  training-ui.js        – NN visualiser canvas, fitness history chart, stats panel
  main.js               – animation loop, manual/AI mode toggle, entry point
process.md              – development log
```

---

## Manual Controls

| Key | Action |
|-----|--------|
| Q / A | FL wheel forward / reverse |
| W / S | FR wheel forward / reverse |
| E / D | RL wheel forward / reverse |
| R / F | RR wheel forward / reverse |

Hold a key to accelerate; release to auto-centre the slider back to zero.  
Use the on-screen sliders for the same control via mouse or touch.

**Reset button** — respawns the car at the track start.

---

## Neural Network Training

Click **▶ Train AI** in the HUD to switch to training mode. 8 coloured AI cars spawn at the track start and begin evolving.

### Architecture

| Layer | Size | Activation |
|-------|------|-----------|
| Input | 10 | — |
| Hidden | 16 | tanh |
| Output | 4 | tanh |

**Inputs:** 9 sensor distances (each normalised 0–1) + forward speed (normalised 0–1)  
**Outputs:** FL, FR, RL, RR motor values (−1 = full reverse, +1 = full forward)  
**Genome:** 244 parameters as a `Float32Array`

### Evolution

| Parameter | Value |
|-----------|-------|
| Population | 8 cars |
| Elites kept | 2 |
| Mutation rate | 12% |
| Mutation strength | 0.35 |
| Crossover | Uniform (gene-wise) |

**Fitness:** `maxSplineIndex × 10 + speed × 0.1 + forwardBonus`

- `forwardBonus` — generations 1–5 only: wheels spinning forward each second add a bonus scaled by `(6 − generation) / 5` (full weight at gen 1, fades to 20% at gen 5, gone from gen 6). Nudges early populations toward forward motion.

**Episode time limit:** 25 s base + 1 s per generation — cars get progressively more time to explore as training matures.

**Kill conditions:**
- Any sensor reads < 0.9 m (wall collision)
- Speed < 0.5 m/s for 4 consecutive seconds (stuck)
- Episode time limit exceeded
- Car falls below y = −10 m
- Car strays > 1 m beyond track half-width (off-track)

### Training UI (top-right panel in AI mode)

- **Stats** — generation, alive count, best fitness ever, episode timer
- **Network diagram** — edges coloured green/red by weight sign and magnitude; nodes coloured by activation value
- **Fitness chart** — blue line = best fitness per generation, dim line = average
- **Speed & heading** — top-left HUD shows live speed and heading of the best alive car

### Finish detection

When a car reaches the end of the track a **"🏁 End of Track Reached!"** overlay appears showing the generation and fitness. The winning brain is saved to `localStorage` under the key `carTrainingWinner` (separate from the regular training save). Click the overlay to dismiss.

Click **⬛ Stop AI** to return to manual mode; the car respawns at the track start.

### Champion brain

The **🏆 Load Champion** button seeds the population with a previously-saved, finish-reaching genome (`js/winner-brain.js`), adds light mutation to the non-elite copies for diversity, and switches into AI mode if not already active.

### Track generator

Click **🗺 Track** to open the track generator/selector overlay:

- **🎲 Generate New** — produces a fresh random track (seeded mulberry32 PRNG, 9–13 control points along a partial-ellipse arc with jitter, built into a CatmullRom spline) and previews it on a 2D canvas (road, edges, centerline, START/FINISH markers, current seed).
- **✓ Use This Track** — replaces the active track: rebuilds the 3D road/walls, refreshes the minimap and the AI's progress-tracking spline, resets training (genomes are tied to the previous layout), and re-seats the manual car at the new spawn point. If AI training was running, it is stopped first.
- **✕ Cancel** — closes the overlay without changing anything.

This currently runs as a modal over the main simulation rather than a separate page. Planned for later: a library of predefined tracks, saving/loading specific tracks (by seed) to `localStorage`, and a race mode where multiple pre-trained brains compete on the same track.

---

## Physics Notes

- `MAX_MOTOR_SPEED` is set high (60 rad/s) so the force limit, not the speed cap, determines terminal velocity.
- `suppressPitch()` cancels 97% of local-X angular velocity after each physics step to prevent nose-lift from motor reaction torque.
- Wall bodies use collision filter group 2; sensor raycasts target only group 2, ignoring the car and wheels.
- Manual car uses collision filter group 8; each AI car gets a unique power-of-2 group bit (`1 << (4 + id)`) with mask 3 (ground + walls only), so AI cars never collide with each other or the manual car.

---

## Dependencies (CDN, no install)

| Library | Version |
|---------|---------|
| three | 0.160.0 |
| cannon-es | 0.20.0 |

Both are loaded via `<script type="importmap">` — no bundler or npm required.
