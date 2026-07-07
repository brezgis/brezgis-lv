#!/usr/bin/env python3
# Fetch the 1920s-30s Latvian Army topographic sheets (vesture.dodies.lv tile
# rips, home.dodies.lv) covering the sim's heightmap tile, stitch to PNGs in
# research/maps/. Sources: LVARM_40_75k (1:75K, 1920-40) and LVARM_40_25k_v2
# (1:25K, 1928-36). For heritage-verification use.
import math, os, sys, time, urllib.request

# heightmap tile bounds (same math as data/bake-roads.mjs)
LAT, LON = 57.15944, 25.66472
MLAT = 111360; MLON = 111320 * math.cos(math.radians(LAT))
OX, OZ, SPAN = 500, 1700, 8800
lat_n = LAT - (OZ - SPAN/2) / MLAT
lat_s = LAT - (OZ + SPAN/2) / MLAT
lon_w = LON + (OX - SPAN/2) / MLON
lon_e = LON + (OX + SPAN/2) / MLON

def tilenum(lat, lon, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y

from PIL import Image

def fetch_layer(name, z, out):
    x0, y0 = tilenum(lat_n, lon_w, z)
    x1, y1 = tilenum(lat_s, lon_e, z)
    W, H = x1 - x0 + 1, y1 - y0 + 1
    print(f'{name} z{z}: x {x0}-{x1}, y {y0}-{y1} = {W}x{H} tiles')
    img = Image.new('RGB', (W * 256, H * 256), (245, 242, 232))
    ok = miss = 0
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            url = f'https://home.dodies.lv/tiles/{name}/{z}/{tx}/{ty}.png'
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 heritage-research'})
                with urllib.request.urlopen(req, timeout=30) as r:
                    t = Image.open(r).convert('RGB')
                img.paste(t, ((tx - x0) * 256, (ty - y0) * 256))
                ok += 1
            except Exception as e:
                miss += 1
            time.sleep(0.15)   # be polite
    img.save(out)
    print(f'  {ok} tiles, {miss} missing -> {out} ({img.size[0]}x{img.size[1]})')
    # georeference note (web-mercator corner coords of the stitched image)
    n = 2 ** z
    def merc_corner(tx, ty):
        lon = tx / n * 360 - 180
        lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ty / n))))
        return lat, lon
    nw = merc_corner(x0, y0); se = merc_corner(x1 + 1, y1 + 1)
    with open(out.replace('.png', '.txt'), 'w') as f:
        f.write(f'{name} z{z} stitched: NW {nw[0]:.5f},{nw[1]:.5f} SE {se[0]:.5f},{se[1]:.5f}\n'
                f'sim tile bounds: N {lat_n:.5f} S {lat_s:.5f} W {lon_w:.5f} E {lon_e:.5f}\n'
                'source: vesture.dodies.lv / home.dodies.lv tile rips of Latvian Army maps\n')

os.makedirs('research/maps', exist_ok=True)
fetch_layer('LVARM_40_75k', 13, 'research/maps/topo75_1930s.png')
fetch_layer('LVARM_40_25k_v2', 14, 'research/maps/topo25_1930s.png')
