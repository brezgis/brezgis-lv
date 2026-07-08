// Fauna behaviour test: ticks AnimalManager directly (no renderer, no rAF —
// headless Chrome throttles rAF so screenshot probes cannot observe motion).
// Verifies every behaviour class MOVES and KEEPS ITS HABITAT over 40 sim-s.
import { AnimalManager } from '../src/animals.js';
import { distToRiver, LOC } from '../src/landuse.js';
import { heightAt } from '../src/terrain.js';
import { RIVER_PTS } from '../src/geodata.js';

const mgr = new AnimalManager();
const rp = RIVER_PTS[Math.round(RIVER_PTS.length * 0.5)];
const riverHome = { x: rp[0], z: rp[1], r: 30 };
const inRiver = (x, z) => distToRiver(x, z) < 7.2;
const meadow = { x: LOC.STEAD.x - 60, z: LOC.STEAD.z + 80, r: 90 };

const subjects = [
  ['fishPerch', riverHome, { medium: 'water', level: rp[2] - 0.28, inWater: inRiver, speed: 0.7 }, { minMove: 3, water: true }],
  ['duckM', riverHome, { medium: 'water', level: rp[2] + 0.03, inWater: inRiver, speed: 0.5 }, { minMove: 3, water: true }],
  ['beaver', riverHome, { medium: 'water', level: rp[2] + 0.02, inWater: inRiver, speed: 0.45 }, { minMove: 2, water: true }],
  ['butterflyW', meadow, { medium: 'air', fly: 'flutter' }, { minMove: 8, air: [0.2, 4] }],
  ['swallow', meadow, { medium: 'air', fly: 'hawk', alt: [4, 15] }, { minMove: 100, air: [2, 26], path: true }],
  ['buzzard', { x: meadow.x, z: meadow.z, r: 1 }, { medium: 'air', fly: 'soar', alt: [70, 130] }, { minMove: 40 }],
  ['crane', { x: 500, z: 1700, r: 400 }, { medium: 'air', fly: 'cross', level: 360 }, { minMove: 200 }],
  ['hare', meadow, { hop: true, hopLen: 1.7, hopH: 0.3, hopDur: 0.32, restT: [3, 8], chainT: 0.05 }, { minMove: 2, land: true }],
  ['frog', { x: rp[0] + 14, z: rp[1], r: 10 }, { hop: true, hopLen: 0.32, hopH: 0.14, hopDur: 0.3, restT: [4, 9], chainT: 0.5 }, { minMove: 0.3 }],
  ['roeDeer', meadow, { grazeBias: 0.75 }, { minMove: 2, land: true }],
  ['wolf', meadow, { speed: 1.3, grazeBias: 0.4 }, { minMove: 4, land: true }],
];

const recs = subjects.map(([kind, home, opts]) => mgr.spawn(kind, home, opts));
const start = recs.map((r) => r.group.position.clone());
const last = recs.map((r) => r.group.position.clone());
const travel = recs.map(() => 0);
let habitatFails = 0;

const DT = 1 / 60, SECONDS = 40;
for (let i = 0; i < SECONDS * 60; i++) {
  mgr.tick(i * DT, DT);
  if (i % 120 === 0) {
    recs.forEach((r, si) => {
      const spec = subjects[si][3];
      const p = r.group.position;
      travel[si] += p.distanceTo(last[si]);
      last[si].copy(p);
      if (spec.water && !inRiver(p.x, p.z)) {
        habitatFails++;
        console.log(`HABITAT-FAIL ${r.kind} left the water at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
      }
      if (spec.land && r.hopT < 0) {
        const dy = Math.abs(p.y - heightAt(p.x, p.z));
        if (dy > 0.7) {
          habitatFails++;
          console.log(`HABITAT-FAIL ${r.kind} floats ${dy.toFixed(2)}m off the ground`);
        }
      }
      if (spec.air) {
        const rel = p.y - heightAt(p.x, p.z);
        if (rel < spec.air[0] - 0.3 || rel > spec.air[1] + 8) {
          habitatFails++;
          console.log(`HABITAT-FAIL ${r.kind} altitude ${rel.toFixed(1)}m outside [${spec.air}]`);
        }
      }
    });
  }
}

let moveFails = 0;
recs.forEach((r, si) => {
  const spec = subjects[si][3];
  // circling fliers are judged by path length, not net displacement
  const d = subjects[si][3].path ? travel[si] : r.group.position.distanceTo(start[si]);
  const ok = d >= spec.minMove;
  if (!ok) moveFails++;
  console.log(`${ok ? 'PASS' : 'MOVE-FAIL'} ${r.kind.padEnd(12)} moved ${d.toFixed(1)}m over ${SECONDS}s (need ≥${spec.minMove})`);
});

console.log(moveFails + habitatFails === 0 ? 'ALL PASS' : `FAILURES: ${moveFails} movement, ${habitatFails} habitat`);
process.exit(moveFails + habitatFails === 0 ? 0 : 1);
