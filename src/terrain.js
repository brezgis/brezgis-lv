// Terrain: real Taurene DEM -> carved, painted, walkable ground.
// The height field is shared by every era (the land itself is the constant);
// only the vertex colours (land use) change with time.
import * as THREE from 'three';
import { HM_GRID, HM_SPAN, decodeHeightmap } from './heightmap.js';
import { RIVER_PTS, STREAMS, LAKES, CELL } from './geodata.js';
import { PADS, BUMPS, fieldAt, distToRoad, forestDensity, distToRiver, distToStreams, FIELD_COLORS, LOC } from './landuse.js';
import { makeNoise, clamp, lerp, smoothstep, pointInPoly } from './util.js';

const noise = makeNoise(1907);
const G = HM_GRID, SPAN = HM_SPAN;
const field = decodeHeightmap(); // Float32, row-major, north = row 0

// ---- one-time sculpt of the base field ----------------------------------
function cellToWorld(gx, gy) {
  return [((gx / (G - 1)) - 0.5) * SPAN, ((gy / (G - 1)) - 0.5) * SPAN];
}
(function sculpt() {
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      const i = gy * G + gx;
      const [x, z] = cellToWorld(gx, gy);
      // river channel carve
      let bd = Infinity, lvl = 0;
      for (const p of RIVER_PTS) {
        const d = Math.hypot(p[0] - x, p[1] - z);
        if (d < bd) { bd = d; lvl = p[2]; }
      }
      // wide enough that bilinear interpolation across the 25 m grid cannot
      // lift the channel back above the waterline
      if (bd < 36) {
        const t = smoothstep(36, 14, bd);
        field[i] = lerp(field[i], Math.min(field[i], lvl - 1.8), t);
      }
      // stream channel carve (a soft swale)
      for (const s of STREAMS) {
        let sd = Infinity, sl = 0;
        for (const p of s.pts) {
          const d = Math.hypot(p[0] - x, p[1] - z);
          if (d < sd) { sd = d; sl = p[2]; }
        }
        if (sd < 20) {
          const t = smoothstep(20, 5, sd);
          field[i] = lerp(field[i], Math.min(field[i], sl - 0.8), t);
        }
      }
      // pads (farmyards) flatten
      for (const p of PADS) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < p.r + 24) {
          if (p.y === undefined) {
            // pad target height = field value at pad centre (lazily captured)
            const cgx = Math.round(((p.x / SPAN) + 0.5) * (G - 1));
            const cgy = Math.round(((p.z / SPAN) + 0.5) * (G - 1));
            p.y = field[cgy * G + cgx];
          }
          field[i] = lerp(field[i], p.y, smoothstep(p.r + 24, p.r * 0.55, d));
        }
      }
    }
  }
  // lake beds: make sure they dip below their waterlines
  for (const lake of LAKES) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of lake.poly) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const [x, z] = cellToWorld(gx, gy);
      if (x < minX - CELL || x > maxX + CELL || z < minZ - CELL || z > maxZ + CELL) continue;
      if (pointInPoly(x, z, lake.poly)) {
        const i = gy * G + gx;
        field[i] = Math.min(field[i], lake.level - 1.3);
      }
    }
  }
  // burial barrows (low mounds, era 1 onward — they stay in the land)
  for (const b of BUMPS) {
    const gr = Math.ceil((b.r + 2) / CELL);
    const cgx = Math.round(((b.x / SPAN) + 0.5) * (G - 1));
    const cgy = Math.round(((b.z / SPAN) + 0.5) * (G - 1));
    for (let dy = -gr; dy <= gr; dy++) for (let dx = -gr; dx <= gr; dx++) {
      const gx = cgx + dx, gy = cgy + dy;
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
      const [x, z] = cellToWorld(gx, gy);
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < b.r) field[gy * G + gx] += b.h * (0.5 + 0.5 * Math.cos((d / b.r) * Math.PI));
    }
  }
})();

// cached lake bounds for cheap margin tests during painting
for (const lake of LAKES) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of lake.poly) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  lake.cx = (minX + maxX) / 2; lake.cz = (minZ + maxZ) / 2;
  lake.hx = (maxX - minX) / 2 + 40; lake.hz = (maxZ - minZ) / 2 + 40;
}

