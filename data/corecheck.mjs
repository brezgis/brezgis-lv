import assert from 'node:assert/strict';
import { ERAS } from '../src/content.js';
import { stageFootprint,registerFootprints,buildingAt } from '../src/footprints.js';

// Prevent BP offsets from being used as calendar years in the transition UI.
assert.deepEqual(ERAS.map((e) => e.year), [-10800, 50, 950, 1860, 1935, 2025]);
assert(ERAS.every((e) => e.evidence && e.body));
assert(!ERAS[0].body.includes('No human has stood here yet'));
assert(!ERAS[5].body.includes('down from'));
console.log('PASS calendar years and historical evidence labels');
registerFootprints(99,[stageFootprint(0,0,10,2,Math.PI/4)]);
assert(buildingAt(99,4*Math.cos(Math.PI/4),-4*Math.sin(Math.PI/4)),'rotated building interior must exclude plants');
assert(!buildingAt(99,4*Math.cos(Math.PI/4),4*Math.sin(Math.PI/4)),'opposite diagonal must remain outside');
console.log('PASS staged footprint rotation matches Three.js rather than GIS angle');
