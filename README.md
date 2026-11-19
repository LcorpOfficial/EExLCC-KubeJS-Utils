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
| `/pokegivemaxed <species> [properties]` | Give yourself a level 100 Pokémon with perfect IVs, an Ancient Origin Ball, and the Admin Ribbon when available. |
| `/pokemax <slot> [properties]` | Set a party Pokémon to level 100, perfect IVs, and an Ancient Origin Ball; grant the Admin Ribbon when available. |
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

## Poké Lures

Throw a Poké Lure to spawn a wild Pokémon where it hits. Native variants are
`kubejs:poke_lure`, `kubejs:spooky_poke_lure`, and `kubejs:festive_poke_lure`.
The base lure has 5% Alpha, 1% Shiny, and natural IVs. Seasonal lures always have
at least three perfect IVs. The optional `min_perfect_ivs` setting controls this
minimum and is disabled by default. All retain 50% Hidden Ability by default.
Levels use 80% of the highest party level, rounded down with a minimum baseline
of 25, then vary by -4 to +4 (minimum final level 21). Failed impacts return the
lure. Existing lure stacks convert automatically.

Daily rewards give one Lure Ticket. Successfully spawning a Pokémon with a
lure awards the Let's Go Gambling advancement.

Operators can use `/pokelure give <variant> [player] [count]` or customize the
held stack with `/pokelure configure <JSON>`. Pools and odds are configured in
[poke_lures.json](config/poke_lures.json); names, textures, and tooltips are in
[the startup catalog](startup_scripts/poke_lures.js). Restart for installation.
See [lure configuration and migration](config/POKE_LURES.md) for pool schemas,
marks, per-stack settings, and replacing the old daily reward helper.

## Redeem Items

These items use the supplied sprites and two-line Gift-o-Tron tooltips.
Configure their costs and rewards on the machine.

| Item | Rarity |
| --- | --- |
| `kubejs:lure_ticket` | Epic |
| `kubejs:spooky_ticket` | Epic |
| `kubejs:festive_ticket` | Epic |
| `kubejs:tricked_treat` | Rare |
| `kubejs:holiday_cheer` | Rare |

All three Poké Lures are also epic rarity. Restart server and clients after
installing new item registrations and assets.

## Music Discs

Elevator by Benjamin Tissot (`kubejs:music_disc_elevator`) plays in a jukebox
for approximately 4 minutes 14 seconds. Craft it with one pass through a Create
sequenced assembly: a Deployer applies one Elevator Pulley to a Cobblemon Blank
TM, then a Mechanical Press finishes the disc. Both ingredients are consumed.
Operators can also obtain it with `/give @s kubejs:music_disc_elevator`.

After installing this addition, restart the server and clients to register the
item and sound. Clients need the updated KubeJS startup scripts and assets to
display the disc and hear its music.

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

### Gift-o-Matic Machine

Obtain with `/give @s kubejs:gift_o_matic`. It is unbreakable in survival,
resists explosions and pistons, and requires air directly above it, like the
Pokémon Statue. Only the lower half accepts interactions. Creative players can
remove either half when the machine is idle; both halves are removed together.

An operator in creative can crouch-right-click the lower half to configure up
to nine pools, each with up to 36 reward entries. Hover over the book for all
setup instructions; opening the menu does not post instructions in chat.
Unused bottom-row slots use blank icons, and the selected-item slot stays empty
until you choose an item.

To configure a pool:

1. Click a stack in your inventory to select a template. Its count and all item
   components are copied; your original stack stays in your inventory.
2. Right-click a slot in the top row to assign the selected stack as that pool's
   currency and cost. Left-click a top-row slot to select an existing pool.
3. Left-click slots in rows 2–5 to copy reward templates into the selected pool.
   Right-click a reward slot to clear it. Click another inventory stack to
   change the selected template.
4. The green checkmark saves all pools. The gray X or Escape cancels edits. The
   red X on the far right deletes the selected pool in the draft; save to apply
   the deletion. These controls reuse the Data Manipulator's UI icons.

Every nonempty pool needs a distinct currency item/components and at least one
reward. Each occupied reward slot has equal probability; duplicate entries can
weight a reward. Reward counts are the stack size given per redemption, and
reward templates are unlimited. Costs come from the stack in the interacting
hand, including its count and components, and are consumed in creative too.

Each viewer sees the display cycle through currencies until they hold a matching
currency in either hand, then it previews that pool's rewards. Redeeming locks
the machine for the two-second spin, prize reveal, descent, and one-second reset.
Payments remain blocked for another quarter-second after the display returns.
Rewards enter the redeeming player's inventory; overflow drops at that player.
If they disconnect before delivery, the prize stays saved and the machine waits
for them to reconnect. Configuration and pending prizes are stored in the lower
block's `data.lccGiftOMatic` NBT. Configuration also locks the machine until the
editor saves or closes the menu.

Restart the server and clients to register the blocks. Clients need the startup
scripts (including `gift_o_matic_renderer.js`) and assets for the model and local
item display. Renderer registration runs at startup, guarded to load client
classes only in a client environment.

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
