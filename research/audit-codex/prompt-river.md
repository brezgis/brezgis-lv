You are an adversarial code reviewer for a Three.js heritage simulation at ~/projects/village (already built to artifact/brezgi-taurene.html — do NOT run build.mjs, do NOT git commit; read-only except for writing your outputs).

Adversarially review the river/terrain pipeline for CORRECTNESS bugs:
- src/terrain.js sculpt: spline-following river stamps (deep bed + SHELF carve to waterline−0.55 within 16m; pond basin; lake beds) — does the shelf ever cut a road crossing or dam a stream confluence? does microDamp fight the stamps?
- meshHeightAt: exact rendered-mesh sampling (vertex grid, PlaneGeometry diagonal split, signed steps for the rotateX row order) — verify row order, diagonal orientation, and edge clamps against how buildTerrain fills the array.
- paint bands: bank/gravel/mud vs road paint ordering (who wins where they overlap?)
- src/water.js: ribbon flat to 96% width + hidden rim drop; the SANDY APRON is welded vertex-for-vertex to the ribbon (same SEG + tangent window) — can slivers open at reach ends or stream junctions? can the apron z-fight the shelf? are the apron normals/winding correct on both banks?
- src/landuse.js splat-refined distToRiver: window size vs the thresholds used by grass/vegetation exclusion — any gap where plants can stand in water?

You may verify visually with the screenshot harness (headless Chrome; batch your shots):
  cd ~/projects/village && node data/dbg.mjs research/audit-codex/shots/<name>.png "era=N;time=0.4;cam=x,y,z;tgt=x,y,z;wait=900"
(nofog=1, hide=vegetation etc. available; scene metres, origin = village centre; RIVER_PTS in src/geodata.js gives river coordinates; terrain y ~185-259.)
You can VIEW the PNGs you take.

Report ONLY defects with concrete evidence (file:line or screenshot). Write to research/audit-codex/findings-river.json:
{"findings":[{"title":"...","area":"file:line","severity":"high|med|low","evidence":"...","fix_hint":"..."}]}
Empty array if nothing holds up. Finish by printing DONE.
