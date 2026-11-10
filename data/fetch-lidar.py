#!/usr/bin/env python3
"""Fetch the LGIA airborne laser scanning tiles that cover the scene and reduce
each 1 km tile to 1 m rasters.

Source: Latvian Geospatial Information Agency (LGIA), "Digitala augstuma modela
pamatdati", first national scanning cycle (2013-2019), LAS 1.2, LKS-92 TM
(EPSG:3059), heights LAS-2000,5. Licence CC BY 4.0.
https://www.lgia.gov.lv/lv/Digit%C4%81lais%20virsmas%20modelis

Each tile is ~300 MB, so the raw LAS is streamed to a temporary file, reduced,
and deleted. What is kept per tile (numpy .npz, 1000 x 1000 cells, row 0 = south):

  gmin, gmean  lowest / mean ground return (class 2), NaN where none
  gcnt         ground returns per cell
  vmax         highest vegetation return (classes 3, 4, 5), NaN where none
  bmax, bcnt   highest building return (class 6) and count
  wcnt         water returns (class 9), if the tile uses that class
  allcnt       all returns per cell (voids show open water)
  imean        mean intensity of ground returns
  tmin, tmax   GPS time range of the tile (scalars)

Usage:  LIDAR_CACHE=/some/big/disk python3 data/fetch-lidar.py [--jobs 6]
Only numpy is needed.
"""
import math, os, struct, subprocess, sys, json
from concurrent.futures import ThreadPoolExecutor
import numpy as np

BASE = "https://s3.storage.pub.lvdc.gov.lv/lgia-opendata/las"
CACHE = os.environ.get("LIDAR_CACHE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "lidar-cache")

# scene frame (must match data/lidar_common.py and src/heightmap.js)
LAT0, LON0 = 57.15944, 25.66472
OFF_X, OFF_Z, SPAN = 500.0, 1700.0, 8800.0
MLAT = 111360.0
MLON = 111320.0 * math.cos(math.radians(LAT0))


def lks92(lat, lon):
    """WGS84/GRS80 geographic -> LKS-92 TM (EPSG:3059) easting, northing."""
    a = 6378137.0; f = 1 / 298.257222101; k0 = 0.9996; lon0 = math.radians(24)
    e2 = f * (2 - f); ep2 = e2 / (1 - e2); p = math.radians(lat); l = math.radians(lon)
    N = a / math.sqrt(1 - e2 * math.sin(p) ** 2); T = math.tan(p) ** 2
    C = ep2 * math.cos(p) ** 2; A = (l - lon0) * math.cos(p)
    M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p
             - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * p)
             + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * p)
             - (35 * e2 ** 3 / 3072) * math.sin(6 * p))
    E = 500000 + k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120)
    Nn = -6000000 + k0 * (M + N * math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24
                                                  + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720))
    return E, Nn


def scene_to_lks(x, z):
    return lks92(LAT0 - z / MLAT, LON0 + x / MLON)


def tile_name(ekm, nkm):
    """TKS-93 1:2000 sheet name of the 1 km tile whose SW corner is (ekm, nkm) km.
    "AB" is a 100 km sheet (A = N // 100 km + 1, B = E // 100 km - 2). Two quadrant
    levels follow (1 SW, 2 SE, 3 NW, 4 NE), then a 5 x 5 block of 5 km sheets and
    a 5 x 5 block of 1 km sheets, each written row-from-south, column-from-west.
    Calibrated on real LAS header bounds:
      2434-15-15 E649 N175   3232-25-33 E447 N257   3334-42-53 E532 N294
      3431-55-44 E623 N273   4324-55-52 E596 N349   4423-34-41 E665 N338
      5321-14-14 E568 N400"""
    A, B = nkm // 100 + 1, ekm // 100 - 2
    de, dn = ekm % 100, nkm % 100
    def quad(de, dn, size):
        h = size // 2
        east, north = de >= h, dn >= h
        return 1 + east + 2 * north, de - h * east, dn - h * north
    q1, de, dn = quad(de, dn, 100)
    q2, de, dn = quad(de, dn, 50)
    return f"{A}{B}{q1}{q2}-{dn // 5 + 1}{de // 5 + 1}-{dn % 5 + 1}{de % 5 + 1}"


