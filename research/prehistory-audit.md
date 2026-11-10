# Prehistory audit: the three early eras (~10,800 BC, ~AD 50, ~AD 950)

Compiled 2026-11-10. Scope: what the model shows and claims for eras 0, 1 and 2,
checked against published palaeoecology, zooarchaeology, archaeology and the
national monument register. No existing file was changed.

How to read the confidence notes. **Verified** means I fetched the source during
this audit and read the passage. **Recalled** means the point comes from the
literature as I know it and I could not open the source today, so it should be
checked before it is quoted on the site. Several repositories refused automated
access (dspace.lu.lv, link.springer.com, mdpi.com, core.ac.uk), and I did not work
around those refusals. Where that left a gap I say so.

Coordinates. Scene metres are given as `x` (east positive) and `z` (south
positive) from the origin 57.15944 N, 25.66472 E, using 111,320 m per degree of
latitude and 60,370 m per degree of longitude. That is a flat approximation which
is good to a few metres over this tile. If `data/fetch-lidar.py` uses a different
projection, convert the WGS84 values with that instead.

---

## 1. What the model currently shows

### Era 0, "~10,800 BC, After the ice" (`year: -10800`)

| Element | Where | What it is |
| --- | --- | --- |
| Vegetation | `landuse.js` `forestDensity` era 0, `vegetation.js` line 726 | No trees. One shrub type standing for "dwarf birch / juniper heath", 0.8 to 1.9 m tall, density up to 0.36, thinned near the river. |
| Ground | `terrain.js` `paintVertex` era 0 | Till and gravel, dark moss, rust "dryas" heath, sedge flushes, gravel outwash within 26 m of the river. |
| Grass | `grass.js` | Half-height straw-coloured "tundra sedge". No flowers. |
| Wetland plants | `vegetation.js` line 1096 | Reeds, cattail and yellow flag hidden. Sedges kept. Water lilies hidden. |
| Water | `water.js` `setEra` | Modern river course and all modern lake outlines drawn as water, tinted "milky with rock flour". |
| Dead ice | `eras.js` line 1952, `buildings.js` `deadIce` | Three pale ice blobs at the centroid of every modern lake. |
| Erratics | `eras.js` line 1957 | 300 boulders across the tile. |
| Animals | `eras.js` lines 1634 to 1641 and 1959 to 1961 | Reindeer (7 + 5), one elk, 3 "arctic hares" (white), 1 arctic fox (white), 6 ptarmigan (white), 2 whooper swans on the lake. No fish. |
| Sky | `main.js` line 419 | Aurora, in this era only. |
| Text claims | `content.js`, `WRITEUP.md` | "The ice sheet has gone, but its dead remains still lie buried in these hollows." "Younger Dryas tundra, with dwarf birch, juniper, sedge and bare till." "A milky meltwater Gauja." "Late Palaeolithic hunters are known from Latvia." A code comment calls the small animals "companions of the ice edge". |

### Era 1, "~AD 50, Where the aurochs grazed" (`year: 50`)

| Element | Where | What it is |
| --- | --- | --- |
| Forest | `landuse.js` line 829, `vegetation.js` lines 733 to 742 | "Primeval forest", density 0.68 to 1.0. Wet ground: alder 55 %, birch 30 %, spruce 15 %. Above 215 m: spruce 50 %, pine 35 %, birch 15 %. Elsewhere: birch 34 %, spruce 26 %, pine 22 %, oak 18 %. Snags and fallen logs. Understory of ferns, "bramble" tangles and "hazel-ish" bushes. Riverside willow and alder. One named oak. |
| Openings | same | Floodplain meadow within 35 to 120 m of the river, and an open terrace "where the aurochs graze". |
| Flowers | `grass.js` | White umbels, ox-eye daisy, buttercup. Bumblebees. |
| Human structures | `eras.js` lines 1965 to 1973 | One lean-to with a brush bed, a campfire, a fish rack, a dugout canoe. No fields, no livestock, no graves, no paths. |
| Animals | `eras.js` | Aurochs bull, three cows, a calf. Elk (2). Red deer (3), roe deer (4), wild boar (5), beaver (2), fox, brown hare (3), squirrel, wolf (2), black grouse, buzzards, cranes, butterflies, whooper swans, plus the aquatic set (roach, perch, pike, grayling, brown trout, bream, mallard, goosander, goldeneye, grey heron, otter, kingfisher, frog, dragonfly). |
| Text claims | `content.js`, `WRITEUP.md` | "Nearly wilderness." "Heavy mixed forest of spruce, pine, birch and oak." "Scattered Baltic and Finnic groups are known mostly from their graves." "The camp is a seasonal hunters' shelter." `research/iron-age-settlement.md` concludes "1 camp is correct" and that the subsistence base was hunting, fishing and gathering. |

### Era 2, "~AD 950, A Latgalian farmstead" (`year: 950`)

| Element | Where | What it is |
| --- | --- | --- |
| Forest | `landuse.js` line 834 | Density 0.56 to 1.0, same species mix as era 1, with clearings at the stead, the barrows and seven outlying farms. |
| Main farm | `eras.js` lines 1982 to 2016 | Log dwelling 5 x 6 m with bark gable roof, a 4 x 5 m second cabin, a 4.5 x 7 m thatched building, a granary on four posts with a thatched roof, wattle fence, two haystacks, a yard fire, two upright **log beehives** with thatch caps, a dugout canoe, a log bridge over the Gauja. |
| Neighbours | `landuse.js` `ERA2_FARMS` | Seven farms, each a dwelling plus a granary or second cabin, a haystack and a wattle fence. |
| Hillfort | `LOC.HILLFORT = {x: -1080, z: 820}`, `palisadeRing` radius 17 m | A circular palisade 34 m across with a gate gap, two cabins and a post granary inside. Labelled Lejstupu (Briediņu) pilskalns. |
| Burials | `LOC.BARROWS`, `BUMPS`, `barrowMounds`, `barrowStones` | Seven fresh round barrows, 4.2 to 7 m across and 0.75 to 1.2 m high, each with a stone marker, about 300 m south-east of the farm. They first appear in this era and persist, eroded, in 1860 and 1935. |
| Ritual | `offeringPile` at `LOC.OAK` | Stones and a wreath under a "sacred oak". |
| Fields | `landuse.js` line 463, `lidumsProps` | Lobed burn clearings (*līdumi*) with standing stumps and clearance cairns, sown with barley, rye and flax, some fallow. |
| Livestock | `eras.js` lines 2042 to 2047, `animals.js` | Cattle 1.05 m at the shoulder (4), dark sheep 0.60 m (5), "tarpan" horses 1.30 m (2), dark pigs 0.62 m (2), hens (3), a rooster. No dog, goat or cat. |
| Wild animals | `eras.js` | As era 1 without the aurochs and elk. White wagtails in the yard. |
| Text claims | `content.js`, `WRITEUP.md` | Āraiši houses "of about thirty square metres", "the clay stove at the centre of the room", "the granary raised against damp and mice", "rye, barley, wheat and turnips", "forest beekeeping", "low, fresh barrow mounds", "the barrows enter the landscape in this era". `research/baltic-iron-age.md` says rye was "the dominant crop". |

---

## 2. Era 0: the Younger Dryas

### 2.1 Is "~10,800 BC" a sound label?

It is inside the Younger Dryas, but only just, and that is the weak point.

- The Younger Dryas is conventionally 12,900 to 11,700 cal BP, which is about
  10,950 to 9,750 BC. 10,800 BC is 12,750 cal BP, roughly a century after the
  onset.
- The vegetation in Latvia had not yet turned over at that date. At Lake Lielais
  Svētiņu in eastern Latvia the pollen accumulation of trees "declined abruptly
  from a maximum value at 12,700 to below 1000 grains cm⁻² yr⁻¹ at 12,600 cal yr
  BP", and pine macrofossils disappear at 12,600 cal yr BP (Veski et al. 2012,
  *Quaternary Science Reviews* 40: 39 to 53; abstract verified at
  <https://research.lu.lv/en/publications/lateglacial-vegetation-dynamics-in-the-eastern-baltic-region-betw/>).
