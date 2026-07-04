// Interpretive text shown in the era panel + the sources list.
// Verified against research/*.md (three research reports, 2026-07-04);
// bracketed numbers cite the source list in the Chronicle overlay.
export const ERAS = [
  {
    year: -1900, label: '~AD 50', title: 'Kur tauri ganījās — where the aurochs grazed',
    body: `Two thousand years ago the Vidzeme Upland was near-wilderness: heavy mixed forest
of spruce, pine, birch and oak, broken by lakes and the young Gauja threading its chain of
lake basins [4][15]. Settlement was sparse — scattered Baltic and Finnic groups, known
mostly from their graves [13]. Aurochs, the wild ox the parish is named for, were by then
rare in the Baltic but plausibly still grazed openings like this river terrace — the
place-name itself is counted as evidence they lived in these woods [16][17]. The camp is a
seasonal hunters' shelter; elk watch from the forest edge.`,
    facts: ['Aurochs: rare but defensible at AD 50', 'Sparse Early Iron Age settlement', 'The Gauja lake-chain corridor'],
  },
  {
    year: 950, label: '~AD 950', title: 'A Latgalian farmstead',
    body: `By the Late Iron Age this was Latgalian country — the Baltic people whose name
Latvia carries [13]. The buildings follow the extraordinary evidence of Āraiši lake
fortress, 25 km west, its timbers felled in AD 835: small corner-joined log dwellings with
a clay stove at the centre, bark-sheet roofs weighted with poles, a granary raised on
posts [11][12]. Barley, rye and flax grow in small fields; small cattle, dark sheep, pigs
and pony-sized horses graze the clearing; a few chickens scratch in the yard [14]. Across
the river on its hill stands the palisaded refuge fort — Lejstupu pilskalns, still marked
on the monument register today [10]. Smoke seeps through the gable; under the old oak,
offerings; low fresh barrows by the field, men buried facing east, women west [13].`,
    facts: ['Modelled on Āraiši (dendro-dated AD 835)', 'Lejstupu pilskalns — real hillfort on this spot', 'Chimneyless smoke-dwellings'],
  },
  {
    year: 1860, label: '1860', title: 'Brezgi under Nēķens manor',
    body: `The parish now bears a German name — Nötkenshof, Nēķene, after the Notken family
who held it from 1601; since 1856 the lords are the von Panders [2][3]. Serfdom ended in
Vidzeme in 1819 and families took surnames in 1826 — often from the farm or hill where
they lived, as the Brezgis name echoes Brežģa kalns south of here [5][6][7]. This is the
classic viensēta: dwelling with its chimney, the great thatched rija, the shingled klēts,
byre, pirts smoking by the river for the Saturday sauna, the well-sweep creaking in the
yard [8]. The white manor house watches from its linden park, and on the riverbank the
manor brewery cools 25,000 buckets of ale a year in cellars vaulted into the Gauja's
slope — some of it sold at the Brezgi tavern down the road [2].`,
    facts: ['Serfdom abolished 1819, surnames 1826', 'Pander family manor, spared in 1905', 'Ale cellars in the river bank'],
  },
  {
    year: 1935, label: '1935', title: 'Taurene, Latvia',
    body: `Independent Latvia's 1920 agrarian reform broke the manors — Nēķena's fields
alone became 72 new farms — and the German aristocrats left [9][3]. In 1925 the
schoolteacher Kārlis Bormanis, author of Latvia's first geography textbook, persuaded the
parish council to restore the ancient name: Taurene, for the aurochs that once grazed
these forests. It took effect on New Year's Day 1926 [1][2][3]. The brick new manor —
neo-Renaissance, 1888 — now houses the parish's civic life, the Latvian flag over its
door [2][3]. The farm has glass windows, a shingle roof, an orchard; telephone poles
follow the gravel road; the stork keeps its wheel-top nest; and on Jāņi night a bonfire
burns on the old fort hill, as it does on Brežģa kalns beyond the horizon [7]. The aurochs
are centuries gone — but they are in the name now.`,
    facts: ['Renamed by teacher K. Bormanis, effective 1926', 'New manor 1888, arch. R. G. Šmēlings', 'Jāņi fires on the hills'],
  },
];

export const TITLE = 'BREZGI';
export const SUBTITLE = 'Taurenes pagasts · 57.159° N, 25.665° E · a time machine';

