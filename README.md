# Brezgi — a Latvian village through time

An interactive Three.js reconstruction of the landscape around the Brezgi
farmstead site in **Taurenes pagasts** (formerly Nēķenes pagasts / Nötkenshof),
Vidzeme, Latvia — the same spot of earth shown at four moments in time:

| Era | Scene |
|---|---|
| ~AD 50 | Near-wilderness: aurochs grazing the Gauja terrace, a hunters' camp |
| ~AD 950 | A Latgalian farmstead, modelled on the Āraiši lake-fortress evidence |
| 1860 | The Brezgi viensēta under Nēķens manor |
| 1935 | Taurene, independent Latvia — the manor is now the school |

## Real geography

- **Terrain**: real elevation model, 4.8 × 4.8 km centred on Taurene
  (57.15944 N, 25.66472 E), from AWS Open Data terrain tiles → `data/fetch-terrain.mjs`
- **Water**: the actual mapped course of the Gauja, the outline of Taurenes
  ezers, and the Dzērbe stream, from OpenStreetMap → `data/bake-geodata.mjs`
- Everything else (buildings, textures, animals, sound) is procedural — no
  external assets.

## Build & run

```bash
npm install
node data/fetch-terrain.mjs    # (optional) re-fetch the DEM
node data/bake-geodata.mjs     # (optional) re-bake river/lake geometry
node build.mjs                 # bundle -> artifact/brezgi-taurene.html
```

Open `artifact/brezgi-taurene.html` in a browser. Keys 1–4 travel in time;
drag to look, scroll to zoom.

## Verification screenshots

```bash
node data/shot2.mjs out.png "eraNow=2;view=muiza;time=0.9;wait=900"
```

(Headless Chrome throttles requestAnimationFrame, hence the instant-jump hooks
on `window.__sim`.)

## Research

Cited research notes live in `research/`; the interpretive write-up with
sources is `WRITEUP.md` and is embedded in the app under **Chronicle & sources**.
