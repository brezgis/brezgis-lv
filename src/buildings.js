// Parametric vernacular architecture of the Vidzeme countryside:
// corner-notched log buildings, thatch/shingle/tile roofs, the klēts on
// posts, the well-sweep (vinda), riķu fences, the manor, the watermill.
import * as THREE from 'three';
import { MAT } from './textures.js';
import { meshHeightAt } from './terrain.js';
import { makeNoise } from './util.js';

const rng = makeNoise(606).rng;

function shadowize(g) {
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
export function placeOnGround(g, x, z, rotY = 0, sink = 0.08) {
  // Props must sit on the triangles the player sees, not the smoother source
  // height field. Between the 17 m terrain vertices those surfaces can differ
  // enough to leave a visible gap under a wall or bury a doorstep.
  g.position.set(x, meshHeightAt(x, z) - sink, z);
  g.rotation.y = rotY;
  return g;
}

// --- roof primitives --------------------------------------------------------
// One closed roof solid: eaves rectangle + ridge segment. ridgeHalf = D gives
// a gable (vertical closed ends); ridgeHalf < D gives a hip.
function roofSolid(w, d, h, mat, over, ridgeHalf) {
  const W = w / 2 + over, D = d / 2 + over;
  const R = Math.min(ridgeHalf, D);
  // slight eave drop so the overhang slopes with the roof plane
  const drop = (over / (w / 2)) * h * 0.8;
  const pos = [
    -W, -drop, -D, W, -drop, -D, W, -drop, D, -W, -drop, D,   // eaves corners
    0, h, -R, 0, h, R,                                        // ridge ends
  ];
  // faces: two slopes (quads) + two ends (triangles) — non-indexed for crisp edges
  const quads = [
    [0, 4, 5, 3],   // west slope (x<0)
    [1, 2, 5, 4],   // east slope (x>0)
  ];
  const tris = [
    [0, 1, 4],      // north end
    [2, 3, 5],      // south end
  ];
  const verts = [], uvs = [];
  const slopeLength = Math.hypot(W, h + drop);
  const push = (i, end = false) => {
    verts.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    // Courses run along the ridge; straw and shingle grain run downhill.
    // The old x+y projection collapsed steep roofs to stretched stripes.
    if (end) uvs.push((pos[i * 3] + W) / 3.2, (pos[i * 3 + 1] + drop) / 3.2);
    else uvs.push((pos[i * 3 + 2] + D) / 3.2, (h - pos[i * 3 + 1]) / (h + drop) * slopeLength / 3.2);
  };
  for (const [a, b, c, dd] of quads) { push(a); push(c); push(b); push(a); push(dd); push(c); }
  for (const [a, b, c] of tris) { push(a, true); push(c, true); push(b, true); }
  // Close the underside so the eaves remain solid from walking height.
  for (const i of [0, 1, 2, 0, 2, 3]) push(i, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const isGable = Math.abs(R - D) < 1e-6;
  geo.addGroup(0, 12, 0);
  geo.addGroup(12, 6, isGable ? 1 : 0);
  geo.addGroup(18, 6, 1);
  const mesh = new THREE.Mesh(geo, [mat, MAT.logOld]);
  mesh.name = 'roof';
  return mesh;
}
function gableRoof(w, d, h, mat, over = 0.45) {
  return roofSolid(w, d, h, mat, over, d / 2 + over);
}
function hipRoof(w, d, h, mat, over = 0.5) {
  return roofSolid(w, d, h, mat, over, Math.max(0.1, (d - w) / 2));
}
function chimney(h = 1.6) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.7), MAT.plaster);
  c.position.y = h / 2;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.9), MAT.stone);
  cap.position.y = h + 0.08;
  g.add(c, cap);
  return g;
}
function cornerLogs(w, d, wallH) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.09, 0.09, 0.55, 6);
  geo.rotateZ(Math.PI / 2);
  const rows = Math.floor(wallH / 0.24);
  const mesh = new THREE.InstancedMesh(geo, MAT.logOld, rows * 8);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const y = 0.12 + r * 0.24;
    const along = r % 2 === 0;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      dummy.position.set(sx * w / 2 + (along ? 0 : sx * 0.09), y, sz * d / 2 + (along ? sz * 0.09 : 0));
      dummy.rotation.set(0, along ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
  }
  mesh.count = i;
  g.add(mesh);
  return g;
}

function wallBox(axis, w, h, depth, along, y, normal, mat) {
  const geo = axis === 'z'
    ? new THREE.BoxGeometry(w, h, depth)
    : new THREE.BoxGeometry(depth, h, w);
  const m = new THREE.Mesh(geo, mat);
  if (axis === 'z') m.position.set(along, y, normal);
  else m.position.set(normal, y, along);
  return m;
}

// Openings are laid out by hand in every builder, in numbers, and a facade
// is easy to get subtly wrong — a door leaf through a window sash, a sash
// buried inside a projecting bay. Register each one on its own wall and
// complain about collisions at build time; `data/openingcheck.mjs` boots the
// sim and fails on the complaint, so a bad facade cannot ship silently.
function registerOpening(g, kind, axis, face, along, w, y0, y1) {
  const reg = g.userData.__openings || (g.userData.__openings = []);
  const a0 = along - w / 2 - 0.1, a1 = along + w / 2 + 0.1;
  for (const o of reg) {
    if (o.axis !== axis || Math.abs(o.face - face) > 0.01) continue;
    if (a1 <= o.a0 || a0 >= o.a1 || y1 <= o.y0 || y0 >= o.y1) continue;
    console.error(`[openings] ${kind} at ${axis}=${along.toFixed(2)} overlaps ${o.kind} `
      + `at ${o.along.toFixed(2)} on the ${axis}/${face} wall`);
  }
  reg.push({ kind, axis, face, along, a0, a1, y0, y1 });
}

function addDoor(g, { axis = 'z', face, along = 0, w = 0.9, h = 1.7, lintel = true, threshold = true, double = false }) {
  const side = Math.sign(face) || 1;
  registerOpening(g, 'door', axis, face, along, w + (threshold ? 0.24 : 0.2), 0, h + (lintel ? 0.15 : 0));
  // Leaf face is 0.07m behind the lintel face, but clear of the wall plane.
  const leaf = wallBox(axis, w, h, 0.04, along, h / 2, face + side * 0.03, MAT.door);
  g.add(leaf);
  if (lintel) g.add(wallBox(axis, w + 0.2, 0.14, 0.12, along, h + 0.07, face + side * 0.06, MAT.darkWood));
  if (threshold) g.add(wallBox(axis, w + 0.24, 0.12, 0.34, along, 0.06, face + side * 0.17, MAT.stone));
  if (double) {
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.035, h * 0.88), MAT.darkWood);
    if (axis === 'z') seam.position.set(along, h * 0.5, face + side * 0.052);
    else seam.position.set(face + side * 0.052, h * 0.5, along);
    seam.rotation.y = axis === 'z' ? (side > 0 ? 0 : Math.PI) : side * Math.PI / 2;
    g.add(seam);
  }
}

