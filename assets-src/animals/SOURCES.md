# Animal models: sources and licences

Every GLB in this directory was downloaded from a public page without a login and carries a licence that allows
redistribution in a public MIT-licensed site (CC0 1.0 or CC-BY 3.0). The original downloads are kept outside the
repository, together with the scripts that produced these files.

Total: 38 files, 2.16 MB as GLB (about 2.88 MB once base64-encoded).

## Conventions shared by every file

- glTF 2.0 binary, Y up, the animal faces **+Z**, feet (lowest point of the rest pose) at **y = 0**, units are **metres**.
  Each file has a single top-level node called `root` that carries the yaw, uniform scale and offset which achieve this.
  Scale the loaded `gltf.scene` uniformly to fit another species (target height / bbox height below).
- Static models are centred on x and z. Rigged models keep the rig origin on x and z (it sits between the feet).
- **No normals are stored.** All of these models are faceted low-poly, so normals were stripped and vertices welded to
  save about 40 percent. three.js `GLTFLoader` turns on `flatShading` automatically when a primitive has no normals.
  Do not call `computeVertexNormals()` unless a smooth look is wanted. The one exception is `frog.glb`, which keeps its smooth normals.
- Positions are plain float32 (no `KHR_mesh_quantization` on positions, no Draco, no meshopt), so no decoder is needed and
  `geometry.applyMatrix4` is safe. UVs and skin weights are quantised (normalised integers), which `GLTFLoader` handles natively.
- Clip names are normalised: `Idle`, `Idle2`, `IdleHeadLow`, `Eat`, `Walk`, `Run` for the mammals, `Fly` for birds, `Swim` for the fish.
  Animations were resampled (tolerance 0.001) and every other clip (death, attack, jump, hit reactions) was dropped.
- The bounding box column is the rest-pose size x (width) by y (height) by z (length) in metres, measured in Blender after skinning.

## Files

