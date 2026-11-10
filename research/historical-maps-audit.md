# Historical maps audit: Taurene / Nēķene square, 1839 to the 1980s

Compiled 2026-11-10. Scope: the 8.8 km model square (N 57.18369, S 57.10466,
W 25.60012, E 25.74589), with priority on Brežģis, the Nēķena manor core, and the
1860 and 1935 scenes.

Model coordinates below use the repo convention from `data/fetch-armymap.py`:
`x = (lon - 25.66472) * 60372`, `z = (57.15944 - lat) * 111360` (metres, x east,
z south).

## 0. What I actually opened, and what I did not

Almost everything here comes from the georeferenced tile layers behind
<https://vesture.dodies.lv/> (layer catalogue:
<https://vesture.dodies.lv/sources.json>). I stitched the tiles for the square and
read them by eye. The stitched crops are in the session scratchpad only, so the
recipe to reproduce any of them is the tile template plus the bounding box.

**Viewed directly (tiles stitched and read):**

| Map | Date as catalogued | Tile template | Max zoom |
| --- | --- | --- | --- |
| Rücker, *Specialcharte von Livland* 1:186k | 1839 | `https://home.dodies.lv/tiles/1839_specialarte_von_livland_186k/{z}/{x}/{y}.png` | 13 |
| Russian military 3-verst map | "1880" edition (survey is mid-century) | `https://home.dodies.lv/tiles/voenno_topo_3verstu/1880ru/{z}/{x}/{y}.png` | 13 |
| Russian 1-verst map 1:42k | "1905" | `https://tiles.dodies.lv/services/versta-42k/tiles/{z}/{x}/{y}.webp` | 15 |
| German "West. Osteuropa" 1:25k (German redrawing of the 1-verst sheet) | 1914 | `https://tiles.dodies.lv/services/west-osteuropa-25k/tiles/{z}/{x}/{y}.webp` | 15 |
| Latvian Army 1:75k, 1st edition | 1922-1934 | `https://tiles.dodies.lv/services/lva75k-1/tiles/{z}/{x}/{y}.webp` | 14 |
| *Latvijas ceļu un pagastu robežu karte* 1:300k | 1931 | `https://home.dodies.lv/tiles/1931_latvijas_celu_un_pagastu_robezu_karte_300k/{z}/{x}/{y}.png` | 12 |
| Deutsche Heereskarte 1:50k | 1943-45 | `https://tiles.dodies.lv/services/heereskarte-ostland-50k/tiles/{z}/{x}/{y}.webp` | 15 |
| Soviet General Staff 1:25k (SK-42 "O-grid") | undated, older than the 1:10k | `https://tiles.dodies.lv/services/genshtab/o-grid-25k/tiles/{z}/{x}/{y}.webp` | 15 |
| Soviet General Staff 1:10k ("C") | "1980" | `https://home.dodies.lv/tiles/genshtab_10k_c/{z}/{x}/{y}.png` | 16 |
| CORONA satellite | 1967 | `https://home.dodies.lv/tiles/corona/{z}/{x}/{y}.png` | 15 |
| LĢIA orthophoto, cycle 7 | 2019 | `https://tiles.dodies.lv/services/orto-7cikls/tiles/{z}/{x}/{y}.webp` | 16 |
| Swedish cadastral maps (Lodenhof, Serben, Pebalg) | 1680s-1690 | `https://home.dodies.lv/tiles/17gs_muizas/{z}/{x}/{y}.png` | 16 |

The viewer should open on a spot with a link of the form
`https://vesture.dodies.lv/#m=15/57.1124/25.7012&l=1v` (layer codes from
`sources.json`: `S` Rücker, `vo1` 3-verst, `1v` 1-verst, `wo` German 1914,
`lva75k` Latvian 75k, `dh3` Heereskarte, `gen5` Soviet 1:25k, `gen1` Soviet
1:10k). I did not test
that hash syntax in a browser.

