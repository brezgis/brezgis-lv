// Building-footprint registry — so nothing grows through a wall. The tree
// grid only knew the circular PADS around a handful of POIs; every other
// structure (background farms, the church, the mill, the tower) could get a
// spruce through its roof. bgSettlement registers its FINAL validated item
// rects here at era-build time (buildEra always runs before vegetation
// placement in activateEra, so the registry is warm when the planters ask),
// and the hand-placed stage structures the PADS circles miss are listed
// statically. One query answers them all: buildingAt(era, x, z, margin).
import { LOC } from './landuse.js';

// stage structures outside any PADS clearing — generous rects, world coords
const STATIC_RECTS = [
  // Dzērbene church silhouette (nave + tower), eras 3-5
  { x: LOC.CHURCH.x, z: LOC.CHURCH.z, w: 38, d: 24, rot: -0.8, eras: [3, 4, 5] },
  // the watermill beside the Gauja dam, eras 3-4 (house + wheel + flume)
  { x: LOC.MILL.x, z: LOC.MILL.z, w: 12, d: 10, rot: -LOC.MILL.rot, eras: [3, 4] },
  // the 2017 observation tower base (vegetation is thinned there already —
  // this is the belt to that braces)
  { x: LOC.BREZGA.x, z: LOC.BREZGA.z, w: 9, d: 9, rot: -0.2, eras: [5] },
];

const CELL = 32;
const reg = new Map();       // era -> { rects, grid: Map<cellKey, idx[]> }

// Registry rectangles use the planar GIS angle; Three's positive Y rotation
// runs the opposite way in X/Z. Convert staged mesh rotations at the boundary.
export function stageFootprint(x,z,w,d,rotationY=0){return {x,z,w,d,rot:-rotationY};}

function indexRects(rects) {
  const grid = new Map();
  rects.forEach((r, i) => {
    const R = Math.hypot(r.w, r.d) / 2 + 4;      // margin headroom in the index
    for (let ix = Math.floor((r.x - R) / CELL); ix <= Math.floor((r.x + R) / CELL); ix++) {
      for (let iz = Math.floor((r.z - R) / CELL); iz <= Math.floor((r.z + R) / CELL); iz++) {
        const k = ix + ':' + iz;
        let a = grid.get(k);
        if (!a) grid.set(k, a = []);
        a.push(i);
      }
    }
  });
  return grid;
}

// called by bgSettlement with the final (validated, nudged, dropped) items
export function registerFootprints(era, items) {
  const rects = items.map((it) => ({ x: it.x, z: it.z, w: it.w, d: it.d, rot: it.rot || 0 }))
    .concat(STATIC_RECTS.filter((r) => r.eras.includes(era)));
  reg.set(era, { rects, grid: indexRects(rects) });
}

export function buildingAt(era, x, z, margin = 0) {
  const e = reg.get(era);
  if (!e) return staticOnly(era, x, z, margin);   // era not built yet: stage rects still count
  const arr = e.grid.get(Math.floor(x / CELL) + ':' + Math.floor(z / CELL));
  if (!arr) return false;
  for (const i of arr) {
    if (inRect(e.rects[i], x, z, margin)) return true;
  }
  return false;
}

function staticOnly(era, x, z, margin) {
  for (const r of STATIC_RECTS) {
    if (r.eras.includes(era) && inRect(r, x, z, margin)) return true;
  }
  return false;
}

function inRect(r, x, z, m) {
  const dx = x - r.x, dz = z - r.z;
  const c = Math.cos(-r.rot), s = Math.sin(-r.rot);
  const u = dx * c - dz * s, v = dx * s + dz * c;
  return Math.abs(u) < r.w / 2 + m && Math.abs(v) < r.d / 2 + m;
}

// ---- trampled ground (paddocks) -------------------------------------------
// fenced livestock ground is grazed and trodden — the grass system reads
// this to thin and shorten the sward inside, same idea as the yard pads.
const trampleReg = new Map();
export function registerTrample(era, rects) {
  trampleReg.set(era, { rects, grid: indexRects(rects) });
}
export function trampleAt(era, x, z, margin = 0) {
  const e = trampleReg.get(era);
  if (!e) return false;
  const arr = e.grid.get(Math.floor(x / CELL) + ':' + Math.floor(z / CELL));
  if (!arr) return false;
  for (const i of arr) {
    if (inRect(e.rects[i], x, z, margin)) return true;
  }
  return false;
}
