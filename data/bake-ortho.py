#!/usr/bin/env python3
"""The 2025 ground texture: aerial detail under summer colour -> src/sat2025.js.

The LGIA orthophotos (data/fetch-ortho.py) are sharp, 25 cm on the ground,
but they are flown in spring before the leaves, and every scene here is
midsummer. The Sentinel-2 cloudless mosaic (EOX, 2020) has the right season
and only 10 m of detail. So the two are combined the way satellites sharpen
their own colour bands: colour from the summer mosaic, fine structure
(field edges, tracks, ditches, roofs) from the aerial photograph's brightness.

Usage: LIDAR_CACHE=... python3 data/bake-ortho.py [N=4096] [preview.png]
"""
import base64, glob, io, os, re, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from lidar_common import CACHE, OFF_X, OFF_Z, SPAN, scene_to_lks, bilinear

HERE = os.path.dirname(os.path.abspath(__file__))
N = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 4096

files = sorted(glob.glob(os.path.join(CACHE, "ortho", "*_*.npy")))
if not files:
    raise SystemExit("no orthophoto sheets; run data/fetch-ortho.py first")
keys = [tuple(int(v) for v in os.path.basename(f)[:-4].split("_")) for f in files]
e0 = min(k[0] for k in keys); n1 = max(k[1] for k in keys)
w = max(k[0] for k in keys) + 2500 - e0; h = n1 - (min(k[1] for k in keys) - 2500)
mos = np.zeros((h, w, 3), np.uint8)
for f, (E, Nn) in zip(files, keys):
    a = np.load(f)
    mos[n1 - Nn:n1 - Nn + a.shape[0], E - e0:E - e0 + a.shape[1]] = a[:h - (n1 - Nn), :w - (E - e0)]
print(f"orthophoto mosaic {w} x {h} m from {len(files)} sheets")

# scene texel centres (row 0 = north), as the terrain's uv expects
t = (np.arange(N) + 0.5) / N
X, Z = np.meshgrid(OFF_X - SPAN / 2 + t * SPAN, OFF_Z - SPAN / 2 + t * SPAN)
E, Nn = scene_to_lks(X, Z)
r = (n1 - Nn) - 0.5; c = (E - e0) - 0.5
step = SPAN / N
pre = [ndimage.uniform_filter(mos[..., k].astype(np.float32), max(1, int(round(step)))) for k in range(3)]
ortho = np.stack([bilinear(p, r, c) for p in pre], -1)
del mos, pre

# summer colour: the Sentinel-2 drape this project has carried since July 2026
src = subprocess.run(["git", "show", "master:src/sat2025.js"], capture_output=True, text=True, cwd=HERE).stdout
sat = np.asarray(Image.open(io.BytesIO(base64.b64decode(re.search(r'SAT_JPEG_B64 = "([^"]+)"', src).group(1)))).convert("RGB"), np.float32)
sat = np.stack([ndimage.zoom(sat[..., k], N / sat.shape[0], order=1)[:N, :N] for k in range(3)], -1)
sat = ndimage.gaussian_filter(sat, (N / 880 * 0.6, N / 880 * 0.6, 0))

lum = ortho @ np.array([0.299, 0.587, 0.114], np.float32)
low = ndimage.gaussian_filter(lum, 10.0 / step * 1.2)          # what Sentinel could see
detail = np.clip((lum + 6) / (low + 6), 0.55, 1.6)
out = np.clip(sat * detail[..., None], 0, 255).astype(np.uint8)
img = Image.fromarray(out)
buf = io.BytesIO(); img.save(buf, "JPEG", quality=80, optimize=True, subsampling=1)
print(f"texture {N} x {N} ({step:.2f} m per texel), jpeg {len(buf.getvalue()) / 1e6:.2f} MB")
with open(os.path.join(HERE, "..", "src", "sat2025.js"), "w") as f:
    f.write("""// The 2025 ground texture, baked by data/bake-ortho.py. Colour: Sentinel-2
// cloudless 2020 by EOX IT Services GmbH (CC BY 4.0, contains modified Copernicus
// Sentinel data). Detail: LGIA orthophoto maps of the 6th cycle, 2016 to 2018
// (CC BY 4.0).
""")
    f.write(f'export const SAT_JPEG_B64 = "{base64.b64encode(buf.getvalue()).decode()}";\n')
if len(sys.argv) > 2 and not sys.argv[-1].isdigit():
    img.crop((N // 2 - 600, N // 4, N // 2 + 600, N // 4 + 800)).save(sys.argv[-1])
print("wrote src/sat2025.js")
