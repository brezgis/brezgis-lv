// Water bodies, all from real geometry: the Gauja ribbon (OSM course),
// Taurenes ezers (OSM outline), the Dzērbe and a nameless brook, and the
// mill pond that exists only while the manor's watermill does (eras 2-3).
import * as THREE from 'three';
import { RIVER_PTS, STREAMS, LAKES } from './geodata.js';
import { LOC } from './landuse.js';
import { sampleSpline, canvasTexture, makeNoise } from './util.js';
import { heightAt, meshHeightAt } from './terrain.js';

function waterNormalTex() {
  const n = makeNoise(777);
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    // proper tangent-space normals derived from a ripple height field
    const hgt = (x, y) =>
      n.fbm((x / w) * 6, (y / h) * 6, 4) * 0.75 + n.noise2((x / w) * 22, (y / h) * 22) * 0.25;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 3.2;
      const dy = (hgt(x, y + 1) - hgt(x, y - 1)) * 3.2;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function makeWaterMaterial(color, opacity) {
  const m = new THREE.MeshPhongMaterial({
    color,
    shininess: 190,
    specular: 0xb9c6d0,
    transparent: true,
    opacity,
    normalMap: waterNormalTex(),
    normalScale: new THREE.Vector2(0.26, 0.26),
    side: THREE.DoubleSide, // river ribbons follow flow direction; don't let winding cull them
  });
  // second ripple octave scrolling against the first — interference, not slide
  m.userData.off2 = new THREE.Vector2();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOff2 = { value: m.userData.off2 };
    sh.fragmentShader = 'uniform vec2 uOff2;\n' + sh.fragmentShader.replace(
      'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
      `vec3 mapN1 = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
       vec3 mapN2 = texture2D( normalMap, vNormalMapUv * 3.7 + uOff2 ).xyz * 2.0 - 1.0;
       vec3 mapN = normalize(vec3(mapN1.xy + mapN2.xy * 0.45, mapN1.z));`
    );
  };
  return m;
}

