// Procedural material library — every surface is generated, nothing loaded.
import * as THREE from 'three';
import { canvasTexture, makeNoise, mulberry32 } from './util.js';

const n = makeNoise(808);
let random = mulberry32(808);

export const TEX = {};
export const MAT = {};

function grainStreaks(ctx, w, h, base, streak, count, horizontal = true) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = streak;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const p = random() * (horizontal ? h : w);
    ctx.globalAlpha = 0.12 + random() * 0.2;
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(0, p); ctx.lineTo(w, p + (random() - 0.5) * 6); }
    else { ctx.moveTo(p, 0); ctx.lineTo(p + (random() - 0.5) * 6, h); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function initTextures() {
  if (MAT.log) return;
  random = mulberry32(808);
  // horizontal log wall
  TEX.log = canvasTexture(256, 256, (ctx, w, h) => {
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const shade = 105 + n.noise2(r * 3.1, 0) * 18;
      ctx.fillStyle = `rgb(${shade + 12},${shade + 1},${shade - 17})`;
      ctx.fillRect(0, r * rh, w, rh);
      ctx.save(); ctx.translate(0, r * rh);
      grainStreaks(ctx, w, rh, 'rgba(0,0,0,0)', 'rgba(40,22,8,0.8)', 14, true);
      ctx.restore();
      ctx.fillStyle = 'rgba(38,31,22,0.55)';
      ctx.fillRect(0, r * rh, w, 1.5);
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
      ctx.save(); ctx.translate(0, r * rh);
      grainStreaks(ctx, w, rh, 'rgba(0,0,0,0)', 'rgba(30,28,20,0.9)', 16, true);
      ctx.restore();
      ctx.fillStyle = 'rgba(20,18,12,0.9)';
      ctx.fillRect(0, r * rh, w, 2);
    }
  }, { repeat: [2, 1] });

  // thatch (reed/straw)
  TEX.thatch = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#82765b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = random() * w, y = random() * h, l = 12 + random() * 26;
      const g = 90 + random() * 90;
      ctx.strokeStyle = `rgba(${g + 20},${g + 8},${g * 0.74},0.35)`;
      ctx.lineWidth = 1 + random();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (random() - 0.5) * 4, y + l); ctx.stroke();
    }
    // layered course shadows
    for (let y = 0; y < h; y += h / 6) {
      ctx.fillStyle = 'rgba(50,36,14,0.35)';
      ctx.fillRect(0, y, w, 5);
    }
  }, { repeat: [3, 2] });

  // old dark thatch
  TEX.thatchOld = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6a5a38';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = random() * w, y = random() * h, l = 12 + random() * 24;
      const g = 60 + random() * 80;
      ctx.strokeStyle = `rgba(${g + 20},${g},${(g * 0.5) | 0},0.5)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (random() - 0.5) * 5, y + l); ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {                              // moss patches
      ctx.fillStyle = `rgba(${60 + random() * 30},${90 + random() * 40},40,0.25)`;
      ctx.beginPath();
      ctx.ellipse(random() * w, random() * h, 8 + random() * 16, 5 + random() * 8, 0, 0, 7);
      ctx.fill();
    }
  }, { repeat: [3, 2] });

  // birch/spruce bark roof sheets (Āraiši roofing)
  TEX.bark = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6e5c46';
    ctx.fillRect(0, 0, w, h);
    // large overlapping bark sheets
    for (let i = 0; i < 26; i++) {
      const x = random() * w, y = random() * h;
      const sw = 40 + random() * 60, sh = 26 + random() * 34;
      const g = 88 + random() * 46;
      ctx.fillStyle = `rgb(${g + 18},${g - 2},${(g * 0.68) | 0})`;
      ctx.fillRect(x - sw / 2, y - sh / 2, sw, sh);
      ctx.strokeStyle = 'rgba(30,22,12,0.5)';
      ctx.strokeRect(x - sw / 2, y - sh / 2, sw, sh);
    }
    grainStreaks(ctx, w, h, 'rgba(0,0,0,0)', 'rgba(230,220,200,0.35)', 18, true); // birch-bark pale streaks
  }, { repeat: [2, 2] });

  // two-tone brick (the 1888 neo-Renaissance new manor)
  TEX.brick = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#a49883';
    ctx.fillRect(0, 0, w, h);
    const rows = 16, rh = h / rows, bw = 32;
    for (let r = 0; r < rows; r++) {
      const band = r % 5 === 0; // lighter decorative band courses
      for (let c = -1; c < w / bw + 1; c++) {
        const off = (r % 2) * bw * 0.5;
        const g = band ? 190 + random() * 20 : 118 + random() * 24;
        ctx.fillStyle = band
          ? `rgb(${g},${g - 14},${g - 40})`
          : `rgb(${g + 30},${(g * 0.52) | 0},${(g * 0.36) | 0})`;
        ctx.fillRect(c * bw + off + 1, r * rh + 1, bw - 2, rh - 2);
      }
    }
  }, { repeat: [6, 3] });

  // wood shingles
  TEX.shingle = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7d6a52';
    ctx.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows, sw = 32;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * sw * 0.5;
      for (let x = -1; x < w / sw + 1; x++) {
        const g = 106 + random() * 25;
        ctx.fillStyle = `rgb(${g + 5},${g + 1},${g - 10})`;
        ctx.fillRect(x * sw + off + 1, r * rh, sw - 2, rh - 1.5);
        ctx.save(); ctx.translate(x * sw + off, r * rh);
        grainStreaks(ctx, sw, rh, 'rgba(0,0,0,0)', 'rgba(50,44,35,0.55)', 7, false);
        ctx.restore();
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
        const g = random() * 26;
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
      const g = random() * 40;
      ctx.fillStyle = `rgba(${180 - g},${170 - g},${140 - g},0.25)`;
      ctx.fillRect(random() * w, random() * h, 2, 2);
    }
  });

  // vertical planks (1930s siding)
  TEX.plank = canvasTexture(256, 256, (ctx, w, h) => {
    const cols = 10, cw = w / cols;
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const g = 118 + random() * 18;
      ctx.fillStyle = `rgb(${g + 10},${g + 1},${g - 18})`;
      ctx.fillRect(cIdx * cw, 0, cw, h);
      ctx.save(); ctx.translate(cIdx * cw, 0);
      grainStreaks(ctx, cw, h, 'rgba(0,0,0,0)', 'rgba(40,24,10,0.7)', 8, false);
      ctx.restore();
      ctx.fillStyle = 'rgba(30,18,8,0.8)';
      ctx.fillRect(cIdx * cw, 0, 2, h);
    }
  }, { repeat: [2, 1] });

  // fieldstone
  TEX.stone = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8d857a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const g = 105 + random() * 70;
      ctx.fillStyle = `rgb(${g},${g - 4},${g - 12})`;
      ctx.beginPath();
      ctx.ellipse(random() * w, random() * h, 8 + random() * 18, 6 + random() * 12, random() * 3, 0, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(48,44,38,0.7)';
      ctx.stroke();
    }
  }, { repeat: [2, 2] });

  // faint emissive floor = sky bounce the Lambert rig can't compute; the
  // shade side of a wall crushed to pitch black under ACES at noon
  const L = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, emissive: 0x0b0b0d, ...extra });
  MAT.log = L(TEX.log);
  MAT.logOld = L(TEX.logOld);
  MAT.bark = L(TEX.bark);
  MAT.brick = L(TEX.brick);
  MAT.thatch = L(TEX.thatch);
  MAT.thatchOld = L(TEX.thatchOld);
  MAT.shingle = L(TEX.shingle);
  MAT.tile = L(TEX.tile);
  MAT.plaster = L(TEX.plaster);
  MAT.plank = L(TEX.plank);
  MAT.stone = L(TEX.stone);
  // A boulder is one rock, not a fieldstone wall wrapped round a sphere.
  TEX.granite = canvasTexture(256,256,(ctx,w,h)=>{
    const image=ctx.createImageData(w,h),stoneNoise=makeNoise(8127);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,grain=stoneNoise.rng(),vein=stoneNoise.fbm(x*.045,y*.045,3);
      const c=98+vein*48+(grain-.5)*37;
      image.data[i]=c+5;image.data[i+1]=c+3;image.data[i+2]=c;image.data[i+3]=255;
    }ctx.putImageData(image,0,0);
  });
  MAT.granite=L(TEX.granite);
  MAT.darkWood = new THREE.MeshLambertMaterial({ color: 0x4a3826 });
  MAT.lightWood = new THREE.MeshLambertMaterial({ color: 0xa88a5c });
  MAT.white = new THREE.MeshLambertMaterial({ color: 0xf2ede0 });
  MAT.door = new THREE.MeshLambertMaterial({ color: 0x352718 });
  MAT.glass = new THREE.MeshPhongMaterial({ color: 0x35484c, shininess: 80, specular: 0x9faeaf });
  TEX.hay = canvasTexture(256,256,(ctx,w,h)=>{
    ctx.fillStyle='#a09161';ctx.fillRect(0,0,w,h);
    for(let i=0;i<3200;i++){
      const x=random()*w,y=random()*h,length=6+random()*32;
      ctx.strokeStyle=random()<.5?'rgba(205,188,132,.42)':'rgba(78,69,40,.32)';
      ctx.lineWidth=.5+random()*.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(random()-.5)*13,y+length);ctx.stroke();
    }
  },{repeat:[3,2]});
  TEX.roundwood = canvasTexture(128,256,(ctx,w,h)=>{
    grainStreaks(ctx,w,h,'#71634e','rgba(35,30,22,.8)',160,false);
  });
  MAT.roundwood=L(TEX.roundwood);
  MAT.hay = L(TEX.hay);
  MAT.iron = new THREE.MeshLambertMaterial({ color: 0x3a3a3c });
  MAT.cloth = new THREE.MeshLambertMaterial({ color: 0xe9e2ce, side: THREE.DoubleSide });
  // The Latvian flag: carmine — white — carmine in 2:1:2, over the parish
  // house from 1935 on (adopted 1922). A plain red sheet is another country's.
  TEX.flagLV = canvasTexture(48, 24, (ctx, w, h) => {
    ctx.fillStyle = '#9d2235';                    // Latvian carmine
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4efe4';
    ctx.fillRect(0, h * 0.4, w, h * 0.2);
  });
  TEX.flagLV.magFilter = THREE.NearestFilter;     // a crisp stripe, not a smear
  MAT.flagRed = new THREE.MeshLambertMaterial({ map: TEX.flagLV, side: THREE.DoubleSide });
}
