// Fetch Sentinel-2 cloudless imagery (EOX, CC-BY 4.0) for the map square and
// bake: (a) a terrain drape texture for the 2020s era, (b) a forest mask so
// modern tree placement follows the real present-day forest pattern.
// Attribution: "Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services
// GmbH (Contains modified Copernicus Sentinel data)".
import jpeg from 'jpeg-js';
import { writeFileSync } from 'fs';

const LAT0 = 57.15944, LON0 = 25.66472;
const OFF_X = 500, OFF_Z = 1700, SPAN = 8800;
const MLAT = 111360, MLON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const latC = LAT0 - OFF_Z / MLAT, lonC = LON0 + OFF_X / MLON;
const Z = 14;

const n = 2 ** Z;
const latRad = (latC * Math.PI) / 180;
const xf = ((lonC + 180) / 360) * n;
const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
const mpp = (156543.03392 * Math.cos(latRad)) / 2 ** Z;
const spanPx = SPAN / mpp;
console.log(`z${Z}: ${mpp.toFixed(2)} m/px, span ${spanPx.toFixed(0)} px`);

const R = 4; // 9x9 tile mosaic (2304 px) comfortably covers spanPx (~1700)
const T = 256;
const xt = Math.floor(xf), yt = Math.floor(yf);
const mosaicW = (2 * R + 1) * T;
const mosaic = new Uint8Array(mosaicW * mosaicW * 4);

for (let dy = -R; dy <= R; dy++) {
  for (let dx = -R; dx <= R; dx++) {
    const url = `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${Z}/${yt + dy}/${xt + dx}.jpg`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const img = jpeg.decode(Buffer.from(await res.arrayBuffer()), { useTArray: true });
    for (let py = 0; py < T; py++) {
      for (let px = 0; px < T; px++) {
        const si = (py * T + px) * 4;
        const mx = (dx + R) * T + px, my = (dy + R) * T + py;
        const di = (my * mosaicW + mx) * 4;
        mosaic[di] = img.data[si];
        mosaic[di + 1] = img.data[si + 1];
        mosaic[di + 2] = img.data[si + 2];
        mosaic[di + 3] = 255;
      }
    }
  }
}
console.log('mosaic assembled');

// crop the exact map square, downsample 2x -> OUT px
const cx = (xf - (xt - R)) * T, cy = (yf - (yt - R)) * T;
const OUT = Math.floor(spanPx / 2 / 2) * 2; // ~849 -> even
const crop = new Uint8Array(OUT * OUT * 4);
for (let oy = 0; oy < OUT; oy++) {
  for (let ox = 0; ox < OUT; ox++) {
    // average a 2x2 source block
    const sx = Math.round(cx + (ox * 2 - spanPx / 2)), sy = Math.round(cy + (oy * 2 - spanPx / 2));
    let r = 0, g = 0, b = 0;
    for (let ky = 0; ky < 2; ky++) for (let kx = 0; kx < 2; kx++) {
      const i = ((sy + ky) * mosaicW + sx + kx) * 4;
      r += mosaic[i]; g += mosaic[i + 1]; b += mosaic[i + 2];
    }
    const o = (oy * OUT + ox) * 4;
    crop[o] = r / 4; crop[o + 1] = g / 4; crop[o + 2] = b / 4; crop[o + 3] = 255;
  }
}
const encoded = jpeg.encode({ data: Buffer.from(crop), width: OUT, height: OUT }, 82);
console.log(`texture ${OUT}x${OUT}, jpeg ${(encoded.data.length / 1024).toFixed(0)} KB`);

// forest mask from the full-res crop region: dark-green pixels
const MN = 176; // 50 m cells
const mask = new Uint8Array(MN * MN);
for (let mzi = 0; mzi < MN; mzi++) {
  for (let mxi = 0; mxi < MN; mxi++) {
    let votes = 0, total = 0;
    const px0 = cx - spanPx / 2 + (mxi / MN) * spanPx;
    const py0 = cy - spanPx / 2 + (mzi / MN) * spanPx;
    const cellPx = spanPx / MN;
    for (let s = 0; s < 9; s++) {
      const px = Math.round(px0 + ((s % 3) + 0.5) * (cellPx / 3));
      const py = Math.round(py0 + (Math.floor(s / 3) + 0.5) * (cellPx / 3));
      const i = (py * mosaicW + px) * 4;
      const r = mosaic[i], g = mosaic[i + 1], b = mosaic[i + 2];
      const lum = 0.3 * r + 0.55 * g + 0.15 * b;
      // calibrated on this mosaic: forest ~(14-19,38-57,18-22) lum 28-42,
      // fields lum 46+, water dark with low green-blue contrast
      const water = lum < 32 && g - b < 14;
      if (!water && g > r && g - b > 10 && lum < 44) votes++;
      total++;
    }
    mask[mzi * MN + mxi] = votes / total > 0.5 ? 1 : 0;
  }
}
const forestPct = (100 * mask.reduce((s, v) => s + v, 0) / (MN * MN)).toFixed(0);
console.log(`forest mask: ${forestPct}% forest`);

writeFileSync(new URL('../src/sat2025.js', import.meta.url), `// Sentinel-2 cloudless 2020 drape + present-day forest mask.
// (c) EOX IT Services GmbH, CC-BY 4.0 — "Sentinel-2 cloudless - s2maps.eu by
// EOX IT Services GmbH (Contains modified Copernicus Sentinel data)".
export const SAT_JPEG_B64 = "${Buffer.from(encoded.data).toString('base64')}";
export const SAT_MASK_B64 = "${Buffer.from(mask).toString('base64')}";
export const SAT_MASK_N = ${MN};
export function forestMaskAt(x, z) {
  if (!forestMaskAt._m) {
    const bin = atob(SAT_MASK_B64);
    const m = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) m[i] = bin.charCodeAt(i);
    forestMaskAt._m = m;
  }
  const u = ((x - ${OFF_X}) / ${SPAN}) + 0.5, v = ((z - ${OFF_Z}) / ${SPAN}) + 0.5;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
  return forestMaskAt._m[Math.floor(v * ${MN}) * ${MN} + Math.floor(u * ${MN})];
}
`);
console.log('wrote src/sat2025.js');
