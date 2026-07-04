// Boot-time atlas capture (LAAS FoliageCards/Impostors, WebGL edition):
// real leaf/needle twig meshes are rendered ONCE into a per-species 2×2
// atlas; whole finished trees are rendered once into an impostor atlas for
// the far tier. Albedo goes in sqrt-encoded (8-bit linear murders dark
// greens) and is decoded by squaring in the sampling material; transparent
// texels are colour-dilated on the CPU so mips don't grow dark halos.
import * as THREE from 'three';
import { MeshGrower, buildTwigTile, makeRng } from './treegen.js';

export const TWIG_RES = 512;

function dilate(px, w, h, passes) {
  const idx = (x, y) => (y * w + x) * 4;
  for (let p = 0; p < passes; p++) {
    const src = px.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = idx(x, y);
        if (src[i + 3] > 8) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = idx(xx, yy);
            if (src[j + 3] > 8) { r += src[j]; g += src[j + 1]; b += src[j + 2]; n++; }
          }
        }
        if (n > 0) {
          px[i] = (r / n) | 0; px[i + 1] = (g / n) | 0; px[i + 2] = (b / n) | 0;
          px[i + 3] = 9;
        }
      }
    }
  }
  for (let i = 3; i < px.length; i += 4) if (px[i] <= 9) px[i] = 0;
}

function toDataTexture(px, w, h) {
  const tex = new THREE.DataTexture(px, w, h);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  tex.flipY = false; // WebGL readPixels rows are already bottom-up
  return tex;
}

function withCaptureState(renderer, fn) {
  const prevTarget = renderer.getRenderTarget();
  const prevTone = renderer.toneMapping;
  const prevClear = new THREE.Color();
  renderer.getClearColor(prevClear);
  const prevAlpha = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x000000, 0);
  try { fn(); } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.toneMapping = prevTone;
    renderer.shadowMap.enabled = prevShadow;
    renderer.setClearColor(prevClear, prevAlpha);
  }
}

/** per-species 2×2 twig-variant atlas of real leaf/needle meshes */
export function captureTwigAtlas(renderer, sp, seed) {
  const g = new MeshGrower();
  const rng = makeRng(seed);
  for (let v = 0; v < 4; v++) {
    buildTwigTile(g, sp, rng, (v % 2) - 0.5, Math.floor(v / 2) - 0.5);
  }
  const geo = g.build();
  // sqrt-encode the linear albedo for 8-bit storage
  const col = geo.attributes.color;
  for (let i = 0; i < col.count * 3; i++) col.array[i] = Math.sqrt(Math.min(1, col.array[i]));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.set(0, 0, 5);
  cam.lookAt(0, 0, 0);

  const rt = new THREE.WebGLRenderTarget(TWIG_RES, TWIG_RES);
  const px = new Uint8Array(TWIG_RES * TWIG_RES * 4);
  withCaptureState(renderer, () => {
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, TWIG_RES, TWIG_RES, px);
  });
  rt.dispose(); geo.dispose(); mat.dispose();
  dilate(px, TWIG_RES, TWIG_RES, 5);
  return toDataTexture(px, TWIG_RES, TWIG_RES);
}

/**
 * Impostor atlas: each entry's finished tree (bark + cards meshes) rendered
 * lit from a fixed noon-ish sun into one column of a wide atlas. Returns
 * { texture, tiles: [{u0, u1, halfW, height}] } for far-tier cross-quads.
 */
export function captureImpostorAtlas(renderer, entries, res = 2048) {
  const cols = entries.length;
  const tileW = Math.floor(res / cols), tileH = 512;
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.9);
  sun.position.set(60, 90, 100);
  const hemi = new THREE.HemisphereLight(0xbcd4e8, 0x51603e, 0.75);
  scene.add(sun, hemi);
  const holder = new THREE.Group();
  scene.add(holder);

  const rt = new THREE.WebGLRenderTarget(res, tileH);
  const px = new Uint8Array(res * tileH * 4);
  const tiles = [];
  withCaptureState(renderer, () => {
    renderer.setRenderTarget(rt);
    renderer.clear();
    entries.forEach((e, i) => {
      holder.clear();
      for (const m of e.meshes) holder.add(m);
      const halfW = Math.max(e.halfW, e.height * (tileW / tileH) / 2 * 0.999);
      const height = Math.max(e.height, halfW * 2 * (tileH / tileW) * 0.999);
      const cam = new THREE.OrthographicCamera(-halfW, halfW, height, 0, 0.1, 400);
      cam.position.set(0, 0, 120);
      cam.lookAt(0, 0, 0);
      renderer.setViewport(i * tileW, 0, tileW, tileH);
      renderer.setScissor(i * tileW, 0, tileW, tileH);
      renderer.setScissorTest(true);
      renderer.render(scene, cam);
      tiles.push({ u0: i / cols, u1: (i + 1) / cols, halfW, height });
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
    renderer.readRenderTargetPixels(rt, 0, 0, res, tileH, px);
  });
  rt.dispose();
  holder.clear();
  dilate(px, res, tileH, 4);
  return { texture: toDataTexture(px, res, tileH), tiles };
}
