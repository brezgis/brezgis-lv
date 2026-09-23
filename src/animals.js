// Fauna: stylised low-poly animals with simple graze/wander behaviour.
// Species and sizes follow the zooarchaeology notes in the write-up
// (small Iron Age cattle and horses, primitive dark sheep, and the
// aurochs — bulls black with a pale eel-stripe, cows red-brown).
import * as THREE from 'three';
import { heightAt, meshHeightAt } from './terrain.js';
import { makeNoise, clamp, lerp } from './util.js';
import { quadruped, organicTube, ellipsoid } from './fauna-models.js';

const rng = makeNoise(909).rng;
const M = (c) => new THREE.MeshLambertMaterial({ color: c });

function birdEyes(parent,x,y,z,r=.006){
  const mat=M(0x171814);
  for(const s of [-1,1])ellipsoid(parent,mat,[s*x,y,z],[r,r,r*.72]);
}
function wingGeometry(span,chord,side,pointed=false){
  const shape=new THREE.Shape();shape.moveTo(0,0);
  shape.quadraticCurveTo(side*span*.38,chord*.62,side*span*(pointed?1:.82),chord*.2);
  shape.lineTo(side*span,pointed?-chord*.5:-chord*.12);
  for(let i=0;i<6;i++){
    const u=.94-i*.10;shape.lineTo(side*span*u,-chord*(.3+Math.sin(i*.7)*.12));
    shape.lineTo(side*span*(u-.035),-chord*.58);
  }
  shape.lineTo(0,-chord*.42);shape.closePath();
  const geo=new THREE.ShapeGeometry(shape,12);geo.rotateX(-Math.PI/2);return geo;
}

function fowl({ size = 0.22, color = 0xd8d3c4, comb = false, neckLen = 0, grouse = false }) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 10), M(color));
  body.scale.set(0.85, 0.9, 1.25);
  body.position.y = size * 1.25;
  body.rotation.x = -0.22;               // breast down, tail up
  g.add(body);
  // tail fan — more upright and less knife-flat than the first pass
  const tail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.55, size * 0.9, 6), M(color));
  tail.scale.z = 0.42;
  tail.rotation.x = -1.05;
  tail.position.set(0, size * 1.78, -size * 1.0);
  g.add(tail);
  const neck = new THREE.Group();
  neck.position.set(0, size * 1.6, size * 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 16, 10), M(color));
  head.position.set(0, size * 0.7 + neckLen, size * 0.28);
  neck.add(head);
  birdEyes(neck,size*.36,size*.77+neckLen,size*.46,size*.033);
  {
    // EVERY fowl gets a neck — the old neckLen>0 gate left chicken, rooster,
    // ptarmigan and grouse heads floating beside the body
    const nl = neckLen + size * 0.75;
    const nm = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.16, size * 0.22, nl, 5), M(color));
    nm.position.set(0, nl / 2 - size * 0.05, size * 0.18);
    nm.rotation.x = 0.22;
    neck.add(nm);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(size * 0.14, size * 0.5, 4), M(0xd08a28));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, size * 0.68 + neckLen, size * 0.75);
  neck.add(beak);
  if (comb || grouse) {
    const red=M(0xb93027);
    if(grouse)for(const s of [-1,1])ellipsoid(neck,red,[s*size*.34,size*.9+neckLen,size*.43],[size*.09,size*.045,size*.12]);
    else for(let i=0;i<4;i++)ellipsoid(neck,red,[0,size*1.08+neckLen,size*(.05+i*.13)],[size*.065,size*(.11+(i%2)*.05),size*.10]);
  }
  g.add(neck);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, size * 1.1, 4), M(0xc09030));
    leg.position.set(s * size * 0.3, size * 0.55, 0);
    g.add(leg);
    for(let toe=-1;toe<=1;toe++)organicTube(g,M(0xa77e32),[[s*size*.3,.018,0],[s*size*.3+toe*size*.14,.012,size*.30]],[.008,.002]);
    ellipsoid(g,M(color),[s*size*.65,size*1.2,-size*.12],[size*.20,size*.48,size*.80]);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, neck, legs: [] };
}

function stork() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), M(0xf0ece2));
  body.scale.set(0.8, 0.85, 1.4);
  body.position.y = 0.78;
  g.add(body);
  for(const s of [-1,1])ellipsoid(g,M(0x282a29),[s*.18,.81,-.11],[.075,.17,.30]);
  const neck = new THREE.Group();
  neck.position.set(0, 0.95, 0.3);
  const nm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.55, 5), M(0xf0ece2));
  nm.position.set(0, 0.24, 0.06);
  nm.rotation.x = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), M(0xf0ece2));
  head.position.set(0, 0.5, 0.16);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.42, 4), M(0xc23a28));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.5, 0.45);
  neck.add(nm, head, beak);
  birdEyes(neck,.090,.515,.208,.01);
  g.add(neck);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 4), M(0xc23a28));
    leg.position.set(s * 0.09, 0.31, 0);
    g.add(leg);
    for(let toe=-1;toe<=1;toe++)organicTube(g,M(0xae3626),[[s*.09,.018,0],[s*.09+toe*.045,.008,.13]],[.009,.002]);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, neck, legs: [] };
}

// the white wagtail — baltā cielava, Latvia's national bird. Grey back,
// white face and belly, black cap and bib, and the long tail that never
// stops bobbing. Built with a tail PIVOT so the perch behaviour can wag it.
function wagtail() {
  const g = new THREE.Group();
  const grey = M(0x9aa0a4), white = M(0xf0efe8), black = M(0x1c1d20);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10), grey);
  body.scale.set(0.8, 0.78, 1.25);
  body.position.y = 0.085;
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 10), white);
  belly.scale.set(0.72, 0.6, 1.1);
  belly.position.y = 0.062;
  g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 10), white);
  head.position.set(0, 0.135, 0.062);
  g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0345, 16, 10), black);
  cap.scale.set(0.94, 0.62, 0.8);
  cap.position.set(0, 0.152, 0.052);
  g.add(cap);
  const bib = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 10), black);
  bib.scale.set(0.8, 0.7, 0.5);
  bib.position.set(0, 0.108, 0.088);
  g.add(bib);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.028, 4), black);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.133, 0.1);
  g.add(beak);
  // tail pivot at the rump — the wag
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.095, -0.055);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.1), black);
  tail.position.z = -0.05;
  tailPivot.add(tail);
  g.add(tailPivot);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.006, 0.05), grey);
    w.geometry.translate(s * 0.0425, 0, 0);
    w.position.set(s * 0.02, 0.1, 0.01);
    g.add(w);
    wings.push(w);
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.05, 3), black);
    leg.position.set(s * 0.016, 0.028, 0.01);
    g.add(leg);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, neck: null, legs: [], wings, tailPivot };
}

// bumblebee — kamene: a fat black-and-gold speck with a wing blur. Big
// enough to read at arm's length in the flowers, cheap enough for a dozen.
function bumblebee() {
  const g = new THREE.Group();
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 10), M(0x18140f));
  thorax.position.set(0, 0, 0.012);
  const band = new THREE.Mesh(new THREE.SphereGeometry(0.019, 16, 10), M(0xd8a020));
  band.scale.set(1, 0.85, 0.55);
  band.position.set(0, 0.002, -0.004);
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.017, 16, 10), M(0x18140f));
  rump.scale.set(0.95, 0.9, 1.1);
  rump.position.set(0, 0, -0.02);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 10), M(0xe8e2d4));
  tip.position.set(0, 0, -0.034);
  g.add(thorax, band, rump, tip);
  const wings = [];
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xdce8f0, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.016), wingMat);
    w.geometry.translate(s * 0.015, 0, 0);
    w.rotation.x = -Math.PI / 2;
    w.position.set(s * 0.008, 0.016, 0.005);
    g.add(w);
    wings.push(w);
  }
  return { group: g, neck: null, legs: [], wings, flapAxis: 'y' };
}

// --- small ground game --------------------------------------------------------
function hare(color = 0x8a7a64, belly = 0xcfc6b4) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), M(color));
  body.scale.set(0.75, 0.8, 1.15);
  body.position.y = 0.17;
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), M(color));
  rump.position.set(0, 0.2, -0.1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 10), M(color));
  head.position.set(0, 0.28, 0.17);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), M(belly));
  bl.scale.set(0.7, 0.55, 1.0);
  bl.position.y = 0.12;
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 10), M(0xf2ede2));
  tail.position.set(0, 0.21, -0.23);
  g.add(body, rump, head, bl, tail);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), M(color));
    ear.scale.set(.024,.12,.016);
    ear.position.set(s * 0.038, 0.42, 0.14);
    ear.rotation.set(-0.15, 0, s * -0.18);
    g.add(ear);
    ellipsoid(g,M(0x29231d),[s*.065,.295,.211],[.012,.014,.011]);
    ellipsoid(g,M(color),[s*.085,.022,.06],[.037,.022,.095]);
    ellipsoid(g,M(color),[s*.105,.033,-.12],[.047,.032,.090]);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck: null };
}

