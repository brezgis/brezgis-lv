// Connected, species-proportioned anatomy. +Z is forward; hooves rest at Y=0.
import * as THREE from 'three';
const material = (c) => new THREE.MeshLambertMaterial({ color: c });
const V = (p) => new THREE.Vector3(...p);

export function ellipsoid(parent, mat, position, scale) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
  mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh);
  return mesh;
}

// Taper a continuous curved tube. Horns, tails and bird necks share actual
// endpoints, avoiding the detached cylinders in the original animal models.
export function organicTube(parent, mat, points, radii) {
  const curve = new THREE.CatmullRomCurve3(points.map(V));
  const steps = Math.max(12, points.length * 5), sides = 8;
  const frames = curve.computeFrenetFrames(steps, false), pos = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPointAt(t), f = t * (radii.length - 1);
    const j = Math.min(radii.length - 2, Math.floor(f));
    const r = THREE.MathUtils.lerp(radii[j], radii[j + 1], f - j);
    for (let k = 0; k <= sides; k++) {
      const a = k / sides * Math.PI * 2;
      const q = p.clone().addScaledVector(frames.normals[i], Math.cos(a) * r)
        .addScaledVector(frames.binormals[i], Math.sin(a) * r);
      pos.push(q.x, q.y, q.z);
      if (i && k) { const b = i * (sides + 1) + k; idx.push(b, b - 1, b - sides - 2, b, b - sides - 2, b - sides - 1); }
    }
  }
  const geo = new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo,mat);parent.add(mesh);return mesh;
}