function addWindow(g, { axis = 'z', face, along, y, w = 1, h = 1.4, trim = MAT.white, panes = 6 }) {
  const side = Math.sign(face) || 1;
  registerOpening(g, 'window', axis, face, along, w, y - h / 2, y + h / 2);
  const innerW = w - 0.18, innerH = h - 0.18;
  // Four separate frame rails leave a real opening for the recessed glass.
  // A solid backing box at this depth occluded every pane.
  for (const offset of [-1, 1]) {
    g.add(wallBox(axis, 0.09, h, 0.08, along + offset * (w - 0.09) / 2, y, face + side * 0.045, trim));
    g.add(wallBox(axis, innerW, 0.09, 0.08, along, y + offset * (h - 0.09) / 2, face + side * 0.045, trim));
  }
  const gl = wallBox(axis, innerW, innerH, 0.018, along, y, face + side * 0.058, MAT.glass);
  gl.name = 'window-glass';
  g.add(gl);
  const addBar = (bw, bh, da, dy) => {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), trim);
    if (axis === 'z') bar.position.set(along + da, y + dy, face + side * 0.087);
    else bar.position.set(face + side * 0.087, y + dy, along + da);
    bar.rotation.y = axis === 'z' ? (side > 0 ? 0 : Math.PI) : side * Math.PI / 2;
    g.add(bar);
  };
  addBar(0.035, innerH, 0, 0);
  if (panes === 6) {
    addBar(innerW, 0.035, 0, -innerH / 6);
    addBar(innerW, 0.035, 0, innerH / 6);
  } else addBar(innerW, 0.035, 0, 0);
}

// --- the log building family ------------------------------------------------
export function logCabin({
  w = 6, d = 8, wallH = 2.2, roofH = 2.4, roof = 'thatchGable', old = false,
  hasChimney = false, windows = 0, windowStyle = 'dark', doorEnd = false, porch = false,
} = {}) {
  const g = new THREE.Group();
  const wallMat = old ? MAT.logOld : MAT.log;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
  walls.position.y = wallH / 2;
  g.add(walls, cornerLogs(w, d, wallH));

  const roofMat = { thatchGable: MAT.thatch, thatchGableOld: MAT.thatchOld, shingleGable: MAT.shingle, tileGable: MAT.tile, barkGable: MAT.bark }[roof] || MAT.thatch;
  if (roof.includes('Hip')) {
    const r = hipRoof(w, d, roofH, roof.includes('thatch') ? (old ? MAT.thatchOld : MAT.thatch) : MAT.shingle);
    r.position.y = wallH;
    g.add(r);
  } else {
    // gable runs along the long axis (d)
    const r = gableRoof(w, d, roofH, roofMat);
    r.position.y = wallH;
    g.add(r);
    if (roof === 'barkGable') {
      // bark sheets are held down by weight poles laid along the slope (Āraiši)
      const slope = Math.atan2(roofH, w / 2 + 0.45);
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const t = 0.28 + k * 0.26;
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, d + 0.8, 5), MAT.logOld);
          pole.rotation.x = Math.PI / 2;
          pole.position.set(s * (w / 2 + 0.45) * t, wallH + roofH * (1 - t) + 0.1, 0);
          pole.rotation.z = 0;
          void slope;
          g.add(pole);
        }
      }
    }
  }

  addDoor(g, doorEnd ? { face: d / 2 } : { axis: 'x', face: w / 2 });

  // windows on the long sides
  const whitePanes = windowStyle === 'framed' || hasChimney;
  for (let i = 0; i < windows; i++) {
    const zoff = (i - (windows - 1) / 2) * (d / (windows + 0.4));
    for (const side of [1, -1]) {
      // a side door sits at along 0 on the +x wall — an odd window count put
      // a sash straight through its lintel (the watermill did exactly this)
      let along = zoff;
      if (!doorEnd && side > 0 && Math.abs(along) < 0.95) {
        along = (i % 2 ? -1 : 1) * Math.min(d * 0.3, 1.45);
      }
      addWindow(g, {
        axis: 'x', face: side * w / 2, along, y: wallH * 0.62, w: 0.7, h: 0.86,
        trim: whitePanes ? MAT.white : MAT.darkWood,
        panes: whitePanes ? 6 : 4,
      });
    }
  }
  if (hasChimney) {
    const ch = chimney(roofH * 0.8 + 0.7);
    ch.position.set(0, wallH + roofH * 0.45, -d * 0.12);
    g.add(ch);
  }
  if (porch) {
    const p = new THREE.Group();
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.9, 6), MAT.lightWood);
      col.position.set(w / 2 + 0.9, 0.95, s * 0.9);
      p.add(col);
    }
    const pr = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 2.6), MAT.shingle);
    pr.position.set(w / 2 + 0.75, 1.95, 0);
    pr.rotation.z = 0.28;
    p.add(pr);
    g.add(p);
  }
  return shadowize(g);
}

// klēts raised on posts / stones (Iron Age & later granary)
export function postGranary({ w = 3, d = 3.6, wallH = 1.8 } = {}) {
  const g = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6), MAT.logOld);
    post.position.set(sx * (w / 2 - 0.3), 0.45, sz * (d / 2 - 0.3));
    g.add(post);
  }
  const body = logCabin({ w, d, wallH, roofH: 1.5, roof: 'thatchGable', doorEnd: true });
  body.position.y = 0.9;
  g.add(body);
  const steps = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.8), MAT.darkWood);
  steps.position.set(0, 0.25, d / 2 + 0.5);
  g.add(steps);
  return shadowize(g);
}

// rija — the great threshing barn, roof nearly to the ground
export function rija() {
  const g = logCabin({ w: 8, d: 13, wallH: 1.9, roofH: 4.6, roof: 'thatchGableOld', old: true, doorEnd: true });
  return g;
}

