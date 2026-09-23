// Isolated, repeatable model inspection, independent of terrain and animal AI.
import { build } from 'esbuild';
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs';
const out = mkdtempSync((process.env.OUT_DIR || '/tmp') + '/village-items-');
const result = await build({ stdin: { contents: `
import * as THREE from 'three';
import { SPECIES } from './src/animals.js';
import * as B from './src/buildings.js';
import { leanTo, fishRack } from './src/eras.js';
import { initTextures } from './src/textures.js';
initTextures();
const structures={huntersShelter:leanTo,fishRack};
const special={watermill:()=>B.watermill(0),rikuFence:()=>B.rikuFence([[-2,0,0],[2,0,0]]),wattleFence:()=>B.wattleFence([[-2,0,0],[2,0,0]]),palisadeRing:()=>B.palisadeRing(0,0,5),deadIce:()=>B.deadIce(0,0,1),erratics:()=>B.erratics(3,{x:0,z:0,w:5,h:5})};
for(const [name,fn] of Object.entries(B))if(!['placeOnGround','barrowStones','barrowMounds'].includes(name))structures[name]=special[name]||(()=>fn());
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(1200,800); renderer.setPixelRatio(1);
renderer.setClearColor(0xd4d9d2); renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.style.margin='0';document.body.appendChild(renderer.domElement);
window.kinds=Object.keys(SPECIES);
window.structures=Object.keys(structures);
window.show=(kinds)=>{
 document.querySelectorAll('label').forEach(e=>e.remove());
 renderer.setScissorTest(true);
 kinds.forEach((kind,i)=>{
  const object=SPECIES[kind]?SPECIES[kind]().group:structures[kind](),scene=new THREE.Scene();scene.add(object);
  scene.add(new THREE.HemisphereLight(0xe8f0ff,0x746c50,2));
  const sun=new THREE.DirectionalLight(0xffeed7,2.2);sun.position.set(-3,6,5);scene.add(sun);
  const box=new THREE.Box3().setFromObject(object), size=box.getSize(new THREE.Vector3()), center=box.getCenter(new THREE.Vector3());
  const span=Math.max(size.z,size.y,size.x)*1.4;
  const camera=new THREE.PerspectiveCamera(35,1.5,.01,5000);
  camera.position.copy(center).add(new THREE.Vector3(span*1.2,span*.42,span*.85));camera.lookAt(center);
  const x=i%3*400,y=400-Math.floor(i/3)*400;
  renderer.setViewport(x,y,400,400);renderer.setScissor(x,y,400,400);camera.aspect=1;camera.updateProjectionMatrix();
  renderer.render(scene,camera);
  const label=document.createElement('label');label.textContent=kind;label.style.cssText='position:absolute;font:18px sans-serif;color:#263628;left:'+(x+16)+'px;top:'+(800-y-400+12)+'px';document.body.appendChild(label);
  scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(!Array.isArray(o.material))o.material.dispose();}});
 });
};`, resolveDir: process.cwd(), loader: 'js' }, bundle:true, write:false, format:'iife' });
const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-gpu','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--disable-dev-shm-usage']});
const errors=[];
console.log('Model sheets:',out);
try {
 const page=await browser.newPage();await page.setViewport({width:1200,height:800});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:result.outputFiles[0].text});
 const sets=[['aurochsBull','cattleFarm','horseBay','elk','redDeer','reindeer'],['sheepWhite','boar','fox','wolf','roeDeer','hare'],['stork','duckM','swanWhooper','chicken','beaver','crane']];
 const remaining=(await page.evaluate(()=>window.kinds)).filter(k=>!sets.flat().includes(k));
 for(let i=0;i<remaining.length;i+=6)sets.push(remaining.slice(i,i+6));
 for(let i=0;i<sets.length;i++){await page.evaluate(k=>window.show(k),sets[i]);await page.screenshot({path:out+'/animals-'+i+'.png'});}
 const names=await page.evaluate(()=>window.structures);
 for(let i=0;i<names.length;i+=6){await page.evaluate(k=>window.show(k),names.slice(i,i+6));await page.screenshot({path:out+'/structures-'+Math.floor(i/6)+'.png'});}
 console.log(JSON.stringify({out,errors}));if(errors.length)process.exitCode=1;
}finally{await browser.close();}
