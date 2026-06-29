# How the Neural Network Brain Works

## Overview

Each AI car is controlled by a small neural network that reads sensor data and decides how fast to spin each wheel. The network is never directly programmed with driving rules — instead, a population of 8 cars with random networks is put on the track, the ones that drive furthest score highest, and their networks are combined and mutated to produce the next generation. Over many generations the networks gradually learn to drive.

This approach is called a **genetic algorithm** (or neuroevolution). It requires no labelled training data and no calculus — only a way to measure how well each car performed.

---

## The Neural Network

### Structure

```
Inputs (10)  →  Hidden layer (16 neurons)  →  Outputs (4)
```

| Layer   | Size | Activation |
|---------|------|------------|
| Input   | 10   | none (raw values) |
| Hidden  | 16   | tanh       |
| Output  | 4    | tanh       |

### Inputs

Every physics step the car reads 9 distance sensors and its own speed:

| Index | Meaning |
|-------|---------|
| 0–8   | Distance to nearest wall in 9 directions (−90° to +90° in 22.5° steps), each normalized to 0–1 (0 = wall right here, 1 = nothing within sensor range) |
| 9     | Forward speed, normalized 0–1 (capped at 10 m/s = 1.0) |

### Outputs

The 4 outputs map directly to the 4 wheel motors:

| Index | Wheel |
|-------|-------|
| 0     | Front Left  |
| 1     | Front Right |
| 2     | Rear Left   |
| 3     | Rear Right  |

Each output is in the range −1 to +1 (tanh keeps it there):
- **+1** = full forward spin
- **0** = stopped
- **−1** = full backward spin

The rear motors are physically limited to half the maximum force of the front motors to prevent the car from flipping.

### The Genome

All weights and biases of the network are flattened into a single array of 244 numbers called the **genome**:

```
[ input→hidden weights (10×16 = 160)
  hidden biases (16)
  hidden→output weights (16×4 = 64)
  output biases (4) ]
Total: 244 numbers
```

This flat array is what the genetic algorithm operates on — it treats the entire brain as a single string of numbers to be evolved.

### Forward Pass (how the network thinks)

1. **Hidden layer**: for each of the 16 hidden neurons, multiply every input by its weight, add a bias, then apply `tanh` to squash the result into −1..+1.
2. **Output layer**: same process — multiply the 16 hidden values by their weights, add a bias, apply `tanh`.
3. The 4 output values are sent directly to the wheel motors.

This happens once per physics step (~60 times per second).

---

## The Genetic Algorithm (Training)

### Population

8 cars run simultaneously in the same physics world. They cannot collide with each other — each car has a unique collision group so they pass right through one another. Only walls and the ground affect them.

### Fitness Score

When a car dies (or the episode ends), it receives a fitness score:

```
fitness = maxSplineIndex × 10 + speed × 0.1
```

- `maxSplineIndex` is the furthest point the car reached along the track centre-line (higher = drove further)
- The small speed bonus rewards going fast, not just coasting

### Kill Conditions

A car is removed from the episode early if:
- Any sensor reads < 0.9 m (crashed into a wall)
- Speed stays below 0.5 m/s for 4 consecutive seconds (stuck)
- The episode runs longer than 25 seconds (timeout)
- The car falls off the world (y < −10 m)
- The car strays more than 1 m beyond the track half-width (off-track)

### One Generation Cycle

```
1. All 8 cars spawn at the start with their current genomes
2. Physics runs; each car senses, thinks, and drives
3. Cars are killed as they crash/get stuck/timeout
4. When all 8 are dead → score every car → breed next generation
5. Repeat
```

### Breeding the Next Generation

After every car is dead, the algorithm creates 8 new genomes:

**Step 1 — Rank**: sort the 8 cars by fitness score, best first.

**Step 2 — Elitism**: copy the top 2 genomes unchanged into the next generation. This ensures the best solution found so far is never lost.

**Step 3 — Crossover**: to fill the remaining 6 slots, randomly pick two parents from the top 4 cars. For each of the 244 genome positions, randomly choose whether the child inherits that number from parent A or parent B (50/50). This mixes successful strategies together.

**Step 4 — Mutation**: after crossover, each genome position has a 12% chance of being nudged by a random amount (drawn from a uniform distribution with strength ±0.35). Mutation introduces variation so the population can explore new behaviours.

### Why It Works

Early generations: cars drive randomly and die almost immediately. The few that happen to avoid walls slightly longer score higher and pass their genomes on.

Later generations: small improvements accumulate. A network that learned "when the left sensor is close, turn right" passes that pattern on; mutation might additionally teach it to also speed up when the path ahead is clear.

Over dozens of generations the cars gradually learn to navigate corners, recover from near-misses, and complete longer stretches of track.

---

## Persistence

After every generation the best genomes, generation number, and fitness history are saved to `localStorage`. When you reload the page, training resumes exactly where it left off. The Reset button wipes this save and restarts from random networks.

---

## Visualisation

**Wheel color** (visible on all cars):
- Red = spinning forward at full speed
- Blue = spinning backward at full speed
- Black = stopped
- Shades between = intermediate values

**Body color**:
- Red = the current best alive car (the one the camera follows)
- Gray = all other cars

**Training panel** (top-right in AI mode):
- Generation counter and alive count
- Best fitness score ever recorded
- Network diagram: nodes show hidden/output activations; edge brightness shows weight magnitude
- Fitness chart: best and average score per generation