// vinda — the counterweighted well sweep. The beam pivots on the forked post,
// the rod hangs from its tip and the bucket rides down into the well: the
// first pass hung a rod in mid-air 0.8 m past the end of the beam and its
// "tick" cancelled itself out to a 10 cm twitch.
export function wellSweep() {
  const g = new THREE.Group();
  const PIVOT_Y = 3.25, TIP = 3.2, ROD_LEN = 2.6, WELL_X = 3.0;
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.5, 12), MAT.roundwood);
  fork.position.y = 1.75;
  // the crotch the beam rests in
  for (const s of [-1, 1]) {
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 5), MAT.logOld);
    prong.position.set(0, PIVOT_Y + 0.05, s * 0.13);
    prong.rotation.x = s * 0.35;
    g.add(prong);
  }
  const curb = new THREE.Group();curb.position.set(WELL_X,0,0);
  for(const s of [-1,1]){
    const a=new THREE.Mesh(new THREE.BoxGeometry(1.15,.85,.15),MAT.logOld);a.position.set(0,.42,s*.5);curb.add(a);
    const b=new THREE.Mesh(new THREE.BoxGeometry(.15,.85,.85),MAT.logOld);b.position.set(s*.5,.42,0);curb.add(b);
  }
  const shaft=new THREE.Mesh(new THREE.PlaneGeometry(.86,.86),MAT.door);shaft.rotation.x=-Math.PI/2;shaft.position.y=.025;curb.add(shaft);
  // beam: thin end out over the well, heavy butt behind the post
  const beamGeo = new THREE.CylinderGeometry(0.05, 0.09, 5.6, 6);
  beamGeo.rotateZ(-Math.PI / 2);
  beamGeo.translate(0.4, 0, 0);
  const beam = new THREE.Mesh(beamGeo, MAT.lightWood);
  beam.position.set(0, PIVOT_Y, 0);
  const weight = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28), MAT.stone);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, ROD_LEN, 5), MAT.lightWood);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 8), MAT.darkWood);
  g.add(fork, curb, beam, weight, rod, bucket);
  const pose = (a) => {
    beam.rotation.z = a;
    const tipX = Math.cos(a) * TIP, tipY = PIVOT_Y + Math.sin(a) * TIP;
    rod.position.set(tipX, tipY - ROD_LEN / 2, 0);
    bucket.position.set(tipX, tipY - ROD_LEN - 0.15, 0);
    weight.position.set(-Math.cos(a) * 2.3, PIVOT_Y - Math.sin(a) * 2.3, 0);
  };
  pose(0.3);
  // one slow draw every ~28 s — the yard's only moving thing at rest
  g.userData.tick = (t) => pose(-0.08 + Math.sin(t * 0.22) * 0.38);
  return shadowize(g);
}

// riķu žogs — slanted-pole fence between paired stakes
export function rikuFence(pts, spacing = 0.55) {
  const g = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.035, 0.05, 2.0, 4);
  const total = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = (bx - ax) / len, nz = (bz - az) / len;
    for (let dl = 0; dl < len; dl += spacing) total.push([ax + nx * dl, az + nz * dl, Math.atan2(nx, nz)]);
  }
  const mesh = new THREE.InstancedMesh(poleGeo, MAT.logOld, total.length + Math.ceil(total.length / 5) * 2);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let i = 0;
  total.forEach(([x, z, dir], k) => {
    const y = meshHeightAt(x, z);
    dummy.position.set(x, y + 0.75, z);
    dummy.rotation.set(0.6, dir, 0);                            // the slant
    dummy.scale.setScalar(0.95 + rng() * 0.15);
    dummy.updateMatrix();
    mesh.setMatrixAt(i++, dummy.matrix);
    if (k % 5 === 0) {                                          // paired upright stakes
      for (const off of [-0.12, 0.12]) {
        dummy.position.set(x + Math.cos(dir) * off, y + 0.6, z - Math.sin(dir) * off);
        dummy.rotation.set(0, dir, 0);
        dummy.scale.setScalar(0.75);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
  });
  mesh.count = i;
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

// woven wattle fence (Iron Age yards)
export function wattleFence(pts) {
  const g=new THREE.Group(),segments=[];
  for(let s=0;s<pts.length-1;s++){
    const [ax,az]=pts[s],[bx,bz]=pts[s+1],L=Math.hypot(bx-ax,bz-az);if(!L)continue;
    const nx=-(bz-az)/L,nz=(bx-ax)/L,N=Math.max(2,Math.ceil(L/.65));
    for(let p=0;p<=N;p++){
      const t=p/N,x=ax+(bx-ax)*t,z=az+(bz-az)*t,y=meshHeightAt(x,z);
      segments.push({a:[x,y-.03,z],b:[x,y+1.15,z],r:.035});
    }
    // Alternating rods weave in front of and behind successive stakes.
    for(let row=0;row<13;row++){
      let previous=null;
      for(let j=0;j<=N*4;j++){
        const t=j/(N*4),off=Math.cos(t*N*Math.PI+row*Math.PI)*.052;
        const x=ax+(bx-ax)*t+nx*off,z=az+(bz-az)*t+nz*off;
        const point=[x,meshHeightAt(x,z)+.15+row*.069,z];
        if(previous)segments.push({a:previous,b:point,r:.016});previous=point;
      }
    }
  }
  const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),MAT.roundwood,segments.length),d=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
  segments.forEach(({a,b,r},i)=>{
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);
    d.position.copy(av).add(bv).multiplyScalar(.5);d.quaternion.setFromUnitVectors(up,delta.clone().normalize());d.scale.set(r,delta.length(),r);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);
  });g.add(mesh);return shadowize(g);
}

