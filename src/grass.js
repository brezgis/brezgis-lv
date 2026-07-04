// Near-field grass: tens of thousands of wind-swayed blades scattered around
// wherever the camera is looking, following each era's land use. The sward
// regenerates when the focus moves — a poor man's LAAS GroundRing.
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { forestDensity, distToRiver, distToRoad, fieldAt, riverLevelNear } from './landuse.js';
import { LAKES } from './geodata.js';
import { makeNoise, pointInPoly } from './util.js';
import { windify } from './vegetation.js';

const COUNT = 42000;
const RADIUS = 135;

function bladeGeometry() {
  // a single tapered blade, base dark, tip light (the tip also flexes most
  // because the wind shader keys on greenness x height²)
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -0.028, 0, 0, 0.028, 0, 0, -0.016, 0.55, 0,
    0.028, 0, 0, 0.016, 0.55, 0, -0.016, 0.55, 0,
    -0.016, 0.55, 0, 0.016, 0.55, 0, 0, 1.0, 0,
  ]);
  const colors = new Float32Array([
    0.20, 0.30, 0.12, 0.20, 0.30, 0.12, 0.33, 0.47, 0.18,
    0.20, 0.30, 0.12, 0.33, 0.47, 0.18, 0.33, 0.47, 0.18,
    0.33, 0.47, 0.18, 0.33, 0.47, 0.18, 0.48, 0.62, 0.24,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildGrass(scene) {
  const material = windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const mesh = new THREE.InstancedMesh(bladeGeometry(), material, COUNT);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const rng = makeNoise(7134).rng;
  let lastX = 1e9, lastZ = 1e9, lastEra = -1;

  function regenerate(cx, cz, era) {
    let i = 0;
    let attempts = 0;
    while (i < COUNT && attempts < COUNT * 2.2) {
      attempts++;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * RADIUS;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const y = heightAt(x, z);
      if (distToRiver(x, z) < 10 && y < riverLevelNear(x, z) + 0.5) continue;
      let inLake = false;
      for (const lake of LAKES) {
        if (y < lake.level + 0.5 && pointInPoly(x, z, lake.poly)) { inLake = true; break; }
      }
      if (inLake) continue;
      if (forestDensity(era, x, z, y) > 0.42) continue;
      if (era >= 2 && distToRoad(era, x, z) < 1.2) continue;
      const fa = era >= 2 ? fieldAt(era, x, z) : null;
      dummy.position.set(x, y - 0.02, z);
      dummy.rotation.y = rng() * Math.PI * 2;
      const tall = fa ? 1.15 : 0.55 + rng() * 0.6;
      dummy.scale.set(0.8 + rng() * 0.5, tall * (era === 0 ? 0.55 : 1), 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // era & land-use tinting via instanceColor (multiplies vertex colors)
      if (era === 0) col.setRGB(1.45, 1.2, 0.85);            // straw tundra sedge
      else if (fa) {
        const t = fa.field.type;
        if (t === 'rye' || t === 'barley') col.setRGB(1.5, 1.35, 0.8);
        else if (t === 'flax') col.setRGB(1.0, 1.15, 1.5);
        else col.setRGB(1.0, 1.05, 0.9);
      } else col.setRGB(0.9 + rng() * 0.35, 0.95 + rng() * 0.3, 0.85 + rng() * 0.25);
      mesh.setColorAt(i, col);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function update(focus, era) {
    const dx = focus.x - lastX, dz = focus.z - lastZ;
    if (era !== lastEra || dx * dx + dz * dz > 45 * 45) {
      lastX = focus.x; lastZ = focus.z; lastEra = era;
      regenerate(focus.x, focus.z, era);
    }
  }
  return { update, mesh };
}
