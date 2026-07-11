// Water bodies, all from real geometry: the Gauja ribbon (OSM course),
// Taurenes ezers (OSM outline), the Dzērbe and a nameless brook, and the
// mill pond that exists only while the manor's watermill does (eras 2-3).
import * as THREE from 'three';
import { STREAMS, LAKES } from './geodata.js';
import { RIVER, STREAM_CHANNELS, channelRows, bankCharAt, LAKE_SHORES, lakeAt, riverAt } from './riverzone.js';
import { LOC } from './landuse.js';
import { canvasTexture, makeNoise, chaikinPoly, lerp } from './util.js';
import { meshHeightAt } from './terrain.js';

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

const channelSeg = (chan) => Math.min(2600, chan.pts.length * 7);

// Water ribbon, LAAS-shore rules: high tessellation so bends are CURVES
// (the old 63m segments read as rectangles), and a FLAT surface — the
// shoreline comes from the carved bank rising through the plane.
function ribbon(rows, mat, uvScale = 60, edgeDrop = 0.85) {
  const SEG = rows.length - 1;
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
    const { x, z, y, dx, dz, hw } = rows[i];
    const w = hw + 1.6; // overshoot into the banks
    const wf = w - 0.5; // flat out to here
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

export function skirtRows(rows) {
  if (!rows.length) return [];
  const SEG = Math.max(1, rows.length - 1);
  const bankNoise = makeNoise(881);
  const out = [];
  let pdx = 0, pdz = 0;
  for (let i = 0; i < rows.length; i++) {
    const t = i / SEG;
    const row = rows[i];
    const ch = bankCharAt(row.x, row.z);
    const W_IN = row.hw + 1.6;
    // organic shoreline: the sand band waxes and wanes (~45m wavelength)
    let wOut = W_IN + (1.1 + bankNoise.fbm(t * 380, 3.7, 3) * 4.4)
      * (1 - 0.28 * ch.mud) * (1 + 0.35 * ch.bar);
    if (i > 0) {
      const dTheta = Math.acos(Math.min(1, Math.max(-1, row.dx * pdx + row.dz * pdz)));
      const radius = dTheta > 1e-4 ? (RIVER.length / SEG) / dTheta : 1e9;
      wOut = Math.min(wOut, Math.max(W_IN + 0.4, radius * 0.85));
    }
    pdx = row.dx; pdz = row.dz;
    out.push({ W_IN, wOut, ch });
  }
  // smooth the clamp: abrupt width changes twist the quads
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < out.length - 1; i++) {
      const avg = (out[i - 1].wOut + out[i].wOut + out[i + 1].wOut) / 3;
      out[i].wOut = Math.max(out[i].W_IN + 0.4, Math.min(out[i].wOut, avg));
    }
  }
  let lakeK = rows.map((row) => (row.lake ? 1 : 0));
  for (let pass = 0; pass < 2; pass++) {
    const next = new Array(lakeK.length);
    for (let i = 0; i < lakeK.length; i++) {
      let sum = 0, n = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(lakeK.length - 1, i + 2); j++) {
        sum += lakeK[j]; n++;
      }
      next[i] = sum / n;
    }
    lakeK = next;
  }
  for (let i = 0; i < out.length; i++) {
    if (rows[i].lake) out[i].wOut = out[i].W_IN;
    else out[i].wOut = out[i].W_IN + (out[i].wOut - out[i].W_IN) * (1 - lakeK[i]);
  }
  return out;
}

