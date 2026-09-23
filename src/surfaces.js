// Metre-scaled procedural finishes for large instanced surfaces. No stretched
// one-texture-per-building UVs; fine detail fades with screen-space derivatives.
import * as THREE from 'three';
const noise = `
float surfaceHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float surfaceNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(surfaceHash(i),surfaceHash(i+vec2(1,0)),f.x),mix(surfaceHash(i+vec2(0,1)),surfaceHash(i+vec2(1,1)),f.x),f.y);}
float surfaceLine(float p,float period,float width){float q=abs(fract(p/period+.5)-.5)*period;return 1.0-smoothstep(width,width+max(fwidth(p),.002),q);}
`;
export function roadMaterial(color, offset = -2, vertexColors = false) {
  const mat=new THREE.MeshLambertMaterial({color,vertexColors,polygonOffset:true,polygonOffsetFactor:offset,polygonOffsetUnits:offset});
  mat.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec3 vSurfaceP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceP=(modelMatrix*vec4(position,1.0)).xyz;');
    sh.fragmentShader='varying vec3 vSurfaceP;\n'+noise+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float grainFade=1.0-smoothstep(.04,.20,length(fwidth(vSurfaceP.xz)));
      float grain=(surfaceNoise(vSurfaceP.xz*45.0)-.5)*.18*grainFade;
      diffuseColor.rgb *= .94+grain+surfaceNoise(vSurfaceP.xz*1.6)*.12;`);
  };mat.customProgramCacheKey=()=> 'road-grain-v1';return mat;
}
export function buildingMaterial(roof = false) {
  const mat=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:!roof});
  mat.onBeforeCompile=sh=>{
    sh.vertexShader='attribute float aFinish; varying float vFinish; varying vec3 vSurfaceP;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vFinish=aFinish; vSurfaceP=position*vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));`);
    sh.fragmentShader='varying float vFinish; varying vec3 vSurfaceP;\n'+noise+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 p=vSurfaceP;
      float detailFade=1.0-smoothstep(.05,.45,length(fwidth(p)));
      float detail=(surfaceNoise(p.xz*35.0+p.y*11.0)-.5)*.10*detailFade;
      ${roof ? `
      float seam=surfaceLine(p.x,.55,.009);
      float course=surfaceLine(p.z,.30,.008);
      float roofDetail=vFinish<.5 ? seam*.24 : max(seam*.08,course*.19);
      diffuseColor.rgb *= 1.0-roofDetail+detail;
      ` : `
      float u=p.x+p.z;
      float timber=surfaceLine(p.y,.19,.009);
      float mortar=max(surfaceLine(p.y,.085,.004),surfaceLine(u+mod(floor(p.y/.085),2.0)*.13,.26,.004));
      float finish=vFinish<.5 ? 0.0 : vFinish<1.5 ? mortar*.20 : timber*.20;
      diffuseColor.rgb *= 1.0-finish+detail;
      `}`);
  };mat.customProgramCacheKey=()=>roof?'roof-finish-v1':'wall-finish-v1';return mat;
}