// --- manor / school ----------------------------------------------------------
export function manorHouse({ flag = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(30, 5.2, 13), MAT.plaster);
  body.position.y = 2.6;
  g.add(body);
  const roof = hipRoof(13, 30, 3.4, MAT.tile, 0.7);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 5.2;
  g.add(roof);
  for (const dx of [-8, 8]) {
    const ch = chimney(2.2);
    ch.position.set(dx, 7.1, 0);
    g.add(ch);
  }
  // portico
  const ped = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 0.4), MAT.plaster);
  ped.position.set(0, 5.0, 7.1);
  const pedTri = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([
    new THREE.Vector2(-4, 0), new THREE.Vector2(4, 0), new THREE.Vector2(0, 1.6),
  ])), MAT.plaster);
  pedTri.position.set(0, 5.2, 7.28);
  g.add(ped, pedTri);
  for (let i = 0; i < 4; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.6, 10), MAT.white);
    col.position.set(-3 + i * 2, 2.3, 7.0);
    g.add(col);
  }
  const steps = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 2.2), MAT.stone);
  steps.position.set(0, 0.3, 7.6);
  g.add(steps);
  // Two rows front & back — the comment always said two, but only the main
  // row was ever built, which left 1.5 m of blank plaster under a 5.2 m eaves
  // line. The 18th-century Nekena house is a one-and-a-half storey manor
  // (research/taurene-local-history.md §2): a tall piano nobile with small
  // square attic lights above it.
  for (const side of [1, -1]) {
    for (let i = 0; i < 8; i++) {
      const x = -12.7 + i * 3.65;
      if (!(side > 0 && (i === 3 || i === 4))) {                // door bay
        addWindow(g, { face: side * 6.5, along: x, y: 2.7, w: 1.15, h: 2.0 });
      }
      addWindow(g, { face: side * 6.5, along: x, y: 4.42, w: 0.8, h: 0.68, panes: 4 });
    }
  }
  addDoor(g, { face: 6.5, w: 2, h: 2.8, threshold: false });

  if (flag) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 8, 6), MAT.white);
    pole.position.set(14, 4, 10);
    const flagGeo = new THREE.PlaneGeometry(2.4, 1.2, 10, 4);
    const fl = new THREE.Mesh(flagGeo, MAT.flagRed);
    fl.position.set(15.25, 7.4, 10);
    g.add(pole, fl);
    const base = flagGeo.attributes.position.array.slice();
    g.userData.tick = (t) => {
      const p = flagGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        p.setZ(i, Math.sin(x * 2.4 + t * 5) * 0.1 * (x + 1.2) * 0.5);
      }
      p.needsUpdate = true;
      flagGeo.computeVertexNormals();
    };
  }
  return shadowize(g);
}

export function manorOutbuilding(len = 20) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, 8), MAT.stone);
  base.position.y = 0.7;
  const top = new THREE.Mesh(new THREE.BoxGeometry(len, 1.8, 8), MAT.plaster);
  top.position.y = 2.3;
  g.add(base, top);
  const roof = gableRoof(8, len, 2.6, MAT.tile);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 3.2;
  g.add(roof);
  addDoor(g, { face: 4, w: 1.6, h: 2.25, double: true });
  for (const side of [1, -1]) {
    for (const f of [-0.36, -0.12, 0.12, 0.36]) {
      addWindow(g, { face: side * 4, along: f * len, y: 2.3, w: 0.9, h: 1.25 });
    }
  }
  return shadowize(g);
}

export function watermill(pondLevel) {
  const g = new THREE.Group();
  const house = logCabin({ w: 5, d: 6.5, wallH: 3, roofH: 2.2, roof: 'shingleGable', old: true, windows: 1 });
  g.add(house);
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 18), MAT.darkWood);
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.8), MAT.darkWood);
    const a = (i / 8) * Math.PI * 2;
    paddle.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0);
    paddle.rotation.z = a;
    wheel.add(paddle);
  }
  wheel.position.set(-3.2, 1.2, 0);
  wheel.rotation.y = Math.PI / 2;
  g.add(wheel);
  g.userData.tick = (t) => { wheel.rotation.x = t * 0.7; };
  void pondLevel;
  return shadowize(g);
}

export function bridge(simple = false) {
  const g = new THREE.Group();
  if (simple) {
    const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 26, 7), MAT.logOld);
    log1.rotation.z = Math.PI / 2;
    log1.position.y = 0.5;
    const log2 = log1.clone();
    log2.position.set(0, 0.5, 0.5);
    g.add(log1, log2);
  } else {
    // 34m deck + sloped approach ramps: the channel carve is sub-waterline
    // out to ±16m, so the old 28m deck ended standing in open water
    const deck = new THREE.Mesh(new THREE.BoxGeometry(34, 0.3, 3.6), MAT.plank);
    deck.position.y = 1.2;
    g.add(deck);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 34, 5), MAT.lightWood);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 2.1, s * 1.7);
      g.add(rail);
      for (let i = -4; i <= 4; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), MAT.darkWood);
        post.position.set(i * 4.2, 1.7, s * 1.7);
        g.add(post);
      }
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.28, 3.6), MAT.plank);
      ramp.position.set(s * 21.4, 0.64, 0);
      ramp.rotation.z = s * -0.13;
      g.add(ramp);
    }
    for (const px of [-13, -4.5, 4.5, 13]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 2.9, 6), MAT.logOld);
      pile.position.set(px, -0.1, 0);
      g.add(pile);
    }
  }
  return shadowize(g);
}

// --- small life props --------------------------------------------------------
export function campfire({cooking=true}={}) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + rng() * 0.08,1), MAT.granite);
    st.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
    g.add(st);
  }
  if(cooking) {
  for (let i = 0; i < 3; i++) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.9, 4), MAT.darkWood);
    const a = (i / 3) * Math.PI * 2;
    const foot=new THREE.Vector3(Math.cos(a)*.68,0,Math.sin(a)*.68),tip=new THREE.Vector3(0,1.78,0);
    stick.position.copy(foot).add(tip).multiplyScalar(.5);
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tip.sub(foot).normalize());
    g.add(stick);
  }
  const potMat=MAT.iron.clone();potMat.side=THREE.DoubleSide;
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, Math.PI/2, Math.PI/2), potMat);
  pot.position.y = 0.82;
  g.add(pot);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.21,.012,6,16,Math.PI),MAT.iron);handle.position.y=.82;g.add(handle);
  const hanger=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.77,5),MAT.iron);hanger.position.y=1.40;g.add(hanger);
  }
  for(let i=0;i<3;i++){
    const log=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,.70,8),MAT.darkWood);log.rotation.set(Math.PI/2,i*Math.PI/3,.10);log.position.y=.11+i*.035;g.add(log);
  }
  const ember = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.07, 16), new THREE.MeshLambertMaterial({ color: 0x372b23,emissive:0x4e1003 }));
  ember.position.y = 0.06;
  ember.name = 'ember';
  g.add(ember);
  return shadowize(g);
}

export function haystack(h = 3.2) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h + 0.7, 8), MAT.roundwood);
  pole.position.y = (h + 0.7) / 2;
  const profile=[];
  for(let i=0;i<=24;i++){const t=i/24;profile.push(new THREE.Vector2(Math.max(.02,h*.43*Math.pow(1-t*t,.70)*(1+.05*Math.sin(t*13))),h*t));}
  const hay = new THREE.Mesh(new THREE.LatheGeometry(profile,24), MAT.hay);
  hay.position.y = 0.03;
  g.add(pole, hay);
  return shadowize(g);
}

