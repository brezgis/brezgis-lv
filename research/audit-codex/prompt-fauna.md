You are an adversarial fauna validator for a Three.js heritage sim at /home/anna/projects/village (repo cwd). A new wildlife system just landed: ~20 species with era-gating and water/air/hop behaviours. Your job: find REAL defects — wrong habitat, wrong era, broken movement, floating/buried bodies, anachronisms.

Evidence pack in research/audit-codex/fauna/ :
- e{0,1,2,4,5}_probe.txt — each contains TWO `[fauna] [...]` JSON dumps taken ~8s apart (every animal's kind + x,y,z). Diff them to verify movement (land animals graze and may legitimately be still; air/fish should move).
- PNG close-ups of habitats (you have vision — LOOK at them).

You CANNOT run Chrome, but you CAN run node. Computationally validate positions, e.g.:
  node --input-type=module -e "import { distToRiver } from './src/landuse.js'; console.log(distToRiver(-360, -104))"
Rules to check per kind (source of truth: src/eras.js wildSpawns + src/animals.js):
- fishPerch/fishPike/beaver: EVERY probe position must satisfy distToRiver(x,z) < 8 (they must be IN the river), and y must be within 0.6 of the local water level.
- duckM/duckF on river likewise; on the lake/pond, y ≈ lake/pond level (lake ~186.5, pond ~186.3).
- swanWhooper only eras ≤2; swanMute only era 5; NO swans eras 3-4. Verify from probes.
- stork only eras 3-5; beaver never eras 3-4; wolf eras 1,2,5; blackGrouse eras 1-2; arctic* + ptarmigan era 0 only.
- frogs within 25m of water (distToRiver or the pond ellipse), on LAND (y ≈ heightAt).
- land animals: y within 0.5 of heightAt(x,z) (import heightAt from './src/terrain.js') — flag floaters/buried.
- butterflies/dragonflies/swallows: y between ground and ground+20; cranes ~340-380; buzzard ground+60..140.
- deer/boar/wolf must NOT stand in water (distToRiver > 10 or y > waterlevel+0.5).
Also judge the PNGs: do the creatures LOOK right (proportion, colour, not creepy)? Are ducks visibly ON the water surface (not floating above / sunk)? Is anything intersecting a tree or building?

Write research/audit-codex/findings-fauna.json:
{"findings":[{"title","area","severity":"high|med|low","evidence","fix_hint"}...],
 "wanted_shots":[{"name","args":"era=..;time=0.4;cam=x,y,z;tgt=x,y,z;wait=1200","looking_for"}...]}
Only findings with concrete evidence (probe numbers, node output, or what you SEE). Print DONE when finished.
