// System-level checks of the shipped world, plus close water/road/forest views.
import puppeteer from 'puppeteer-core';
import { mkdtempSync, writeFileSync } from 'node:fs';
const out=mkdtempSync('/tmp/village-environment-'),errors=[],results=[];
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--enable-gpu','--disable-dev-shm-usage']});
const check=(ok,label,detail)=>{results.push({pass:!!ok,label,detail});console.log(`${ok?'PASS':'FAIL'} ${label}`,JSON.stringify(detail??''));};
console.log('Environment review:',out);
try{
 const page=await browser.newPage();await page.setViewport({width:1100,height:720});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('../artifact/brezgi-taurene.html',import.meta.url).href,{waitUntil:'load',timeout:120000});
 await page.waitForFunction('window.__sim && document.querySelector("#loader.done")',{timeout:120000});
 await page.evaluate(()=>{window.__sim.era(5);window.__sim.sky.state.paused=true;window.__sim.sky.state.t=.40;document.querySelector('#panel').classList.add('closed');});
 const water=await page.evaluate(()=>{
   const out=[];window.__scene.updateMatrixWorld(true);
   window.__scene.getObjectByName('water').traverse(o=>{
     if(!o.isMesh||!o.material.normalMap)return;
     const g=o.geometry,p=g.attributes.position,d=g.attributes.aDepth,idx=g.index;let inverted=0,flat=0,min=Infinity,max=-Infinity;
     for(let i=0;i<(idx?.count??p.count);i+=3){
       const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,c=idx?idx.getX(i+2):i+2;
       const area=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));
       if(area<-.001)inverted++;if(Math.abs(area)<.000001)flat++;
     }
     for(let i=0;i<d.count;i++){min=Math.min(min,d.getX(i));max=Math.max(max,d.getX(i));}
     out.push({name:o.name,vertices:p.count,inverted,flat,min,max,depthWrite:o.material.depthWrite,singlePass:o.material.forceSinglePass});
   });return out;
 });
 check(water.every(w=>!w.depthWrite&&w.singlePass),'transparent water does not occlude other water with depth writes',water);
 check(water.every(w=>w.inverted===0),'all water faces wind upward',water.filter(w=>w.inverted));
 check(water.every(w=>w.flat===0),'no collapsed shoreline faces remain after Float32 conversion');
 check(water.filter(w=>/ezers|Brenkūzis/.test(w.name)).every(w=>w.max-w.min>.5),'lake shading represents shelves and deeper basins');
 const modern=await page.evaluate(()=>({stops:window.__scene.getObjectByName('mapped-roadside')?.children.length,
   wallFinish:!!window.__scene.getObjectByName('bg-walls-era-5')?.geometry.attributes.aFinish,
   farVertices:[...window.__scene.getObjectByName('vegetation').children].filter(o=>o.name.startsWith('far:')).map(o=>o.geometry.attributes.position.count)}));
 check(modern.stops===6,'six mapped bus stops with attributed shelter presence',modern);
 check(modern.wallFinish,'mapped buildings have metre-scaled facade finishes');
 check(modern.farVertices.length>0&&modern.farVertices.every(n=>n===4),'distant trees have no crossed panels or square canopy lids');
 const lod=await page.evaluate(()=>{
   const trees=[];window.__scene.getObjectByName('vegetation').traverse(o=>{if(o.name.startsWith('far:')||o.name.startsWith('promoted:'))trees.push(!!o.geometry.attributes.aLodFade);});
   return trees.length>0&&trees.every(Boolean);
 });
 check(lod,'tree replacement meshes carry per-instance coverage fades');
 // Enter a real far-tree cell and inspect the same promoted slot twice.
 // A scale-based "fade" can look smooth yet make every tree shrink/grow.
 const transition=await page.evaluate(async()=>{
   const group=window.__scene.getObjectByName('vegetation');
   const far=group.children.find(o=>o.name.startsWith('far:')&&o.count>20);
   const matrix=window.__sim.camera.matrix.clone();far.getMatrixAt(20,matrix);
   const x=matrix.elements[12],y=matrix.elements[13],z=matrix.elements[14];
   window.__sim.setCam(x+8,y+3,z+8,x,y+4,z);
   const frame=()=>new Promise(r=>requestAnimationFrame(r));
   for(let i=0;i<3;i++)await frame();
   const mesh=group.getObjectByName('promoted:'+far.name.slice(4)+':bark');
   const fade=mesh.geometry.attributes.aLodFade;
   let slot=-1;for(let i=0;i<mesh.count;i++)if(fade.getX(i)>.001&&fade.getX(i)<.999){slot=i;break;}
   if(slot<0)return {observed:false};
   mesh.getMatrixAt(slot,matrix);const before=Math.hypot(...matrix.elements.slice(4,7)),first=fade.getX(slot);
   for(let i=0;i<2;i++)await frame();
   mesh.getMatrixAt(slot,matrix);return {observed:true,before,after:Math.hypot(...matrix.elements.slice(4,7)),first,last:fade.getX(slot)};
 });
 check(transition.observed&&Math.abs(transition.before-transition.after)<1e-6&&transition.last>transition.first,'tree size stays fixed while coverage transitions',transition);
 const views=[
  ['river-bank',[-706,187.4,685,-735,185.2,720]],
  ['river-bend',[-394,190,-27,-410,185,-16]],
  ['river-mouth',[1440,184,-548,1491,179,-537]],
  ['lake-shallows',[1607,181,-367,1650,178.7,-332]],
  ['stream',[1250,186,-1490,1295,183.2,-1496]],
  ['bus-stop',[8,197,-132,-12,194,-158]],
  ['road',[-10,197,30,0,194,-70]],
  ['forest',[700,225,700,790,218,720]],
 ];
 for(const [name,cam] of views){
   await page.evaluate(c=>window.__sim.setCam(...c),cam);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   // Photograph the settled view, not the intentional half-second cutout
   // transition immediately after teleporting into a new forest cell.
   await page.waitForFunction(()=>{
     let settled=true;window.__scene.getObjectByName('vegetation').traverse(o=>{
       if(!o.name.startsWith('promoted:'))return;
       const fade=o.geometry.attributes.aLodFade;
       for(let i=0;i<o.count;i++){const f=fade.getX(i);if(f>0&&f<1)settled=false;}
     });return settled;
   },{timeout:60000,polling:'raf'});
   await page.screenshot({path:`${out}/${name}.png`});console.log('Captured',name);
 }
 await page.evaluate(()=>{
   window.__sim.era(1);const p=window.__scene.getObjectByName('hunters-shelter').position;
   window.__sim.setCam(p.x+6,p.y+2.1,p.z+8,p.x,p.y+.9,p.z-1);
 });
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.screenshot({path:`${out}/ad50-camp.png`});console.log('Captured AD 50 camp');
 check(!errors.length,'no browser or shader errors',errors);
}finally{await browser.close();writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));}
if(errors.length||results.some(r=>!r.pass))process.exitCode=1;
