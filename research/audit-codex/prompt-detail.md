You are an adversarial reviewer of the new forest-floor "still life" layer in the Three.js sim at /home/anna/projects/village: ant mounds, molehills, chanterelle/boletus mushrooms, fallen cones, twigs, leaf litter (src/vegetation.js — search for "still life" and "molehill"). Placement rules live in placementsFor; instancing/fill near "microProps".

Evidence: research/audit-codex/fauna/floor_e5.png (forest floor at Brežģa kalns), moles_e4.png (meadow). You have vision — LOOK at them. You can also run node (NOT Chrome) to validate placement code computationally, e.g. sample the same grid logic and check: molehills never on fields (fieldAt) or in water; mushrooms/anthills only under forest (forestDensity > 0.4); litter only under broadleaf stands; all objects y-anchored to heightAt (no floaters).

Also review the code for: rng draw-order instability (draws consumed conditionally that shift later placements between eras — compare with how grass.js documents fixed draw order), instance cap overflows (lists larger than mesh capacity must stride-subsample — check the fill loop), scale/sink errors (objects half-buried or hovering), and anything that would z-fight.

Write research/audit-codex/findings-detail.json:
{"findings":[{"title","area","severity":"high|med|low","evidence","fix_hint"}...],
 "wanted_shots":[{"name","args":"era=..;time=0.4;cam=x,y,z;tgt=x,y,z;wait=1200","looking_for"}...]}
Only concrete, verified findings. Print DONE when finished.