export function woodpile() {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, MAT.lightWood, 36);
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9 - r; c++) {
    dummy.position.set((c - (8 - r) / 2) * 0.19, 0.1 + r * 0.165, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i++, dummy.matrix);
  }
  mesh.count = i;
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

export function choppingBlock() {
  const g = new THREE.Group();
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.55, 16), [MAT.roundwood,MAT.lightWood,MAT.roundwood]);
  stump.position.y = 0.27;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.75, 5), MAT.lightWood);
  handle.position.set(-0.15, 0.91, 0);
  handle.rotation.z = 0.5;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.05), MAT.iron);
  head.position.set(.015, .57, 0);
  g.add(stump, handle, head);
  return shadowize(g);
}

function openBoat(length, halfWidth, depth, material, seats) {
  const g=new THREE.Group(),pos=[],uv=[],indices=[],N=24,K=12;
  // A hollow shell: matching outer and inner U sections, joined at the rim.
  for(let skin=0;skin<2;skin++)for(let i=0;i<=N;i++){
    const t=i/N,x=(t-.5)*length,w=Math.max(.025,Math.pow(Math.sin(t*Math.PI),.64)*halfWidth);
    for(let j=0;j<=K;j++){
      const a=(j/K-.5)*Math.PI;
      pos.push(x,.03+depth*(1-Math.cos(a))+.16*Math.pow(Math.abs(t-.5)*2,5)+(skin?.035:0),
        Math.sin(a)*(w-(skin?.025:0)));
      uv.push(x/1.4,j/K*.6);
    }
  }
  const layer=(N+1)*(K+1);
  for(let skin=0;skin<2;skin++)for(let i=0;i<N;i++)for(let j=0;j<K;j++){
    const a=skin*layer+i*(K+1)+j,b=a+K+1;
    if(skin)indices.push(a,b,a+1,a+1,b,b+1);else indices.push(a,a+1,b,a+1,b+1,b);
  }
  for(let i=0;i<N;i++)for(const j of [0,K]){
    const a=i*(K+1)+j,b=a+K+1;indices.push(a,b,a+layer,b,b+layer,a+layer);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const shell=new THREE.Mesh(geo,material.clone());shell.material.side=THREE.DoubleSide;g.add(shell);
  if(seats)for(const x of [-length*.24,0,length*.24]){
    const seat=new THREE.Mesh(new THREE.BoxGeometry(.25,.055,halfWidth*1.65),MAT.plank);seat.position.set(x,depth*.78,0);g.add(seat);
  }
  return shadowize(g);
}
export function dugoutCanoe() { return openBoat(4.6,.37,.40,MAT.logOld,false); }
export function rowboat() { return openBoat(4.2,.65,.52,MAT.plank,true); }

export function cart() {
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 1.3), MAT.plank);
  bed.position.y = 0.85;
  g.add(bed);
  for (const [dx, dz] of [[-0.9, 0.75], [-0.9, -0.75], [0.9, 0.75], [0.9, -0.75]]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.49,0.055,6,20), MAT.darkWood);
    wheel.position.set(dx, 0.55, dz);
    g.add(wheel);
    for(let i=0;i<8;i++){
      const spoke=new THREE.Mesh(new THREE.BoxGeometry(.94,.045,.045),MAT.lightWood);spoke.rotation.z=i*Math.PI/8;spoke.position.copy(wheel.position);g.add(spoke);
    }
  }
  const shafts = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4), MAT.lightWood);
  shafts.rotation.z = Math.PI / 2 - 0.15;
  shafts.position.set(2.2, 0.75, 0.4);
  g.add(shafts.clone(), shafts.translateZ(-0.8));
  return shadowize(g);
}

export function beehiveLog() {
  const g = new THREE.Group();
  const hive = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.4, 16), MAT.roundwood);
  hive.position.y = 0.9;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.4, 8), MAT.thatchOld);
  cap.position.y = 1.8;
  const hole=new THREE.Mesh(new THREE.CircleGeometry(.027,12),MAT.door);hole.position.set(0,.72,.347);g.add(hole);
  g.add(hive, cap);
  return shadowize(g);
}

export function laundryLine() {
  const g = new THREE.Group();
  const cloths = [];
  for (const px of [-2.2, 2.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.9, 5), MAT.logOld);
    post.position.set(px, 0.95, 0);
    g.add(post);
  }
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.4, 3), MAT.darkWood);
  line.rotation.z = Math.PI / 2;
  line.position.y = 1.78;
  g.add(line);
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(0.85, 1.05, 6, 6);
    const cl = new THREE.Mesh(geo, MAT.cloth);
    cl.position.set(-1.4 + i * 1.4, 1.25, 0);
    g.add(cl);
    cloths.push({ geo, base: geo.attributes.position.array.slice(), phase: i * 2.1 });
  }
  g.userData.tick = (t) => {
    for (const c of cloths) {
      const p = c.geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = c.base[i * 3], y = c.base[i * 3 + 1];
        p.setZ(i, Math.sin(t * 2.2 + c.phase + x * 2) * 0.12 * (0.55 - y));
      }
      p.needsUpdate = true;
    }
  };
  return shadowize(g);
}

export function poemStone() {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 2), MAT.granite);
  rock.position.y = 0.6;
  rock.scale.set(1, 0.85, 0.8);
  const p=rock.geometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,Math.min(p.getZ(i),.72));
  rock.geometry.computeVertexNormals();
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.05), new THREE.MeshLambertMaterial({ color: 0x6d5a2e }));
  plaque.position.set(0, 0.72, 0.598);
  g.add(rock, plaque);
  return shadowize(g);
}

export function storkNestPole() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), MAT.logOld);
  pole.position.y = 2.7;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 5, 12), MAT.darkWood);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.y = 5.45;
  const nest = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.22, 5, 12), MAT.hay);
  nest.rotation.x = Math.PI / 2;
  nest.position.y = 5.6;
  g.add(pole, wheel, nest);
  return shadowize(g);
}

export function churchSilhouette() {
  const g = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 12), MAT.plaster);
  nave.position.y = 4.5;
  const naveRoof = gableRoof(12, 24, 5, MAT.tile);
  naveRoof.rotation.y = Math.PI / 2;
  naveRoof.position.y = 9;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 16, 8), MAT.plaster);
  tower.position.set(14, 8, 0);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(4.4, 12, 8), MAT.iron);
  spire.position.set(14, 22, 0);
  g.add(nave, naveRoof, tower, spire);
  addDoor(g, { axis: 'x', face: 18, w: 2.2, h: 3.2 });
  for (const side of [1, -1]) {
    for (const x of [-8, -2, 5]) addWindow(g, { face: side * 6, along: x, y: 5, w: 1.4, h: 3.6 });
  }
  addWindow(g, { axis: 'x', face: 18, along: 0, y: 11.5, w: 1.25, h: 2.2, panes: 4 });
  return g;
}

