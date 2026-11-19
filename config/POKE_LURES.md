# Poké Lures

Native items:

| Item | Pool |
| --- | --- |
| `kubejs:poke_lure` | Random Pokémon, like the old lure |
| `kubejs:spooky_poke_lure` | Spooky pool from the rework notes |
| `kubejs:festive_poke_lure` | Festive pool from the rework notes |

Right-click to throw a lure, spending one item, including in creative. It uses
a vanilla projectile carrying the lure's item appearance; no custom entity mod
is required. It spawns one wild Pokémon where it hits a block or entity, moving
slightly from the exact hit point only if needed to fit the Pokémon. Lure impacts
deal no snowball damage. A ten-tick cooldown prevents overlapping throws.

On a valid impact, the original evolution sparkle effects and three opening
sounds play at the exact hit coordinates before the Pokémon is added to the
world. Bedrock effects use Cobblemon's positional packets for nearby viewers in
the same dimension. They require no player command permissions and remain at
the impact point if the Pokémon needs a nearby clear space. Each effect is
guarded independently so a feedback failure cannot cancel the spawn.

The roll and full item settings are saved on the projectile at throw time, so
changing hands, editing the remaining stack, or reloading scripts while it is
in flight cannot change its prize. Each projectile settles only once. Battles,
invalid throw settings, and cancelled projectile creation spend nothing. If an
impact cannot spawn its Pokémon, the lure is returned to the thrower's inventory
(overflow drops); if they are offline, it drops at the hit point instead.
Inventory and PC space are not involved in Pokémon delivery: the lure spawns a
catchable Pokémon in the world, rather than giving it to a party.

The base Poké Lure rolls independently for **5% Alpha** and **1% Shiny**, with
natural IVs and no perfect-IV guarantee. Spooky and Festive Lures retain **15%
Alpha**, **5% Shiny**, and at least **three perfect IVs**. All three retain the
independent **50% Hidden Ability** roll. Native `ha=true` selects the chosen
form's Hidden Ability; `ha=false` selects a normal ability. A form without a
Hidden Ability keeps its available normal ability. Lure tooltips describe the
item without listing its modifiers.

Levels are calculated at throw time from the highest-level Pokémon in the
thrower's party:

```text
baseline = max(25, floor(highest party level × 0.8))
level = baseline + a random integer from -4 through +4
```

The minimum applies before variation, so a low-level or empty party gives
levels **21–29**. A highest party level of 100 gives **76–84**. Every party slot
is considered, including fainted members; PC Pokémon are not counted. The level
is saved with the projectile's roll. Explicit entry/per-stack level properties
remain available for staff-created custom lures.

There are no rank checks, recipes, or automatic machine pool changes. Separate
redeem items are registered in `startup_scripts/redeem_items.js`; configure
their costs and lure rewards on the machine as needed.

## Editing items and pools

Edit names, textures, and tooltip lines in `startup_scripts/poke_lures.js`.
Ship the updated startup script and textures to clients, then restart server
and clients. Each variant uses its supplied sprite in
`assets/kubejs/textures/item/poke_lures/`.

Edit pool references, levels, tier weights, and modifier chances in
`config/poke_lures.json`, then run `/reload`. This file is server-side only.
For a single-player test, place it in that instance's `kubejs/config` directory.
To add a new native item ID, add it to both the startup catalog and the JSON
`items` list; distribute its startup definition/assets and restart.

An empty pool (`[]`, `{}`, or `null`) uses `random` plus modifiers. This is
Cobblemon's random-species behavior, rather than the local biome's spawn pool.
A named pool must exist; misspelled names fail instead of silently going random.

A flat pool picks one entry. Strings are ordinary Pokémon property arguments:

```json
["eevee", "zorua hisuian", "lilligant winter lvl=40"]
```

Entries can also have weights, marks, or their own modifier settings:

```json
[
  "eevee",
  {
    "pokemon": "pikachu lvl=30",
    "weight": 2,
    "marks": ["cobblemon:ribbon_admin"],
    "modifiers": [{"id": "shiny", "chance": 1, "properties": "shiny=true"}]
  }
]
```

The ribbon above is a staff testing example; the shipped pools add no extra
marks. Alpha's own mark is granted through Cobblemon's native Alpha property.

Structured pools first choose a tier by its relative weight, then choose an
entry within that tier. Tier probability does not depend on its entry count.
`buckets` is accepted as an alias for `tiers`.

```json
{
  "tiers": [
    {"name": "standard", "weight": 90, "entries": ["eevee", "pikachu"]},
    {"name": "rare", "weight": 10, "entries": ["mew"]}
  ]
}
```

The seasonal defaults are **90 Standard / 8 Starter / 1 Legendary / 1 Poster**.
These are editable starting weights, not specified odds from the notes. Zero
weight disables an entry/tier. Nonempty pools need positive total weight, and a
positive-weight tier must contain entries.

## Modifiers and marks

`chance` is a number from 0 to 1. Each modifier is an independent roll; successes
append `properties`, and failures append optional `otherwise` properties:

```json
{"id": "shiny", "chance": 0.15, "properties": "shiny=true", "otherwise": "shiny=false"}
```