// Water ribbon, LAAS-shore rules: high tessellation so bends are CURVES
// (the old 63m segments read as rectangles), and a FLAT surface — the
// shoreline comes from the carved bank rising through the plane.
function ribbon(pts, widthFn, mat, uvScale = 60, edgeDrop = 0.85) {
  // SEG and the tangent window MUST match the bank skirt exactly — the
  // skirt's inner verts are meant to be vertex-for-vertex identical with
  // these edges; any tessellation drift opens black slivers into the trench
  const SEG = Math.min(2000, pts.length * 6);
  // LAAS shore rule: the water surface is FLAT (a sloped surface reads as a
  // convex hump from the bank) — only a slight edge tuck hides the seam.
  // The shoreline itself comes from the bank rising THROUGH the plane, so
  // the spline-following channel carve must clear the full ribbon width.
  const EDGE_DROP = edgeDrop;
  // 5 verts per row: the surface stays DEAD FLAT out to ~96% width, then a
  // short near-vertical rim drops under the bank collar. A gradual slope
  // read as a dark tilted band along every shore at grazing angles.
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const [x, z, y] = sampleSpline(pts, t);
    const [xa, za] = sampleSpline(pts, Math.max(0, t - 0.004));
    const [x2, z2] = sampleSpline(pts, Math.min(1, t + 0.004));
    let dx = x2 - xa, dz = z2 - za;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const w = widthFn(t) + 1.6; // overshoot into the banks
    const wf = w - 0.5;         // flat out to here
    positions.push(
      x - dz * w, y - EDGE_DROP, z + dx * w,
      x - dz * wf, y, z + dx * wf,
      x, y, z,
      x + dz * wf, y, z - dx * wf,
      x + dz * w, y - EDGE_DROP, z - dx * w);
    uvs.push(0, t * uvScale, 0.04, t * uvScale, 0.5, t * uvScale, 0.96, t * uvScale, 1, t * uvScale);
    if (i < SEG) {
      const a = i * 5;
      for (let k = 0; k < 4; k++) {
        indices.push(a + k, a + k + 1, a + k + 6, a + k, a + k + 6, a + k + 5);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

export function buildWater() {
  const group = new THREE.Group();
  group.name = 'water';
  const mats = [];

  // --- lakes from OSM polygons
  const lakeMat = makeWaterMaterial(0x2f4c58, 0.94);
  mats.push(lakeMat);
  // OSM lake outlines are sparse polygons — Chaikin-smooth the shoreline
  // or the basins read as blocky cut gems
  const chaikin = (poly, iters = 2) => {
    let pp = poly;
    for (let it = 0; it < iters; it++) {
      const q = [];
      for (let i = 0; i < pp.length; i++) {
        const a2 = pp[i], b2 = pp[(i + 1) % pp.length];
        q.push([a2[0] * 0.75 + b2[0] * 0.25, a2[1] * 0.75 + b2[1] * 0.25]);
        q.push([a2[0] * 0.25 + b2[0] * 0.75, a2[1] * 0.25 + b2[1] * 0.75]);
      }
      pp = q;
    }
    return pp;
  };
  for (const lake of LAKES) {
    // store as (x, -z) so that rotateX(-PI/2) lands on (x, z) with the normal up
    const shape = new THREE.Shape(chaikin(lake.poly).map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ShapeGeometry(shape, 4);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, lakeMat);
    mesh.position.y = lake.level;
    mesh.name = lake.name || 'lake';
    // uv for shimmer
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 260, uv.getY(i) / 260);
    group.add(mesh);
  }

  // --- the Gauja
  const riverMat = makeWaterMaterial(0x2c4852, 0.93);
  mats.push(riverMat);
  // constant width: the old sinusoidal wobble made the shore seams
  // unpredictable — every downstream fix has to know where the edge is
  const river = ribbon(RIVER_PTS, () => 10.2, riverMat, 70, 0.5);
  river.renderOrder = 1;
  river.name = 'gauja';
  group.add(river);

  // BANK SKIRT: a sandy collar welded to the water's edge. Inner verts share
  // the ribbon edge exactly (no gap can exist); outer verts drape onto the
  // terrain when it rises above the water and hold a low berm (+0.3) where
  // the 17m-cell heightfield dips — the mesh solves what sculpting cannot.
  {
    const SEG = Math.min(2000, RIVER_PTS.length * 6);
    const W_IN = 10.2 + 1.6, W_OUT = 14.5;
    const bankNoise = makeNoise(881);
    // pass 1: rows with curvature-clamped collar width (a bend tighter than
    // the offset would fold the outer edge back over itself)
    const rows = [];
    let pdx = 0, pdz = 0;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const [x, z, y] = sampleSpline(RIVER_PTS, t);
      const [xa, za] = sampleSpline(RIVER_PTS, Math.max(0, t - 0.004));
      const [x2, z2] = sampleSpline(RIVER_PTS, Math.min(1, t + 0.004));
      let dx = x2 - xa, dz = z2 - za;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      // organic shoreline: the sand band waxes and wanes (~45m wavelength)
      let wOut = W_OUT - 1.6 + bankNoise.fbm(t * 380, 3.7, 3) * 4.4;
      if (i > 0) {
        const dTheta = Math.acos(Math.min(1, Math.max(-1, dx * pdx + dz * pdz)));
        const radius = dTheta > 1e-4 ? (16581 / SEG) / dTheta : 1e9;
        wOut = Math.min(wOut, Math.max(W_IN + 0.4, radius * 0.85));
      }
      pdx = dx; pdz = dz;
      rows.push([x, z, y, dx, dz, wOut]);
    }
    // smooth the clamp: abrupt width changes twist the quads
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < rows.length - 1; i++) {
        rows[i][5] = Math.min(rows[i][5], (rows[i - 1][5] + rows[i][5] + rows[i + 1][5]) / 3);
      }
    }
    // resolve the two edge polylines first, then FORBID the outer edge from
    // reversing against the inner edge's direction of travel (tight apexes
    // otherwise fold the strip and its backfaces render black)
    const inner = [[], []], outer = [[], []];
    for (let i = 0; i < rows.length; i++) {
      const [x, z, y, dx, dz, wOut] = rows[i];
      [-1, 1].forEach((side, si) => {
        const nx = -dz * side, nz = dx * side;
        inner[si].push([x + nx * W_IN, y, z + nz * W_IN]);
        outer[si].push([x + nx * wOut, y, z + nz * wOut]);
      });
    }
    for (let si = 0; si < 2; si++) {
      for (let i = 1; i < rows.length; i++) {
        const idx2 = (inner[si][i][0] - inner[si][i - 1][0]);
        const idz2 = (inner[si][i][2] - inner[si][i - 1][2]);
        const odx = (outer[si][i][0] - outer[si][i - 1][0]);
        const odz = (outer[si][i][2] - outer[si][i - 1][2]);
        if (odx * idx2 + odz * idz2 < 0.02) {
          outer[si][i][0] = outer[si][i - 1][0] + idx2;
          outer[si][i][2] = outer[si][i - 1][2] + idz2;
        }
      }
    }
    // SANDY SHORE: three bands per side — wet sand at the rim, dry sand,
    // then a grass-toned fringe — with vertex-colour gradients and a wavy
    // outer edge, so the collar reads as beach, not as tan polygons
    const positions = [], indices = [], colors = [], uvsA = [];
    const bandC = [
      [0.36, 0.31, 0.23],   // wet sand at the waterline
      [0.55, 0.48, 0.35],   // dry sand
      [0.44, 0.5, 0.29],    // fringe blending to meadow
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = rows[i][2];
      for (const si of [0, 1]) {
        const inn = inner[si][i], out = outer[si][i];
        const mx = inn[0] + (out[0] - inn[0]) * 0.45;
        const mz = inn[2] + (out[2] - inn[2]) * 0.45;
        // outer edge DRAPES onto the rendered terrain (clamped so it neither
        // dives into a carved dip nor flies up a bank) — a fixed +0.07 rim
        // floated a tan wall over the shore shelf and read as a dyke
        const gOut = Math.min(Math.max(meshHeightAt(out[0], out[2]) + 0.03, y - 0.48), y + 0.5);
        const gMid = Math.min(Math.max(meshHeightAt(mx, mz) + 0.03, y + 0.03), y + 0.3);
        positions.push(
          inn[0], y - 0.5, inn[2],
          mx, gMid, mz,
          out[0], gOut, out[2]);
        for (let bI = 0; bI < 3; bI++) {
          colors.push(bandC[bI][0], bandC[bI][1], bandC[bI][2]);
        }
        uvsA.push(inn[0] * 0.18, inn[2] * 0.18, mx * 0.18, mz * 0.18, out[0] * 0.18, out[2] * 0.18);
      }
      if (i > 0) {
        const a2 = (i - 1) * 6;
        for (const [o0, o1] of [[0, 1], [1, 2]]) {         // left: rim->wet, wet->dry
          indices.push(a2 + o0, a2 + o1, a2 + o1 + 6, a2 + o0, a2 + o1 + 6, a2 + o0 + 6);
        }
        for (const [o0, o1] of [[4, 3], [5, 4]]) {         // right strips
          indices.push(a2 + o0, a2 + o1, a2 + o1 + 6, a2 + o0, a2 + o1 + 6, a2 + o0 + 6);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvsA, 2));
    geo.setIndex(indices);
    // the collar is ground: light it as ground. Computed normals flip on
    // twisted quads and read as a black-and-tan checker.
    const nrm = new Float32Array(positions.length);
    for (let i = 0; i < nrm.length; i += 3) { nrm[i + 1] = 1; }
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    // grainy wet-sand texture, world-space UVs
    const sandTex = canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#a4977c';
      ctx.fillRect(0, 0, w, h);
      const sr = makeNoise(883).rng;
      for (let i = 0; i < 2600; i++) {
        const g = 120 + sr() * 100;
        ctx.fillStyle = `rgba(${g},${(g * 0.92) | 0},${(g * 0.74) | 0},0.5)`;
        ctx.fillRect(sr() * w, sr() * h, 1 + sr(), 1 + sr());
      }
      for (let i = 0; i < 60; i++) {                        // scattered grit
        const g = 90 + sr() * 90;
        ctx.fillStyle = `rgb(${g},${g},${(g * 0.9) | 0})`;
        ctx.beginPath();
        ctx.arc(sr() * w, sr() * h, 0.8 + sr() * 1.6, 0, 7);
        ctx.fill();
      }
    });
    const skirt = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      // FrontSide: any residual fold on a hairpin culls away instead of
      // flashing its black backface
      // DoubleSide: half the strip quads wind downward (side-dependent index
      // order) and FrontSide culled the whole left-bank apron from above.
      // Normals are hand-written +y, so lighting is correct either way.
      map: sandTex, vertexColors: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    skirt.receiveShadow = true;
    skirt.name = 'bankskirt';
    group.add(skirt);
  }

  // --- streams
  const streamMat = makeWaterMaterial(0x314f58, 0.92);
  mats.push(streamMat);
  for (const s of STREAMS) {
    const st = ribbon(s.pts, () => 2.1, streamMat, 90, 0.5);
    st.name = s.name || 'stream';
    group.add(st);
  }

  // --- mill pond on the Gauja bend (added/removed by era manager; eras 2-3)
  const pondMat = makeWaterMaterial(0x2f4e57, 0.94);
  mats.push(pondMat);
  const pondGeo = new THREE.CircleGeometry(1, 28);
  pondGeo.rotateX(-Math.PI / 2);
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.scale.set(52, 1, 34);
  const pondLevel = LOC.POND_LEVEL;
  pond.position.set(LOC.POND.x + 4, pondLevel, LOC.POND.z);
  pond.name = 'pond';

  function tick(t) {
    for (const m of mats) {
      m.normalMap.offset.set(t * 0.008, t * 0.013);
      m.userData.off2.set(-t * 0.019, t * 0.011);
    }
  }
  // glacial-era meltwater is milky with rock flour
  const original = mats.map((m) => m.color.clone());
  function setEra(era) {
    mats.forEach((m, i) => {
      if (era === 0) m.color.set(0x8fb6ba);
      else m.color.copy(original[i]);
    });
  }
  // sky reflections from an occasionally-refreshed cubemap
  function applyEnvMap(tex) {
    for (const m of mats) {
      m.envMap = tex;
      m.combine = THREE.MixOperation;
      m.reflectivity = 0.33; // grazing-bright water vs Lambert land read as glare
      m.needsUpdate = true;
    }
  }
  return { group, pond, pondLevel, tick, setEra, applyEnvMap };
}