// ---- height queries -------------------------------------------------------
function baseHeight(x, z) {
  const fx = clamp(((x / SPAN) + 0.5) * (G - 1), 0, G - 1.001);
  const fz = clamp(((z / SPAN) + 0.5) * (G - 1), 0, G - 1.001);
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const u = fx - x0, v = fz - z0;
  const h = (xx, zz) => field[Math.min(zz, G - 1) * G + Math.min(xx, G - 1)];
  return lerp(lerp(h(x0, z0), h(x0 + 1, z0), u), lerp(h(x0, z0 + 1), h(x0 + 1, z0 + 1), u), v);
}
function microDamp(x, z) {
  let damp = 1;
  for (const p of PADS) damp = Math.min(damp, smoothstep(p.r * 0.6, p.r + 10, Math.hypot(x - p.x, z - p.z)));
  damp = Math.min(damp, smoothstep(6, 18, distToRiver(x, z)));
  return damp;
}
export function heightAt(x, z) {
  const micro = (noise.fbm(x * 0.045, z * 0.045, 2) - 0.5) * 0.7 * microDamp(x, z);
  return baseHeight(x, z) + micro;
}
export function slopeAt(x, z) {
  const e = 2;
  return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
}

// ---- mesh -----------------------------------------------------------------
const RES = 288;
let terrainMesh = null;

export function buildTerrain() {
  const geo = new THREE.PlaneGeometry(SPAN, SPAN, RES - 1, RES - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  terrainMesh.name = 'terrain';
  return terrainMesh;
}

// ---- per-era painting ------------------------------------------------------
const c = new THREE.Color();
export function paintEra(era) {
  const pos = terrainMesh.geometry.attributes.position;
  const col = terrainMesh.geometry.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n1 = noise.fbm(x * 0.008, z * 0.008, 3);
    const n2 = noise.noise2(x * 0.09, z * 0.09);
    const dRiv = distToRiver(x, z);

    // base meadow green, dryer on heights, lusher near water
    let r = 0.30 + n1 * 0.14 + smoothstep(200, 245, y) * 0.10;
    let g = 0.42 + n1 * 0.12 + smoothstep(60, 12, dRiv) * 0.05;
    let b = 0.16 + n2 * 0.05;

    // wildflower sparkle on open meadow (midsummer)
    if (n2 > 0.82 && dRiv < 120 && era < 2) { r += 0.16; g += 0.1; b += 0.12; }

    // forest floor — matched to where trees actually stand (vegetation thins
    // with distance from the stage, so the floor tint must too)
    const fd = forestDensity(era, x, z, y);
    if (fd > 0.4) {
      const dStage = Math.hypot(x - LOC.STEAD.x, z - LOC.STEAD.z);
      const falloff = clamp(420 / Math.max(dStage, 1), 0.22, 1);
      const t = smoothstep(0.4, 0.75, fd) * (0.35 + 0.65 * falloff);
      r = lerp(r, 0.16, t); g = lerp(g, 0.2, t); b = lerp(b, 0.09, t);
    }

    // fields
    const fa = fieldAt(era, x, z);
    if (fa) {
      const [fr, fg, fb] = FIELD_COLORS[fa.field.type];
      const t = smoothstep(0.05, 0.3, fa.edge);
      // plough-row striping
      const s = Math.sin((x * Math.cos(fa.field.rot) + z * Math.sin(fa.field.rot)) * 1.8) * 0.045;
      r = lerp(r, fr + s, t); g = lerp(g, fg + s, t); b = lerp(b, fb + s * 0.6, t);
    }

    // roads & yard earth
    if (era > 0) {
      const dr = distToRoad(era, x, z);
      if (dr < 2.5) {
        const t = smoothstep(2.5, -1, dr);
        r = lerp(r, 0.44, t); g = lerp(g, 0.36, t); b = lerp(b, 0.26, t);
      }
    }
    for (const p of PADS) {
      if (era === 0 && p !== PADS[2]) continue;             // only the camp pad reads as trodden in AD 50
      if (era === 1 && Math.hypot(x - LOC.MANOR.x, z - LOC.MANOR.z) < 80) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r * 0.75) {
        const t = smoothstep(p.r * 0.75, p.r * 0.3, d) * 0.7;
        r = lerp(r, 0.42 + n2 * 0.06, t); g = lerp(g, 0.35, t); b = lerp(b, 0.24, t);
      }
    }

    // water margins: mud + sand
    let wet = dRiv < 9 ? smoothstep(9, 3, dRiv) : 0;
    const dStr = distToStreams(x, z);
    if (dStr < 5) wet = Math.max(wet, smoothstep(5, 1.5, dStr));
    for (const lake of LAKES) {
      if (y < lake.level + 0.5 && Math.abs(x - lake.cx) < lake.hx && Math.abs(z - lake.cz) < lake.hz) {
        wet = Math.max(wet, smoothstep(lake.level + 0.5, lake.level - 0.6, y));
      }
    }
    if (wet > 0) {
      r = lerp(r, 0.25, wet); g = lerp(g, 0.22, wet); b = lerp(b, 0.14, wet);
    }

    col.setXYZ(i, c.set(r, g, b).r, c.g, c.b);
  }
  col.needsUpdate = true;
}
