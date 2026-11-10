#!/usr/bin/env python3
"""Stage 3 of the LiDAR bake: measured hydrography -> src/geodata.js.

The courses come from OpenStreetMap (data/osm-water.json) and are corrected
against the laser survey, which sees water as the strip where no pulse came
back:

  Gauja     centreline moved onto the middle of the open-water strip, the
            real channel width at every station, and the water level read off
            the ground at the water's edge (then made to fall monotonically)
  brooks    centreline snapped to the surveyed thalweg, level from its bed
  lakes     shoreline traced from the open-water area, level from the shore
  summit    Brezga kalns from the ground model

Scene metres, origin = Taurene village centre, x east, z south, y = m above sea
level (LAS-2000,5). River points are ordered downstream.

Usage: LIDAR_CACHE=... python3 data/bake-hydro.py [--debug DIR]
"""
import json, os, sys
import numpy as np
from scipy import ndimage
from skimage import measure, morphology
from shapely.geometry import Polygon, Point
from lidar_common import latlon_to_scene, OFF_X, OFF_Z, SPAN, CACHE

HERE = os.path.dirname(os.path.abspath(__file__))
d = np.load(os.path.join(CACHE, "scene1m.npz"))
dtm = d["dtm"]; void = d["void"].astype(bool); gap = d["gap"].astype(bool)
bld = d["bld"] > 0
X0 = float(d["X0"]); Z0 = float(d["Z0"])
H, W = dtm.shape
XMIN, XMAX = OFF_X - SPAN / 2, OFF_X + SPAN / 2
ZMIN, ZMAX = OFF_Z - SPAN / 2, OFF_Z + SPAN / 2
in_rect = lambda p: XMIN < p[0] < XMAX and ZMIN < p[1] < ZMAX
dtm_s = ndimage.gaussian_filter(dtm, 1.0)


def at(a, x, z):
    r = np.clip(np.round(np.asarray(z) - Z0).astype(int), 0, H - 1)
    c = np.clip(np.round(np.asarray(x) - X0).astype(int), 0, W - 1)
    return a[r, c]


def densify(pts, step):
    pts = np.asarray(pts, float)
    dl = np.hypot(*np.diff(pts[:, :2], axis=0).T)
    keep = np.r_[True, dl > 1e-6]
    pts = pts[keep]; dl = np.hypot(*np.diff(pts[:, :2], axis=0).T)
    cum = np.r_[0, np.cumsum(dl)]
    t = np.arange(0, cum[-1], step)
    if cum[-1] - t[-1] > step * 0.3:
        t = np.r_[t, cum[-1]]
    else:
        t[-1] = cum[-1]
    return np.c_[np.interp(t, cum, pts[:, 0]), np.interp(t, cum, pts[:, 1])], t


def frame(xy):
    tx = np.gradient(xy[:, 0]); tz = np.gradient(xy[:, 1])
    L = np.hypot(tx, tz) + 1e-9
    tx /= L; tz /= L
    return tx, tz, -tz, tx


def nanmedfilt(a, k):
    out = a.copy(); h = k // 2
    for i in range(len(a)):
        w = a[max(0, i - h):i + h + 1]; w = w[np.isfinite(w)]
        out[i] = np.median(w) if w.size else np.nan
    return out


def fill_nan(a):
    a = a.copy(); ok = np.isfinite(a)
    if not ok.any():
        return np.zeros_like(a)
    a[~ok] = np.interp(np.flatnonzero(~ok), np.flatnonzero(ok), a[ok])
    return a


def smooth(a, sigma):
    return ndimage.gaussian_filter1d(a, sigma, mode="nearest")


