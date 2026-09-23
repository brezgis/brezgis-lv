# Object and environment audit — September 2026

This is a procedural reconstruction, not a survey-grade digital twin. All six
eras remain available. The changes preserve the embedded/offline delivery.

## Audit coverage

`data/itemshowcase.mjs` renders all 45 animal presets and the exported building and
prop factories (plus the camp shelter and fish rack) as labelled contact sheets.
Terrain-dependent barrows are reviewed in the era tour. Instanced background
buildings, vegetation, roads and water are checked in the assembled world.

| System | Corrections |
| --- | --- |
| Large mammals | Connected tapered necks and jointed legs, continuous torso, species-specific proportions, curved horns, branched antlers, hooves/paws, eyes and ears; anatomy-dependent grazing and knee motion. |
| Birds and small animals | Restored the missing swan body, joined duck/swan necks, rounded bills, eyes and toes, folded stork wings, curved squirrel tail, frog limbs, flattened beaver tail, distinct elongated pike; shaped insect wings and flight feathers replace rectangular panels. |
| Forests | Finished-geometry atlas bounds prevent cropped crowns; padded higher-resolution captures; single upright view-facing silhouettes replace crossed panels/lids; full-size dither transitions replace growing/shrinking trees; larger nearby-tree promotion radius. |
| Coverage | Interpolate the coarse modern satellite woodland mask and reduce arbitrary clearing radii. This is a land-cover estimate, not an inventory of trees or measured historical canopy percentages. |
| Grass and flowers | Narrower tapered blades; correct bend scaling for short turf; rounded petals and flower centres, slimmer stems, leaves and deterministic flower-rich patches; wet-ground placement and building/platform exclusions. |
| Rivers and streams | Shared coverage-grid triangulation prevents offset-strip folds at tight bends. The bed shares the surface topology; bank collars drape on actual terrain. Receiver/lake clipping reduces stacked water surfaces. World-scaled ripples follow the channel direction; submerged shallow cobbles add local detail. |
| Lakes and millpond | Subdivided outlines carry depth sampled from the rendered basin. Shallow absorption exposes the substrate; deeper basins darken. The active millpond masks the river beneath it. These depths are inferred, not bathymetric measurements. |
| Roads | Retain more OSM curve points, service roads, source IDs and surface tags. Remove pointed end tapers, correct junction winding, distinguish dirt/gravel/asphalt and add P30 edge markings. |
| Modern buildings | Correct footprint centres; retain large mapped dimensions and available levels/material metadata. Add foundations, regular facade openings, metre-scaled plaster/brick/timber finishes, roof seams and protruding chimneys. Most elevations remain inferred. |
| Roadside | Six attributed OSM bus stops, with benches/shelters only where tagged. Shelter designs are generic reconstructions; their exact appearance is not verified. |
| Individual props | Rebuilt supported camp shelter, loose bedding, hung fish, hollow boats/wells, woven wattle, spoked cart wheels, broad-based hay, bark-grained poles, embedded axe, attached pyre poles, exposed memorial plaque and rougher ice. The AD 50 hearth no longer assumes a hanging metal cooking vessel. |
| Structure exclusions | Convert Three.js rotations to the footprint registry's GIS angle. Align the camp's offset roof and two manor-outbuilding exclusions with their actual positions. A numerical regression covers the rotation convention. |
| Tower | Rebuilt stepped flights, bracing and upper pavilion using the documented 11 m tower and project photograph; exact member sizes remain approximate. |

## Reproducible checks

Run browser suites sequentially on the shared GPU:

```sh
npm test                  # calendar/evidence, hydro geometry, six-era tour and controls
npm run test:items        # labelled individual-model sheets
npm run test:environment  # water topology, materials, LOD wiring and close views
npm run test:world        # traffic chronology, ground contact and exposure
npm run test:walk         # walking/flight
npm run test:roads        # road contact and vegetation clearance
```

Browser runners print temporary screenshot/report directories. Checks exercise
representative views, not every possible camera/device combination. Initial
coverage-grid checks eliminated 121 inverted Gauja faces and 16 inverted Pīsla
faces found in the preceding strip mesh; a subsequent pass removes Float32
zero-area boundary slivers too.

The six-era/control tour passed 39/39 checks with no browser/shader errors.
The separate world/exposure and walking suites passed. Road checks found zero
buried carriageway vertices and zero tested trunks on road surfaces in eras
1860, 1935 and modern. Coverage-grid checks pass for all five channel sections
and their banks. The LOD transition test observed coverage increasing from
0.126 to 0.417 while the same tree's scale remained 0.82056, unchanged.
These are correctness checks, not an FPS benchmark or a claim of universal
visual accuracy.

## Evidence and remaining limits

The **2025 label uses mixed-date inputs**: 2020 EOX/Sentinel-2 imagery, July 2026
OSM road/building data and July 2026 bus-stop queries. The UI now states this.
Historic roads, settlement extents, props and ecology are regional interpretations.
See [the historical audit](../research/accuracy-review.md).

Water uses sky-only cubemap reflections, not reflected shoreline geometry or a
full hydrodynamic model. Mammals and vegetation are still procedural rather than
scanned assets; antlers, coats, plumage and distant silhouettes are approximations.
Buildings retain oriented-rectangle footprint fits rather than every irregular
OSM outline. A genuinely site-exact twin requires dated local photographs,
building surveys, vegetation observations and bathymetry that are not in this repo.

Primary references used for this pass:

- [Latvian State Roads: P30 resurfacing](https://lvceli.lv/aktualitates/vecpiebalgas-autocelam-atjauno-segumu-darbi-notiek-63-valsts-celu-posmos/) — road identity/surface context; 2026 works are not added to 2025.
- [Brežģa tower project and photographs](https://www.partneriba.lv/projekti/brezga-kalna-skatu-tornis/) — visible construction and pavilion form.
- [Taurene bus stop, OSM node 305523888](https://www.openstreetmap.org/node/305523888) — one of six IDs retained in `src/roadside.js`; OSM contributors, ODbL.
- [Cornell Lab: Mallard identification](https://www.allaboutbirds.org/guide/Mallard/id) — drake head, collar, breast and bill features.
- [RSPB: upland birds](https://web-cdn.rspb.org.uk/birds-and-wildlife/sounds-of-spring/sounds-of-uplands) — black-grouse red eyebrow, not a rooster's comb.
