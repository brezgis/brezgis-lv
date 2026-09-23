import assert from 'node:assert/strict';
import { channelSurfaceGeometry } from '../src/channel-surface.js';
import { RIVER, STREAM_CHANNELS } from '../src/riverzone.js';

for (const channel of [RIVER,...STREAM_CHANNELS]) for(const bank of [false,true]) {
  const geo=channelSurfaceGeometry(channel,9,{bank}),p=geo.attributes.position,idx=geo.index;
  assert(idx.count>0);
  for(const attribute of Object.values(geo.attributes))assert(attribute.array.every(Number.isFinite));
  const faces=new Set();
  for(let i=0;i<idx.count;i+=3){
    const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
    const area=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));
    assert(area>1e-6,`${channel.name}: folded or collapsed triangle`);
    const key=[a,b,c].sort((a,b)=>a-b).join(':');assert(!faces.has(key),'duplicated coverage face');faces.add(key);
  }
  assert(geo.attributes.aDepth.array.every(d=>d>=0));
  console.log(`PASS ${channel.name} ${bank?'bank':'surface'}: ${p.count} finite vertices; ${idx.count/3} upward, unique faces`);
  geo.dispose();
}
