# Historical map reference

## topo75_1930s.png — Latvian Army 1:75,000 (1920–1940)

Stitched from the vesture.dodies.lv tile rips (`home.dodies.lv/tiles/LVARM_40_75k`,
z13, 16 tiles; fetched by `data/fetch-armymap.py`). Georeference corners in
`topo75_1930s.txt`. The LVM GEO WMS (`public:topo75LKS`) serves the same series
but is unreachable from this network.

Reading notes:
- Elevations are in **sazhens** (×2.134 m): spot height 111.1 by Kalna Stērniķi
  ≈ 237 m; 118.0 near Brežģa krogs ≈ 252 m (survey: Brežģa kalns 258.7 m).
- The manor appears as **Nēķina mž.** with *Pag. vld.* (parish hall) beside it —
  the sheet predates/straddles the 1926 Taurene renaming.
- Family sites all present: **Brežgakrogs** (SE quarter), **Vidokšas**,
  **Gambas**, **Ludi**, **Gailiši** — matching the OSM-derived positions in
  `src/geodata-osm.js` within ~100 m.
- *Dz.* = dzirnavas (mill). A pond is drawn at the manor complex itself;
  "Dabari Dz." sits by the small lake NW — two mill sites in the parish.

## Verification results (sim 1935 era vs this sheet, 2026-07-07)

- **Settlement density confirmed**: the sheet shows a named viensēta every
  300–500 m in open country; the sim's ~200 background farms (DWELLINGS_OSM ×
  0.96 keep) match, slightly conservative if anything.
- **Forest pattern confirmed**: open farmed centre, forest masses NE around the
  lake chain and on the E/W tile edges.
- **Road corridors confirmed** (N to Krustakrogs, NE, SW to Lodes mž., SE past
  Keizari/Bebri to Brežģa krogs). Caveat: the sim draws the 1935 main road on
  the modern straightened P30 alignment; the 1930s road wound slightly more.
- **Mill pond at the manor confirmed** (pond drawn at Nēķina mž. complex).
