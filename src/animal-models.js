// Real animal models in place of the procedural box-and-cylinder ones.
//
// The mammals are rigged low-poly models (Quaternius, CC0) that share one clip
// set: Idle, Eat, Walk, Run. The smaller animals are static models (mostly
// "Poly by Google", CC-BY 3.0) that the existing hop, swim and peck motion
// carries. Authors and licences: assets-src/animals/SOURCES.md.
//
// Every file is Y up, faces +Z, stands on y = 0 and is in metres, so a kind
// only needs a target height and, for the flat-coloured rigged models, a
// coat: material name -> colour.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ANIMAL_GLB } from './animal-assets.js';

// file, h = height in metres the model is scaled to (its bounding box top),
// coat = material colours, tint = multiply a textured model's colour
const KINDS = {
  // the wild ox: bulls near black with a pale eel stripe, cows red-brown
  aurochsBull: { file: 'cattle_bull', h: 2.0, coat: { Horns: 0xd8cfae } },
  aurochsCow: { file: 'cattle_cow', h: 1.72, coat: { Main: 0x5e3320, Main_Light: 0x7a5236, Horns: 0xd8cfae } },
  // small dark Iron Age cattle, barely over a metre at the shoulder
  cattleIron: { file: 'cattle_cow', h: 1.22, coat: { Main: 0x3f2c20, Main_Light: 0x5d4632 } },
  // Latvian Brown
  cattleFarm: { file: 'cattle_cow', h: 1.45, coat: { Main: 0x6f361d, Main_Light: 0x8a4e2c } },
  sheepDark: { file: 'sheep', h: 0.74, coat: { White: 0x3d322b, Black: 0x1c1714 } },
  sheepWhite: { file: 'sheep', h: 0.84, coat: { White: 0xcfc8b6 } },
  // forest pony, mouse-dun with a dark mane
  horseTarpan: { file: 'horse', h: 1.55, coat: { Main: 0x7f7667, Main_Light: 0x968c7a, Main_Dark: 0x4b443a, Hair: 0x241f1a } },
  horseKonik: { file: 'horse', h: 1.7, coat: { Main: 0x877d6c, Main_Light: 0x9c917e, Main_Dark: 0x4f473c, Hair: 0x211c18 } },
  horseBay: { file: 'horse', h: 1.85 },
  pig: { file: 'pig', h: 0.74, coat: { Main: 0x7c6258, Dark: 0x3a2b24 } },
  // elk (moose): no model exists, so a hind is scaled up and darkened
  elk: { file: 'deer_doe', h: 2.3, coat: { Main: 0x33261d, Main_Dark: 0x221912, Main_Light: 0x8a8072 }, stretch: [1.18, 1, 1.05] },
  reindeer: { file: 'deer_stag', h: 1.72, coat: { Main: 0x756b60, Main_Dark: 0x4a423a, Main_Light: 0xd6cfc0, Antlers_Hooves: 0x6b5b48 } },
  redDeer: { file: 'deer_stag', h: 2.1 },
  roeDeer: { file: 'deer_doe', h: 1.05, coat: { Main: 0x8f5a36, Main_Dark: 0x6a4027 } },
  roeBuck: { file: 'deer_doe', h: 1.1, coat: { Main: 0x8a5532, Main_Dark: 0x653d25 } },
  boar: { file: 'boar_rigged', h: 0.98 },
  fox: { file: 'fox', h: 0.46 },
  arcticFox: { file: 'fox', h: 0.4, coat: { Main: 0x6a5f54, Main_Light: 0xcfc6b6 } },
  wolf: { file: 'wolf', h: 0.92 },
  // ---- static models: the existing hop, swim and peck motion moves them ----
  // tilt = how far the whole bird tips when the behaviour lowers its head
  hare: { file: 'hare', h: 0.5 },
  // mountain hare in its grey-brown summer coat
  arcticHare: { file: 'hare', h: 0.54, tint: 0xb9ad9c },
  squirrel: { file: 'squirrel', h: 0.21, tint: 0xd08a5a },      // red squirrel, from a grey model
  beaver: { file: 'beaver', h: 0.34, sink: 0.12 },
  otter: { file: 'otter', h: 0.3, sink: 0.1, extra: { wiggle: true } },
  stork: { file: 'stork_white', h: 1.08, tilt: 0.3 },
  heron: { file: 'heron', h: 0.95, tilt: 0.3 },
  duckM: { file: 'duck_mallard', h: 0.34, sink: 0.07, tilt: 0.9 },
  duckF: { file: 'duck_mallard', h: 0.32, sink: 0.07, tilt: 0.9, tint: 0xa68b68 },
  goose: { file: 'goose', h: 0.72, tilt: 0.35 },
  chicken: { file: 'hen', h: 0.4, tilt: 0.4 },
  rooster: { file: 'rooster', h: 0.52, tilt: 0.35 },
  ptarmigan: { file: 'quail_ptarmigan', h: 0.3, tilt: 0.4 },
  blackGrouse: { file: 'rooster', h: 0.5, tilt: 0.35, tint: 0x3b3f4a },
  swanWhooper: { file: 'swan_standin', h: 1.0, sink: 0.2, tilt: 0.4 },
  swanMute: { file: 'swan_standin', h: 1.05, sink: 0.2, tilt: 0.4 },
  frog: { file: 'frog', h: 0.06 },
};

