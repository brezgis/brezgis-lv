// Interpretive text shown in the era panel + the sources list.
// Verified against research/*.md; bracketed numbers cite the Chronicle sources.
export const ERAS = [
  {
    year: -10800, label: '~10,800 BC', title: 'After the ice',
    evidence: 'Environmental reconstruction. Ancient watercourses, ice blocks and animal locations are illustrative.',
    body: `The ice sheet has gone, but its dead remains lie buried in these hollows — great
stranded blocks slowly melting into the lakes this parish will one day be named around
[21].¶ This is Younger Dryas tundra: dwarf birch, juniper, sedge and till, and reindeer
bands drifting the valley. The modern terrain and river outline provide a geographic
reference; the actual Younger Dryas drainage cannot be reconstructed from them alone.
Late Palaeolithic hunters are known from Latvia, but no occupation of this exact terrace
is established here [22]. The unoccupied landscape is an interpretation.`,
    facts: ['Younger Dryas, ~12,750 years before 1950', 'Dwarf shrubs, sedges and reindeer', 'Ancient drainage is approximate'],
  },
  {
    year: 50, label: '~AD 50', title: 'Where the aurochs grazed',
    evidence: 'Regional analogy. The camp and aurochs herd are plausible scenes, not documented occupants of this site.',
    body: `Two thousand years ago the Vidzeme Upland was near-wilderness: heavy mixed forest
of spruce, pine, birch and oak, broken by lakes and the young Gauja threading its chain of
lake basins [4][15].¶ Settlement was sparse — scattered Baltic and Finnic groups, known
mostly from their graves [13]. Aurochs, the wild ox the parish is named for, were by then
rare in the Baltic but plausibly still grazed openings like this river terrace — the
place-name recalls the animal, but cannot date a herd at this site [16][17]. The camp is a
seasonal hunters' shelter; elk watch from the forest edge.`,
    facts: ['Aurochs: rare but defensible at AD 50', 'Sparse Early Iron Age settlement', 'The Gauja lake-chain corridor'],
  },
  {
    year: 950, label: '~AD 950', title: 'A Latgalian farmstead',
    evidence: 'Archaeological analogy: Āraiši. The farm layout, refuge palisade, cemetery and neighbouring households are interpretive.',
    body: `By the Late Iron Age this was Latgalian country — the Baltic people whose name
Latvia carries [13].¶ The buildings follow the extraordinary evidence of Āraiši lake
fortress, about 25 km west, with its ninth- and tenth-century occupation: small corner-joined log dwellings with
a clay stove at the centre, bark-sheet roofs weighted with poles, a granary raised on
posts [11][12]. Barley, rye and flax grow in small burn-cleared fields (līdumi); small cattle, dark sheep, pigs
and pony-sized horses graze the clearing; a few chickens scratch in the yard [14]. Across
the river on its hill stands the palisaded refuge fort — Lejstupu pilskalns, still marked
on the monument register today [10]. Seven more homesteads smoke within an hour's walk —
Latgalian settlement was dispersed single farmsteads loosely gathered on a hillfort
district [13][27]. Their number and positions here are illustrative. Smoke seeps through
the gable; offerings and burial mounds evoke regional traditions, whose use at this
particular farm has not been established.`,
    facts: ['Inspired by ninth–tenth-century Āraiši', 'Lejstupu: documented hillfort, interpreted defences', 'Chimneyless smoke-dwellings'],
  },
  {
    year: 1860, label: '1860', title: 'Brezgi under Nēķene manor',
    evidence: 'Documented manor history; representative farm buildings. The central Brezgi farm and family-name connection are conjectural.',
    body: `The parish now bears a German name — Nötkenshof, Nēķene, after the Notken family
who held it from 1601; since 1856 the lords are the von Panders [2][3].¶ Serfdom ended in
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
    evidence: 'Historical maps guide settlement and woodland. Building forms and field boundaries remain approximate.',
    body: `Independent Latvia's 1920 agrarian reform broke the manors — Nēķena's fields
alone became 72 new farms — and the German aristocrats left [9][3].¶ In 1925 the
schoolteacher Kārlis Bormanis, author of Latvia's first geography textbook, persuaded the
parish council to adopt the name Taurene, recalling the aurochs (tauri) that once
grazed these forests. It took effect on New Year's Day 1926 [1][2][3]. The brick new
manor — neo-Renaissance, its roof-raising celebrated in 1888 — stands beside the
older palace, which the parish acquired for use as a clinic [3]. Below the manor the
Gauja widens into the mill pond the 1930s Army map shows. The farm has glass windows, a shingle roof, an orchard; telephone poles
follow the gravel road; the stork keeps its wheel-top nest. And on Jāņi night the bonfire
burns on Brežģa kalns — the parish's festival hill, with open-air theatre under the summit
oak in the last summers before 1940 [7][2]. Wait for dusk, then look south.`,
    facts: ['Taurene name effective 1 January 1926', 'Manor roof-raising 1888; architect R. G. Šmēlings', 'Jāņi fires and open-air theatre'],
  },
  {
    year: 2025, label: '2025', title: 'Taurene today',
    evidence: 'A 2025 interpretation using 2020 satellite imagery and 2026 OSM extracts. Building elevations, tree cover, water depths and shelter designs are inferred, not surveyed.',
    body: `The modern view combines dated sources — a 2020 Sentinel-2 cloudless mosaic
and 2026 OpenStreetMap extracts, not a survey taken in 2025.¶ Woodland is estimated from land-cover
colours [23]. Individual trees and houses are procedural approximations. Taurene village
and the wider parish are different geographic units, so their population totals cannot
be used interchangeably to measure decline [4][3]. The new manor keeps the parish's
civic life, and the stork still keeps its nest. On Brežģa kalns stands the observation tower raised in 2017 — eleven
metres of timber above the family hill, looking out over Alauksts, the lake chain and
the whole country of this chronicle [7][24]. The Jāņi fire still burns beside it each
midsummer. The aurochs are four hundred years gone — but wild grazing returned: in 2008
the Dutch rewilding foundation ARK released a herd of Konik horses, a hardy Polish
landrace, onto privately owned Taurene meadowland [28]. The name holds.`,
    facts: ['2020 imagery; 2026 OSM geometry', 'Brežģa observation tower: 2017, 11 m', 'Konik grazing introduced in 2008'],
  },
];

// Latvian texts, era names and the one-line caption under the timeline.
// (Latvian by Claude; worth a native speaker's read.)
const ERA_I18N = [
  {
    yearLv: "≈10 800 p. m. ē.",
    en: { name: "Tundra", caption: "~10,800 BC · the young Gauja valley · the short tundra summer" },
    lv: {
      title: "Pēc ledus", name: "Tundra",
      caption: "≈10 800 p. m. ē. · jaunā Gaujas ieleja · īsā tundras vasara",
      evidence: "Vides rekonstrukcija. Senās ūdensteces, ledus bluķi un dzīvnieku vietas ir ilustratīvas.",
      facts: ["Vēlais driass, ~12 750 gadu pirms 1950. g.", "Pundurkrūmi, grīšļi un ziemeļbrieži", "Senā notece ir aptuvena"],
      body: `Ledājs ir atkāpies, bet tā mirušās atliekas vēl guļ šajās ieplakās — milzīgi atrauti
ledus bluķi, kas lēni kūst ezeros, kuru krastos reiz izveidosies šis pagasts [21].¶ Šī ir
vēlā driasa tundra: pundurbērzs, kadiķis, grīšļi un morēna, un pa ieleju klīst
ziemeļbriežu bari. Mūsdienu reljefs un upes līnija dod ģeogrāfisku atskaites punktu;
toreizējo noteci no tiem vien atjaunot nevar. Vēlā paleolīta mednieki Latvijā ir zināmi,
taču apmetne tieši uz šīs terases nav pierādīta [22]. Neapdzīvotā ainava ir interpretācija.`,
    },
  },
  {
    yearLv: "≈50. g.",
    en: { name: "Aurochs", caption: "~AD 50 · the river terrace · midsummer" },
    lv: {
      title: "Kur tauri ganījās", name: "Tauri",
      caption: "≈50. g. · upes terase · vasaras vidus",
      evidence: "Reģionāla analoģija. Nometne un tauru bars ir ticamas ainas, nevis šīs vietas dokumentēti iemītnieki.",
      facts: ["Tauri: reti, bet ticami ap 50. g.", "Reta agrā dzelzs laikmeta apdzīvotība", "Gaujas ezeru virknes koridors"],
      body: `Pirms diviem tūkstošiem gadu Vidzemes augstiene bija gandrīz neskarta: biezs jaukts egļu,
priežu, bērzu un ozolu mežs, ko pārtrauca ezeri un jaunā Gauja, kas vijas caur savu ezeru
virkni [4][15].¶ Apdzīvotība bija reta — izkaisītas baltu un somugru kopienas, pazīstamas
galvenokārt no kapulaukiem [13]. Tauri — savvaļas vērši, pēc kuriem nosaukts pagasts, —
Baltijā tolaik jau bija reti, taču ticami vēl ganījās tādos klajumos kā šī upes terase;
vietvārds atgādina dzīvnieku, bet nevar datēt baru tieši šeit [16][17]. Nometne ir mednieku
sezonas pajumte; no meža malas vēro aļņi.`,
    },
  },
  {
    yearLv: "≈950. g.",
    en: { name: "Latgalians", caption: "~AD 950 · a Latgalian farmstead · midsummer" },
    lv: {
      title: "Latgaļu sēta", name: "Latgaļi",
      caption: "≈950. g. · latgaļu sēta · vasaras vidus",
      evidence: "Arheoloģiska analoģija — Āraiši. Sētas izkārtojums, patvēruma palisāde, kapulauks un kaimiņu sētas ir interpretācija.",
      facts: ["Iedvesmots no 9.–10. gs. Āraišiem", "Lejstupi: dokumentēts pilskalns, nocietinājumi interpretēti", "Dūmistabas bez skursteņa"],
      body: `Vēlajā dzelzs laikmetā šī bija latgaļu zeme — baltu tauta, kuras vārdu nes Latvija [13].¶
Ēkas veidotas pēc Āraišu ezerpils izcilajām liecībām apmēram 25 km uz rietumiem, kur dzīvoja
9.–10. gadsimtā: nelielas guļbūves ar pakšu stūriem un māla krāsni vidū, tāšu jumti,
piespiesti ar kārtīm, un uz stabiem pacelta klēts [11][12]. Mazos līdumos aug mieži, rudzi un
lini; klajumā ganās sīki liellopi, tumšas aitas, cūkas un poniju auguma zirgi, sētā kasās
dažas vistas [14]. Aiz upes uz sava kalna stāv ar palisādi nocietinātā patvēruma pils —
Lejstupu pilskalns, vēl šodien valsts aizsargājamo pieminekļu sarakstā [10]. Stundas gājienā
kūp vēl septiņas sētas: latgaļi dzīvoja izkliedētās viensētās, kas pulcējās ap pilskalna
novadu [13][27]; to skaits un vietas šeit ir ilustratīvas. Dūmi sūcas caur jumta galu;
upuri un kapu uzkalniņi atsauc reģiona tradīcijas, kuru lietojums tieši šajā sētā nav
pierādīts.`,
    },
  },
  {
    yearLv: "1860",
    en: { name: "Manor", caption: "1860 · Nēķene manor · Jāņi" },
    lv: {
      title: "Brezgi Nēķena muižas laikos", name: "Muiža",
      caption: "1860 · Nēķena muiža · Jāņu laiks",
      evidence: "Dokumentēta muižas vēsture; tipiskas zemnieku ēkas. Centrālā Brezgu sēta un uzvārda saikne ir minējums.",
      facts: ["Dzimtbūšana atcelta 1819, uzvārdi 1826", "Brežģa krogs — krogs zem kalna", "Alus pagrabi upes krastā"],
      body: `Pagastam tagad ir vācu vārds — Nötkenshof, Nēķene, pēc Notkenu dzimtas, kas to turēja kopš
1601. gada; kopš 1856. gada kungi ir fon Panderi [2][3].¶ Dzimtbūšana Vidzemē atcelta 1819. gadā,
un 1826. gadā ģimenes saņēma uzvārdus — bieži pēc mājām vai kalna, kur tās dzīvoja, kā uzvārds
Brezgis atbalso Brežģa kalnu, augsto kalnu uz dienvidiem pa ceļu [5][6][7]. Šī ir klasiskā
viensēta: dzīvojamā māja ar skursteni, lielā salmu jumta rija, lubu jumta klēts, kūts, pirts,
kas kūp pie upes, un sētā čīkstoša akas svira [8]. Muižas brūzis upes krastā gadā atdzesē
25 000 spaiņu alus pagrabos, kas izbūvēti Gaujas nogāzē, — un pārdod to Brežģa krogā, krogā
zem dzimtas kalna, pie vecā ceļa, kas kāpj tieši tam pāri [2]. Jāj uz dienvidiem un apskaties.`,
    },
  },
  {
    yearLv: "1935",
    en: { name: "Taurene", caption: "1935 · Taurene · Jāņi" },
    lv: {
      title: "Taurene, Latvija", name: "Taurene",
      caption: "1935 · Taurene · Jāņi",
      evidence: "Apdzīvotību un mežus vada vēsturiskās kartes. Ēku formas un lauku robežas ir aptuvenas.",
      facts: ["Nosaukums Taurene no 1926. g. 1. janvāra", "Pils spāru svētki 1888; arhitekts R. G. Šmēlings", "Jāņu ugunis un brīvdabas teātris"],
      body: `Neatkarīgās Latvijas 1920. gada agrārā reforma sadalīja muižas — Nēķena zemēs vien
izveidoja 72 jaunsaimniecības — un vācu muižnieki aizbrauca [9][3].¶ 1925. gadā skolotājs
Kārlis Bormanis, pirmās latviešu ģeogrāfijas mācību grāmatas autors, pārliecināja pagasta
padomi pieņemt nosaukumu Taurene, atceroties taurus, kas reiz ganījās šajos mežos. Tas stājās
spēkā 1926. gada Jaungada dienā [1][2][3]. Ķieģeļu jaunā pils — neorenesanse, spāru svētki
svinēti 1888. gadā — stāv blakus vecajai pilij, ko pagasts ieguva ambulances vajadzībām [3].
Zem muižas Gauja paplašinās dzirnavu dīķī, kā to rāda 1930. gadu armijas karte. Sētai ir stikla
logi, lubu jumts, augļu dārzs; gar grants ceļu stiepjas telefona stabi; stārķis tur savu
ligzdu uz rata. Un Jāņu naktī uz Brežģa kalna deg ugunskurs — pagasta svētku kalns, kur
pēdējās vasarās pirms 1940. gada zem virsotnes ozola spēlēja brīvdabas teātri [7][2].
Sagaidi krēslu un paskaties uz dienvidiem.`,
    },
  },
  {
    yearLv: "2025",
    en: { name: "Today", caption: "2025 · Taurene · Jāņi" },
    lv: {
      title: "Taurene šodien", name: "Mūsdienas",
      caption: "2025 · Taurene · Jāņi",
      evidence: "Interpretācija, balstīta uz 2020. gada satelītattēliem un 2026. gada OSM datiem. Ēku augstumi, koku segums, ūdens dziļumi un nojumju izskats ir secināti, nevis uzmērīti.",
      facts: ["2020. g. attēli; 2026. g. OSM ģeometrija", "Brežģa skatu tornis: 2017, 11 m", "Konik zirgu ganīšana kopš 2008"],
      body: `Mūsdienu skats apvieno datētus avotus — 2020. gada Sentinel-2 bezmākoņu mozaīku un
2026. gada OpenStreetMap datus, nevis 2025. gadā veiktu uzmērījumu.¶ Mežs novērtēts pēc zemes
seguma krāsām [23]; atsevišķi koki un mājas ir procedurāli tuvinājumi. Taurenes ciems un
plašākais pagasts ir dažādas teritorijas, tāpēc to iedzīvotāju skaitus nevar savstarpēji
salīdzināt, lai mērītu sarukumu [4][3]. Jaunajā pilī joprojām rit pagasta sabiedriskā dzīve,
un stārķis vēl tur savu ligzdu. Uz Brežģa kalna stāv 2017. gadā celtais skatu tornis —
vienpadsmit metri koka virs dzimtas kalna ar skatu uz Alauksta ezeru, ezeru virkni un visu
šīs hronikas zemi [7][24]. Jāņu uguns tam blakus deg katros vasaras saulgriežos. Tauri ir
zuduši pirms četrsimt gadiem — bet savvaļas ganīšanās atgriezās: 2008. gadā nīderlandiešu dabas
atjaunošanas fonds ARK izlaida privātās Taurenes pļavās Konik zirgu baru — izturīgu poļu
šķirni [28]. Vārds turas.`,
    },
  },
];
// era text in the requested language: { title, body, lead, more, facts, evidence, name, caption, year }
export function eraText(era, lang) {
  const E = ERAS[era], X = ERA_I18N[era];
  const t = lang === 'lv'
    ? { ...X.lv, year: X.yearLv }
    : { title: E.title, body: E.body, facts: E.facts, evidence: E.evidence, ...X.en, year: E.label };
  const flat = t.body.replace(/\s+/g, ' ').trim();
  const [lead, ...rest] = flat.split('¶');
  return { ...t, body: flat.replace('¶', ''), lead: lead.trim(), more: rest.join(' ').trim() };
}

// The welcome card: context to read while the landscape builds.
export const INTRO = {
  lv: {
    kicker: 'Taurenes pagasts · Vidzeme · Latvija',
    paras: [
      'Šis ir viens Latvijas lauku kvadrāts — 8,8 kilometrus plats, ap Taurenes ciemu Vidzemē —, redzēts sešos brīžos divpadsmit tūkstošu gadu garumā. Zeme zem kājām ir īstais reljefa modelis; Gauja ar saviem strautiem un ezeriem, kā arī šodienas ceļi un mājas nāk no kartēm.',
      'Sēta centrā nes Brezgu stāstu cauri laikmetiem. Tā novietota pie Taurenes; īstās Brezgu mājas un Brežģa kalns, kura vārdu uzvārds atbalso, atrodas pa ceļu uz dienvidiem — to var sasniegt lidojot.',
      'Katrs laikmets ir rekonstrukcija. Daļa ir dokumentēta — muiža, Taurenes vārds, 1930. gadu dzirnavu dīķis, tornis uz kalna; daļa ir arheoloģiska analoģija; daļa ir iztēle. Katra laikmeta stāsts pasaka, kas ir kas, un Hronikā ir visi avoti.',
    ],
    how: 'Kustība: WASD vai bultiņas (telefonā — velc un pogas) · laikmeti: 1–6 vai laika josla · karte: M',
    enter: 'Ienākt ainavā',
    loading: 'Ainava top…',
  },
  en: {
    kicker: 'Taurene parish · Vidzeme · Latvia',
    paras: [
      'This is one square of Latvian countryside — 8.8 kilometres across, around the village of Taurene in Vidzeme — seen at six moments across twelve thousand years. The ground is the real elevation model; the Gauja with its brooks and lakes, and today’s roads and houses, come from maps.',
      'A farm at the centre carries the Brezgi story through the eras. It is staged near Taurene; the real Brezgi homestead, and Brežģa kalns — the hill the name echoes — lie up the road to the south, a short flight away.',
      'Each era is a reconstruction. Some of it is documented — the manor, the name Taurene, the 1930s mill pond, the tower on the hill; some is archaeological analogy; some is imagined. Each era’s story says which is which, and the Chronicle lists every source.',
    ],
    how: 'Move: WASD or arrow keys (on a phone, drag and use the buttons) · eras: 1–6 or the timeline · map: M',
    enter: 'Step in',
    loading: 'Building the landscape…',
  },
};

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
  { n: 11, t: 'Meadows et al., Single-Year ¹⁴C Dating of the Lake-Fortress at Āraiši, Latvia (online 2023; Radiocarbon 66, 2024)', u: 'https://doi.org/10.1017/RDC.2023.24' },
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
  { n: 26, t: 'Latvian Army 1:75,000 topographic map, 1920–1940 (Nēķina mž. sheet — 1935 farms, roads and forests verified against it), via vesture.dodies.lv', u: 'https://vesture.dodies.lv/' },
  { n: 27, t: 'Iron Age settlement density of NE Vidzeme — research/iron-age-settlement.md (Stivriņš et al. 2015 pollen record; Radiņš; Vasks; Āraiši hinterland estimates)', u: 'https://en.wikipedia.org/wiki/%C4%80rai%C5%A1i_lake_fortress' },
  { n: 28, t: 'ARK Rewilding Latvia project — Konik horses and bovines introduced to Latvian grazing areas from 2005 onward', u: 'https://arkrewilding.nl/en/projects/latvia' },
];
