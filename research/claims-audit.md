# Claims audit, 1800 to today

Audit date: 10 November 2026. Scope: every checkable statement about the years 1800 onward
that the project shows to visitors, in `WRITEUP.md`, `src/content.js` (English and Latvian),
the in-app Chronicle (`artifact/about-fragment.html`), the minimap and "Look here" labels, and
the three research notes those texts rest on. Prehistory, historical maps and building
positions are out of scope and are only mentioned where a text claim touches them.

No existing file was changed. Nothing here is from memory alone unless it is marked
"not verified in this pass".

## How to read the verdicts

- **Confirmed**: the best reachable source says the same thing.
- **Wrong**: a source contradicts it. The correct fact is given.
- **Oversimplified**: true in outline, but the wording claims more than the source does.
- **Unsupported**: no reachable source says it, or the source cited by the project does not contain it.
- **Anachronism risk**: possibly true somewhere, but doubtful for the exact year shown.

## Sources used, and how good they are

| Key | Source | Kind |
| --- | --- | --- |
| VP | Taurenes pagasts, pagasta vēsture, Vecpiebalgas apvienības pārvalde (text taken from Spodra Ergarde, *Šīs zemes un cilvēku likteņgrāmata*). <https://vecpiebalga.lv/lv/vecpiebalga/vecpiebalgas-apvieniba/pagastu-vesture/taurenes-pagasts/> | Local authority, primary for this parish |
| VP-Dz | Dzērbenes pagasts, same site. <https://vecpiebalga.lv/lv/vecpiebalga/vecpiebalgas-apvieniba/pagastu-vesture/dzerbenes-pagasts/> | Local authority |
| VP-Vp | Vecpiebalgas pagasts, same site. <https://vecpiebalga.lv/lv/vecpiebalga/vecpiebalgas-apvieniba/pagastu-vesture/vecpiebalgas-pagasts/> | Local authority |
| VP-Sim | Simbolika (official blazons), same site. <https://vecpiebalga.lv/lv/vecpiebalga/vecpiebalgas-apvieniba/simbolika/> | Local authority |
| KD | Nēķena (Nēķina) muiža, kulturasdati.lv (Ministry of Culture data portal). <https://kulturasdati.lv/lv/kulturvesturiskas-vietas/nekena-nekina-muiza> | Institutional |
| LT | Nēķena muižas komplekss, latvia.travel (LIAA). <https://www.latvia.travel/lv/apskates-vieta/nekena-muizas-komplekss> | Institutional tourism |
| SL | "Laipni lūdzam Taurenes pagastā!", Taurenes bibliotēka slide deck. <https://www.slideshare.net/Taurbiblio/laipni-ludzam-taurenes-pagastamd> (blocks plain HTTP clients, read through a fetch tool, quotes are short extracts) | Parish library, local history |
| LSM | "Latvijas pērles: Brežģa kalns, Nēķena muiža un tās lustīgā baltā dāma", LSM, 1 May 2016. <https://www.lsm.lv/raksts/dzive--stils/vesture/latvijas-perles-brezga-kalns-nekena-muiza-un-tas-lustiga-balta-dama.a180830/> | Public broadcaster |
| LV98 | "Taurene bez tauriem, toties zem svēteļa spārna", *Latvijas Vēstnesis*, 1998. <https://www.vestnesis.lv/ta/id/50101> | Official gazette feature |
| VC | Brežģa Hill, Visit Cēsis. <https://visit.cesis.lv/en/place/brezga-hill/> | Municipal tourism |
| EG | Brežģa kalns, EnterGauja. <https://www.entergauja.com/lv/ko-darit/enter-daba/brezga-kalns> | Regional tourism |
| MON | Valsts aizsargājamie kultūras pieminekļi Cēsu novadā, list generated from the state register IDs. <https://lv.wikipedia.org/wiki/Valsts_aizsargājamie_kultūras_pieminekļi_Cēsu_novadā> | Wikipedia, register-derived. mantojums.lv itself is a script-only app and could not be read |
| ICOS | Balode, "Consolidation of Surnames in Vidzeme", ICOS 2011. <http://www.gencat.cat/llengua/BTPL/ICOS2011/164.pdf> | Peer-reviewed conference paper |
| TR98 | R. Treijs, essay on parish government after 1934, *Latvijas Vēstnesis*. <https://www.vestnesis.lv/ta/id/32934> | Gazette, historian's essay |
| OVW | Vidzeme Peasant's Homestead, Virtual Ethnographic Open-Air Museum. <http://openvirtualworlds.org/omeka/exhibits/show/virtual-ethnographic-museum/vidzeme-peasant-homestead> | Museum-derived |
| KK | The Latvian Farmstead, Latvijas Kultūras kanons. <https://kulturaskanons.lv/en/archive/latviesu-vienseta/> | Institutional |
| TZ | Tēzaurs.lv (LU MII dictionary), entries *riķis*, *zedenis*. <https://tezaurs.lv/riķis> | Academic dictionary |
| ARK | ARK Rewilding, Latvia project page. <https://arkrewilding.nl/en/projects/latvia> | Organisation's own page |
| W-* | Latvian Wikipedia articles, named where used | **Wikipedia, last resort** |

