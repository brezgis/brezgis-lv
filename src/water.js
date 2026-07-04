// Water bodies, all from real geometry: the Gauja ribbon (OSM course),
// Taurenes ezers (OSM outline), the Dzērbe and a nameless brook, and the
// mill pond that exists only while the manor's watermill does (eras 2-3).
import * as THREE from 'three';
import { RIVER_PTS, STREAMS, LAKES } from './geodata.js';
import { LOC } from './landuse.js';
import { sampleSpline, canvasTexture, makeNoise } from './util.js';

function waterNormalTex() {
  const n = makeNoise(777);
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = n.fbm((x / w) * 6, (y / h) * 6, 3) * 255;
      const i = (y * w + x) * 4;
      img.data[i] = 120 + (v - 128) * 0.3;
      img.data[i + 1] = 120 + (v - 128) * 0.3;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function makeWaterMaterial(color, opacity) {
  return new THREE.MeshPhongMaterial({
    color,
    shininess: 220,
    specular: 0xbbccdd,
    transparent: true,
    opacity,
    normalMap: waterNormalTex(),
    normalScale: new THREE.Vector2(0.35, 0.35),
    side: THREE.DoubleSide, // river ribbons follow flow direction; don't let winding cull them
  });
}

function ribbon(pts, widthFn, mat, uvScale = 60) {
  const SEG = Math.min(260, pts.length * 3);
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const [x, z, y] = sampleSpline(pts, t);
    const [x2, z2] = sampleSpline(pts, Math.min(1, t + 0.004));
    let dx = x2 - x, dz = z2 - z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const w = widthFn(t);
    positions.push(x - dz * w, y, z + dx * w, x + dz * w, y, z - dx * w);
    uvs.push(0, t * uvScale, 1, t * uvScale);
    if (i < SEG) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
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
  const lakeMat = makeWaterMaterial(0x2c4a52, 0.92);
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
  const riverMat = makeWaterMaterial(0x33525a, 0.9);
  mats.push(riverMat);
  const river = ribbon(RIVER_PTS, (t) => 10.5 * (0.75 + 0.3 * Math.sin(t * 23 + 1)), riverMat, 70);
  river.name = 'gauja';
  group.add(river);

  // --- streams
  const streamMat = makeWaterMaterial(0x3a5a60, 0.88);
  mats.push(streamMat);
  for (const s of STREAMS) {
    const st = ribbon(s.pts, () => 2.1, streamMat, 90);
    st.name = s.name || 'stream';
    group.add(st);
  }

  // --- mill pond on the Gauja bend (added/removed by era manager; eras 2-3)
  const pondMat = makeWaterMaterial(0x35555c, 0.92);
  mats.push(pondMat);
  const pondGeo = new THREE.CircleGeometry(1, 28);
  pondGeo.rotateX(-Math.PI / 2);
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.scale.set(52, 1, 34);
  const pondLevel = LOC.POND_LEVEL;
  pond.position.set(LOC.POND.x + 4, pondLevel, LOC.POND.z);
  pond.name = 'pond';

  function tick(t) {
    for (const m of mats) m.normalMap.offset.set(t * 0.008, t * 0.013);
  }
  return { group, pond, pondLevel, tick };
}
