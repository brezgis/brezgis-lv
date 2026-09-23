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

// Crop parcels. aRow = (across-row metres, metres in from the nearest end,
// row style: 0 drilled cereal, 1 clover, 2 potato ridges, 3 ploughed fallow).
// Rows fade out once they are sub-pixel; a headland band runs round the ends
// where the plough turned.
export function fieldMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec3 aRow; varying vec3 vRow; varying vec3 vFieldP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvRow = aRow; vFieldP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vRow; varying vec3 vFieldP;\n' + noise + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float st = vRow.z;
        float k = 1.0 - smoothstep(0.015, 0.12, fwidth(vRow.x));     // rows visible?
        float big = surfaceNoise(vFieldP.xz * 0.045) - 0.5;           // growth patches
        float fine = surfaceNoise(vFieldP.xz * 1.7) - 0.5;
        vec3 soil = vec3(0.34, 0.27, 0.19);
        if (st > 2.5) {                       // black fallow: furrows
          float fu = abs(fract(vRow.x / 0.34) - 0.5) * 2.0;
          diffuseColor.rgb *= 1.0 - 0.2 * k * smoothstep(0.45, 0.9, fu) + fine * 0.12;
        } else if (st > 1.5) {                // potato: ridges of haulm over soil
          float ph = abs(fract(vRow.x / 0.72) - 0.5) * 2.0;
          float haulm = 1.0 - smoothstep(0.45, 0.75, ph + fine * 0.3);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(soil, diffuseColor.rgb, haulm), mix(0.35, 1.0, k));
        } else if (st > 0.5) {                // clover: blotchy, a pink flush of heads
          diffuseColor.rgb *= 1.0 + big * 0.25 + fine * 0.12;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.36, 0.38), smoothstep(0.3, 0.5, fine + big * 0.5) * 0.35);
        } else {                              // drilled cereal: rows + wind-laid sheen
          float dr = abs(fract(vRow.x / 0.16) - 0.5) * 2.0;
          diffuseColor.rgb *= 1.0 - 0.07 * k * smoothstep(0.6, 1.0, dr) + big * 0.14 + fine * 0.05;
        }
        // headland: the strip round the ends where the team turned
        float head = 1.0 - smoothstep(2.5, 4.0, vRow.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.93, 0.95, 0.9) + vec3(0.02, 0.015, 0.0), head * 0.6);
      }`);
  };
  mat.customProgramCacheKey = () => 'field-parcels-v1';
  return mat;
}
