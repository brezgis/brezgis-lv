// Water bodies, all from real geometry: the Gauja ribbon (OSM course),
// Taurenes ezers (OSM outline), the Dzērbe and a nameless brook, and the
// mill pond that exists only while the manor's watermill does (eras 3-4).
import * as THREE from 'three';
import { STREAMS, LAKES } from './geodata.js';
import { RIVER, STREAM_CHANNELS, channelRows, bankCharAt, bankCharSideAt, CONFLUENCES,
  LAKE_SHORES, lakeAt, riverAt, streamAt, inConfluenceMask, channelAt } from './riverzone.js';
import { LOC } from './landuse.js';
import { canvasTexture, makeNoise, chaikinPoly, lerp, smoothstep } from './util.js';
import { meshHeightAt } from './terrain.js';
import { channelSurfaceGeometry } from './channel-surface.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function waterNormalTex() {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    // Blend translated noise fields across a torus: continuous values and
    // derivatives at both seams, without conspicuous parallel sine-wave bands.
    const noise = makeNoise(777).noise2;
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const periodic = (u, v, scale) => {
      const x = u * scale, y = v * scale;
      return lerp(lerp(noise(x, y), noise(x - scale, y), fade(u)),
        lerp(noise(x, y - scale), noise(x - scale, y - scale), fade(u)), fade(v));
    };
    const hgt = (x, y) => {
      const u = ((x % w) + w) % w / w, v = ((y % h) + h) % h / h;
      return periodic(u, v, 7) * 0.7 + periodic(u, v, 23) * 0.3;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 3.2;
      const dy = (hgt(x, y + 1) - hgt(x, y - 1)) * 3.2;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Cheap value noise for the foam lace. Same role as brook's vnoise: the foam
// threshold has to be jittered by the same field that draws the foam, or a
// clean depth contour reads as a white stripe painted along the shoreline —
// which is exactly what a hem of foam is not.
const FOAM_GLSL = /* glsl */`
float wHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float wNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x),
             mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

// THE ONE-LINE TRAP THIS FILE FELL INTO ONCE: `onBeforeCompile` runs BEFORE
// three resolves `#include <...>`, so a `.replace()` aimed at a string that
// lives *inside* a ShaderChunk silently matches nothing and the patch is
// simply absent — no error, no warning. The second ripple octave was written
// that way and had never once executed. Splice the RESOLVED chunk in instead,
// and assert the substitution took, so a three upgrade breaks loudly.
const NORMAL_MAP_NEEDLE = 'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;';
const RIPPLE_CHUNK = (() => {
  const chunk = THREE.ShaderChunk.normal_fragment_maps;
  const patched = chunk.replace(NORMAL_MAP_NEEDLE, /* glsl */`
    // Two ripple octaves scrolling against each other — interference, not
    // slide. Local flow rotates the world-space advection into the channel
    // direction; uOff2 supplies slower cross-drift.
    vec2 flow = normalize(vWFlow + vec2(0.00001));
    vec2 across = vec2(-flow.y, flow.x);
    vec3 mapN1 = texture2D( normalMap, vNormalMapUv + across*uOff1.x + flow*uOff1.y ).xyz * 2.0 - 1.0;
    vec3 mapN2 = texture2D( normalMap, vNormalMapUv * 3.7 + across*uOff2.x + flow*uOff2.y ).xyz * 2.0 - 1.0;
    // Ripples are ~1 m across. Past ~50 m they are sub-pixel, and a tight
    // specular lobe over a sub-pixel normal field aliases into drifting
    // blotches — the whole reach read as curdled milk. Flatten the normals
    // with distance: the far water keeps its sheen and loses its speckle.
    float rippleLOD = mix( 0.30, 1.0, 1.0 - smoothstep( 45.0, 320.0, length( vViewPosition ) ) );
    vec3 mapN = normalize( vec3(
      ( mapN1.xy + mapN2.xy * 0.45 ) * ( 0.62 + 0.85 * vWTurb ) * rippleLOD, mapN1.z ) );
  `);
  if (patched === chunk) throw new Error('water.js: normal_fragment_maps no longer contains the ripple hook');
  return patched;
})();

function makeWaterMaterial(color, opacity, normalMap, opts = {}) {
  const m = new THREE.MeshPhongMaterial({
    color,
    shininess: 64,
    specular: 0xb9c6d0,
    transparent: true,
    depthWrite: false,
    forceSinglePass: true,
    opacity,
    normalMap,
    normalScale: new THREE.Vector2(0.18, 0.18),
    side: THREE.DoubleSide, // allow a view from beneath the surface too
  });
  // Flow is per MATERIAL, not per texture: every water body shares one normal
  // map, so animating `normalMap.offset` moved the Gauja, the streams, the
  // lakes and the mill pond as one diagonal slide across the parish. The
  // river now advects along its own course.
  m.userData.off1 = new THREE.Vector2();
  m.userData.off2 = new THREE.Vector2();
  m.userData.uvM = opts.uvM || 9;          // metres per normal-map tile
  m.userData.flow = opts.flow ?? 0;        // surface speed downstream, m/s
  m.userData.drift = opts.drift ?? 0.02;   // cross-drift of the second octave
  // Shallow water is the bed seen through a little tea-coloured water; deep
  // water is the body colour plus whatever the sky is doing. One colour for
  // both read as poster paint.
  m.userData.shallow = new THREE.Color(opts.shallow ?? 0x6f7a58);
  m.userData.shallowBase = m.userData.shallow.clone();
  m.userData.pondMask={value:0};m.userData.isPond=!!opts.pond;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOff1 = { value: m.userData.off1 };
    sh.uniforms.uOff2 = { value: m.userData.off2 };
    sh.uniforms.uShallow = { value: m.userData.shallow };
    sh.uniforms.uFoam = { value: opts.foam ?? 1 };
    sh.uniforms.uDepthK = { value: new THREE.Vector2(opts.dShallow ?? 0.10, opts.dDeep ?? 2.1) };
    sh.uniforms.uPondMask=m.userData.pondMask;
    sh.uniforms.uPondBounds={value:new THREE.Vector4(LOC.POND.x+4,LOC.POND.z,52,34)};
    sh.vertexShader = `attribute float aDepth;
attribute float aTurb;
attribute vec2 aFlow;
varying vec2 vWFlow;
varying float vWDepth;
varying float vWTurb;
varying vec3 vWPos;
` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vWDepth = aDepth;
  vWTurb = aTurb;
  vWFlow = aFlow;
  vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`);
    sh.fragmentShader = `uniform vec2 uOff1;
uniform vec2 uOff2;
uniform vec3 uShallow;
uniform vec2 uDepthK;
uniform float uFoam;
uniform float uPondMask;
uniform vec4 uPondBounds;
varying vec2 vWFlow;
varying float vWDepth;
varying float vWTurb;
varying vec3 vWPos;
${FOAM_GLSL}
` + sh.fragmentShader.replace('#include <normal_fragment_maps>', `${RIPPLE_CHUNK}
{
  // FRESNEL. Water is a mirror at grazing angles and nearly clear when you
  // look into it; without it the sky mix and the sun glitter land flat
  // across the surface, so a river seen from a bank or a low flight read
  // as white milk while the far reaches stayed dark — exactly inverted.
  // (Phong applies its reflectivity and specular lobe flat across a surface.)
  float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 5.0);
  specularStrength *= 0.035 + 0.965 * fres;

  // DEPTH. Baked per vertex off the same rendered bed the terrain draws, so
  // the shader and the geometry cannot disagree about where the shallows are.
  float dK = smoothstep(uDepthK.x, uDepthK.y, vWDepth);
  if(uPondMask>0.5 && length((vWPos.xz-uPondBounds.xy)/uPondBounds.zw)<1.0) discard;
  if (vWDepth < 0.008) discard;
  diffuseColor.rgb = mix(uShallow, diffuseColor.rgb, dK);
  // Optical thickness: the substrate remains visible in the shallows and
  // progressively disappears into tea-coloured water, not a flat blue decal.
  float absorption = 1.0 - exp(-max(vWDepth, 0.0) * 0.72);
  diffuseColor.a *= mix(0.18, 1.0, absorption);
  // ...but at a grazing angle even an inch of water is a mirror.
  diffuseColor.a = mix(diffuseColor.a, 1.0, fres * 0.8);

  // FOAM. A hem where the flow drags over the shallows, plus lace on the
  // broken water at the riffle crossings. Advected downstream with the flow.
  // Kept COARSE (half-metre cells and larger): fine-grained foam noise reads
  // as pixel speckle across the whole reach rather than as patches of froth,
  // and a river falling 1.1 m/km does not froth — it only laces its shallows.
  vec2 fp = vWPos.xz;
  float lace = wNoise(fp * 0.50 + uOff1 * 26.0) * 0.64
             + wNoise(fp * 1.45 + uOff2 * 6.0) * 0.36;
  float hem = 1.0 - smoothstep(0.03, 0.30 + lace * 0.30, vWDepth);
  float churn = smoothstep(0.52, 0.96, vWTurb);
  float foam = uFoam * clamp(hem * smoothstep(0.34, 0.74, lace) * 0.80
                           + churn * smoothstep(0.70, 0.94, lace) * 0.55, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.82, 0.80), foam);
  diffuseColor.a = clamp(diffuseColor.a + foam * 0.55, 0.0, 1.0);
  specularStrength *= 1.0 - 0.85 * foam;   // foam is rough; it does not glitter
}`);
  };
  return m;
}

const channelSeg = (chan) => Math.min(2600, chan.pts.length * 7);

// Shared coverage topology prevents folded surfaces at tight meanders.
function ribbon(rows, mat, uvM = 9) {
  return new THREE.Mesh(channelSurfaceGeometry(rows[0].chan, uvM), mat);
}

// ---------------------------------------------------------------- the bed ----
// The terrain paints a riverbed, but it paints it on a 17.2 m mesh, and the
// Gauja is 19 m wide: most cells crossing the channel have no vertex inside
// it at all, so the "bed" the terrain draws is largely interpolated meadow.
// That did not matter while the water was an opaque sheet. It matters now.
//
// So the channel gets its own bed, built from the SAME rows as the ribbon
// above it — silt in the pools, washed gravel over the riffle crossings,
// pale cobble on the point bars, soft mud in the slack reaches.
function bedTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6b6455';
    ctx.fillRect(0, 0, w, h);
    const sr = makeNoise(2027).rng;
    for (let i = 0; i < 1800; i++) {           // grit
      const g = 90 + sr() * 90;
      ctx.fillStyle = `rgba(${g},${(g * 0.95) | 0},${(g * 0.82) | 0},0.55)`;
      ctx.fillRect(sr() * w, sr() * h, 1 + sr() * 1.5, 1 + sr() * 1.5);
    }
    for (let i = 0; i < 150; i++) {            // water-rounded cobbles
      const g = 105 + sr() * 105;
      ctx.fillStyle = `rgba(${g},${(g * 0.97) | 0},${(g * 0.86) | 0},0.7)`;
      ctx.beginPath();
      ctx.ellipse(sr() * w, sr() * h, 1.4 + sr() * 2.6, 1.1 + sr() * 2.0, sr() * 3.14, 0, 7);
      ctx.fill();
    }
  });
}

function buildChannelBed(surface, material, name) {
  const geo=surface.geometry.clone(), p=geo.attributes.position;
  const colors=[],uvs=[], grain=makeNoise(2029);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),waterY=p.getY(i),ground=meshHeightAt(x,z);
    p.setY(i,Math.min(ground+.035,waterY-.04));
    const d=Math.max(0,waterY-ground), ch=bankCharAt(x,z);
    const k=smoothstep(2.2,.35,d), speck=(grain.noise2(x*.35,z*.35)-.5)*.045;
    colors.push(lerp(.115,.42,k)+ch.bar*.04+speck,lerp(.125,.39,k)+speck,lerp(.098,.31,k)+speck);
    uvs.push(x*.22,z*.22);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  for(const key of ['aDepth','aTurb','aFlow'])geo.deleteAttribute(key);
  geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;mesh.name=name;
  return mesh;
}

// Simple pond meshes still need the attributes the
// water shader declares — an unbound attribute reads as garbage on some
// drivers. One constant depth, no chop.
function fillWaterAttribs(geo, depth, turb = 0) {
  const n = geo.attributes.position.count;
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(new Float32Array(n).fill(depth), 1));
  geo.setAttribute('aTurb', new THREE.Float32BufferAttribute(new Float32Array(n).fill(turb), 1));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(Array.from({length:n*2},(_,i)=>i%2), 2));
}

export function skirtRows(rows, chan = rows[0]?.chan || RIVER) {
  if (!rows.length) return [];
  const SEG = Math.max(1, rows.length - 1);
  const bankNoise = makeNoise(881);
  const out = [];
  let pdx = 0, pdz = 0;
  for (let i = 0; i < rows.length; i++) {
    const t = i / SEG;
    const row = rows[i];
    const left = bankCharSideAt(row.x, row.z, 1, chan);
    const right = bankCharSideAt(row.x, row.z, -1, chan);
    const ch = bankCharAt(row.x, row.z);
    const W_IN = row.hw + 1.6;
    // organic shoreline: the sand band waxes and wanes (~45m wavelength)
    const baseBand = 1.1 + bankNoise.fbm(t * 380, 3.7, 3) * 4.4;
    let wOutLeft = W_IN + baseBand * (1 - 0.28 * left.mud) * (1 + 0.35 * left.bar) * left.apron;
    let wOutRight = W_IN + baseBand * (1 - 0.28 * right.mud) * (1 + 0.35 * right.bar) * right.apron;
    if (i > 0) {
      const dTheta = Math.acos(Math.min(1, Math.max(-1, row.dx * pdx + row.dz * pdz)));
      const radius = dTheta > 1e-4 ? (chan.length / SEG) / dTheta : 1e9;
      const limit = Math.max(W_IN + 0.4, radius * 0.85);
      wOutLeft = Math.min(wOutLeft, limit);
      wOutRight = Math.min(wOutRight, limit);
    }
    pdx = row.dx; pdz = row.dz;
    // Tributary skirts taper cleanly into receivers and wet hollow ends.
    const taper = chan === RIVER ? 1 : 1 - row.mouthFactor;
    wOutLeft = W_IN + (wOutLeft - W_IN) * taper;
    wOutRight = W_IN + (wOutRight - W_IN) * taper;
    // Receiver apron notch: collapse only the bank the tributary enters.
    if (chan === RIVER) {
      for (const mouth of CONFLUENCES) {
        if (mouth.type !== 'river' || mouth.receiver !== RIVER) continue;
        const along = Math.abs(row.s - mouth.receiverS);
        const throat = mouth.channel.samples[mouth.channel.samples.length - 1][3] + 4;
        if (along < throat) {
          const k = smoothstep(throat, throat * 0.65, along);
          if (mouth.bankSide > 0) wOutLeft = lerp(wOutLeft, W_IN, k);
          else wOutRight = lerp(wOutRight, W_IN, k);
        }
      }
    }
    out.push({ W_IN, wOut: Math.max(wOutLeft, wOutRight), wOutLeft, wOutRight, ch, left, right });
  }
  // smooth the clamp: abrupt width changes twist the quads
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < out.length - 1; i++) {
      for (const key of ['wOutLeft', 'wOutRight']) {
        const avg = (out[i - 1][key] + out[i][key] + out[i + 1][key]) / 3;
        const mayCollapse = rows[i].lake || rows[i].mouthFactor > 0 || chan === RIVER;
        out[i][key] = Math.max(out[i].W_IN + (mayCollapse ? 0 : 0.4), Math.min(out[i][key], avg));
      }
      out[i].wOut = Math.max(out[i].wOutLeft, out[i].wOutRight);
    }
  }
  let lakeK = rows.map((row) => (row.lake ? 1 : 0));
  for (let pass = 0; pass < 2; pass++) {
    const next = new Array(lakeK.length);
    for (let i = 0; i < lakeK.length; i++) {
      let sum = 0, n = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(lakeK.length - 1, i + 2); j++) {
        sum += lakeK[j]; n++;
      }
      next[i] = sum / n;
    }
    lakeK = next;
  }
  for (let i = 0; i < out.length; i++) {
    if (rows[i].lake) out[i].wOutLeft = out[i].wOutRight = out[i].W_IN;
    else {
      out[i].wOutLeft = out[i].W_IN + (out[i].wOutLeft - out[i].W_IN) * (1 - lakeK[i]);
      out[i].wOutRight = out[i].W_IN + (out[i].wOutRight - out[i].W_IN) * (1 - lakeK[i]);
    }
    out[i].wOut = Math.max(out[i].wOutLeft, out[i].wOutRight);
  }
  return out;
}

// Bank coverage follows the same channel field as the surface. Draping on
// the actual terrain removes the raised, folded tan retaining-wall strips.
function buildChannelBank(rows,chan,material,edgeDrop,name){
  const geo=channelSurfaceGeometry(chan,5.5,{bank:true}),p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),q=channelAt(chan,x,z),ch=bankCharAt(x,z);
    const edge=clamp01((q.d-q.hw-.75)/3.6),wet=clamp01((q.level+.15-p.getY(i))/.8);
    colors.push(lerp(.34,.30,edge)-wet*.08+ch.bar*.05,lerp(.30,.34,edge)-wet*.04,lerp(.22,.20,edge)-wet*.05);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  for(const key of ['aDepth','aFlow','aTurb'])geo.deleteAttribute(key);
  const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;mesh.name=name;return mesh;
}
function buildBankDetails(rows, chan) {
  const widths = skirtRows(rows, chan);
  const positions = [], colors = [], indices = [];
  let made = 0;
  for (let i = 4; i + 2 < rows.length - 4; i += 11) {
    const a = rows[i], b = rows[i + 2];
    if (a.lake || b.lake || a.mouthFactor || b.mouthFactor || inConfluenceMask(a.x, a.z, 8)) continue;
    if (CONFLUENCES.some((m) => m.receiver === chan && Math.abs(a.s - m.receiverS) < 22)) continue;
    const left = widths[i].left, right = widths[i].right;
    const side = left.erosion > right.erosion ? 1 : -1;
    const ch = side > 0 ? left : right;
    if (ch.erosion < 0.62 || ch.bar > 0.55) continue;
    const base = positions.length / 3;
    for (const [row, wi] of [[a, widths[i]], [b, widths[i + 2]]]) {
      const nx = -row.dz * side, nz = row.dx * side;
      const wOut = side > 0 ? wi.wOutLeft : wi.wOutRight;
      const landX = row.x + nx * wOut, landZ = row.z + nz * wOut;
      const lipR = wi.W_IN + Math.min(0.55, Math.max(0.18, (wOut - wi.W_IN) * 0.22));
      const lipX = row.x + nx * lipR, lipZ = row.z + nz * lipR;
      const topY = Math.max(row.y + 0.08, Math.min(meshHeightAt(landX, landZ) + 0.04, row.y + 0.55));
      positions.push(landX, topY, landZ, lipX, topY - 0.02, lipZ, lipX, row.y - 0.18, lipZ);
      colors.push(0.25, 0.31, 0.15, 0.30, 0.36, 0.18, 0.20, 0.15, 0.10);
    }
    indices.push(
      base, base + 3, base + 4, base, base + 4, base + 1,
      base + 1, base + 4, base + 5, base + 1, base + 5, base + 2);
    // Every fourth lip gets a short, safely landward slump wedge.
    if ((made++ & 3) === 0) indices.push(base, base + 2, base + 5, base, base + 5, base + 3);
  }
  if (!positions.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.name = `${chan.name || 'channel'}:bankdetails`;
  return mesh;
}

// Subdivide the triangulated shoreline without changing its mapped outline.
// Depth is then sampled across the basin, rather than assigning 1.7 m to
// every vertex of a handful of lake-spanning triangles.
function lakeSurfaceGeometry(shape, level, tileMetres=14) {
  const base=new THREE.ShapeGeometry(shape), p=base.attributes.position, index=base.index;
  const positions=[], uv=[], depths=[];
  const emit=(a,b,c,n=0)=>{
    const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
    if(n<8 && Math.max(dist(a,b),dist(b,c),dist(c,a))>28){
      const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
      const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      emit(a,ab,ca,n+1);emit(ab,b,bc,n+1);emit(ca,bc,c,n+1);emit(ab,bc,ca,n+1);return;
    }
    for(const [x,ny] of [a,b,c]){
      const z=-ny;positions.push(x,0,z);uv.push(x/tileMetres,z/tileMetres);
      depths.push(Math.max(.03,level-meshHeightAt(x,z)));
    }
  };
  for(let i=0;i<index.count;i+=3)emit(...[0,1,2].map(k=>{const j=index.getX(i+k);return[p.getX(j),p.getY(j)];}));
  base.dispose();
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aDepth',new THREE.Float32BufferAttribute(depths,1));
  g.setAttribute('aTurb',new THREE.Float32BufferAttribute(depths.map(()=>0),1));
  g.setAttribute('aFlow',new THREE.Float32BufferAttribute(positions.flatMap((_,i)=>i%3===0?[0,1]:[]),2));
  g.computeVertexNormals();return g;
}

export function buildWater() {
  const group = new THREE.Group();
  group.name = 'water';
  const mats = [];
  const normalMap = waterNormalTex();
  let sandTex = null;                    // baked in the river-skirt block, reused by lake collars
  // one bed material shared by the Gauja and every brook
  const bedMat = new THREE.MeshLambertMaterial({
    map: bedTexture(), vertexColors: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  // --- lakes from OSM polygons
  // Through-flow lakes: quiet surfaces over inferred, depth-sampled basins.
  const LAKE_UV_M = 14;
  const lakeMat = makeWaterMaterial(0x2f4c58, 0.90, normalMap, {
    uvM: LAKE_UV_M, flow: 0.035, drift: 0.012, foam: 0, dShallow: 0.1, dDeep: 1.2,
  });
  mats.push(lakeMat);
  // OSM lake outlines are sparse polygons — Chaikin-smooth the shoreline
  // or the basins read as blocky cut gems
  const chaikin = (poly) => chaikinPoly(poly);
  for (const lake of LAKES) {
    // store as (x, -z) so that rotateX(-PI/2) lands on (x, z) with the normal up
    const shape = new THREE.Shape(chaikin(lake.poly).map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = lakeSurfaceGeometry(shape, lake.level);
    const mesh = new THREE.Mesh(geo, lakeMat);
    mesh.position.y = lake.level;
    mesh.name = lake.name || 'lake';
    // uv for shimmer — 260 m per tile meant a single ripple stretched across
    // the whole basin, i.e. no visible surface at all
    mesh.renderOrder = 2;
    group.add(mesh);
  }

  // --- the Gauja
  // The young Gauja here falls 18.5 m over 16.7 km of mapped course — 1.1 m/km,
  // a quiet lowland river. Surface speed ~0.45 m/s; no whitewater, but the
  // riffle crossings chop and the shallows over the point bars hem with foam.
  const riverMat = makeWaterMaterial(0x2e4a55, 0.90, normalMap, {
    uvM: 9, flow: 0.45, drift: 0.035, shallow: 0x74764f, dShallow: 0.10, dDeep: 2.1, foam: 0.4,
  });
  mats.push(riverMat);
  // rim 0.35: the 0.5m dark wall showed through the transparent surface
  // from the far bank as a black outline around every reach
  const riverRows = channelRows(RIVER, channelSeg(RIVER));
  const river = ribbon(riverRows, riverMat, 9);
  group.add(buildChannelBed(river, bedMat, 'gauja:bed'));
  river.renderOrder = 1;
  river.name = 'gauja';
  group.add(river);
  // Water-rounded stones on submerged shallow gravel, not scattered across
  // deep pools or lake surfaces. One instanced draw for the entire channel.
  const sr=makeNoise(3817).rng, stones=[];
  for(let i=2;i<riverRows.length;i+=3){
    const row=riverRows[i];if(row.lake || row.mouthFactor>.25)continue;
    for(let j=0;j<3;j++){
      const off=(sr()-.5)*row.hw*1.8,x=row.x-row.dz*off,z=row.z+row.dx*off;
      const y=meshHeightAt(x,z),depth=row.y-y;
      if(depth<.18 || depth>1.25 || lakeAt(x,z))continue;
      const size=.055+sr()*.16;stones.push({x,y:y+.035,z,size,rot:sr()*6.28});
    }
  }
  const pebbles=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,5),new THREE.MeshLambertMaterial({color:0x898273}),stones.length);
  const stoneDummy=new THREE.Object3D(),stoneColor=new THREE.Color();
  stones.forEach((p,i)=>{
    stoneDummy.position.set(p.x,p.y,p.z);stoneDummy.rotation.set(0,p.rot,0);stoneDummy.scale.set(p.size,p.size*.48,p.size*.76);stoneDummy.updateMatrix();pebbles.setMatrixAt(i,stoneDummy.matrix);
    stoneColor.setScalar(.68+sr()*.4);pebbles.setColorAt(i,stoneColor);
  });
  pebbles.name='gauja:submerged-cobbles';pebbles.receiveShadow=true;group.add(pebbles);

  // Substrate texture is shared by the low, terrain-draped bank collars.
  sandTex=bedTexture();
  const riverBankMaterial=new THREE.MeshLambertMaterial({map:sandTex,vertexColors:true,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  group.add(buildChannelBank(riverRows,RIVER,riverBankMaterial,0,'bankskirt'));
  const riverDetails = buildBankDetails(riverRows, RIVER);
  if (riverDetails) group.add(riverDetails);

  // --- streams
  // The brooks are steep by comparison (the unnamed one falls 12.9 m in
  // 1.9 km, 6.9 m/km) and shallow: broken, hurrying, foam-flecked water.
  const streamMat = makeWaterMaterial(0x314f58, 0.92, normalMap, {
    uvM: 3.6, flow: 0.75, drift: 0.05, shallow: 0x7b7a4e, dShallow: 0.06, dDeep: 0.95, foam: 0.85,
  });
  mats.push(streamMat);
  const streamBankMat = new THREE.MeshLambertMaterial({
    map: sandTex, vertexColors: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  for (let i = 0; i < STREAM_CHANNELS.length; i++) {
    const chan = STREAM_CHANNELS[i];
    const rows = channelRows(chan, channelSeg(chan));
    const st = ribbon(rows, streamMat, 3.6);
    group.add(buildChannelBed(st, bedMat, `${STREAMS[i].name || 'stream'}:bed`));
    st.name = STREAMS[i].name || 'stream';
    group.add(st);
    group.add(buildChannelBank(rows, chan, streamBankMat, 0.5, `${st.name}:bankskirt`));
  }

  // --- LAKE BANK COLLARS: the wet-sand shore band the river always had.
  // One strip per lake along the Chaikin shoreline: inner rim tucked under
  // the water sheet, outer edge draped on the terrain with a noise- and
  // character-driven width (mud reaches narrow, gravel bars wide), fringe
  // colours pulled toward the meadow so the band DISSOLVES into grass.
  {
    const collarNoise = makeNoise(1213);
    const collarMat = new THREE.MeshLambertMaterial({
      map: sandTex, vertexColors: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    for (const lake of LAKE_SHORES) {
      const poly = lake.poly, N = poly.length;
      // outward = the side lakeAt says is dry (empirical beats winding math)
      let nxs = -(poly[1][1] - poly[N - 1][1]), nzs = poly[1][0] - poly[N - 1][0];
      const nl0 = Math.hypot(nxs, nzs) || 1;
      const outSign = lakeAt(poly[0][0] + (nxs / nl0) * 3, poly[0][1] + (nzs / nl0) * 3) ? -1 : 1;
      const positions = [], colors = [], uvsA = [], indices = [], collapsedRows = [];
      let s = 0;
      for (let i = 0; i <= N; i++) {
        const i0 = i % N;
        const prev = poly[(i0 - 1 + N) % N], cur = poly[i0], next = poly[(i0 + 1) % N];
        let tx = next[0] - prev[0], tz = next[1] - prev[1];
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl; tz /= tl;
        const nx = -tz * outSign, nz = tx * outSign;
        s += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) * 0.5;
        const ch = bankCharAt(cur[0], cur[1]);
        let w = (2.1 + collarNoise.fbm(s * 0.045, lake.level * 0.13, 3) * 3.4)
          * (1 - 0.35 * ch.mud) * (1 + 0.45 * ch.bar);
        // a river mouth brings its own treatment — collapse the collar there
        const rv = riverAt(cur[0], cur[1]);
        const st = streamAt(cur[0], cur[1]);
        const collapsed = (rv && rv.d < rv.hw + 4) || (st && st.d < st.hw + 4);
        if (collapsed) w = 0;
        collapsedRows.push(!!collapsed);
        const midX = cur[0] + nx * w * 0.35, midZ = cur[1] + nz * w * 0.35;
        const outX = cur[0] + nx * w, outZ = cur[1] + nz * w;
        const gMid = Math.min(Math.max(meshHeightAt(midX, midZ) + 0.03, lake.level + 0.02), lake.level + 0.35);
        const gOut = Math.min(Math.max(meshHeightAt(outX, outZ) + 0.03, lake.level - 0.25), lake.level + 0.7);
        positions.push(
          cur[0], lake.level - 0.3, cur[1],
          midX, gMid, midZ,
          outX, gOut, outZ);
        const wet = mix3(mix3([0.62, 0.55, 0.42], [0.30, 0.27, 0.19], ch.mud), [0.58, 0.55, 0.47], ch.bar * 0.7);
        const dry = mix3(mix3([0.78, 0.70, 0.53], [0.52, 0.46, 0.34], ch.mud * 0.6), [0.62, 0.58, 0.50], ch.bar);
        const fringe = mix3([0.60, 0.65, 0.42], [0.45, 0.52, 0.30], 0.55 + 0.3 * ch.mud);
        colors.push(...wet, ...dry, ...fringe);
        uvsA.push(cur[0] * 0.18, cur[1] * 0.18, midX * 0.18, midZ * 0.18, outX * 0.18, outZ * 0.18);
        if (i > 0 && !collapsedRows[i] && !collapsedRows[i - 1]) {
          const a2 = (i - 1) * 3;
          for (const [o0, o1] of [[0, 1], [1, 2]]) {
            indices.push(a2 + o0, a2 + o1, a2 + o1 + 3, a2 + o0, a2 + o1 + 3, a2 + o0 + 3);
          }
        }
      }
      // force CCW seen from above — the river skirt's hard-won rule: with
      // DoubleSide, downward-wound quads light from below and render black
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
        const abx = positions[b] - positions[a], abz = positions[b + 2] - positions[a + 2];
        const acx = positions[c] - positions[a], acz = positions[c + 2] - positions[a + 2];
        if (abz * acx - abx * acz < 0) {
          const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvsA, 2));
      geo.setIndex(indices);
      const nrm = new Float32Array(positions.length);
      for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1;   // ground lights as ground
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      const collar = new THREE.Mesh(geo, collarMat);
      collar.receiveShadow = true;
      collar.name = 'lakebank';
      group.add(collar);
    }
  }

  // --- mill pond on the Gauja bend (added/removed by era manager; eras 3-4)
  // A held millpond is the stillest water in the parish — barely a drift.
  const pondMat = makeWaterMaterial(0x2f4e57, 0.94, normalMap, {
    uvM: 10, flow: 0.02, drift: 0.008, foam: 0, dShallow: 0.1, dDeep: 1.0, pond:true,
  });
  mats.push(pondMat);
  const pondLevel = LOC.POND_LEVEL;
  const pondShape=new THREE.Shape(Array.from({length:64},(_,i)=>{
    const a=i*Math.PI/32;return new THREE.Vector2(LOC.POND.x+4+52*Math.cos(a),-LOC.POND.z+34*Math.sin(a));
  }));
  const pondGeo=lakeSurfaceGeometry(pondShape,pondLevel,10);
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.position.y=pondLevel;
  pond.name = 'pond';
  pond.visible = false;
  group.add(pond);

  function tick(t) {
    for (const m of mats) {
      const { uvM, flow, drift } = m.userData;
      // Sample AHEAD of the flow so the pattern travels with it: v is arc
      // length downstream, so a negative v offset moves the ripples down the
      // course. Speeds are metres per second, converted into tile space.
      m.userData.off1.set(drift * t / uvM, -flow * t / uvM);
      // Second octave: 3.7x finer, running slower and crabbing across the
      // flow, so the two interfere instead of sliding as one sheet.
      m.userData.off2.set(-drift * 2.1 * t * 3.7 / uvM, -flow * 0.62 * t * 3.7 / uvM);
    }
  }
  // glacial-era meltwater is milky with rock flour
  const original = mats.map((m) => m.color.clone());
  function setEra(era) {
    mats.forEach((m, i) => {
      m.userData.pondMask.value=(era===3||era===4)&&!m.userData.isPond?1:0;
      if (era === 0) {
        m.color.set(0x8fb6ba);
        m.userData.shallow.set(0xa8c4c2);   // suspended rock flour, not a stony bed
      } else {
        m.color.copy(original[i]);
        m.userData.shallow.copy(m.userData.shallowBase);
      }
    });
  }
  // sky reflections from an occasionally-refreshed cubemap
  function applyEnvMap(tex) {
    for (const m of mats) {
      m.envMap = tex;
      m.combine = THREE.MixOperation;
      // near-full mirror at the horizon; the Fresnel term above is what keeps
      // it from washing out the water you are standing over
      m.reflectivity = 0.62;
      m.needsUpdate = true;
    }
  }
  return { group, pond, pondLevel, tick, setEra, applyEnvMap };
}