const loaded = new Map();     // file -> gltf
const coats = new Map();      // kind -> Map(material name -> material)
let ready = false;

function bytes(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// Parse every embedded model. Resolves when they can be instanced.
export async function loadAnimalModels() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(ANIMAL_GLB).map(async ([name, b64]) => {
    try {
      const gltf = await loader.parseAsync(bytes(b64), '');
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        // two of the source files carry a few NaN values; zero them
        for (const a of Object.values(o.geometry.attributes)) {
          if (!(a.array instanceof Float32Array)) continue;
          for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) a.array[i] = 0;
        }
        // the scene is lit with Lambert throughout; PBR here would read as plastic
        const src = Array.isArray(o.material) ? o.material : [o.material];
        const conv = src.map((m) => {
          const l = new THREE.MeshLambertMaterial({ color: m.color, map: m.map || null, flatShading: m.flatShading });
          l.name = m.name;
          return l;
        });
        o.material = Array.isArray(o.material) ? conv : conv[0];
      });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      gltf.userData.height = box.max.y - Math.min(0, box.min.y);
      loaded.set(name, gltf);
    } catch (e) {
      console.warn('animal model failed to load, keeping the procedural one:', name, e && e.message);
    }
  }));
  ready = true;
}

export function hasAnimalModel(kind) {
  return ready && KINDS[kind] !== undefined && loaded.has(KINDS[kind].file);
}

function coatFor(kind, material) {
  const K = KINDS[kind];
  if (K.tint !== undefined) {
    let m = coats.get(kind);
    if (!m) coats.set(kind, m = new Map());
    let c = m.get(material.uuid);
    if (!c) { c = material.clone(); c.name = material.name; c.color.multiply(new THREE.Color(K.tint)); m.set(material.uuid, c); }
    return c;
  }
  if (!K.coat || K.coat[material.name] === undefined) return material;
  let m = coats.get(kind);
  if (!m) coats.set(kind, m = new Map());
  let c = m.get(material.name);
  if (!c) { c = material.clone(); c.name = material.name; c.color.setHex(K.coat[material.name]); m.set(material.name, c); }
  return c;
}