def isotonic_down(y, w=None):
    """Least-squares non-increasing fit (pool adjacent violators)."""
    y = np.asarray(y, float); w = np.ones_like(y) if w is None else np.asarray(w, float)
    vals, wts, cnt = [], [], []
    for yi, wi in zip(y, w):
        vals.append(yi); wts.append(wi); cnt.append(1)
        while len(vals) > 1 and vals[-2] < vals[-1]:
            v = (vals[-2] * wts[-2] + vals[-1] * wts[-1]) / (wts[-2] + wts[-1])
            wts[-2] += wts[-1]; cnt[-2] += cnt[-1]; vals[-2] = v
            vals.pop(); wts.pop(); cnt.pop()
    return np.repeat(vals, cnt)


# ---------------------------------------------------------------- water mask
# Calm water absorbs the near-infrared pulse and returns nothing at all.
# Wind-ruffled water does send a few pulses back, and the survey files them
# under classes that are neither ground, vegetation nor building. So water is
# every cell with no ground return, no vegetation return and no roof.
nothing_grows = d["chm"].astype(np.float32) < 0.3
water = (void | (gap & nothing_grows)) & ~ndimage.binary_dilation(bld, iterations=3)
water = morphology.remove_small_objects(water, 30)
water_closed = ndimage.binary_closing(water, iterations=2)

# ---------------------------------------------------------------------- lakes
osm = json.load(open(os.path.join(HERE, "osm-water.json")))
osm_lakes = []
for e in osm:
    if e["kind"] != "water" or not e.get("geom") or len(e["geom"]) < 4:
        continue
    poly = [latlon_to_scene(p["lat"], p["lon"]) for p in e["geom"]]
    try:
        P = Polygon(poly).buffer(0)
    except Exception:
        continue
    osm_lakes.append((e.get("name") or "water", P))

# lakes are the open water that survives an 8 m opening (the river does not)
core = ndimage.binary_opening(water_closed, structure=morphology.disk(8))
lab, nlab = ndimage.label(core)
# Published maximum depths (metres). Taurenes ezers: 4.1 m maximum, 2.5 m mean,
# 1975 survey of the State Land Reclamation Design Institute, quoted in the
# lake's management rules (cesis.lv/images/userfiles/Taurenes_16.doc).
SOUNDED = {"Taurenes ezers": 4.1}
# lakes OpenStreetMap leaves unnamed in this extract, by a point inside them
KNOWN = {"Dabaru ezers": (-770, 900), "Stupēnu ezers": (-896, 1914), "Rijas ezers": (-1638, 3278)}
MIN_UNNAMED = 20000      # m2: smaller nameless ponds are mostly dug farm ponds
LAKES = []
lake_mask = np.zeros_like(water)
for k in range(1, nlab + 1):
    m = lab == k
    area = int(m.sum())
    if area < 4000:
        continue
    sl = ndimage.find_objects(m.astype(np.uint8))[0]
    pad = 40
    r0, r1 = max(0, sl[0].start - pad), min(H, sl[0].stop + pad)
    c0, c1 = max(0, sl[1].start - pad), min(W, sl[1].stop + pad)
    sub = m[r0:r1, c0:c1]
    # grow the opened core back to the real water's edge
    full = ndimage.binary_dilation(sub, structure=morphology.disk(9)) & water_closed[r0:r1, c0:c1]
    full = ndimage.binary_fill_holes(full)
    # water level: the lowest ground standing at the water's edge
    ring = ndimage.binary_dilation(full, iterations=2) & ~ndimage.binary_dilation(full, iterations=1) & ~gap[r0:r1, c0:c1]
    hs = dtm[r0:r1, c0:c1][ring]
    if hs.size < 20:
        continue
    level = float(np.percentile(hs, 10))
    # the shore the eye sees also takes in the reed and sedge fringe standing
    # in the water: ground returns within a hand of the water level that are
    # connected to the open water
    low = (dtm[r0:r1, c0:c1] < level + 0.12) | full
    reach = ndimage.binary_dilation(full, structure=morphology.disk(14))
    lab2, _ = ndimage.label(low & reach)
    ids = np.unique(lab2[full]); ids = ids[ids > 0]
    shore = np.isin(lab2, ids)
    shore = ndimage.binary_opening(ndimage.binary_fill_holes(shore), structure=morphology.disk(2)) | full
    sm = ndimage.gaussian_filter(shore.astype(np.float32), 1.5)
    cs = measure.find_contours(sm, 0.5)
    if not cs:
        continue
    c = max(cs, key=len)
    P = Polygon([(X0 + c0 + q[1], Z0 + r0 + q[0]) for q in c]).buffer(0)
    if P.geom_type == "MultiPolygon":
        P = max(P.geoms, key=lambda g: g.area)
    P = P.simplify(2.5)
    cen = P.representative_point()
    if not in_rect((cen.x, cen.y)) and not (XMIN < P.centroid.x < XMAX):
        continue
    name, best = "", 0.0
    for nm, Q in osm_lakes:
        try:
            ov = P.intersection(Q).area
        except Exception:
            ov = 0
        if ov > best and nm != "water":
            best, name = ov, nm
    for nm, (kx, kz) in KNOWN.items():
        if P.contains(Point(kx, kz)) or P.distance(Point(kx, kz)) < 30:
            name = nm
    if not name and P.area < MIN_UNNAMED:
        continue
    open_area = int(full.sum())
    LAKES.append(dict(name=name, level=round(level, 2), depth=SOUNDED.get(name, 0), area=round(P.area), open_area=open_area,
                      poly=[[round(x, 1), round(z, 1)] for x, z in P.exterior.coords[:-1]]))
    yy, xx = np.nonzero(ndimage.binary_dilation(shore, iterations=1))
    lake_mask[r0 + yy, c0 + xx] = True
    print(f"lake {name or '(unnamed)'}: level {level:.2f} m, shore area {P.area / 1e4:.2f} ha, open water {open_area / 1e4:.2f} ha, {len(P.exterior.coords)} pts")
