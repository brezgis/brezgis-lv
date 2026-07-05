// Water bodies, all from real geometry: the Gauja ribbon (OSM course),
// Taurenes ezers (OSM outline), the Dzērbe and a nameless brook, and the
// mill pond that exists only while the manor's watermill does (eras 2-3).
import * as THREE from 'three';
import { RIVER_PTS, STREAMS, LAKES } from './geodata.js';
import { LOC } from './landuse.js';
import { sampleSpline, canvasTexture, makeNoise } from './util.js';

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
// (the old 63m segments read as rectangles), and a shallow-V cross-section —
// the edge verts sit ~0.7m below the centreline so the surface always tucks
// UNDER the rising bank instead of floating over hollows in the 30m DEM.
function ribbon(pts, widthFn, mat, uvScale = 60, edgeDrop = 2.0) {
  const SEG = Math.min(1400, pts.length * 4);
  // edge verts must sink BELOW the carved bed (1.7m) or the surface still
  // hovers over hollows near steep banks
  const EDGE_DROP = edgeDrop;
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const [x, z, y] = sampleSpline(pts, t);
    const [x2, z2] = sampleSpline(pts, Math.min(1, t + 0.002));
    let dx = x2 - x, dz = z2 - z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const w = widthFn(t) + 1.6; // overshoot into the banks
    positions.push(
      x - dz * w, y - EDGE_DROP, z + dx * w,
      x, y, z,
      x + dz * w, y - EDGE_DROP, z - dx * w);
    uvs.push(0, t * uvScale, 0.5, t * uvScale, 1, t * uvScale);
    if (i < SEG) {
      const a = i * 3;
      indices.push(a, a + 1, a + 4, a, a + 4, a + 3);
      indices.push(a + 1, a + 2, a + 5, a + 1, a + 5, a + 4);
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
  for (const lake of LAKES) {
    // store as (x, -z) so that rotateX(-PI/2) lands on (x, z) with the normal up
    const shape = new THREE.Shape(lake.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
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
  const river = ribbon(RIVER_PTS, (t) => 10.5 * (0.75 + 0.3 * Math.sin(t * 23 + 1)), riverMat, 70);
  river.name = 'gauja';
  group.add(river);

  // --- streams
  const streamMat = makeWaterMaterial(0x314f58, 0.92);
  mats.push(streamMat);
  for (const s of STREAMS) {
    const st = ribbon(s.pts, () => 2.1, streamMat, 90, 1.2);
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
