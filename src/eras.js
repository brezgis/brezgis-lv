// The four moments in time, staged on the same ground:
//   0  ~AD 50   — wilderness: aurochs on the floodplain, a hunters' camp
//   1  ~AD 950  — a Latgalian farmstead (built on the Āraiši evidence)
//   2  1860     — the Brezgi viensēta under Nēķens (Nötkenshof) manor
//   3  1935     — Taurene, independent Latvia: the manor is a school
import * as THREE from 'three';
import {
  logCabin, postGranary, rija, wellSweep, rikuFence, wattleFence, manorHouse,
  manorOutbuilding, watermill, bridge, campfire, haystack, woodpile, choppingBlock,
  dugoutCanoe, rowboat, cart, beehiveLog, laundryLine, poemStone, storkNestPole,
  churchSilhouette, barrowStones, placeOnGround,
} from './buildings.js';
import { MAT } from './textures.js';
import { heightAt } from './terrain.js';
import { LOC, BUMPS, BRIDGE, BRIDGE2, riverXAt, riverLevelAt } from './landuse.js';

const S = LOC.STEAD, C = LOC.CAMP, Mn = LOC.MANOR, P = LOC.POND;

function leanTo() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 5), MAT.logOld);
    post.position.set(s * 1.6, 0.95, 0);
    g.add(post);
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 5), MAT.logOld);
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = 1.85;
  g.add(ridge);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 2.9), MAT.thatchOld);
  roof.position.set(0, 1.2, -1.15);
  roof.rotation.x = 1.0;
  g.add(roof);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function fishRack() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.7, 4), MAT.logOld);
    post.position.set(s * 1.1, 0.85, 0);
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), MAT.lightWood);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.55;
  g.add(bar);
  for (let i = 0; i < 4; i++) {
    const fish = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 4), new THREE.MeshLambertMaterial({ color: 0x9aa3a8 }));
    fish.position.set(-0.8 + i * 0.55, 1.28, 0);
    g.add(fish);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function offeringPile() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14 + (i % 3) * 0.05), MAT.stone);
    st.position.set(Math.cos(i * 2.2) * 0.4, 0.1 + (i > 3 ? 0.18 : 0), Math.sin(i * 2.2) * 0.4);
    g.add(st);
  }
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 5, 12), new THREE.MeshLambertMaterial({ color: 0x7a8a3a }));
  wreath.rotation.x = Math.PI / 2;
  wreath.position.y = 0.32;
  g.add(wreath);
  return g;
}

function telephonePoles(group) {
  const geo = new THREE.CylinderGeometry(0.07, 0.1, 6.4, 5);
  const mesh = new THREE.InstancedMesh(geo, MAT.logOld, 40);
  const arm = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 4);
  arm.rotateZ(Math.PI / 2);
  const arms = new THREE.InstancedMesh(arm, MAT.darkWood, 40);
  const dummy = new THREE.Object3D();
  let i = 0;
  // along the parish road north and south of the stead
  for (let zz = -700; zz <= 900; zz += 42) {
    if (i >= 40) break;
    const x = S.x + 46 + Math.sin(zz * 0.004) * 4;
    dummy.position.set(x, heightAt(x, zz) + 3.2, zz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 2.9;
    dummy.updateMatrix();
    arms.setMatrixAt(i, dummy.matrix);
    i++;
  }
  mesh.count = arms.count = i;
  mesh.castShadow = true;
  group.add(mesh, arms);
}