lake_polys = [(l, Polygon(l["poly"])) for l in LAKES]


def lake_at(x, z):
    p = Point(x, z)
    for l, P in lake_polys:
        if P.contains(p):
            return l
    return None


# ---------------------------------------------------------------- the Gauja
dist = lambda a, b: float(np.hypot(a[0] - b[0], a[1] - b[1]))
segs = [[latlon_to_scene(p["lat"], p["lon"]) for p in e["geom"]] for e in osm
        if e["kind"] == "waterway:river" and e["name"] == "Gauja" and e["n"] > 3]
chain = segs.pop(0)
while segs:
    best, bd, mode = -1, 1e18, 0
    for i, w in enumerate(segs):
        for dd, m in ((dist(chain[-1], w[0]), 1), (dist(chain[-1], w[-1]), 2), (dist(chain[0], w[-1]), 3), (dist(chain[0], w[0]), 4)):
            if dd < bd:
                bd, best, mode = dd, i, m
    w = segs.pop(best)
    chain = chain + w if mode == 1 else chain + w[::-1] if mode == 2 else w + chain if mode == 3 else w[::-1] + chain
chain = [p for p in chain if in_rect(p)]
if chain[0][1] < chain[-1][1]:
    chain.reverse()                     # upstream (south) first

xy, s = densify(chain, 4.0)
tx, tz, nx, nz = frame(xy)
# Lakes the river threads cannot stand higher than the lake above them. The
# shore readings of neighbouring basins differ by a centimetre or two of
# survey noise, so each takes the lower of its own level and the one upstream.
run_level = np.inf
for p in xy:
    l = lake_at(*p)
    if l:
        l["level"] = round(min(l["level"], run_level), 2)
        run_level = l["level"]
