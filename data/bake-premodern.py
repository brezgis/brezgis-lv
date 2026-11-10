#!/usr/bin/env python3
"""Take the twentieth century's earthworks back out of the surveyed ground.

The laser survey is the ground of the late 2010s. Five of the six eras are
older than its biggest scars, so one shared pre-modern surface is derived:

  - the P30 highway's cuttings and embankments (its present straight line was
    engineered after the Second World War; the older road wound beside it)
  - gravel pits and other modern excavations listed by hand in
    data/lidar-modern-features.json, digitised from the hillshade

Inside those areas the measured ground is discarded and re-interpolated
smoothly from the ground around them. Nothing else is touched. The result is
an interpolation, not a survey of the lost surface, and the 2025 scene shares
it (its road is drawn on top), so the modern pit and cuttings are absent there.

Writes premodern1m.npy into the cache; data/bake-terrain.py picks it up.
Usage: LIDAR_CACHE=... python3 data/bake-premodern.py [preview.png]
"""
import json, os, sys
import numpy as np
from scipy import ndimage
from skimage.draw import polygon as fill_polygon, line as draw_line
from lidar_common import latlon_to_scene, CACHE

HERE = os.path.dirname(os.path.abspath(__file__))
d = np.load(os.path.join(CACHE, "scene1m.npz"))
dtm = d["dtm"].astype(np.float32); X0 = float(d["X0"]); Z0 = float(d["Z0"])
H, W = dtm.shape
mask = np.zeros((H, W), bool)

# ---- the P30 --------------------------------------------------------------
roads = json.load(open(os.path.join(HERE, "osm-roads.json")))
line = np.zeros((H, W), bool)
for e in roads.get("elements", []):
    t = e.get("tags", {})
    if e.get("type") != "way" or "geometry" not in e or "P30" not in t.get("ref", ""):
        continue
    pts = [latlon_to_scene(p["lat"], p["lon"]) for p in e["geometry"]]
    for (xa, za), (xb, zb) in zip(pts, pts[1:]):
        rr, cc = draw_line(int(round(za - Z0)), int(round(xa - X0)), int(round(zb - Z0)), int(round(xb - X0)))
        ok = (rr >= 0) & (rr < H) & (cc >= 0) & (cc < W)
        line[rr[ok], cc[ok]] = True
dist = ndimage.distance_transform_edt(~line)
gy, gx = np.gradient(ndimage.gaussian_filter(dtm, 1.0))
slope = np.hypot(gx, gy)
# the carriageway and its ditches, plus any engineered batter (steeper than
# 1 in 5) that is connected to them within 45 m
core = dist < 11
batter = (dist < 45) & (slope > 0.2)
lab, n = ndimage.label(core | batter)
keep = np.unique(lab[core]); keep = keep[keep > 0]
road_mask = np.isin(lab, keep)
road_mask = ndimage.binary_closing(road_mask, iterations=3)
road_mask = ndimage.binary_dilation(road_mask, iterations=3)
mask |= road_mask
print(f"P30: {line.sum()} m of centreline, {road_mask.sum() / 1e4:.1f} ha of earthworks")

# ---- pits and other listed features ---------------------------------------
fp = os.path.join(HERE, "lidar-modern-features.json")
for f in (json.load(open(fp)) if os.path.exists(fp) else []):
    poly = np.array(f["poly"], float)
    rr, cc = fill_polygon(poly[:, 1] - Z0, poly[:, 0] - X0, (H, W))
    m = np.zeros((H, W), bool); m[rr, cc] = True
    mask |= m
    print(f"{f['name']}: {m.sum() / 1e4:.2f} ha")


def push_pull(a, valid):
    levels = [(a, valid.astype(np.float32))]
    while True:
        v, w = levels[-1]
        if w.min() > 0 or min(v.shape) < 4:
            break
        h, wd = (v.shape[0] + 1) // 2 * 2, (v.shape[1] + 1) // 2 * 2
        vp = np.zeros((h, wd), np.float32); wp = np.zeros((h, wd), np.float32)
        vp[:v.shape[0], :v.shape[1]] = v * w; wp[:v.shape[0], :v.shape[1]] = w
        vs = vp.reshape(h // 2, 2, wd // 2, 2).sum((1, 3)); ws = wp.reshape(h // 2, 2, wd // 2, 2).sum((1, 3))
        levels.append((np.where(ws > 0, vs / np.maximum(ws, 1e-6), 0).astype(np.float32), (ws > 0).astype(np.float32)))
    for i in range(len(levels) - 2, -1, -1):
        v, w = levels[i]
        up = ndimage.zoom(levels[i + 1][0], 2, order=1, mode="nearest")[:v.shape[0], :v.shape[1]]
        levels[i] = (np.where(w > 0, v, up).astype(np.float32), np.ones_like(w))
    return levels[0][0]


filled = push_pull(np.where(mask, 0, dtm).astype(np.float32), ~mask)
# relax the fill toward a smooth membrane, and feather its edge
soft = ndimage.gaussian_filter(filled, 6.0)
wgt = ndimage.gaussian_filter(mask.astype(np.float32), 3.0)
inner = np.clip((wgt - 0.5) * 2, 0, 1)
out = np.where(mask, filled * (1 - inner) + soft * inner, dtm).astype(np.float32)
edge = np.clip(wgt * 2, 0, 1) * (~mask)
out = out * (1 - 0.0 * edge)
np.save(os.path.join(CACHE, "premodern1m.npy"), out)
diff = out - dtm
print(f"changed {mask.mean() * 100:.2f} % of the map; filled up to {diff.max():.1f} m, cut up to {-diff.min():.1f} m")

if len(sys.argv) > 1:
    from PIL import Image
    from lidar_common import hillshade
    s = 3
    a = hillshade(dtm[::s, ::s], s, zf=2.0); b = hillshade(out[::s, ::s], s, zf=2.0)
    m = mask[::s, ::s]
    rgb = np.stack([b, b, b], -1); rgb[m] = (rgb[m] * 0.7 + np.array([255, 120, 0]) * 0.3).astype(np.uint8)
    Image.fromarray(np.concatenate([np.stack([a, a, a], -1), rgb], 1)).save(sys.argv[1])