// ---------------------------------------------------------------------------
export function buildEra(era, ctx) {
  const g = new THREE.Group();
  g.name = `era${era}`;
  const ticks = [];
  const add = (obj, x, z, rot = 0, sink = 0.08) => {
    placeOnGround(obj, x, z, rot, sink);
    g.add(obj);
    if (obj.userData.tick) ticks.push(obj.userData.tick);
    return obj;
  };
  // for builders that already place their parts in world coordinates
  const addRaw = (obj) => {
    g.add(obj);
    if (obj.userData.tick) ticks.push(obj.userData.tick);
    return obj;
  };
  const smokes = [], fires = [];
  const spawns = [];

  if (era === 0) {
    // hunters' / herders' seasonal camp on the terrace
    add(leanTo(), C.x, C.z, -0.6);
    const cf = add(campfire(), C.x + 3.4, C.z + 2.2);
    fires.push([C.x + 3.4, heightAt(C.x + 3.4, C.z + 2.2) + 0.15, C.z + 2.2]);
    smokes.push([C.x + 3.4, heightAt(C.x + 3.4, C.z + 2.2) + 0.9, C.z + 2.2, { rate: 1.1, gray: 0.8 }]);
    add(fishRack(), C.x - 3, C.z + 3.5, 0.4);
    const canoe = add(dugoutCanoe(), riverXAt(C.z + 20) + 7, C.z + 20, 1.2);
    void canoe; void cf;
    addRaw(barrowStones(BUMPS.slice(0, 3)));
    // the aurochs — grazing the very terrace where Brezgi will one day stand
    const meadow = { x: S.x - 20, z: S.z + 30, r: 70 };
    spawns.push(['aurochsBull', 1, meadow]);
    spawns.push(['aurochsCow', 3, meadow]);
    spawns.push(['aurochsCalf', 1, meadow]);
    spawns.push(['elk', 2, { x: S.x + 250, z: S.z + 190, r: 50 }]);
  }

  if (era === 1) {
    // Latgalian farmstead — dimensions after the Āraiši dwellings
    const dw = add(logCabin({ w: 5, d: 6, wallH: 2.0, roofH: 2.6, roof: 'thatchGable', doorEnd: true }), S.x - 5, S.z - 9, 0.15);
    void dw;
    smokes.push([S.x - 5, heightAt(S.x - 5, S.z - 9) + 4.4, S.z - 6.6, { rate: 0.65, gray: 0.74 }]); // smoke seeps at the gable
    add(logCabin({ w: 4, d: 5, wallH: 1.8, roofH: 2.2, roof: 'thatchGableOld', old: true }), S.x + 10, S.z + 6, 1.62);
    add(postGranary(), S.x + 2, S.z + 13, -0.1);
    add(logCabin({ w: 4.5, d: 7, wallH: 1.6, roofH: 2.0, roof: 'thatchGableOld', old: true }), S.x - 14, S.z + 7, 1.55); // byre
    // outdoor cooking hearth
    add(campfire(), S.x + 1.5, S.z - 1);
    fires.push([S.x + 1.5, heightAt(S.x + 1.5, S.z - 1) + 0.15, S.z - 1]);
    smokes.push([S.x + 1.5, heightAt(S.x + 1.5, S.z - 1) + 0.9, S.z - 1, { rate: 1.0, gray: 0.8 }]);
    // wattle-fenced yard
    addRaw(wattleFence([
      [S.x - 20, S.z - 16], [S.x + 16, S.z - 16], [S.x + 18, S.z + 18], [S.x - 8, S.z + 20],
    ]));
    add(haystack(2.8), S.x - 24, S.z + 24);
    add(haystack(2.4), S.x - 30, S.z + 18);
    add(beehiveLog(), S.x + 26, S.z - 20, 0.3);
    add(beehiveLog(), S.x + 30, S.z - 15, -0.2);
    add(dugoutCanoe(), riverXAt(S.z + 60) + 6, S.z + 60, 1.45);
    const logBridge = add(bridge(true), BRIDGE.x, BRIDGE.z, 0);
    logBridge.position.y = riverLevelAt(BRIDGE.z) + 0.35;
    add(offeringPile(), LOC.OAK.x + 2.5, LOC.OAK.z + 1.5);
    addRaw(barrowStones(BUMPS));
    spawns.push(['cattleIron', 4, { x: S.x - 115, z: S.z + 35, r: 55 }]);
    spawns.push(['sheepDark', 5, { x: S.x - 60, z: S.z - 30, r: 35 }]);
    spawns.push(['horseTarpan', 2, { x: S.x - 115, z: S.z + 90, r: 45 }]);
    spawns.push(['pig', 2, { x: S.x + 40, z: S.z + 40, r: 25 }]);
    spawns.push(['chicken', 3, { x: S.x, z: S.z + 3, r: 10 }]);
    spawns.push(['rooster', 1, { x: S.x, z: S.z + 3, r: 10 }]);
  }

  if (era >= 2) {
    // ----- the Brezgi viensēta -----
    const modern = era === 3;
    add(logCabin({
      w: 6.5, d: 12, wallH: 2.5, roofH: 2.9,
      roof: modern ? 'shingleGable' : 'thatchGable',
      hasChimney: true, windows: modern ? 3 : 2,
      windowStyle: modern ? 'framed' : 'dark', porch: modern,
    }), S.x, S.z - 15, Math.PI / 2);
    smokes.push([S.x, heightAt(S.x, S.z - 15) + 6.6, S.z - 13.5, { rate: 0.55, gray: 0.86 }]);
    add(logCabin({ w: 5, d: 8, wallH: 2.2, roofH: 2.3, roof: 'shingleGable', doorEnd: true, porch: false }), S.x + 21, S.z + 2, -Math.PI / 2); // klēts
    add(logCabin({ w: 5.5, d: 13, wallH: 1.9, roofH: 2.4, roof: 'thatchGableOld', old: true }), S.x - 21, S.z + 5, 0.03); // kūts
    add(rija(), S.x + 17, S.z + 36, 0.5);
    // pirts by the river
    const px = riverXAt(S.z + 85) + 16, pz = S.z + 85;
    add(logCabin({ w: 3.4, d: 4.2, wallH: 1.7, roofH: 1.9, roof: 'thatchGableOld', old: true, doorEnd: true }), px, pz, -0.4);
    smokes.push([px, heightAt(px, pz) + 3.6, pz, { rate: 1.25, gray: 0.66 }]); // sauna heating
    const ws = add(wellSweep(), S.x + 7, S.z - 7, 0.7);
    void ws;
    addRaw(rikuFence([
      [S.x - 27, S.z - 22], [S.x + 27, S.z - 22], [S.x + 28, S.z + 24], [S.x - 27, S.z + 26], [S.x - 27, S.z - 22],
    ]));
    addRaw(rikuFence([[S.x - 27, S.z + 40], [S.x + 5, S.z + 44]]));
    add(laundryLine(), S.x - 8, S.z - 20.5, 0.1);
    add(woodpile(), S.x - 4, S.z - 10, 0.4);
    add(choppingBlock(), S.x - 2.5, S.z - 8);
    add(cart(), S.x + 14, S.z + 9, -0.5);
    add(haystack(3.4), S.x - 36, S.z + 42);
    add(haystack(3), S.x - 44, S.z + 34);
    for (let i = 0; i < 3; i++) add(beehiveLog(), S.x - 20 + i * 4, S.z - 36, i);
    add(rowboat(), riverXAt(S.z + 62) + 6.5, S.z + 62, 1.5);
    const wb = add(bridge(false), BRIDGE.x, BRIDGE.z, 0);
    wb.position.y = riverLevelAt(BRIDGE.z) + 0.2;
    const nb = add(bridge(false), BRIDGE2.x, BRIDGE2.z, Math.PI / 2); // parish-road bridge over the east run
    nb.position.y = BRIDGE2.level + 0.2;
    add(storkNestPole(), S.x + 30, S.z + 22);

    // ----- the manor / the school -----
    const mh = add(manorHouse({ flag: modern }), Mn.x, Mn.z, 0.35);
    if (mh.userData.tick) ticks.push(mh.userData.tick);
    add(manorOutbuilding(22), Mn.x - 46, Mn.z - 26, 0.35 + Math.PI / 2);
    add(manorOutbuilding(16), Mn.x + 44, Mn.z - 22, 0.2);
    smokes.push([Mn.x - 8, heightAt(Mn.x, Mn.z) + 9.6, Mn.z, { rate: 0.4, gray: 0.88 }]);
    // watermill + pond dam (the pond floods the Gauja bend below the manor)
    const mill = add(watermill(ctx.water.pondLevel), P.x + 30, P.z + 16, Math.PI * 0.75);
    if (mill.userData.tick) ticks.push(mill.userData.tick);
    const dam = new THREE.Mesh(new THREE.BoxGeometry(30, 2.4, 1.8), MAT.plank);
    dam.position.set(P.x + 26, ctx.water.pondLevel - 0.9, P.z + 2);
    dam.rotation.y = -0.75;
    dam.castShadow = true;
    g.add(dam);
    // distant church silhouette
    add(churchSilhouette(), LOC.CHURCH.x, LOC.CHURCH.z, 0.8);

    if (modern) {
      add(poemStone(), LOC.STONE.x, LOC.STONE.z, -0.5);
      telephonePoles(g);
    }

    spawns.push(['cattleFarm', modern ? 6 : 5, { x: S.x - 115, z: S.z + 35, r: 60 }]);
    spawns.push(['sheepWhite', modern ? 4 : 6, { x: S.x - 55, z: S.z - 35, r: 35 }]);
    spawns.push(['horseBay', 2, { x: S.x - 110, z: S.z + 95, r: 45 }]);
    spawns.push(['chicken', modern ? 4 : 5, { x: S.x + 2, z: S.z + 2, r: 12 }]);
    spawns.push(['rooster', 1, { x: S.x + 2, z: S.z + 2, r: 12 }]);
    spawns.push(['goose', modern ? 3 : 4, { x: S.x - 10, z: S.z + 14, r: 14 }]);
    spawns.push(['storkNest', 1, { x: S.x + 30, z: S.z + 22, r: 0 }]);
    spawns.push(['stork', 1, { x: S.x - 90, z: S.z + 50, r: 40 }]);
  }

  g.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
  return { group: g, ticks, smokes, fires, spawns };
}

// spawn helper used by main (handles the two special cases)
export function applySpawns(mgr, spawns) {
  for (const [kind, count, home] of spawns) {
    for (let i = 0; i < count; i++) {
      if (kind === 'aurochsCalf') {
        const rec = mgr.spawn('aurochsCow', home);
        rec.group.scale.setScalar(0.58);
      } else if (kind === 'storkNest') {
        const rec = mgr.spawn('stork', { ...home, r: 0.1 }, { static: true });
        rec.group.position.y = heightAt(home.x, home.z) + 5.75;
      } else {
        mgr.spawn(kind, home);
      }
    }
  }
}