offs = np.arange(-28, 28.01, 0.5)
wet = water_closed | (gap & ~bld)       # trees overhanging the channel leave gaps, not voids
cen = np.full(len(xy), np.nan); wid = np.full(len(xy), np.nan); edge = np.full(len(xy), np.nan)
inlake = np.zeros(len(xy), bool)
for i in range(len(xy)):
    if lake_at(*xy[i]):
        inlake[i] = True
        continue
    px = xy[i, 0] + nx[i] * offs; pz = xy[i, 1] + nz[i] * offs
    v = at(water_closed, px, pz); g = at(wet, px, pz)
    lab1, n1 = ndimage.label(g)
    best = None
    for k in range(1, n1 + 1):
        idx = np.flatnonzero(lab1 == k)
        if not v[idx].any():
            continue                      # a gap with no open water in it is a thicket
        a, b = offs[idx[0]], offs[idx[-1]]
        dd = 0 if a <= 0 <= b else min(abs(a), abs(b))
        if best is None or dd < best[0]:
            best = (dd, (a + b) / 2, b - a + 0.5, idx)
    if best is None or best[0] > 9 or best[2] > 40:
        continue
    cen[i], wid[i] = best[1], best[2]
    idx = best[3]
    lo, hi = max(idx[0] - 3, 0), min(idx[-1] + 3, len(offs) - 1)
    hs = np.r_[at(dtm, px[lo:idx[0]], pz[lo:idx[0]]), at(dtm, px[idx[-1] + 1:hi + 1], pz[idx[-1] + 1:hi + 1])]
    if hs.size:
        edge[i] = hs.min()

found = np.isfinite(cen)
print(f"Gauja: {len(xy)} stations, channel seen at {found.sum()} ({found.mean() * 100:.0f} %), in lakes {inlake.sum()}")
# robust: drop width outliers against the local median, then smooth
wm = nanmedfilt(wid, 31)
bad = found & ((wid > 2.2 * wm) | (wid < 0.4 * wm))
cen[bad] = np.nan; wid[bad] = np.nan; edge[bad] = np.nan
cen_s = smooth(fill_nan(nanmedfilt(cen, 9)), 3.0)
cen_s[inlake] = 0
wid_s = smooth(fill_nan(nanmedfilt(wid, 15)), 5.0)
cen_s = np.clip(cen_s, -12, 12)
rx = xy[:, 0] + nx * cen_s; rz = xy[:, 1] + nz * cen_s

# levels: lake reaches take the lake level, free reaches the smoothed edge
lev = nanmedfilt(edge, 21)
for i in np.flatnonzero(inlake):
    lev[i] = lake_at(*xy[i])["level"]