// -> { group, legs: [], neck: null, shoulder, model: true, pose(state, speed01, fleeing, dt) }
export function makeAnimalModel(kind) {
  if (!hasAnimalModel(kind)) return null;
  const K = KINDS[kind], gltf = loaded.get(K.file);
  const inner = cloneSkinned(gltf.scene);
  inner.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => coatFor(kind, m)) : coatFor(kind, o.material);
  });
  const s = K.h / gltf.userData.height;
  const st = K.stretch || [1, 1, 1];
  inner.scale.multiply(new THREE.Vector3(s * st[0], s * st[1], s * st[2]));
  const group = new THREE.Group();
  group.add(inner);
  if (K.sink) inner.position.y -= K.sink;          // swimmers ride low in the water
  if (!gltf.animations.length) {
    // a static model: behaviour that lowers "the neck" tips the whole animal
    const k = K.tilt || 0;
    const neck = k ? { rotation: { get x() { return inner.rotation.x / k; }, set x(v) { inner.rotation.x = v * k; }, y: 0 } } : null;
    return { group, legs: [], neck, model: true, dispose() {}, pose() {}, ...(K.extra || {}) };
  }

  const mixer = new THREE.AnimationMixer(inner);
  const clip = (n) => gltf.animations.find((c) => c.name === n);
  const actions = {};
  for (const n of ['Idle', 'Eat', 'Walk', 'Run']) { const c = clip(n); if (c) actions[n] = mixer.clipAction(c); }
  let current = null;
  const play = (name) => {
    const next = actions[name] || actions.Idle || actions.Walk;
    if (!next || next === current) return next;
    next.reset().setEffectiveWeight(1).play();
    if (current) current.crossFadeTo(next, 0.35, false);
    current = next;
    return next;
  };
  play('Idle');
  mixer.update(Math.random() * 3);
  return {
    group, legs: [], neck: null, shoulder: K.h * 0.72, model: true, mixer,
    // each instance owns its skeleton (and the bone texture behind it)
    dispose() { inner.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.dispose(); }); mixer.stopAllAction(); mixer.uncacheRoot(inner); },
    // state: 'walk' | 'graze' | 'idle'
    pose(state, speed01, fleeing, dt) {
      let a;
      if (state === 'walk' && speed01 > 0.04) {
        a = play(fleeing && actions.Run ? 'Run' : 'Walk');
        if (a) a.timeScale = fleeing ? 1 : 0.55 + speed01 * 0.75;
      } else if (state === 'graze' && actions.Eat) {
        a = play('Eat'); if (a) a.timeScale = 1;
      } else {
        a = play('Idle'); if (a) a.timeScale = 1;
      }
      mixer.update(dt);
    },
  };
}

// One frozen pose as a plain vertex-coloured geometry (for instanced
// background herds and the cart horse).
export function bakeAnimalModel(kind, clipName = 'Eat', at = 0.4) {
  const a = makeAnimalModel(kind);
  if (!a) return null;
  const K = KINDS[kind], gltf = loaded.get(K.file);
  const c = gltf.animations.find((x) => x.name === clipName) || gltf.animations.find((x) => x.name === 'Idle');
  if (c) { const act = a.mixer.clipAction(c); a.mixer.stopAllAction(); act.play(); a.mixer.setTime(c.duration * at); }
  a.group.updateMatrixWorld(true);
  const pos = [], col = [];
  const v = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  a.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh) o.skeleton.update();
    const g = o.geometry, p = g.getAttribute('position'), idx = g.index;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : p.count, materialIndex: 0 }];
    const get = (i, out) => {
      if (o.isSkinnedMesh) o.getVertexPosition(i, out); else out.fromBufferAttribute(p, i);
      return out.applyMatrix4(o.matrixWorld);
    };
    for (const gr of groups) {
      const colr = mats[gr.materialIndex || 0].color;
      for (let k = gr.start; k < gr.start + gr.count; k += 3) {
        const i0 = idx ? idx.getX(k) : k, i1 = idx ? idx.getX(k + 1) : k + 1, i2 = idx ? idx.getX(k + 2) : k + 2;
        get(i0, v); get(i1, vb); get(i2, vc);
        pos.push(v.x, v.y, v.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z);
        for (let q = 0; q < 3; q++) col.push(colr.r, colr.g, colr.b);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
