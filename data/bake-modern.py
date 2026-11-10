#!/usr/bin/env python3
"""Stage 4 of the LiDAR bake: what stands on the ground today -> src/lidar2025.js.

  canopy     share of each 20 m cell under vegetation taller than 5 m, and the
             height of that canopy, from the highest vegetation returns
  buildings  eave and ridge height of every OpenStreetMap footprint that the
             survey saw as a building, from its roof returns

The survey dates from the flights listed in the cache's flight.json, so this
is the woodland and the building stock of that year.

Usage: LIDAR_CACHE=... python3 data/bake-modern.py
"""
import base64, json, math, os, re, zlib
import numpy as np
from scipy import ndimage
from lidar_common import OFF_X, OFF_Z, SPAN, CACHE

HERE = os.path.dirname(os.path.abspath(__file__))
d = np.load(os.path.join(CACHE, "scene1m.npz"))
chm = d["chm"].astype(np.float32); bht = d["bht"].astype(np.float32); bld = d["bld"]
X0 = float(d["X0"]); Z0 = float(d["Z0"])
c0 = int(round(OFF_X - SPAN / 2 - X0)); r0 = int(round(OFF_Z - SPAN / 2 - Z0))
S = int(SPAN)

# ---- canopy, 20 m cells --------------------------------------------------
CELL = 20
N = S // CELL
# power lines and birds: a lone return far above its neighbours is not a tree
chm_c = np.minimum(chm, ndimage.maximum_filter(ndimage.median_filter(chm, 3), 3) + 3)
sq = chm_c[r0:r0 + S, c0:c0 + S]
tall = (sq > 5).reshape(N, CELL, N, CELL).mean((1, 3))
# canopy height: mean of the tall cells' heights
hsum = np.where(sq > 5, sq, 0).reshape(N, CELL, N, CELL).sum((1, 3))
cnt = (sq > 5).reshape(N, CELL, N, CELL).sum((1, 3))
hgt = np.where(cnt > 12, hsum / np.maximum(cnt, 1), 0)
cover_b = np.round(tall * 255).astype(np.uint8)
hgt_b = np.clip(np.round(hgt * 4), 0, 255).astype(np.uint8)
canopy = base64.b64encode(zlib.compress(cover_b.tobytes() + hgt_b.tobytes(), 9)).decode()
print(f"canopy {N} x {N} at {CELL} m: woodland share {(tall > 0.5).mean() * 100:.1f} %, mean canopy height {hgt[cnt > 12].mean():.1f} m, {len(canopy) / 1e3:.0f} kB")

# ---- buildings ------------------------------------------------------------
src = open(os.path.join(HERE, "..", "src", "geodata-osm.js")).read()
m = re.search(r"export const BUILDINGS_OSM = (\[.*?\]);\n", src, re.S)
B = json.loads(m.group(1))
H, W = bht.shape
out = {}
seen = 0
for b in B:
    x, z, w, dd, rot = b[:5]
    meta = b[5] if len(b) > 5 and isinstance(b[5], dict) else {}
    rad = int(math.ceil(math.hypot(w, dd) / 2)) + 1
    r, c = int(round(z - Z0)), int(round(x - X0))
    if r - rad < 0 or c - rad < 0 or r + rad >= H or c + rad >= W:
        continue
    yy, xx = np.mgrid[-rad:rad + 1, -rad:rad + 1]
    ca, sa = math.cos(rot), math.sin(rot)
    # footprint-local coordinates (same convention as eras.js cornersOf: +rot turns x toward z)
    lx = xx * ca + yy * sa; lz = -xx * sa + yy * ca
    inside = (np.abs(lx) <= w / 2) & (np.abs(lz) <= dd / 2)
    hs = bht[r - rad:r + rad + 1, c - rad:c + rad + 1][inside & (bld[r - rad:r + rad + 1, c - rad:c + rad + 1] > 0)]
    if hs.size < max(6, 0.25 * inside.sum()):
        continue
    seen += 1
    ridge = float(np.percentile(hs, 96)); eave = float(np.percentile(hs, 12))
    if ridge < 2.0 or ridge > 30:
        continue
    eave = min(max(eave, 1.8), ridge - 0.1)
    if meta.get("id") is not None:
        out[str(meta["id"])] = [round(eave, 1), round(ridge, 1)]
print(f"buildings: {len(B)} OSM footprints, {seen} seen by the survey, {len(out)} with heights; median ridge {np.median([v[1] for v in out.values()]):.1f} m")

flown = ""
fp = os.path.join(CACHE, "flight.json")
if os.path.exists(fp):
    flown = json.load(open(fp)).get("summary", "")
with open(os.path.join(HERE, "..", "src", "lidar2025.js"), "w") as f:
    f.write(f"""// What stood on the ground when the LGIA laser survey flew{(' (' + flown + ')') if flown else ''}:
// woodland canopy and building heights. Baked by data/bake-modern.py. CC BY 4.0.
import {{ unzlibSync }} from 'fflate';
export const CANOPY_N = {N};
export const CANOPY_CELL = {CELL};
const CANOPY_Z = "{canopy}";
let cover = null, height = null;
function decode() {{
  const bin = typeof Buffer !== 'undefined' ? Buffer.from(CANOPY_Z, 'base64') : Uint8Array.from(atob(CANOPY_Z), (ch) => ch.charCodeAt(0));
  const raw = unzlibSync(new Uint8Array(bin.buffer, bin.byteOffset, bin.length));
  cover = raw.subarray(0, CANOPY_N * CANOPY_N); height = raw.subarray(CANOPY_N * CANOPY_N);
}}
function sample(a, x, z) {{
  if (!cover) decode();
  const fx = Math.min(Math.max((x - {OFF_X - SPAN / 2:g}) / CANOPY_CELL - 0.5, 0), CANOPY_N - 1.001);
  const fz = Math.min(Math.max((z - {OFF_Z - SPAN / 2:g}) / CANOPY_CELL - 0.5, 0), CANOPY_N - 1.001);
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, i = iz * CANOPY_N + ix;
  return (a[i] * (1 - u) + a[i + 1] * u) * (1 - v) + (a[i + CANOPY_N] * (1 - u) + a[i + CANOPY_N + 1] * u) * v;
}}
// share of the ground under trees taller than 5 m, 0..1
export function canopyCoverAt(x, z) {{ if (!cover) decode(); return sample(cover, x, z) / 255; }}
// height of that canopy in metres (0 where there is none)
export function canopyHeightAt(x, z) {{ if (!cover) decode(); return sample(height, x, z) / 4; }}
// OSM building id -> [eave height, ridge height] in metres above the ground
export const BUILDING_HEIGHTS = {json.dumps(out, separators=(',', ':'))};
""")
print("wrote src/lidar2025.js")
