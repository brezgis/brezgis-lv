# Village quality pass — September 2026

The existing six-era reconstruction and local edits were preserved. The standalone
deliverable remains `artifact/brezgi-taurene.html`, regenerated with `npm run build`.

## Visual corrections

- Window frames now surround recessed panes. The original solid trim box covered
  the glass, leaving blank white rectangles on every affected facade.
- Roofs have outward-facing triangles, closed undersides, timber gable ends and
  slope-aligned UV coordinates. Materials are no longer changed globally to
  double-sided when a roof is created.
- Wood grain is drawn within each log course or plank, with seeded variation.
  Shingles and timber use restrained weathered colours; brick mortar is opaque.
- Meadow and grass palettes are coordinated, grass receives nearby shadows, and
  distant tufts are shorter to reduce the field of conspicuous triangular spikes.
- Foliage keeps its crown-oriented normals on both sides. Tree shadow geometry
  follows the same wind as visible branches and leaves; culling bounds include wind.
- Water normals tile continuously. Sky reflections use floating-point storage and
  a dedicated sky layer, avoiding reflection feedback from the water itself.
- Modern satellite imagery is converted to a usable albedo before lighting, so
  baked image shadows do not become black ground under a second lighting pass.

## Rendering and controls

Empty tree promotion pools previously submitted 56 full trees of each of nine
species: **2,648,800 triangles per pass**, even with the instances shrunk underground.
Only the occupied prefix is now drawn. This is a submission count, not an FPS claim.
Water reflection refreshes also no longer render the entire landscape six times.

Multisampling uses the renderer's actual sample limit. The performance governor
measures unclamped frame time, never increases resolution above the display's
native pixel ratio on a lower quality setting, and can recover quality after load
falls. Repeated era visits were checked for bounded GPU resources.

Touch devices have directional/elevation controls and drag-to-look. Movement pauses
while reading the map or chronicle; Escape closes the chronicle. Optional storage
and pointer-lock failures do not prevent using the landscape.

## Evidence and validation

Calendar years and historical interpretation are covered in
[the historical review](../research/accuracy-review.md), with source links. Evidence
notes are visible in every era panel. These changes do not make the prehistoric
landscape or staged central farm a site-specific archaeological survey.

Run `npm test` for the six-era browser tour, roof/geometry checks, resource stability
and desktop/touch input. `npm run test:world` checks traffic chronology, terrain
contact and day/night exposure; `npm run test:walk` checks flight and walking.
The browser tour saves screenshots and JSON results to a new temporary directory.

This pass completed all 39 browser-tour checks, the separate world/exposure suite,
and the flight/walking regression with no browser or shader errors. After the last
water-texture adjustment, the rebuilt river and lake views were checked separately.

Visual inspection covers representative farm, river, manor, lake, aerial and mobile
views. It cannot certify every possible camera position or every device/GPU.

The subsequent [individual-item/environment audit](item-audit.md) extends this
pass with animal anatomy, water coverage topology, terrain-draped banks, mapped
building/road finishes, bus stops, grass proportions and full-size tree LOD fades.
