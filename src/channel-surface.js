// A channel is a COVERAGE region, not a strip of offset centreline normals.
// Offsets fold over themselves whenever the bend radius is below its width.
// Clipping a shared world grid gives each patch of water exactly one face,
// including hairpins, and keeps the bed and surface on identical topology.
import * as THREE from 'three';
import { RIVER, channelAt, riverAt, lakeShoreSignedDistAt, poolK } from './riverzone.js';
import { meshHeightAt } from './terrain.js';

export function channelSurfaceGeometry(chan, uvM = 9, {bank=false} = {}) {
  const step = chan === RIVER && !bank ? 3 : 1.5;
  const cells = new Set(), samples = new Map(), vertices = new Map();
  const key = (x, z) => (x + 32768) * 65536 + z + 32768;
  for (const [x, z, , hw] of chan.samples) {
    const r = hw + (bank?6:1.6) + step * 2;
    for (let ix = Math.floor((x-r)/step); ix <= Math.ceil((x+r)/step); ix++) {
      for (let iz = Math.floor((z-r)/step); iz <= Math.ceil((z+r)/step); iz++) cells.add(key(ix, iz));
    }
  }
  const sample = (ix, iz) => {
    const k = key(ix, iz);
    if (samples.has(k)) return samples.get(k);
    const x = ix * step, z = iz * step, q = channelAt(chan, x, z);
    let field = q ? q.hw + 1.4 - q.d : -step * 4;
    if(bank && q){
      const width=3.3+1.1*(.5+.5*Math.sin(q.s*.028+q.side*1.3));
      field=Math.min(q.hw+width-q.d,q.d-q.hw-.75);
    }
    // Only one optical surface in a through-flow lake or receiver channel.
    if (field > -step * 2) {
      field = Math.min(field, lakeShoreSignedDistAt(x, z));
      if (chan.confluence?.type === 'river') {
        const rv = riverAt(x, z);
        if (rv) field = Math.min(field, rv.d - rv.hw - 1.4);
      }
    }
    const p = { x, z, field };
    samples.set(k, p); return p;
  };
  const positions=[], uvs=[], depth=[], turbulence=[], flow=[], indices=[];
  const vertex = p => {
    const k = `${p.x.toFixed(6)}:${p.z.toFixed(6)}`;
    if (vertices.has(k)) return vertices.get(k);
    const q = channelAt(chan, p.x, p.z);
    if (!q) throw new Error('Channel coverage escaped its spatial query');
    const i = positions.length/3;
    positions.push(p.x, bank?meshHeightAt(p.x,p.z)+.025:q.level, p.z);
    // World UVs stay continuous when the nearest reach changes at a bend.
    uvs.push(p.x/uvM, p.z/uvM);
    flow.push(q.dx, q.dz);
    depth.push(Math.max(0, q.level-meshHeightAt(p.x,p.z)));
    turbulence.push(Math.min(1, (1-poolK(q.curvature))*.42 + q.d/Math.max(1,q.hw)*.12));
    vertices.set(k,i); return i;
  };
  const triangle = points => {
    const polygon=[];
    for(let i=0;i<3;i++) {
      const a=points[i], b=points[(i+1)%3];
      if(a.field>=0) polygon.push(a);
      if((a.field>=0)!==(b.field>=0)) {
        const t=a.field/(a.field-b.field);
        polygon.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,field:0});
      }
    }
    for(let i=1;i<polygon.length-1;i++) {
      const [a,b,c]=[polygon[0],polygon[i],polygon[i+1]];
      const area=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);
      if(area>1e-7) indices.push(vertex(a),vertex(b),vertex(c));
    }
  };
  for(const k of cells) {
    const ix=Math.floor(k/65536)-32768, iz=k%65536-32768;
    const a=sample(ix,iz),b=sample(ix,iz+1),c=sample(ix+1,iz+1),d=sample(ix+1,iz);
    triangle([a,b,c]); triangle([a,c,d]);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(positions.map((_,i)=>i%3===1?1:0),3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.setAttribute('aDepth',new THREE.Float32BufferAttribute(depth,1));
  geo.setAttribute('aTurb',new THREE.Float32BufferAttribute(turbulence,1));
  geo.setAttribute('aFlow',new THREE.Float32BufferAttribute(flow,2));
  // Float32 quantisation can collapse tiny shoreline slivers at kilometre
  // coordinates. Drop those zero-area triangles after the conversion.
  const p=geo.attributes.position,valid=[];
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i],b=indices[i+1],c=indices[i+2];
    const area=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));
    if(area>1e-6)valid.push(a,b,c);
  }
  geo.setIndex(valid); geo.computeBoundingSphere();
  geo.userData.coverageGridMetres=step;
  return geo;
}
