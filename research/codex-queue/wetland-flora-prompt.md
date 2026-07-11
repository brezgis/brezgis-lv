# QUEUED codex job (OpenAI credits ran dry Jul 9 ~23:00; reset Jul 10 1:15 AM)
# Launch with:  codex exec --full-auto -C /home/anna/projects/village "$(cat research/codex-queue/wetland-flora-prompt.md)"
# Scope: src/vegetation.js ONLY (phase 1 of the original prompt — the settlement
# registry — was hand-implemented in src/footprints.js; the green-stick shrub and
# square litter fixes are also already done). Only the flora suite remains:
# PHASE 2 — the wet margins get their real flora (vegetation.js)

User asks: aquatic grasses "thicker, clump in places, more variety if it exists in the
real world". Real Vidzeme water margins: sedge tussocks, bulrush/cattail stands, yellow
flag iris, plus the existing Phragmites reeds. All instanced, deterministic, clumped in
PATCHES (use `bankCharAt` — sedges and cattails love the mud reaches), never uniform
sprinkle. Follow the reed pass's structure and register meshes the same way.

1. SEDGE TUSSOCKS (Carex): reuse the blade-clump approach (see grass.js bladeClump for
   the idea, but build a local ~12-blade arcing clump geometry here) — darker,
   stiffer-looking green (0.16, 0.24, 0.10 base), 0.35–0.7m tall, slight outward arc.
   Place: river margin `rv.d - rv.hw` ∈ [0.2, 4.5]; lake `lakeShoreDistAt < 6` on the
   LAND side with ground within +0.6 of lake level; stream margins similarly. Density
   ~1 per 2m of shoreline × (0.4 + 1.6·mud), patch-gated by `bankNoise`-style fbm so they
   come in colonies. Cap ~22k total, stride-subsample overflow.
2. CATTAILS (Typha): geometry = thin stem cylinder (1.1–1.7m) + dark-brown sausage head
   (0.14m cylinder near the top) + 2 strap leaves (thin stretched boxes at ±0.2 rad).
   They stand IN shallow water: river `rv.d - rv.hw` ∈ [−1.4, +0.3]; lakes INSIDE the
   shoreline with `lakeShoreDistAt < 7` (the new shore shelf makes this wading-depth).
   Mud reaches only (`ch.mud > 0.25`), colonies of 5–14. Cap ~9k.
3. YELLOW FLAG IRIS: small fan of 3–4 broad blades (brighter green 0.25, 0.4, 0.12,
   0.5–0.8m) + one small 3-quad yellow flower (0.95, 0.8, 0.15). Sparse accents in the
   sedge zone (1 clump per ~25m of muddy shoreline), eras 1+. Cap ~2.5k.
4. All three: era-independent placement is fine (wetlands persist), but respect
   `vegExcluded` boundaries — these are the EXCEPTION plants allowed in the margin, so
   place by the rules above, NOT via vegExcluded. Skip spots where `buildingAt` (phase 1)
   or a road (`distToRoad(era…)` — use era 4 as the network reference for statics) is
   within 2m.

# PHASE 2b — two visual bug fixes (vegetation.js)

5. "A weird plant that is just a thick stick of green": inspect the shrub geometry the
   9m grid plants (`lists.shrub`, the hazel/bramble variants ~1.6–2.8m tall). If it is a
   narrow cone/cylinder silhouette, it reads as a green post at height. Rebuild the tall
   (hazel) variant as 3 crossed ellipsoid-ish lobes (squashed icosahedra or 3 tilted
   cones) with colour jitter so it silhouettes as a bush; keep the low bramble variant
   squat and wide. DESCRIBE in the report what the geometry was before/after.
6. "A pile of leaves / bush with totally square edges": the leaf-litter cards
   (`lists.litter`). Their canvas texture likely fills to the quad edge — add a radial
   alpha feather (alpha → 0 by r = 0.5) and/or use an 8-gon disc geometry instead of a
   quad so no straight texture edge survives. DESCRIBE the before/after.

## Verification (node only — no Chrome, no build.mjs)
1. `node --check` on all three files.
2. `node data/riverprobe.mjs` 0 fail; `node data/faunatest.mjs` ALL PASS.
3. Throwaway probe `/tmp/codex-settle-probe.mjs`:
   - settlement.js is node-safe (no THREE/DOM in it — keep it that way): assert
     `bgItemsFor(4)` returns the same count/positions as the pre-refactor logic (copy the
     OLD generation into the probe for a one-off diff — every item identical: x, z, w, d,
     rot, kind);
   - `buildingAt` hits: centre of first 50 era-4 items → true; 30m north of each → false
     (unless another building); the church rect: `buildingAt(3, LOC.CHURCH.x,
     LOC.CHURCH.z, 0)` → true.
   - flora placement replica: counts within caps; every cattail's ground below its water
     level + 0.35; every sedge/iris above water − 0.05; zero flora inside `buildingAt`.
Report → `/tmp/claude-1002/-home-anna-projects-village/671efde6-07a1-41ec-96c2-3335fd16cd54/scratchpad/codex-settle.md`.
