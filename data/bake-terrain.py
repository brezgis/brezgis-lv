#!/usr/bin/env python3
"""Stage 2 of the LiDAR bake: scene1m.npz -> src/heightmap.js.

Writes the parish heightmap the scene inlines: a 4 m grid of bare-earth
heights over the whole 8.8 km square, plus 1 m patches over the sites listed
in data/lidar-sites.json (earthworks and other places where the ground itself
is the evidence). Encoding is described in src/heightcodec.js.

Usage: LIDAR_CACHE=... python3 data/bake-terrain.py
"""
import base64, json, os, zlib
import numpy as np
from scipy import ndimage
from lidar_common import OFF_X, OFF_Z, SPAN, CACHE

HERE = os.path.dirname(os.path.abspath(__file__))
STEP = 4
BASE = 100.0
Q = 0.05           # metres per unit on the parish grid
PATCH_Q = 0.02     # ...and on the 1 m site patches

d = np.load(os.path.join(CACHE, "scene1m.npz"))
dtm = d["dtm"].astype(np.float32); X0 = float(d["X0"]); Z0 = float(d["Z0"])
premodern = os.path.join(CACHE, "premodern1m.npy")
if os.path.exists(premodern):
    # written by data/bake-premodern.py: the same ground with modern road
    # embankments, drainage ditches and pits smoothed out
    dtm = np.load(premodern)
    print("using the pre-modern ground surface")


pf = os.path.join(CACHE, "pondfloor.npz")
if os.path.exists(pf):
    # written by data/bake-hydro.py: the valley floor under the mill pond
    p = np.load(pf)
    dtm[p["r"], p["c"]] = np.minimum(dtm[p["r"], p["c"]], p["h"])
    print(f"mill pond floor applied to {len(p['r']) / 1e4:.2f} ha")


def encode(a, base, q):
    v = np.round((a - base) / q).astype(np.int32)
    p = v.copy()
    p[1:, 1:] = v[1:, 1:] - v[1:, :-1] - v[:-1, 1:] + v[:-1, :-1]
    p[0, 1:] = v[0, 1:] - v[0, :-1]
    p[1:, 0] = v[1:, 0] - v[:-1, 0]
    assert np.abs(p).max() < 32000, "prediction residual does not fit 16 bits"
    zz = ((p << 1) ^ (p >> 31)).astype(np.uint16)
    raw = (zz & 255).astype(np.uint8).tobytes() + (zz >> 8).astype(np.uint8).tobytes()
    return base64.b64encode(zlib.compress(raw, 9)).decode()


def decode_check(b64, w, h, base, q):
    raw = np.frombuffer(zlib.decompress(base64.b64decode(b64)), np.uint8)
    n = w * h
    zz = raw[:n].astype(np.int32) | (raw[n:].astype(np.int32) << 8)
    p = ((zz >> 1) ^ -(zz & 1)).reshape(h, w)
    v = np.cumsum(np.cumsum(p, axis=0), axis=1)
    return base + v * q


# parish grid: light anti-alias, then every 4th metre
G = int(SPAN / STEP) + 1
sm = ndimage.gaussian_filter(dtm, 1.3)
c0 = int(round(OFF_X - SPAN / 2 - X0)); r0 = int(round(OFF_Z - SPAN / 2 - Z0))
grid = sm[r0:r0 + int(SPAN) + 1:STEP, c0:c0 + int(SPAN) + 1:STEP]
assert grid.shape == (G, G), grid.shape
hm = encode(grid, BASE, Q)
assert np.abs(decode_check(hm, G, G, BASE, Q) - grid).max() <= Q / 2 + 1e-4
print(f"parish grid {G} x {G} at {STEP} m: {len(hm) / 1e6:.2f} MB base64, elev {grid.min():.1f}..{grid.max():.1f} m")

patches = []
sites_path = os.path.join(HERE, "lidar-sites.json")
sites = json.load(open(sites_path)) if os.path.exists(sites_path) else []
for s in sites:
    half = int(s["half"]); cx, cz = int(round(s["x"])), int(round(s["z"]))
    r = cz - half - int(Z0); c = cx - half - int(X0); n = 2 * half + 1
    a = dtm[r:r + n, c:c + n]
    if a.shape != (n, n):
        print(f"skip patch {s['name']}: outside the data"); continue
    b = encode(a, BASE, PATCH_Q)
    patches.append(dict(name=s["name"], x0=cx - half, z0=cz - half, n=n, step=1, feather=s.get("feather", 12), data=b))
    print(f"patch {s['name']}: {n} x {n} m, {len(b) / 1e3:.0f} kB")

flown = ""
meta_path = os.path.join(CACHE, "flight.json")
if os.path.exists(meta_path):
    flown = json.load(open(meta_path)).get("summary", "")

with open(os.path.join(HERE, "..", "src", "heightmap.js"), "w") as f:
    f.write(f"""// Bare-earth elevation of the Taurene and Brezģis country, Latvia.
// {SPAN / 1000:g} km square, {G} x {G} grid at {STEP} m, centre offset ({OFF_X:g}, {OFF_Z:g})
// from the village origin, heights in metres (LAS-2000,5 normal heights).
// Source: LGIA airborne laser scanning, digital height model basic data,
// first national cycle{(', ' + flown) if flown else ''}. Licence CC BY 4.0.
// Baked by data/fetch-lidar.py, data/bake-lidar.py and data/bake-terrain.py.
import {{ decodeRaster }} from './heightcodec.js';
export const HM_GRID = {G};
export const HM_SPAN = {int(SPAN)};
export const HM_OFF_X = {int(OFF_X)};
export const HM_OFF_Z = {int(OFF_Z)};
export const HM_STEP = {STEP};
const HM_BASE = {BASE:g}, HM_Q = {Q:g}, HM_PATCH_Q = {PATCH_Q:g};
const HM_Z = "{hm}";
// Float32Array, row-major, row 0 = north
export function decodeHeightmap() {{
  return decodeRaster(HM_Z, HM_GRID, HM_GRID, HM_BASE, HM_Q);
}}
// 1 m ground over the sites where the earthwork itself is the evidence
const HM_PATCH_DATA = {json.dumps(patches)};
export function decodePatches() {{
  return HM_PATCH_DATA.map((p) => ({{
    name: p.name, x0: p.x0, z0: p.z0, n: p.n, step: p.step, feather: p.feather,
    h: decodeRaster(p.data, p.n, p.n, HM_BASE, HM_PATCH_Q),
  }}));
}}
""")
print("wrote src/heightmap.js")
