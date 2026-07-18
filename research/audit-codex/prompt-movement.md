You are an adversarial code reviewer for a Three.js heritage simulation at ~/projects/village (already built to artifact/brezgi-taurene.html — do NOT run build.mjs, do NOT git commit; read-only except for writing your outputs).

Adversarially review src/rig.js and the movement/collision/shadow parts of src/main.js for CORRECTNESS bugs:
- double-Space fly/walk toggle edge cases (is the first tap after the cinema intro counted? stale timers?)
- landing while inside a collider; jump-through-roof; head clearance (collision uses feet-Y gating — can you put your head through geometry?)
- collision AABB build timing: is updateMatrixWorld called before Box3.setFromObject? do instanced meshes in era groups get colliders where it matters?
- player shadow proxy timing vs the shadow-refresh cadence
- camTween vs pointer-locked look fighting
- wading (WADE_DEPTH) vs collision interactions
- KEY_ALIAS arrow handling, LOOK_SMOOTH filtering, adoptCamera edge cases

If you want to check something at runtime, there is a screenshot/probe harness:
  cd ~/projects/village && node data/dbg.mjs research/audit-codex/shots/<name>.png "era=N;time=0.4;cam=x,y,z;tgt=x,y,z;wait=900"
and data/walktest.mjs runs an automated Minecraft-movement flow check (node data/walktest.mjs).

Report ONLY defects you have concrete evidence for (file:line). Write findings to research/audit-codex/findings-movement.json:
{"findings":[{"title":"...","area":"file:line","severity":"high|med|low","evidence":"...","fix_hint":"..."}]}
Empty array if nothing holds up. Finish by printing DONE.

NOTE: you run sandboxed. If node data/walktest.mjs or dbg.mjs fail due to sandboxing (headless Chrome), fall back to pure code review and add a "wanted_checks" note in your JSON instead of stalling.