function squirrel() {
  const g=new THREE.Group(),coat=M(0x99502b),dark=M(0x221b16);
  ellipsoid(g,coat,[0,.095,0],[.060,.093,.10]);
  ellipsoid(g,coat,[0,.163,.081],[.043,.049,.052]);
  ellipsoid(g,M(0xc8bba1),[0,.080,.050],[.040,.060,.048]);
  organicTube(g,coat,[[0,.07,-.07],[0,.12,-.17],[0,.25,-.19],[0,.31,-.13],[0,.28,-.075]],[.025,.047,.055,.042,.003]);
  for(const s of [-1,1]){
    ellipsoid(g,coat,[s*.028,.215,.071],[.016,.031,.012]);
    ellipsoid(g,dark,[s*.036,.175,.111],[.005,.006,.005]);
    organicTube(g,coat,[[s*.043,.095,.019],[s*.035,.062,.068],[s*.022,.060,.099]],[.014,.011,.004]);
    ellipsoid(g,coat,[s*.050,.014,-.005],[.025,.013,.045]);
  }
  ellipsoid(g,dark,[0,.16,.134],[.011,.008,.007]);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return {group:g,legs:[],neck:null};
}

// --- water creatures ----------------------------------------------------------
function fish({ len = 0.5, color = 0x37424a, belly = 0x93a29a, pike = false, fin = null, deep = 1, sail = false } = {}) {
  const g = new THREE.Group();
  const finM = M(fin ?? color);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), M(color));
  body.scale.set(len * (pike?.08:.13), len * (pike?.11:.2) * deep, len * 0.5);
  birdEyes(g,len*(pike?.061:.087),len*.03,len*.37,len*.019);
  if(pike)ellipsoid(g,M(color),[0,0,len*.42],[len*.075,len*.055,len*.16]);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), M(belly));
  bl.scale.set(len * (pike?.065:.11), len * (pike?.07:.14) * deep, len * 0.44);
  bl.position.y = -len * 0.05 * deep;
  const tailF = new THREE.Mesh(new THREE.ConeGeometry(len * 0.16, len * 0.24, 4), finM);
  tailF.scale.x = 0.22;
  tailF.rotation.x = Math.PI / 2 + 0.2;
  tailF.position.set(0, 0, -len * 0.58);
  // the grayling's sail: a tall, long, violet-flecked dorsal
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(len * (sail ? 0.2 : 0.1), len * (sail ? 0.3 : 0.16), 4), sail ? M(0x5e4a62) : finM);
  dorsal.scale.x = 0.2;
  if (sail) dorsal.scale.z = 1.8;
  dorsal.position.set(0, len * (pike?.10:.2) * deep, -len * (pike?.31:sail?.02:.05));
  g.add(body, bl, tailF, dorsal);
  if (fin !== null) for (const sd of [-1, 1]) {     // paired fins where they carry the colour
    const pel = new THREE.Mesh(new THREE.ConeGeometry(len * 0.05, len * 0.1, 4), finM);
    pel.scale.x = 0.25; pel.rotation.x = Math.PI / 2 + 0.6;
    pel.position.set(sd * len * 0.07, -len * 0.12 * deep, len * 0.05);
    g.add(pel);
  }
  return { group: g, legs: [], neck: null, wiggle: true };
}

// A shoal: one baked fish geometry, instanced, each member on its own
// slow orbit about the shoal's centre — one draw call per shoal.
function fishShoal(kind, n, spread) {
  const geo = bakeSpeciesGeometry(kind, { grazing: false });
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), n);
  mesh.castShadow = false;
  const g = new THREE.Group();
  g.add(mesh);
  const offs = [];
  for (let i = 0; i < n; i++) offs.push([(rng() - 0.5) * spread, (rng() - 0.5) * 0.22, (rng() - 0.5) * spread * 1.5, rng() * TAU]);
  const dummy = new THREE.Object3D();
  const anim = (t) => {
    for (let i = 0; i < n; i++) {
      const o = offs[i];
      dummy.position.set(o[0] + Math.sin(t * 0.61 + o[3]) * 0.3, o[1] + Math.sin(t * 0.9 + o[3] * 2) * 0.05, o[2] + Math.cos(t * 0.47 + o[3]) * 0.35);
      dummy.rotation.set(0, Math.sin(t * 7 + o[3]) * 0.18 + Math.sin(t * 0.3 + o[3]) * 0.35, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  anim(0);
  geo.computeBoundingSphere();
  mesh.frustumCulled = false;
  return { group: g, legs: [], neck: null, wiggle: true, anim };
}

// grey heron — pelēkais gārnis: grey mantle, white neck and face, the black
// crest stripe, a yellow dagger. Stands hunched in the shallows for minutes.
function heron() {
  const g = new THREE.Group();
  const grey = M(0x9aa0a6), dark = M(0x6f767e), white = M(0xe0ded6), black = M(0x1b1b1d), yellow = M(0xcfa934);
  // hunched: body level-to-tail-down, wings folded over the flanks
  ellipsoid(g, grey, [0, 0.72, -0.02], [0.12, 0.13, 0.28]).rotation.x = 0.28;
  for (const sd of [-1, 1]) ellipsoid(g, dark, [sd * 0.085, 0.74, -0.04], [0.045, 0.1, 0.27]).rotation.x = 0.28;
  ellipsoid(g, white, [0, 0.72, 0.17], [0.07, 0.09, 0.07]);
  const neck = new THREE.Group();
  neck.position.set(0, 0.8, 0.18);
  // hunched S: neck drawn into the shoulders
  organicTube(neck, white, [[0, -0.04, -0.04], [0, 0.07, 0.04], [0, 0.16, 0.0], [0, 0.23, 0.05]], [0.045, 0.036, 0.03, 0.028]);
  const head = ellipsoid(neck, white, [0, 0.25, 0.07], [0.04, 0.042, 0.07]);
  void head;
  ellipsoid(neck, black, [0, 0.27, 0.03], [0.043, 0.018, 0.08]);       // crest stripe
  organicTube(neck, black, [[0, 0.27, -0.04], [0, 0.26, -0.13]], [0.008, 0.002]);   // plume
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.14, 5), yellow);
  bill.rotation.x = Math.PI / 2 + 0.1; bill.position.set(0, 0.245, 0.17);
  neck.add(bill);
  birdEyes(neck, 0.034, 0.26, 0.09, 0.006);
  g.add(neck);
  for (const sd of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 4), M(0x8e7f55));
    leg.position.set(sd * 0.06, 0.3, 0.02);
    g.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 5), dark);
  tail.rotation.x = -Math.PI / 2 + 0.3; tail.position.set(0, 0.63, -0.28);
  g.add(tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, neck, legs: [] };
}

// Eurasian otter — ūdrs: long, low, dark brown; swims with only the flat
// head and a line of back showing, and slips under for long stretches.
function otter() {
  const g = new THREE.Group();
  const brown = M(0x4a3526), pale = M(0x8f7c62);
  ellipsoid(g, brown, [0, 0, 0], [0.11, 0.09, 0.36]);
  ellipsoid(g, pale, [0, -0.03, 0.2], [0.07, 0.05, 0.12]);
  const neck = new THREE.Group();
  neck.position.set(0, 0.03, 0.33);
  ellipsoid(neck, brown, [0, 0.02, 0.05], [0.07, 0.055, 0.09]);
  ellipsoid(neck, pale, [0, -0.005, 0.1], [0.045, 0.03, 0.05]);
  birdEyes(neck, 0.04, 0.045, 0.1, 0.006);
  g.add(neck);
  organicTube(g, brown, [[0, 0, -0.3], [0, -0.01, -0.5], [0, -0.02, -0.72]], [0.06, 0.035, 0.012]);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, neck, legs: [], wiggle: true };
}

// common kingfisher — zivju dzenis: a cobalt-and-orange spark on a twig
// over the water; straight fast flights low along the river, plunge dives.
function kingfisher() {
  const g = new THREE.Group();
  const blue = M(0x1d86b4), cobalt = M(0x2fb6e8), orange = M(0xd9702a), white = M(0xf2efe6), black = M(0x141414);
  ellipsoid(g, blue, [0, 0.07, 0], [0.032, 0.03, 0.06]);
  ellipsoid(g, orange, [0, 0.058, 0.01], [0.028, 0.025, 0.05]);
  ellipsoid(g, cobalt, [0, 0.085, -0.02], [0.012, 0.01, 0.045]);
  ellipsoid(g, blue, [0, 0.1, 0.045], [0.026, 0.026, 0.03]);
  ellipsoid(g, white, [0, 0.092, 0.066], [0.016, 0.012, 0.01]);
  ellipsoid(g, orange, [0.02, 0.1, 0.05], [0.008, 0.009, 0.014]);
  ellipsoid(g, orange, [-0.02, 0.1, 0.05], [0.008, 0.009, 0.014]);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.05, 4), black);
  bill.rotation.x = Math.PI / 2; bill.position.set(0, 0.098, 0.095);
  g.add(bill);
  birdEyes(g, 0.021, 0.106, 0.058, 0.004);
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.07, -0.05);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.035), blue);
  tail.position.z = -0.017;
  tailPivot.add(tail);
  g.add(tailPivot);
  const wings = [];
  for (const sd of [-1, 1]) {
    // hinged along the body axis: folded it lies on the flank, flapping
    // swings it out and up
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.065), blue);
    w.geometry.translate(sd * 0.012, 0, -0.008);
    w.position.set(sd * 0.022, 0.082, 0);
    w.userData.side = sd;
    g.add(w);
    wings.push(w);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, neck: null, legs: [], wings, tailPivot };
}