def scene_tiles():
    es, ns = [], []
    for x in (OFF_X - SPAN / 2, OFF_X, OFF_X + SPAN / 2):
        for z in (OFF_Z - SPAN / 2, OFF_Z, OFF_Z + SPAN / 2):
            E, N = scene_to_lks(x, z); es.append(E); ns.append(N)
    e0, e1 = int(min(es) // 1000), int(max(es) // 1000)
    n0, n1 = int(min(ns) // 1000), int(max(ns) // 1000)
    return [(e, n) for n in range(n0, n1 + 1) for e in range(e0, e1 + 1)]


POINT_DTYPES = {
    0: [("x", "<i4"), ("y", "<i4"), ("z", "<i4"), ("i", "<u2"), ("flags", "u1"), ("cls", "u1"),
        ("ang", "i1"), ("user", "u1"), ("src", "<u2")],
}
POINT_DTYPES[1] = POINT_DTYPES[0] + [("t", "<f8")]
POINT_DTYPES[2] = POINT_DTYPES[0] + [("r", "<u2"), ("g", "<u2"), ("b", "<u2")]
POINT_DTYPES[3] = POINT_DTYPES[1] + [("r", "<u2"), ("g", "<u2"), ("b", "<u2")]


def reduce_las(path, ekm, nkm):
    with open(path, "rb") as fh:
        h = fh.read(375)
    assert h[:4] == b"LASF", "not a LAS file"
    off = struct.unpack_from("<I", h, 96)[0]
    fmt = h[104] & 0x3F
    reclen = struct.unpack_from("<H", h, 105)[0]
    npts = struct.unpack_from("<I", h, 107)[0]
    sx, sy, sz, ox, oy, oz = struct.unpack_from("<6d", h, 131)
    fields = list(POINT_DTYPES[fmt])
    base = np.dtype(fields).itemsize
    if reclen > base:
        fields.append(("pad", f"V{reclen - base}"))
    pts = np.memmap(path, dtype=np.dtype(fields), mode="r", offset=off, shape=(npts,))
    S = 1000
    acc = dict(
        gmin=np.full(S * S, np.inf, np.float32), gsum=np.zeros(S * S, np.float64),
        gcnt=np.zeros(S * S, np.uint16), vmax=np.full(S * S, -np.inf, np.float32),
        bmax=np.full(S * S, -np.inf, np.float32), bcnt=np.zeros(S * S, np.uint16),
        wcnt=np.zeros(S * S, np.uint16), allcnt=np.zeros(S * S, np.uint16),
        isum=np.zeros(S * S, np.float64))
    classes = np.zeros(256, np.int64)
    tmin, tmax = np.inf, -np.inf
    CH = 4_000_000
    for a in range(0, npts, CH):
        p = pts[a:a + CH]
        x = p["x"] * sx + ox - ekm * 1000.0
        y = p["y"] * sy + oy - nkm * 1000.0
        z = (p["z"] * sz + oz).astype(np.float32)
        cls = p["cls"] & 0x1F
        classes += np.bincount(cls, minlength=256)
        ix = np.clip(x.astype(np.int32), 0, S - 1); iy = np.clip(y.astype(np.int32), 0, S - 1)
        c = iy * S + ix
        if "t" in p.dtype.names:
            t = p["t"]; tmin = min(tmin, float(t.min())); tmax = max(tmax, float(t.max()))
        acc["allcnt"] += np.minimum(np.bincount(c, minlength=S * S), 65535).astype(np.uint16)
        g = cls == 2
        if g.any():
            cg, zg = c[g], z[g]
            np.minimum.at(acc["gmin"], cg, zg)
            acc["gsum"] += np.bincount(cg, weights=zg, minlength=S * S)
            acc["isum"] += np.bincount(cg, weights=p["i"][g], minlength=S * S)
            acc["gcnt"] += np.bincount(cg, minlength=S * S).astype(np.uint16)
        v = (cls >= 3) & (cls <= 5)
        if v.any():
            np.maximum.at(acc["vmax"], c[v], z[v])
        b = cls == 6
        if b.any():
            np.maximum.at(acc["bmax"], c[b], z[b])
            acc["bcnt"] += np.bincount(c[b], minlength=S * S).astype(np.uint16)
        w = cls == 9
        if w.any():
            acc["wcnt"] += np.bincount(c[w], minlength=S * S).astype(np.uint16)
    del pts
    gc = acc["gcnt"].astype(np.float64)
    with np.errstate(invalid="ignore", divide="ignore"):
        gmean = np.where(gc > 0, acc["gsum"] / gc, np.nan).astype(np.float32)
        imean = np.where(gc > 0, acc["isum"] / gc, 0).astype(np.float32)
    def fin(a):
        a = a.copy(); a[~np.isfinite(a)] = np.nan; return a.reshape(S, S)
    return dict(
        gmin=fin(acc["gmin"]), gmean=gmean.reshape(S, S), gcnt=acc["gcnt"].reshape(S, S),
        vmax=fin(acc["vmax"]), bmax=fin(acc["bmax"]), bcnt=acc["bcnt"].reshape(S, S),
        wcnt=acc["wcnt"].reshape(S, S), allcnt=acc["allcnt"].reshape(S, S),
        imean=imean.reshape(S, S), tmin=tmin, tmax=tmax, npts=npts,
        classes=classes[:32], fmt=fmt)


def do_tile(en):
    ekm, nkm = en
    name = tile_name(ekm, nkm)
    out = os.path.join(CACHE, f"{ekm}_{nkm}.npz")
    if os.path.exists(out):
        return name, "cached"
    url = f"{BASE}/{name[:4]}/{name}.las"
    tmp = os.path.join(CACHE, f"{name}.las.part")
    for attempt in range(4):
        r = subprocess.run(["curl", "-sS", "-f", "-C", "-", "--retry", "5", "--retry-delay", "5",
                            "-o", tmp, url], capture_output=True, text=True)
        if r.returncode == 0:
            break
        if "404" in r.stderr or r.returncode == 22 and attempt == 0 and not os.path.exists(tmp):
            return name, "missing (404)"
    else:
        return name, f"download failed: {r.stderr.strip()[-200:]}"
    try:
        d = reduce_las(tmp, ekm, nkm)
    except Exception as e:  # keep going; report
        return name, f"reduce failed: {e!r}"
    np.savez_compressed(out + ".tmp.npz", name=name, **d)
    os.replace(out + ".tmp.npz", out)
    os.remove(tmp)
    return name, f"ok {d['npts'] / 1e6:.1f} M pts fmt {d['fmt']}"


if __name__ == "__main__":
    jobs = 6
    if "--jobs" in sys.argv:
        jobs = int(sys.argv[sys.argv.index("--jobs") + 1])
    os.makedirs(CACHE, exist_ok=True)
    tiles = scene_tiles()
    if "--list" in sys.argv:
        for t in tiles:
            print(t, tile_name(*t))
        sys.exit(0)
    print(f"{len(tiles)} tiles -> {CACHE}", flush=True)
    with ThreadPoolExecutor(jobs) as ex:
        for i, (name, status) in enumerate(ex.map(do_tile, tiles)):
            print(f"[{i + 1}/{len(tiles)}] {name}: {status}", flush=True)
    json.dump({"tiles": [[e, n, tile_name(e, n)] for e, n in tiles]}, open(os.path.join(CACHE, "index.json"), "w"))