Not reachable in this pass: periodika.lv (its search is a script-only application),
mantojums.lv (same), zudusilatvija.lv (connection refused), letonika.lv (subscription),
enciklopedija.lv search (script-only), LVVA and Raduraksti (login). Anything that needs those is
listed under "Still to check" at the end.

---

## A. Claims that are wrong

### A1. The Māra Zālīte lines are misquoted, and they are about a butterfly

- **Where**: WRITEUP section 6, in-app Chronicle blockquote, source note [20] in `content.js`,
  and `research/taurene-local-history.md` ("Where will you fly, my aurochs?").
- **Project text**: *"Kur tu skriesi, tauriņ mans? — Uz Taureni, uz Taureni!"*, presented as
  the aurochs poetry that "came anyway".
- **What the cited source actually prints** (LV98, the project's own source [20]):
  *"Kur lidosi, mans taureni? / — Uz Taureni, uz Taureni!"*
- *Taureni* is the vocative of *taurenis*, butterfly. The line means "Where will you fly, my
  butterfly? To Taurene, to Taurene!" The parish library deck gives the poem's title as
  "Taurenis un Taurene" (SL, slide 54). LV98 goes on to say, in the next sentence, that the
  place in fact has nothing to do with butterflies, and then tells the aurochs story.
- **Verdict**: wrong. The wording is invented (*skriesi* and *tauriņ mans* are not in the
  source) and the meaning is reversed. The line is a pun on the butterfly, which is exactly the
  reading the gazette writer sets aside.
- **Fix**: quote it as printed and say it is a butterfly pun. See A2 for the verse that does
  what the Chronicle wanted this one to do.

### A2. "No written quote from Bormanis has been found" is wrong: he wrote the aurochs verse in 1925

- **Where**: WRITEUP section 6 and the in-app Chronicle ("survives as local tradition rather
  than a documented quote", "He was more a schoolmaster than a poet").
- **Source**: LSM introduces a verse with the sentence *"Tā par Taurenes vārdu 1925. gadā
  rakstīja šīs puses izcilais pedagogs un kultūras darbinieks Kārlis Bormanis."* The lines it
  quotes include *"Senāk mežos te ganījās tauri. Izzuda tauri, tik palika vārds."* and
  *"Zemi šo skaisto, kur Gauja tek cauri, par Taureni nosauca senatnīgs vārds."*
- In English: "Once the aurochs grazed in these forests. The aurochs vanished, only the name
  remained." and "This fair land, where the Gauja runs through, an ancient word named Taurene."
- **Verdict**: wrong. The phrase *kur tauri ganījās* has a documented origin in Bormanis's own
  1925 verse. This is the single best correction in the audit, because it turns the project's
  title phrase from "tradition" into a dated quotation by the man who renamed the parish.
- **Caution**: the fetch tool returned the four lines in two pieces, so the line order should be
  read off the LSM page (or Ergarde's book, which LSM draws on) before it is carved on the
  memorial stone.

### A3. The parish page does not say what citation [3] is used for

- **Where**: nearly every 1860 and 1935 sentence cites [3] (VP).
- VP contains none of the following: the 1426 "Gerslau" grant, the von Panders or 1856, the
  architect, the 1,150 ha and 72 units, the 1905 arson story, the brewery output, the taverns.
- Where they do come from: 1426 and 1856 and the architect are in KD and LT. The 72 units and
  1,150 ha are in W-Taurenes pagasts, which cites *Latviešu konversācijas vārdnīca* vol. XXI,
  cols. 42265 to 42267. The brewery and taverns are in SL.
- **Verdict**: wrong attribution, not wrong facts. Re-point the citations.

### A4. "The estate passed to the Notken family in 1601" is not what the sources say

- **Project**: "the Notken family who took the estate in 1601" (WRITEUP, Chronicle), "who held
  it from 1601" (panel).
- **VP**: the Jarslava manor "vēlāk piederēja Noetkenu dzimtai un … 1601. gadā tika pārdēvēta
  par Nēķena muižu", that is, it later belonged to the Noetken family and was **renamed** in
  1601. SL slide 53 says the same. W-Taurenes pagasts only says that a manor here belonged to
  Netken "during the Polish-Swedish war (1600 to 1629)". W-Banēri lists Nötkenshof as a Banér
  family property from 1636, so the Notkens did not hold it for long.
- **Verdict**: oversimplified, shading to wrong. Say "named Nēķens after the Noetken family,
  a name recorded from 1601". Do not say they acquired it that year or held it until 1856.
  VP is explicit that the manor "changed owners many times, was pawned and redeemed".

### A5. The two 15th-century grants are merged

- **Project**: "the deed-chain runs back to 1426, when the Riga archbishop granted 'Gerslau'
  to his vassal [3]".
- **KD**: 1426, Archbishop Hennings granted the manor, then called Gerslau, to Johan Frogt.
  **VP**: documents of 1431 and 1439 show two manors, "Tauren" granted to Hans Renne and
  "Jarslava" granted to Johann Foged, and Taurene is first mentioned in 1439 when it separated
  from Dzērbene manor.
- **Verdict**: confirmed for 1426 by KD (not by [3]). But the forms differ (Gerslau, Jarslava,
  Jorslava; Frogt, Foged, both probably *Vogt*) and the dates differ (1426 against 1431 and
  1439). Neither site cites the charter. Treat 1426 as "reported by the Ministry of Culture
  portal", and give VP's 1431 and 1439 for the Tauren estate that the 1925 name revived.

### A6. "Karatavu kalns" is misspelled

- **Correct**: **Karātavu kalns** (W-Brežģa kalns, citing the LĢIA place-name database
  object 90131; SL slide 36; LSM). Older spelling of the hill: Bregža kalns.
- Appears without the macron in WRITEUP, `content.js` source note 7 and both research notes.

### A7. "Briediņu pilskalns" is the wrong alias

- VP and W-Dabaru ezers both give **Brēdiķu (Lejstupu) pilskalns**. WRITEUP section 1 has
  "Briediņu". (Outside the 1800+ scope, noted because it is a one-word fix.)

### A8. The 19 thalers 73 groschen is not a price

- `research/taurene-local-history.md` says Baltiņi was "purchased from Nēķena Manor in 1873 for
  19 thaler 73 groschen". SL slide 20 gives the purchase date, 29 May 1873, and gives
  19 dālderi 73 graši as the **land value**. In Livland the thaler was the unit of assessed
  land value, not money. Not in visitor text yet. Do not let it in as a price.

---

## B. Claims that are unsupported or overstated

### B1. Kārlis Bormanis as author of "Latvia's first school geography textbook"

- **Project**: "author of *Zeme*, Latvia's first school geography textbook" (WRITEUP, Chronicle),
  "author of Latvia's first geography textbook" (panel), "pirmās latviešu ģeogrāfijas mācību
  grāmatas autors" (Latvian panel).
- **Sources**: W-Kārlis Bormanis, citing the Letonika *Vidusvidzemnieku biogrāfiskā vārdnīca*,
  says he wrote "several textbooks, among them the first geography textbook **for Latvian
  schools**". The same article gives the book as *Zeme, ģeogrāfija tautskolām*, first edition
  1908, six editions, reviewed in *Rīgas Avīze* 1909 no. 166. W-Cēsu novads repeats "author of
  the first geography textbooks in Latvia".
- **Problems**. First, 1908 is ten years before Latvia existed, so "Latvia's first" is an
  anachronism in itself. Second, the panel drops the word "school", which makes it flatly
  false: Krišjānis Barons published *Mūsu tēvzemes aprakstīšana*, a geography in Latvian, in
  1859, and the gazette's survey of Latvian geography (<https://www.vestnesis.lv/ta/id/41636>)
  starts in the 18th century. Third, the superlative rests on one biographical dictionary
  entry that I could not open, relayed through Wikipedia.
- **Verdict**: unsupported as worded. Safe wording: "author of *Zeme* (1908), a geography for
  Latvian elementary schools that ran to six editions". If the superlative is wanted, check the
  Letonika entry and the LNB catalogue for earlier Latvian school geographies first.

### B2. "1,150 hectares became 72 new farms"

- **Source**: W-Taurenes pagasts (from *Latviešu konversācijas vārdnīca*): the manor was divided
  into **72 land units** totalling 1,150 ha. Lode manor gave 38 units (785 ha) and Gustu manor
  25 units (616 ha).
- A "unit" is not a new farm. The same encyclopaedia's entry for the neighbouring manor says
  Dzērbene was divided into 144 units "of which 30 were former rented farms" (W-Dzērbenes
  muiža). Units also went to craftsmen, the parish, the school and the remaining manor centre.
- VP adds that new farms rose on land taken from the manor "and from the mill owner".
- **Verdict**: oversimplified. Say "was divided into 72 holdings". The Latvian panel's
  "72 jaunsaimniecības" has the same problem. Wikipedia is the only reachable carrier of the
  figure, so flag it until the encyclopaedia column is seen.

### B3. "The German aristocrats left"

- No source says when or whether the Panders left. KD and LT say the family owned the manor
  until 1922. SL slide 42 says the young owner Pauls von Pander died at the end of 1905. The
  reform law let owners keep a residual holding of up to 50 ha.
- **Verdict**: unsupported. Say "the Panders lost the estate in 1922".

### B4. "Its own peasants stood against the arsonists, a fact remembered to the Panders' credit"

- KD, LT and SL slide 43 all introduce it with *"Nostāsts liecina"*, "tradition has it".
  W-Taurenes pagasts carries a citation-needed tag on the same sentence.
- **Verdict**: oversimplified. It is a local tradition, not an established fact. What the
  sources state as fact is only that the house was not burnt in 1905.

### B5. Which manors burnt in 1905

- **Project**: Vecpiebalga, Dzērbene and Sērmūkši (WRITEUP), "the manors all around" (Chronicle).
- SL slide 43 names four: Vecpiebalga, Sērmūkši, Kaive and Dzērbene. Dzērbene is confirmed by
  VP-Dz ("1905. gada notikumos pili nodedzināja") and W-Dzērbenes muiža ("daļēji
  nodedzināja"). Vecpiebalga is confirmed by celotajs.lv
  (<https://www.celotajs.lv/lv/e/vecpiebalgasmuiza>: burnt in the 1905 unrest, later
  restored). Sērmūkši rests on English Wikipedia only. Kaive I could not confirm.
- **Verdict**: confirmed for the three named. Note that Dzērbene was partly burnt.

### B6. The 1906 court-martial

- VP: *"1906. gadā pilī ierīkoja lauku kara tiesu, bet pēc dragūnu pavēles pagrabus pārbūvēja
  par cietumiem."* LSM agrees on the cellars.
- **Verdict**: confirmed. Two refinements: it was the dragoons of the punitive expedition who
  ordered the conversion, and the building was the **new** palace. The in-app Chronicle places
  this sentence in the 1860 section straight after the brewery cellars, so "those cellars"
  reads as the brewery cellars. That is wrong. They were the cellars of the new manor house.

### B7. The brewery in 1860

- **Source** (SL slide 9): "In the 19th century" a brewery stood on the Gauja bank opposite the
  cellars. It made 25,000 *spaiņi* of beer a year, "ko izdzēra Bregžu un Lāču krogos". The
  cellars were "trīs velvētas mūra telpas, kas iebūvētas dziļi Gaujas senkrastā". Beer went to
  the cellars on rails. In 1898 a batch soured and the overseer got 21 strokes. It was blown up
  in 1944.
- Confirmed: the figure, the three vaulted cellars, the two taverns.
- **Not supported**: any date. The only dated fact is 1898. LT says the present ensemble was
  built in the second half of the 19th century, replacing buildings about a hundred years old,
  and the Panders arrived only in 1856. An output of 25,000 buckets (about 3,000 hectolitres if
  the Russian *vedro* of 12.3 litres is meant, my conversion, not the source's) fits an
  industrial manor brewery of the 1880s and 1890s better than 1860.
- **Verdict**: anachronism risk. The present-tense sentence "the manor brewery cools 25,000
  buckets of ale a year" in the 1860 panel dates an undated figure. Say "in the nineteenth
  century", or move the number to a later sentence.
- Small wording points: the source says the ale was drunk in both taverns, Bregži and Lāči, and
  the Chronicle's "sold its ale … among other places" is an addition.
- **Missing for 1935**: VP says Augusts Graudiņš bought the former brewery and it **worked
  until 1944**. In the 1935 scene the brewery should be a going private business.

### B8. "The old classicist manor house watches from its linden park"

- SL slide 6 says the surviving old palace was built in the 18th century and that the park was
  remodelled. No source describes its style, its portico, its roof or the species in the park.
  `research/manor-and-interwar.md` infers "classicist" from the regional type.
- **Verdict**: unsupported. "The old eighteenth-century manor house" is what the sources allow.

### B9. "Verified detail by detail against the Ethnographic Open-Air Museum's Vidzeme homestead [8]"

- Source [8] (KK) is a general essay on the Latvian farmstead. It supports the siting rules
  (dwelling on dry ground, byre to the north, klēts to the south, rija apart on a rise, pirts by
  water, a good well) and says Vidzeme "long had the tradition of using the threshing barn for
  housing". It says nothing about chimneys, glass, shingles, locks, well sweeps, fence types,
  beehives or hay poles.
- The museum homestead itself (OVW) represents "an average wealthy peasant of Vidzeme" from the
  **later 18th to the first half of the 19th century**, and states that farmers there "lived in
  chimneyless houses and in threshing living houses".
- **Verdict**: unsupported as a claim of verification. The building set is typical. The
  detail-by-detail check did not happen against that source.

### B10. "The dwelling with its first chimney" in 1860

- The project's only source for chimneys is a travel site (OnLatvia) quoted in
  `research/manor-and-interwar.md`. The museum source (OVW) and the Culture Canon (KK) both
  stress that Vidzeme families commonly lived in the heated rija or in chimneyless rooms into
  the 19th century. In 1860 this farm is a tenant farm, very likely still on corvée (see D1).
- **Verdict**: anachronism risk. A separate dwelling with a chimney is possible on a better-off
  Piebalga-side farm in 1860. A *dzīvojamā rija*, with the family in chambers built onto the
  threshing barn, is at least as typical and is what the two institutional sources describe.
  The text should say the chimney marks a progressive farm, or show the older arrangement.

### B11. "The shingled klēts, the only locked building on the farm"

- No reachable source. The granary as the place for valuables is standard ethnography. "The
  only locked building" is an embellishment from the research note. **Unsupported**; drop "only".
- Roofing word: the Latvian panel says *lubu jumts* (split laths), which is right for 1860.
  English "shingled" is acceptable.

### B12. "Thatch lasted longest there, preserved by the grain-drying smoke"

- Not in any cited source. **Unsupported** folk explanation. Keep the thatched rija, drop the
  causal claim or mark it as tradition.

### B13. "The slanted riķu fence"

- Tēzaurs: *riķis* is a regional word meaning *zedenis*, and also "a fence woven of spruce
  branches between three horizontal poles". *Zedenis* is "a short thin pole, usually used for
  fences", and "a kind of woven fence".
- **Verdict**: the WRITEUP wording is defensible. It is `research/manor-and-interwar.md` that
  is wrong, where it defines *riķu žogs* as a horizontal-rail fence. The scene's fence model
  should be slanted poles woven between rails, not post-and-rail.

### B14. Open-field strips in 1860

- WRITEUP fourth and fifth editions: the 1860 fields are "the open-field strips of the
  three-course rotation (winter rye, spring barley or oats, and ploughed black fallow)".
- The three-field rotation is right for peasant land of that date. Strip intermixture is
  attested for Piebalga, where farms stood in groups and the survey of 1867 to 1873 (the
  setting of *Mērnieku laiki*) consolidated them, but I found no source for Nēķena, which
  belonged to Dzērbene church parish, not Piebalga. KK describes the *viensēta* as a compact
  unit with its own fields.
- **Verdict**: unsupported for this parish. Not verified in this pass.

### B15. "Within a decade families like this one would begin buying their farms"

- The only dated purchase found in this parish is Baltiņi, bought from Nēķena manor on
  29 May 1873 (SL slide 20). Bormanis's parents first rented a pasture clearing from the manor
  and later bought Kalna Stīmiķi (W-Kārlis Bormanis, from Ergarde). W-Zemes reforma Baltijas
  guberņās says that by 1860 only 36 farms in all Vidzeme had been bought.
- **Verdict**: plausible, slightly early. "From the 1870s" is what the local evidence shows.

### B16. "Surnames in 1826, very commonly from the farmstead or landmark"

- ICOS confirms that all surnames had to be assigned by the end of 1826, under clause 11 of the
  law of 26 March 1819, and that the 1826 revision is the main record. The process began in
  1822 (W-Latviešu personvārdi, citing Upelnieks 1936).
- On farm names ICOS says the practice **varied by parish**. In Alt-Laitzen 43 of 45 surnames
  matched the house name, and in Korwenhof 10 of 14. In the Ērģeme parishes officials avoided
  such matches on purpose.
- **Verdict**: oversimplified. "Often, depending on the estate" is right. Nothing is known for
  Nēķena. The 1826 revision list for the estate (LVVA fonds 199) would settle the Brezgis
  question and has not been consulted.

### B17. "Serfdom ended in Vidzeme in 1819"

- **Confirmed** as the date of the law (26 March 1819, ICOS). Oversimplified as an event: the
  release was staged through the 1820s, and movement stayed restricted. "Freedom without land"
  is accurate.

### B18. The 1935 farm "now has glass windows … and an orchard"

- The English panel says "The farm now has glass windows, a shingle roof and an orchard". The
  WRITEUP says the 1860 farm already had small glass panes and an orchard.
- **Verdict**: internally inconsistent. Glass and orchards are not novelties of 1935. What
  changed is larger framed windows, a porch, sawn-shingle or sheet roofing and painted boards.

### B19. Telephone poles, the cooperative dairy

- No Taurene source mentions a telephone line, a post office or a cooperative dairy in 1935.
  SL slide 11 mentions a **manor** dairy and cheese-house with a 200-litre hand separator,
  undated. The scene's "Brežģu Pienotava" is a present-day map name.
- **Verdict**: plausible regional generalities, unsupported for this parish. Worth a periodika
  search (see "Still to check").

### B20. The stork "on its wheel-top nest"

- The cartwheel is right. The 1934 national count found about 6,750 pairs (Strautzels, cited in
  Janaus and Dekants 2023, *Proc. Latvian Acad. Sci.*, DOI 10.2478/prolas-2023-0022). The
  Latvian Ornithological Society brochure says that almost all nests were then in **trees**,
  and that people had helped build 87 % of them
  (<https://www.lob.lv/wp-content/uploads/2016/04/starku_brosura.pdf>). Nests on poles are a
  post-war development.
- **Verdict**: text confirmed. The model is called `storkNestPole` and the same nest is placed in
  the 1860 scene. A free-standing pole is an **anachronism for 1935 and for 1860**. Put the
  wheel in a tree crown or on a roof ridge. For 1860, storks had only spread across the whole
  of Latvia "since the mid-19th century" (same brochure, via W-Baltais stārķis), so one nest at
  most.

### B21. "An oak at its summit", "theatre under the summit oak"

- None of W-Brežģa kalns, SL, LSM, VC or EG mentions an oak. The vietas.lv page cited in the
  research note has no description text at all. W-Brežģa kalns says only that the summit is
  wooded.
- **Verdict**: unsupported. The minimap label "The old oak" on Brežģa kalns has no source.

### B22. Open-air theatre "1937–39" and "every midsummer"

- SL slides 38 and 39: on **25 July 1937** A. Alunāns's *Kas tie tādi, kas dziedāja* was
  staged, and on **22 July 1939** G. Merķelis's *Vanems Imanta*, with a choir and processions
  from Bregža krogs to the stage and a director from the Aizsargi regiment, A. Zommers. VP
  confirms "processions to the performance sites on Brežģa kalns". LSM: big celebrations every
  Jāņi, open-air dances and plays, until 1940.
- **Verdict**: confirmed, with two cautions. Only 1937 and 1939 are documented, and both plays
  were in late July, not at Jāņi. For the year 1935 the bonfire is supported and the theatre is
  two years in the future, which the panel words correctly ("in the last summers before 1940").

### B23. "The Jāņi fire still burns beside it every midsummer" (2025)

- No source. **Unsupported.**

### B24. ARK and the Konik horses

- **Project**: "In 2008 the Dutch rewilding foundation ARK released a herd of Konik horses …
  onto private meadows in Taurene [28]."
- The cited page says ARK's Latvian project ran from 2005 to 2010, set up some 30 grazing areas
  across the country on private and state land, and ended with 401 Koniks. It does not mention
  Taurene, 2008 or a release there. Searches found nothing for Taurene either.
- **Verdict**: unsupported. Either find the local source or cut the year and the place.

### B25. "At 255.4 m the highest point of the parish"

- 255.4 m: W-Brežģa kalns (from *Latvijas daba*) and SL slide 36. VC and EG round to 255 m.
  SL calls it "Taurenes augstākā virsotne". VP is more careful: "viens no augstākajiem
  punktiem pagastā", **one of** the highest, and adds that the highest part of the parish lies
  along the Cēsis to Madona road west of it.
- **Verdict**: height confirmed, superlative disputed by the local authority's own page.

### B26. "The parish hall (Pag. vld.)" and the old palace as "a clinic"

- VP: the parish took over the Old Palace and "tur darbojās doktorāts", a doctor's practice
  and residence. The outpatient clinic (*ambulance*) is mentioned only in 1944, when it moved
  to "Imantas". "Vecā pagasta māja bija Tožās", the old parish house was at Tožas.
- **Verdict**: "clinic" is a fair English gloss. The Latvian panel's *ambulancei* should be
  *doktorātam*. VP gives no date for the takeover, so "by 1935" is an inference.

### B27. "Persuaded the parish council"

- VP: Bormanis made the proposal "pagasta valdes sēdē" and "valdes lēmums bija ieteicējam
  labvēlīgs". LV98 also says "valde nolēma". That is the parish **board** (*valde*), not the
  council (*padome*). The Latvian panel says *pagasta padomi*. Minor, but the source is plain.
- VP also records the condition that the **manor kept the name Nēķens**. That is worth saying,
  because the 1935 map still prints "Nēķina mž.".

### B28. "The parish now has a German name, Nötkenshof or Nēķene"

- Nötkenshof is the German name. Nēķens (Nēķins, Nēķene) is the Latvian folk form of it, and it
  was the official Latvian name of the parish until 1925. LV98 describes the 1925 act as
  Latvianising a name that carried a German owner's surname.
- The project uses four forms: "Nēķene manor", "Nēķens manor", "Nēķena", "Nēķene". The local
  authority uses **Nēķena muiža** and **Nēķena pagasts** throughout (nominative *Nēķens*).
  Wikipedia uses *Nēķenes pagasts* and *Nēķina muiža*, and the 1930s map prints *Nēķina mž.*
  Pick the local authority's form and add the map's spelling once.

### B29. Lake facts

- Seven-lake chain: **confirmed** by VP, with the same seven names.
- Dabaru ezers 17.8 ha: **Wikipedia only** (W-Dabaru ezers, which cites ezeri.lv). The same
  article gives "Stupēnu ezers" as an alternative name for Dabaru ezers, while VP lists Stupēnu
  and Dabaru as two lakes. Flag the ambiguity.
- "Has only just left its source basin at Lake Alauksts": W-Gauja says the source is disputed
  between Alauksts and springs at Elkas kalns. **Oversimplified.**

### B30. "Thirteen registered archaeological monuments"

- **Confirmed** against the register-derived list (MON): thirteen archaeological entries in
  Taurenes pagasts, matching numbers 580 to 592 on the blog the project cites. The manor
  ensemble itself is **not** on the state list, so the research note's "registered cultural
  monument" for the manor is unsupported.

---

## C. Claims confirmed as written

| Claim | Source |
| --- | --- |
| Von Pander ownership from 1856, Guard Lieutenant Augusts Joachims von Panders, until 1922 | KD, LT |
| New manor house, neo-Renaissance with villa motifs, built for Heinrich Pander in the 1880s | KD, LT, VP |
| Architect **R. G. Šmēlings** (Reinholds Georgs Šmēlings, 1840 to 1917) | KD, LT, SL slide 43, W-Taurenes pagasts. Four sources agree and none names Zirkwitz. All four are secondary and probably share one origin. I found no building file or monograph, so the attribution is "consistently reported", not archivally proven |
| Roof-raising celebrated August 1888, no building work after 1900 | VP, SL |
| New manor is two-colour brick | SL slide 42 |
| Eight buildings survive (new palace, old palace, granary, ice cellar, brewery cellar, former horse-post, stable, byre) | VP |
| 1925 proposal by teacher Kārlis Bormanis, effective 1 January 1926, reviving the medieval "Tauren" | VP, LV98 |
| Bormanis 1877 to 1958, born at Kalna Stīmiķi (later Zaļkalni) in Nēķena parish, teacher and head of Taurene primary school 1923 to 1939, choir leader | W-Kārlis Bormanis, VP. Birth date is given as both 22 and 23 February in the same article |
| Order of the Three Stars, 5th class | W-Kārlis Bormanis citing Letonika. Year of award not found |
| Parish arms with aurochs horns | VP-Sim. Official blazon: *"Zils lauks dalīts ar trīsstūra pēdu, augšējā laukā zelta taura piere ar ragiem"*, a gold aurochs forehead with horns on blue |
| Brežģis also called Brežģa krogs, 6.4 km south of Taurene | W-Brežģis (LĢIA object 66088) |
| Brežģa kalns forces the Gauja into a loop toward Taurene | SL slide 36 |
| Jāņi celebrated on the hill every year until 1940 | LSM |
| Observation tower, 11 m, opened 2017 | VC, EG |
| White Lady legend | LSM |
| Agrarian reform law of 16 September 1920, State Land Fund | W-Agrārā reforma Latvijā, standard |
| 1935 census: 1,303 inhabitants, 81.7 km² | W-Taurenes pagasts, citing Salnais and Maldups, *Pagastu apraksti*, 1935 (not now shown to visitors) |
| Dzērbene church stood in 1860 (built 1839 to 1842, or 1840 to 1843) | W-Dzērbenes luterāņu baznīca, VP-Dz |

---

## D. Well-documented facts the project leaves out

### D1. For 1860

1. **This was almost certainly a corvée farm.** In the 1850s about 82 % of Vidzeme lease
   contracts were corvée leases. Corvée leasing was banned in Vidzeme only in 1868. By 1860
   only a few dozen farms in the whole province had been bought. (W-Zemes reforma Baltijas
   guberņās, Wikipedia, so check against Švābe or the National Encyclopaedia before quoting the
   figures.) The scene could show a family owing days of labour with horse and plough to the
   manor four years after a new owner arrived.
2. **The Panders were new.** Augusts Joachims von Panders took over in 1856. LT says the
   whole manor ensemble was rebuilt in the second half of the century. In 1860 the estate is at
   the start of that rebuilding, with an eighteenth-century house at its centre.
3. **A parish house and a library, 1857.** SL slide 45: "1857. gadā, kad uzcelta pagasta ēka,
   telpas ierādītas arī bibliotēkai", and with Baron von Pander's help the stock reached 300
   volumes. A peasant community house with a lending library three years before the scene is
   unusual and local. It deserves a building and a sentence.
4. **The parish school at Dzērbene, founded 10 November 1858** (VP-Dz, from the original
   founding minutes). It is the school Bormanis and Ernests Felsbergs later attended. A Nēķena
   parish school existed by the 1880s (W-Kārlis Bormanis). Its founding date was not found.
5. **Church.** Nēķena belonged to the Dzērbene Lutheran congregation. The church was built in
   1839 to 1842 under master builder Mārcis Sārums, and the supervising landowner noted that it
   went up "without intoxication" because Sārums's men did not drink (W-Dzērbenes luterāņu
   baznīca). Sārums and his sober crews are classic Brethren Piebalga.
6. **The Brethren.** The Herrnhut movement peaked in Vidzeme in the 1820s and 1830s with over
   30,000 members, and Matīss Kaudzīte's 1877 book lists about 140 meeting houses (LSM and LU
   repository summaries found by search, not read in full). I found **no** source for a
   meeting house in Nēķena itself. Kaudzīte's *Brāļu draudze Vidzemē* lists them by place and
   is the thing to check.
7. **Piebalga weaving.** In 1844 Piebalga had 540 weavers, mostly men, and its spinning-wheel
   makers sold to Russia, Lithuania and Estonia (VP-Vp). Nēķena borders Piebalga. A loom in the
   house and flax on the field are well founded.
8. **A healer in the parish.** Miķelis Hāns (1810 to 1893), self-taught healer of mental
   illness at Baltiņi, was alive and practising (SL slides 20 to 22).
9. **Emigration.** The resettlement of Latvian and Estonian peasants to inner Russia in the
   1860s was widely debated at the time (<https://history.jes.su/s207987840000123-4-2/?sl=en>).
   I could not tie it to Nēķena. Not verified in this pass.

### D2. For 1935

1. **The brewery was working.** Augusts Graudiņš bought it and it ran until 1944 (VP), when it
   was blown up (SL). The scene treats the brewery as a manor-era relic.
2. **The parish owned things.** The Old Palace (doctor's practice), the manor granary and the
   former Lāči tavern (Lāčakrogs) were parish property. The old parish house was at Tožas (VP).
3. **Who ran the parish.** Parish elder Jānis Pūrītis, 1931 to 1936 (VP).
4. **The 1934 coup reached the parish.** The law of 17 July 1934 let the Interior Minister
   remove parish elders and board members and appoint others. By 1 February 1937, 818 parish
   board members, 56.5 %, had been replaced, and parish governments "in truth became state
   institutions" (TR98). VP says the same locally: from the later 1930s "lielāku autoritāti
   ieguva pagasta valde". A portrait of the Leader and a flag on the parish house belong to 1935.
5. **Organisations, by name.** Mazpulki led by Kārlis Bormanis (the movement was founded in
   1929, W-Mazpulki), the Farmers' Society, the Dzērbene congregation ladies' aid committee,
   and three choirs: the LNJS Taurene branch choir under Bormanis, the **Aizsargi choir** under
   Zinaīda Krampe, and the Dzērbene congregation choir under teacher J. Pikurs (VP).
6. **The reform farms were struggling.** VP: farming the new land "was hard, debts and
   redemption payments weighed, equipment had to be found and houses built", the crisis made it
   worse, and "the sale of the land or auctioning of farms began". The 1929 agricultural census
   counted 171 farms over 20 ha. The parish head tax was 6 to 20 lats a year. This is a truer
   mood for 1935 than the present idyll.
7. **The railway.** Dzērbene station on the Ieriķi to Abrene line. International Riga to
   Leningrad trains ran over it from 1924, and a two-storey station building by Lidija
   Grīnberga went up in 1928 (W-Dzērbene (stacija), W-Dzelzceļa līnija Ieriķi—Abrene). It lies
   outside the map square, but it is how butter, flax and people left the parish, and a train
   whistle from the north is defensible.
8. **Dzērbene agricultural school** worked in the neighbouring manor from 1927 (VP-Dz).
9. **No electricity.** Ķegums was built from 1936 to 1939 and no national grid existed by 1940
   (LU thesis, <https://dspace.lu.lv/handle/7/64057>). The 1935 scene should have no power
   lines and should be lit by paraffin lamps. Telephone wire, if shown, is a single line to the
   parish centre.
10. **Livestock.** The visitor text names no breeds. If it is to, Latvian Brown was recognised
    as a breed in 1922 and suits 1935 (W-Latvijas brūnā), but not 1860, when cattle were small
    and mixed in colour. The 1860 scene uses the same white sheep as 1935. White-fleeced sheep
    with a dark face (Latvijas tumšgalve) belong to the interwar years. Mid-19th-century
    peasant sheep were small, coarse-woolled and often dark. Not verified against a livestock
    history in this pass.
11. **Machinery.** Nothing in the text. A horse mower and rake by 1935 are safe. A threshing set
    shared through a machine society is typical, and a tractor is not.

### D3. For both

- **The mill is documented after all.** VP says the new farms were formed on land taken "no
  Nēķena muižas un **dzirnavu īpašnieka**", from the manor and from the mill owner. Bormanis's
  father did masonry "Nēķena dzirnavās" (W-Kārlis Bormanis, from Ergarde). The WRITEUP and the
  Chronicle both say the mill "is not documented". It is, for the later 19th century and for
  1920. Its exact site and type are still unknown.
- **Pauls von Pander died at the end of 1905** (SL slide 42), which is part of why the new
  house was never quite finished.
- **1887**: the lady of Nēķena gave Dzērbene church its altar painting, a copy of Rubens's
  *Christ on the Cross* (W-Dzērbenes luterāņu baznīca).

---

## E. Still to check, and where

| Question | Where |
| --- | --- |
| Exact text and line order of Bormanis's 1925 verse | LSM page in a browser. Ergarde, *Šīs zemes un cilvēku likteņgrāmata* (2007) |
| Earlier Latvian school geographies, to settle "first" | LNB catalogue, Letonika entry on Bormanis |
| Architect attribution on a primary basis | D. Bruģis, *Historisma pilis Latvijā*. Riga building files |
| 72 units and 1,150 ha | *Latviešu konversācijas vārdnīca* XXI, cols. 42265 to 42267 |
| The Brezgis surname | LVVA fonds 199, 1826 revision list for Nötkenshof. Raduraksti, Dzērbene church books |
| Brethren meeting house in Nēķena | M. Kaudzīte, *Brāļu draudze Vidzemē* (1877) |
| Dairy society, telephone, post, bus service, Aizsargi unit in Taurene, 1930s | periodika.lv, searching "Taurenes pagasts", "Taurenes piensaimnieku", 1930 to 1939. Salnais and Maldups, *Pagastu apraksti* (1935) |
| Official act renaming the parish | *Valdības Vēstnesis*, 1925, on periodika.lv |
| Koniks at Taurene | Latvijas Dabas fonds, local press |
| Oak on Brežģa kalns | *Latvijas daba* encyclopaedia vol. 1, p. 160. The 1937 photograph on zudusilatvija.lv |
| Corvée and purchase figures for 1860 | National Encyclopaedia, Švābe, K. Lust's papers on Livland |
