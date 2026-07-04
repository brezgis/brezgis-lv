// Procedural material library — every surface is generated, nothing loaded.
import * as THREE from 'three';
import { canvasTexture, makeNoise } from './util.js';

const n = makeNoise(808);

export const TEX = {};
export const MAT = {};

function grainStreaks(ctx, w, h, base, streak, count, horizontal = true) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = streak;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const p = Math.random() * (horizontal ? h : w);
    ctx.globalAlpha = 0.12 + Math.random() * 0.2;
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(0, p); ctx.lineTo(w, p + (Math.random() - 0.5) * 6); }
    else { ctx.moveTo(p, 0); ctx.lineTo(p + (Math.random() - 0.5) * 6, h); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function initTextures() {
  // horizontal log wall
  TEX.log = canvasTexture(256, 256, (ctx, w, h) => {
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const shade = 96 + ((r * 37) % 3) * 14 + n.noise2(r * 3.1, 0) * 26;
      ctx.fillStyle = `rgb(${shade + 22},${shade - 6},${(shade * 0.55) | 0})`;
      ctx.fillRect(0, r * rh, w, rh);
      grainStreaks(ctx, w, rh, 'rgba(0,0,0,0)', 'rgba(40,22,8,0.8)', 14, true);
      ctx.fillStyle = 'rgba(28,16,6,0.85)';
      ctx.fillRect(0, r * rh, w, 2.2);                          // gap between logs
      ctx.fillStyle = 'rgba(230,220,190,0.28)';
      ctx.fillRect(0, r * rh + 3, w, 1.4);                      // moss caulking glint
    }
  }, { repeat: [2, 1] });

  // grey weathered log (older buildings)
  TEX.logOld = canvasTexture(256, 256, (ctx, w, h) => {
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const shade = 105 + n.noise2(r * 5.7, 3) * 24;
      ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 14})`;
      ctx.fillRect(0, r * rh, w, rh);
      grainStreaks(ctx, w, rh, 'rgba(0,0,0,0)', 'rgba(30,28,20,0.9)', 16, true);
      ctx.fillStyle = 'rgba(20,18,12,0.9)';
      ctx.fillRect(0, r * rh, w, 2);
    }
  }, { repeat: [2, 1] });

  // thatch (reed/straw)
  TEX.thatch = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8a713f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w, y = Math.random() * h, l = 12 + Math.random() * 26;
      const g = 90 + Math.random() * 90;
      ctx.strokeStyle = `rgba(${g + 40},${g},${(g * 0.45) | 0},0.5)`;
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 4, y + l); ctx.stroke();
    }
    // layered course shadows
    for (let y = 0; y < h; y += 42) {
      ctx.fillStyle = 'rgba(50,36,14,0.35)';
      ctx.fillRect(0, y, w, 5);
    }
  }, { repeat: [3, 2] });

  // old dark thatch
  TEX.thatchOld = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6a5a38';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w, y = Math.random() * h, l = 12 + Math.random() * 24;
      const g = 60 + Math.random() * 80;
      ctx.strokeStyle = `rgba(${g + 20},${g},${(g * 0.5) | 0},0.5)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 5, y + l); ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {                              // moss patches
      ctx.fillStyle = `rgba(${60 + Math.random() * 30},${90 + Math.random() * 40},40,0.25)`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 16, 5 + Math.random() * 8, 0, 0, 7);
      ctx.fill();
    }
  }, { repeat: [3, 2] });

  // wood shingles
  TEX.shingle = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7d6a52';
    ctx.fillRect(0, 0, w, h);
    const rows = 10, rh = h / rows, sw = 20;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * sw * 0.5;
      for (let x = -1; x < w / sw + 1; x++) {
        const g = 100 + Math.random() * 55;
        ctx.fillStyle = `rgb(${g + 14},${g - 2},${(g * 0.72) | 0})`;
        ctx.fillRect(x * sw + off + 1, r * rh, sw - 2, rh - 1.5);
      }
      ctx.fillStyle = 'rgba(25,18,10,0.55)';
      ctx.fillRect(0, r * rh + rh - 2, w, 2);
    }
  }, { repeat: [3, 2] });

  // red clay tile (manor)
  TEX.tile = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#96412c';
    ctx.fillRect(0, 0, w, h);
    const rows = 9, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let x = 0; x < 12; x++) {
        const g = Math.random() * 26;
        ctx.fillStyle = `rgb(${150 + g},${66 + g * 0.6},${44})`;
        ctx.fillRect(x * (w / 12) + 1, r * rh, w / 12 - 2, rh - 2);
      }
      ctx.fillStyle = 'rgba(60,20,12,0.6)';
      ctx.fillRect(0, r * rh + rh - 2, w, 2);
    }
  }, { repeat: [4, 2] });

  // plaster
  TEX.plaster = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e4d9bc';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const g = Math.random() * 40;
      ctx.fillStyle = `rgba(${180 - g},${170 - g},${140 - g},0.25)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });

  // vertical planks (1930s siding)
  TEX.plank = canvasTexture(256, 256, (ctx, w, h) => {
    const cols = 10, cw = w / cols;
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const g = 122 + Math.random() * 30;
      ctx.fillStyle = `rgb(${g + 24},${g - 4},${(g * 0.6) | 0})`;
      ctx.fillRect(cIdx * cw, 0, cw, h);
      grainStreaks(ctx, cw, h, 'rgba(0,0,0,0)', 'rgba(40,24,10,0.7)', 8, false);
      ctx.fillStyle = 'rgba(30,18,8,0.8)';
      ctx.fillRect(cIdx * cw, 0, 2, h);
    }
  }, { repeat: [2, 1] });

  // fieldstone
  TEX.stone = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8d857a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const g = 105 + Math.random() * 70;
      ctx.fillStyle = `rgb(${g},${g - 4},${g - 12})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 18, 6 + Math.random() * 12, Math.random() * 3, 0, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(48,44,38,0.7)';
      ctx.stroke();
    }
  }, { repeat: [2, 2] });

  const L = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra });
  MAT.log = L(TEX.log);
  MAT.logOld = L(TEX.logOld);
  MAT.thatch = L(TEX.thatch);
  MAT.thatchOld = L(TEX.thatchOld);
  MAT.shingle = L(TEX.shingle);
  MAT.tile = L(TEX.tile);
  MAT.plaster = L(TEX.plaster);
  MAT.plank = L(TEX.plank);
  MAT.stone = L(TEX.stone);
  MAT.darkWood = new THREE.MeshLambertMaterial({ color: 0x4a3826 });
  MAT.lightWood = new THREE.MeshLambertMaterial({ color: 0xa88a5c });
  MAT.white = new THREE.MeshLambertMaterial({ color: 0xf2ede0 });
  MAT.door = new THREE.MeshLambertMaterial({ color: 0x352718 });
  MAT.glass = new THREE.MeshPhongMaterial({ color: 0x8fa8b8, shininess: 160, specular: 0xffffff });
  MAT.hay = new THREE.MeshLambertMaterial({ color: 0xb59a54 });
  MAT.iron = new THREE.MeshLambertMaterial({ color: 0x3a3a3c });
  MAT.cloth = new THREE.MeshLambertMaterial({ color: 0xe9e2ce, side: THREE.DoubleSide });
  MAT.flagRed = new THREE.MeshLambertMaterial({ color: 0x9e1b34, side: THREE.DoubleSide });
}