export function buildWater() {
  const group = new THREE.Group();
  group.name = 'water';
  const mats = [];
  let sandTex = null;                    // baked in the river-skirt block, reused by lake collars

  // --- lakes from OSM polygons
  const lakeMat = makeWaterMaterial(0x2f4c58, 0.90);
  mats.push(lakeMat);
  // OSM lake outlines are sparse polygons — Chaikin-smooth the shoreline
  // or the basins read as blocky cut gems
  const chaikin = (poly) => chaikinPoly(poly);
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
  const riverMat = makeWaterMaterial(0x2e4a55, 0.90);
  mats.push(riverMat);
  // rim 0.35: the 0.5m dark wall showed through the transparent surface
  // from the far bank as a black outline around every reach
  const riverRows = channelRows(RIVER, channelSeg(RIVER));
  const river = ribbon(riverRows, riverMat, 70, 0.35);
  river.renderOrder = 1;
  river.name = 'gauja';
  group.add(river);

  // BANK SKIRT: a sandy collar welded to the water's edge. Inner verts share
  // the ribbon edge exactly (no gap can exist); outer verts drape onto the
  // terrain when it rises above the water and hold a low berm (+0.3) where
  // the 17m-cell heightfield dips — the mesh solves what sculpting cannot.
  {
    const widths = skirtRows(riverRows);
    // resolve the two edge polylines first, then FORBID the outer edge from
    // reversing against the inner edge's direction of travel (tight apexes
    // otherwise fold the strip and its backfaces render black)
    const inner = [[], []], outer = [[], []];
    for (let i = 0; i < riverRows.length; i++) {
      const { x, z, y, dx, dz } = riverRows[i];
      const { W_IN, wOut } = widths[i];
      [-1, 1].forEach((side, si) => {
        const nx = -dz * side, nz = dx * side;
        inner[si].push([x + nx * W_IN, y, z + nz * W_IN]);
        outer[si].push([x + nx * wOut, y, z + nz * wOut]);
      });
    }
    for (let si = 0; si < 2; si++) {
      for (let i = 1; i < riverRows.length; i++) {
        if (widths[i].wOut === widths[i].W_IN || widths[i - 1].wOut === widths[i - 1].W_IN) continue;
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
    // bright enough to survive the sand-texture multiply — the old values
    // went near-black and every shore read as a dark outline around the water
    const bandC = [
      [0.62, 0.55, 0.42],   // wet sand at the waterline
      [0.78, 0.70, 0.53],   // dry sand
      [0.60, 0.65, 0.42],   // fringe blending to meadow
    ];
    const colorNoise = makeNoise(884);
    const mixC = (a, b, t) => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    for (let i = 0; i < riverRows.length; i++) {
      const t = i / Math.max(1, riverRows.length - 1);
      const ch = widths[i].ch;
      const jitter = (colorNoise.fbm(t * 590, 7, 2) / 0.75 - 0.5) * 0.08;
      const wetC = mixC(mixC(bandC[0], [0.30, 0.27, 0.19], ch.mud), [0.58, 0.55, 0.47], ch.bar * 0.7);
      const dryC = mixC(mixC(bandC[1], [0.62, 0.58, 0.50], ch.bar), [0.52, 0.46, 0.34], ch.mud * 0.6);
      const fringeC = mixC(bandC[2], [0.45, 0.52, 0.30], 0.45 + 0.3 * ch.mud);
      const rowC = [wetC, dryC, fringeC];
      const y = riverRows[i].y;
      const rimY = y - 0.35;
      const collapsed = widths[i].wOut === widths[i].W_IN;
      for (const si of [0, 1]) {
        const inn = inner[si][i], out = outer[si][i];
        const mx = inn[0] + (out[0] - inn[0]) * 0.3;
        const mz = inn[2] + (out[2] - inn[2]) * 0.3;
        // outer edge DRAPES onto the rendered terrain (clamped so it neither
        // dives into a carved dip nor flies up a bank) — a fixed +0.07 rim
        // floated a tan wall over the shore shelf and read as a dyke
        const gOut = collapsed ? rimY : Math.min(Math.max(meshHeightAt(out[0], out[2]) + 0.03, y - 0.33), y + 0.5);
        const gMid = collapsed ? rimY : Math.min(Math.max(meshHeightAt(mx, mz) + 0.03, y + 0.03), y + 0.3);
        positions.push(
          inn[0], rimY, inn[2],       // MUST equal the ribbon edgeDrop
          mx, gMid, mz,
          out[0], gOut, out[2]);
        for (let bI = 0; bI < 3; bI++) {
          colors.push(rowC[bI][0] + jitter, rowC[bI][1] + jitter, rowC[bI][2] + jitter);
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
    // FORCE every face to wind CCW-seen-from-above. With DoubleSide the
    // renderer flips the hand-written +y normals on back-facing triangles
    // (gl_FrontFacing), so downward-wound quads light from BELOW — the
    // entire apron rendered pitch black despite correct colours.
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const abx = positions[b] - positions[a], abz = positions[b + 2] - positions[a + 2];
      const acx = positions[c] - positions[a], acz = positions[c + 2] - positions[a + 2];
      if (abz * acx - abx * acz < 0) {
        const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t;
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
    // grainy wet-sand texture, world-space UVs (shared with the lake collars)
    sandTex = canvasTexture(128, 128, (ctx, w, h) => {
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
  for (let i = 0; i < STREAM_CHANNELS.length; i++) {
    const chan = STREAM_CHANNELS[i];
    const rows = channelRows(chan, channelSeg(chan));
    const st = ribbon(rows, streamMat, 90, 0.5);
    st.name = STREAMS[i].name || 'stream';
    group.add(st);
  }

  // --- LAKE BANK COLLARS: the wet-sand shore band the river always had.
  // One strip per lake along the Chaikin shoreline: inner rim tucked under
  // the water sheet, outer edge draped on the terrain with a noise- and
  // character-driven width (mud reaches narrow, gravel bars wide), fringe
  // colours pulled toward the meadow so the band DISSOLVES into grass.
  {
    const collarNoise = makeNoise(1213);
    const collarMat = new THREE.MeshLambertMaterial({
      map: sandTex, vertexColors: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    for (const lake of LAKE_SHORES) {
      const poly = lake.poly, N = poly.length;
      // outward = the side lakeAt says is dry (empirical beats winding math)
      let nxs = -(poly[1][1] - poly[N - 1][1]), nzs = poly[1][0] - poly[N - 1][0];
      const nl0 = Math.hypot(nxs, nzs) || 1;
      const outSign = lakeAt(poly[0][0] + (nxs / nl0) * 3, poly[0][1] + (nzs / nl0) * 3) ? -1 : 1;
      const positions = [], colors = [], uvsA = [], indices = [];
      let s = 0;
      for (let i = 0; i <= N; i++) {
        const i0 = i % N;
        const prev = poly[(i0 - 1 + N) % N], cur = poly[i0], next = poly[(i0 + 1) % N];
        let tx = next[0] - prev[0], tz = next[1] - prev[1];
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl; tz /= tl;
        const nx = -tz * outSign, nz = tx * outSign;
        s += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) * 0.5;
        const ch = bankCharAt(cur[0], cur[1]);
        let w = (2.1 + collarNoise.fbm(s * 0.045, lake.level * 0.13, 3) * 3.4)
          * (1 - 0.35 * ch.mud) * (1 + 0.45 * ch.bar);
        // a river mouth brings its own treatment — collapse the collar there
        const rv = riverAt(cur[0], cur[1]);
        if (rv && rv.d < rv.hw + 4) w = 0.02;
        const midX = cur[0] + nx * w * 0.35, midZ = cur[1] + nz * w * 0.35;
        const outX = cur[0] + nx * w, outZ = cur[1] + nz * w;
        const gMid = Math.min(Math.max(meshHeightAt(midX, midZ) + 0.03, lake.level + 0.02), lake.level + 0.35);
        const gOut = Math.min(Math.max(meshHeightAt(outX, outZ) + 0.03, lake.level - 0.25), lake.level + 0.7);
        positions.push(
          cur[0], lake.level - 0.3, cur[1],
          midX, gMid, midZ,
          outX, gOut, outZ);
        const wet = mix3(mix3([0.62, 0.55, 0.42], [0.30, 0.27, 0.19], ch.mud), [0.58, 0.55, 0.47], ch.bar * 0.7);
        const dry = mix3(mix3([0.78, 0.70, 0.53], [0.52, 0.46, 0.34], ch.mud * 0.6), [0.62, 0.58, 0.50], ch.bar);
        const fringe = mix3([0.60, 0.65, 0.42], [0.45, 0.52, 0.30], 0.55 + 0.3 * ch.mud);
        colors.push(...wet, ...dry, ...fringe);
        uvsA.push(cur[0] * 0.18, cur[1] * 0.18, midX * 0.18, midZ * 0.18, outX * 0.18, outZ * 0.18);
        if (i > 0) {
          const a2 = (i - 1) * 3;
          for (const [o0, o1] of [[0, 1], [1, 2]]) {
            indices.push(a2 + o0, a2 + o1, a2 + o1 + 3, a2 + o0, a2 + o1 + 3, a2 + o0 + 3);
          }
        }
      }
      // force CCW seen from above — the river skirt's hard-won rule: with
      // DoubleSide, downward-wound quads light from below and render black
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
        const abx = positions[b] - positions[a], abz = positions[b + 2] - positions[a + 2];
        const acx = positions[c] - positions[a], acz = positions[c + 2] - positions[a + 2];
        if (abz * acx - abx * acz < 0) {
          const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvsA, 2));
      geo.setIndex(indices);
      const nrm = new Float32Array(positions.length);
      for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1;   // ground lights as ground
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      const collar = new THREE.Mesh(geo, collarMat);
      collar.receiveShadow = true;
      collar.name = 'lakebank';
      group.add(collar);
    }
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