// palisade ring for the hillfort refuge (Lejstupu pilskalns)
export function palisadeRing(cx, cz, radius = 17) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.09, 0.11, 2.4, 5);
  const N = Math.floor((2 * Math.PI * radius) / 0.28);
  const mesh = new THREE.InstancedMesh(geo, MAT.logOld, N);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    if (a > 5.6 && a < 5.95) continue;                        // gate gap (NE)
    const x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * radius;
    dummy.position.set(x, meshHeightAt(x, z) + 1.05, z);
    dummy.rotation.set((rng() - 0.5) * 0.06, 0, (rng() - 0.5) * 0.06);
    dummy.scale.setScalar(0.9 + rng() * 0.25);
    dummy.updateMatrix();
    mesh.setMatrixAt(i++, dummy.matrix);
  }
  mesh.count = i;
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

// the 1888 neo-Renaissance new manor (arch. R. G. Šmēlings), two-tone brick
export function manorNew({ flag = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(24, 7.4, 11), MAT.brick);
  body.position.y = 3.7;
  g.add(body);
  // central risalit with a low gable
  const ris = new THREE.Mesh(new THREE.BoxGeometry(7.5, 8.4, 12.6), MAT.brick);
  ris.position.set(0, 4.2, 0);
  g.add(ris);
  const risGable = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([
    new THREE.Vector2(-3.75, 0), new THREE.Vector2(3.75, 0), new THREE.Vector2(0, 1.9),
  ])), MAT.plaster);
  risGable.position.set(0, 8.4, 6.32);
  g.add(risGable);
  const roof = hipRoof(11, 24, 2.6, MAT.tile, 0.6);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 7.4;
  g.add(roof);
  const risRoof = gableRoof(12.6, 7.5, 2.2, MAT.tile, 0.3);
  risRoof.rotation.y = Math.PI / 2;
  risRoof.position.y = 8.4;
  g.add(risRoof);
  for (const dx of [-7, 7]) {
    const ch = chimney(2.0);
    ch.position.set(dx, 8.9, 0);
    g.add(ch);
  }
  // two storeys of windows with pale surrounds
  for (const side of [1, -1]) {
    for (let fl = 0; fl < 2; fl++) {
      for (let i = 0; i < 6; i++) {
        const x = -9.5 + i * 3.8;
        // The risalit is a THROUGH block — 12.6 m deep against an 11 m body,
        // so it projects 0.8 m at the BACK as well. Skipping its bay only on
        // the front face walled four rear windows up inside solid brick.
        if (Math.abs(x) < 4) continue;                        // risalit faces handled below
        addWindow(g, { face: side * 5.5, along: x, y: 2.1 + fl * 3.1, w: 1.2, h: 2.0, trim: MAT.plaster });
      }
    }
  }
  // risalit: entrance front, plain windows on the garden side
  addDoor(g, { face: 6.3, w: 2, h: 3, lintel: false, threshold: false });
  for (const fl of [0, 1]) {
    for (const dx of [-2.2, 2.2]) {
      addWindow(g, { face: -6.3, along: dx, y: 2.1 + fl * 3.1, w: 1.2, h: 2.0, trim: MAT.plaster });
    }
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.2), MAT.plaster);
  arch.position.set(0, 3.2, 6.34);
  g.add(arch);
  for (const dx of [-2.2, 2.2]) {
    addWindow(g, { face: 6.3, along: dx, y: 5.6, w: 1.1, h: 2.0, trim: MAT.plaster });
  }
  const steps = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 2), MAT.stone);
  steps.position.set(0, 0.3, 7.4);
  g.add(steps);
  if (flag) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 9, 6), MAT.white);
    pole.position.set(11.5, 4.5, 8);
    const flagGeo = new THREE.PlaneGeometry(2.4, 1.2, 10, 4);
    const fl = new THREE.Mesh(flagGeo, MAT.flagRed);
    fl.position.set(12.75, 8.4, 8);
    g.add(pole, fl);
    const base = flagGeo.attributes.position.array.slice();
    g.userData.tick = (t) => {
      const p = flagGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        p.setZ(i, Math.sin(x * 2.4 + t * 5) * 0.1 * (x + 1.2) * 0.5);
      }
      p.needsUpdate = true;
      flagGeo.computeVertexNormals();
    };
  }
  return shadowize(g);
}

// the manor ale brewery on the Gauja bank — three vaulted cellars in the slope
export function brewery() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 7.5), MAT.stone);
  base.position.y = 1.1;
  const top = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 7.5), MAT.plaster);
  top.position.y = 3.3;
  g.add(base, top);
  const roof = gableRoof(7.5, 16, 2.4, MAT.tile);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 4.4;
  g.add(roof);
  const chim = chimney(1.8);
  chim.position.set(-4, 5.5, 0);
  g.add(chim);
  // cellar arches facing the river (local -z)
  for (const dx of [-5, 0, 5]) {
    const archGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.7, 12, 1, false, 0, Math.PI);
    const arch = new THREE.Mesh(archGeo, MAT.stone);
    arch.rotation.set(0, 0, Math.PI / 2);
    arch.rotation.x = Math.PI / 2;
    arch.position.set(dx, 1.0, -3.9);
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.95, 12, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x120d08 }));
    mouth.position.set(dx, 1.0, -3.86);
    g.add(arch, mouth);
  }
  addDoor(g, { face: 3.75, w: 1.35, h: 2.15 });
  for (const x of [-5.5, -2.5, 2.5, 5.5]) {
    addWindow(g, { face: 3.75, along: x, y: 3.35, w: 1, h: 1.3 });
  }
  return shadowize(g);
}

// unlit Jāņi bonfire pyre (lit by the era manager at dusk)
export function pyre() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 5), MAT.lightWood);
    const foot=new THREE.Vector3(Math.cos(a)*1.05,.06,Math.sin(a)*1.05),tip=new THREE.Vector3(Math.cos(a)*.08,2.43,Math.sin(a)*.08);
    log.position.copy(foot).add(tip).multiplyScalar(.5);
    log.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tip.sub(foot).normalize());
    g.add(log);
  }
  // the tar-barrel pole beside it
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.4, 5), MAT.logOld);
  pole.position.set(1.6, 2.2, 0);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 9), MAT.darkWood);
  barrel.position.set(1.6, 4.5, 0);
  g.add(pole, barrel);
  return shadowize(g);
}

