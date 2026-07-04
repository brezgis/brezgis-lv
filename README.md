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

Open `artifact/brezgi-taurene.html` in a browser.

**Controls**: drag to look, scroll to zoom. Press **WASD or the arrow keys**
to start walking (Shift sprints, Space jumps, V toggles flight, O returns to
orbit). Keys **1–6** or **[ ]** travel in time.

## Graphics pipeline (third edition)

Rendering techniques adapted from LAAS (MIT,
[Braffolk/fable5-world-demo](https://github.com/Braffolk/fable5-world-demo)),
re-implemented for WebGL and re-tuned from its Estonian old-growth reference
to Vidzeme species:

- **Trees** — parametric branching grammar (tropisms, crown envelopes,
  whorled/spiral phyllotaxis) meshed as parallel-transport bark tubes with
  root flare; real leaf/needle-spray twig meshes are rendered once at boot
  into a per-species atlas, then placed as alpha-tested cluster cards at the
  grammar's foliage anchors. Nine species: spruce, Scots pine, silver birch,
  pedunculate oak, black alder, small-leaved lime, apple, tundra dwarf
  shrub, snag. Far trees are whole-tree impostors captured from the same
  meshes.
- **Understory** — ferns (pinnate frond cards), mossy deadfall, stumps,
  glacial erratic boulders, lake-shore reed clumps.
- **Grass** — three camera-following bands of instanced blade clumps
  (~70k instances, ~350k blades) with cantilever tip² wind riding the same
  travelling gust field as the trees; midsummer flowers (meadowsweet,
  ox-eye daisy, buttercup).
- **Sky** — analytic dome + Rayleigh/Mie sun transmittance driving the
  light rig; per-pixel fbm cumulus billboards lit toward the sun; cirrus,
  dusk stars with a Milky Way band, and a fog-blended moraine horizon ring
  continuing the upland past the DEM edge.
- **Terrain** — real DEM with multi-octave albedo detail, micro-relief
  bump, slope-baring of glacial till, and river margins that read
  moist-grass → mud → gravel bar.

## Verification screenshots

```bash
node data/shot2.mjs out.png "eraNow=2;view=muiza;time=0.9;wait=900"
node data/dbg.mjs out.png "era=1;time=0.42;cam=-410,200,-16;tgt=-730,187,715;hide=clouds;probe=1"
node data/walktest.mjs   # controls regression: arrows must walk
```

(Headless Chrome throttles requestAnimationFrame, hence the instant-jump hooks
on `window.__sim`.)

## Research

Cited research notes live in `research/`; the interpretive write-up with
sources is `WRITEUP.md` and is embedded in the app under **Chronicle & sources**.