# ---- the mill pond ---------------------------------------------------------
# A weir stands on the Gauja below the manor today (OSM node 11038537656) and
# holds the river back through the village as a long pond, the one the 1930s
# Army sheet already draws. The survey therefore measured the POND there, not
# the river. The river every era shares is the undammed one: its level falls
# evenly from the head of the backwater to the tailwater below the weir and
# its width is that of the free reaches. The pond is published separately and
# the scene floods it in the eras that have a mill.
WEIR = (424.0, -417.0)
iw = int(np.argmin(np.hypot(xy[:, 0] - WEIR[0], xy[:, 1] - WEIR[1])))
POND = None
if np.hypot(xy[iw, 0] - WEIR[0], xy[iw, 1] - WEIR[1]) < 40:
    up = lev[max(0, iw - 90):iw - 3]; dn = lev[iw + 6:iw + 30]
    Lp = float(np.nanmedian(up)); Lt = float(np.nanmedian(dn))
    ih = iw
    run = 0
    for i in range(iw - 3, 0, -1):
        if np.isfinite(lev[i]) and lev[i] > Lp + 0.2 and not inlake[i]:
            run += 1
            if run >= 6:
                ih = i + 5; break
        elif inlake[i]:
            ih = i + 1; break
        else:
            run = 0
    free = found & ~inlake
    free[ih:iw + 1] = False
    w_free = float(np.nanmedian(wid[free]))
    head = Lp - Lt
    print(f"mill pond: level {Lp:.2f} m, tailwater {Lt:.2f} m (head {head:.2f} m), backwater {s[iw] - s[ih]:.0f} m long, median width {np.nanmedian(wid[ih:iw]):.1f} m against {w_free:.1f} m on the free reaches")
    if head > 0.3:
        top = float(np.nanmedian(lev[max(0, ih - 12):ih + 1]))
        top = max(top, Lp)
        nat = np.interp(s[ih:iw + 1], [s[ih], s[iw]], [top, Lt])
        lev[ih:iw + 1] = nat
        wid[ih:iw + 1] = np.minimum(np.nan_to_num(wid[ih:iw + 1], nan=w_free), w_free * (1 + 0.25 * np.sin(s[ih:iw + 1] / 37.0)))
        # the valley floor under the pond: a hand above the undammed river
        near = np.zeros_like(water_closed)
        rr = np.clip(np.round(xy[ih:iw + 1, 1] - Z0).astype(int), 0, H - 1); cc = np.clip(np.round(xy[ih:iw + 1, 0] - X0).astype(int), 0, W - 1)
        near[rr, cc] = True
        labp, _ = ndimage.label(water_closed | ndimage.binary_dilation(near, iterations=2))
        ids = np.unique(labp[rr, cc]); ids = ids[ids > 0]
        pmask = np.isin(labp, ids) & (ndimage.distance_transform_edt(~near) < 90)
        pmask = ndimage.binary_dilation(pmask, iterations=2)
        pr, pc = np.nonzero(pmask)
        # nearest pond station for each cell
        from scipy.spatial import cKDTree
        tree = cKDTree(xy[ih:iw + 1])
        _, j = tree.query(np.c_[pc + X0, pr + Z0])
        floor = (nat[j] + 0.18).astype(np.float32)
        np.savez(os.path.join(CACHE, "pondfloor.npz"), r=pr, c=pc, h=floor)
        POND = dict(x=round(float(xy[iw, 0]), 1), z=round(float(xy[iw, 1]), 1), level=round(Lp, 2), tail=round(Lt, 2),
                    area=int(pmask.sum()))
        print(f"  pond floor reset over {pmask.sum() / 1e4:.2f} ha")
wts = np.where(inlake, 50.0, np.where(np.isfinite(lev), 1.0, 0.0))
lev = fill_nan(lev)
lev_fit = isotonic_down(lev, np.maximum(wts, 1e-3))
print(f"Gauja level {lev_fit[0]:.2f} -> {lev_fit[-1]:.2f} m; width median {np.nanmedian(wid):.1f} m (p10 {np.nanpercentile(wid, 10):.1f}, p90 {np.nanpercentile(wid, 90):.1f}); centreline moved median {np.nanmedian(np.abs(cen)):.1f} m, max {np.nanmax(np.abs(cen_s)):.1f} m")

# resample to ~12 m stations
STEP_OUT = 3
RIVER_PTS = [[round(float(rx[i]), 1), round(float(rz[i]), 1), round(float(lev_fit[i]), 2), round(float(max(wid_s[i], 2.4) / 2), 2)]
             for i in list(range(0, len(xy) - 1, STEP_OUT)) + [len(xy) - 1]]
river_xy = np.c_[rx, rz]

# ------------------------------------------------------------------ brooks
def dist_to_river(p):
    return float(np.min(np.hypot(river_xy[:, 0] - p[0], river_xy[:, 1] - p[1])))


STREAMS = []
groups = {}
for e in osm:
    if "stream" not in e["kind"] and not ("river" in e["kind"] and e["name"] != "Gauja"):
        continue
    if not e.get("geom") or e["n"] < 4:
        continue
    groups.setdefault(e["name"], []).append([latlon_to_scene(p["lat"], p["lon"]) for p in e["geom"]])