// Brežģa krogs — the roadside tavern that bought the manor's ale.
// Latvian krogi were long log buildings under a massive hip roof, one end a
// stable for travellers' horses.
export function krogs() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 2.6, 8.5), MAT.logOld);
  body.position.y = 1.3;
  g.add(body, cornerLogs(18, 8.5, 2.6));
  const roof = hipRoof(8.5, 18, 3.8, MAT.thatchOld, 0.7);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 2.6;
  g.add(roof);
  const ch = chimney(2.2);
  ch.position.set(-3, 4.4, 0);
  g.add(ch);
  // tavern door + wide stable door
  addDoor(g, { face: 4.25, along: -4, w: 1.1, h: 1.9 });
  addDoor(g, { face: 4.25, along: 6, w: 2.6, h: 2.2, double: true });
  for (const wx of [-7.5, -0.5]) {
    addWindow(g, { face: 4.25, along: wx, y: 1.6, w: 0.8, h: 0.8, trim: MAT.darkWood, panes: 4 });
  }
  // hitching rail
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5, 5), MAT.lightWood);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(-4, 1, 6.4);
  g.add(rail);
  return shadowize(g);
}

// the 2017 observation tower on Brežģa kalns (11 m, timber lattice)
export function observationTower() {
  const g=new THREE.Group();g.name='brezga-observation-tower';
  // Published project photos show X-bracing and a broad viewing pavilion.
  // Overall ridge height is 11 m; stair/platform dimensions are inferred.
  const beam=(a,b,width=.10)=>{
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),dir=bv.clone().sub(av);
    const m=new THREE.Mesh(new THREE.BoxGeometry(width,dir.length(),width),MAT.lightWood);
    m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());g.add(m);
  };
  const span=y=>1.52-y*.022;
  for(const sx of [-1,1])for(const sz of [-1,1])beam([sx*span(0),0,sz*span(0)],[sx*span(9.9),9.9,sz*span(9.9)],.18);
  for(let level=0;level<3;level++){
    const y0=level*2.73,y1=(level+1)*2.73,s=span(y1);
    for(const side of [-1,1]){
      beam([-span(y0),y0,side*span(y0)],[s,y1,side*s],.085);
      beam([span(y0),y0,side*span(y0)],[-s,y1,side*s],.085);
      beam([side*span(y0),y0,-span(y0)],[side*s,y1,s],.085);
    }
    const deck=new THREE.Mesh(new THREE.BoxGeometry(level===2?3.35:s*2,.12,level===2?3.35:.72),MAT.plank);
    deck.position.set(0,y1,level===2?0:(level%2?-s+.36:s-.36));g.add(deck);
    const direction=level%2?-1:1,x=level%2?-.62:.62;
    for(let step=0;step<15;step++){
      const t=(step+.5)/15,y=y0+(y1-y0)*t,z=direction*(-1.25+2.5*t);
      const tread=new THREE.Mesh(new THREE.BoxGeometry(.78,.065,.24),MAT.plank);tread.position.set(x,y,z);g.add(tread);
    }
    for(const side of [-1,1]){
      beam([x+side*.39,y0,-direction*1.25],[x+side*.39,y1,direction*1.25],.075);
      beam([x+side*.39,y0+.83,-direction*1.25],[x+side*.39,y1+.83,direction*1.25],.055);
    }
  }
  for(const s of [-1,1])for(const axis of [0,1]){
    const point=(u,y)=>axis?[s*1.64,y,u]:[u,y,s*1.64];
    for(const y of [8.7,9.22])beam(point(-1.64,y),point(1.64,y),.075);
    for(let i=0;i<9;i++)beam(point(-1.6+i*.4,8.2),point(-1.6+i*.4,9.22),.045);
  }
  const roof=hipRoof(3.4,3.4,1.1,MAT.shingle,.20);roof.position.y=9.9;g.add(roof);
  return shadowize(g);
}

// a renovated 2020s farmhouse: plank siding, metal roof
export function modernHouse() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(9.5, 2.9, 7), MAT.plank);
  body.position.y = 1.45;
  g.add(body);
  const metal = new THREE.MeshLambertMaterial({ color: 0x6e7880 });
  const roof = gableRoof(7, 9.5, 2.3, metal, 0.5);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 2.9;
  g.add(roof);
  const ch = chimney(1.4);
  ch.position.set(1.5, 4.4, 0);
  g.add(ch);
  // The door used to sit at 3.9 with a window at 3.0: a 1.24 m threshold and
  // a 1.3 m sash cannot both occupy x 3.3-3.65. Windows walk down from the
  // gable end and stop clear of the entrance bay.
  for (let i = 0; i < 3; i++) {
    addWindow(g, { face: 3.5, along: -3.4 + i * 2.4, y: 1.55, w: 1.3, h: 1.25 });
    addWindow(g, { face: -3.5, along: -3.0 + i * 2.8, y: 1.55, w: 1.15, h: 1.25 });
  }
  for(const s of [-1,1])for(const z of [-1.6,1.6])addWindow(g,{axis:'x',face:s*4.75,along:z,y:1.55,w:1.1,h:1.25});
  addDoor(g, { face: 3.5, along: 3.6, w: 1, h: 2.1 });
  return shadowize(g);
}

