# EExLCC KubeJS Utils

Commands, blocks, and items for the EExLCC Cobblemon server.

## Commands

`<arguments>` are required; `[arguments]` are optional. Party slots are numbered
1–6. Commands require operator permissions except badge granting, which requires
the `gym_leader` player tag. Use tab completion for available choices.

| Command | Usage |
| --- | --- |
| `/pokeclone <slot> [player]` | Copy a Pokémon from your party to yourself or another online player. |
| `/resetevs <slot>` | Clear all EVs on one of your party Pokémon. |
| `/pokegivemaxed <species> [properties]` | Give yourself a level 100 Pokémon with perfect IVs, an Ancient Origin Ball, and the Admin Ribbon. |
| `/pokemax <slot> [properties]` | Set a party Pokémon to level 100, perfect IVs, and an Ancient Origin Ball. |
| `/hypertrain <slot> <preset>` | Reset EVs, then set two stats to 252 EVs and apply the preset's nature. |
| `/hypertrain <slot> custom <stat1> <stat2> <nature>` | Choose two different EV stats and a nature modifier such as `+attack-special_attack` or `neutral`. |
| `/grant badge <choice> <player>` | Award a badge. Choices include types such as `fire`, plus `generic`, `league`, and `special_1` through `special_16`. |
| `/grant trophy <choice> <player>` | Award a `tournament` or `champion` trophy. |
| `/checkallspawns` | Check the common, uncommon, rare, ultra-rare, and boss spawn pools at your location. |
| `/npclistspawn [list]` | Spawn a random NPC from a configured list at your location. Defaults to `test`. |
| `/npclistspawnat <x> <y> <z> [list]` | Spawn a random NPC at the given position. Defaults to `test`. |
| `/msd give [player] <category> <entry> [count]` | Give a Mega Showdown item to yourself or a player. Count defaults to 1, up to 64. |

Hypertrain presets: `fast_attacker`, `fast_special_attacker`, `physical_tank`,
`special_tank`, `bulky_physical_attacker`, `bulky_special_attacker`, and
`fast_support`.

Mega Showdown categories: `mega`, `zcrystal`, `showdown_item`, `held_form_change`,
`solo_fusion`, `du_fusion`, `form_change_interact`, and
`form_change_toggle_interact`.

## Gift Balls

Craft a Gift Ball with two Link Cables surrounding the matching Poké Ball in a
horizontal row. Variants include `kubejs:poke_gift_ball`,
`kubejs:great_gift_ball`, and `kubejs:myth_gift_ball`.

Right-click an empty Gift Ball and choose a party Pokémon to store. Give the
filled ball to another player, who can right-click to receive the Pokémon.
The Pokémon keeps its stored details and receives the Gift Ball's matching
caught ball. Gift Balls cannot be used during battle.

## Stickers

Right-click a sticker and choose a party Pokémon to apply it to. One sticker is
consumed on success. Canceling or choosing a Pokémon that already has the trait
consumes nothing. Stickers have epic rarity, cannot be crafted, and cannot be
used during battle.

| Item | Effect |
| --- | --- |
| `kubejs:sticker_alpha` | Makes the Pokémon Alpha and grants and activates its Alpha Mark. Toggle glowing eyes through the mark menu. |
| `kubejs:sticker_shiny` | Makes the Pokémon Shiny. |

## Badges and Trophies

Use `/grant` to award badges and trophies. Their tooltips show who earned them
and who granted them. Tournament and Champion Trophies can be placed as blocks
and keep their award details when picked up. Jade also shows these details when
looking at a placed trophy.

## Blocks

| Block | Usage |
| --- | --- |
| Pokémon Statue (`kubejs:pkmn_statue`) | Stonecut polished andesite to craft. Requires two blocks of vertical space. |
| Data Manipulator (`kubejs:data_manipulator`) | Right-click to open the general move tutor menu. |
| Poké Tables (`kubejs:poke_table_<ball>`) | Decorative tables in `poke_ball`, `great_ball`, `ultra_ball`, and `master_ball` variants. Craft with the matching ball above a Create Shaft above a Smooth Stone Slab. |
| Dense Apricorns (`kubejs:<color>_apricorn_dense`) | Combine nine same-color Apricorns into a storage block; craft it back into nine Apricorns. |
| Glyphed Blocks (`kubejs:<glyph>_glyphed_<material>`) | Stonecut sandstone, red sandstone, or end stone into decorative Unown blocks. Glyphs are `a`–`z` or `blank`. |

### Lumisene Furnace

Fill `kubejs:lumisene_furnace` with Lumisene by right-clicking with a fluid
container or using pipes. It holds 16 buckets. Apply a redstone pulse to summon
a Lumisene Construct near a hostile mob within 32 blocks. Each successful summon
uses one bucket and requires a safe spawn position near the mob. A comparator
reads the fuel level.

Craft using this pattern: `D` = Polished Deepslate, `B` = Netherite Dot Bolt,
`N` = Nether Star, and `T` = Create Fluid Tank.

```text
DBD
BNB
DTD
```

Tutor UI items (`kubejs:tutor_ui_*`) are icons for the move tutor menus.