I also used the site's machine-read label index
(<https://home.dodies.lv/vietvardi/manifest.json> plus one JSON per layer). Those
labels are OCR by language models, with errors such as "Корч. Брагжег". I used
them to find things, then confirmed every reading cited below on the tiles.

**Not viewable or not reached:**

- **Mellin, *Atlas von Liefland* 1798.** The dodies mosaic
  (`https://home.dodies.lv/tiles/1754_atlas_von_liefland/{z}/{x}/{y}.png`) covers
  the square only with the margin and cartouche of a neighbouring sheet. The
  Wenden sheet's neat line falls at about 25.52 E in that georeferencing, just
  east of "Sermus". The label index has no Nötkenshof entry near here. So I could
  not read the 1798 state. The owner should open the Kreis Wenden sheet
  ("Der Wendensche Kreis") from the LNB or EEVA scans directly.
- **Latvian Army 1:25k** (`LVARM_40_25k_v2`): no coverage. The layer's bounding
  box ends at 57.0 N. This is why `data/fetch-armymap.py` never produced
  `topo25_1930s.png`.
- **Latvian Army 1:75k 2nd edition (1934-40)**, **survey planšetes 1:5k (1930)**,
  **RKKA 1:50k (1940)**, **Luftwaffe aerial photos**: all blank over the square.
- **KDWR 1:100k**: not fetched.
- **zudusilatvija.lv and dom.lndb.lv**: both timed out from this network. I read
  the same LNB records and thumbnails through the Europeana API instead.
- **Raduraksti / LVVA revision lists**: not accessed (login and image browsing).
  The surname evidence below is from the published surname dictionary, not from
  the lists themselves.
- **periodika.lv**: not searched (JavaScript application).
- **Hagemeister 1836**: only poor Fraktur OCR on archive.org
  (<https://archive.org/details/materialienzuei00hagegoog>). The index gives
  "Jorslawe I. 199" and "Serben I. 5, 17, 196, 197", so the Nötkenshof entry is
  in volume I around pages 196 to 199. I did not get readable text. Hagemeister
  covers ownership, not buildings. **Stryk** and **Richter's 1909 address book**
  were not found in searchable form.

---

## 1. Brežģis / Brežģa krogs

### 1.1 What every map shows

| Map | Label | What is drawn |
| --- | --- | --- |
| Rücker 1839 | **Bregsche** | A tavern-type symbol (small flag) on the main road at a bend. No farm oval. I did not check the sheet's legend, so "tavern symbol" is my reading of the convention. |
| 3-verst (c. 1860s survey, 1880 print) | **Брегше** | One building rectangle on the road. The name is in the upright type used for named places. No "корчма" abbreviation. |
| 1-verst "1905" | **Корч. Брегже** | Two small buildings on the south side of the road, at the bend where a track leaves north to Kūlaskalns. |
| German 1914 | **Bregsche Kr.** | Same as the Russian sheet. |
| Latvian 75k, 1st ed. | **Brežgakrogs** | One hatched building on the south side of the road at the same bend. |
| 1931 road and parish map | **Bregšu kr.** | A point on the first-class road, inside the yellow boundary of *Taurenes pag.* |
| Heereskarte 1943 | **Brezgakrogs** | Building south of the road, a second small one north of it at the junction. |
| Soviet 1:25k | **Брежгакрог 4** | Hamlet of four households. Still on the main road. |
| Soviet 1:10k | **Брегжис** | Hamlet. The new highway now bypasses it to the south-west. |

No sheet shows a separate farmstead called Brežģi, Bresge or similar. On every
map from 1839 to 1943 the name belongs to the tavern alone. The neighbours are
Bebri, Andrēni, Ielaiņi, Gambas, Vīdokšas, Ļūdi, Gailīši and Kūlaskalns.

Local spelling is worth knowing: the parish library presentation writes
"Bregžu un Lāču krogos" and "Bregža kalns"
(<https://www.slideshare.net/Taurbiblio/laipni-ludzam-taurenes-pagastamd>, slides
9 and 36 to 39), which matches the map forms Bregsche / Брегше / Bregšu. The
"Brežģ-" order is the later standard form.

### 1.2 Location

The tavern site is the farm that OpenStreetMap now names **Vecbrežģis**
("Old Brežģis"), on the south side of the old road, 20 to 80 m west of the
Kūlaskalns turn-off.

| Source | Lat, lon | Model x, z |
| --- | --- | --- |
| 1-verst 1905, building symbol | 57.1121, 25.7014 | 2226, 5271 |
| Soviet 1:10k, long buildings SW of junction | 57.1125, 25.7016 | 2238, 5226 |
| 2019 orthophoto, same buildings | 57.1126, 25.7015 | 2232, 5215 |
| OSM dwelling "Vecbrežģis" (already in `geodata-osm.js`) | 57.11236, 25.70109 | **2196, 5243** |
| Wikipedia point for the hamlet Brežģis | 57.11194, 25.70361 | 2348, 5290 |
| Model today: `LOC.KROGS`, building drawn at K.x-16 | 57.1121, 25.7029 | 2304, 5272 |

The old sheets are georeferenced to roughly 50 to 120 m, so I trust the road
geometry more than the raw pixel: the tavern is at the bend, south side, just
west of the track north. That is Vecbrežģis. The model's tavern is about 100 m
too far east-south-east. Evidence strength: **mapped**. The identification of
the tavern with the surviving Vecbrežģis buildings themselves is **inferred**.

"Brežģu Pienotava" (57.11140, 25.70399, model 2371, 5350) is a house name in
OSM and a building on the Soviet 1:10k. It is not on the 1st-edition 75k sheet.
I found no source for a dairy there, or its date. The model's 1935 creamery is
therefore **inferred from a house name only**.

### 1.3 The road past the tavern (the important finding)

The main Cēsis to Vecpiebalga road ran **past the tavern door** on every map from
1839 to the Soviet 1:25k. It left today's P30 line near Bebri, climbed the north
flank of Brežģa kalns immediately beside the trig point (118.0 sazhens on the
Russian and Latvian sheets, 251.8 m on the 1943 sheet), ran east to the tavern,
then turned south-east through Vīdokšas and Ļūdi to Gailīši. The 1931 road map
colours it as a first-class road.

Today's P30 between Bebri and Gailīši is a **later bypass**, up to about 260 m
south-west of the old road. It is absent from the Soviet 1:25k and present on
the Soviet 1:10k, so it dates from the later Soviet decades. I could not date it
more closely.

The old road survives as OSM ways `447147093` (Brežģa kalns to Vecbrežģis) and
`812776432` (Brežģis to Vīdokšas to Ļūdi to Gailīši), both already in
`ROADS_OSM` as class 2 "unclassified".

Consequences in the current code:

- `osmRoadsForEra()` in `src/landuse.js` drops class-2 roads in era 3
  (`if (era === 3 && r.c === 2) continue;`) and keeps the P30 as the class-0
  main road in eras 3 and 4. So in 1860 the real road in front of the tavern is
  removed, and in both 1860 and 1935 the highway runs on a line that did not
  exist.
- The hand-drawn `SOUTH_ROAD` (points 700,2300 / 1150,3300 / 1480,4180 ...) is a
  conjectural second road 600 to 900 m east of the real one. No map I viewed
  shows it. In the 1860s the road to Brežģis was the same corridor as now:
  Ramdoti, Aprāni, Zelleskalns, Bebri.
- The comment above it ("The 1935 Army sheet shows no such parallel road: by
  then the improved highway (P30's predecessor) carried everything") has it
  backwards. The Army sheet's highway *is* the road through Brežgakrogs.

### 1.4 Which manor

Nötkenshof / Nēķene. The tavern lies well inside Taurenes pagasts on the 1931
parish-boundary map, and the parish history says the manor brewery's 25,000
buckets of ale a year were drunk "Bregžu un Lāču krogos" (slide 9, link above).
On Rücker 1839 the heavy boundary line to Lodenhof (Kirchspiel Schujen) runs
west of Jurkan and Bebber. Evidence: **mapped and documented**. I found nothing
tying it to Alt-Pebalg, Leimannshof or Serben.

### 1.5 When it appears and disappears

- Earliest sighting: **1839** (Rücker). Mellin 1798 could not be read (section 0).
- It is still labelled as a tavern in 1905, 1914, the 1920s, 1931 and 1943, and
  survives as the place name Брежгакрог on the Soviet 1:25k.
- When it stopped serving is not established. In 1937 to 1939 it was still the
  landmark from which theatre processions walked to Brežģa kalns ("gājieniem no
  Bregža kroga uz izrādes vietu", slide 38).

### 1.6 The surname

The Latvian Language Agency's surname dictionary (Vidzeme volume, built on the
1935 census and archival lists) has this entry
(<https://uzvardi.lv/surname/608487>):

> **Brežģis**, 23. Vidzemes uzvārds no Bērzaunes (18). 1826: Breſchge Bērzaunes
> dr. Sal. latv. izl. brežģis 'režģis – veidojums, kas radies, kam, piem.,
> zariem, savstarpēji savijoties, krustojoties'. Sal. arī vv. Brežģis, Brežģa
> kalns Taurenes pag.

In plain terms: 23 bearers in Vidzeme in 1935, 18 of them in **Bērzaune**
parish. The 1826 revision records the name as *Breschge* in the **Bērzaune
congregation** (Kirchspiel Bersohn, near Madona, about 40 km south-east of
Taurene). The dictionary derives it from a dialect word for a lattice or tangle
of interlaced branches, and only says "compare" the Taurene place names.

So the one documented 1826 attestation is at Bērzaune, not at Nötkenshof. The
model's working premise, that the family name comes from this tavern or hill, is
not supported by that source. It is not excluded either: the same rare word
could have named both, or a family could have moved. I did not open the 1826 or
later revision lists for Nötkenshof, Lodenhof, Serben or Alt-Pebalg, so I cannot
say whether a Breschge household was ever recorded here. That check needs
Raduraksti (LVVA fonds 199, revision lists by manor).

---

## 2. Nēķena / Nötkenshof manor ensemble

### 2.1 Positions of the surviving buildings

These names and positions are already in `src/geodata-osm.js`.

| Building (OSM name) | Lat, lon | Model x, z |
| --- | --- | --- |
| New manor house ("Nēķena muiža") | 57.16121, 25.66260 | -128, -197 |
| Old manor house ("Vecmuiža") | 57.16228, 25.66354 | -71, -316 |
| Manor granary ("Muižas klēts") | 57.16253, 25.66361 | -67, -344 |
| Brewery cellars ("Pagrabi") | 57.16190, 25.66283 | -114, -274 |
| Cattle shed ("Nēķina muižas kūts") | 57.15984, 25.66396 | -46, -45 |
| "Kaltu māja" (drying house) | 57.15890, 25.66190 | -170, 60 |
| "Pandera Šķūnis" (Pander's barn) | 57.15816, 25.66230 | -146, 142 |
| "Cieres" (ruin) | 57.15662, 25.66098 | -226, 314 |
| "Tožas" (old parish house, north bank) | 57.16368, 25.66341 | -79, -472 |
| "Kalēji" (smith's, west bank) | 57.16177, 25.65990 | -291, -259 |
| Gauja road bridge (from the Soviet 1:10k) | 57.1634, 25.6641 | -35, -442 |

The model has `LOC.MANOR` at (-40, -180), which is about 90 m east of the real
new manor house. More importantly it draws the **old manor house at
(Mn.x - 105, Mn.z - 15), west of the new one**. The real old house stands about
130 m **north** of the new one, beside the granary and above the bridge. In 1860
the old house should be the main house at its own site, and the new house's
site should be empty.

### 2.2 Dates

- **Old manor house**: "celta 18. gs." (slide 6). An ice cellar stood beside it.
  No closer date found.
- **New manor house**: architect Reinholds Georgs Šmēlings. Roof-raising on 13
  August 1888 (slides 43 and 44). The LNB record says "celta 19. gadsimta 80.
  gados Heinriham Panderam"
  (<https://www.europeana.eu/item/92085/16953>). The parish history adds that
  the 1905 revolution and the First World War held up the work and that the
  young owner Pauls von Pander died at the end of 1905 (slide 42). The repo's
  wording ("roof-raising 1888, no building work after 1900") is consistent.
  Absent in 1860, present in 1935. **Documented.**
- **Brewery**: "Iepretī pagrabiem pašā Gaujas krastā 19. gs. atradās alus
  darītava-brūzis" (slide 9), meaning it stood on the very bank opposite the
  cellars, with beer run to the cellars on rails. That puts it at about
  57.1619 N, 25.6622 E (model -150, -275), between the old and new houses. The
  maps label a brewery here: "Br." on the German 1914 sheet and **"Aldr."** on
  the Latvian 75k. After the reform Augusts Graudiņš bought it and it worked
  until it was blown up in 1944
  (<https://vecpiebalga.lv/lv/vecpiebalga/vecpiebalgas-apvieniba/pagastu-vesture/taurenes-pagasts/>).
  Present in 1935: **documented and mapped**. Present in 1860: **inferred**
  (no dated source before 1898).
- **Manor dairy and cheese-house**: "Muižas apbūves turpinājumā atradusies
  pienotava un siernīca" (slide 11). Undated.

### 2.3 The watermill (settled)

There **was** a manor watermill on the Gauja, but it was not at the road bridge.
It stood about **480 m downstream (east-north-east) of the bridge**, at the
place still called *Dzirnavas* and, on the Soviet maps, *Jaunmelderi*
("new miller's").

| Evidence | Detail |
| --- | --- |
| Rücker 1839 | Mill-type symbol on the river at Nötkenshof, next to the manor and tavern symbols. Legend not checked. |
| 3-verst | Asterisk (watermill) on the Gauja at the manor, and the farm name **Яунъ Мельдеръ** just north of the river. |
| Special-Karte von Mittel-Europa 1884 (label index only) | "Jaun-Melder". |
| 1-verst 1905 and German 1914 | Buildings on the river at this spot. |
| Latvian 75k | A clear **cog-wheel watermill symbol** on the Gauja, about 57.1632 N, 25.674 E. |
| Heereskarte 1943 | "M." (Mühle) on the Gauja here. |
| Soviet 1:25k and 1:10k | A broad pond on the Gauja from the bridge down to a dam at **Яунмелдери**, with a narrow channel below it. |
| OSM today | Addresses "Dzirnavas 1" (57.16346, 25.67214) and "Dzirnavas 2" (57.16397, 25.67101), with a pond. |
| LNB photographs 1980 and 1982, "Nēķena ūdensdzirnavas", R. Zalcmanis | <https://www.europeana.eu/item/92085/17073>, <https://www.europeana.eu/item/92085/17074>. A large fieldstone mill of two to two and a half storeys with brick-trimmed openings, a lower stone dwelling wing with dormers, and a timber bridge beside it. Roofless in part by 1980. |
| Parish history | Reform farms were created "uz Nēķena muižas un dzirnavu īpašnieka atņemtās zemes" (the land of the manor and of the mill's owner). |

Position for the model: **dam and mill at about 57.1634 N, 25.6721 E, model
(448, -448)**. The mill pond is the reach between the bridge and that dam. The
drop available is real: Dabaru ezers stands near 184 m and Taurenes ezers near
178 m.

What the model does now: a 0.8 m weir "at the road crossing by the manor", an
undershot wheel on the far bank, and a pond "about 600 m long above the road
crossing". The wide water above the bridge on the 75k sheet is the north arm of
Dabaru ezers narrowing to the bridge, not a mill pond. The note in
`research/maps/README.md` ("Mill pond at the manor confirmed") misread it.
Evidence for the corrected site: **mapped on six sheets, photographed,
documented by name**. Existence in 1860: **mapped** (3-verst).

### 2.4 The steam mill

A second mill stood about 600 m south of the manor, west of the highway:

- 1-verst 1905: a mill symbol and **"Пар. мук."** (steam flour mill).
- German 1914: **"D.M."** (Dampfmühle).
- Latvian 75k: **"Dzr."** at the same spot.
- Heereskarte 1943: a second "M." there.

Position about 57.1579 N, 25.6621 E (model -158, 171), plus or minus 60 m. That
is where "Kaltu māja" and "Pandera Šķūnis" stand today. It is **mapped** for
about 1905 to 1943, so it belongs in the 1935 scene. It is not on the 3-verst
map and steam mills on Livonian estates are a later-century thing, so leave it
out of 1860 (**inferred absence**).

`research/maps/README.md` reads this label as "Dabari Dz. sits by the small lake
NW". That is wrong. "Dzr." belongs to this steam-mill site on the east bank.
"Dabari" is just the farm name across the water.

### 2.5 Windmill

The Dabari farm symbol (57.158 N, 25.647 E) carries a crossed-sails mark on the
1-verst, German 1914 and Latvian 75k sheets. That is the usual windmill sign,
but at this scale I am not certain of the reading. Treat a windmill at Dabari as
**possible, mapped but ambiguous**. No windmill is marked at the manor itself.

### 2.6 The crossroads tavern and the parish house

- The 1-verst 1905 sheet marks **"Корч."** (tavern) at the crossroads on the
  north bank just west of the bridge, and **"Вол. Прав."** (parish
  administration) beside it to the east. The German 1914 sheet has "(A.V.)" in
  the same place. Rücker 1839 already shows a tavern-type symbol at Nötkenshof.
- LNB photograph, 1932: **"Taurenes krogs pirms pārbūves"**
  (<https://www.europeana.eu/item/92085/9093>). A long, low fieldstone tavern
  with a two-storey middle section, a carriage-shed wing with an arched gateway,
  and a small polygonal outbuilding.
- LNB photograph, 1935-36: **"Taurenes pagasta valdes ēka"**, described as
  "Taurenes pagasta valde ierīkota Taurenes krogus ēkā, kurā veikta pārbūve"
  (<https://www.europeana.eu/item/92085/9097>). The parish council moved into
  the rebuilt tavern.
- The parish history: "Bijušais Lāčakrogs nonāca Taurenes pagasta īpašumā. Vecā
  pagasta māja bija 'Tožās'."

Reading these together: the "Lāču krogs" of the brewery story is most likely
this crossroads tavern at the manor, which the parish took over and rebuilt as
its council house about 1932 to 1936. Before that the council sat in Tožas,
close by. The equation Lāčakrogs = Taurenes krogs is **inferred**. The rebuilt
tavern as the 1935-36 council house is **documented**. This agrees with
`research/accuracy-review.md`, which already says the new manor was not the 1935
parish hall.

### 2.7 The bridge

- LNB photograph, 192-: "Tilts pār Gauju pie Nēķena muižas"
  (<https://www.europeana.eu/item/92085/9100>). A timber deck with timber rails
  on fieldstone abutment walls.
- LNB photograph, 1935-36: "Tilts pār Gauju Taurenē"
  (<https://www.europeana.eu/item/92085/1819>). A new reinforced-concrete beam
  bridge with a pierced concrete balustrade, with a crowd posed on it.

So the bridge was rebuilt in concrete around 1935 to 1936. For a scene dated
exactly 1935 either is defensible. The timber one is right for 1860.
**Documented by photograph.**

### 2.8 Heritage register

The national register's public layer
(`https://geoserver.mantojums.lv/geoserver/monument/wfs`, type
`monument:monuments_view_culturalobject_public`, queried for the square on
2026-11-10) returns **no entry for the Nēķena manor buildings**. The only
architectural monument in the square is the Apšu church. The statement in
`research/taurene-local-history.md` that the manor complex "is a registered
cultural monument" is not supported by the register.

Register centroids worth using:

| No. | Monument | Lat, lon | Model x, z |
| --- | --- | --- | --- |
| 6279 | Apšu (Lodes) luterāņu baznīca | 57.13934, 25.60801 | -3424, 2238 |
| 585 | Lejstupu pilskalns | 57.15075, 25.64775 | -1025, 968 |
| 581 | Nēķina senkapi (at the Cēsis-Vecpiebalga / Taurene-Dzērbene junction) | 57.16495, 25.66786 | 190, -614 |
| 584 | Bērcēnu viduslaiku kapsēta | 57.16801, 25.68102 | 984, -954 |
| 592 | Zaļkalnu senkapi (Kapu kalns) | 57.14363, 25.66778 | 185, 1761 |
| 586 | Gambu viduslaiku kapsēta | 57.10978, 25.69527 | 1844, 5530 |
| 587 | Dunkupes viduslaiku kapsēta | 57.10545, 25.72848 | 3849, 6013 |
| 583 | Andrupu viduslaiku kapsēta | 57.10526, 25.61167 | -3203, 6034 |
| 590 | Silenieku pilskalns | 57.14422, 25.73140 | 4026, 1695 |

The model's `LOC.HILLFORT` (-1080, 820) is about 160 m north-west of the
register centroid for Lejstupu pilskalns.

---

## 3. Other mapped features

### 3.1 Churches, chapels, cemeteries

- **Apšu (Lodes) church is inside the square**, near the west edge (register
  no. 6279, position above). It is the 1780 log church already described in
  `research/manor-and-interwar.md`, with its cemetery ("Kps." on the 75k sheet)
  and chapel (OSM "Apšu kapu kapliča", 57.13823, 25.60911). `eras.js` does not
  draw it as a church.
- **Dzērbene church** is at 57.19145, 25.67810 (Latvian Wikipedia infobox,
  <https://lv.wikipedia.org/wiki/Dzērbenes_luterāņu_baznīca>, register no.
  6246). In model terms that is (808, -3565): about 3.6 km almost due **north**,
  0.9 km beyond the tile edge. The model's `LOC.CHURCH` silhouette at
  (-1450, -2050) stands to the north-west inside the tile, where no church has
  ever been mapped.
- No church, chapel or cemetery is mapped at Nēķene itself on any sheet.

### 3.2 Schools

- **South school**: "Учил." (1905), "Schule" (1914, 1943), "Skl." (75k), "шк."
  (Soviet 1:25k), at about **57.1477 N, 25.6610 E (model -225, 1300)**, west of
  the highway near Žuburi. This matches the OSM building now named "RSU sporta
  bāze". It is not on Rücker 1839 or on the 3-verst map. So it is **mapped for
  1935** and **probably not yet built in 1860**. I found no founding date.
- **North school**: "Schule" on Rücker 1839, "Учил." on the 3-verst and 1-verst
  maps, "Skl." on the 75k, "Skola" on the 1931 1:200k, at about **57.176 N,
  25.678 E (model 800, -1870)**. On the 1931 boundary map this is on the
  Dzērbene side of the parish line. I could not establish whether it is the
  Dzērbene parish school that Bormanis and Felsbergs attended. It is the only
  school in the square on the 1839 and 1860s maps.
- **Lodes skola** in the west ("Skl.", OSM "Lodesskola" at 57.14101, 25.61551)
  belongs to Lodenhof.

### 3.3 Taverns in the square

| Tavern | Position | Maps |
| --- | --- | --- |
| Brežģa krogs | 57.1124, 25.7012 | 1839 to 1943 (section 1) |
| Manor crossroads tavern ("Taurenes krogs", probably Lāčakrogs) | about 57.1637, 25.663 | 1839 symbol, 1905 "Корч.", photo 1932 |
| Krustakrogs | 57.1774, 25.6209 | 1905 "Крустъ", 75k "Krustakrogs" |
| Lejaskrogs (the Apšu tavern of Lode manor) | about 57.1415, 25.612 | 1905 "Корч.", 1914 "Krug", 75k "Lejaskrogs" |

For Lode manor the LNB caption text says "Ūdensdzirnavas: Lodē; krogi: Apšu,
muižas un Pluģu" (<https://www.europeana.eu/item/92085/26711>).

### 3.4 Lode manor

Lodes muiža (57.1306, 25.6462), its watermill ("Lodes Dzirnavas", 57.13624,
25.61407), the half-manor Kampas ("Kampas pmz." on the 75k) and Jaunāmuiža all
lie in the south-west of the square. They belonged to Lodenhof in Kirchspiel
Schujen, not to Nötkenshof. A Swedish cadastral map of "Loden Hoff" from about
1690 covers this quarter in the dodies `17gs_muizas` layer. I did not find a
Swedish map of Nötkenshof itself.

### 3.5 Roads

The through routes are the same in 1839, the 1860s, 1905, the 1920s and 1931:

1. Cēsis road in from the north-west through **Krustakrogs**, Biezēkas and
   Baltiņi to the manor bridge.
2. South from the bridge in a straight line past Žuburi, Ramdoti and Aprāni,
   then Zelleskalns, Bebri, **Brežģa krogs**, Vīdokšas, Ļūdi, towards Alauksts
   and Vecpiebalga. Drawn as a double-line improved road in 1905 and as a
   first-class road in 1931.
3. A branch at Aprāni south-west to Lode manor and on to Skujene (first class
   in 1931).
4. From the manor east-south-east past Ozoli to Urbiņi, Katriņkalns and
   Mežjēči (today's V299). Already a straight line on the 3-verst map.
5. North from the bridge to Dzērbene.

Differences from the modern P30 that the model inherits:

- **Brežģis bypass** (section 1.3). Up to 260 m.
- **North-west approach.** The 1920s highway came through the Krustakrogs
  crossroads and ran a little south of today's line past Biezēkas and Baltiņi.
  The modern P30 cuts straight across north-east of Krustakrogs. I overlaid
  `ROADS_OSM` on the 75k sheet to see this. Offsets are within about 100 m
  except at the Krustakrogs junction itself.
- Between the manor and Bebri the old and new lines agree to within the
  georeferencing error.

A minor farm track also ran Aprāni, Pīkāni, Mežandrēni, Jaunandrēni,
Kūlaskalns, Brežģa krogs. It is a track on every sheet, never the highway.

**Bridges** are drawn at the manor, at the mill, at Lode manor and at Brici.

### 3.6 Railways

None inside or near the square on any map from 1839 to the Soviet sheets. The
1931 map shows the nearest station, "St. Dzērbene" on the Ieriķi to Gulbene
line, well to the north of Dzērbene village.

### 3.7 Farmstead names

The 1905 and 1920s sheets name about 85 places in the square. The full
machine-read lists per map can be regenerated from the `vietvardi` JSON files.
Points that matter for the model:

- The 3-verst map prints household counts under names, for example Бебре 5,
  Гамбе 3, Рамдотъ 2, Шуберъ 3.
- **Pīkāni** is "W.W. Pikan" (Waldwärter, forest warden) on the German 1914
  sheet, which fits Felsbergs's birthplace as the forester's house.
- Farms named Jaun- or Mež- in the south-east (Jaunandrēni, Mežandrēni) appear
  by 1905 inside what the 3-verst map shows as forest.
- The reform farms on the old manor fields south and east of the manor (Sīļi,
  Avotiņi, Jaunozoli, Kalniņi, Gaiduļi, Vizbuļi, Viesturi, Pekas, Imantas,
  Palmēni and others on the Soviet 1:25k) are **not on the 1st-edition 75k
  sheet**. See 4.1.

### 3.8 Lakes

Named on the maps: **Tauring See / Оз. Тауринъ / Tauriņu ez.**, Dabaru ezers
(unnamed but drawn, with the farm Dabber beside it), Stupēnu and Brenkūžu
(drawn as one irregular lake on Rücker), **Ilse See / Ilzes ez.**, Bānūžu ez.,
and "Pupping S." north of the square.

Printed levels: Dabaru 86.1 sazhens (183.7 m) and Taurenes 83.3 sazhens
(177.7 m) on the Russian and Latvian sheets. The German 1914 sheet converts
these to 183.70 and 177.73. The Soviet sheets give 184.8 to 186.0 and 179.0 in
a different height datum.

I found **no evidence that any lake in the square was lowered or drained**. The
shorelines of Taurenes ezers and Dabaru ezers on the 1905 sheet match the modern
ones at map resolution. The datum change means the printed levels cannot be
compared. The one artificial water body is the mill pond (section 2.3), and the
mill dam must also have held up the level of the Gauja reach back towards
Dabaru ezers.

---

## 4. Land cover

### 4.1 Dating of the sheet the 1935 mask is baked from

`research/maps/topo75_1930s.png` is the **1st edition** Latvian Army 1:75k. It
prints "Nēķina mž." and "Pag. vld." without the name Taurene, gives heights in
sazhens, and its linework repeats the Russian 1-verst sheet almost line for
line. Its content is therefore the Russian survey of about 1900, lightly revised
in the early 1920s. It is not a 1930s survey. The 2nd edition (1934-40) has no
coverage here.

For forest outline this hardly matters, because the 1905 sheet, the 75k sheet
and the 1943 sheet agree closely. For settlement it matters: the 72 reform
farms are missing from it. The model takes 1935 farm sites from modern OSM
dwellings, which does include them, so no change is needed. Only the label
"1930s" is misleading.

A better bake is available. The repo used `LVARM_40_75k` at zoom 13. The same
sheet is served at **zoom 14** from
`https://tiles.dodies.lv/services/lva75k-1/tiles/{z}/{x}/{y}.webp`, which
doubles the resolution of the green fill.

The current mask gives 18 % forest overall (north-west 4 %, north-east 38 %,
south-west 16 %, south-east 14 %). By eye the south-east quarter of the sheet
(the Pīkāni, Mežandrēni, Jaunandrēni, Skrandi, Teikmaņi block) is greener than
14 %. Dense tree symbols and contour lines are probably being rejected as
linework. I did not measure this rigorously.

### 4.2 What the maps show, by date

**Around 1900 to 1943 (1-verst, 75k, Heereskarte).** Open farmland through the
centre and west. Forest in three masses: the north-east (north and east of
Taurenes ezers), a block south of the manor between the highway and Ozoli, and
the south-east block named above. Wet meadow along the Gauja below Lode manor
and around the lake chain. This is what the model's 1935 mask encodes.

**Brežģa kalns in particular.** On the 1905, 1920s and 1943 sheets the only
wood on the hill is one copse of roughly 300 by 400 m on the knoll north-east of
the road, between Bebri and the summit. The trig point, the summit and the
south and east slopes down to Gambas and Brežģa krogs are open ground. The hill
is only wooded on its north and west flanks by the Soviet 1:10k. So the
festival hill of the 1930s was an open hill with a view, which fits the
open-air theatre.

**1860s (3-verst) and 1839 (Rücker).** These are small-scale and only good for
the broad pattern. The 3-verst sheet shows tree symbols spread across the east
and south-east (Озолъ, Савадъ, Урбингъ, Пиканъ, Скранде, Кулескалнъ) more
continuously than later, and open country west of the highway. The later farms
Jaunandrēni and Mežandrēni were cut out of that eastern forest. Rücker shows
forest east of Tauring See, a block between Urbing and Skrande, and wood around
Ilse See.

The model's 1860 rule adds woodland "on the high noise-patches" (terrain above
about 208 to 224 m). The maps do not support that as a rule. The extra 1860s
forest was in the **east and south-east**, around the later clearings, while
the highest ground in the square, Brežģa kalns, carried a trig point and open
fields. Evidence: **mapped at low resolution**.

---

## 5. Smaller checks

- Brežģa kalns height. Soviet 1:10k prints 255.4 and 255.8 at the trig point.
  The official figure is 255.4 m. `BREZGA.y` is 258.7 from the elevation model.
- The 1937 road-sign photograph is catalogued by LNB as "Taurene. Ceļa norāde
  uz Bregža kalnu", with the alternative titles Karātavu kalns and Brežģa kalns
  (<https://www.europeana.eu/item/92085/9099>).
- Other LNB photographs for building forms: "Taurene", 1937
  (<https://www.europeana.eu/item/92085/9098>), "Taurenes pagasts. Dzīvojamā
  ēka", 1928 (<https://www.europeana.eu/item/92085/9089>), "Lodes (Apšu)
  luterāņu baznīca" (<https://www.europeana.eu/item/92085/9049>).

---

## 6. Recommended changes, ranked

1. **Put the 1860 and 1935 highway on the old road through Brežģis.** Promote
   OSM ways 447147093 and 812776432 (plus the link from the P30 near Bebri) to
   the main road in eras 3 and 4, drop the P30 segment between Bebri and
   Gailīši in those eras, delete `SOUTH_ROAD`, and correct the comment above
   it. *Mapped, 1839 to Soviet 1:25k.*
2. **Move the watermill, weir and pond** from the road crossing to the
   Dzirnavas / Jaunmelderi site at about (448, -448), with the pond between the
   bridge and the dam. Build the mill as a large fieldstone building. Keep it
   in 1860 and 1935. *Mapped, photographed.*
3. **Move the old manor house** to the Vecmuiža site (-71, -316) with the
   granary at (-67, -344), and shift the new manor to (-128, -197). In 1860 the
   new house's site is empty. *Mapped (surviving buildings).*
4. **Move Brežģa krogs** about 100 m west-north-west to Vecbrežģis, about
   (2196, 5243), on the south side of the old road. *Mapped.*
5. **1935 only: add the steam mill** at about (-158, 171). *Mapped.*
6. **Add the crossroads tavern** on the north bank by the bridge, about
   (-79, -472). In 1860 it is a fieldstone tavern with a carriage shed. In 1935
   it is the tavern being rebuilt into the parish council house. *Mapped and
   photographed. The name Lāčakrogs is inferred.*
7. **Place the brewery** on the Gauja bank opposite the cellars, about
   (-150, -275), with the cellars at (-114, -274). *Documented for position,
   mapped for 1905 to the 1920s, inferred for 1860.*
8. **Draw the Apšu church** at (-3424, 2238) with its cemetery, and move or
   remove the church silhouette: Dzērbene church is due north, off the tile.
   *Documented (register).*
9. **Schools**: south school at about (-225, 1300) in 1935 only. North school
   at about (800, -1870) in both eras. *Mapped. Identity of the north school
   not established.*
10. **1860 forest**: replace the high-ground noise rule with extra forest in
    the east and south-east, and keep Brežģa kalns open apart from the one
    copse. *Mapped at low resolution.*
11. **1935 bridge**: concrete beam bridge if the scene is 1936, timber on stone
    abutments if 1935 or earlier. *Photographed.*
12. **Text**: say that the 1826 surname is attested at Bērzaune, soften the
    tavern-to-surname link accordingly, and use the local spelling Bregža /
    Bregšu where quoting period sources. *Documented.*
13. **Notes to fix**: `research/maps/README.md` (mill pond, "Dabari Dz.", the
    "1930s" date), and the "registered cultural monument" claim in
    `research/taurene-local-history.md`.
