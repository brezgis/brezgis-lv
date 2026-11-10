#!/usr/bin/env python3
"""Hillshade preview of the cached LiDAR in the scene frame, for inspection.

  python3 data/lidar-preview.py OUT.png X0 Z0 X1 Z1 [step=1] [flags]

X/Z are scene metres (x east, z south). Flags: osm (overlay OSM roads and
water), chm (canopy height tint), bld (building returns in red), multi
(multi-direction hillshade), slope (slope shading instead of hillshade),
zf=N (vertical exaggeration), grid=N (grid lines every N m with labels).
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from lidar_common import Mosaic, bilinear, scene_to_lks, latlon_to_scene, hillshade

out, x0, z0, x1, z1 = sys.argv[1], *map(float, sys.argv[2:6])
step = 1.0
flags = set()
opts = {}
for a in sys.argv[6:]:
    if "=" in a:
        k, v = a.split("="); opts[k] = float(v)
    elif a.replace(".", "").isdigit():
        step = float(a)
    else:
        flags.add(a)
zf = opts.get("zf", 2.0)

layers = ["gmean"] + (["vmax"] if "chm" in flags else []) + (["bcnt"] if "bld" in flags else []) + (["allcnt", "gcnt"] if "void" in flags else [])
M = Mosaic(layers)
xs = np.arange(x0, x1 + step / 2, step); zs = np.arange(z0, z1 + step / 2, step)
X, Z = np.meshgrid(xs, zs)
E, N = scene_to_lks(X, Z)
r, c = M.index(E, N)

g = M["gmean"]
dem = bilinear(np.nan_to_num(g, nan=0.0), r, c)
w = bilinear(np.isfinite(g).astype(np.float32), r, c)
dem = np.where(w > 0.01, dem / np.maximum(w, 1e-6), np.nan)
# fill small gaps for shading only
from scipy import ndimage
bad = ~np.isfinite(dem)
if bad.any() and not bad.all():
    idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
    demf = dem[tuple(idx)]
else:
    demf = dem
if "slope" in flags:
    gy, gx = np.gradient(demf, step)
    sl = np.degrees(np.arctan(np.hypot(gx, gy)))
    sh = np.clip(255 - sl * 255 / opts.get("smax", 35), 0, 255).astype(np.uint8)
elif "multi" in flags:
    sh = np.mean([hillshade(demf, step, az, 35, zf).astype(np.float32) for az in (315, 270, 225, 360, 45)], axis=0).astype(np.uint8)
else:
    sh = hillshade(demf, step, 315, 40, zf)
rgb = np.stack([sh, sh, sh], -1).astype(np.float32)
rgb[bad] = (60, 90, 150)

ri = np.clip(np.round(r).astype(int), 0, M.h - 1); ci = np.clip(np.round(c).astype(int), 0, M.w - 1)
if "chm" in flags:
    ch = M["vmax"][ri, ci] - demf
    k = np.clip(np.nan_to_num(ch, nan=0) / 25.0, 0, 1)[..., None]
    rgb = rgb * (1 - 0.6 * k) + np.array([20, 150, 40]) * 0.6 * k
if "bld" in flags:
    b = M["bcnt"][ri, ci] > 0
    rgb[b] = (230, 40, 40)
if "void" in flags:
    v = M["allcnt"][ri, ci] == 0
    rgb[v] = (40, 80, 200)
img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)
px = lambda x, z: ((x - x0) / step, (z - z0) / step)

if "osm" in flags:
    here = os.path.dirname(os.path.abspath(__file__))
    for e in json.load(open(os.path.join(here, "osm-water.json"))):
        if not e.get("geom"):
            continue
        pts = [px(*latlon_to_scene(p["lat"], p["lon"])) for p in e["geom"]]
        col = (60, 160, 255) if e["kind"] == "water" else (0, 220, 255) if "river" in e["kind"] or "stream" in e["kind"] else (0, 140, 160)
        d.line(pts, fill=col, width=1)
    roads = json.load(open(os.path.join(here, "osm-roads.json")))
    for e in roads.get("elements", []):
        if e.get("type") != "way" or "geometry" not in e:
            continue
        t = e.get("tags", {})
        pts = [px(*latlon_to_scene(p["lat"], p["lon"])) for p in e["geometry"]]
        if "highway" in t:
            d.line(pts, fill=(255, 210, 0), width=1)
        elif "building" in t:
            d.line(pts + pts[:1], fill=(255, 0, 255), width=1)
if "grid" in opts:
    gstep = opts["grid"]
    for gx in np.arange(np.ceil(x0 / gstep) * gstep, x1, gstep):
        d.line([px(gx, z0), px(gx, z1)], fill=(255, 255, 255), width=1)
        d.text((px(gx, z0)[0] + 2, 2), f"x{gx:.0f}", fill=(255, 255, 0))
    for gz in np.arange(np.ceil(z0 / gstep) * gstep, z1, gstep):
        d.line([px(x0, gz), px(x1, gz)], fill=(255, 255, 255), width=1)
        d.text((2, px(x0, gz)[1] + 2), f"z{gz:.0f}", fill=(255, 255, 0))
img.save(out)
fin = dem[np.isfinite(dem)]
print(out, img.size, f"elev {fin.min():.1f}..{fin.max():.1f} m" if fin.size else "no data")
