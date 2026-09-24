// Interpretive text shown in the era panel + the sources list.
// Verified against research/*.md; bracketed numbers cite the Chronicle sources.
export const ERAS = [
  {
    year: -10800, label: '~10,800 BC', title: "After the ice",
    evidence: "This is an environmental reconstruction. Ancient watercourses, ice blocks and animal locations are illustrative.",
    body: "The ice sheet has gone, but its dead remains still lie buried in these hollows. Great stranded blocks are slowly melting into the lakes this parish will one day grow up around [21].¶ This is Younger Dryas tundra, with dwarf birch, juniper, sedge and bare till, and bands of reindeer drifting along the valley. The modern terrain and river outline serve as a geographic guide, although the real drainage of that time cannot be rebuilt from them alone. Late Palaeolithic hunters are known from Latvia, yet no camp on this exact terrace has been found [22]. So the empty landscape is an interpretation.",
    facts: [],
  },
  {
    year: 50, label: '~AD 50', title: "Where the aurochs grazed",
    evidence: "This is a regional analogy. The camp and the aurochs herd are plausible scenes, and nothing ties them to this exact site.",
    body: "Two thousand years ago the Vidzeme Upland was nearly wilderness. Heavy mixed forest of spruce, pine, birch and oak was broken only by lakes and by the young Gauja threading its chain of lake basins [4][15].¶ People were few. Scattered Baltic and Finnic groups are known mostly from their graves [13]. The aurochs, the wild ox the parish is named for, had grown rare in the Baltic by then. Still, a herd could plausibly have grazed open ground like this river terrace. The place name recalls the animal, although it cannot date a herd to this site [16][17]. The camp is a seasonal hunters' shelter, and elk watch from the edge of the forest.",
    facts: [],
  },
  {
    year: 950, label: '~AD 950', title: "A Latgalian farmstead",
    evidence: "This scene draws on the archaeology of Āraiši. The farm layout, the refuge palisade, the cemetery and the neighbouring households are interpretations.",
    body: "By the Late Iron Age this was Latgalian country, the home of the Baltic people whose name Latvia carries [13].¶ The buildings follow the remarkable evidence from Āraiši lake fortress, about 25 km to the west, which was lived in during the ninth and tenth centuries. There were small corner-jointed log houses with a clay stove at the centre, bark roofs held down with poles, and a granary raised on posts [11][12]. Barley, rye and flax grow in small burn-cleared fields called līdumi. Small cattle, dark sheep, pigs and pony-sized horses graze the clearing, and a few chickens scratch in the yard [14]. Across the river, on its hill, stands the palisaded refuge fort of Lejstupu, which is still on the monument register today [10]. Seven more homesteads send up smoke within an hour's walk, because Latgalian settlement was a scatter of single farms loosely gathered around a hillfort district [13][27]. Their number and positions here are illustrative. Smoke seeps out through the gable. The offerings and burial mounds echo regional traditions, although nobody knows whether this particular farm kept them.",
    facts: [],
  },
  {
    year: 1860, label: '1860', title: "Brezgi under Nēķene manor",
    evidence: "The manor history is documented, and the farm buildings are typical of the time. The central Brezgi farm and the family name connection are conjecture.",
    body: "The parish now has a German name, Nötkenshof or Nēķene, after the Notken family who held it from 1601. Since 1856 the von Panders have been its lords [2][3].¶ Serfdom ended in Vidzeme in 1819, and in 1826 families took surnames, often from the farm or hill where they lived. That is how the Brezgis name may echo Brežģa kalns, the high hill up the road to the south [5][6][7]. This is the classic viensēta. Around the yard stand the dwelling with its chimney, the great thatched rija, the shingled klēts, the byre and the pirts smoking by the river, while the well sweep creaks in the yard [8]. Down on the riverbank the manor brewery cools 25,000 buckets of ale a year in cellars vaulted into the slope of the Gauja. The ale is sold at Brežģa krogs, the tavern under the family hill, on the old road that climbs right over it [2]. Ride south and see it for yourself.",
    facts: [],
  },
  {
    year: 1935, label: '1935', title: "Taurene, Latvia",
    evidence: "Historical maps guide the settlement and woodland. Building forms and field boundaries are approximate.",
    body: "Independent Latvia's agrarian reform of 1920 broke up the manors. Nēķene's fields alone became 72 new farms, and the German aristocrats left [9][3].¶ In 1925 the schoolteacher Kārlis Bormanis, author of Latvia's first geography textbook, persuaded the parish council to take the name Taurene. It recalls the aurochs, or tauri, that once grazed these forests, and it took effect on New Year's Day 1926 [1][2][3]. The brick new manor was built in the neo-Renaissance style, and its roof raising was celebrated in 1888. It stands beside the older palace, which the parish took over as a clinic [3]. Below the manor the Gauja widens into the mill pond shown on the 1930s Army map. The farm now has glass windows, a shingle roof and an orchard. Telephone poles follow the gravel road, and the stork keeps its nest on an old wheel. On Jāņi night a bonfire burns on Brežģa kalns, the parish's festival hill, where open-air theatre was staged under the summit oak in the last summers before 1940 [7][2]. Wait for dusk, then look south.",
    facts: [],
  },
  {
    year: 2025, label: '2025', title: "Taurene today",
    evidence: "The 2025 view is an interpretation built from 2020 satellite imagery and 2026 map data. Building heights, tree cover, water depths and shelter designs are inferred.",
    body: "The modern view combines two dated sources, a 2020 Sentinel-2 cloudless mosaic and 2026 OpenStreetMap data.¶ Woodland is estimated from land cover colours [23], and single trees and houses are procedural approximations. Taurene village and the wider parish cover different areas, so their population totals cannot be compared to measure decline [4][3]. The new manor still holds the parish's civic life, and the stork still keeps its nest. On Brežģa kalns stands an observation tower built in 2017. It rises eleven metres above the family hill and looks out over Alauksts, the lake chain and the whole country of this chronicle [7][24]. The Jāņi fire still burns beside it every midsummer. The aurochs have been gone for four hundred years, yet wild grazing has returned. In 2008 the Dutch rewilding foundation ARK released a herd of Konik horses, a hardy Polish breed, onto private meadows in Taurene [28]. The name holds.",
    facts: [],
  },
];

