// Decoder for the baked LiDAR height rasters (written by data/bake-terrain.py).
//
// A raster is quantised to HM_Q metres above HM_BASE, predicted from its left,
// upper and upper-left neighbours, zigzag-coded to 16 bits, split into a low
// and a high byte plane and deflated. Flat Vidzeme fields predict almost
// perfectly, so the 4.8 million samples of the 4 m parish grid fit in about
// two megabytes.
import { unzlibSync } from 'fflate';

function b64bytes(b64) {
  if (typeof Buffer !== 'undefined') {
    const b = Buffer.from(b64, 'base64');
    return new Uint8Array(b.buffer, b.byteOffset, b.length);
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// -> Float32Array of w*h heights in metres, row-major, row 0 = north
export function decodeRaster(b64, w, h, base, q) {
  const raw = unzlibSync(b64bytes(b64));
  const n = w * h;
  if (raw.length !== n * 2) throw new Error(`height raster: expected ${n * 2} bytes, got ${raw.length}`);
  const v = new Int32Array(n);
  const out = new Float32Array(n);
  for (let r = 0, i = 0; r < h; r++) {
    for (let c = 0; c < w; c++, i++) {
      const zz = raw[i] | (raw[n + i] << 8);
      let p = (zz >>> 1) ^ -(zz & 1);
      if (c > 0) p += v[i - 1];
      if (r > 0) p += v[i - w];
      if (c > 0 && r > 0) p -= v[i - w - 1];
      v[i] = p;
      out[i] = base + p * q;
    }
  }
  return out;
}
