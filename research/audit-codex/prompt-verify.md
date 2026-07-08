You are an adversarial verifier for a Three.js heritage simulation at /home/anna/projects/village (already built to artifact/brezgi-taurene.html — do NOT run build.mjs, do NOT git commit; work read-only except for writing your outputs).

The file research/audit-codex/uncertain.json holds 8 findings from another reviewer whose verification never completed. For EACH finding, try hard to REFUTE it by reading the actual code in src/ and, for visual claims, by taking your own screenshots. Default to REFUTED if the evidence does not hold up.

Screenshot harness (headless Chrome; each page load takes 30-120s, so BATCH shots — few page loads):
  cd /home/anna/projects/village && node data/dbg.mjs research/audit-codex/shots/<name>.png "era=<0..5>;time=0.4;cam=x,y,z;tgt=x,y,z;wait=900"
Extra params: nofog=1 disables fog; hide=<group,group> hides named groups (terrain,vegetation,clouds,stars).
Coordinates: scene metres, origin = village centre; x east, z south; terrain y ~185-259. Era 1 = AD 50, era 4 = 1935, era 5 = 2025.
Key locations in src/landuse.js (LOC). The river spline points are RIVER_PTS in src/geodata.js.
You can VIEW the PNGs you take (you have vision).

Write your verdicts to research/audit-codex/verdicts.json as a JSON array, one entry per finding, in the same order as uncertain.json:
[{"title": "<copied>", "verdict": "CONFIRMED|REFUTED|UNCERTAIN", "reason": "<2-4 sentences: what you checked, code lines and/or screenshot names as evidence>"}]

Be rigorous: cite specific file:line for code claims; name the screenshot files for visual claims. Finish by printing DONE.

NOTE: you run sandboxed. If launching headless Chrome (node data/dbg.mjs) fails due to sandboxing, do NOT stall: fall back to code-only analysis, mark affected verdicts UNCERTAIN, and add a top-level "wanted_shots" array to verdicts.json — each entry {"name":"...","args":"era=..;cam=..;tgt=..;wait=900","looking_for":"..."} — so the orchestrator can take them for you.