// mallard by default; `p` repaints it as another diving or dabbling duck
function duck(male = true, p = {}) {
  const g = new THREE.Group();
  const bodyC = p.body ?? (male ? 0x8d867a : 0x8a7457);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), M(bodyC));
  body.scale.set(0.75, 0.62, 1.25 * (p.long ?? 1));
  body.position.y = 0.02;
  if (p.back) ellipsoid(g, M(p.back), [0, 0.075, -0.03], [0.085, 0.045, 0.16 * (p.long ?? 1)]);
  const breast = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), M(p.breast ?? (male ? 0x5a3a2c : 0x7a6448)));
  breast.position.set(0, 0.03, 0.12);
  const neck = new THREE.Group();
  neck.position.set(0, 0.1, 0.14);
  const headC = p.head ?? (male ? 0x1e5e30 : 0x8a7457);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 10), M(headC));
  head.position.set(0, 0.12, 0.05);
  if (p.puff) head.scale.set(1.05, 1.15, 1.0);
  organicTube(neck, M(p.neck ?? (male ? 0x1e5e30 : bodyC)), [[0,-0.06,-0.02],[0,0.05,0.025],[0,0.12,0.05]], [0.054,0.043,0.038]);
  if (p.crest) organicTube(neck, M(headC), [[0,.15,.03],[0,.14,-.03],[0,.11,-.07]], [.03,.022,.006]);
  if (p.cheek) ellipsoid(neck, M(0xf4f2ec), [0.045, 0.105, 0.085], [0.006, 0.014, 0.012]), ellipsoid(neck, M(0xf4f2ec), [-0.045, 0.105, 0.085], [0.006, 0.014, 0.012]);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.09, 4), M(p.bill ?? 0xc9a028));
  bill.scale.y = 0.55;
  bill.rotation.x = Math.PI / 2;
  bill.position.set(0, 0.11, 0.12);
  neck.add(head, bill);
  bill.geometry.dispose();bill.geometry=new THREE.SphereGeometry(1,16,10);bill.scale.set(p.sawbill?.012:.025,.012,p.sawbill?.058:.049);bill.rotation.set(0,0,0);
  if (p.sawbill) bill.position.z += 0.01;
  birdEyes(neck,.052,.139,.072,.006);
  if(male && !p.noCollar)organicTube(neck,M(0xe8e6dc),[[0,.015,.009],[0,.028,.015]],[.049,.046]);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), M(bodyC));
  tail.scale.y = 0.4;
  tail.rotation.x = -Math.PI / 2 - 0.5;
  tail.position.set(0, 0.06, -0.2);
  g.add(body, breast, neck, tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck };
}

function swan(beakC = 0xd8c030) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), M(0xf4f2ea));
  body.scale.set(0.72, 0.6, 1.25);
  body.position.y = 0.05;
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), M(0xfaf8f2));
    wing.scale.set(0.4, 0.5, 1.0);
    wing.position.set(s * 0.14, 0.14, -0.05);
    g.add(wing);
  }
  const neck = new THREE.Group();
  neck.position.set(0, 0.16, 0.3);
  // the S: base leans back, mid rises, top arches forward and the head
  // tips down — a straight column read as a periscope, not a swan
  organicTube(neck,M(0xf4f2ea),[[0,-.05,-.09],[0,.13,-.01],[0,.30,-.015],[0,.43,-.015],[0,.50,.03]], [.060,.045,.033,.030,.031]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), M(0xf4f2ea));
  head.scale.set(0.85, 0.8, 1.15);
  head.position.set(0, 0.5, 0.03);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), M(beakC));
  beak.rotation.x = Math.PI / 2 + 0.25;      // swans carry the bill tipped down
  beak.position.set(0, 0.485, 0.1);
  neck.add(head, beak);
  birdEyes(neck,.040,.509,.050,.0045);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 5), M(0xf4f2ea));
  tail.scale.y = 0.5;
  tail.rotation.x = -Math.PI / 2 - 0.55;
  tail.position.set(0, 0.12, -0.36);
  g.add(body, neck, tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck };
}

function frog() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10), M(0x5a7a2e));
  body.scale.set(1, 0.75, 1.2);
  body.position.y = 0.04;
  g.add(body);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 10), M(0x314a1c));
    eye.position.set(s * 0.03, 0.085, 0.035);
    g.add(eye);
    ellipsoid(g,M(0x161a0d),[s*.033,.088,.047],[.008,.008,.006]);
    organicTube(g,M(0x526e2e),[[s*.038,.035,-.025],[s*.078,.030,-.060],[s*.050,.014,.010],[s*.085,.006,.030]],[.020,.018,.008,.003]);
    organicTube(g,M(0x526e2e),[[s*.032,.037,.029],[s*.052,.013,.046],[s*.074,.005,.065]],[.011,.007,.002]);
  }
  return { group: g, legs: [], neck: null };
}

function beaver() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), M(0x4a3322));
  body.scale.set(0.75, 0.55, 1.15);
  body.position.y = 0.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), M(0x543a26));
  head.position.set(0, 0.1, 0.26);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(1,16,10), M(0x3a3234));tail.scale.set(.08,.013,.16);
  tail.position.set(0, 0.0, -0.36);
  g.add(body, head, tail);
  birdEyes(g,.091,.136,.299,.012);
  for(const s of [-1,1]){
    ellipsoid(g,M(0x493223),[s*.088,.176,.236],[.027,.030,.020]);
    ellipsoid(g,M(0x3b2c23),[s*.15,-.065,-.06],[.04,.023,.08]);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck: null };
}

// --- the air -------------------------------------------------------------------
function butterfly(color) {
  const g=new THREE.Group(),wings=[],mat=new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide});
  for(const s of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(0,.020);
    shape.bezierCurveTo(s*.025,.064,s*.073,.080,s*.073,.038);
    shape.bezierCurveTo(s*.085,.008,s*.052,-.003,s*.041,-.006);
    shape.bezierCurveTo(s*.073,-.033,s*.029,-.063,s*.014,-.028);
    shape.lineTo(0,-.020);shape.closePath();
    const geo=new THREE.ShapeGeometry(shape,14);geo.rotateX(-Math.PI/2);
    const w=new THREE.Mesh(geo,mat);w.userData.side=s;g.add(w);wings.push(w);
    for(const [x,z,r] of [[.052,-.035,.009],[.047,-.015,.004],[.029,.029,.006]]){
      const spot=new THREE.Mesh(new THREE.CircleGeometry(r,12),new THREE.MeshLambertMaterial({color:0x343027,side:THREE.DoubleSide}));
      spot.rotation.x=-Math.PI/2;spot.position.set(s*x,.0005,z);w.add(spot);
    }
  }
  ellipsoid(g,M(0x29241c),[0,0,0],[.006,.005,.035]);
  for(const s of [-1,1])organicTube(g,M(0x29241c),[[s*.003,0,.027],[s*.01,.005,.045],[s*.015,.009,.047]],[.001,.0008,.0005]);
  return {group:g,legs:[],neck:null,wings,flapAxis:'z'};
}

function dragonfly() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.24, 4), M(0x2a6a8a));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wMat = new THREE.MeshLambertMaterial({ color: 0xdce8ec, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const wings = [];
  for (const [s, dz] of [[-1, 0.03], [1, 0.03], [-1, -0.03], [1, -0.03]]) {
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(s*.05,.025,s*.15,.027,s*.155,.008);shape.bezierCurveTo(s*.14,-.01,s*.035,-.013,0,0);
    const w = new THREE.Mesh(new THREE.ShapeGeometry(shape,12), wMat);
    w.position.set(0, 0.008, dz);
    w.rotation.x = -Math.PI / 2;
    g.add(w);
    wings.push(w);
  }
  return { group: g, legs: [], neck: null, wings, flapAxis: 'y' };
}

function swallow() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), M(0x1c2430));
  body.scale.set(0.75, 0.7, 1.5);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 10), M(0xe8e2d4));
  bl.position.set(0, -0.02, 0.02);
  g.add(body, bl);
  const wings = [];
  const wMat = M(0x1c2430);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wingGeometry(.19,.05,s,true), wMat);
    w.material.side = THREE.DoubleSide;
    // lay the wing flat in the GEOMETRY, not in the mesh Euler: with
    // rotation.x baked in the mesh, three's XYZ order applies the flap about
    // z FIRST, so the beat swept the wings fore-and-aft instead of up-down
    w.userData.side = s;
    g.add(w);
    wings.push(w);
  }
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.09), wMat);
    t.rotation.x = -Math.PI / 2;
    t.position.set(s * 0.015, 0, -0.11);
    g.add(t);
  }
  return { group: g, legs: [], neck: null, wings, flapAxis: 'z' };
}