// Latvian texts, era names and the one-line caption under the timeline.
// (Latvian by Claude; worth a native speaker's read.)
const ERA_I18N = [
  {
    yearLv: "≈10 800 p. m. ē.",
    en: { name: "Tundra" },
    lv: {
      title: "Pēc ledus", name: "Tundra",
      evidence: "Šī ir vides rekonstrukcija. Senās ūdensteces, ledus bluķi un dzīvnieku vietas ir ilustratīvas.",
      facts: [],
      body: "Ledājs ir atkāpies, taču tā mirušās atliekas vēl guļ šajās ieplakās. Milzīgi atrauti ledus bluķi lēnām kūst ezeros, kuru krastos reiz izveidosies šis pagasts [21].¶ Šī ir vēlā driasa tundra ar pundurbērziem, kadiķiem, grīšļiem un kailu morēnu, un pa ieleju klīst ziemeļbriežu bari. Mūsdienu reljefs un upes līnija palīdz orientēties, tomēr toreizējo noteci no tiem vien atjaunot nevar. Vēlā paleolīta mednieki Latvijā ir zināmi, bet apmetne tieši uz šīs terases nav atrasta [22]. Tāpēc neapdzīvotā ainava ir interpretācija.",
    },
  },
  {
    yearLv: "≈50. g.",
    en: { name: "Aurochs" },
    lv: {
      title: "Kur tauri ganījās", name: "Tauri",
      evidence: "Šī ir reģionāla analoģija. Nometne un tauru bars ir ticamas ainas, un nekas tās nepiesaista tieši šai vietai.",
      facts: [],
      body: "Pirms diviem tūkstošiem gadu Vidzemes augstiene bija gandrīz neskarta. Biezo jaukto egļu, priežu, bērzu un ozolu mežu pārtrauca tikai ezeri un jaunā Gauja, kas vijās caur savu ezeru virkni [4][15].¶ Cilvēku bija maz. Izkaisītas baltu un somugru kopienas pazīstamas galvenokārt no kapulaukiem [13]. Tauri jeb savvaļas vērši, pēc kuriem nosaukts pagasts, Baltijā tolaik jau bija reti. Tomēr bars ticami varēja ganīties tādā klajumā kā šī upes terase. Vietvārds atgādina dzīvnieku, taču nedatē baru tieši šeit [16][17]. Nometne ir mednieku sezonas pajumte, un no meža malas vēro aļņi.",
    },
  },
  {
    yearLv: "≈950. g.",
    en: { name: "Latgalians" },
    lv: {
      title: "Latgaļu sēta", name: "Latgaļi",
      evidence: "Aina balstās uz Āraišu arheoloģiju. Sētas izkārtojums, patvēruma palisāde, kapulauks un kaimiņu sētas ir interpretācija.",
      facts: [],
      body: "Vēlajā dzelzs laikmetā šī bija latgaļu zeme, mājvieta tai baltu tautai, kuras vārdu nes Latvija [13].¶ Ēkas veidotas pēc Āraišu ezerpils izcilajām liecībām apmēram 25 km uz rietumiem, kur dzīvoja 9. un 10. gadsimtā. Tur bija nelielas guļbūves ar pakšu stūriem un māla krāsni vidū, tāšu jumti, piespiesti ar kārtīm, un uz stabiem pacelta klēts [11][12]. Mazos līdumos aug mieži, rudzi un lini. Klajumā ganās sīki liellopi, tumšas aitas, cūkas un poniju auguma zirgi, un sētā kasās dažas vistas [14]. Aiz upes uz sava kalna stāv ar palisādi nocietinātā Lejstupu patvēruma pils, kas vēl šodien ir aizsargājamo pieminekļu sarakstā [10]. Stundas gājienā kūp vēl septiņas sētas, jo latgaļi dzīvoja izkliedētās viensētās ap pilskalna novadu [13][27]. To skaits un vietas šeit ir ilustratīvas. Dūmi sūcas ārā caur jumta galu. Upuri un kapu uzkalniņi atsauc reģiona tradīcijas, taču nav zināms, vai tieši šī sēta tās ievēroja.",
    },
  },
  {
    yearLv: "1860",
    en: { name: "Manor" },
    lv: {
      title: "Brezgi Nēķena muižas laikos", name: "Muiža",
      evidence: "Muižas vēsture ir dokumentēta, un zemnieku ēkas ir tā laika tipiskās. Centrālā Brezgu sēta un uzvārda saikne ir minējums.",
      facts: [],
      body: "Pagastam tagad ir vācu vārds Nötkenshof jeb Nēķene pēc Notkenu dzimtas, kas to turēja kopš 1601. gada. Kopš 1856. gada tā kungi ir fon Panderi [2][3].¶ Dzimtbūšana Vidzemē tika atcelta 1819. gadā, un 1826. gadā ģimenes saņēma uzvārdus, bieži pēc mājām vai kalna, kur dzīvoja. Tā uzvārds Brezgis varētu atbalsot Brežģa kalnu, augsto kalnu pa ceļu uz dienvidiem [5][6][7]. Šī ir klasiskā viensēta. Ap pagalmu stāv dzīvojamā māja ar skursteni, lielā salmu jumta rija, lubu jumta klēts, kūts un pirts, kas kūp pie upes, bet sētā čīkst akas svira [8]. Lejā upes krastā muižas brūzis gadā atdzesē 25 000 spaiņu alus pagrabos, kas izbūvēti Gaujas nogāzē. Alu pārdod Brežģa krogā zem dzimtas kalna, pie vecā ceļa, kas kāpj tieši tam pāri [2]. Jāj uz dienvidiem un paskaties pats.",
    },
  },
  {
    yearLv: "1935",
    en: { name: "Taurene" },
    lv: {
      title: "Taurene, Latvija", name: "Taurene",
      evidence: "Apdzīvotību un mežus vada vēsturiskās kartes. Ēku formas un lauku robežas ir aptuvenas.",
      facts: [],
      body: "Neatkarīgās Latvijas 1920. gada agrārā reforma sadalīja muižas. Nēķena zemēs vien izveidoja 72 jaunsaimniecības, un vācu muižnieki aizbrauca [9][3].¶ 1925. gadā skolotājs Kārlis Bormanis, pirmās latviešu ģeogrāfijas mācību grāmatas autors, pārliecināja pagasta padomi pieņemt nosaukumu Taurene. Tas atgādina taurus, kas reiz ganījās šajos mežos, un stājās spēkā 1926. gada Jaungada dienā [1][2][3]. Ķieģeļu jaunā pils celta neorenesanses stilā, un tās spāru svētki svinēti 1888. gadā. Tā stāv blakus vecajai pilij, ko pagasts pārņēma ambulancei [3]. Zem muižas Gauja paplašinās dzirnavu dīķī, kā to rāda 1930. gadu armijas karte. Sētai tagad ir stikla logi, lubu jumts un augļu dārzs. Gar grants ceļu stiepjas telefona stabi, un stārķis tur ligzdu uz veca rata. Jāņu naktī uz Brežģa kalna deg ugunskurs. Tas ir pagasta svētku kalns, kur pēdējās vasarās pirms 1940. gada zem virsotnes ozola spēlēja brīvdabas teātri [7][2]. Sagaidi krēslu un paskaties uz dienvidiem.",
    },
  },
  {
    yearLv: "2025",
    en: { name: "Today" },
    lv: {
      title: "Taurene šodien", name: "Mūsdienas",
      evidence: "2025. gada skats ir interpretācija, kas veidota no 2020. gada satelītattēliem un 2026. gada kartes datiem. Ēku augstumi, koku segums, ūdens dziļumi un nojumju izskats ir secināti.",
      facts: [],
      body: "Mūsdienu skats apvieno divus datētus avotus, 2020. gada Sentinel-2 bezmākoņu mozaīku un 2026. gada OpenStreetMap datus.¶ Mežs novērtēts pēc zemes seguma krāsām [23], un atsevišķi koki un mājas ir procedurāli tuvinājumi. Taurenes ciems un plašākais pagasts aptver dažādas teritorijas, tāpēc to iedzīvotāju skaitus nevar salīdzināt, lai mērītu sarukumu [4][3]. Jaunajā pilī joprojām rit pagasta sabiedriskā dzīve, un stārķis vēl tur savu ligzdu. Uz Brežģa kalna stāv 2017. gadā celts skatu tornis. Tas paceļas vienpadsmit metrus virs dzimtas kalna un raugās pāri Alaukstam, ezeru virknei un visai šīs hronikas zemei [7][24]. Jāņu uguns tam blakus deg katros vasaras saulgriežos. Tauri zuduši jau pirms četrsimt gadiem, tomēr savvaļas ganīšanās ir atgriezusies. 2008. gadā nīderlandiešu dabas atjaunošanas fonds ARK izlaida privātās Taurenes pļavās Konik zirgu baru, izturīgu poļu šķirni [28]. Vārds turas.",
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
  "lv": {
    "kicker": "Taurenes pagasts · Vidzeme · Latvija",
    "paras": [
      "Šis ir viens Latvijas lauku kvadrāts, 8,8 kilometrus plats, ap Taurenes ciemu Vidzemē. To var apmeklēt sešos brīžos divpadsmit tūkstošu gadu garumā. Zeme zem kājām ir īstais reljefa modelis, un Gauja ar strautiem un ezeriem nāk no kartēm, tāpat kā šodienas ceļi un mājas.",
      "Sēta centrā nes Brezgu stāstu cauri laikmetiem. Tā atrodas pie Taurenes ciema. Īstās Brezgu mājas un Brežģa kalns, kura vārdu uzvārds atbalso, ir pa ceļu uz dienvidiem, un turp var aizlidot minūtes laikā.",
      "Katrs laikmets ir rekonstrukcija. Daļa ir dokumentēta, piemēram, muiža, Taurenes vārds, 1930. gadu dzirnavu dīķis un tornis uz kalna. Citas daļas nāk no arheoloģijas citviet Latvijā, un dažas ir iztēle. Katra laikmeta stāsts pasaka, kas ir kas, un Hronikā ir visi avoti."
    ],
    "how": "Pārvietojies ar WASD vai bultiņām, bet telefonā velc un spied pogas. Laikmetus maini ar taustiņiem 1 līdz 6 vai laika joslā, un karti atver ar M.",
    "enter": "Ienākt ainavā",
    "loading": "Ainava top…"
  },
  "en": {
    "kicker": "Taurene parish · Vidzeme · Latvia",
    "paras": [
      "This is one square of Latvian countryside, 8.8 kilometres across, around the village of Taurene in Vidzeme. You can visit it at six moments across twelve thousand years. The ground under your feet is the real elevation model, and the Gauja with its brooks and lakes comes from maps, along with today's roads and houses.",
      "A farm at the centre carries the Brezgi story through the eras. It stands near Taurene village. The real Brezgi homestead and Brežģa kalns, the hill the name echoes, lie up the road to the south, and you can fly there in a minute.",
      "Each era is a reconstruction. Some of it is documented, such as the manor, the name Taurene, the mill pond of the 1930s and the tower on the hill. Other parts come from archaeology elsewhere in Latvia, and some are imagined. Each era's story tells you which is which, and the Chronicle lists every source."
    ],
    "how": "Move with WASD or the arrow keys, or drag and use the buttons on a phone. Change eras with keys 1 to 6 or the timeline, and press M for the map.",
    "enter": "Step in",
    "loading": "Building the landscape…"
  }
};

export const TITLE = 'BREZGI';
export const SUBTITLE = 'Taurenes pagasts · 57.159° N, 25.665° E · a time machine';

export const SOURCES = [
  { n: 1, t: 'Kārlis Bormanis, Vikipēdija (the teacher who renamed the parish, 1925/1926, "Zeme", Latvia\'s first geography textbook)', u: 'https://lv.wikipedia.org/wiki/K%C4%81rlis_Bormanis' },
  { n: 2, t: '"Laipni lūdzam Taurenes pagastā!", Taurene library parish-history presentation (Nēķena manor, brewery, Brežģa kalns, Jāņi fires, White Lady)', u: 'https://www.slideshare.net/Taurbiblio/laipni-ludzam-taurenes-pagastamd' },
  { n: 3, t: 'Taurenes pagasts, pagasta vēsture (Vecpiebalgas apvienības pārvalde)', u: 'https://vecpiebalga.lv/lv/vecpiebalga/vecpiebalgas-apvieniba/pagastu-vesture/taurenes-pagasts/' },
  { n: 4, t: 'Taurene / Taurenes pagasts / Brezģis / Dabaru ezers / Taurenes ezers, Vikipēdija', u: 'https://lv.wikipedia.org/wiki/Taurenes_pagasts' },
  { n: 5, t: 'Consolidation of Surnames in Vidzeme, ICOS (1826 surname adoption, farm-name origins)', u: 'http://www.gencat.cat/llengua/BTPL/ICOS2011/164.pdf' },
  { n: 6, t: 'Abolition of serfdom in Livonia, 1819, Wikipedia', u: 'https://en.wikipedia.org/wiki/Abolition_of_serfdom_in_Livonia' },
  { n: 7, t: 'Brežģa kalns (255.4 m, alias Karatavu kalns, Jāņi fires, theatre 1937–39, tower views), Vikipēdija / Visit Cēsis', u: 'https://lv.wikipedia.org/wiki/Bre%C5%BE%C4%A3a_kalns' },
  { n: 8, t: 'The Latvian Farmstead (viensēta), Latvijas Kultūras kanons, Latvian Ethnographic Open-Air Museum', u: 'https://kulturaskanons.lv/en/archive/latviesu-vienseta/' },
  { n: 9, t: 'Latvian Agrarian Reform Law of 1920, Wikipedia', u: 'https://en.wikipedia.org/wiki/Latvian_Agrarian_Reform_Law_of_1920' },
  { n: 10, t: 'Archaeological monuments of Taurenes pagasts (13 sites incl. Lejstupu pilskalns #585)', u: 'http://vidzemes-arheologija.blogspot.com/p/vecpiebalgas-novads.html' },
  { n: 11, t: 'Meadows et al., Single-Year ¹⁴C Dating of the Lake-Fortress at Āraiši, Latvia (online 2023, Radiocarbon 66, 2024)', u: 'https://doi.org/10.1017/RDC.2023.24' },
  { n: 12, t: 'Āraiši building construction, Medieval Heritage EU', u: 'https://medievalheritage.eu/en/main-page/heritage/latvia/araisi-open-air-museum/' },
  { n: 13, t: 'Latgalians, Wikipedia (territory, burial customs)', u: 'https://en.wikipedia.org/wiki/Latgalians' },
  { n: 14, t: 'Iron Age livestock, earliest Baltic chickens (Rannamäe et al. 2021)', u: 'https://kirj.ee/wp-content/plugins/kirj/pub/arch-2-2021-160-181_20210930090939.pdf' },
  { n: 15, t: 'Landscape change in central Latvia since the Iron Age, Veget. Hist. Archaeobot.', u: 'https://www.academia.edu/16308755/' },
  { n: 16, t: '"taurs" (aurochs), etymology, place-names as evidence, Wiktionary', u: 'https://en.wiktionary.org/wiki/taurs' },
  { n: 17, t: 'Aurochs, Wikipedia (Baltic range, extinct 1627)', u: 'https://en.wikipedia.org/wiki/Aurochs' },
  { n: 18, t: 'Real elevation model, AWS Open Data Terrain Tiles (Mapzen terrarium)', u: 'https://registry.opendata.aws/terrain-tiles/' },
  { n: 19, t: 'River & lake geometry, OpenStreetMap contributors', u: 'https://www.openstreetmap.org/' },
  { n: 20, t: 'Māra Zālīte\'s lines quoted in Latvijas Vēstnesis (1998)', u: 'https://www.vestnesis.lv/ta/id/50101' },
  { n: 21, t: 'Deglaciation history of Latvia (Zelčs et al.), dead-ice meltdown into the early Holocene (Stivriņš et al. 2017, The Holocene)', u: 'https://journals.sagepub.com/doi/10.1177/0959683616683255' },
  { n: 22, t: 'Salaspils Laukskola, earliest human settlement of Latvia, ~10,500 cal BC (Archaeologia Baltica 2019)', u: 'https://www.researchgate.net/publication/338825097_The_Northern_Fringe_of_the_Swiderian_Technological_Tradition_Salaspils_Laukskola_Revisited' },
  { n: 23, t: 'Sentinel-2 cloudless (2020) by EOX IT Services GmbH, CC-BY 4.0, contains modified Copernicus Sentinel data', u: 'https://s2maps.eu' },
  { n: 24, t: 'Brežģa kalns observation tower (2017), EnterGauja / Visit Cēsis', u: 'https://www.entergauja.com/lv/ko-darit/enter-daba/brezga-kalns' },
  { n: 25, t: 'Camera feel, wind model and realism standards adapted from LAAS (MIT), a fully procedural WebGPU world', u: 'https://github.com/Braffolk/fable5-world-demo' },
  { n: 26, t: 'Latvian Army 1:75,000 topographic map, 1920–1940 (Nēķina mž. sheet, 1935 farms, roads and forests verified against it), via vesture.dodies.lv', u: 'https://vesture.dodies.lv/' },
  { n: 27, t: 'Iron Age settlement density of NE Vidzeme, research/iron-age-settlement.md (Stivriņš et al. 2015 pollen record, Radiņš, Vasks, Āraiši hinterland estimates)', u: 'https://en.wikipedia.org/wiki/%C4%80rai%C5%A1i_lake_fortress' },
  { n: 28, t: 'ARK Rewilding Latvia project, Konik horses and bovines introduced to Latvian grazing areas from 2005 onward', u: 'https://arkrewilding.nl/en/projects/latvia' },
];
