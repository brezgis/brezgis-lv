// Metre-scaled procedural finishes for large instanced surfaces. No stretched
// one-texture-per-building UVs; fine detail fades with screen-space derivatives.
import * as THREE from 'three';
const noise = `
float surfaceHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float surfaceNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(surfaceHash(i),surfaceHash(i+vec2(1,0)),f.x),mix(surfaceHash(i+vec2(0,1)),surfaceHash(i+vec2(1,1)),f.x),f.y);}
float surfaceLine(float p,float period,float width){float q=abs(fract(p/period+.5)-.5)*period;return 1.0-smoothstep(width,width+max(fwidth(p),.002),q);}
`;
// Road surfaces. aRoad = (across: offset / half-width, fray: 0 on the made
// surface → 1 at the ragged outer edge). kind: 0 asphalt, 1 gravel, 2 dirt
// track, 3 gravel shoulder, 4 junction pad (no across structure). The edge
// frays into the verge by discarding against world noise, so a road never
// has a ruled outline; the surface carries its wear — wheel tracks, the
// loose gravel windrow, a grass strip between ruts, patched asphalt.
export function roadMaterial(color, offset = -2, vertexColors = false, kind = 1) {
  const mat=new THREE.MeshLambertMaterial({color,vertexColors,polygonOffset:true,polygonOffsetFactor:offset,polygonOffsetUnits:offset});
  mat.onBeforeCompile=sh=>{
    sh.vertexShader='attribute vec2 aRoad; varying vec2 vRoad; varying vec3 vSurfaceP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceP=(modelMatrix*vec4(position,1.0)).xyz; vRoad=aRoad;');
    sh.fragmentShader='varying vec2 vRoad; varying vec3 vSurfaceP;\n'+noise+sh.fragmentShader
      .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      {
        vec2 wp=vSurfaceP.xz;
        // two scales of wander: a metre-long bite out of the verge, and a
        // crumb that keeps it from reading as a smooth curve
        float edgeN=surfaceNoise(wp*0.33)*0.6+surfaceNoise(wp*1.9)*0.4;
        if(vRoad.y>0.05+0.9*edgeN) discard;
      }`)
      .replace('#include <map_fragment>',`#include <map_fragment>
      {
        const int KIND=${kind};
        vec2 wp=vSurfaceP.xz;
        float a=abs(vRoad.x), fr=vRoad.y;
        float grainFade=1.0-smoothstep(.04,.20,length(fwidth(wp)));
        float grain=(surfaceNoise(wp*45.0)-.5)*.16*grainFade;
        float big=surfaceNoise(wp*0.09), mid=surfaceNoise(wp*0.6);
        vec3 c=diffuseColor.rgb;
        vec3 verge=KIND==0?vec3(0.37,0.34,0.28):vec3(0.24,0.3,0.14);
        if(KIND==0){
          // aged asphalt: polished wheel paths, darker oil strip mid-lane,
          // repair patches, a paler crumbly margin
          float wheel=smoothstep(0.1,0.0,abs(a-0.28))+smoothstep(0.1,0.0,abs(a-0.72));
          float oil=smoothstep(0.1,0.0,abs(a-0.5));
          c*=1.0+wheel*0.07-oil*0.06+(big-0.5)*0.16;
          float patchN=surfaceNoise(floor(wp*vec2(0.35,0.25))+vec2(3.1,7.7));
          if(patchN>0.82) c*=0.78;
          c=mix(c,c*1.18+0.03,smoothstep(0.85,1.0,a)*0.6);
        } else if(KIND==1||KIND==3){
          // graded gravel: two compacted pale tracks, a loose windrow of
          // coarser stone on the crown and at the edges, potholes
          float track=smoothstep(0.24,0.0,abs(a-0.45)+(mid-0.5)*0.08);
          float loose=KIND==3?0.6:smoothstep(0.16,0.0,a)+smoothstep(0.75,1.0,a);
          c*=1.0+track*0.2-loose*0.12+(mid-0.5)*0.16+(big-0.5)*0.14;
          float speck=surfaceNoise(wp*11.0);
          c*=1.0+(speck-0.5)*0.22*loose*grainFade;
          float hole=smoothstep(0.86,0.9,surfaceNoise(wp*0.8+17.0))*track;
          c=mix(c,c*0.6,hole);
        } else if(KIND==2){
          // a cart track: two worn ruts, the grass strip between them
          float rut=smoothstep(0.2,0.0,abs(a-0.5));
          float midStrip=smoothstep(0.26,0.1,a+(mid-0.5)*0.12);
          c*=1.0-rut*0.12+(mid-0.5)*0.18;
          c=mix(c,verge*(0.85+big*0.3),midStrip*0.85);
          c=mix(c,verge,smoothstep(0.8,1.0,a)*0.35);
        }
        // the verge creeps in over the fray
        c=mix(c,verge*(0.9+mid*0.2),smoothstep(0.0,0.9,fr)*0.55);
        c*=0.96+grain;
        diffuseColor.rgb=c;
      }`);
  };mat.customProgramCacheKey=()=>'road-surface-v3-'+kind;return mat;
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
    sh.vertexShader = 'attribute vec3 aRow; attribute vec2 aEdge; varying vec3 vRow; varying vec2 vEdge; varying vec3 vFieldP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvRow = aRow; vEdge = aEdge; vFieldP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vRow; varying vec2 vEdge; varying vec3 vFieldP;\n' + noise + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        // frayed border: the meadow (terrain below) shows through a noisy
        // band, so no parcel ever has a ruled edge
        float nE = surfaceNoise(vFieldP.xz * 0.06) * 0.55 + surfaceNoise(vFieldP.xz * 0.23) * 0.3 + surfaceNoise(vFieldP.xz * 0.9) * 0.15;
        float cut = vEdge.y * (0.1 + 1.3 * nE);
        if (vEdge.x < cut) discard;
        float weedy = 1.0 - smoothstep(cut, cut + 1.6, vEdge.x);
        float st = vRow.z;
        float k = 1.0 - smoothstep(0.015, 0.12, fwidth(vRow.x));     // rows visible?
        float big = surfaceNoise(vFieldP.xz * 0.045) - 0.5;           // growth patches
        float fine = surfaceNoise(vFieldP.xz * 1.7) - 0.5;
        vec3 soil = vec3(0.34, 0.27, 0.19);
        if (st > 2.5) {                       // fallow at Jāņi: grazed weeds, patches just ploughed
          float fu = abs(fract(vRow.x / 0.34) - 0.5) * 2.0;
          float weeds = smoothstep(0.35, 0.65, surfaceNoise(vFieldP.xz * 0.11) + fine * 0.4);
          diffuseColor.rgb *= 1.0 - 0.2 * k * smoothstep(0.45, 0.9, fu) * (1.0 - weeds) + fine * 0.12;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.17, 0.22, 0.09) * (0.85 + big * 0.5), weeds * 0.75);
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
        // sowing passes: broad stripes a few metres apart that still read
        // from the air, where the drill rows have long gone sub-pixel
        float pass = sin(vRow.x * 6.2832 / 2.7 + big * 2.0);
        diffuseColor.rgb *= 1.0 + pass * 0.045 * (st > 2.5 ? 0.4 : 1.0);
        // headland: the strip round the ends where the team turned
        float head = 1.0 - smoothstep(2.5, 4.0, vRow.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.93, 0.95, 0.9) + vec3(0.02, 0.015, 0.0), head * 0.6);
        // the weedy margin shades into the sward
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.22, 0.07), weedy * 0.55);
      }`);
  };
  mat.customProgramCacheKey = () => 'field-parcels-v3';
  return mat;
}