- The nearest record to Taurene says the same. At Lake Ķūži in the western
  Vidzeme Upland (57.031 N, 25.336 E, about 24 km south-west of Taurene, 191.5 m
  a.s.l.) "an open forest dominated by *Pinus* with the presence of some *Picea*
  trees was growing in the area about 12 900 cal BP". A piece of spruce wood was
  AMS dated to 12,900 cal BP. Only after that did the forest regress to a
  Younger Dryas assemblage (Koff and Terasmaa 2011, *Estonian Journal of Earth
  Sciences* 60: 113 to 122; full text verified at
  <https://kirj.ee/public/Estonian_Journal_of_Earth_Sciences/2011/issue_2/earth-2011-2-113-122.pdf>,
  DOI <https://doi.org/10.3176/earth.2011.2.05>).
- The earliest possible human presence in Latvia is later than the label. The
  Salaspils Laukskola site has "an earliest possible geological date to the
  middle part of the Younger Dryas c. 10 500 cal BC", with the Swiderian
  occupation "stretching into the first half of the Preboreal until c. 9000 cal
  BC" (Berg-Hansen, Damlien and Zagorska 2019, *Archaeologia Baltica* 26: 12 to
  31; full text verified at <https://e-journals.ku.lt/journal/AB/article/785>).

**Recommendation.** Relabel the era **"~10,500 BC"** (12,450 cal BP), or
"~10,300 BC" if a mid-stadial date is preferred. Either one puts the scene firmly
after the forest collapse, in full Younger Dryas vegetation, and at a date when
the sentence about Late Palaeolithic hunters is true. Set `year: -10500`. If the
existing label is kept, the scene should show a dying open pine and birch
woodland with spruce, which is not what is drawn.

### 2.2 Was the upland ice free, and what about dead ice?

Yes, the active ice had been gone for two thousand years or more.

- "The Vidzeme Heights are located distally from the ice-marginal formations of
  the Luga (North Lithuanian) stage." Cosmogenic ¹⁰Be ages from the Burtnieks
  drumlin field, which lies north of and lower than the upland, show that area
  "was deglaciated by 13 500 cal BP at the latest" (Koff and Terasmaa 2011,
  citing Rinterknecht et al. 2006; verified, link above).
- The ice-marginal sequence on the upland slopes is Kaldabruņa, then Gulbene,
  then Linkuva in order of decreasing age. Search summaries of Zelčs and Markots
  (2004, "Deglaciation history of Latvia", in *Quaternary Glaciations: Extent
  and Chronology*) and of Zelčs, Markots, Nartišs and Saks (2011, "Pleistocene
  glaciations in Latvia", *Developments in Quaternary Sciences* 15) place the
  Linkuva margin at about 15.6 to 15.4 cal ka, and a ¹⁰Be age of 13.3 ± 0.7 ka is
  quoted for retreat from the North Lithuanian moraine (Rinterknecht et al.
  2008). I could not open either chapter today (core.ac.uk refused), so treat the
  exact figures as **recalled**. The safe statement is that the Vidzeme Upland was
  free of active ice by roughly 15 to 14.5 thousand years ago and was among the
  first parts of Latvia to emerge, as an "insular upland" standing above the ice
  lobes.
- At the Younger Dryas the ice-sheet margin stood at the Salpausselkä moraines in
  southern Finland, some 400 km to the north. Nothing in this square was "at the
  ice edge", so the code comment "the small companions of the ice edge" in
  `eras.js` line 1635 should go.

Dead ice is defensible, but it was **buried**, and the model draws it exposed.

- Lake Ķūži is described as "glaciokarstic in origin", that is, a hollow left by
  melted buried ice. Its organic lake sediment (gyttja) only begins at about
  11,300 cal BP and the fen peat beside it at about 11,200 cal BP: "the formation
  of the lake sediments started at the very beginning of the Holocene" (Koff and
  Terasmaa 2011; Terasmaa et al. 2016, *Baltica* 29: 63 to 78, verified at
  <https://gamtostyrimai.lt/wp-content/uploads/2022/06/2016_vol291-07_5eb40f9570744.pdf>).
  So the upland's kettle basins were not yet the lakes we see.
- Stivriņš et al. (2017, *The Holocene*, DOI
  <https://doi.org/10.1177/0959683616683255>) show that a buried ice block under
  Lake Ķikuru finally melted only at 8,500 to 7,400 cal BP. Note that Ķikuru is
  in **western** Latvia (Kurzeme), not Vidzeme. The paper supports the general
  mechanism and the long survival of buried ice. It does not date the Taurene
  lakes. The model's source [21] also runs two different works together: Zelčs'
  "Deglaciation history of Latvia" is not the Stivriņš paper at that URL.

**What the scene should show instead.** By the Younger Dryas the ice blocks had
been buried under till and outwash for two millennia. They did not sit on the
surface as clean pale icebergs. The honest picture is a hummocky, debris-mantled
basin floor with shallow thermokarst ponds, slumping margins, sedge and moss fen,
and perhaps a dirty ice face exposed in a fresh slump scar. The modern lake
outlines at modern levels are too large and too full for this date.

### 2.3 The Gauja: existence and regime

- A drainage line existed, because the valleys were cut by meltwater during
  deglaciation. A continuous river running through seven connected lakes did
  not, because those lake basins were still plugged by buried ice. The likely
  picture is a string of poorly connected ponds and short, shifting gravel-bed
  channels. This is an inference from the lake-origin evidence above. The model's
  own text already admits that "the real drainage of that time cannot be rebuilt".
- **"A milky meltwater Gauja" is wrong.** Rock-flour milkiness needs a glacier
  upstream. The Gauja rises on this very upland at Lake Alauksts, and there was
  no glacier anywhere in its catchment. The regime would have been nival: a large
  snowmelt flood in late spring over frozen ground, then low clear water in
  summer, with silty runoff from bare slopes and slumping pond margins. The water
  tint in `water.js` (`uBody` 0.055, 0.085, 0.088 with `uExtinct` 2.2) should
  move towards clear, cold water over a pale gravel bed.

### 2.4 Vegetation

What the pollen and macrofossils from Ķūži and the eastern Latvian lakes give for
the Younger Dryas proper:

- **Dwarf birch** (*Betula nana*): yes, pollen and seeds at Ķūži.
- **Juniper**: yes, "*Juniperus* proportions are around 2 to 3 %" at Ķūži.
- **Mountain avens** (*Dryas octopetala*): yes, at Ķūži, Kurjanovas and Lielais
  Svētiņu.
- **Willows**: yes, both dwarf willows (*Salix herbacea* type, *S. polaris*) and
  shrub willows. The model has no willow in this era and should.
- **Steppe-tundra herbs**: *Artemisia*, Chenopodiaceae and grasses are "the
  dominants among the NAP" at Ķūži, with *Ephedra*, *Thalictrum*, *Onobrychis*
  and Caryophyllaceae. **Sea buckthorn** (*Hippophae rhamnoides*) is called
  "characteristic" of the phase. The model's palette of moss, rust heath and
  sedge is fine but should lean greyer and drier, with wormwood-grey patches on
  the well-drained hilltops.
- **Trees.** This is the main correction. The "treeless tundra" picture is out of
  date for Latvia.
  - Spruce: "a reproductive *Picea* population during the Younger Dryas stadial
    12 900 to 11 700 cal BP was evidenced by macrofossils" at Lake Kurjanovas
    (Heikkilä, Fontana and Seppä 2009, *Journal of Quaternary Science* 24: 802 to
    815, DOI <https://doi.org/10.1002/jqs.1254>, quoted in Koff and Terasmaa
    2011). At Lielais Svētiņu spruce needles, seeds and wood occur "since 12,050
    cal yr BP up to the Holocene" (Veski et al. 2012).
  - Pine: macrofossils vanish at 12,600 cal BP "yet occasional *Pinus* stomata
    are recorded throughout the Younger Dryas" (Veski et al. 2012).
  - Tree birch: *Betula pubescens* grew in the local wetland succession at Ķūži.
  - Heikkilä et al. conclude that "the concept of 'treeless tundra' in eastern
    and northern Europe fails to explain the rapidity" of the tree dynamics, and
    describe the Younger Dryas vegetation as semi-open.
  - A caution: Kurjanovas and Lielais Svētiņu are lowland sites 150 to 200 km to
    the east. At 180 to 250 m on an exposed upland, trees would have been scarcer
    and more stunted than there. The right picture is open shrub tundra and
    steppe with **scattered, stunted spruce, pine and downy birch in sheltered
    hollows and on south slopes**, well under 5 % cover. It is not a forest, and
    it is not a tree-free plain either.
- **Shrub height.** *Betula nana* is 0.2 to 1 m tall. The shrub instances are
  scaled 0.8 to 1.9 m, which reads as birch scrub. Cap dwarf birch at about 0.8 m
  and let only the willow thickets in wet hollows reach 1.5 to 2 m.
- **Reeds and cattail.** Hiding cattail and yellow flag is right. Hiding reed is
  a defensible simplification, although *Phragmites* is sometimes recorded in
  Lateglacial lake margins (recalled, not checked).

### 2.5 Fauna

- **Reindeer: correct, and well dated.** Forty-five subfossil reindeer finds are
  known from Estonia, Latvia and Lithuania. Twelve were dated, to 12,085 to 9,970
  ¹⁴C BP, which is 14,180 to 11,280 cal BP. The authors infer "a rapid
  colonization of the area during the deglaciation period and a local extinction
  around the Pleistocene-Holocene boundary" and "a stable residence of the
  species" (Ukkonen, Lõugas, Zagorska, Lukševica, Lukševics, Daugnora and Jungner
  2006, *Boreas* 35: 222 to 230, DOI <https://doi.org/10.1080/03009480600578065>;
  abstract verified through <https://lup.lub.lu.se/record/408429>).
- **Woolly mammoth: not "already gone".** The eastern Baltic was recolonised by
  mammoth after deglaciation, and the youngest mammoths in Europe are from
  Puurmani in Estonia at about 11.8 to 11.9 cal ka, inside the Younger Dryas.
  The regional range of late dates is 12.6 to 11.2 cal ka, and extinction is tied
  to reforestation at the Younger Dryas to Holocene boundary (Ukkonen et al.
  2011, *Quaternary Science Reviews* 30, recalled; a 2025 paper in *Land* 14(1):
  178, <https://www.mdpi.com/2073-445X/14/1/178>; popular summary verified at
  <https://news.err.ee/1609756647/rapid-landscape-afforestation-spelled-doom-for-estonia-s-woolly-mammoths>).
  The dated Younger Dryas animals are Estonian. I found no Latvian mammoth dated
  to the stadial. So a mammoth is **defensible but optional**: one or two distant
  animals on the skyline would be supportable for the region, and the text should
  not say mammoths were extinct here.
- **Arctic fox, collared lemming, ptarmigan, mountain hare.** All are consistent
  with the environment. Collared lemming (*Dicrostonyx*) dominated Younger Dryas
  small-mammal faunas across north-eastern Europe (Ponomarev, van Kolfschoten and
  van der Plicht 2012, *Russian Journal of Theriology* 11: 121 to 130). I did not
  find a dated Latvian arctic fox or ptarmigan bone, so these remain
  environmental inference, which the evidence line already says.
- **"Arctic hare" is the wrong name.** *Lepus arcticus* is a North American and
  Greenland species. The animal here is the mountain hare, *Lepus timidus*
  (Latvian *baltais zaķis*). Rename the species key.
- **Winter coats in summer.** The hare, the fox and the ptarmigan are all pure
  white (`0xf0efe8`, `0xeceae4`, `0xf2f2ee`). If the scene is the same midsummer
  day as the other eras, all three should be in summer pelage: grey-brown hare,
  brown-grey fox with pale flanks, mottled brown ptarmigan with white wings.
- **Elk.** One elk is placed in the era. Elk is a woodland and willow-carr
  browser that is typical of the Allerød and the early Holocene in the eastern
  Baltic. I could not find a dated Younger Dryas elk from Latvia, so this animal
  is the least secure of the set. Remove it, or keep it only if the era is drawn
  with the sparse trees and willow carr recommended above.
- **Whooper swans** on a summer tundra pond are plausible.
- **Missing but plausible:** wolf (the reindeer's predator), wolverine, lemmings
  as ground life, waders and geese on the ponds.
- **Aurora.** Not an error, but it is no more a property of the Younger Dryas
  than of any other era at 57° N. Showing it only here implies otherwise.

### 2.6 Human presence

- No Late Palaeolithic site is known in the upper Gauja basin or anywhere on the
  Vidzeme Upland. All the Latvian Final Palaeolithic lithic assemblages analysed
  by Berg-Hansen, Damlien and Zagorska (2019) lie along the Daugava: **Salaspils
  Laukskola, Mūkukalns, Skrīveru Lielrutuļi, Ikšķiles Elkšņi, Ķentes pilskalns
  and Sēlpils**. They lie roughly 65 to 90 km south and south-west of Taurene.
- Laukskola had six flint scatters, each about 5 by 6 m with a hearth, and 2,710
  chipped-stone artefacts. Its affiliation is Swiderian. "Several Latvian finds
  of bone and antler artefacts (harpoons, a single Lyngby axe and reindeer
  remains) have been radiocarbon dated to the same period" (same paper).
- The Latvian National Encyclopaedia entry already cited by the project,
  <https://enciklopedija.lv/skirklis/4433>, is the right institutional reference.
- The current wording, "no camp on this exact terrace has been found", is
  accurate. Depicting no people is a fair choice. With the label at 10,800 BC,
  though, the sentence "Late Palaeolithic hunters are known from Latvia" describes
  people who had probably not yet arrived, which is another reason to move the
  date to about 10,500 BC.

---

## 3. Era 1: ~AD 50

### 3.1 The central problem: this was not a hunters' wilderness

The model, the write-up and `research/iron-age-settlement.md` all rest on one
sentence from the Lake Āraiši study, that in AD 1 to 700 "the vicinity of Lake
Āraiši was covered by forests and human activities were only small-scale with the
first appearance of cereal pollen (*Triticum* and *Secale cereale*) after AD 400"
(Stivriņš et al. 2015, *Vegetation History and Archaeobotany* 24: 377 to 391, DOI
<https://doi.org/10.1007/s00334-014-0502-y>; abstract verified through
<https://centaur.reading.ac.uk/37957/>). That sentence is real, but it describes
one lake shore 25 km away, and "small-scale human activities" is not "hunting
and gathering". Three independent lines of evidence closer to Taurene point to
farmers.

1. **A dated cemetery inside this very square.** Ciglis (2013) dates the start of
   the typical stone graves of eastern Latvia to the middle of the first century
   AD, and names this parish: "The latest strongly profiled fibulae (the 69th
   type, noted by O. Almgren) found at the **Gailīšu burial site in Taurenes** ...
   can also be dated from the mid-first century to the second half of the first
   century" (J. Ciglis, "The origin of burial sites in eastern Latvia consisting
   of typical stone graves", *Archaeologia Baltica* 19; full text
   verified at <https://e-journals.ku.lt/journal/AB/article/1641/file/pdf>).
   A community was burying its dead with imported-style bronze brooches in
   Taurene at almost exactly AD 50. The Gailīši farmstead in Taurenes pagasts is
   at 57.10585 N, 25.72212 E (OpenStreetMap), which is scene x ≈ +3465, z ≈ +5966,
   inside the south-east corner of the tile. That is the farm, not a surveyed
   position for the cemetery, which is not in the monument register and may have
   been destroyed. The gravel pits named in the register entry for monument 587
   are 380 m to the east.
2. **Registered Early Iron Age cemeteries ring the tile** (official register,
   section 5): Lejas Lībiešu senkapi (Akmeņkalns, "Stone Hill") 340 m beyond the
   west edge, Šinku senkapi (Akmens kapi, "Stone Graves") 800 m beyond the south
   edge, Jaunvīļumu senkapi (Velna klēpis) and Saulgožu senkapi (Velna kreklājs)
   1.2 to 1.8 km beyond it. All four are dated "Agrais dzelzs laikmets" (AD 1 to
   400), and their folk names are the classic names of stone-setting graves.
   Five Early Iron Age cemeteries within about 8 km is a settled farming
   district.
3. **The local pollen record shows farming starting at this date.** At Lake Ķūži
   in the same upland: "From 195 cm (2 000 cal. BP) the pollen data are dominated
   by *Betula* and is characterized by a decline in *Picea* and *Corylus* pollen
   and an increase in *Pinus* pollen. In addition, the occurrence of terrestrial
   herbs, mainly Poaceae and *Secale* was registered ... and several
   charcoal-rich layers were present." The authors read this as "an onset of
   agriculture in the lake catchment" and "a major disturbance clearly related
   to human activity" from 2,000 cal BP (Terasmaa et al. 2016, verified, link
   above). Birch replacing spruce with charcoal layers and cereal pollen is the
   signature of slash-and-burn cultivation.

Wider context: "farming became the dominant form of economy in Latvia in the
middle of the Bronze Age (ca 3 000 cal BP)" (Vasks et al. 1999, quoted by
Terasmaa et al. 2016). At the Padure (Beltes) hillfort in western Latvia the bones
from the Late Bronze and Early Iron Age layer are dominated by cattle, sheep or
goat, pig and horse, with wild animals a small minority (Daugnora, Vasks, Sovaitė
and Girininkas, *Archaeologia Baltica*; full text verified at
<https://e-journals.ku.lt/journal/AB/article/982/file/pdf>). Local iron smelting
from bog ore begins in Latvia around the turn of the era (Latvian National
Encyclopaedia, <https://enciklopedija.lv/skirklis/4946>, verified).

**Answer to the question asked.** A small farming household with burn plots and a
stone grave is more accurate than a seasonal hunters' camp with a lean-to. The
lean-to as the only human structure in 77 km² misrepresents the period. The fish
rack and the dugout can stay, since fishing and hunting continued alongside
farming.

**What the scene should show.**

- One or two small farmsteads: a rectangular timber dwelling of roughly 4 by 6 m
  with a hearth, a store or byre, a fenced yard. Open, unfortified settlements
  increased in the Early Iron Age while some hillforts were abandoned
  (encyclopaedia entry 4946). No dwelling of this date has been excavated in the
  district, so the building form is a regional analogy and should be labelled so.
- Burn clearings sown with barley and some wheat among stumps, and birch regrowth
  on abandoned plots. The *līdums* props already built for era 2 are exactly
  right here.
- A few small cattle, sheep or goats, pigs and a pony-sized horse.
- A stone grave on a rise (section 3.3).
- The aurochs can stay as wild animals at the forest edge.

### 3.2 Forest composition

From the Ķūži sequence (Terasmaa et al. 2016; the Holocene core is also described
by Kangur et al. 2009, *Geological Quarterly* 53,
<https://gq.pgi.gov.pl/article/view/7513>):

- Spruce reached "its maximum postglacial abundance (32 %)" of pollen between
  5,200 and 2,600 cal BP, while alder, hazel, elm and lime declined slightly.
- Oak, elm and lime decreased between 4,000 and 2,500 cal BP.
- From 2,000 cal BP birch dominates, spruce and hazel decline and pine rises,
  with grasses, rye and charcoal.

So at AD 50 the upland carried **spruce-dominated mixed forest in the first
stages of being opened by fire**. A reasonable stem mix for the model:

| Position | Suggested mix | Model now |
| --- | --- | --- |
| Loamy moraine slopes, the bulk of the tile | Spruce 40 to 45 %, birch 20 to 25 %, pine 10 to 15 %, aspen 5 to 8 %, lime, elm, oak and ash together 5 to 8 %, with a hazel understory | Birch 34 %, spruce 26 %, pine 22 %, **oak 18 %** |
| Sandy or gravelly crests and kames | Pine 50 %, spruce 30 %, birch 20 % | Spruce 50 %, pine 35 %, birch 15 %, chosen by height above 215 m instead of by soil |
| Wet ground and lake shores | Black alder 50 %, birch 25 %, spruce 15 %, willow and bird cherry | Alder 55 %, birch 30 %, spruce 15 % (good) |
| Old burn plots | Birch, grey alder and aspen thicket with charred stumps | Not shown |

Specific points:

- **Oak at 18 % is far too high.** Pedunculate oak is near its northern limit on
  the Vidzeme Upland and was a few per cent of the pollen at most by this date. A
  single revered oak by the farm is fine. One tree in six is not. Reassign most of
  that share to spruce, aspen and lime.
- **Lime, elm, ash, aspen and hazel are missing as trees.** Small-leaved lime in
  particular was the main nemoral tree of the Latvian uplands.
- **"Bramble" is the wrong shrub.** True blackberries (*Rubus fruticosus* agg.)
  are essentially confined to western Latvia. The tangle in an upland spruce
  forest gap is raspberry (*Rubus idaeus*), with bird cherry, alder buckthorn and
  honeysuckle (recalled from the Latvian flora, not checked today). Rename the
  comment and tint the prop as raspberry.
- **Ox-eye daisy** is a plant of mown and grazed grassland, and its presence in
  Latvia before farming is doubtful. Once era 1 is drawn as a farmed landscape a
  thin scatter near the farm is acceptable. On the natural floodplain keep
  meadowsweet and buttercup.
- "Primeval" and "near-closed canopy" should be softened in the copy. The forest
  was old, but people had been burning plots in it for centuries.

### 3.3 Who lived here, and how they buried their dead

The upper Gauja and Piebalga district sits on the seam between two Early Iron Age
burial traditions, and the state of the debate should be put that way.

- **Stone graves (*akmeņu krāvuma kapi*, tarand graves).** Rectangular enclosures
  of large stones, built in rows and used for collective burials, mostly
  cremations with scattered bone. They are "extended in North Vidzeme and North
  Latgale mostly in the Roman Iron Age", and their bracelets are "mostly typical
  of the burial sites of the Baltic Finns" (Ciglis 2013). The encyclopaedia (G.
  Zemītis, entry 4946) assigns the stone-cairn cemeteries of northern Vidzeme,
  built as "four-cornered structures from large stones", to Baltic Finns related
  to the people of Estonia. Lang (2007, *The Bronze Age and Early Iron Age in
  Estonia*) is the standard account, and reads each grave as the burial place of
  a single farming household.
- **Barrows with stone circles (*uzkalniņi ar akmeņu riņķi*).** In southern
  Vidzeme, Zemgale and northern Lithuania the dead were buried unburnt under
  earth mounds, usually within a ring of stones, and the encyclopaedia assigns
  these to Balts (in Vidzeme, the "Gauja Semigallians"). The National History
  Museum singles out **Vecpiebalga Ezēni**, in the next parish, among the "early
  Iron Age and the first half of the middle Iron Age tumulus graves with a stone
  ring" that are "important for understanding" Semigallian, Latgalian and
  Selonian ethnic history (verified at
  <https://lnvm.gov.lv/en/museum-storage/museum-collection/archaeology-department/iron-age-medieval-and-early-modern-collections/riga-district-iron-age-to-early-modern-collection/>).
  The standard monograph is E. Šnore, *Agrā dzelzs laikmeta uzkalniņi Latvijas
  austrumu daļā* (1993).
- **The debate.** The traditional reading (Moora 1938, Šnore, Lang) equates stone
  graves with Finnic speakers and barrows with Balts. More recent work is
  cautious about reading language from grave form, sees the central Vidzeme
  upland as a mixed contact zone, and notes a "hidden" Finnic element that
  persists in eastern Latvia into the Middle Ages (H. Valk and colleagues,
  "Finnic language islands in eastern Latvia", *Journal of Estonian and
  Finno-Ugric Linguistics* 12(2), 2021,
  <https://ojs.utlib.ee/index.php/jeful/article/view/jeful.2021.12.2.04>, cited in
  the project's own notes and not re-read today).
- **For the model.** The copy "scattered Baltic and Finnic groups are known mostly
  from their graves" is fair. The scene should show one of those graves. At
  Taurene itself the attested type is the stone grave (Gailīši, and the "stone"
  names of the neighbouring cemeteries): a low rectangular setting of granite
  boulders, a few enclosures of roughly 4 to 8 m joined side by side, standing
  0.3 to 0.6 m high and filled with smaller stones, on a hillock near the fields.
- **A correction to `research/iron-age-settlement.md`.** It treats "Lībiešu
  apmetne" and "Lejas Lībiešu senkapi" as a documented Livonian settlement and
  burial ground. Those are simply named after the farmsteads Lībieši and Lejas
  Lībieši. The farm name is suggestive, but the register gives no ethnic
  attribution, only "Early Iron Age" and "Iron Age". The same file cites
  Grokipedia for "Taurene Gailisi". Ciglis (2013) is the proper source for that
  site.

### 3.4 The barrows are in the wrong era

The write-up says "The barrows enter the landscape in this era [AD 950] and
persist ... they are absent from the earlier wilderness". The evidence runs the
other way. In this part of Vidzeme **round barrows with stone rings belong to the
Early and early Middle Iron Age (AD 1 to about 600)**, as at Vecpiebalga Ezēni,
and the Late Iron Age norm is the flat cemetery (section 4.3). If the round
mounds are kept anywhere, they belong in era 1, each with a kerb of boulders,
and they would be six to nine centuries old and grass-grown by AD 950.

### 3.5 Large mammals

- **Aurochs and European bison.** Direct evidence from Iron Age Latvia exists, and
  the project's research brief says there is none. At Padure hillfort, 16 bones
  from the Late Bronze and Early Iron Age layer and 33 bones (at least three
  animals) from the Middle to Late Iron Age layer are identified as "bison/aurochs
  (*Bison bonasus*/*Bos primigenius*)", several with cut marks and one sawn horn
  core (Daugnora et al., link above). A search summary of Vasks' report on the
  site says they made up half of all wild animal bones there, which I did not
  check in the original. Two cautions follow. The
  identification does not separate aurochs from bison, and Padure is in Kurzeme,
  about 230 km west. So large wild cattle were certainly still hunted in Latvia in the
  first millennium AD, and a herd in Vidzeme at AD 50 is defensible. I found no
  directly radiocarbon-dated Latvian aurochs later than the Stone Age, and no
  single "latest Latvian aurochs" date seems to be published. The honest caption
  is "wild cattle, aurochs or bison". A few European bison would be at least as
  well supported as the aurochs, and the word *taurs* in place-names cannot
  distinguish them with certainty.
- **Aurochs dimensions.** Bulls at 1.75 m and cows at 1.50 m at the shoulder are
  within the published range for Holocene northern European aurochs.
- **Elk, red deer, brown bear, beaver, wolf, fox, marten, hare:** all are in the
  Padure Iron Age bone lists (verified). Elk, red deer, beaver, wolf and fox are
  already in the model. **Brown bear, lynx and pine marten are missing** and
  should be added to both Iron Age eras.
- **Wild boar** is not in the Padure lists. It was present in Latvia in the Iron
  Age but is thought to have been much scarcer than today (recalled). Five boar in
  one sounder is acceptable. Keep the number modest.
- **Roe deer** was present but at low density in dense spruce forest. Four is
  fine.
- **Brown hare.** Padure reports "*Lepus europaeus*", but separating it from
  mountain hare on fragments is hard, and the brown hare is generally regarded as
  a late arrival that spread with open farmland. In heavy forest at AD 50 the
  default hare is the **mountain hare** (*Lepus timidus*), which is grey-brown in
  summer. Swap the species, or at least the label.
- **Wild horse.** Not shown, and rightly so. Horse bones in Latvian Iron Age
  sites are treated as domestic.
- **White stork** is absent from eras 1 and 2, which is correct.

---

## 4. Era 2: ~AD 950

### 4.1 Was this Latgalian country by 950?

Yes, on current evidence, with the usual caution about putting ethnic labels on
graves.

- The encyclopaedia (entry 4946): Latgalian and Selian groups form in the east in
  the Middle Iron Age, and in the Late Iron Age Latgalians expand, "pushing the
  Baltic Finns out of northern Vidzeme", with Latgalian monuments as far as
  Trikāta, Vijciems and Gaujiena. All ten known lake dwellings lie "around the
  Central Vidzeme Upland", and Āraiši is their type site.
- The register lists a ring of **Middle to Late Iron Age cemeteries** around
  Taurene: Nēķina senkapi (inside the tile), Krustiņu senkapi (75 m beyond the
  north edge), Elku kalna senkapi, Urbju, Bumbu, Lejasģibuļu, Tašķēnu and
  Vecpiebalgas senkapi. It also lists **Late Iron Age hillforts** at Bānūži,
  Dzērbene (Augstais kalns) and Vecpiebalga (Griškas kalns), and Late Iron Age
  settlement sites at Lake Alauksts (Cepļi) and Tauns. That is direct evidence of
  a settled district with burial continuity from about the fifth century.
- Excavated Latgalian cemeteries of the period in the Gauja basin are Drabešu
  Liepiņas (9th to 12th century, beside Lake Āraiši) and Priekuļu Ģūģeri.
- In the thirteenth century the district belonged to Tālava, "a Latgalian country
  in northern Vidzeme and northern Latgale" (<https://en.wikipedia.org/wiki/T%C4%81lava>,
  verified). The 1224 partition treaty of Tālava is usually quoted as naming
  *Prebalge* (Piebalga) among the lands divided. That detail is **recalled** and
  should be checked in *Latvijas vēstures avoti* II or in Švābe before quoting.
- None of the Taurene sites has a published excavation that I could find, so
  "Latgalian" for this parish is a regional attribution, which is how the model
  already words it.

### 4.2 The hillfort

**Lejstupu pilskalns, also Brēdiķu pilskalns** (register no. 585). The model
spells the alias "Briediņu". The register and the hillfort database both give
**Brēdiķu**, after the farm Brēdiķi. Correct the spelling in `WRITEUP.md`,
`landuse.js` and `research/iron-age-settlement.md`.

- **Register record** (verified, <https://api.mantojums.lv/api/culturalObjects/585>,
  public page <https://mantojums.lv/cultural-objects/585>): regional significance,
  dating "Dzelzs laikmets" with no finer phase, location "pie Brēdiķiem un
  Lejstupiem", condition satisfactory, not open to the public, cadastre parcels
  42860020091 and 42860020225. The record has no description text.
- **Position.** Register centre point 57.150747 N, 25.647753 E. The hillfort
  database gives 57.15094 N, 25.64776 E. In scene metres that is about
  **x = −1024, z = +946 to +968**. The model has it at x = −1080, z = +820, which
  is about **135 to 160 m too far north-west** and outside the registered polygon.
- **Shape and size** (<https://www.latvijas-pilskalni.lv/lejstupu-pilskalns/>,
  verified, measured from LiDAR): "elongated, curved", long axis north-east,
  **175 m long, 113 m wide, 12 m high, with a single plateau of 118 by 64 m**. It
  stands on the shore of Dabaru ezers and on the bank of the Gauja. No ramparts,
  ditches or terraces are recorded. Damage: pits and traces of farming. Partly
  overgrown, privately owned. Archaeological investigation: none. Dating: none
  beyond the register's "Iron Age".
- **What follows for the model.**
  1. Move it to the registered position and check it against the 1 m LiDAR.
  2. A neat circular palisade 34 m across does not fit a curved plateau of 118 by
     64 m. If a palisade is drawn it should follow the plateau edge, roughly 300
     m of fence, or enclose only the highest end.
  3. The site has never been excavated and has no visible earthworks, so a
     standing palisade with three buildings at exactly AD 950 is conjecture. The
     hillfort in the parish that the register does date to the Late Iron Age, and
     that does have a rampart, a ditch and terraces, is **Bānūžu pilskalns**, 4.4
     km west and outside the tile. The copy should say that Lejstupu is a
     registered Iron Age hillfort of unknown phase, shown here as a refuge.
  4. Because the dating is simply "Iron Age", the hill could equally have been in
     use at AD 50. A light fence or nothing at all in era 1 would be equally
     honest.
  5. The 1935 scene lights a Jāņi fire "on the old fort hill". That is outside my
     scope, but it will need to move with the hill.
- **Other hillforts.** Silenieku pilskalns (no. 590) is inside the tile near its
  east edge: 57.144218 N, 25.731397 E, scene x ≈ +4025, z ≈ +1695. It is oval,
  long axis north-west, 134 by 80 m, 8 m high, with a plateau of 52 by 26 m,
  fully overgrown and partly quarried away, on state land, unexcavated, dated
  "Iron Age" (<https://www.latvijas-pilskalni.lv/silenieku-pilskalns/>, verified).
  The model does not show it, and it should at least exist as a wooded knoll.
  Bānūžu pilskalns (no. 580), semicircular, 104 by 92 m and 14 m high, with a
  plateau of 50 by 59 m, one rampart and one ditch, described by Brastiņš in
  *Latvijas pilskalni 4: Vidzeme* (1930), is 5.5 km west of the origin
  (<https://www.latvijas-pilskalni.lv/banuzu-pilskalns/>, verified). The same
  database lists a "Gaviltu kalns" about 6.7 km north-east of Lejstupu, which by
  that bearing is outside the tile to the north. I could not get its record.

### 4.3 Burial customs: flat cemetery, not fresh barrows

- The encyclopaedia (Zemītis, entry 4946, verified): the typical Latgalian burial
  is the **flat cemetery**, of which "more than 200" are known, with **men laid
  with the head to the east and women with the head to the west**. Barrows appear
  "alongside flat graves from the 10th century", and about 50 barrow cemeteries
  with some 4,000 mounds are recorded.
- Those Late Iron Age barrow fields are a feature of the **eastern** Latgalian
  area, meaning Latgale and north-eastern Vidzeme. The English summary the project
  already cites says "about 80 flat cemeteries of Western Latgalian origin have
  been excavated" against "about 15" eastern barrow cemeteries, and the Gauja
  cemeteries it names, Drabešu Liepiņas and Priekuļu Ģūģeri, are flat
  (<https://en.wikipedia.org/wiki/Latgalians>, verified). The monograph is A.
  Radiņš, *10.–13. gadsimta senkapi latgaļu apdzīvotajā teritorijā* (1999). A
  University of Latvia thesis on twelve Late Iron Age Latgalian barrow cemeteries
  exists at <https://dspace.lu.lv/handle/7/59942>, but the repository refused
  access, so I could not confirm whether any of its sites is near Piebalga.
- The register calls the local Middle to Late Iron Age sites simply *senkapi*
  ("ancient cemetery"). It does not call any of them *uzkalniņu kapulauks*
  ("barrow field"), which is the term it uses when mounds are present.
- **Conclusion.** For a tenth-century farm in central Vidzeme the right picture
  is a **flat inhumation cemetery**: a cleared sandy rise with no mounds, graves
  in loose rows on an east to west axis, perhaps low wooden markers, on a slope
  near water (Radiņš's siting rule, quoted in the project's own notes). Seven
  fresh hemispherical mounds with boulders on top is the eastern Latgalian or the
  much older Early Iron Age picture. A single new mound beside a flat cemetery
  could be defended as "the new fashion arriving". Seven cannot.
- **Put it on the real site.** The model's cemetery is at an invented spot about
  300 m south-east of the invented farm. A registered Middle to Late Iron Age
  cemetery lies inside the tile only 600 m north of the origin: **Nēķina senkapi**
  (no. 581), centre 57.164952 N, 25.667855 E, scene x ≈ +189, z ≈ −614, at the
  junction of the Cēsis to Vecpiebalga and Taurene to Dzērbene roads. Its
  registered area is large, about 440 by 220 m. Moving `LOC.BARROWS` there, as a
  flat cemetery, replaces a guess with a monument.
- **Later eras.** `barrowMounds(BUMPS, 0.9)` and `0.82` in 1860 and 1935 keep the
  invented mounds as eroded earthworks. They should go with the era 2 mounds.
  What a walker really finds on these hills in 1860 and 1935 are the small
  medieval and early modern hilltop graveyards the register lists, *Kapu kalniņš*
  and *Kapu kalns*, such as Bērcēnu, Zaļkalnu, Gambu, Dunkupes and Andrupu.

### 4.4 Houses, and whether Āraiši transfers to dry land

- Āraiši: a platform of about 40 by 40 m, about 150 buildings over five phases,
  dwellings "with an internal area of up to 30 m²", and two wall techniques. One
  is horizontal logs with projecting notched corners. The other, older one is
  horizontal timbers slotted between paired uprights. Logs were pinned with oak
  pegs and caulked with moss, tow or straw. Roofs were low gables with massive
  ridge logs. Dwellings often had smaller attached utility rooms. Population 50
  to 90 (<https://medievalheritage.eu/en/main-page/heritage/latvia/araisi-open-air-museum/>,
  verified). EXARC, citing Apals and Zelmenis (1998), gives house areas of **10 to
  30 m²** with three to eight people each
  (<https://exarc.net/questions/how-many-people-lived-lake-fortress-lv>).
- So the main dwelling at 5 by 6 m (30 m²) is at the very top of the range, and
  the write-up's "about thirty square metres" overstates the typical house. Say
  "ten to thirty square metres" and consider 4 by 5 m for the neighbours.
- **"The clay stove at the centre of the room"** is not supported by anything I
  could open. Apals's publications describe hearths and clay or stone ovens, and
  as I recall them the oven usually stood in a corner beside the door, with open
  hearths more central in the earliest phase. That is **recalled**. Check J. Apals,
  *Āraišu ezerpils* (2012), or change the wording to "a clay oven or hearth inside
  the single room".
- **Transfer to a dry-land farm.** The log technique itself is not peculiar to
  lake dwellings. Horizontal log buildings are reported from Late Iron Age
  hillforts and open settlements in eastern Latvia. What does not transfer is the
  layout: Āraiši is a packed, planned, fortified row settlement on a platform,
  and no open Late Iron Age farmstead has been excavated in the Piebalga district.
  The model's loose yard is ethnographic back-projection. The evidence line
  already admits this, which is the right level of honesty. On dry mineral soil
  the buildings would sit on sill stones or straight on the ground, with earth
  floors.
- **The granary on posts.** Raised storehouses are an ethnographic form. Āraiši
  has "economic extensions" and outbuildings on the platform, and I found no
  published post-raised granary from a Latvian Late Iron Age site. The write-up
  presents "the granary raised against damp and mice" as coming "from Āraiši".
  Reword it as an inference.
- **Straw thatch.** The granary uses `thatchGable`, and one cabin and half the
  neighbours use `thatchGableOld`. The Āraiši reconstructions use bark, turf and
  split timber. Straw thatch needs long rye straw in quantity, which fits the
  eleventh century onward better than 950. Prefer bark, turf or reed for era 2.
- **Dating statements.** The Āraiši pollen study and the museum summary put the
  foundation of the lake dwelling at about AD 780. The project cites Meadows et
  al. for a felling date of AD 835. The two refer to different things, and the
  copy should not imply that the whole settlement dates from 835.

### 4.5 Crops and fields

- Pollen. At Āraiši cereal pollen (wheat and rye) appears after AD 400, and "the
  most significant changes ... occurred with the establishment of the
  lake-dwelling around AD 780 when the immediate surroundings of the lake were
  cleared for agriculture" (Stivriņš et al. 2015, abstract verified). At Ķūži,
  rye pollen, grasses, sorrel and charcoal layers run from 2,000 cal BP.
- Crop list. Barley was the staple cereal of the Latvian Iron Age, with wheat
  (emmer and bread wheat), rye, oats, peas, broad beans, turnip, flax and hemp.
  Rye was present and rising, but winter rye as *the* bread grain belongs to the
  eleventh to thirteenth centuries (recalled from Rasiņš and Tauriņa's
  archaeobotany of Latvian sites, not opened today). The model's fields of
  barley, rye and flax are therefore fine as drawn, with barley most common. The
  statement in `research/baltic-iron-age.md` that rye was "the dominant crop" at
  Āraiši, with barley only "a little", should not be relied on without the
  primary source, and I would not repeat it on the site. Add a small plot of peas
  or beans, and hemp by the yard.
- Field system. *Līdumi* with stumps and clearance cairns are right, and the
  charcoal record supports them. By the tenth century a long-lived farm would also
  have a small **permanent infield** beside the yard, manured and worked with an
  ard, and scythe-mown hay meadow on the floodplain. The encyclopaedia dates ard
  cultivation from the sixth century and the forked ard with iron shares from the
  eleventh. So two kinds of field are needed: stumpy burn plots out in the forest,
  and one or two stump-free plots of irregular shape by the houses. Three-course
  strip fields would be an anachronism, and the model rightly keeps them for 1860.
- Clearance cairns at the plot edges are plausible but cannot be dated.

### 4.6 Livestock, poultry, cats and bees

- **Sizes.** Cattle at 1.05 m, sheep at 0.60 m, pigs at 0.62 m and horses at 1.30
  m at the shoulder are all consistent with Iron Age Baltic stock. The Padure
  assemblage gives the species balance for a Middle to Late Iron Age Latvian
  site: 407 cattle bones (12 animals), 224 sheep or goat (11), 116 pig (9), 49
  horse (3). The model's four cattle, five sheep, two pigs and two horses is a
  good match.
- **"Tarpan".** The key `horseTarpan` and the dun coat are fine for a small
  domestic forest horse. Do not call it a tarpan in visible copy, since these were
  domestic animals.
- **Goats and dogs are missing.** Goats are in every assemblage, lumped with
  sheep. Dog is in the Padure list (*Canis familiaris*). Add a dog to the yard and
  two or three goats to the flock.
- **Chickens: right.** The Padure Middle to Late Iron Age layer includes
  "Phasianidae family, *Gallus gallus domesticus*" (verified), so domestic fowl
  are attested in Iron Age Latvia itself. The project's research note says the
  question "has not been addressed" for Latvia, and it can be updated. For
  Estonia, Rannamäe et al. (2021), already cited, date the earliest hen bone to
  about 200 BC to AD 5, with regular keeping by the Viking Age. A handful of small
  birds is correct.
- **Cats: none are shown, and that is the safe choice.** I could not find a dated
  domestic cat from a Latvian or Estonian site of this period. In Denmark cats are
  rare before the Viking Age, and in Poland they are present from the Roman
  period (Krajcarz et al. 2022, *Antiquity*, <https://doi.org/10.15184/aqy.2022.128>).
  A cat on a rural upland farm at 950 would be unsupported.
- **Geese** are not shown in era 2. The Padure birds include Anserinae, wild or
  domestic. Leave them out.
- **Beehives: change them.** Two upright log hives with thatch caps standing in
  the yard are the nineteenth-century farm apiary. Tenth-century beekeeping in
  Latvia was **tree beekeeping** (*dravniecība*): bees kept in cavities cut high
  in living pines and oaks (*dores*), closed with a board, marked with the owner's
  sign, and climbed with a rope and seat (*dzeinis*). The museum summary of Āraiši
  lists beekeeping among the main activities, and the write-up itself says "forest
  beekeeping" while the scene shows yard hives. The earliest written evidence is
  the Chronicle of Henry of Livonia, which records Letts of the Cēsis district
  quarrelling with the Sword Brothers over fields and bee trees early in the
  thirteenth century (chapter XVI.3 as I recall it; **recalled**, check in
  Brundage's translation). Replace the two hives with two or three marked bee
  trees at the forest edge, each with a small boarded cavity 4 to 8 m up.

### 4.7 Other objects

- **Log bridge over the Gauja.** A felled-trunk footbridge on a river 10 to 19 m
  wide is feasible but is not evidenced. A ford or a dugout crossing is the safer
  choice.
- **Wattle fences, haystacks, dugout.** No objection. Mown hay implies scythes,
  which are attested.
- **Sacred oak with offerings.** Generic but reasonable. The registered cult site
  in the parish is the Bānūžu Svētavots spring (no. 582), 5.7 km west and outside
  the tile.

---

## 5. Registered archaeological monuments, with coordinates

Source: the National Heritage Board register, read through its public API on
2026-11-10 (`https://api.mantojums.lv/api/culturalObjects/<number>`, public page
`https://mantojums.lv/cultural-objects/<number>`). Each record carries a centre
point, a polygon for the monument itself and a protection zone polygon. The
official list is also published as open data at
<https://data.gov.lv/dati/dataset/valsts-aizsargajamo-nekustamo-piemineklu-saraksts>.
None of these records has a description text, and none of the sites has a
published excavation that I could find. "Extent" is the largest distance from the
polygon centroid to a vertex.

### 5.1 Inside the 8.8 km tile

| No. | Name | Type and register dating | Centre, WGS84 | Scene x, z (m) | Extent | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 585 | Lejstupu pilskalns (Brēdiķu pilskalns) | Hillfort, "Iron Age" | 57.150747, 25.647753 | −1024, +968 | 109 m | West shore of Dabaru ezers. Plateau 118 x 64 m, 12 m high, no recorded ramparts. Model has it at −1080, +820. |
| 581 | Nēķina senkapi | Cemetery, Middle to Late Iron Age | 57.164952, 25.667855 | +189, −614 | 269 m | At the Cēsis–Vecpiebalga and Taurene–Dzērbene road junction. The best candidate for the era 2 cemetery. |
| 592 | Zaļkalnu senkapi (Kapu kalns) | Cemetery, Late Iron Age to modern | 57.143631, 25.667785 | +185, +1760 | 165 m | Two separate polygons, see below. |
| 590 | Silenieku pilskalns | Hillfort, "Iron Age" | 57.144218, 25.731397 | +4025, +1695 | 84 m | 134 x 80 m, 8 m high, plateau 52 x 26 m, partly quarried. Not in the model. |
| 584 | Bērcēnu viduslaiku kapsēta | Cemetery, medieval to modern | 57.168015, 25.681021 | +984, −955 | 63 m | |
| 586 | Gambu viduslaiku kapsēta (Kapu kalniņš) | Cemetery, medieval to modern | 57.109785, 25.695266 | +1844, +5528 | 22 m | Near Brezģis and Brežģa kalns. |
| 587 | Dunkupes viduslaiku kapsēta (Kapu kalniņš) | Cemetery, medieval to modern | 57.105449, 25.728476 | +3849, +6010 | 27 m | "At the gravel pits". Right on the south edge. |
| 583 | Andrupu viduslaiku kapsēta | Cemetery, medieval to modern | 57.105260, 25.611669 | −3203, +6031 | 50 m | Right on the south edge. |
| not registered | Gailīšu stone-grave cemetery | Stone graves, mid to late 1st century AD (Ciglis 2013) | farm Gailīši: 57.10585, 25.72212 | +3465, +5966 | unknown | Farmstead position only. The cemetery's own location is not published online. |

Monument polygons for LiDAR work, as latitude,longitude pairs:

- **585 Lejstupu pilskalns:** 57.151349,25.647231; 57.151497,25.647902;
  57.151404,25.648895; 57.151167,25.649138; 57.150188,25.648565;
  57.149996,25.647630; 57.150073,25.646513; 57.150631,25.646381;
  57.150750,25.646745. In scene metres: (−1056, 901), (−1015, 884), (−955, 895),
  (−941, 921), (−975, 1030), (−1032, 1051), (−1099, 1043), (−1107, 981),
  (−1085, 967).
- **581 Nēķina senkapi:** 57.164290,25.664205; 57.164382,25.664317;
  57.164650,25.664524; 57.165333,25.665017; 57.165713,25.665273;
  57.165959,25.668333; 57.165723,25.670215; 57.165389,25.671496;
  57.165079,25.670995; 57.164521,25.670097; 57.164651,25.669667;
  57.164709,25.669413; 57.164780,25.668950; 57.164780,25.668232;
  57.164727,25.667712; 57.164542,25.666924; 57.164317,25.666206;
  57.164039,25.665493; 57.163976,25.665070; 57.164023,25.664796. Scene bounding
  box: x −31 to +409, z −726 to −505.
- **592 Zaļkalnu senkapi,** eastern polygon: 57.143854,25.668765;
  57.144012,25.669936; 57.143329,25.670111; 57.143165,25.668927 (scene x 244 to
  325, z 1717 to 1812). Western polygon: 57.144050,25.665464;
  57.144103,25.666135; 57.143712,25.666070; 57.143689,25.665500 (scene x 45 to
  85, z 1707 to 1753).
- **590 Silenieku pilskalns:** 57.144282,25.730219; 57.144626,25.730777;
  57.144507,25.731847; 57.144111,25.732572; 57.143839,25.732306;
  57.143820,25.731282; 57.144024,25.730285.
- **584 Bērcēnu kapsēta:** 57.167534,25.681251; 57.167711,25.680454;
  57.168003,25.680331; 57.168377,25.680624; 57.168493,25.680975;
  57.168053,25.681550; 57.167735,25.681697.

### 5.2 Just outside the tile (within about 2 km of an edge)

| No. | Name | Type and register dating | Centre, WGS84 | Scene x, z (m) | Position |
| --- | --- | --- | --- | --- | --- |
| 438 | Krustiņu senkapi (Mantas kalniņš), Dzērbenes pag. | Cemetery, Middle to Late Iron Age | 57.184369, 25.621021 | −2638, −2775 | 75 m beyond the north edge. Its protection zone reaches into the tile. |
| 588 | Lejas Lībiešu senkapi (Akmeņkalns) | Cemetery, **Early Iron Age**, state significance | 57.149664, 25.594451 | −4242, +1088 | 340 m beyond the west edge |
| 589 | Lībiešu apmetne | Settlement, "Iron Age", state significance | 57.143484, 25.597685 | −4047, +1776 | 150 m beyond the west edge. Polygon 155 m in extent. |
| 591 | Jaunruntu viduslaiku kapsēta (Kauliņkalns) | Cemetery, medieval to modern | 57.126576, 25.750695 | +5190, +3658 | 290 m beyond the east edge |
| 478 | Šinku senkapi (Akmens kapi), Kaives pag. | Cemetery, **Early Iron Age**, state significance | 57.097347, 25.614991 | −3002, +6912 | 810 m beyond the south edge |
| 606 | Jaunvīļumu senkapi (Velna klēpis), Vecpiebalgas pag. | Cemetery, **Early Iron Age**, state significance | 57.094158, 25.685815 | +1274, +7267 | 1.2 km beyond the south edge |
| 607 | Jaunvīļumu viduslaiku kapsēta (Kapu kalniņš) | Cemetery, Middle to Late Iron Age | 57.092085, 25.685393 | +1248, +7498 | 1.4 km beyond the south edge |
| 603 | Cepļu apmetne I, II | Settlement, "Iron Age", on Lake Alauksts | 57.091388, 25.741995 | +4665, +7576 | 1.5 km beyond the south edge |
| 618 | Saulgožu senkapi (Velna kreklājs) | Cemetery, **Early Iron Age**, state significance | 57.088385, 25.695754 | +1874, +7910 | 1.8 km beyond the south edge |
| 481 | Urbju senkapi, Kaives pag. | Cemetery, Middle to Late Iron Age | 57.087420, 25.647104 | −1063, +8017 | 1.9 km beyond the south edge |

### 5.3 The rest of Taurenes pagasts and the nearest dated hillforts

| No. | Name | Type and register dating | Centre, WGS84 | Scene x, z (m) |
| --- | --- | --- | --- | --- |
| 580 | Bānūžu pilskalns | Hillfort, **Late Iron Age**, state significance. One rampart, one ditch, terraces. | 57.152891, 25.574422 | −5451, +729 |
| 582 | Bānūžu Svētavots – kulta vieta | Sacred spring, Late Iron Age to modern | 57.157221, 25.571031 | −5656, +247 |
| 432 | Augstais kalns – pilskalns, Dzērbene | Hillfort, Late Iron Age, state significance | 57.193294, 25.679130 | +870, −3769 |
| 436 | Ķētu pilskalns, Dzērbenes pag. | Hillfort, "Iron Age", state significance | 57.213777, 25.719153 | +3286, −6049 |
| 435 | Elku kalna senkapi, Dzērbenes pag. | Cemetery, Middle to Late Iron Age | 57.214970, 25.609136 | −3356, −6182 |
| 623 | Vecpiebalgas pilskalns (Griškas kalns) | Hillfort, Late Iron Age, state significance | 57.059113, 25.826027 | +9738, +11168 |

The parish count of thirteen archaeological monuments (nos. 580 to 592) in the
write-up is correct. One wording point: Lejstupu pilskalns is on the
state-protected list as a monument of *regional* significance, and the monuments
of *state* significance in the parish are nos. 580, 588 and 589.

---

## 6. Anachronisms and smaller points, all eras

**Plants**

- Era 0: no trees at all (should have sparse stunted spruce, pine and tree birch),
  no willow, shrubs too tall. No sea buckthorn or wormwood steppe.
- Eras 1 and 2: oak heavily over-represented, and lime, elm, ash, aspen and hazel
  absent as trees. "Bramble" should be raspberry. Ox-eye daisy is doubtful on the
  unfarmed floodplain of era 1.
- Era 2: the same forest recipe as era 1. After nine centuries of burning there
  should be more birch, pine, grey alder and aspen regrowth around the farms and
  less old spruce.
- Apple trees and manor lindens are correctly confined to 1860 and later. Small-
  leaved lime is native and can be used as a forest tree in the early eras.
- The riverside willows are fine: native *Salix* species.

**Animals**

- Era 0: "arctic hare" should be mountain hare. White winter coats on a summer
  day. The elk is doubtful. Mammoth is wrongly ruled out by implication.
- Era 1: brown hare should be mountain hare. Bear, lynx and marten are missing.
  "Aurochs" should be "aurochs or bison".
- Era 2: no dog and no goats. Log hives in the yard.
- Whooper swans, cranes, kingfisher, goosander, goldeneye, grey heron, otter,
  beaver, grayling, brown trout, pike, perch, roach and bream are all native and
  unobjectionable in eras 1 and 2. Putting no fish in the era 0 ponds is right.
- Mute swan and white stork gating is right.

**Objects and text**

- Era 0: exposed clean ice blocks, a "milky meltwater" river, "ice edge" in a
  comment, modern lake levels.
- Era 1: the lean-to as the only settlement, no fields, no livestock, no grave.
- Era 2: seven fresh barrows, a circular palisade on a mis-sited hill, post
  granary and central stove presented as Āraiši facts, straw thatch.
- Sources list: [21] merges two different publications, and the Stivriņš paper
  concerns western Latvia. [13] (Wikipedia, Latgalians) carries the burial claim
  and should be replaced by encyclopaedia entry 4946 and Radiņš 1999. [15] should
  cite the journal DOI rather than an academia.edu copy. Add Ciglis 2013, Koff and
  Terasmaa 2011, Terasmaa et al. 2016, Veski et al. 2012, Heikkilä et al. 2009,
  Ukkonen et al. 2006, Berg-Hansen et al. 2019, Daugnora et al. (Padure) and the
  register API.

---

## 7. Ranked corrections

1. **AD 50 is a farming landscape, not a hunters' camp.** Replace the lean-to with
   a small farmstead, burn plots, livestock and a stone grave. Evidence: Gailīši
   stone graves in Taurene dated to the mid first century (Ciglis 2013), five
   registered Early Iron Age cemeteries within 8 km, and the onset of agriculture
   with charcoal at Lake Ķūži from 2,000 cal BP (Terasmaa et al. 2016).
2. **Swap the burial monuments between eras.** Round barrows with stone kerbs
   belong to the Early Iron Age here (Vecpiebalga Ezēni). At 950 the norm in
   central Vidzeme is a flat cemetery with men's heads to the east and women's to
   the west (encyclopaedia entry 4946). Put the era 2 cemetery on the real Nēķina
   senkapi and remove the mounds from 1860 and 1935.
3. **Move and reshape the hillfort.** Registered centre 57.150747 N, 25.647753 E
   (scene −1024, +968). Plateau 118 by 64 m, no recorded ramparts, unexcavated,
   phase unknown. Spell the alias Brēdiķu.
4. **Era 0 date and vegetation.** Relabel to about 10,500 BC. Add sparse stunted
   spruce, pine and birch, willow scrub and steppe herbs, and lower the dwarf
   birch (Koff and Terasmaa 2011, Veski et al. 2012, Heikkilä et al. 2009).
5. **Era 0 water and ice.** No glacial "milky" river. Buried, debris-covered dead
   ice with thermokarst ponds, not clean exposed blocks. Lakes not yet at modern
   size (Ķūži gyttja from 11,300 cal BP).
6. **Iron Age forest recipe.** Cut oak from 18 % to a few per cent. Add lime, elm,
   ash, aspen and hazel. Spruce dominant at AD 50, more birch and pine regrowth by
   950. Raspberry, not bramble.
7. **Beekeeping at 950.** Bee trees in the forest, not log hives in the yard.
8. **Era 0 fauna.** Mountain hare, summer coats, drop or justify the elk, allow
   for mammoth in the text (Ukkonen et al. 2006 and 2011).
9. **Iron Age fauna.** "Aurochs or bison" with the Padure evidence. Add bear, lynx
   and marten. Mountain hare in era 1. Add dog and goats in era 2.
10. **Āraiši details.** Houses 10 to 30 m², stove position unverified, post
    granary is inference, prefer bark or turf roofs to straw thatch, barley as the
    staple with rye rising.
11. **Add Silenieku pilskalns and the registered cemeteries** as terrain features.
12. **Fix the sources list** as set out in section 6.

---

## 8. Sources opened and read for this audit

- National Heritage Board register API, records 432 to 441, 477 to 481 and 580 to
  625: `https://api.mantojums.lv/api/culturalObjects/585` and siblings. Public
  site <https://mantojums.lv/>.
- Open data list of protected monuments:
  <https://data.gov.lv/dati/dataset/valsts-aizsargajamo-nekustamo-piemineklu-saraksts>
- Latvijas pilskalni database: <https://www.latvijas-pilskalni.lv/lejstupu-pilskalns/>,
  <https://www.latvijas-pilskalni.lv/silenieku-pilskalns/>,
  <https://www.latvijas-pilskalni.lv/banuzu-pilskalns/>
- G. Zemītis, "Dzelzs laikmets Latvijas teritorijā", Latvian National
  Encyclopaedia: <https://enciklopedija.lv/skirklis/4946>
- T. Koff and J. Terasmaa 2011, "The sedimentary sequence from the Lake Ķūži
  outcrop, central Latvia: implications for late glacial stratigraphy", *Estonian
  Journal of Earth Sciences* 60: 113 to 122. <https://doi.org/10.3176/earth.2011.2.05>
- J. Terasmaa et al. 2016, "Main drivers affecting the Holocene sedimentary
  record: implications from small lake in Latvia", *Baltica* 29: 63 to 78.
  <https://doi.org/10.5200/baltica.2016.29.07>
- S. Veski et al. 2012, "Lateglacial vegetation dynamics in the eastern Baltic
  region between 14,500 and 11,400 cal yr BP", *Quaternary Science Reviews* 40: 39
  to 53 (abstract).
  <https://research.lu.lv/en/publications/lateglacial-vegetation-dynamics-in-the-eastern-baltic-region-betw/>
- M. Heikkilä, S. Fontana and H. Seppä 2009, *Journal of Quaternary Science* 24:
  802 to 815 (abstract, and as quoted by Koff and Terasmaa).
  <https://doi.org/10.1002/jqs.1254>
- N. Stivriņš et al. 2017, "The final meltdown of dead-ice at the Holocene Thermal
  Maximum (8500–7400 cal. yr BP) in western Latvia", *The Holocene* (abstract).
  <https://doi.org/10.1177/0959683616683255>
- N. Stivriņš et al. 2015, "Landscape change in central Latvia since the Iron
  Age", *Vegetation History and Archaeobotany* 24: 377 to 391 (abstract only; the
  full text was not accessible). <https://doi.org/10.1007/s00334-014-0502-y>
- P. Ukkonen et al. 2006, "History of the reindeer (*Rangifer tarandus*) in the
  eastern Baltic region", *Boreas* 35: 222 to 230 (abstract).
  <https://doi.org/10.1080/03009480600578065>
- I. M. Berg-Hansen, H. Damlien and I. Zagorska 2019, "The northern fringe of the
  Swiderian technological tradition: Salaspils Laukskola revisited", *Archaeologia
  Baltica* 26: 12 to 31. <https://e-journals.ku.lt/journal/AB/article/785>
- J. Ciglis 2013, "The origin of burial sites in eastern Latvia consisting of
  typical stone graves", *Archaeologia Baltica* 19.
  <https://e-journals.ku.lt/journal/AB/article/1641/file/pdf>
- L. Daugnora, A. Vasks, S. Sovaitė and A. Girininkas, "Zooarchaeological material
  from the Padure (Beltes) hill-fort in Latvia", *Archaeologia Baltica*.
  <https://e-journals.ku.lt/journal/AB/article/982/file/pdf>
- Latvian National History Museum, archaeology collections page (Vecpiebalga
  Ezēni):
  <https://lnvm.gov.lv/en/museum-storage/museum-collection/archaeology-department/iron-age-medieval-and-early-modern-collections/riga-district-iron-age-to-early-modern-collection/>
- Āraiši summaries: <https://medievalheritage.eu/en/main-page/heritage/latvia/araisi-open-air-museum/>
  and <https://exarc.net/questions/how-many-people-lived-lake-fortress-lv>
- OpenStreetMap Nominatim, for the farmstead positions of Gailīši, Nēķins,
  Lejstupi and Ķūžu ezers.

Not accessible today, and worth obtaining: A. Radiņš 1999 on Latgalian cemeteries,
J. Apals 2012 *Āraišu ezerpils*, E. Šnore 1993 on Early Iron Age barrows, E.
Brastiņš 1930 *Latvijas pilskalni 4: Vidzeme*, Zelčs and Markots 2004, the full
text of Stivriņš et al. 2015, and the University of Latvia theses at
dspace.lu.lv on stone-setting cemeteries (handle 7/12640), Late Iron Age barrow
cemeteries (7/59942) and Late Iron Age dwelling sites in eastern Latvia (7/59934).