export function quadruped({
  shoulder = 1.2, length = 1.9, width = .55, legR = .07,
  color = 0x6b4a33, belly = null, headColor = null, neckLen = .5, headSize = .32,
  horns = null, ears = true, tail = .5, maneColor = null, tusks = false,
  tailR = .02, tasselColor = 0x2a2018, horse = false, legColor = null,
  tailColor = null, dorsalStripeColor = null, family = 'bovine',
}) {
  if (horse) family = 'horse';
  const deer = family === 'deer' || family === 'elk', canine = family === 'canine';
  const pig = family === 'pig', sheep = family === 'sheep';
  const g = new THREE.Group(), bodyMat = material(color), headMat = material(headColor ?? color);
  const dark = material(0x25221d), hoofMat = material(legColor ?? 0x383027);
  const bodyY = shoulder * (pig ? .67 : .75), bodyR = shoulder * (pig || sheep ? .32 : .25);
  // One continuous trunk avoids the hard intersection seams of three blobs.
  const torso=ellipsoid(g,bodyMat,[0,bodyY,0],[width*.52,bodyR,length*.53]);
  const tp=torso.geometry.attributes.position;
  for(let i=0;i<tp.count;i++){
    const z=tp.getZ(i),fullness=1+.13*Math.exp(-Math.pow((z-.43)/.28,2))+.08*Math.exp(-Math.pow((z+.5)/.25,2));
    tp.setX(i,tp.getX(i)*fullness);tp.setY(i,tp.getY(i)*fullness);
  }
  torso.geometry.computeVertexNormals();
  if (belly) ellipsoid(g,material(belly),[0,bodyY-bodyR*.48,-length*.03],[width*.46,bodyR*.52,length*.34]);
  if (dorsalStripeColor) {
    organicTube(g,material(dorsalStripeColor),[[0,bodyY+bodyR*.84,-length*.3],[0,bodyY+bodyR*.99,0],[0,bodyY+bodyR*.87,length*.25]], [width*.022,width*.022,width*.012]);
  }
  const legs = [];
  for (const [sx,sz] of [[-1,1],[1,1],[-1,-1],[1,-1]]) {
    const hip = shoulder*.73, upperLen=hip*.47, lowerLen=hip-upperLen;
    const leg = new THREE.Group();leg.position.set(sx*width*.32,hip,sz*length*.30);g.add(leg);
    const bend = (sz < 0 ? .12 : -.035) * shoulder;
    organicTube(leg,bodyMat,[[0,0,0],[0,-upperLen*.42,bend*.45],[0,-upperLen,bend]], [legR*1.9,legR*1.35,legR*.8]);
    const lower = new THREE.Group();lower.position.set(0,-upperLen,bend);leg.add(lower);
    ellipsoid(leg,bodyMat,[0,-upperLen,bend],[legR*.87,legR*.95,legR*.87]);
    organicTube(lower,legColor ? material(legColor) : bodyMat,[[0,0,0],[0,-lowerLen*.74,-bend*.72],[0,-lowerLen+.055*shoulder,-bend]], [legR*.82,legR*.62,legR*.75]);
    // a hoof just proud of the pastern — the old 1.2×/1.65× discs read as
    // platform shoes at grazing distance
    ellipsoid(lower,hoofMat,[0,-lowerLen+.034*shoulder,-bend+.012*shoulder],[legR*.9,.034*shoulder,legR*1.12]);
    leg.userData.lowerLeg = lower;leg.userData.hind = sz < 0;legs.push(leg);
  }
  const neck = new THREE.Group();neck.position.set(0,bodyY,length*.35);g.add(neck);
  const rise = horse ? neckLen*.88 : deer ? neckLen*.64 : canine ? neckLen*.16 : pig ? -.04 : neckLen*.23;
  const reach = horse ? neckLen*.46 : deer ? neckLen*.49 : neckLen*.55;
  const poll = [0,rise,reach];
  organicTube(neck,bodyMat,[[0,-bodyR*.06,-length*.05],[0,rise*.48,reach*.4],poll],
    [width*(canine?.40:.42),width*.29,headSize*.46]);
  const skullZ = reach+headSize*.27, skullY = rise-headSize*.06;
  ellipsoid(neck,headMat,[0,skullY,skullZ],[headSize*(pig?.50:.43),headSize*.48,headSize*.67]);
  const noseZ = skullZ + headSize*(horse?.92:canine?.95:.64);
  const noseY = skullY-headSize*(horse?.54:.23);
  organicTube(neck,headMat,[[0,skullY,skullZ],[0,(skullY+noseY)/2,(skullZ+noseZ)/2],[0,noseY,noseZ]],
    [headSize*.40,headSize*(canine?.24:.34),headSize*(canine?.11:.25)]);
  ellipsoid(neck,pig ? material(0x69504a) : dark,[0,noseY,noseZ],[headSize*(canine?.12:.28),headSize*.16,headSize*.12]);
  for (const s of [-1,1]) {
    ellipsoid(neck,dark,[s*headSize*.385,skullY+headSize*.12,skullZ+headSize*.24],[headSize*.052,headSize*.062,headSize*.043]);
    if (ears) {
      const ear=ellipsoid(neck,headMat,[s*headSize*.52,rise+headSize*.37,reach-headSize*.03],
        [headSize*(deer?.19:.16),headSize*(horse||deer||canine?.43:.28),headSize*.09]);
      ear.rotation.z=-s*(canine||horse?.24:.85);
    }
  }
  if (horns) {
    const antler = deer || horns.palmate, hornMat=material(antler?0xa99a7d:0xc4b799);
    for (const s of [-1,1]) {
      const base=[s*headSize*.30,rise+headSize*.35,reach];
      const L=horns.len;
      const beam=antler ? [base,[base[0]+s*L*.28,base[1]+L*.28,base[2]-L*.25],
        [base[0]+s*L*.58,base[1]+L*.70,base[2]-L*.28],[base[0]+s*L*.73,base[1]+L,base[2]-L*.14]]
        : [base,[base[0]+s*L*.42,base[1]+L*.16,base[2]-.04],
          [base[0]+s*L*.67,base[1]+L*.42,base[2]+L*.12],[base[0]+s*L*.45,base[1]+L*.69,base[2]+L*.34]];
      organicTube(neck,hornMat,beam,[horns.r*1.2,horns.r,horns.r*.58,.001]);
      if (antler) for(let j=1;j<=3;j++) {
        const b=beam[Math.min(j,2)], t=j/3;
        organicTube(neck,hornMat,[b,[b[0]+s*L*.13,b[1]+L*(.19+t*.10),b[2]+L*.18],
          [b[0]+s*L*.15,b[1]+L*(.28+t*.12),b[2]+L*.31]], [horns.r*.65,horns.r*.35,.001]);
      }
      if(horns.palmate) {
        const palm=ellipsoid(neck,hornMat,beam[2],[L*.26,L*.22,L*.045]);palm.rotation.z=-s*.6;
      }
    }
  }
  if (maneColor) organicTube(neck,material(maneColor),[[0,bodyR*.34,-.03],[0,rise*.6+headSize*.18,reach*.33],[0,rise+headSize*.28,reach-.02]], [width*.10,width*.09,width*.035]);
  if (tusks) for(const s of [-1,1]) organicTube(neck,material(0xd6c8a5),[[s*headSize*.27,noseY-.03,noseZ-.04],[s*headSize*.43,noseY+.025,noseZ],[s*headSize*.43,noseY+.11,noseZ-.04]],[.018,.013,.001]);
  if (tail > 0) {
    const y=bodyY+bodyR*.40,z=-length*.44;
    const brush=canine || horse;
    const points=canine?[[0,y,z],[0,y-tail*.22,z-tail*.35],[0,y-tail*.47,z-tail*.78],[0,y-tail*.4,z-tail]]
      :[[0,y,z],[0,y-tail*.30,z-.07],[0,y-tail*.70,z-.10],[0,y-tail,z-.08]];
    organicTube(g,material(tailColor??(horse?maneColor??color:color)),points,
      brush?[tailR*1.1,tailR*2.2,tailR*1.5,tailR*.1]:[tailR,tailR*.8,tailR*.65,.002]);
    if(!brush && tail>.3) ellipsoid(g,material(tasselColor),points[3],[tailR*1.9,tailR*3,tailR*1.9]);
    if(canine) organicTube(g,material(tasselColor),[points[2],points[3]],[tailR*1.5,.001]);
  }
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  // Grazing amplitude is anatomy-dependent, not one 55° bend for every species.
  return {group:g,legs,neck,shoulder,grazeAngle:horse?1.25:deer?1.28:pig?.52:1.05};
}
