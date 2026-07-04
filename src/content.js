// Interpretive text shown in the era panel + the sources list.
// NOTE: provisional draft — finalised against research/*.md before release.
export const ERAS = [
  {
    year: -1900, label: '~AD 50', title: 'Kur tauri ganījās — where the aurochs grazed',
    body: `Two thousand years ago the Vidzeme Upland was near-wilderness. Early Iron Age
settlement in eastern Vidzeme was sparse — scattered single farms and hunting grounds
between great mixed forests of spruce, pine, birch and oak. On the floodplain meadows of
the young Gauja, aurochs — the wild ox the parish would one day be named after — still
grazed, alongside elk, bear and beaver. The camp on the terrace is a seasonal hunters' and
herders' shelter; the mound cemetery beyond it is beginning to grow.`,
    facts: ['Aurochs (Bos primigenius) native to Latvia', 'Sparse Early Iron Age settlement', 'The Gauja valley as a travel corridor'],
  },
  {
    year: 950, label: '~AD 950', title: 'A Latgalian farmstead',
    body: `By the Late Iron Age this was Latgalian country — the Baltic people whose name
Latvia carries. The buildings here follow the extraordinary evidence of Āraiši lake
fortress, 25 km west: small corner-notched log dwellings with stone hearths, a granary
raised on posts against mice and damp, wattle-fenced yards. Barley, rye and flax grow in
small fields; small cattle, dark primitive sheep, pigs and tarpan-like horses graze the
clearing. Smoke seeps through the gable — chimneys are centuries away. Under the old oak,
offerings are left; the dead sleep in the barrows by the field.`,
    facts: ['Modelled on Āraiši (9th–10th c.)', 'Latgalian material culture', 'Chimneyless smoke-dwellings'],
  },
  {
    year: 1860, label: '1860', title: 'Brezgi under Nēķens manor',
    body: `The parish now bears a German name — Nötkenshof, Nēķene — after the Baltic German
lords who have held the land since the 17th century. Serfdom ended in Vidzeme in 1819 and
families took surnames; a farm like Brezgi would rent, and later buy, its land from the
manor. This is the classic viensēta: dwelling-house with its first chimney, the great
thatched rija for threshing, the klēts granary, byre, the pirts smoking down by the river
for the Saturday sauna, the well-sweep creaking in the yard. Across the fields, the white
manor house watches from its linden park, and the mill dams the Gauja.`,
    facts: ['Serfdom abolished in Vidzeme 1819', 'The viensēta building set', 'Manor economy: corvée to money rent'],
  },
  {
    year: 1935, label: '1935', title: 'Taurene, Latvia',
    body: `Independent Latvia's 1920 agrarian reform broke up the manors; the German
aristocrats left, and in 1925 the parish shed its German name. A local schoolteacher-poet
proposed a new one — Taurene, for the aurochs (tauri) that once grazed here: the deep past
called up to name the future. The manor house is now the parish school, the Latvian flag
over its portico. The farm has glass windows, a shingle roof, an orchard; telephone poles
follow the gravel road; the stork keeps its wheel-top nest. The aurochs are four centuries
gone — but they are in the name now.`,
    facts: ['1920 agrarian reform', 'Parish renamed Taurene, 1925', 'The schoolteacher-poet\'s aurochs'],
  },
];

export const TITLE = 'BREZGI';
export const SUBTITLE = 'Taurenes pagasts · 57.159° N, 25.665° E · a time machine';

// Numbered sources; era bodies may cite [n]. Finalised from research/*.md.
export const SOURCES = [
  { n: 1, t: 'Taurene — Vikipēdija (coordinates, Gauja, Dabaru lake, renaming 1925)', u: 'https://lv.wikipedia.org/wiki/Taurene' },
  { n: 2, t: 'AWS Open Data Terrain Tiles (real elevation model used for this terrain)', u: 'https://registry.opendata.aws/terrain-tiles/' },
];

export const ABOUT_HTML = ''; // injected write-up (built from WRITEUP.md)
