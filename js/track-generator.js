import * as THREE from 'three';

// Seeded PRNG (mulberry32) so the same seed always produces the same track
function mulberry32(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate a random open-curve track as a CatmullRomCurve3.
// Points are placed along a partial ellipse with random jitter, giving a mix
// of straights, sweepers and tighter corners without self-intersections.
export function generateRandomTrack(seed = (Math.random() * 0xffffffff) | 0) {
  const rand = mulberry32(seed);

  const N          = 9 + Math.floor(rand() * 5);      // 9–13 control points
  const cx         = 80 + (rand() - 0.5) * 30;
  const cz         = 80 + (rand() - 0.5) * 30;
  const rx         = 55 + rand() * 40;                // half-width of base ellipse
  const rz         = 45 + rand() * 35;                // half-height of base ellipse
  const arc        = (0.72 + rand() * 0.22) * Math.PI * 2; // 260°–320° of ellipse
  const startAngle = rand() * Math.PI * 2;
  const jitterAmt  = Math.min(rx, rz) * 0.28;        // jitter relative to ellipse size

  const points = [];
  for (let i = 0; i < N; i++) {
    const t = startAngle + (i / (N - 1)) * arc;
    points.push(new THREE.Vector3(
      cx + rx * Math.cos(t) + (rand() - 0.5) * jitterAmt,
      0,
      cz + rz * Math.sin(t) + (rand() - 0.5) * jitterAmt,
    ));
  }

  return {
    seed,
    curve: new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5),
  };
}
