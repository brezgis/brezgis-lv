"""Shared helpers for the LiDAR bake: scene frame <-> LKS-92, mosaic loading.

The scene frame is the one every other baked dataset uses (data/bake-roads.mjs):
origin at Taurene village centre, x east, z south, metres from a local
equirectangular approximation. That approximation is about 0.24 % short in the
east-west direction against true ground metres (11 m at the east edge of the
map). The LiDAR is resampled INTO that frame so that it lines up with the
OpenStreetMap geometry already baked in it.
"""
import glob, math, os
import numpy as np

LAT0, LON0 = 57.15944, 25.66472
OFF_X, OFF_Z, SPAN = 500.0, 1700.0, 8800.0
MLAT = 111360.0
MLON = 111320.0 * math.cos(math.radians(LAT0))
CACHE = os.environ.get("LIDAR_CACHE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "lidar-cache")


def lks92(lat, lon):
    """Geographic (degrees, numpy arrays ok) -> LKS-92 TM easting, northing."""
    a = 6378137.0; f = 1 / 298.257222101; k0 = 0.9996; lon0 = np.radians(24.0)
    e2 = f * (2 - f); ep2 = e2 / (1 - e2)
    p = np.radians(lat); l = np.radians(lon)
    N = a / np.sqrt(1 - e2 * np.sin(p) ** 2); T = np.tan(p) ** 2
    C = ep2 * np.cos(p) ** 2; A = (l - lon0) * np.cos(p)
    M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p
             - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * np.sin(2 * p)
             + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * np.sin(4 * p)
             - (35 * e2 ** 3 / 3072) * np.sin(6 * p))
    E = 500000 + k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120)
    Nn = -6000000 + k0 * (M + N * np.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24
                                                + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720))
    return E, Nn


def scene_to_lks(x, z):
    return lks92(LAT0 - np.asarray(z) / MLAT, LON0 + np.asarray(x) / MLON)


def scene_to_latlon(x, z):
    return LAT0 - z / MLAT, LON0 + x / MLON


def latlon_to_scene(lat, lon):
    return (lon - LON0) * MLON, -(lat - LAT0) * MLAT


class Mosaic:
    """All cached 1 km tiles as one LKS-aligned 1 m raster per layer (row 0 = south)."""

    def __init__(self, layers=("gmean",)):
        files = sorted(glob.glob(os.path.join(CACHE, "*_*.npz")))
        if not files:
            raise SystemExit(f"no tiles in {CACHE}; run data/fetch-lidar.py first")
        keys = [tuple(int(v) for v in os.path.basename(f)[:-4].split("_")) for f in files]
        self.e0 = min(k[0] for k in keys); self.n0 = min(k[1] for k in keys)
        self.w = (max(k[0] for k in keys) - self.e0 + 1) * 1000
        self.h = (max(k[1] for k in keys) - self.n0 + 1) * 1000
        self.layers = {}
        self.meta = {}
        for name in layers:
            self.layers[name] = None
        for f, (e, n) in zip(files, keys):
            d = np.load(f)
            self.meta[(e, n)] = dict(name=str(d["name"]), tmin=float(d["tmin"]), tmax=float(d["tmax"]),
                                     classes=d["classes"].tolist(), npts=int(d["npts"]))
            r0, c0 = (n - self.n0) * 1000, (e - self.e0) * 1000
            for name in layers:
                a = d[name]
                if self.layers[name] is None:
                    fill = np.nan if a.dtype.kind == "f" else 0
                    self.layers[name] = np.full((self.h, self.w), fill, a.dtype)
                self.layers[name][r0:r0 + 1000, c0:c0 + 1000] = a

    def __getitem__(self, name):
        return self.layers[name]

    def index(self, E, N):
        """Fractional (row, col) of LKS coordinates; cell centres at +0.5."""
        return np.asarray(N) - self.n0 * 1000 - 0.5, np.asarray(E) - self.e0 * 1000 - 0.5


def bilinear(a, r, c):
    r = np.clip(r, 0, a.shape[0] - 1.001); c = np.clip(c, 0, a.shape[1] - 1.001)
    r0 = np.floor(r).astype(np.int64); c0 = np.floor(c).astype(np.int64)
    fr = (r - r0).astype(np.float32); fc = (c - c0).astype(np.float32)
    return (a[r0, c0] * (1 - fr) * (1 - fc) + a[r0, c0 + 1] * (1 - fr) * fc
            + a[r0 + 1, c0] * fr * (1 - fc) + a[r0 + 1, c0 + 1] * fr * fc)


def scene_grid(step, margin=0.0):
    """Scene x (east) and z (south) coordinates of a regular grid; row 0 = north."""
    n = int(round((SPAN + 2 * margin) / step)) + 1
    xs = OFF_X - SPAN / 2 - margin + np.arange(n) * step
    zs = OFF_Z - SPAN / 2 - margin + np.arange(n) * step
    return xs, zs


def hillshade(dem, cell, az=315.0, alt=40.0, zf=1.0):
    """Row 0 = north. Returns uint8."""
    gy, gx = np.gradient(dem.astype(np.float32) * zf, cell)
    # gy is d/d(row) = d/d(south); slope vector east = gx, north = -gy
    azr, altr = math.radians(az), math.radians(alt)
    lx, ly, lz = math.sin(azr) * math.cos(altr), math.cos(azr) * math.cos(altr), math.sin(altr)
    nx, ny, nz = -gx, gy, np.ones_like(gx)
    s = (nx * lx + ny * ly + nz * lz) / np.sqrt(nx * nx + ny * ny + 1)
    return np.clip(s * 255, 0, 255).astype(np.uint8)
