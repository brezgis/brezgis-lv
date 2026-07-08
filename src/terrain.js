// Terrain: real Taurene DEM -> carved, painted, walkable ground.
// The height field is shared by every era (the land itself is the constant);
// only the vertex colours (land use) change with time.
import * as THREE from 'three';
import { HM_GRID, HM_SPAN, HM_OFF_X, HM_OFF_Z, decodeHeightmap } from './heightmap.js';
import { RIVER_PTS, STREAMS, LAKES, CELL } from './geodata.js';
import { PADS, BUMPS, fieldAt, distToRoad, distToRoadEx, forestDensity, distToRiver, distToStreams, FIELD_COLORS, LOC } from './landuse.js';
import { makeNoise, clamp, lerp, smoothstep, pointInPoly, sampleSpline, sampleSplineEven } from './util.js';
import { SAT_JPEG_B64 } from './sat2025.js';

const noise = makeNoise(1907);
const G = HM_GRID, SPAN = HM_SPAN, OX = HM_OFF_X, OZ = HM_OFF_Z;
const field = decodeHeightmap(); // Float32, row-major, north = row 0

// ---- one-time sculpt of the base field ----------------------------------
function cellToWorld(gx, gy) {
  return [((gx / (G - 1)) - 0.5) * SPAN + OX, ((gy / (G - 1)) - 0.5) * SPAN + OZ];
}
(function sculpt() {
  // channel carving by POINT STAMPING (exact + fast at any map size):
  // each water point lowers the cells inside its radius; candidates are
  // computed from the pristine field so overlapping stamps stay idempotent.
  const field0 = new Float32Array(field);
  const worldToCell = (x, z) => [
    (((x - OX) / SPAN) + 0.5) * (G - 1),
    (((z - OZ) / SPAN) + 0.5) * (G - 1),
  ];
  function stamp(px, pz, radius, inner, target) {
    const [cx, cy] = worldToCell(px, pz);
    const cr = Math.ceil(radius / CELL) + 1;
    for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) {
      const gx = Math.round(cx) + dx, gy = Math.round(cy) + dy;
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
      const [x, z] = cellToWorld(gx, gy);
      const d = Math.hypot(x - px, z - pz);
      if (d > radius) continue;
      const i = gy * G + gx;
      const cand = lerp(field0[i], Math.min(field0[i], target), smoothstep(radius, inner, d));
      if (cand < field[i]) field[i] = cand;
    }
  }
  // soft valley profile — kept narrow: the old 50m radius carved whole
  // floodplains a metre below the waterline and the river read as an
  // elevated canal crossing a sunken pan
  for (const p of RIVER_PTS) stamp(p[0], p[1], 32, 13, p[2] - 1.7);
  // …and a tight channel stamped along the RIBBON SPLINE itself: the water
  // mesh follows the Catmull-Rom curve between the OSM points, which bulges
  // off the point-stamped corridor on bends and left the river beheaded by
  // untouched ground in places
  const waterSamples = [];   // [x, z, level] along every carved spline
  // ARC-LENGTH-EVEN stamping every ~5m: parametric sampling clustered where
  // the OSM points cluster and left 25-80m unstamped gaps on long segments
  // (the river read as disconnected pools in exactly those reaches)
  for (const [x, z, y] of sampleSplineEven(RIVER_PTS, 5)) {
    stamp(x, z, 26, 9, y - 1.9);
    // shallow SHELF to 16m: guarantees no 17m-cell terrain triangle can
    // bulge up through the bank apron mid-collar (the black-wedge bug)
    stamp(x, z, 30, 16, y - 0.55);
    waterSamples.push([x, z, y]);
  }
  for (const s of STREAMS) {
    for (const p of s.pts) stamp(p[0], p[1], 24, 6, p[2] - 0.8);
    for (const [x, z, y] of sampleSplineEven(s.pts, 4)) {
      stamp(x, z, 10, 3.5, y - 0.75);
      waterSamples.push([x, z, y]);
    }
  }
  // FLOOR CLAMP: land beyond the shore shelf can never sit below its local
  // waterline — a river keeps its floodplain flooded, not sunken. Overlapping
  // meander stamps compounded into pans carved ~1.9m below river level (the
  // Dzērbe confluence loop hung the water ribbon in mid-air over one).
  {
    const BK = 28, key = (bx, bz) => bx * 4096 + bz;
    const buckets = new Map();
    for (const s of waterSamples) {
      const k = key(Math.floor(s[0] / BK), Math.floor(s[1] / BK));
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(s);
    }
    const R = 84;
    const inAnyLake = (x, z) => {
      for (const lake of LAKES) { if (pointInPoly(x, z, lake.poly)) return true; }
      return false;
    };
    const P = LOC.POND;
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const [x, z] = cellToWorld(gx, gy);
      let dmin = 1e9, lvl = 0;
      const bx = Math.floor(x / BK), bz = Math.floor(z / BK);
      // ±4 buckets: ±3 only guaranteed ~56m of the 84m clamp radius, leaving
      // unclamped sunken pans in the 56-84m ring
      for (let by = bz - 4; by <= bz + 4; by++) for (let bxx = bx - 4; bxx <= bx + 4; bxx++) {
        const arr = buckets.get(key(bxx, by));
        if (!arr) continue;
        for (const s of arr) {
          const d = Math.hypot(x - s[0], z - s[1]);
          if (d < dmin) { dmin = d; lvl = s[2]; }
        }
      }
      if (dmin > R || dmin <= 16.2) continue;                 // bed+shelf stay carved
      if (Math.hypot((x - (P.x + 4)) / 56, (z - P.z) / 38) < 1.25) continue; // pond basin
      if (inAnyLake(x, z)) continue;
      const minH = lvl - 0.5 + 0.75 * smoothstep(16.2, 27, dmin); // → lvl+0.25 past 27m
      const i = gy * G + gx;
      if (field[i] < minH) field[i] = minH;
    }
  }
  // the mill-pond basin: a real dished bed at the Gauja bend so the pond
  // water body meets the mill and dam instead of hovering on the bank
  {
    const P = LOC.POND, lvl = LOC.POND_LEVEL;
    const RX = 56, RZ = 38;
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const [x, z] = cellToWorld(gx, gy);
      const nx = (x - (P.x + 4)) / RX, nz = (z - P.z) / RZ;
      const rr = Math.hypot(nx, nz);
      if (rr < 1.15) {
        const i = gy * G + gx;
        const bed = lvl - 1.2 + smoothstep(0.7, 1.15, rr) * 2.6;
        field[i] = Math.min(field[i], Math.max(bed, lvl - 1.2));
        // …and RAISE low rims to the same profile: the N/SW rims sat below
        // the waterline, so the flat pond sheet hung in the air past them
        field[i] = Math.max(field[i], Math.min(bed, lvl + 0.25) - 0.35);
      }
    }
  }

  // pads (farmyards) flatten
  for (const p of PADS) {
    const cgx = Math.round((((p.x - OX) / SPAN) + 0.5) * (G - 1));
    const cgy = Math.round((((p.z - OZ) / SPAN) + 0.5) * (G - 1));
    if (p.y === undefined) p.y = field[cgy * G + cgx];
    const cr = Math.ceil((p.r + 24) / CELL) + 1;
    for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) {
      const gx = cgx + dx, gy = cgy + dy;
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
      const [x, z] = cellToWorld(gx, gy);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < p.r + 24) {
        const i = gy * G + gx;
        field[i] = lerp(field[i], p.y, smoothstep(p.r + 24, p.r * 0.55, d));
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
  // burial barrows (low mounds — they stay in the land once raised)
  for (const b of BUMPS) {
    const gr = Math.ceil((b.r + 2) / CELL);
    const cgx = Math.round((((b.x - OX) / SPAN) + 0.5) * (G - 1));
    const cgy = Math.round((((b.z - OZ) / SPAN) + 0.5) * (G - 1));
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
  const fx = clamp((((x - OX) / SPAN) + 0.5) * (G - 1), 0, G - 1.001);
  const fz = clamp((((z - OZ) / SPAN) + 0.5) * (G - 1), 0, G - 1.001);
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const u = fx - x0, v = fz - z0;
  const h = (xx, zz) => field[Math.min(zz, G - 1) * G + Math.min(xx, G - 1)];
  return lerp(lerp(h(x0, z0), h(x0 + 1, z0), u), lerp(h(x0, z0 + 1), h(x0 + 1, z0 + 1), u), v);
}
function microDamp(x, z) {
  let damp = 1;
  for (const p of PADS) damp = Math.min(damp, smoothstep(p.r * 0.6, p.r + 10, Math.hypot(x - p.x, z - p.z)));
  damp = Math.min(damp, smoothstep(14, 26, distToRiver(x, z))); // micro noise must not breach the shore
  // main-road corridors ride a draped ribbon: micro bumps bigger than its
  // crown swallowed the carriageway in stretches
  const ri = distToRoadEx(5, x, z);
  if (ri.c <= 1 && ri.d < 14) damp = Math.min(damp, smoothstep(4, 14, ri.d));
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
const RES = 512;
let terrainMesh = null;

// high-frequency detail so the ground doesn't read as flat vertex paint —
// multi-octave albedo modulation + a bump channel for micro-relief
// (tussocks, soil crumb), and a slope rule that bares the glacial till on
// steep river banks. All in world space so it survives the vertex paint.
let detailTex = null;
function makeDetailTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  const n = makeNoise(515);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const v = (n.fbm(x / 34, y / 34, 4) * 0.7 + n.noise2(x / 6.5, y / 6.5) * 0.3) * 255;
    const i = (y * 256 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping; // seamless tiling
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
function detailify(material, strength) {
  if (!detailTex) detailTex = makeDetailTex();
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: detailTex };
    sh.uniforms.uDetailK = { value: strength };
    sh.vertexShader = 'varying vec3 vWp; varying float vSlope;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vSlope = 1.0 - normalize(normal).y;`
    );
    sh.fragmentShader = 'uniform sampler2D uDetail; uniform float uDetailK; varying vec3 vWp; varying float vSlope;\n' +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float d0 = texture2D(uDetail, vWp.xz * 0.31).r;   // soil crumb
          float d1 = texture2D(uDetail, vWp.xz * 0.09).r;   // tussocks
          float d2 = texture2D(uDetail, vWp.xz * 0.011).r;  // field-scale patchiness
          diffuseColor.rgb *= mix(1.0, (0.84 + 0.3 * d0) * (0.74 + 0.5 * d1) * (0.8 + 0.4 * d2), uDetailK);
          // sward speckle: on green ground a ~1m turf grain carries the
          // grass illusion far beyond the instanced blade rings
          float sward = texture2D(uDetail, vWp.xz * 0.9).r;
          float greenK = clamp((diffuseColor.g - diffuseColor.r) * 5.0, 0.0, 1.0);
          diffuseColor.rgb *= mix(1.0, 0.8 + 0.38 * sward, greenK * uDetailK);
          // steep ground bares mineral soil / till between the grass
          float bare = smoothstep(0.16, 0.45, vSlope + (d1 - 0.5) * 0.14);
          diffuseColor.rgb = mix(diffuseColor.rgb,
            vec3(0.40, 0.345, 0.26) * (0.7 + 0.5 * d0), bare * 0.75 * uDetailK);
        }`
      );
  };
  return material;
}

// exact height of the RENDERED terrain surface (the mesh's own triangles).
// heightAt() is the smooth field; between the 17m mesh vertices the two can
// differ by up to ~1m, which swallowed draped geometry like the roads.
let meshH = null;
export function meshHeightAt(x, z) {
  if (!meshH) return heightAt(x, z);
  const { arr, x0, z0, sx, sz, n } = meshH;
  // signed steps: after rotateX(-PI/2) the vertex rows run in DECREASING z
  const fx = clamp((x - x0) / sx, 0, n - 1.001);
  const fz = clamp((z - z0) / sz, 0, n - 1.001);
  const c = Math.floor(fx), r = Math.floor(fz);
  const u = fx - c, v = fz - r;
  const hA = arr[r * n + c], hB = arr[r * n + c + 1];
  const hC = arr[(r + 1) * n + c], hD = arr[(r + 1) * n + c + 1];
  // PlaneGeometry splits each cell A-B / C-D along the B-C diagonal
  if (u + v <= 1) return hA + (hB - hA) * u + (hC - hA) * v;
  return hD + (hC - hD) * (1 - u) + (hB - hD) * (1 - v);
}

export function buildTerrain() {
  const geo = new THREE.PlaneGeometry(SPAN, SPAN, RES - 1, RES - 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(OX, 0, OZ);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  // record the rendered grid for meshHeightAt
  {
    const n = RES;
    const arr = new Float32Array(n * n);
    for (let i = 0; i < pos.count; i++) arr[i] = pos.getY(i);
    meshH = {
      arr, n,
      x0: pos.getX(0), z0: pos.getZ(0),
      sx: pos.getX(1) - pos.getX(0),
      sz: pos.getZ(n) - pos.getZ(0),
    };
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  if (!detailTex) detailTex = makeDetailTex();
  const bump = detailTex.clone();
  // 12m tiles at moderate strength: finer/stronger shimmers at distance
  bump.repeat.set(700, 700);
  bump.needsUpdate = true;
  const mat = detailify(new THREE.MeshLambertMaterial({
    vertexColors: true, bumpMap: bump, bumpScale: 0.35,
  }), 1.0);
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  terrainMesh.name = 'terrain';
  return terrainMesh;
}

// ---- per-era painting ------------------------------------------------------
const c = new THREE.Color();
let satMaterial = null, colorMaterial = null;
export function paintEra(era) {
  if (!colorMaterial) colorMaterial = terrainMesh.material;
  // era 5: the real Sentinel-2 drape replaces painted colours entirely
  if (era === 5) {
    if (!satMaterial) {
      const tex = new THREE.TextureLoader().load(
        'data:image/jpeg;base64,' + SAT_JPEG_B64,
        (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; }
      );
      satMaterial = detailify(new THREE.MeshLambertMaterial({ map: tex }), 0.55);
    }
    terrainMesh.material = satMaterial;
    return;
  }
  terrainMesh.material = colorMaterial;
  const pos = terrainMesh.geometry.attributes.position;
  const col = terrainMesh.geometry.attributes.color;

  if (era === 0) {
    // Younger Dryas tundra: till, gravel, moss, dryas heath — no meadow green
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n1 = noise.fbm(x * 0.006, z * 0.006, 3);
      const n2 = noise.noise2(x * 0.07, z * 0.07);
      const dRiv = distToRiver(x, z);
      let r = 0.36 + n1 * 0.13;
      let g = 0.33 + n1 * 0.10 + n2 * 0.04;
      let b = 0.23 + n2 * 0.04;
      // moss carpets (green-dark) and dryas/rust heath patches
      if (n2 > 0.62) { r += 0.05; g -= 0.015; b -= 0.05; }       // rust heath
      else if (n2 < 0.32) { r -= 0.09; g -= 0.015; b -= 0.05; }  // dark moss
      const n3 = noise.noise2(x * 0.02 + 9, z * 0.02);
      if (n3 > 0.72) { r -= 0.05; g += 0.03; b -= 0.02; }        // sedge green flushes
      // gravel outwash near water
      if (dRiv < 26) {
        const t = smoothstep(26, 7, dRiv);
        r = lerp(r, 0.47, t); g = lerp(g, 0.43, t); b = lerp(b, 0.37, t);
      }
      // high till ridges paler
      const high = smoothstep(210, 250, y);
      r += high * 0.08; g += high * 0.07; b += high * 0.07;
      col.setXYZ(i, r, g, b);
    }
    col.needsUpdate = true;
    return;
  }

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n1 = noise.fbm(x * 0.008, z * 0.008, 3);
    const n2 = noise.noise2(x * 0.09, z * 0.09);
    const dRiv = distToRiver(x, z);

    // base meadow green, dryer on heights, lusher near water
    let r = 0.275 + n1 * 0.14 + smoothstep(200, 245, y) * 0.10;
    let g = 0.44 + n1 * 0.12 + smoothstep(60, 12, dRiv) * 0.05;
    let b = 0.155 + n2 * 0.05;

    // wildflower sparkle on open meadow (midsummer)
    if (n2 > 0.82 && dRiv < 120 && era < 3) { r += 0.16; g += 0.1; b += 0.12; }

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

    // roads & yard earth — the real network: asphalt on today's P30 and
    // V-roads, gravel elsewhere, bare dirt on the farm tracks
    if (era >= 2) {
      const ri = distToRoadEx(era, x, z);
      if (ri.d < 2.5) {
        const t = smoothstep(2.5, -1, ri.d);
        if (era === 5 && ri.c <= 1) {
          const lane = 0.30 + n2 * 0.03;
          r = lerp(r, lane, t); g = lerp(g, lane + 0.008, t); b = lerp(b, lane + 0.02, t);
        } else if (ri.c === 3) {
          r = lerp(r, 0.42, t); g = lerp(g, 0.35, t); b = lerp(b, 0.25, t);
        } else {
          r = lerp(r, 0.44, t); g = lerp(g, 0.36, t); b = lerp(b, 0.26, t);
        }
      }
    }
    for (const p of PADS) {
      if (era === 1 && p !== PADS[2]) continue;             // only the camp pad reads as trodden in AD 50
      if (era === 2 && Math.hypot(x - LOC.MANOR.x, z - LOC.MANOR.z) < 80) continue;
      if (era <= 2 && Math.hypot(x - LOC.KROGS.x, z - LOC.KROGS.z) < 40) continue;
      if (era <= 2 && Math.hypot(x - LOC.BREZGA.x, z - LOC.BREZGA.z) < 30) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r * 0.75) {
        const t = smoothstep(p.r * 0.75, p.r * 0.3, d) * 0.7;
        r = lerp(r, 0.42 + n2 * 0.06, t); g = lerp(g, 0.35, t); b = lerp(b, 0.24, t);
      }
    }

    // water margins, outside-in: moist grass -> sandy bank -> gravel -> mud
    if (dRiv < 30) {
      const moist = smoothstep(30, 15, dRiv);
      g += moist * 0.05; r -= moist * 0.03;                     // damp grass greens up
    }
    if (dRiv < 16 && dRiv > 5.5) {
      // the bank itself: bare sandy earth, distinct from the meadow
      const bank = smoothstep(16, 11, dRiv);
      r = lerp(r, 0.42 + n2 * 0.08, bank);
      g = lerp(g, 0.36 + n2 * 0.05, bank);
      b = lerp(b, 0.25, bank);
    }
    let wet = dRiv < 9 ? smoothstep(9, 3.5, dRiv) : 0;
    const dStr = distToStreams(x, z);
    if (dStr < 5) wet = Math.max(wet, smoothstep(5, 1.5, dStr));
    for (const lake of LAKES) {
      if (y < lake.level + 0.5 && Math.abs(x - lake.cx) < lake.hx && Math.abs(z - lake.cz) < lake.hz) {
        wet = Math.max(wet, smoothstep(lake.level + 0.5, lake.level - 0.6, y));
      }
    }
    if (wet > 0) {
      r = lerp(r, 0.25, wet); g = lerp(g, 0.22, wet); b = lerp(b, 0.14, wet);
      // sand & pebble bars right at the waterline (speckled by n2)
      const bar = dRiv < 6.5 ? smoothstep(6.5, 1.5, dRiv) : 0;
      if (bar > 0) {
        const gravel = 0.36 + n2 * 0.14;
        r = lerp(r, gravel + 0.05, bar); g = lerp(g, gravel, bar); b = lerp(b, gravel * 0.8, bar);
      }
    }

    col.setXYZ(i, c.set(r, g, b).r, c.g, c.b);
  }
  col.needsUpdate = true;
}