export const SOURCES = [
  { n: 1, t: 'Kārlis Bormanis — Vikipēdija (the teacher who renamed the parish, 1925/1926; "Zeme", Latvia\'s first geography textbook)', u: 'https://lv.wikipedia.org/wiki/K%C4%81rlis_Bormanis' },
  { n: 2, t: '"Laipni lūdzam Taurenes pagastā!" — Taurene library parish-history presentation (Nēķena manor, brewery, Brežģa kalns, Jāņi fires, White Lady)', u: 'https://www.slideshare.net/Taurbiblio/laipni-ludzam-taurenes-pagastamd' },
  { n: 3, t: 'Taurenes pagasts — pagasta vēsture (Vecpiebalgas apvienības pārvalde): renaming effective 1 Jan 1926; manor ownership; 1920 reform parcels', u: 'https://vecpiebalga.lv/lv/vecpiebalga/vecpiebalgas-apvieniba/pagastu-vesture/taurenes-pagasts/' },
  { n: 4, t: 'Taurene & Taurenes pagasts — Vikipēdija (coordinates, the Gauja lake chain: Bānūžu–Ilzes–Rijas–Brenkūžu–Stupēnu–Dabaru–Taurenes)', u: 'https://lv.wikipedia.org/wiki/Taurenes_pagasts' },
  { n: 5, t: 'Consolidation of Surnames in Vidzeme — ICOS (1826 surname adoption; farm-name origins)', u: 'http://www.gencat.cat/llengua/BTPL/ICOS2011/164.pdf' },
  { n: 6, t: 'Abolition of serfdom in Livonia, 1819 — Wikipedia', u: 'https://en.wikipedia.org/wiki/Abolition_of_serfdom_in_Livonia' },
  { n: 7, t: 'Brežģa kalns (255.4 m, alias Karatavu kalns; Jāņi fires and open-air theatre 1937–39) — Vikipēdija / visit.cesis.lv', u: 'https://lv.wikipedia.org/wiki/Bre%C5%BE%C4%A3a_kalns' },
  { n: 8, t: 'The Latvian Farmstead (viensēta) — Latvijas Kultūras kanons; Latvian Ethnographic Open-Air Museum, Vidzeme homestead', u: 'https://kulturaskanons.lv/en/archive/latviesu-vienseta/' },
  { n: 9, t: 'Latvian Agrarian Reform Law of 1920 — Wikipedia (54,000+ new farms; Nēķena manor split into 72 units)', u: 'https://en.wikipedia.org/wiki/Latvian_Agrarian_Reform_Law_of_1920' },
  { n: 10, t: 'Archaeological monuments of Taurenes pagasts (13 registered sites incl. Lejstupu pilskalns #585, Nēķina senkapi #581)', u: 'http://vidzemes-arheologija.blogspot.com/p/vecpiebalgas-novads.html' },
  { n: 11, t: 'Āraiši lake fortress — single-year ¹⁴C dating to AD 835 (Meadows et al., Radiocarbon 2023); site & reconstruction', u: 'https://en.wikipedia.org/wiki/%C4%80rai%C5%A1i_lake_fortress' },
  { n: 12, t: 'Āraiši building construction (log & yoke techniques, bark roofs, clay stove, ~30 m² dwellings) — Medieval Heritage EU', u: 'https://medievalheritage.eu/en/main-page/heritage/latvia/araisi-open-air-museum/' },
  { n: 13, t: 'Latgalians — Wikipedia (territory, burial customs: barrow transition 9th–10th c., orientation by sex)', u: 'https://en.wikipedia.org/wiki/Latgalians' },
  { n: 14, t: 'Iron Age livestock: small cattle & pony-sized horses (zooarchaeology); earliest Baltic chickens (Rannamäe et al. 2021)', u: 'https://kirj.ee/wp-content/plugins/kirj/pub/arch-2-2021-160-181_20210930090939.pdf' },
  { n: 15, t: 'Landscape change in central Latvia since the Iron Age (pollen evidence of woodland persistence) — Veget. Hist. Archaeobot.', u: 'https://www.academia.edu/16308755/' },
  { n: 16, t: '"taurs" (aurochs) — etymology; place-names as evidence of aurochs in Latvian forests — Wiktionary', u: 'https://en.wiktionary.org/wiki/taurs' },
  { n: 17, t: 'Aurochs (Bos primigenius) — Baltic range and extinction timeline (survived in Lithuania/E. Prussia to 13th–16th c.)', u: 'https://en.wikipedia.org/wiki/Aurochs' },
  { n: 18, t: 'Real elevation model: AWS Open Data Terrain Tiles (Mapzen terrarium), 4.8×4.8 km around 57.15944 N 25.66472 E', u: 'https://registry.opendata.aws/terrain-tiles/' },
  { n: 19, t: 'River & lake geometry: OpenStreetMap contributors (the Gauja course, Taurenes ezers, Dzērbe)', u: 'https://www.openstreetmap.org/' },
  { n: 20, t: 'Māra Zālīte\'s later lines "Kur tu skriesi, tauriņ mans? — Uz Taureni!" quoted in Latvijas Vēstnesis (1998)', u: 'https://www.vestnesis.lv/ta/id/50101' },
];
