// OSM nodes returned by Overpass (base timestamp 2026-07-28), ODbL.
// Positions and shelter/bench presence are mapped; pavilion appearance is
// a restrained generic reconstruction, not a photo-surveyed replica.
import * as THREE from 'three';
import { osmRoadsForEra } from './landuse.js';
import { meshHeightAt } from './terrain.js';
import { canvasTexture } from './util.js';
import { MAT } from './textures.js';
export const BUS_STOPS = [
  {id:305523873,lat:57.1778074,lon:25.6217891,name:'Bānūžu pagrieziens',bench:true,shelter:false},
  {id:305523874,lat:57.1761775,lon:25.6223095,name:'Bānūžu pagrieziens',bench:true,shelter:false},
  {id:305523888,lat:57.1608689,lon:25.6645275,name:'Taurene',bench:true,shelter:true},
  {id:804525583,lat:57.1606869,lon:25.6647955,name:'Taurene',bench:true,shelter:true},
  {id:305524124,lat:57.1441634,lon:25.6653644,name:'Zaļkalns',bench:false,shelter:false},
  {id:305524731,lat:57.1432220,lon:25.6653067,name:'Zaļkalns',bench:false,shelter:false},
];
export function buildRoadside() {
  const root=new THREE.Group();root.name='mapped-roadside';
  const metal=new THREE.MeshLambertMaterial({color:0x647077}),wood=MAT.plank;
  const concrete=new THREE.MeshLambertMaterial({color:0x87877d}),roofMat=new THREE.MeshLambertMaterial({color:0x435047});
  const box=(g,w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
  const roads=osmRoadsForEra(5).filter(r=>r.c===0);
  for(const stop of BUS_STOPS){
    let x=(stop.lon-25.66472)*111320*Math.cos(57.15944*Math.PI/180),z=-(stop.lat-57.15944)*111360;
    let best=null;
    for(const road of roads)for(let i=1;i<road.pts.length;i++){
      const [ax,az]=road.pts[i-1],[bx,bz]=road.pts[i],dx=bx-ax,dz=bz-az,L=Math.hypot(dx,dz);
      if(!L)continue;const t=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(L*L),0,1),px=ax+t*dx,pz=az+t*dz,d=Math.hypot(x-px,z-pz);
      if(!best || d<best.d)best={x:px,z:pz,dx:dx/L,dz:dz/L,d};
    }
    if(!best)continue;
    // Keep the mapped roadside, compensating only for a coarsened centreline.
    const sign=Math.sign((x-best.x)*best.dz-(z-best.z)*best.dx)||1;
    if(best.d<6.2){x=best.x+best.dz*sign*6.2;z=best.z-best.dx*sign*6.2;}
    const g=new THREE.Group();g.name=`bus-stop:${stop.id}`;g.userData.evidence=stop;
    g.position.set(x,meshHeightAt(x,z),z);g.rotation.y=Math.atan2(best.x-x,best.z-z);root.add(g);
    box(g,3.2,.12,1.9,0,.03,0,concrete);
    box(g,.065,2.5,.065,1.25,1.25,.65,metal);
    const map=canvasTexture(256,256,(ctx,w,h)=>{
      ctx.fillStyle='#215580';ctx.fillRect(0,0,w,h);ctx.fillStyle='#f1f0e6';ctx.fillRect(28,20,200,155);
      ctx.fillStyle='#253038';ctx.fillRect(81,42,94,91);ctx.fillStyle='#d4e1df';ctx.fillRect(89,50,78,42);
      ctx.fillStyle='#253038';ctx.fillRect(87,127,17,18);ctx.fillRect(151,127,17,18);
      ctx.fillStyle='#f1f0e6';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText(stop.name,w/2,210,230);
    });
    const signMat=new THREE.MeshLambertMaterial({map,side:THREE.DoubleSide});
    const board=new THREE.Mesh(new THREE.PlaneGeometry(.55,.62),signMat);board.position.set(1.25,2.24,.695);g.add(board);
    if(stop.bench){box(g,1.65,.065,.40,-.25,.46,-.2,wood);box(g,1.65,.36,.045,-.25,.72,-.39,wood);for(const s of [-1,1])box(g,.06,.42,.30,-.25+s*.65,.22,-.2,metal);}
    if(stop.shelter){
      for(const sx of [-1,1])for(const sz of [-1,1])box(g,.075,2.3,.075,sx*1.4,1.15,sz*.75,metal);
      box(g,3.05,.13,1.85,0,2.32,-.06,roofMat);box(g,2.8,1.55,.045,0,1.1,-.75,wood);
      for(const sx of [-1,1])box(g,.045,1.55,1.2,sx*1.4,1.1,-.12,wood);
    }
    box(g,.34,.58,.34,-1.25,.29,.59,metal);
  }
  return root;
}