function craneBird() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), M(0xb5b3ac));
  body.scale.set(0.55, 0.5, 1.2);
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.55, 5), M(0xb5b3ac));
  neckM.rotation.x = Math.PI / 2;
  neckM.position.set(0, 0.02, 0.55);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10), M(0x8a8880));
  head.position.set(0, 0.02, 0.85);
  const legsM = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 4), M(0x3a3430));
  legsM.rotation.x = Math.PI / 2;
  legsM.position.set(0, -0.05, -0.55);
  g.add(body, neckM, head, legsM);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wingGeometry(.88,.30,s), M(0xa8a69e));
    w.material.side = THREE.DoubleSide;
    w.userData.side = s;
    // the dark primaries pivot at the SHOULDER with their wing — pivoting on
    // their own centre tore the tip off the wing on every beat
    const tip = new THREE.Mesh(wingGeometry(.28,.26,s), M(0x2e2c28));
    tip.material.side = THREE.DoubleSide;
    tip.geometry.translate(s * 0.60, 0.001, -.015);
    tip.userData.side = s;
    g.add(w, tip);
    wings.push(w);
    wings.push(tip);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck: null, wings, flapAxis: 'z' };
}

function buzzard() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), M(0x4a3826));
  body.scale.set(0.7, 0.55, 1.3);
  g.add(body);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wingGeometry(.52,.19,s), M(0x54402c));
    w.material.side = THREE.DoubleSide;
    w.userData.side = s;
    w.userData.dihedral = s * 0.12;              // slight soaring dihedral —
    w.rotation.z = w.userData.dihedral;          // flap() preserves it now
    g.add(w);
    wings.push(w);
  }
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), M(0x54402c));
  tail.material.side = THREE.DoubleSide;
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0, -0.2);
  g.add(tail);
  return { group: g, legs: [], neck: null, wings, flapAxis: 'z' };
}

// --- species presets ---------------------------------------------------------
export const SPECIES = {
  aurochsBull: () => quadruped({
    shoulder: 1.75, length: 3.0, width: 0.95, legR: 0.1, color: 0x1d1712,
    belly: 0x2a221a, maneColor: null, neckLen: 0.55, headSize: 0.45,
    horns: { len: 0.85, r: 0.05, spread: 0.9, fwd: 0.25 },
    // the pale eel-stripe the header always promised the bulls
    dorsalStripeColor: 0xb8a888,
  }),
  aurochsCow: () => quadruped({
    shoulder: 1.5, length: 2.6, width: 0.8, legR: 0.09, color: 0x5c3a24,
    neckLen: 0.5, headSize: 0.4, horns: { len: 0.6, r: 0.04, spread: 0.85, fwd: 0.2 },
  }),
  cattleIron: () => quadruped({
    shoulder: 1.05, length: 1.8, width: 0.55, legR: 0.06,
    color: [0x4a3526, 0x6b4a33, 0x2e261e][(rng() * 3) | 0],
    neckLen: 0.4, headSize: 0.3, horns: { len: 0.3, r: 0.03, spread: 0.7, fwd: 0.1 },
  }),
  cattleFarm: () => quadruped({
    shoulder: 1.25, length: 2.1, width: 0.62, legR: 0.07, color: 0x7a4a2c,
    belly: 0x8a5a38, neckLen: 0.45, headSize: 0.34, horns: { len: 0.26, r: 0.026, spread: 0.75, fwd: 0.08 },
  }),
  sheepDark: () => quadruped({
    family: 'sheep',
    shoulder: 0.6, length: 0.95, width: 0.42, legR: 0.035,
    color: [0x4d4238, 0x6e6055, 0x8c8175][(rng() * 3) | 0],
    headColor: 0x3a2f26, neckLen: 0.16, headSize: 0.17, tail: 0.15,
  }),
  sheepWhite: () => quadruped({
    family: 'sheep',
    shoulder: 0.68, length: 1.05, width: 0.48, legR: 0.035, color: 0xd6cfbe,
    headColor: 0x4a4038, neckLen: 0.18, headSize: 0.18, tail: 0.2,
  }),
  horseTarpan: () => quadruped({
    shoulder: 1.3, length: 2.0, width: 0.5, legR: 0.055, color: 0x8a7a5c,
    maneColor: 0x2e2820, neckLen: 0.62, headSize: 0.3, tail: 0.7, ears: true,
    horse: true,
  }),
  horseBay: () => quadruped({
    shoulder: 1.55, length: 2.3, width: 0.58, legR: 0.06, color: 0x5a3a24,
    maneColor: 0x201812, neckLen: 0.7, headSize: 0.33, tail: 0.8,
    horse: true,
  }),
  horseKonik: () => quadruped({
    shoulder: 1.43, length: 2.12, width: 0.56, legR: 0.06, color: 0x85807a,
    maneColor: 0x181513, neckLen: 0.64, headSize: 0.3, tail: 0.74,
    horse: true, legColor: 0x383330, tailColor: 0x181513,
    tasselColor: 0x181513, dorsalStripeColor: 0x24201e,
  }),
  pig: () => quadruped({
    family: 'pig',
    shoulder: 0.62, length: 1.2, width: 0.44, legR: 0.04, color: 0x3d3229,
    neckLen: 0.1, headSize: 0.24, ears: true, tail: 0.12,
  }),
  elk: () => quadruped({
    family: 'elk',
    shoulder: 1.9, length: 2.7, width: 0.7, legR: 0.08, color: 0x4d4136,
    belly: 0x5c5044, neckLen: 0.5, headSize: 0.44, tail: 0.1,
    horns: { len: 0.7, r: 0.045, spread: 1.15, fwd: -0.1, palmate: true },
  }),
  reindeer: () => quadruped({
    family: 'deer',
    shoulder: 1.1, length: 1.8, width: 0.5, legR: 0.05,
    color: [0x8a8378, 0x9a938a, 0x7a7268][(rng() * 3) | 0],
    belly: 0xb5afa4, headColor: 0x6e675e, neckLen: 0.42, headSize: 0.28, tail: 0.12,
    horns: { len: 0.62, r: 0.028, spread: 0.55, fwd: -0.3 }, // swept-back branched antlers (both sexes)
  }),
  chicken: () => fowl({ size: 0.16, color: [0xc8b490, 0x8a5a30, 0xd8d3c4][(rng() * 3) | 0] }),
  rooster: () => fowl({ size: 0.19, color: 0x8a3820, comb: true }),
  goose: () => fowl({ size: 0.3, color: 0xe6e2d6, neckLen: 0.3 }),
  stork: () => stork(),
  // wild ungulates & ground game
  roeDeer: () => quadruped({
    family: 'deer',
    shoulder: 0.76, length: 1.1, width: 0.33, legR: 0.028, color: 0xa5713f,
    belly: 0xc9a06a, neckLen: 0.36, headSize: 0.2, tail: 0.05, tailR: 0.012,
  }),
  roeBuck: () => quadruped({
    family: 'deer',
    shoulder: 0.8, length: 1.15, width: 0.35, legR: 0.03, color: 0x9a6838,
    belly: 0xc9a06a, neckLen: 0.38, headSize: 0.21, tail: 0.05, tailR: 0.012,
    horns: { len: 0.16, r: 0.012, spread: 0.35, fwd: 0.05 },
  }),
  redDeer: () => quadruped({
    family: 'deer',
    shoulder: 1.35, length: 2.05, width: 0.55, legR: 0.055, color: 0x8a5a34,
    belly: 0xa07048, neckLen: 0.55, headSize: 0.32, tail: 0.12, tailR: 0.015,
    horns: { len: 0.72, r: 0.03, spread: 0.7, fwd: -0.35 },
  }),
  boar: () => quadruped({
    family: 'pig',
    shoulder: 0.85, length: 1.45, width: 0.5, legR: 0.05, color: 0x3a2e24,
    maneColor: 0x241c14, neckLen: 0.14, headSize: 0.34, tail: 0.18, tailR: 0.012,
    tusks: true,
  }),
  fox: () => quadruped({
    family: 'canine',
    shoulder: 0.38, length: 0.62, width: 0.2, legR: 0.018, color: 0xb4562a,
    belly: 0xe8dcc8, neckLen: 0.2, headSize: 0.15, tail: 0.42, tailR: 0.05,
    tasselColor: 0xf2ede2,
  }),
  arcticFox: () => quadruped({
    family: 'canine',
    shoulder: 0.32, length: 0.55, width: 0.19, legR: 0.017, color: 0xeceae4,
    neckLen: 0.16, headSize: 0.13, tail: 0.34, tailR: 0.048, tasselColor: 0xffffff,
  }),
  hare: () => hare(),
  arcticHare: () => hare(0xf0efe8, 0xffffff),
  squirrel: () => squirrel(),
  ptarmigan: () => fowl({ size: 0.14, color: 0xf2f2ee }),
  // water
  fishPerch: () => fish({ len: 0.34, color: 0x4a5a3c }),
  fishPike: () => fish({ len: 0.72, color: 0x39503c, belly: 0xa8b49a, pike:true }),
  duckM: () => duck(true),
  // goosander — lielā gaura: the Gauja's own sawbill, nesting in bankside trees
  duckGoosanderM: () => duck(true, { body: 0xeee6dc, breast: 0xf0e8de, back: 0x1b1c1e, head: 0x143a28, neck: 0x143a28, bill: 0xb02a1c, sawbill: true, long: 1.2, noCollar: true }),
  duckGoosanderF: () => duck(false, { body: 0x979ca2, breast: 0xd6d4ce, head: 0x8c3c1c, neck: 0x8c3c1c, bill: 0xa83020, sawbill: true, long: 1.15, crest: true }),
  // goldeneye — gaigala: the lake diver with the white cheek spot
  duckGoldeneyeM: () => duck(true, { body: 0xf0eee8, breast: 0xf2f0ea, back: 0x18191b, head: 0x10221a, neck: 0x10221a, bill: 0x1a1a1a, puff: true, cheek: true, noCollar: true }),
  duckGoldeneyeF: () => duck(false, { body: 0x8c9094, breast: 0xc8c6c0, head: 0x5c3a22, neck: 0x5c3a22, bill: 0x2a2622, puff: true }),
  // Gauja fish, after the Latvian freshwater list
  roach: () => fish({ len: 0.2, color: 0x44524c, belly: 0xc2c6be, fin: 0xb4442c }),            // rauda
  grayling: () => fish({ len: 0.36, color: 0x5d646c, belly: 0xb4b2a8, sail: true }),         // alata
  bream: () => fish({ len: 0.46, color: 0x6e5c38, belly: 0xb09c6c, deep: 1.55, fin: 0x4e4630 }), // plaudis
  troutBrown: () => fish({ len: 0.28, color: 0x5e5634, belly: 0xcdb98c, fin: 0x6a6040 }),    // strauta forele
  roachShoal: () => fishShoal('roach', 9, 1.8),
  breamShoal: () => fishShoal('bream', 5, 2.2),
  heron: () => heron(),
  otter: () => otter(),
  kingfisher: () => kingfisher(),
  duckF: () => duck(false),
  swanWhooper: () => swan(0xd8c030),   // Cygnus cygnus — the native breeder
  swanMute: () => swan(0xd07828),      // Cygnus olor — 20th-century colonist
  wolf: () => quadruped({
    family: 'canine',
    shoulder: 0.78, length: 1.25, width: 0.34, legR: 0.036, color: 0x6e675c,
    belly: 0x9a927f, neckLen: 0.32, headSize: 0.24, tail: 0.42, tailR: 0.035,
    tasselColor: 0x4a443a,
  }),
  blackGrouse: () => fowl({ size: 0.24, color: 0x23242c, grouse: true }),
  frog: () => frog(),
  beaver: () => beaver(),
  // air
  butterflyW: () => butterfly(0xf2f0e2),
  butterflyO: () => butterfly(0xd07818),
  butterflyY: () => butterfly(0xe8d84a),
  dragonfly: () => dragonfly(),
  swallow: () => swallow(),
  crane: () => craneBird(),
  buzzard: () => buzzard(),
  wagtail: () => wagtail(),
  bee: () => bumblebee(),
};

