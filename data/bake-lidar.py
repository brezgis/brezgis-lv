#!/usr/bin/env python3
"""Stage 1 of the LiDAR bake: tiles -> scene-frame 1 m master rasters.

Reads the reduced LGIA tiles (data/fetch-lidar.py) and writes, into the cache
directory, `scene1m.npz` in the scene frame (row 0 = north, x east; cell
[r, c] is the point x = X0 + c, z = Z0 + r metres):

  dtm    bare-earth height, metres (LAS-2000,5), gaps filled smoothly
  gap    1 where the ground height is interpolated (no ground return in 1 m)
  void   1 where NO laser return of any class came back (open water absorbs
         the near-infrared pulse, so this is the water mask, plus a few wet
         roofs and shadows)
  chm    canopy height above ground (highest vegetation return), 0 if none
  bld    building-class returns per cell
  bht    building height above ground, 0 if none
  inten  mean ground-return intensity (roads and bare soil stand out)

Everything downstream (heightmap, hydrology, canopy, buildings, previews)
reads this file.  Usage: LIDAR_CACHE=... python3 data/bake-lidar.py
"""
import os, sys, time
import numpy as np
from scipy import ndimage
from lidar_common import Mosaic, bilinear, scene_to_lks, OFF_X, OFF_Z, SPAN, CACHE

MARGIN = 100.0           # metres of real ground kept beyond the scene square
t0 = time.time()
M = Mosaic(("gmean", "gcnt", "allcnt", "vmax", "bmax", "bcnt", "imean"))
print(f"mosaic {M.w} x {M.h} m, {len(M.meta)} tiles, {time.time() - t0:.0f}s", flush=True)

# flight dates: LAS 1.2 "adjusted standard GPS time" is GPS seconds minus 1e9
import datetime, json
days = sorted({(datetime.datetime(1980, 1, 6) + datetime.timedelta(seconds=m["tmin"] + 1e9)).date().isoformat()
               for m in M.meta.values() if np.isfinite(m["tmin"]) and m["tmin"] > 1e6})
if days:
    years = sorted({d[:4] for d in days})
    summary = ("flown " + days[0]) if len(days) == 1 else f"flown on {len(days)} days between {days[0]} and {days[-1]}"
    json.dump({"days": days, "years": years, "summary": summary}, open(os.path.join(CACHE, "flight.json"), "w"))
    print(summary, flush=True)

X0, Z0 = OFF_X - SPAN / 2 - MARGIN, OFF_Z - SPAN / 2 - MARGIN
n = int(SPAN + 2 * MARGIN) + 1
xs = X0 + np.arange(n, dtype=np.float64); zs = Z0 + np.arange(n, dtype=np.float64)


def resample(fn):
    """Apply fn(r, c) -> values in row strips to bound memory."""
    out = None
    for a in range(0, n, 512):
        Xs, Zs = np.meshgrid(xs, zs[a:a + 512])
        E, N = scene_to_lks(Xs, Zs)
        r, c = M.index(E, N)
        v = fn(r, c)
        if out is None:
            out = np.empty((n,) + v.shape[1:], v.dtype)
        out[a:a + 512] = v
    return out


def nearest(a):
    def f(r, c):
        ri = np.clip(np.round(r).astype(np.int64), 0, M.h - 1); ci = np.clip(np.round(c).astype(np.int64), 0, M.w - 1)
        v = a[ri, ci]
        inside = (r > -0.5) & (r < M.h - 0.5) & (c > -0.5) & (c < M.w - 0.5)
        return np.where(inside, v, 0).astype(a.dtype)
    return f


g = M["gmean"]
gv = np.isfinite(g)
g0 = np.where(gv, g, 0).astype(np.float32)
gw = gv.astype(np.float32)


def ground(r, c):
    num = bilinear(g0, r, c); den = bilinear(gw, r, c)
    inside = (r >= 0) & (r <= M.h - 1) & (c >= 0) & (c <= M.w - 1)
    # a height needs at least half of its bilinear footprint to be measured
    return np.where(inside & (den > 0.5), num / np.maximum(den, 1e-6), np.nan).astype(np.float32)


dtm = resample(ground)
print(f"ground resampled, measured {np.isfinite(dtm).mean() * 100:.1f} %, {time.time() - t0:.0f}s", flush=True)
allc = resample(nearest(M["allcnt"]))
bcnt = resample(nearest(M["bcnt"]))
inten = resample(nearest(M["imean"]))
vmax = resample(nearest(np.nan_to_num(M["vmax"], nan=-1e4)))
bmax = resample(nearest(np.nan_to_num(M["bmax"], nan=-1e4)))
del M, g, g0, gw

gap = ~np.isfinite(dtm)


def push_pull(a, valid):
    """Smooth gap filling: average valid data down a pyramid, then fill the
    gaps on the way back up from the next coarser level."""
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


filled = push_pull(np.where(gap, 0, dtm).astype(np.float32), ~gap)
print(f"gaps filled ({gap.mean() * 100:.1f} % of cells), {time.time() - t0:.0f}s", flush=True)

chm = np.where(vmax > -1e3, np.maximum(vmax - filled, 0), 0).astype(np.float32)
bht = np.where(bmax > -1e3, np.maximum(bmax - filled, 0), 0).astype(np.float32)
void = (allc == 0)

np.savez(os.path.join(CACHE, "scene1m.npz"), dtm=filled, gap=gap.astype(np.uint8), void=void.astype(np.uint8),
         chm=np.minimum(chm, 60).astype(np.float16), bld=np.minimum(bcnt, 255).astype(np.uint8),
         bht=np.minimum(bht, 60).astype(np.float16), inten=np.minimum(inten, 65535).astype(np.uint16),
         X0=X0, Z0=Z0)
print(f"wrote scene1m.npz {n} x {n}, elev {filled.min():.1f}..{filled.max():.1f} m, {time.time() - t0:.0f}s")