export function car(color = 0x44566b) {
  const g=new THREE.Group(),paint=new THREE.MeshPhongMaterial({color,shininess:65});
  const outline=new THREE.Shape();outline.moveTo(-2,.42);
  for(const [x,y] of [[2,.42],[2.05,.79],[1.0,.88],[.38,1.40],[-.85,1.43],[-1.42,.92],[-2.03,.84]])outline.lineTo(x,y);
  outline.closePath();
  const shell=new THREE.ExtrudeGeometry(outline,{depth:1.66,bevelEnabled:true,bevelSize:.055,bevelThickness:.045,bevelSegments:2,steps:1});shell.translate(0,0,-.83);g.add(new THREE.Mesh(shell,paint));
  const pane=(points)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();const m=new THREE.Mesh(geo,MAT.glass.clone());m.material.side=THREE.DoubleSide;g.add(m);};
  for(const s of [-1,1]){
    pane([[-1.23,.97,s*.882],[-.82,1.36,s*.882],[-.22,1.36,s*.882],[-.22,.97,s*.882]]);
    pane([[-.15,.97,s*.882],[-.15,1.36,s*.882],[.34,1.34,s*.882],[.85,.97,s*.882]]);
    for(const dx of [-1.35,1.35]){
      const tyre=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.20,20),MAT.iron);tyre.rotation.x=Math.PI/2;tyre.position.set(dx,.32,s*.84);g.add(tyre);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.015,12),new THREE.MeshLambertMaterial({color:0x879093}));hub.rotation.x=Math.PI/2;hub.position.set(dx,.32,s*.946);g.add(hub);
    }
    for(const front of [-1,1]){
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(.04,.13,.34),new THREE.MeshLambertMaterial({color:front>0?0xd9dfd5:0x8c2118}));
      lamp.position.set(front*2.06,.73,s*.58);g.add(lamp);
    }
  }
  pane([[.4,1.405,-.74],[.4,1.405,.74],[.99,.91,.74],[.99,.91,-.74]]);
  pane([[-1.42,.94,-.72],[-1.42,.94,.72],[-.88,1.435,.72],[-.88,1.435,-.72]]);
  return shadowize(g);
}

// A compact interwar saloon: tall enclosed cabin, separate bonnet and narrow
// track. Motor traffic was occasional on the Cesis-Madona road in the 1930s,
// so this is deliberately distinct from the broad modern car above.
export function motorcar1930s() {
  const g = new THREE.Group();
  g.name = 'interwar-motorcar';
  const paint = new THREE.MeshPhongMaterial({ color: 0x27312b, shininess: 45 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.45, 1.5), paint);
  chassis.position.y = 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.95, 1.42), paint);
  cabin.position.set(-0.45, 1.22, 0);
  const bonnet = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.52, 1.25), paint);
  bonnet.position.set(1.25, 0.88, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.55, 1.44), MAT.glass);
  glass.position.set(-0.42, 1.36, 0);
  g.add(chassis, cabin, bonnet, glass);
  for (const [dx, dz] of [[-1.2, 0.72], [-1.2, -0.72], [1.15, 0.72], [1.15, -0.72]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.16, 12), MAT.iron);
    w.rotation.x = Math.PI / 2;
    w.position.set(dx, 0.38, dz);
    g.add(w);
  }
  return shadowize(g);
}

// glacial erratics — big till boulders dropped by the ice
export function erratics(count, area) {
  const g = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geo, MAT.granite, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const x = area.x + (rng() - 0.5) * area.w;
    const z = area.z + (rng() - 0.5) * area.h;
    const s = 0.4 + Math.pow(rng(), 2.2) * 2.4;
    dummy.position.set(x, meshHeightAt(x, z) + s * 0.25, z);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.scale.set(s, s * (0.7 + rng() * 0.4), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

// stranded dead-ice blocks melting into the future lake basins
export function deadIce(x, z, s = 1) {
  const g = new THREE.Group();
  const iceMat = new THREE.MeshPhongMaterial({
    color: 0xc9d4d1, shininess: 18, specular: 0x6a797d,
  });
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), iceMat);
    blob.position.set((rng() - 0.5) * 14 * s, -1.2 + i * 0.4, (rng() - 0.5) * 10 * s);
    blob.scale.set((5 + rng() * 6) * s, (2 + rng() * 1.6) * s, (4 + rng() * 4) * s);
    blob.rotation.set(rng(), rng(), rng());
    blob.castShadow = true;
    g.add(blob);
  }
  g.position.set(x, meshHeightAt(x, z), z);
  return g;
}

// stone/wooden grave markers on the barrows
export function barrowStones(bumps, erosion = 1) {
  const g = new THREE.Group();
  for (const b of bumps) {
    const ox = (rng() - 0.5) * 2, oz = (rng() - 0.5) * 2;
    const x = b.x + ox, z = b.z + oz;
    // markers stand ON the mound, not inside it: the barrows are meshes laid
    // over flat ground now, so a terrain-height stone is simply buried
    const t = Math.min(1, Math.hypot(ox, oz) / b.r);
    const lift = b.h * erosion * 0.5 * (1 + Math.cos(t * Math.PI));
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rng() * 0.2), MAT.stone);
    st.position.set(x, meshHeightAt(x, z) + lift + 0.12, z);
    g.add(st);
  }
  return shadowize(g);
}

// Barrows are cultural earthworks, not part of the timeless DEM. Build their
// low cosine profiles only for eras after the cemetery was established.
export function barrowMounds(bumps, erosion = 1) {
  const g = new THREE.Group();
  g.name = 'barrow-mounds';
  // knee-high earthworks: the collider pass would otherwise wrap each mound
  // in a full-height invisible box you cannot step over
  g.userData.noCollide = true;
  const mat = new THREE.MeshLambertMaterial({ color: 0x59613a, vertexColors: true });
  for (const b of bumps) {
    const pos = [], col = [], idx = [];
    const RINGS = 5, SEG = 20;
    pos.push(b.x, meshHeightAt(b.x, b.z) + b.h * erosion + 0.015, b.z);
    col.push(0.41, 0.46, 0.27);
    for (let ring = 1; ring <= RINGS; ring++) {
      const t = ring / RINGS, r = b.r * t;
      const lift = b.h * erosion * 0.5 * (1 + Math.cos(t * Math.PI));
      for (let k = 0; k < SEG; k++) {
        const a = (k / SEG) * Math.PI * 2;
        const x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r;
        pos.push(x, meshHeightAt(x, z) + lift + 0.015, z);
        const green = 0.78 + t * 0.2;
        col.push(0.52 * green, 0.58 * green, 0.34 * green);
      }
    }
    // Wind every face CCW seen from ABOVE. The first pass wound them the
    // other way: computeVertexNormals then pointed every normal at the
    // ground, so the mounds lit from below and front-face culling erased
    // them from any camera above the grass.
    for (let k = 0; k < SEG; k++) idx.push(0, 1 + (k + 1) % SEG, 1 + k);
    for (let ring = 1; ring < RINGS; ring++) for (let k = 0; k < SEG; k++) {
      const a = 1 + (ring - 1) * SEG + k, b0 = 1 + (ring - 1) * SEG + (k + 1) % SEG;
      const c = 1 + ring * SEG + k, d = 1 + ring * SEG + (k + 1) % SEG;
      idx.push(a, b0, c, b0, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mound = new THREE.Mesh(geo, mat);
    mound.receiveShadow = true;
    mound.castShadow = true;          // low sun rakes them; that IS the reading
    g.add(mound);
  }
  return g;
}