for name, group in groups.items():
    for seg in group:
        pts = [p for p in seg if in_rect(p)]
        if len(pts) < 5:
            continue
        xy2, s2 = densify(pts, 6.0)
        if len(xy2) < 6:
            continue
        display = "" if name in ("stream", "river") else name
        if not display and s2[-1] < 540:
            continue                      # tiny nameless ditches
        tx2, tz2, nx2, nz2 = frame(xy2)
        o = np.arange(-7, 7.01, 0.5)
        off = np.zeros(len(xy2)); bed = np.zeros(len(xy2))
        for i in range(len(xy2)):
            hs = at(dtm_s, xy2[i, 0] + nx2[i] * o, xy2[i, 1] + nz2[i] * o)
            # the lowest point, with a mild preference for staying put
            j = int(np.argmin(hs + 0.012 * np.abs(o)))
            off[i], bed[i] = o[j], hs[j]
        off = smooth(nanmedfilt(off, 7), 2.0)
        taper = np.minimum(1, np.minimum(np.arange(len(off)), np.arange(len(off))[::-1]) / 4.0)
        off *= taper
        sx = xy2[:, 0] + nx2 * off; sz = xy2[:, 1] + nz2 * off
        bed = at(dtm_s, sx, sz)
        if nanmedfilt(bed, 9)[0] < nanmedfilt(bed, 9)[-1]:
            sx, sz, bed = sx[::-1], sz[::-1], bed[::-1]
        lv = isotonic_down(nanmedfilt(bed, 9)) + 0.12       # a hand of water over the surveyed bed
        for i in range(len(sx)):
            l = lake_at(sx[i], sz[i])
            if l:
                lv[i] = l["level"]
        lv = np.minimum.accumulate(lv)
        STREAMS.append(dict(name=display, pts=[[round(float(sx[i]), 1), round(float(sz[i]), 1), round(float(lv[i]), 2)]
                                               for i in list(range(0, len(sx) - 1, 3)) + [len(sx) - 1]]))
        print(f"brook {display or '(unnamed)'}: {s2[-1]:.0f} m, {lv[0]:.2f} -> {lv[-1]:.2f} m, snapped median {np.median(np.abs(off)):.1f} m")

# ----------------------------------------------------------- Brezga kalns
r0, r1 = int(3600 - Z0), int(6100 - Z0); c0, c1 = int(300 - X0), int(3400 - X0)
sub = dtm_s[r0:r1, c0:c1]
j = np.unravel_index(np.argmax(sub), sub.shape)
BREZGA = dict(x=round(float(X0 + c0 + j[1])), z=round(float(Z0 + r0 + j[0])), y=round(float(sub[j]), 1))
print(f"Brežģa kalns summit: {BREZGA['y']} m at ({BREZGA['x']}, {BREZGA['z']})")

for l in LAKES:
    l.pop("area", None); l.pop("open_area", None)
out = os.path.join(HERE, "..", "src", "geodata.js")
with open(out, "w") as f:
    f.write("""// Baked by data/bake-hydro.py from OpenStreetMap water geometry corrected
// against the LGIA laser survey. Scene metres, y = m above sea level.
// River points are [x, z, water level, half width], ordered downstream.
""")
    f.write(f"export const RIVER_PTS = {json.dumps(RIVER_PTS, separators=(',', ':'))};\n")
    f.write(f"export const STREAMS = {json.dumps(STREAMS, ensure_ascii=False, separators=(',', ':'))};\n")
    f.write(f"export const LAKES = {json.dumps(LAKES, ensure_ascii=False, separators=(',', ':'))};\n")
    f.write(f"export const BREZGA = {json.dumps(BREZGA)};\n")
    f.write("// the manor mill pond: weir position, surveyed pond level and tailwater\n")
    f.write(f"export const POND = {json.dumps(POND)};\n")
    f.write("export const CELL = 4;\n")
print("wrote src/geodata.js")

if "--debug" in sys.argv:
    out_dir = sys.argv[sys.argv.index("--debug") + 1]
    os.makedirs(out_dir, exist_ok=True)
    np.savez(os.path.join(out_dir, "river.npz"), s=s, xy=xy, rx=rx, rz=rz, cen=cen, wid=wid, wid_s=wid_s, edge=edge, lev=lev_fit, inlake=inlake)
