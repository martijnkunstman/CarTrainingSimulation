# Car Training Simulation

A browser-based 3D car simulation built with [Three.js](https://threejs.org/) and [cannon-es](https://github.com/pmndrs/cannon-es). No build step required — open `index.html` directly or serve via GitHub Pages.

Live demo: https://martijnkunstman.github.io/CarTrainingSimulation/

---

## Features

- **4-wheel independent motor control** — each wheel has its own throttle slider (FL, FR, RL, RR)
- **Realistic physics** — rigid body dynamics via cannon-es; hinge constraints for wheel axles; lateral grip simulation
- **Distance sensors** — 9 raycasts (−90° to +90°) visualised as colour-coded lines in 3D and as bars in the HUD
- **Minimap** — car-centred, car-forward-up; scroll-wheel + buttons to zoom
- **Spin indicator** — red dot per wheel when angular velocity diverges from road speed
- **Non-crossing track** — CatmullRom spline with hairpins, S-bends and a chicane; open start/finish

---

## File Structure

```
index.html          – HTML structure, importmap, entry point
css/
  style.css         – all UI styles
js/
  config.js         – all constants (car dimensions, physics tuning, track/sensor config)
  scene.js          – Three.js renderer, scene, camera, lights, ground mesh
  physics.js        – cannon-es world, materials, contact materials, ground body
  track.js          – track spline, spawn point, road ribbon, edge lines, wall bodies
  car.js            – car body, wheel bodies, hinge constraints, buildCar()
  car-visual.js     – Three.js car and wheel meshes, syncVisuals()
  sensors.js        – sensor HUD rows, 3D ray lines, updateSensors()
  minimap.js        – minimap canvas, zoom controls, drawMinimap()
  controls.js       – keyboard/slider input, motor application, spin indicators
  main.js           – animation loop, lateral grip, HUD update, entry point
```

---

## Controls

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

## Physics Notes

- `MAX_MOTOR_SPEED` is set high (60 rad/s) so the force limit, not the speed cap, determines terminal velocity. This means 4WD produces ~2× the top speed of 2WD.
- High `angularDamping` (0.92) on the car body suppresses pitch/roll from motor reaction torque, preventing the car from bouncing during acceleration.
- Wall bodies use collision filter group 2; sensor raycasts target only group 2, so they ignore the car and wheels.

---

## Dependencies (CDN, no install)

| Library | Version |
|---------|---------|
| three | 0.160.0 |
| cannon-es | 0.20.0 |

Both are loaded via `<script type="importmap">` — no bundler or npm required.