Modifiers merge by `id`, in order: defaults → item → tier → entry → per-stack
settings. A later definition replaces the entire earlier definition with that
ID, including its failure behavior. Different IDs roll independently. The shipped
Alpha, Shiny, and Hidden Ability failures explicitly force normal states, so the
configured probability is not increased by a second natural roll. To disable an
inherited modifier entirely, override its ID with `"chance": 0` and omit both
`properties` and `otherwise`.

`min_perfect_ivs` is an optional numeric setting on defaults, items, tiers,
entries, and per-stack settings. It accepts integers from **0 to 6**; `null`
or `0` disables the inherited guarantee. Omitting the field inherits the earlier
value in this order: defaults → item → tier → entry → per-stack settings.
The default is `null` (natural IVs). Both event lures set `"min_perfect_ivs": 3`,
guaranteeing at least three perfect IVs on every spawn without a chance roll.
Change that number to configure the minimum. For a held lure stack:

```text
/pokelure configure {"min_perfect_ivs":3}
```

This field supplies the built-in guarantee; explicit IV property arguments in
custom entries or modifiers are still accepted by the native parser.

Properties use the installed Cobblemon parser, including `alpha`, `shiny`, `ha`,
`min_perfect_ivs`, levels, forms, and other supported `/pokegive` arguments.
Later repeated property keys win. Quotes in nicknames are preserved.

Marks are **not** property arguments. Use `marks` on an entry, tier, item,
per-stack settings, or a modifier. All requested marks are resolved before
spawning. They are granted with `pokemon.exchangeMark(mark, true)`, preserving
the active mark unless explicitly requested:

```json
{"id": "cobblemon:ribbon_admin", "chance": 1, "active": true}
```

String mark IDs mean a guaranteed grant without changing the active mark.
An unknown mark prevents the spawn and preserves the lure.

## Commands and per-stack settings

- `/pokelure give poke_lure [player] [count]`
- `/pokelure give spooky_poke_lure [player] [count]`
- `/pokelure give festive_poke_lure [player] [count]`
- `/pokelure configure <JSON>` — operator only; edits the held lure stack.
- `/pokelure claim` — claim the daily Lure Ticket, if available.

`give` requires operator permissions; counts range from 1 to 64. With no target,
it gives to the executing player. Inventory overflow drops at the recipient,
including in creative.

For a custom held stack, for example:

```text
/pokelure configure {"pool":"spooky","modifiers":[{"id":"shiny","chance":1,"properties":"shiny=true"}]}
```

The settings affect every item in that stack. Hold a single item first to edit
only one lure. `{}` restores the item's default spawn settings. Supported keys
are `pool`, `properties`, `modifiers`, `marks`, and `min_perfect_ivs`. `pool` may be a config name
or an inline flat/structured pool. Settings are saved as a JSON string in
`minecraft:custom_data.lccPokeLure.config`, so different settings do not stack
together. Item names/tooltips remain those of the configured native variant.

## Old items, achievements, and daily rewards

The old `cobblemon:npc_editor` stacks with custom model data **69420** convert to
`kubejs:poke_lure` when entering a player's inventory or on login. Counts and
custom data are preserved. Normal NPC editors and other custom model values
are not converted. Old loot tables and stored stacks therefore continue to
produce usable lures during migration.

The server datapack's old consumption advancement is disabled, and its
`gachapotion:drink_coin` / `gachapotion:spawn_macro` functions are comment-only
no-ops. KubeJS also generates final-priority overrides for all three resources,
so installing an older world pack cannot reactivate that path. The
`lcc:lets_go_gambling` achievement is awarded directly after a lure successfully
spawns a Pokémon. Throwing a lure, a failed impact, and receiving a daily ticket
do not award it. Its old criterion key is retained to preserve earned progress,
with an impossible trigger to prevent item consumption from awarding it.
Legacy item textures remain for unmigrated stacks in storage.
Restart for initial
installation; `/reload` applies subsequent server-side configuration changes.

The KubeJS daily replacement keeps the existing noon schedule in
`America/Indiana/Indianapolis` and the existing welcome message. Both the helper
mod's reward command and KubeJS grant one `kubejs:lure_ticket`. Claim records
live under Forge's `PlayerPersisted`, survive death, and use the old mod's window
key format. Login also copies the old attachment's latest claim while that mod
is installed.

- `dailyReward.mode: "auto"` (default): while **lccreward** is installed, let it
  grant the ticket. KubeJS does not grant a duplicate.
  After removing the helper jar and restarting, KubeJS handles login rewards.
- `"off"`: disable KubeJS daily rewards.
- `"kubejs"`: force KubeJS to grant; disable/remove the old mod's grant first.

Before today's first configured time there is no daily claim, matching the old
mod. Rejoining or claiming repeatedly in the same window gives nothing extra.
If the helper mod is removed, KubeJS also provides the compatible operator
command `/lccreward give [targets] [force]`. Force bypasses the claim-window check.
Removing the helper is not necessary to test the lure itself; leaving the default
auto mode in place permits testing without changing a running server's mod set.
