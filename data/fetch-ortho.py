#!/usr/bin/env python3
"""Fetch the LGIA colour orthophoto sheets that cover the scene and reduce each
to 1 m per pixel.

Source: Latvian Geospatial Information Agency, orthophoto maps of the 6th
cycle (flown 2016 to 2018, 25 cm, LKS-92 TM), open data, CC BY 4.0.
https://lgia.gov.lv/en/6-cikla-2016-2018-gads-ortofotokartes

Each 2.5 km sheet is a 315 MB TIFF, so it is downloaded, reduced to a
2500 x 2500 array and deleted. Kept per sheet in LIDAR_CACHE/ortho:
  <E>_<N>.npy   uint8 RGB, row 0 = north, with (E, N) the sheet's NW corner in metres

Usage: LIDAR_CACHE=/some/big/disk python3 data/fetch-ortho.py [--jobs 8]
"""
import os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
from lidar_common import CACHE, OFF_X, OFF_Z, SPAN, scene_to_lks

Image.MAX_IMAGE_PIXELS = None
BASE = "https://s3.storage.pub.lvdc.gov.lv/lgia-opendata/ortofoto_rgb_v6"
OUT = os.path.join(CACHE, "ortho")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def sheet5k(ekm, nkm):
    """TKS-93 name of the 5 km sheet whose SW corner is (ekm, nkm) km (see fetch-lidar.py)."""
    A, B = nkm // 100 + 1, ekm // 100 - 2
    de, dn = ekm % 100, nkm % 100
    def quad(de, dn, size):
        h = size // 2
        east, north = de >= h, dn >= h
        return 1 + east + 2 * north, de - h * east, dn - h * north
    q1, de, dn = quad(de, dn, 100)
    q2, de, dn = quad(de, dn, 50)
    return f"{A}{B}{q1}{q2}-{dn // 5 + 1}{de // 5 + 1}"


def sheets():
    es, ns = [], []
    for x in (OFF_X - SPAN / 2, OFF_X + SPAN / 2):
        for z in (OFF_Z - SPAN / 2, OFF_Z + SPAN / 2):
            E, N = scene_to_lks(x, z); es.append(float(E)); ns.append(float(N))
    e0, e1 = int(min(es) // 5000) * 5, int(max(es) // 5000) * 5
    n0, n1 = int(min(ns) // 5000) * 5, int(max(ns) // 5000) * 5
    return [f"{sheet5k(e, n)}_{q}" for n in range(n0, n1 + 1, 5) for e in range(e0, e1 + 1, 5) for q in (1, 2, 3, 4)]


def do(name):
    url = f"{BASE}/{name[:4]}/{name}"
    tfw = subprocess.run(["curl", "-sS", "-f", "-m", "60", url + ".tfw"], capture_output=True, text=True)
    if tfw.returncode != 0:
        return name, "no world file (sheet missing?)"
    a, _, _, d, cx, cy = [float(v) for v in tfw.stdout.split()]
    E, N = round(cx - a / 2), round(cy - d / 2)          # NW corner
    out = os.path.join(OUT, f"{E}_{N}.npy")
    if os.path.exists(out):
        return name, "cached"
    tmp = os.path.join(OUT, name + ".tif.part")
    r = subprocess.run(["curl", "-sS", "-f", "-C", "-", "--retry", "5", "--retry-delay", "5", "-o", tmp, url + ".tif"], capture_output=True, text=True)
    if r.returncode != 0:
        return name, "download failed: " + r.stderr.strip()[-160:]
    with Image.open(tmp) as im:
        k = round(1.0 / a)
        small = im.convert("RGB").reduce(k)
    np.save(out, np.asarray(small))
    os.remove(tmp)
    return name, f"ok {small.size[0]} x {small.size[1]} px, NW {E} {N}"


if __name__ == "__main__":
    jobs = int(sys.argv[sys.argv.index("--jobs") + 1]) if "--jobs" in sys.argv else 8
    os.makedirs(OUT, exist_ok=True)
    names = sheets()
    print(f"{len(names)} sheets -> {OUT}", flush=True)
    with ThreadPoolExecutor(jobs) as ex:
        for i, (n, s) in enumerate(ex.map(do, names)):
            print(f"[{i + 1}/{len(names)}] {n}: {s}", flush=True)