// bake a species into ONE vertex-coloured geometry for background statics —
// the paddock grazers were primitive box assemblies ("a super square cow");
// now they are the real animals, frozen mid-graze, cheap to instance.
export function bakeSpeciesGeometry(kind, { grazing = true } = {}) {
  const a = SPECIES[kind]();
  if (grazing && a.neck && a.neck.rotation) a.neck.rotation.x = 0.72;
  a.group.updateMatrixWorld(true);
  const pos = [], nrm = [], col = [];
  const v = new THREE.Vector3();
  const nmx = new THREE.Matrix3();
  a.group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const p = g.getAttribute('position'), nn = g.getAttribute('normal');
    nmx.getNormalMatrix(o.matrixWorld);
    const c = o.material.color;
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(o.matrixWorld);
      pos.push(v.x, v.y, v.z);
      v.set(nn.getX(i), nn.getY(i), nn.getZ(i)).applyMatrix3(nmx).normalize();
      nrm.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

// --- behaviour ----------------------------------------------------------------
const TAU = Math.PI * 2;
const HERD_PROFILES = {
  sheepDark: { radius: 16, spacing: 1.7 },
  sheepWhite: { radius: 16, spacing: 1.8 },
  cattleIron: { radius: 24, spacing: 2.5 },
  cattleFarm: { radius: 26, spacing: 2.7 },
  horseKonik: { radius: 30, spacing: 2.8 },
  reindeer: { radius: 55, spacing: 2.4 },
};

function turnRateFor(kind) {
  if (kind.startsWith('aurochs')) return 0.55;
  if (kind.startsWith('cattle')) return 0.65;
  if (kind.startsWith('horse')) return 0.82;
  if (kind.startsWith('sheep')) return 1.05;
  if (kind === 'reindeer' || kind === 'elk') return 0.9;
  if (kind.includes('Deer') || kind === 'roeBuck') return 1.3;
  if (kind === 'hare' || kind === 'arcticHare') return 4.5;
  if (kind === 'frog') return 5.2;
  if (kind === 'wolf' || kind === 'fox' || kind === 'arcticFox') return 1.8;
  if (kind === 'chicken' || kind === 'rooster' || kind === 'goose') return 2.4;
  return 1.35;
}

function angleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export class AnimalManager {
  constructor() {
    this.animals = [];
    this.herds = [];
    this.group = new THREE.Group();
    this.group.name = 'animals';
  }

  spawn(kind, home, opts = {}) {
    const a = SPECIES[kind]();
    const angle = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * home.r;
    let x = home.x + Math.cos(angle) * r, z = home.z + Math.sin(angle) * r;
    // water dwellers must START in water, not on the bank
    if (opts.inWater) {
      for (let tries = 0; tries < 24 && !opts.inWater(x, z); tries++) {
        const a2 = rng() * Math.PI * 2, r2 = Math.sqrt(rng()) * home.r;
        x = home.x + Math.cos(a2) * r2; z = home.z + Math.sin(a2) * r2;
      }
      if (!opts.inWater(x, z)) { x = home.x; z = home.z; }
    }
    const medium = opts.medium || 'land';
    const y = medium === 'water' ? (opts.wade ? meshHeightAt(x, z)
        : opts.levelFn ? opts.levelFn(x, z) - (opts.depth ?? 0) : (opts.level ?? heightAt(x, z)))
      : medium === 'air' ? meshHeightAt(x, z) + (opts.alt ? (opts.alt[0] + opts.alt[1]) / 2 : 8)
      : meshHeightAt(x, z);
    a.group.position.set(x, y, z);
    a.group.rotation.y = rng() * Math.PI * 2;
    a.group.name = kind;
    const rec = {
      ...a, kind, home, medium,
      homeY: opts.fly === 'soar' ? meshHeightAt(home.x, home.z) : null,
      speed: opts.speed ?? (kind.startsWith('chicken') || kind === 'rooster' ? 0.8 : kind === 'goose' ? 0.7 : 0.55),
      state: 'graze', timer: 1 + rng() * 5, tx: x, tz: z, heading: a.group.rotation.y,
      grazeBias: opts.grazeBias ?? (kind === 'pig' ? 0.85 : 0.68),
      static: opts.static ?? false, phase: rng() * 10,
      fly: opts.fly || null, level: opts.level, inWater: opts.inWater || null,
      hop: opts.hop || false, alt: opts.alt || [4, 16],
      low: opts.low || false, perches: opts.perches || null, pt: null,
      vx: 0, vz: 0, soarA: rng() * Math.PI * 2, soarR: 45 + rng() * 45,
      hopT: -1, wingP: rng() * Math.PI * 2,
      hopLen: opts.hopLen ?? 0.5, hopH: opts.hopH ?? 0.12,
      hopDur: opts.hopDur ?? 0.32, restT: opts.restT ?? [2, 6], chainT: opts.chainT ?? 0.15,
      turnRate: opts.turnRate ?? turnRateFor(kind), visualHeading: a.group.rotation.y,
      moveSpeed: 0, gaitP: 0, fleeing: false,
      waterfowl: kind.startsWith('duck') || kind.startsWith('swan'),
      // local water instead of a spawn-time constant (the Gauja falls 18 m
      // across the parish; the mill pond stands 1.2 m over its reach)
      levelFn: opts.levelFn || null, depth: opts.depth ?? null, wade: opts.wade || false,
      diver: opts.diver || false, idleT: opts.idleT ?? 1, noGround: opts.noGround || false, dives: opts.dives || false,
      herd: null, herdIndex: -1,
    };
    rec.gaitP = rec.phase;
    const profile = HERD_PROFILES[kind];
    if (profile) {
      let herd = null;
      for (let i = 0; i < this.herds.length; i++) {
        if (this.herds[i].kind === kind && this.herds[i].home === home) { herd = this.herds[i]; break; }
      }
      if (!herd) {
        herd = { kind, home, profile, members: [], cx: x, cz: z, phase: rec.phase };
        this.herds.push(herd);
      }
      rec.herd = herd;
      rec.herdIndex = herd.members.length;
      herd.members.push(rec);
    }
    this.animals.push(rec);
    this.group.add(a.group);
    return rec;
  }

  clear() {
    const geometries = new Set(), materials = new Set();
    for (const a of this.animals) {
      a.group.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (Array.isArray(o.material)) o.material.forEach((m) => materials.add(m));
        else if (o.material) materials.add(o.material);
      });
      this.group.remove(a.group);
    }
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.animals.length = 0;
    this.herds.length = 0;
  }

  updateHerds() {
    for (let hi = 0; hi < this.herds.length; hi++) {
      const herd = this.herds[hi];
      let x = 0, z = 0;
      for (let i = 0; i < herd.members.length; i++) {
        x += herd.members[i].group.position.x;
        z += herd.members[i].group.position.z;
      }
      const n = herd.members.length || 1;
      herd.cx = x / n;
      herd.cz = z / n;
    }
  }

  // shared wing flap
  flap(a, t, speed, amp, rest = 0) {
    if (!a.wings) return;
    const v = rest + Math.sin(t * speed + a.wingP) * amp;
    a.wings.forEach((w, i) => {
      // the wing's own side, not its index: the crane pushes [wing, tip] per
      // side, so index parity flapped the two wings the SAME way and each
      // black tip against its own wing
      const s = w.userData.side !== undefined ? w.userData.side : (i % 2 === 0 ? 1 : -1);
      if (a.flapAxis === 'y') w.rotation.y = s * v * 0.4;
      else w.rotation.z = s * v + (w.userData.dihedral || 0);
    });
  }

  tickWater(a, t, dt) {
    a.timer -= dt;
    if (a.timer <= 0) {
      if (a.state !== 'swim' && rng() > 0.4) {
        // pick a target that stays in the water
        for (let tries = 0; tries < 12; tries++) {
          const ang = rng() * Math.PI * 2, r = Math.sqrt(rng()) * a.home.r;
          const tx = a.home.x + Math.cos(ang) * r, tz = a.home.z + Math.sin(ang) * r;
          if (!a.inWater || a.inWater(tx, tz)) { a.tx = tx; a.tz = tz; a.state = 'swim'; a.timer = 40; break; }
        }
        if (a.state !== 'swim') { a.state = 'idle'; a.timer = 2 + rng() * 4; }
      } else {
        a.state = 'idle';
        a.timer = ((a.wiggle ? 1 : 3) + rng() * 5) * a.idleT;
        // otters slip under for a while between surfacings
        if (a.diver && rng() < 0.45) { a.state = 'dive'; a.timer = 6 + rng() * 10; }
      }
    }
    const g = a.group;
    if (a.anim) a.anim(t);
    if (a.state === 'swim') {
      const dx = a.tx - g.position.x, dz = a.tz - g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.6) { a.state = 'idle'; a.timer = 1.5 + rng() * 4; }
      else {
        const want = Math.atan2(dx, dz);
        const da = angleDelta(a.heading, want);
        a.heading += clamp(da, -1.2 * dt, 1.2 * dt);
        // fish put on occasional darts; ducks paddle steadily
        const dart = a.wiggle && Math.sin(t * 0.23 + a.phase * 3) > 0.94 ? 3.4 : 1;
        const arrive = clamp((dist - 0.6) / 2.4, 0, 1);
        const desiredSpeed = a.speed * dart * arrive;
        a.moveSpeed += clamp(desiredSpeed - a.moveSpeed, -1.1 * dt, 0.8 * dt);
        const nx = g.position.x + Math.sin(a.heading) * a.moveSpeed * dt;
        const nz = g.position.z + Math.cos(a.heading) * a.moveSpeed * dt;
        // a straight chord between two in-water targets can cut a meander
        // bank — never take a step onto dry land, retarget instead
        if (!a.inWater || a.inWater(nx, nz)) {
          g.position.x = nx; g.position.z = nz;
        } else {
          a.state = 'idle'; a.timer = 0.4 + rng();
        }
      }
    } else {
      a.moveSpeed = Math.max(0, a.moveSpeed - 1.1 * dt);
    }
    if (a.levelFn) {
      const L = a.levelFn(g.position.x, g.position.z);
      if (Number.isFinite(L)) a.level = L;
    }
    if (a.wade) {
      // standing in the shallows: feet on the bed, and the heron's stab
      g.position.y = meshHeightAt(g.position.x, g.position.z);
      if (a.neck && a.state === 'idle') {
        const strike = Math.sin(t * 0.37 + a.phase * 5);
        a.neck.rotation.x = strike > 0.985 ? 1.1 : strike > 0.9 ? -0.15 : 0.05 * Math.sin(t * 0.5 + a.phase);
      } else if (a.neck) a.neck.rotation.x = 0.12;
    } else if (a.depth !== null) {
      // fish ride below the surface but never through the bed
      const floor = meshHeightAt(g.position.x, g.position.z) + 0.12;
      const y = a.level - a.depth + Math.sin(t * 1.3 + a.phase) * 0.05;
      g.position.y = Math.max(y, Math.min(floor, a.level - 0.08));
    } else {
      // stay at the waterline (fish ride a little under it); a diving
      // otter is a shadow half a metre down
      const dive = a.state === 'dive' ? -0.55 : 0;
      g.position.y = a.level + dive + Math.sin(t * (a.wiggle ? 1.3 : 0.7) + a.phase) * (a.wiggle ? 0.06 : 0.015);
    }
    if (a.wade) { a.visualHeading = a.heading; g.rotation.y = a.heading; return; }
    if (a.waterfowl) {
      const da = angleDelta(a.visualHeading, a.heading);
      a.visualHeading += clamp(da, -0.72 * dt, 0.72 * dt);
      g.rotation.y = a.visualHeading;
    } else {
      a.visualHeading = a.heading;
      g.rotation.y = a.heading + (a.wiggle ? Math.sin(t * 7 + a.phase) * 0.12 : 0);
    }
    if (a.neck && !a.wiggle) {
      // Dabbling waterfowl tip tail-up briefly; their visible yaw also lags
      // the swimming heading, as a floating body has some rotational drag.
      const dabble = a.waterfowl && Math.sin(t * 0.4 + a.phase) > 0.88;
      a.neck.rotation.x = dabble ? 0.95 : Math.sin(t * 0.8 + a.phase) * 0.08;
      const tip = dabble ? (a.kind.startsWith('swan') ? 0.28 : 0.4) : 0;
      g.rotation.x = lerp(g.rotation.x, tip, clamp(dt * 4, 0, 1));
    }
  }

  tickHop(a, t, dt, camPos) {
    const g = a.group;
    if (camPos) {
      const cx = g.position.x - camPos.x, cz = g.position.z - camPos.z;
      const d2 = cx * cx + cz * cz;
      const cameraLow = camPos.y - meshHeightAt(camPos.x, camPos.z) < 4.5;
      if (cameraLow && d2 < 12 * 12) {
        const d = Math.sqrt(d2) || 1;
        const ax = d2 > 0.001 ? cx / d : Math.sin(a.phase);
        const az = d2 > 0.001 ? cz / d : Math.cos(a.phase);
        a.tx = g.position.x + ax * 18;
        a.tz = g.position.z + az * 18;
        a.state = 'move';
        a.timer = 0;
        a.fleeing = true;
      } else if (a.fleeing && d2 > 18 * 18) {
        a.fleeing = false;
      }
    }
    if (a.hopT >= 0) {
      // mid-hop: parabolic arc toward the target
      const hopDur = a.fleeing ? a.hopDur * 0.72 : a.hopDur;
      a.hopT += dt / hopDur;
      const k = Math.min(1, a.hopT);
      g.position.x += Math.sin(a.heading) * a.hopLen * dt / hopDur;
      g.position.z += Math.cos(a.heading) * a.hopLen * dt / hopDur;
      g.position.y = meshHeightAt(g.position.x, g.position.z) + a.hopH * 4 * k * (1 - k);
      const turn = angleDelta(a.visualHeading, a.heading);
      a.visualHeading += clamp(turn, -a.turnRate * dt, a.turnRate * dt);
      g.rotation.y = a.visualHeading;
      if (a.hopT >= 1) {
        a.hopT = -1;
        g.position.y = meshHeightAt(g.position.x, g.position.z);
        const dx = a.tx - g.position.x, dz = a.tz - g.position.z;
        if (Math.hypot(dx, dz) < a.hopLen || (!a.fleeing && rng() < 0.12)) { a.state = 'idle'; a.timer = a.restT[0] + rng() * a.restT[1]; }
        else a.timer = a.chainT;
      }
      return;
    }
    a.timer -= dt;
    if (a.timer > 0) return;
    if (a.state === 'idle' || Math.hypot(a.tx - g.position.x, a.tz - g.position.z) < a.hopLen) {
      const ang = rng() * Math.PI * 2, r = Math.sqrt(rng()) * a.home.r;
      a.tx = a.home.x + Math.cos(ang) * r;
      a.tz = a.home.z + Math.sin(ang) * r;
      a.state = 'move';
    }
    const want = Math.atan2(a.tx - g.position.x, a.tz - g.position.z);
    a.heading = want + (rng() - 0.5) * 0.4;
    a.hopT = 0;
  }

  tickAir(a, t, dt) {
    const g = a.group;
    if (a.fly === 'flutter') {
      // erratic wander around the home meadow, low over the flowers —
      // with a guaranteed drift (pure zero-mean noise left them hovering)
      if (Math.hypot(a.vx, a.vz) < 0.45) {
        const th = a.phase + t * 0.13;
        a.vx += Math.cos(th) * 0.5; a.vz += Math.sin(th) * 0.5;
      }
      a.vx += (rng() - 0.5) * 8 * dt; a.vz += (rng() - 0.5) * 8 * dt;
      const hx = a.home.x - g.position.x, hz = a.home.z - g.position.z;
      const hd = Math.hypot(hx, hz);
      if (hd > a.home.r) { a.vx += (hx / hd) * 2.4 * dt * 30; a.vz += (hz / hd) * 2.4 * dt * 30; }
      const sp = Math.hypot(a.vx, a.vz) || 1;
      const max = 1.5;
      if (sp > max) { a.vx *= max / sp; a.vz *= max / sp; }
      g.position.x += a.vx * dt;
      g.position.z += a.vz * dt;
      const ground = meshHeightAt(g.position.x, g.position.z);
      // bees work the flower layer, ankle-height; butterflies ride higher
      const wantY = a.low
        ? ground + 0.18 + (Math.sin(t * 0.9 + a.phase) + 1) * 0.3
        : ground + 0.5 + (Math.sin(t * 0.7 + a.phase) + 1) * 0.7 + Math.sin(t * 3.1 + a.phase * 2) * 0.15;
      g.position.y += clamp(wantY - g.position.y, -1.2 * dt, 1.2 * dt);
      g.rotation.y = Math.atan2(a.vx, a.vz);
      this.flap(a, t, a.low ? 70 : 24, a.low ? 0.5 : 1.05);
    } else if (a.fly === 'hawk') {
      // swallow: fast sweeping curves over meadow and water
      const oldHeading = a.heading;
      a.heading += (Math.sin(t * 0.8 + a.phase) + Math.sin(t * 0.31 + a.phase * 2) * 0.7) * 1.6 * dt;
      const hx = a.home.x - g.position.x, hz = a.home.z - g.position.z;
      const hd = Math.hypot(hx, hz);
      if (hd > a.home.r) {
        const want = Math.atan2(hx, hz);
        let da = want - a.heading;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        a.heading += clamp(da, -2.2 * dt, 2.2 * dt);
      }
      const sp = 9 + Math.sin(t * 0.5 + a.phase) * 2;
      g.position.x += Math.sin(a.heading) * sp * dt;
      g.position.z += Math.cos(a.heading) * sp * dt;
      const ground = meshHeightAt(g.position.x, g.position.z);
      const wantY = ground + a.alt[0] + (Math.sin(t * 0.42 + a.phase) + 1) * 0.5 * (a.alt[1] - a.alt[0]);
      g.position.y += clamp(wantY - g.position.y, -6 * dt, 6 * dt);
      g.rotation.y = a.heading;
      const yawRate = angleDelta(oldHeading, a.heading) / Math.max(dt, 0.001);
      const bank = clamp(-yawRate * 0.34, -0.75, 0.75);
      g.rotation.z += clamp(bank - g.rotation.z, -3.2 * dt, 3.2 * dt);
      const gliding = Math.sin(t * 0.9 + a.phase * 3) > 0.2;
      this.flap(a, t, 16, gliding ? 0.06 : 0.6);
    } else if (a.fly === 'soar') {
      // buzzard: circling a thermal, wings held still
      const oldYaw = g.rotation.y;
      a.soarA += (7 / a.soarR) * dt * (a.phase > 5 ? 1 : -1);
      a.soarR += Math.sin(t * 0.05 + a.phase) * 0.6 * dt * 10;
      a.soarR = clamp(a.soarR, 35, 110);
      g.position.x = a.home.x + Math.cos(a.soarA) * a.soarR;
      g.position.z = a.home.z + Math.sin(a.soarA) * a.soarR;
      g.position.y = a.homeY + a.alt[0] + (Math.sin(t * 0.04 + a.phase) + 1) * 0.5 * (a.alt[1] - a.alt[0]);
      g.rotation.y = -a.soarA + (a.phase > 5 ? 0 : Math.PI);
      const yawRate = angleDelta(oldYaw, g.rotation.y) / Math.max(dt, 0.001);
      const bank = clamp(-yawRate * 1.4, -0.42, 0.42);
      g.rotation.z += clamp(bank - g.rotation.z, -1.5 * dt, 1.5 * dt);
      this.flap(a, t, 3, Math.sin(t * 0.11 + a.phase) > 0.9 ? 0.4 : 0.02);
    } else if (a.fly === 'perch') {
      // wagtail life: bound-flight to a perch, sit and WAG, drop to the
      // grass to forage, flit to the next post. States: pfly / perched / forage
      if (!a.state || a.state === 'graze') { a.state = 'pfly'; a.pt = a.perches[(rng() * a.perches.length) | 0]; }
      if (a.state === 'pfly') {
        const dx = a.pt[0] - g.position.x, dy = a.pt[1] - g.position.y, dz = a.pt[2] - g.position.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < 0.25 && a.pt[3] === 'plunge') {
          a.pt = a.home2 || a.perches[(rng() * a.perches.length) | 0];   // back to the twig
        } else if (d < 0.25) {
          g.position.set(a.pt[0], a.pt[1], a.pt[2]);
          a.state = a.pt[3] === 'ground' ? 'forage' : 'perched';
          a.timer = a.state === 'perched' ? 4 + rng() * 9 : 3 + rng() * 4;
        } else {
          const sp = Math.min(a.noGround ? 8.5 : 5.5, d * 2.2 + 1.2);
          g.position.x += (dx / d) * sp * dt;
          g.position.z += (dz / d) * sp * dt;
          // undulating bound flight: climb on flaps, dip on folds
          const bound = a.noGround ? 0.5 : Math.sin(t * 5.5 + a.phase * 3);
          g.position.y += ((dy / d) * sp + (a.noGround ? 0 : bound * 0.9)) * dt;
          g.rotation.y = Math.atan2(dx, dz);
          this.flap(a, t, bound > -0.2 ? 30 : 4, bound > -0.2 ? 0.8 : 0.08);
        }
      } else if (a.state === 'perched') {
        a.timer -= dt;
        this.flap(a, t, 0, 0);          // wings folded
        // THE wag: bursts of tail bobbing, a small head-turn between them
        if (a.tailPivot) {
          const burst = Math.sin(t * 0.6 + a.phase) > 0.1 ? 1 : 0.15;
          a.tailPivot.rotation.x = Math.sin(t * 8.5 + a.phase) * 0.4 * burst;
        }
        g.rotation.y += Math.sin(t * 0.4 + a.phase * 2) > 0.94 ? 1.4 * dt : 0;
        if (a.timer <= 0 && a.dives && rng() < 0.4) {
          // plunge: straight down-and-out to the water, then back up
          const hx = Math.sin(g.rotation.y), hz = Math.cos(g.rotation.y);
          a.home2 = a.pt;
          a.pt = [g.position.x + hx * 1.6, (a.levelFn ? a.levelFn(g.position.x + hx * 1.6, g.position.z + hz * 1.6) : g.position.y - 0.8) - 0.05, g.position.z + hz * 1.6, 'plunge'];
          a.state = 'pfly';
        } else if (a.timer <= 0) {
          a.state = 'pfly';
          const ground = !a.noGround && rng() < 0.4;
          if (ground) {
            const ang = rng() * Math.PI * 2, r = 2 + rng() * 5;
            const gx = g.position.x + Math.cos(ang) * r, gz = g.position.z + Math.sin(ang) * r;
            a.pt = [gx, meshHeightAt(gx, gz) + 0.03, gz, 'ground'];
          } else {
            a.pt = a.perches[(rng() * a.perches.length) | 0];
          }
        }
      } else if (a.state === 'forage') {
        a.timer -= dt;
        this.flap(a, t, 0, 0);
        // quick runs and stops, tail going the whole time
        const running = Math.sin(t * 1.7 + a.phase * 4) > 0.2;
        if (running) {
          g.position.x += Math.sin(g.rotation.y) * 0.7 * dt;
          g.position.z += Math.cos(g.rotation.y) * 0.7 * dt;
          g.position.y = meshHeightAt(g.position.x, g.position.z) + 0.03;
        } else if (Math.sin(t * 2.3 + a.phase) > 0.9) {
          g.rotation.y += (rng() - 0.5) * 2;
        }
        if (a.tailPivot) a.tailPivot.rotation.x = Math.sin(t * 8.5 + a.phase) * 0.35;
        if (a.timer <= 0) {
          a.state = 'pfly';
          a.pt = a.perches[(rng() * a.perches.length) | 0];
        }
      }
    } else if (a.fly === 'cross') {
      // crane skein: straight transit, wraps to the far side of the map
      g.position.x += Math.sin(a.heading) * 11 * dt;
      g.position.z += Math.cos(a.heading) * 11 * dt;
      g.position.y = a.level + Math.sin(t * 0.15 + a.phase) * 4;
      g.rotation.y = a.heading;
      if (Math.abs(g.position.x - 500) > 4600 || Math.abs(g.position.z - 1700) > 4600) {
        g.position.x = 500 - Math.sin(a.heading) * 4400 + (rng() - 0.5) * 800;
        g.position.z = 1700 - Math.cos(a.heading) * 4400 + (rng() - 0.5) * 800;
      }
      this.flap(a, t, 2.6, 0.5);
    }
  }

  tick(t, dt, camPos) {
    this.updateHerds();
    for (const a of this.animals) {
      // distance cull: ground fauna beyond 650m is invisible anyway but
      // still costs its draw calls; sky fliers stay (silhouettes carry far).
      // Visibility ONLY — the simulation keeps running (a culled fish that
      // stops swimming is a frozen fish when you arrive).
      if (camPos && a.medium !== 'air') {
        const dx = a.group.position.x - camPos.x, dz = a.group.position.z - camPos.z;
        const vis = dx * dx + dz * dz < 650 * 650;
        if (a.group.visible !== vis) a.group.visible = vis;
      }
      if (a.static) {
        // nest stork: occasional preen
        if (a.neck) a.neck.rotation.x = Math.sin(t * 0.3 + a.phase) > 0.92 ? 0.8 : Math.sin(t * 0.5 + a.phase) * 0.06;
        continue;
      }
      if (a.medium === 'air') { this.tickAir(a, t, dt); continue; }
      if (a.medium === 'water') { this.tickWater(a, t, dt); continue; }
      if (a.hop) { this.tickHop(a, t, dt, camPos); continue; }
      const g = a.group;
      const deer = a.kind === 'roeDeer' || a.kind === 'roeBuck' || a.kind === 'redDeer';
      if (deer && camPos) {
        const cx = g.position.x - camPos.x, cz = g.position.z - camPos.z;
        const d2 = cx * cx + cz * cz;
        const cameraLow = camPos.y - meshHeightAt(camPos.x, camPos.z) < 4.5;
        if (cameraLow && d2 < 12 * 12) {
          const d = Math.sqrt(d2) || 1;
          const ax = d2 > 0.001 ? cx / d : Math.sin(a.phase);
          const az = d2 > 0.001 ? cz / d : Math.cos(a.phase);
          a.tx = g.position.x + ax * 20;
          a.tz = g.position.z + az * 20;
          a.state = 'walk';
          a.timer = 8;
          a.fleeing = true;
        } else if (a.fleeing && d2 > 18 * 18) {
          a.fleeing = false;
        }
      }
      // A shared centroid keeps herds from leaking across a whole pasture.
      // Deterministic slots around it provide cheap spacing without O(n²)
      // neighbour checks or per-tick spatial-hash allocations.
      if (a.herd && a.state !== 'walk') {
        const herd = a.herd, n = herd.members.length;
        const hx = g.position.x - herd.cx, hz = g.position.z - herd.cz;
        const hd = Math.hypot(hx, hz);
        // Slightly oversize the ring so normal steering error still leaves
        // approximately the requested body-to-body clearance.
        const slotR = n > 1 ? herd.profile.spacing * 1.75 / (2 * Math.sin(Math.PI / n)) : 0;
        const slotA = herd.phase + a.herdIndex * TAU / n;
        const sx = herd.cx + Math.sin(slotA) * slotR;
        const sz = herd.cz + Math.cos(slotA) * slotR;
        const slotD = Math.hypot(sx - g.position.x, sz - g.position.z);
        if (hd > herd.profile.radius || slotD > herd.profile.spacing * 0.2) {
          a.tx = sx; a.tz = sz;
          a.state = 'walk'; a.timer = 30;
        }
      }
      a.timer -= dt;
      if (a.timer <= 0) {
        if (a.state !== 'walk' && rng() > a.grazeBias) {
          const ang = rng() * Math.PI * 2, r = Math.sqrt(rng()) * a.home.r;
          a.tx = a.home.x + Math.cos(ang) * r;
          a.tz = a.home.z + Math.sin(ang) * r;
          if (a.herd) {
            // Preserve the established RNG stream, but let herd members take
            // short walks around their own loose slot instead of crossing the
            // whole pasture through one another.
            const n = a.herd.members.length;
            const slotR = n > 1 ? a.herd.profile.spacing * 1.75 / (2 * Math.sin(Math.PI / n)) : 0;
            const slotA = a.herd.phase + a.herdIndex * TAU / n;
            a.tx = a.herd.cx + Math.sin(slotA) * slotR;
            a.tz = a.herd.cz + Math.cos(slotA) * slotR;
          }
          a.state = 'walk';
          a.timer = 30;
        } else {
          a.state = rng() < 0.75 ? 'graze' : 'idle';
          a.timer = 2.5 + rng() * 6;
        }
      }
      if (a.state === 'walk') {
        let dx = a.tx - g.position.x, dz = a.tz - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.65) { a.state = 'graze'; a.timer = 3 + rng() * 5; }
        else {
          if (a.herd) {
            const herd = a.herd, n = herd.members.length;
            const hx = herd.cx - g.position.x, hz = herd.cz - g.position.z;
            const hd = Math.hypot(hx, hz) || 1;
            if (hd > herd.profile.radius * 0.72) {
              const pull = clamp((hd - herd.profile.radius * 0.72) / (herd.profile.radius * 0.28), 0, 1.7);
              dx += hx / hd * dist * pull;
              dz += hz / hd * dist * pull;
            }
            if (n > 1) {
              const slotR = herd.profile.spacing * 1.75 / (2 * Math.sin(Math.PI / n));
              const slotA = herd.phase + a.herdIndex * TAU / n;
              const sx = herd.cx + Math.sin(slotA) * slotR - g.position.x;
              const sz = herd.cz + Math.cos(slotA) * slotR - g.position.z;
              const sd = Math.hypot(sx, sz) || 1;
              const slotPull = clamp(sd / (herd.profile.spacing * 0.45), 0, 1.8);
              dx += sx / sd * dist * slotPull;
              dz += sz / sd * dist * slotPull;
            }
          }
          const want = Math.atan2(dx, dz);
          const da = angleDelta(a.heading, want);
          a.heading += clamp(da, -a.turnRate * dt, a.turnRate * dt);
          g.rotation.y = a.heading;
          const maxSpeed = a.speed * (a.shoulder ? a.shoulder * 0.8 : 1) * (a.fleeing ? 2.15 : 1);
          const arriveAt = Math.max(2.2, maxSpeed * 4);
          const desiredSpeed = maxSpeed * clamp((dist - 0.65) / (arriveAt - 0.65), 0, 1);
          const oldSpeed = a.moveSpeed;
          const accelRate = a.fleeing ? 2.4 : 0.9;
          a.moveSpeed += clamp(desiredSpeed - a.moveSpeed, -1.35 * dt, accelRate * dt);
          g.position.x += Math.sin(a.heading) * a.moveSpeed * dt;
          g.position.z += Math.cos(a.heading) * a.moveSpeed * dt;
          const accel = (a.moveSpeed - oldSpeed) / Math.max(dt, 0.001);
          const pitch = clamp(accel * 0.035, -0.055, 0.055);
          g.rotation.x = lerp(g.rotation.x, pitch, clamp(dt * 7, 0, 1));
          const stride = maxSpeed > 0 ? clamp(a.moveSpeed / maxSpeed, 0, 1) : 0;
          a.gaitP += dt * (2.5 + stride * 5.5);
          const swing = Math.sin(a.gaitP);
          for (let i = 0; i < a.legs.length; i++) {
            const phase = a.gaitP + [0, Math.PI, Math.PI*.55, Math.PI*1.55][i % 4];
            a.legs[i].rotation.x = Math.sin(phase) * 0.32 * stride;
            const lower = a.legs[i].userData.lowerLeg;
            if (lower) lower.rotation.x = Math.max(0,Math.cos(phase)) * .48 * stride * (a.legs[i].userData.hind ? -1 : 1);
          }
          if (a.neck) a.neck.rotation.x = swing * 0.04 * stride;
          g.position.y = meshHeightAt(g.position.x, g.position.z);
          g.position.y += a.legs.length ? Math.abs(swing) * 0.015 * (a.shoulder || 0.3) * stride
            : Math.abs(swing) * 0.03 * stride;
        }
      } else {
        a.moveSpeed = Math.max(0, a.moveSpeed - 1.35 * dt);
        g.rotation.x = lerp(g.rotation.x, 0, clamp(dt * 7, 0, 1));
        for (const leg of a.legs) {
          leg.rotation.x *= 0.85;
          if (leg.userData.lowerLeg) leg.userData.lowerLeg.rotation.x *= .85;
        }
        if (a.state === 'graze' && a.neck) {
          // head down, with little nibble movements (peck for fowl)
          const target = a.grazeAngle ?? (a.shoulder ? 0.95 : 1.1);
          a.neck.rotation.x = lerp(a.neck.rotation.x, target + Math.sin(t * (a.shoulder ? 2.4 : 9) + a.phase) * 0.12, 0.05);
        } else if (a.neck) {
          a.neck.rotation.x = lerp(a.neck.rotation.x, Math.sin(t * 0.6 + a.phase) * 0.1, 0.06);
          a.neck.rotation.y = Math.sin(t * 0.4 + a.phase * 2) * 0.25;
        }
      }
    }
  }
}
