// Interpretive text shown in the era panel + the sources list.
// Verified against research/*.md; bracketed numbers cite the Chronicle sources.
export const ERAS = [
  {
    year: -12750, label: '~10,800 BC', title: 'Ledus laikmets — before anyone',
    body: `The ice sheet has gone, but its dead remains lie buried in these hollows — great
stranded blocks slowly melting into the lakes this parish will one day be named around
[21]. This is Younger Dryas tundra: dwarf birch, juniper, sedge and till, and reindeer
bands drifting the valley of a milky, braided young Gauja. No human has stood here yet;
the first reindeer hunters will reach Latvia's river valleys within a few centuries
[22]. On clear nights the aurora stands over the moraines. Wait for dusk.`,
    facts: ['Dead ice melting into today\'s lakes', 'Reindeer tundra, no humans yet', 'First hunters ~10,500 BC at the Daugava'],
  },
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
they lived, as the Brezgis name echoes Brežģa kalns, the high hill up the road south [5]
[6][7]. This is the classic viensēta: dwelling with its chimney, the great thatched rija,
the shingled klēts, byre, pirts smoking by the river, the well-sweep creaking in the yard
[8]. The manor brewery on the riverbank cools 25,000 buckets of ale a year in cellars
vaulted into the Gauja's slope — and sells it at Brežģa krogs, the tavern under the family
hill, on the old road that climbs right over it [2]. Ride south and see.`,
    facts: ['Serfdom abolished 1819, surnames 1826', 'Brežģa krogs — the tavern under the hill', 'Ale cellars in the river bank'],
  },
  {
    year: 1935, label: '1935', title: 'Taurene, Latvia',
    body: `Independent Latvia's 1920 agrarian reform broke the manors — Nēķena's fields
alone became 72 new farms — and the German aristocrats left [9][3]. In 1925 the
schoolteacher Kārlis Bormanis, author of Latvia's first geography textbook, persuaded the
parish council to restore the ancient name: Taurene, for the aurochs (tauri) that once
grazed these forests. It took effect on New Year's Day 1926 [1][2][3]. The brick new
manor — neo-Renaissance, 1888 — now houses the parish's civic life, the Latvian flag over
its door [2][3]. The farm has glass windows, a shingle roof, an orchard; telephone poles
follow the gravel road; the stork keeps its wheel-top nest. And on Jāņi night the bonfire
burns on Brežģa kalns — the parish's festival hill, with open-air theatre under the summit
oak in the last summers before 1940 [7][2]. Wait for dusk, then look south.`,
    facts: ['Renamed by teacher K. Bormanis, effective 1926', 'New manor 1888, arch. R. G. Šmēlings', 'Jāņi fires on Brežģa kalns until 1940'],
  },
  {
    year: 2025, label: '2025', title: 'Šodiena — today',
    body: `The land you see now wears its real present-day colours — Sentinel-2 satellite
imagery draped over the same terrain — and the forest stands exactly where the satellite
sees it [23]. Taurene counts around 347 people, down from 1,303 in 1935; the parish is
quiet, the forest has been coming back [4][3]. The new manor still keeps the parish's
civic life, the stork still keeps the nest, and the storks' Latvia holds more of them
than anywhere. On Brežģa kalns stands the observation tower raised in 2017 — eleven
metres of timber above the family hill, looking out over Alauksts, the lake chain and
the whole country of this chronicle [7][24]. The Jāņi fire still burns beside it each
midsummer. The aurochs are four hundred years gone. The name holds.`,
    facts: ['Real Sentinel-2 land cover', 'Observation tower on Brežģa kalns, 2017', '347 people (2022) — the quiet century'],
  },
];

export const TITLE = 'BREZGI';
export const SUBTITLE = 'Taurenes pagasts · 57.159° N, 25.665° E · a time machine';

export const SOURCES = [
  { n: 1, t: 'Kārlis Bormanis — Vikipēdija (the teacher who renamed the parish, 1925/1926; "Zeme", Latvia\'s first geography textbook)', u: 'https://lv.wikipedia.org/wiki/K%C4%81rlis_Bormanis' },
  { n: 2, t: '"Laipni lūdzam Taurenes pagastā!" — Taurene library parish-history presentation (Nēķena manor, brewery, Brežģa kalns, Jāņi fires, White Lady)', u: 'https://www.slideshare.net/Taurbiblio/laipni-ludzam-taurenes-pagastamd' },
  { n: 3, t: 'Taurenes pagasts — pagasta vēsture (Vecpiebalgas apvienības pārvalde)', u: 'https://vecpiebalga.lv/lv/vecpiebalga/vecpiebalgas-apvieniba/pagastu-vesture/taurenes-pagasts/' },
  { n: 4, t: 'Taurene / Taurenes pagasts / Brezģis / Dabaru ezers / Taurenes ezers — Vikipēdija', u: 'https://lv.wikipedia.org/wiki/Taurenes_pagasts' },
  { n: 5, t: 'Consolidation of Surnames in Vidzeme — ICOS (1826 surname adoption; farm-name origins)', u: 'http://www.gencat.cat/llengua/BTPL/ICOS2011/164.pdf' },
  { n: 6, t: 'Abolition of serfdom in Livonia, 1819 — Wikipedia', u: 'https://en.wikipedia.org/wiki/Abolition_of_serfdom_in_Livonia' },
  { n: 7, t: 'Brežģa kalns (255.4 m, alias Karatavu kalns; Jāņi fires; theatre 1937–39; tower views) — Vikipēdija / Visit Cēsis', u: 'https://lv.wikipedia.org/wiki/Bre%C5%BE%C4%A3a_kalns' },
  { n: 8, t: 'The Latvian Farmstead (viensēta) — Latvijas Kultūras kanons; Latvian Ethnographic Open-Air Museum', u: 'https://kulturaskanons.lv/en/archive/latviesu-vienseta/' },
  { n: 9, t: 'Latvian Agrarian Reform Law of 1920 — Wikipedia', u: 'https://en.wikipedia.org/wiki/Latvian_Agrarian_Reform_Law_of_1920' },
  { n: 10, t: 'Archaeological monuments of Taurenes pagasts (13 sites incl. Lejstupu pilskalns #585)', u: 'http://vidzemes-arheologija.blogspot.com/p/vecpiebalgas-novads.html' },
  { n: 11, t: 'Āraiši lake fortress — single-year ¹⁴C dating to AD 835 (Meadows et al., Radiocarbon 2023)', u: 'https://en.wikipedia.org/wiki/%C4%80rai%C5%A1i_lake_fortress' },
  { n: 12, t: 'Āraiši building construction — Medieval Heritage EU', u: 'https://medievalheritage.eu/en/main-page/heritage/latvia/araisi-open-air-museum/' },
  { n: 13, t: 'Latgalians — Wikipedia (territory; burial customs)', u: 'https://en.wikipedia.org/wiki/Latgalians' },
  { n: 14, t: 'Iron Age livestock; earliest Baltic chickens (Rannamäe et al. 2021)', u: 'https://kirj.ee/wp-content/plugins/kirj/pub/arch-2-2021-160-181_20210930090939.pdf' },
  { n: 15, t: 'Landscape change in central Latvia since the Iron Age — Veget. Hist. Archaeobot.', u: 'https://www.academia.edu/16308755/' },
  { n: 16, t: '"taurs" (aurochs) — etymology; place-names as evidence — Wiktionary', u: 'https://en.wiktionary.org/wiki/taurs' },
  { n: 17, t: 'Aurochs — Wikipedia (Baltic range; extinct 1627)', u: 'https://en.wikipedia.org/wiki/Aurochs' },
  { n: 18, t: 'Real elevation model: AWS Open Data Terrain Tiles (Mapzen terrarium)', u: 'https://registry.opendata.aws/terrain-tiles/' },
  { n: 19, t: 'River & lake geometry: OpenStreetMap contributors', u: 'https://www.openstreetmap.org/' },
  { n: 20, t: 'Māra Zālīte\'s lines quoted in Latvijas Vēstnesis (1998)', u: 'https://www.vestnesis.lv/ta/id/50101' },
  { n: 21, t: 'Deglaciation history of Latvia (Zelčs et al.); dead-ice meltdown into the early Holocene (Stivriņš et al. 2017, The Holocene)', u: 'https://journals.sagepub.com/doi/10.1177/0959683616683255' },
  { n: 22, t: 'Salaspils Laukskola — earliest human settlement of Latvia, ~10,500 cal BC (Archaeologia Baltica 2019)', u: 'https://www.researchgate.net/publication/338825097_The_Northern_Fringe_of_the_Swiderian_Technological_Tradition_Salaspils_Laukskola_Revisited' },
  { n: 23, t: 'Sentinel-2 cloudless (2020) by EOX IT Services GmbH, CC-BY 4.0 — contains modified Copernicus Sentinel data', u: 'https://s2maps.eu' },
  { n: 24, t: 'Brežģa kalns observation tower (2017) — EnterGauja / Visit Cēsis', u: 'https://www.entergauja.com/lv/ko-darit/enter-daba/brezga-kalns' },
  { n: 25, t: 'Camera feel, wind model and realism standards adapted from LAAS (MIT) — a fully procedural WebGPU world', u: 'https://github.com/Braffolk/fable5-world-demo' },
];