| File | Stands in for | Tris | kB | Rigged | Clips (duration) | BBox x*y*z (m) | Textures | Licence | Author | Source | Obtained as |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `deer_stag.glb` | redDeer (stag); reindeer (recolour grey, see notes); roeBuck (scale down) | 3667 | 146 | yes, 38 joints | Eat (12.08s), Run (0.50s), Walk (1.17s), IdleHeadLow (3.33s), Idle2 (3.33s), Idle (3.33s) | 0.91 x 2.00 x 1.74 | none (flat material colours: Antlers_Hooves, Main_Light, Main, Main_Dark, Eye_Black) | CC0 1.0 | Quaternius | [Stag (Ultimate Animated Animals)](https://poly.pizza/m/tQdzbZ1Cmw) | GLB from Poly Pizza |
| `deer_doe.glb` | roeDeer; red deer hind; elk/moose stand-in (scale up, darken) | 2096 | 141 | yes, 46 joints | Eat (6.00s), Run (0.50s), Walk (1.17s), IdleHeadLow (3.33s), Idle2 (3.33s), Idle (3.33s) | 0.39 x 1.15 x 1.19 | none (flat material colours: Main_Light, Main, Main_Dark, Hooves, Eye_Lighter, Eye_Black, Eye_White) | CC0 1.0 | Quaternius | [Deer (Ultimate Animated Animals)](https://poly.pizza/m/T6Cs7tmMHJ) | GLB from Poly Pizza |
| `cattle_bull.glb` | aurochsBull (already near-black; add eel stripe / longer horns in engine) | 2418 | 155 | yes, 42 joints | Eat (6.00s), Run (0.58s), Walk (1.17s), IdleHeadLow (3.33s), Idle2 (3.33s), Idle (3.33s) | 1.01 x 1.85 x 3.25 | none (flat material colours: Main, Muzzle, Hooves, Main_Light, Eye_Black, Eye_White, Horns) | CC0 1.0 | Quaternius | [Bull (Ultimate Animated Animals)](https://poly.pizza/m/a8PIIYwF7r) | GLB from Poly Pizza |
| `cattle_cow.glb` | aurochsCow; aurochsCalf (scale 0.5); cattleIron; cattleFarm | 2450 | 157 | yes, 42 joints | Eat (6.00s), Run (0.58s), Walk (1.17s), IdleHeadLow (3.33s), Idle2 (3.33s), Idle (3.33s) | 0.81 x 1.60 x 2.81 | none (flat material colours: Main, Main_Light, Muzzle, Hooves, Eye_Black, Eye_White, Horns) | CC0 1.0 | Quaternius | [Cow (Ultimate Animated Animals)](https://poly.pizza/m/26zM1outCr) | GLB from Poly Pizza |
| `horse.glb` | horseTarpan; horseKonik; horseBay (recolour Main/Hair) | 2182 | 164 | yes, 50 joints | Eat (6.00s), Run (0.58s), Walk (1.17s), IdleHeadLow (3.33s), Idle2 (3.33s), Idle (3.33s) | 0.51 x 1.75 x 2.07 | none (flat material colours: Main, Hair, Main_Dark, Muzzle, Hooves, Main_Light, Eye_Black, Eye_White) | CC0 1.0 | Quaternius | [Horse (Ultimate Animated Animals)](https://poly.pizza/m/qvTrSG9pZF) | GLB from Poly Pizza |
| `wolf.glb` | wolf | 1962 | 154 | yes, 51 joints | Eat (2.50s), Run (0.54s), Walk (1.04s), IdleHeadLow (4.00s), Idle2 (3.33s), Idle (3.33s) | 0.38 x 0.95 x 1.92 | none (flat material colours: Main, Main_Light, Eyes_Black, Nose) | CC0 1.0 | Quaternius | [Wolf (Ultimate Animated Animals)](https://poly.pizza/m/P1gU3Qkr9r) | GLB from Poly Pizza |
| `fox.glb` | fox; arcticFox (recolour Main to grey-brown or white) | 1848 | 152 | yes, 51 joints | Eat (2.50s), Run (0.54s), Walk (1.04s), IdleHeadLow (4.00s), Idle2 (3.33s), Idle (3.33s) | 0.18 x 0.45 x 0.97 | none (flat material colours: Main, Main_Light, Grey, Black, Eyes) | CC0 1.0 | Quaternius | [Fox (Ultimate Animated Animals)](https://poly.pizza/m/Bc97C66HKi) | GLB from Poly Pizza |
| `dog_husky.glb` | dog (optional addition; spitz/laika type) | 1920 | 148 | yes, 49 joints | Eat (2.67s), Run (0.54s), Walk (1.04s), Idle2 (3.33s), IdleHeadLow (4.00s), Idle (3.33s) | 0.21 x 0.68 x 0.84 | none (flat material colours: Main, Main_Light, Black, Eye_White, Eye_Black) | CC0 1.0 | Quaternius | [Husky (Ultimate Animated Animals)](https://poly.pizza/m/wcWiuEqwzq) | GLB from Poly Pizza |
| `pig.glb` | pig (recolour Material.003 pink -> dark for Iron Age pig); boar fallback | 562 | 83 | yes, 24 joints | Idle (6.25s), Run (0.92s), Walk (2.67s) | 0.52 x 0.72 x 1.53 | none (flat material colours: Main, Dark) | CC0 1.0 | Quaternius | [Pig (Farm Animals Pack)](https://opengameart.org/content/lowpoly-animated-farm-animal-pack) | .blend from OpenGameArt, exported with Blender 5.3 |
| `sheep.glb` | sheepDark (recolour White -> dark brown/grey); sheepWhite | 612 | 84 | yes, 24 joints | Idle (6.25s), Run (0.83s), Walk (2.67s) | 0.40 x 0.78 x 1.06 | none (flat material colours: White, Black) | CC0 1.0 | Quaternius | [Sheep (Farm Animals Pack)](https://opengameart.org/content/lowpoly-animated-farm-animal-pack) | .blend from OpenGameArt, exported with Blender 5.3 |
| `boar_rigged.glb` | boar (animated alternative; rougher look) | 1144 | 106 | yes, 32 joints | Attack (0.79s), Walk (1.67s) | 0.56 x 0.95 x 1.46 | jpeg 256x256 10kB | CC0 1.0 | Saltflower | [Boar](https://opengameart.org/content/boar) | .blend from OpenGameArt, exported with Blender 5.3 |
| `fish_rudd.glb` | roach, roachShoal (rudd is a near-identical cyprinid); bream (scale y 1.3); perch stand-in | 1476 | 65 | yes, 12 joints | Swim (3.33s) | 0.10 x 0.13 x 0.25 | jpeg 256x256 18kB | CC0 1.0 | XaosXV (Cestmir Dammer, kelgar.org) | [Fish (Animated) - Scardinius](https://opengameart.org/content/fish-animated) | .blend from OpenGameArt, exported with Blender 5.3 |
| `raptor_eagle.glb` | buzzard (extra; recolour Head/Wings brown) | 1532 | 69 | yes, 24 joints | Fly (1.25s), Idle (1.67s) | 1.20 x 0.11 x 0.50 | none (flat material colours: Wings, Beak, Head, Claws) | CC0 1.0 | Quaternius | [Eagle (Animal Pack Vol.2)](https://opengameart.org/content/animated-animales-low-poly) | .blend from OpenGameArt, exported with Blender 5.3 |
| `songbird.glb` | swallow / wagtail (extra; recolour); kingfisher alternative with flap | 158 | 16 | yes, 11 joints | Fly (0.67s) | 0.30 x 0.16 x 0.37 | none (flat material colours: Material.002, Material.006) | CC0 1.0 | Quaternius | [Bird (Animals Pack)](https://opengameart.org/content/5-low-poly-animals) | .blend from OpenGameArt, exported with Blender 5.3 |
| `boar.glb` | boar (static, better-looking) | 782 | 20 | no (static) | none | 0.59 x 0.95 x 1.69 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Boar](https://poly.pizza/m/57fSWum6F1P) | GLB from Poly Pizza |
| `hare.glb` | hare; arcticHare/mountain hare (tint grey) | 994 | 30 | no (static) | none | 0.26 x 0.55 x 0.55 | jpeg 256x256 11kB | CC-BY 3.0 | Poly by Google | [Jackrabbit](https://poly.pizza/m/biNOm96olTH) | GLB from Poly Pizza |
| `beaver.glb` | beaver | 568 | 15 | no (static) | none | 0.32 x 0.34 x 0.95 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Beaver](https://poly.pizza/m/fwtA7VLrXPr) | GLB from Poly Pizza |
| `otter.glb` | otter | 1084 | 24 | no (static) | none | 0.35 x 0.48 x 1.05 | jpeg 256x256 4kB | CC-BY 3.0 | Poly by Google | [River otter](https://poly.pizza/m/dJW3JeUWXQ-) | GLB from Poly Pizza |
| `squirrel.glb` | squirrel (grey model; tint rufous for red squirrel) | 716 | 18 | no (static) | none | 0.13 x 0.20 x 0.40 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Squirrel](https://poly.pizza/m/caxos24uWC9) | GLB from Poly Pizza |
| `stork_white.glb` | stork | 370 | 15 | no (static) | none | 0.27 x 1.05 x 0.72 | jpeg 256x256 7kB | CC-BY 3.0 | Gwym Hendawyr | [White stork](https://poly.pizza/m/aRlrdbGgvQC) | GLB from Poly Pizza |
| `heron.glb` | heron (grey heron) | 668 | 18 | no (static) | none | 0.22 x 0.95 x 0.63 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Heron](https://poly.pizza/m/74guNhJR5Ij) | GLB from Poly Pizza |
| `duck_mallard.glb` | duckM; duckF (tint brown); goldeneye/goosander by tint (weak) | 656 | 16 | no (static) | none | 0.21 x 0.40 x 0.55 | jpeg 256x256 5kB | CC-BY 3.0 | Poly by Google | [Mallard duck](https://poly.pizza/m/frSLi6b6Vid) | GLB from Poly Pizza |
| `duck_diver_loon.glb` | stand-in for duckGoldeneyeM / duckGoosanderM (black-and-white diving bird; actually a loon) | 654 | 23 | no (static) | none | 0.23 x 0.43 x 0.60 | jpeg 256x256 12kB | CC-BY 3.0 | Poly by Google | [Common loon](https://poly.pizza/m/5ijiY1ScLbe) | GLB from Poly Pizza |
| `swan_standin.glb` | swanWhooper / swanMute stand-in (a long-necked white 'duck'; no true swan found) | 296 | 9 | no (static) | none | 0.43 x 1.00 x 1.08 | jpeg 32x32 0kB | CC-BY 3.0 | Poly by Google | [Duck](https://poly.pizza/m/4hp6pk_ojG2) | GLB from Poly Pizza |
| `goose.glb` | goose (farm goose) | 1076 | 18 | no (static) | none | 0.37 x 0.75 x 0.88 | none (flat material colours: initialShadingGroup, lambert4SG, lambert5SG, lambert3SG) | CC-BY 3.0 | Poly by Google | [Duck](https://poly.pizza/m/6HpauUCfIAb) | GLB from Poly Pizza |
| `quail_ptarmigan.glb` | ptarmigan stand-in (quail; tint mottled brown) | 398 | 12 | no (static) | none | 0.16 x 0.30 x 0.42 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Quail](https://poly.pizza/m/3WonMe83zEX) | GLB from Poly Pizza |
| `rooster.glb` | rooster; blackGrouse stand-in (tint black) | 1200 | 28 | no (static) | none | 0.22 x 0.60 x 0.56 | jpeg 256x256 8kB | CC-BY 3.0 | Poly by Google | [Rooster](https://poly.pizza/m/6NTegstc5Jy) | GLB from Poly Pizza |
| `hen.glb` | chicken | 592 | 16 | no (static) | none | 0.20 x 0.42 x 0.34 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Hen](https://poly.pizza/m/8Unya0rw9tR) | GLB from Poly Pizza |
| `bear_brown.glb` | brown bear (optional addition) | 570 | 16 | no (static) | none | 0.62 x 1.15 x 1.77 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Bear](https://poly.pizza/m/0PXWfxfb0Hu) | GLB from Poly Pizza |
| `goat.glb` | goat (optional addition) | 958 | 22 | no (static) | none | 0.33 x 0.95 x 1.05 | jpeg 256x256 6kB | CC-BY 3.0 | Poly by Google | [Goat](https://poly.pizza/m/d7dImmjtF8E) | GLB from Poly Pizza |
| `lynx_bobcat.glb` | lynx (optional addition; bobcat model, same genus) | 1034 | 33 | no (static) | none | 0.29 x 0.75 x 1.21 | jpeg 256x256 15kB | CC-BY 3.0 | Poly by Google | [Bobcat](https://poly.pizza/m/bvsVdF1hLme) | GLB from Poly Pizza |
| `marten_weasel.glb` | pine marten (optional addition; long-tailed weasel model) | 876 | 24 | no (static) | none | 0.10 x 0.31 x 0.70 | jpeg 256x256 8kB | CC-BY 3.0 | Poly by Google | [Long-tailed weasel](https://poly.pizza/m/4fUZKhsSs42) | GLB from Poly Pizza |
| `frog.glb` | frog | 904 | 34 | no (static) | none | 0.09 x 0.05 x 0.09 | png 1024x1024 6kB | CC0 1.0 | AssetQuest | [Green Frog](https://poly.pizza/m/yK6MyLkuob) | GLB from Poly Pizza |
| `butterfly.glb` | butterflyW/O/Y (static, wings spread; tint per colour) | 528 | 14 | no (static) | none | 0.06 x 0.01 x 0.04 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Butterfly](https://poly.pizza/m/eZBvUobx7mb) | GLB from Poly Pizza |
| `dragonfly.glb` | dragonfly (extra) | 466 | 12 | no (static) | none | 0.10 x 0.03 x 0.07 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Dragonfly](https://poly.pizza/m/0myA_BOcZrD) | GLB from Poly Pizza |
| `fish_trout.glb` | troutBrown; grayling (tint grey); fishPike stand-in (stretch z 1.6, tint green) | 876 | 15 | no (static) | none | 0.05 x 0.15 x 0.30 | none (flat material colours: Green, Orange, LightOrange, White, Black) | CC-BY 3.0 | Poly by Google | [Trout](https://poly.pizza/m/0HCLwTdxvz5) | GLB from Poly Pizza |
| `fish_generic.glb` | grayling / perch / generic silver fish | 506 | 14 | no (static) | none | 0.08 x 0.12 x 0.35 | png 32x32 0kB | CC-BY 3.0 | Poly by Google | [Fish](https://poly.pizza/m/aEyLrUMMoUK) | GLB from Poly Pizza |
| `kingfisher_bluejay.glb` | kingfisher stand-in (blue jay model: blue back, but crest and long tail are wrong) | 884 | 26 | no (static) | none | 0.08 x 0.12 x 0.24 | none (flat material colours: FFFFFF, 1A1A1A, 039BE5) | CC-BY 3.0 | jeremy | [Bluejay](https://poly.pizza/m/dWfeVtr7M49) | GLB from Poly Pizza |

## Recolouring

The eight "Ultimate Animated Animals" models and the pig and sheep use a handful of named flat-colour materials and no
textures, so a species variant is a matter of cloning the materials and setting `material.color`. Material names:

- `deer_stag.glb`: `Antlers_Hooves`, `Main_Light`, `Main`, `Main_Dark`, `Eye_Black`
- `deer_doe.glb`: `Main_Light`, `Main`, `Main_Dark`, `Hooves`, `Eye_Lighter`, `Eye_Black`, `Eye_White`
- `cattle_bull.glb`: `Main`, `Muzzle`, `Hooves`, `Main_Light`, `Eye_Black`, `Eye_White`, `Horns`
- `cattle_cow.glb`: `Main`, `Main_Light`, `Muzzle`, `Hooves`, `Eye_Black`, `Eye_White`, `Horns`
- `horse.glb`: `Main`, `Hair`, `Main_Dark`, `Muzzle`, `Hooves`, `Main_Light`, `Eye_Black`, `Eye_White`
- `wolf.glb`: `Main`, `Main_Light`, `Eyes_Black`, `Nose`
- `fox.glb`: `Main`, `Main_Light`, `Grey`, `Black`, `Eyes`
- `dog_husky.glb`: `Main`, `Main_Light`, `Black`, `Eye_White`, `Eye_Black`
- `pig.glb`: `Main`, `Dark`
- `sheep.glb`: `White`, `Black`
- `raptor_eagle.glb`: `Wings`, `Beak`, `Head`, `Claws`
- `songbird.glb`: `Material.002`, `Material.006`

Suggested variants (colours are sRGB hex taken from the existing `SPECIES` table in `src/animals.js`):

- reindeer from `deer_stag.glb`: `Main` 0x8a8378, `Main_Dark` 0x6e675e, `Main_Light` 0xb5afa4, `Antlers_Hooves` 0x6b5a48, scale to about 1.6 m total height.
- elk (moose) from `deer_doe.glb`: `Main` 0x4d4136, `Main_Dark` 0x3a3028, `Main_Light` 0x5c5044, scale to about 2.2 m total height, and parent the existing procedural palmate antlers to the `Head` bone.
- aurochs bull from `cattle_bull.glb` as shipped (it is already near black), aurochs cow from `cattle_cow.glb` with `Main` 0x5c3a24. Longer horns can be parented to the `Head` bone.
- Iron Age cattle from `cattle_cow.glb` scaled to about 1.15 m total height with the three browns already in the table.
- dark sheep from `sheep.glb`: `White` set to 0x4d4238, 0x6e6055 or 0x8c8175.
- Iron Age pig from `pig.glb`: `Main` 0x3d3229.
- Konik and tarpan from `horse.glb`: `Main` 0x85807a or 0x8a7a5c, `Main_Light` slightly lighter, `Main_Dark` and `Hair` 0x181513.
- arctic fox from `fox.glb`: `Main` 0x6e6256 (summer) or 0xe8e4da (winter), `Main_Light` 0xd8cfbf.

The Poly by Google models and the other static models carry one material with a small palette or painted texture, so they
can only be tinted as a whole (`material.color` multiplies the texture).

## Rig notes

The "Ultimate Animated Animals" rigs share one bone naming scheme: `Body`, `Back`, `Torso`, `Torso2`, `Torso3`, `Neck1..3`, `Head`,
`FrontShoulder.L/R`, `FrontUpperLeg.L/R`, `FrontLowerLeg.L/R`, `BackShoulder.L/R`, `BackLeg.L/R`, `BackUpperLeg.L/R`, `BackLowerLeg.L/R`, `Tail1..3`
(three.js sanitises the dots away, so `FrontShoulder.L` becomes `FrontShoulderL`). `Eat` lowers the head to the ground and is the graze loop.
`Run` is a gallop. Joint lists per file:

- `deer_stag.glb`: Body, Back, Torso, Torso2, Torso3, Neck1, Neck2, Neck3, Head, FrontShoulder.L, FrontUpperLeg.L, FrontLowerLeg.L, FrontShoulder.R, FrontUpperLeg.R, FrontLowerLeg.R, BackShoulder.L, BackLeg.L, BackUpperLeg.L, BackLowerLeg.L, BackShoulder.R, BackLeg.R, BackUpperLeg.R, BackLowerLeg.R, Tail1, Tail2, Tail3, PoleTargetBack.L, PoleTarget.L, PoleTargetBack.R, PoleTarget.R, IKBackLeg.L, FFB.L, IKFrontLeg.L, FF.L, IKBackLeg.R, FFB.R, IKFrontLeg.R, FF.R
- `deer_doe.glb`: Body, Back, Torso, Torso2, Torso3, Neck1, Neck2, Neck3, Head, Ear1.L, Ear2.L, Ear3.L, Ear4.L, Ear1.R, Ear2.R, Ear3.R, Ear4.R, FrontShoulder.L, FrontUpperLeg.L, FrontLowerLeg.L, FrontShoulder.R, FrontUpperLeg.R, FrontLowerLeg.R, BackShoulder.L, BackLeg.L, BackUpperLeg.L, BackLowerLeg.L, BackShoulder.R, BackLeg.R, BackUpperLeg.R, BackLowerLeg.R, Tail1, Tail2, Tail3, PoleTargetBack.L, PoleTarget.L, PoleTargetBack.R, PoleTarget.R, IKBackLeg.L, FFB.L, IKFrontLeg.L, FF.L, IKBackLeg.R, FFB.R, IKFrontLeg.R, FF.R
- `cattle_bull.glb`: Body, Back, Torso, Torso2, Torso3, Neck1, Neck2, Neck3, Head, FrontShoulder.L, FrontUpperLeg.L, FrontLowerLeg.L, FrontShoulder.R, FrontUpperLeg.R, FrontLowerLeg.R, BackShoulder.L, BackLeg.L, BackUpperLeg.L, BackLowerLeg.L, BackShoulder.R, BackLeg.R, BackUpperLeg.R, BackLowerLeg.R, Tail1, Tail2, Tail3, Tail4, Tail5, Tail6, Tail7, PoleTargetBack.L, PoleTarget.L, PoleTargetBack.R, PoleTarget.R, IKBackLeg.L, FFB.L, IKFrontLeg.L, FF.L, IKBackLeg.R, FFB.R, IKFrontLeg.R, FF.R
- `cattle_cow.glb`: Body, Back, Torso, Torso2, Torso3, Neck1, Neck2, Neck3, Head, FrontShoulder.L, FrontUpperLeg.L, FrontLowerLeg.L, FrontShoulder.R, FrontUpperLeg.R, FrontLowerLeg.R, BackShoulder.L, BackLeg.L, BackUpperLeg.L, BackLowerLeg.L, BackShoulder.R, BackLeg.R, BackUpperLeg.R, BackLowerLeg.R, Tail1, Tail2, Tail3, Tail4, Tail5, Tail6, Tail7, PoleTargetBack.L, PoleTarget.L, PoleTargetBack.R, PoleTarget.R, IKBackLeg.L, FFB.L, IKFrontLeg.L, FF.L, IKBackLeg.R, FFB.R, IKFrontLeg.R, FF.R
- `horse.glb`: Body, Back, Torso, Torso2, Torso3, Neck1, Neck2, Neck3, Head, Ear1.L, Ear2.L, Ear3.L, Ear4.L, Ear1.R, Ear2.R, Ear3.R, Ear4.R, FrontShoulder.L, FrontUpperLeg.L, FrontLowerLeg.L, FrontShoulder.R, FrontUpperLeg.R, FrontLowerLeg.R, BackShoulder.L, BackLeg.L, BackUpperLeg.L, BackLowerLeg.L, BackShoulder.R, BackLeg.R, BackUpperLeg.R, BackLowerLeg.R, Tail1, Tail2, Tail3, Tail4, Tail5, Tail6, Tail7, PoleTargetBack.L, PoleTarget.L, PoleTargetBack.R, PoleTarget.R, IKBackLeg.L, FFB.L, IKFrontLeg.L, FF.L, IKBackLeg.R, FFB.R, IKFrontLeg.R, FF.R
- `wolf.glb`: Body, Back, Torso, Torso2, Torso3, Neck1, Neck2, Neck3, Head, Ear1.L, Ear2.L, Ear3.L, Ear4.L, Ear1.R, Ear2.R, Ear3.R, Ear4.R, FrontShoulder.L, FrontUpperLeg.L, FrontLowerLeg.L, FrontShoulder.R, FrontUpperLeg.R, FrontLowerLeg.R, BackShoulder.L, BackLeg.L, BackUpperLeg.L, BackLowerLeg.L, BackShoulder.R, BackLeg.R, BackUpperLeg.R, BackLowerLeg.R, Tail1, Tail2, Tail3, Tail4, Tail5, Tail6, Tail7, Tail8, PoleTargetBack.L, PoleTarget.L, PoleTargetBack.R, PoleTarget.R, IKBackLeg.L, FFB.L, IKFrontLeg.L, FF.L, IKBackLeg.R, FFB.R, IKFrontLeg.R, FF.R
- `fox.glb`: Body, Back, Torso, Torso2, Torso3, Neck1, Neck2, Neck3, Head, Ear1.L, Ear2.L, Ear3.L, Ear4.L, Ear1.R, Ear2.R, Ear3.R, Ear4.R, FrontShoulder.L, FrontUpperLeg.L, FrontLowerLeg.L, FrontShoulder.R, FrontUpperLeg.R, FrontLowerLeg.R, BackShoulder.L, BackLeg.L, BackUpperLeg.L, BackLowerLeg.L, BackShoulder.R, BackLeg.R, BackUpperLeg.R, BackLowerLeg.R, Tail1, Tail2, Tail3, Tail4, Tail5, Tail6, Tail7, Tail8, PoleTargetBack.L, PoleTarget.L, PoleTargetBack.R, PoleTarget.R, IKBackLeg.L, FFB.L, IKFrontLeg.L, FF.L, IKBackLeg.R, FFB.R, IKFrontLeg.R, FF.R
- `dog_husky.glb`: Body, Back, Torso, Torso2, Torso3, Neck1, Neck2, Neck3, Head, Ear1.L, Ear2.L, Ear3.L, Ear4.L, Ear1.R, Ear2.R, Ear3.R, Ear4.R, FrontShoulder.L, FrontUpperLeg.L, FrontLowerLeg.L, FrontShoulder.R, FrontUpperLeg.R, FrontLowerLeg.R, BackShoulder.L, BackLeg.L, BackUpperLeg.L, BackLowerLeg.L, BackShoulder.R, BackLeg.R, BackUpperLeg.R, BackLowerLeg.R, Tail1, Tail2, Tail3, Tail4, Tail5, Tail6, PoleTargetBack.L, PoleTarget.L, PoleTargetBack.R, PoleTarget.R, IKBackLeg.L, FFB.L, IKFrontLeg.L, FF.L, IKBackLeg.R, FFB.R, IKFrontLeg.R, FF.R
- `pig.glb`: root, BackFoot.L, BackFoot.R, Body, Back, BackLeg.L, BackUpLeg.L, BackLowLeg.L, BackLeg.R, BackUpLeg.R, BackLowLeg.R, FrontLeg.L, FrontUpLeg.L, FrontLowLeg.L, FrontLeg.R, FrontUpLeg.R, FrontLowLeg.R, Hips, Torso, Shoulders, Neck, Head, FrontFoot.L, FrontFoot.R
- `sheep.glb`: root, BackFoot.L, BackFoot.R, Body, Back, BackLeg.L, BackUpLeg.L, BackLowLeg.L, BackLeg.R, BackUpLeg.R, BackLowLeg.R, FrontLeg.L, FrontUpLeg.L, FrontLowLeg.L, FrontLeg.R, FrontUpLeg.R, FrontLowLeg.R, Hips, Torso, Shoulders, Neck, Head, FrontFoot.L, FrontFoot.R
- `boar_rigged.glb`: ROOT, body.001_L.004, body.001_R.004, body_L.004, body_R.004, Hips, body, body.001, body.001_L, body.001_L.001, body.001_L.003, body.001_L.002, body.001_R, body.001_R.001, body.001_R.003, body.001_R.002, body.002, head, nose, body_L, body_L.001, body_L.003, body_L.002, body_R, body_R.001, body_R.003, body_R.002, tail, tail.001, tail.002, tail.003, tail.004
- `fish_rudd.glb`: Root, Bone.001, Bone.001_L.001, Bone.001_R.001, Bone.002, Bone.003, Bone.004, Bone.005, Bone.006, Bone.007, Bone.008, IK
- `raptor_eagle.glb`: Bone, Bone.001, Bone.002, Bone.003, Bone.004, Bone.005, Bone.006, Bone.007, Bone.008, Bone.009, Bone.010, Bone.011, Bone.012, Bone.013, Bone.014, Bone.015, Bone.016, Bone.017, Bone.018, Bone.019, Bone.020, Bone.021, Bone.022, Bone.023
- `songbird.glb`: Bone, Bone.001, Bone.002, Bone.003, Bone.004, Bone.005, Bone.006, Bone.007, Bone.008, Bone.009, neutral_bone

## Species without a suitable model

- **Reindeer**: no free reindeer model found. Stand-in: `deer_stag.glb` recoloured grey. The antlers are red-deer shaped, not the forward-swept reindeer shape.
- **Elk / European moose**: no free moose found (Poly Pizza only has a wapiti called "Elk" and a loose "Moose antlers" prop). Stand-in: `deer_doe.glb` scaled up and darkened, with the engine's procedural palmate antlers on the `Head` bone. The long nose, hump and dewlap are missing.
- **Aurochs**: no aurochs model. Stand-ins: `cattle_bull.glb` and `cattle_cow.glb`. Their horns are short, so the long forward-curving horns would have to be added in the engine. The calf is the cow scaled to about half.
- **Wild boar**: two options. `boar.glb` looks better but is static. `boar_rigged.glb` walks but has a rougher painted texture and no idle or eat clip.
- **Swans**: no swan model under a usable licence. `swan_standin.glb` is a long-necked white "duck" from Poly by Google with a yellow bill, which reads acceptably as a whooper swan on the water at a distance. The mute swan would need the bill tinted orange.
- **Goosander and goldeneye**: none found. Closest are `duck_mallard.glb` tinted, or `duck_diver_loon.glb` (a common loon, black and white) for the drakes.
- **Kingfisher**: none found. `kingfisher_bluejay.glb` is a blue jay (blue, but crested and long-tailed). `songbird.glb` recoloured blue and orange is the alternative and has a flap clip.
- **Black grouse and ptarmigan**: none found. Stand-ins: `rooster.glb` tinted black and `quail_ptarmigan.glb`.
- **Arctic fox, mountain hare, roe deer, Konik, primitive cattle, dark sheep**: covered by recolouring and scaling the fox, hare, doe, horse, cow and sheep.
- **Pike, perch, bream, grayling**: no dedicated models. `fish_rudd.glb` (a rudd, rigged, with a swim loop) is a close match for roach and works for bream and perch when stretched and tinted. `fish_trout.glb` is a real trout but is modelled in a curved leaping pose. `fish_generic.glb` is a straight silver fish that suits grayling, and pike when stretched.
- **Hare, beaver, otter, squirrel, stork, heron, ducks, chicken, rooster, frog, butterfly**: found, but only as static meshes. They need procedural motion (bob, hop, glide). The butterfly is one mesh with spread wings, so its wings cannot flap separately.
- **Squirrel**: the model is a grey squirrel and needs a rufous tint for the red squirrel.
- **Woolly mammoth**: not found. The only candidate was a plain low-poly elephant from Poly by Google (CC-BY 3.0, https://poly.pizza/m/cx0-TiCjDOx), which was not shipped.
- **Pine marten, lynx**: shipped as close relatives (`marten_weasel.glb` is a long-tailed weasel, `lynx_bobcat.glb` is a bobcat). Both are static.
- **Brown bear, goat**: static only. **Dog**: `dog_husky.glb`, rigged.

## Sources looked at and rejected

- three.js example models `Horse.glb`, `Stork.glb`, `Flamingo.glb`, `Parrot.glb`: they come from the 2011 "ROME / 3 Dreams of Black" project. The repository code is Apache 2.0 but no clear redistribution licence for the models themselves could be confirmed, so they were left out.
- Khronos glTF sample `Fox`: licence is fine (CC0 model by PixelMannen, CC-BY 4.0 rigging by tomkranis), but it is a different, textured style and the Quaternius fox already covers the species.
- Quaternius "Animated Animals" cube-style set on Poly Pizza (blocky sheep, pig, wolf, horse, chicken): CC0 but Minecraft-like, which would clash with the rest.
- Sketchfab: downloads need a login, so nothing was taken from there.
- Smithsonian Open Access and other museum scans: not used. They are skeletons or taxidermy at millions of triangles and would not match the low-poly set.
- OpenGameArt "Low Poly Bear" (CC-BY 4.0): untextured static mesh, worse than the Poly by Google bear.

## Attribution (ready to paste)

- [White stork](https://poly.pizza/m/aRlrdbGgvQC) by **Gwym Hendawyr**, licensed [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). Modified: normals removed, textures downscaled, rescaled and re-oriented.
- [Boar](https://poly.pizza/m/57fSWum6F1P), [Jackrabbit](https://poly.pizza/m/biNOm96olTH), [Beaver](https://poly.pizza/m/fwtA7VLrXPr), [River otter](https://poly.pizza/m/dJW3JeUWXQ-), [Squirrel](https://poly.pizza/m/caxos24uWC9), [Heron](https://poly.pizza/m/74guNhJR5Ij), [Mallard duck](https://poly.pizza/m/frSLi6b6Vid), [Common loon](https://poly.pizza/m/5ijiY1ScLbe), [Duck](https://poly.pizza/m/4hp6pk_ojG2), [Duck](https://poly.pizza/m/6HpauUCfIAb), [Quail](https://poly.pizza/m/3WonMe83zEX), [Rooster](https://poly.pizza/m/6NTegstc5Jy), [Hen](https://poly.pizza/m/8Unya0rw9tR), [Bear](https://poly.pizza/m/0PXWfxfb0Hu), [Goat](https://poly.pizza/m/d7dImmjtF8E), [Bobcat](https://poly.pizza/m/bvsVdF1hLme), [Long-tailed weasel](https://poly.pizza/m/4fUZKhsSs42), [Butterfly](https://poly.pizza/m/eZBvUobx7mb), [Dragonfly](https://poly.pizza/m/0myA_BOcZrD), [Trout](https://poly.pizza/m/0HCLwTdxvz5), [Fish](https://poly.pizza/m/aEyLrUMMoUK) by **Poly by Google**, licensed [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). Modified: normals removed, textures downscaled, rescaled and re-oriented.
- [Bluejay](https://poly.pizza/m/dWfeVtr7M49) by **jeremy**, licensed [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). Modified: normals removed, textures downscaled, rescaled and re-oriented.
- [Green Frog](https://poly.pizza/m/yK6MyLkuob) by **AssetQuest**, licensed [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- [Stag (Ultimate Animated Animals)](https://poly.pizza/m/tQdzbZ1Cmw), [Deer (Ultimate Animated Animals)](https://poly.pizza/m/T6Cs7tmMHJ), [Bull (Ultimate Animated Animals)](https://poly.pizza/m/a8PIIYwF7r), [Cow (Ultimate Animated Animals)](https://poly.pizza/m/26zM1outCr), [Horse (Ultimate Animated Animals)](https://poly.pizza/m/qvTrSG9pZF), [Wolf (Ultimate Animated Animals)](https://poly.pizza/m/P1gU3Qkr9r), [Fox (Ultimate Animated Animals)](https://poly.pizza/m/Bc97C66HKi), [Husky (Ultimate Animated Animals)](https://poly.pizza/m/wcWiuEqwzq), [Pig (Farm Animals Pack)](https://opengameart.org/content/lowpoly-animated-farm-animal-pack), [Sheep (Farm Animals Pack)](https://opengameart.org/content/lowpoly-animated-farm-animal-pack), [Eagle (Animal Pack Vol.2)](https://opengameart.org/content/animated-animales-low-poly), [Bird (Animals Pack)](https://opengameart.org/content/5-low-poly-animals) by **Quaternius**, licensed [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- [Boar](https://opengameart.org/content/boar) by **Saltflower**, licensed [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- [Fish (Animated) - Scardinius](https://opengameart.org/content/fish-animated) by **XaosXV (Cestmir Dammer, kelgar.org)**, licensed [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

CC0 works need no attribution, and their authors are credited here as a courtesy. The CC-BY 3.0 entries are the ones that must stay in the site credits.

## Added later

| File | Stands in for | Tris | kB | Rigged | Licence | Author | Source |
|---|---|---|---|---|---|---|---|
| `elephant.glb` | woolly mammoth and calf. Unmodified download, in centimetres and centred on its middle. `src/animal-models.js` (`mammothify`) reshapes it at load: ears, crown, back line, tusks, coat | 934 | 64 | no | CC-BY 3.0 | Poly by Google | https://poly.pizza/m/cx0-TiCjDOx |
