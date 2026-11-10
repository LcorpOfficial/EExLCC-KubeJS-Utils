
// Clone an operator's party Pokemon to themselves or another online player.
// Cobblemon's clone(true, ...) preserves the Pokemon's stored data while giving
// the clone a new UUID so both copies can safely exist in storage.
ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const IntegerArgumentType = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType')
  const EntityArgument = Java.loadClass('net.minecraft.commands.arguments.EntityArgument')
  const Cobblemon = Java.loadClass('com.cobblemon.mod.common.Cobblemon')
  const PartyPosition = Java.loadClass('com.cobblemon.mod.common.api.storage.party.PartyPosition')

  function playerName(player) {
    return String(player.getGameProfile().getName())
  }

  function pokemonName(pokemon) {
    return String(pokemon.getSpecies().getName())
  }

  function clonePartyPokemon(ctx, target) {
    const source = ctx.source
    const executor = source.player
    let cloneWasAdded = false

    try {
      // Rhino can incorrectly treat const declarations inside a try block as
      // redeclarations in its generated callback scope, so use uniquely named
      // function-scoped variables here.
      var selectedPartySlot = IntegerArgumentType.getInteger(ctx, 'user_slot')
      var cobblemonStorage = Cobblemon.INSTANCE.getStorage()
      var executorParty = cobblemonStorage.getParty(executor)
      var sourcePartyPosition = new PartyPosition(selectedPartySlot - 1)
      var pokemonToClone = executorParty[
        'get(com.cobblemon.mod.common.api.storage.party.PartyPosition)'
      ](sourcePartyPosition)

      if (!pokemonToClone) {
        executor.tell(Text.red(`Party slot ${selectedPartySlot} is empty.`))
        return 0
      }

      // Resolve display strings before changing storage. Direct Java getters are
      // more reliable here than Rhino's synthetic .name/.string properties.
      var clonedPokemonName = pokemonName(pokemonToClone)
      var recipientName = playerName(target)
      var operatorName = playerName(executor)
      var clonedPokemon = pokemonToClone.clone(true, source.server.registryAccess())
      var recipientParty = cobblemonStorage.getParty(target)

      cloneWasAdded = recipientParty.add(clonedPokemon)
      if (!cloneWasAdded) {
        executor.tell(Text.red(`Could not clone ${clonedPokemonName}: ${recipientName}'s party and PC are full.`))
        return 0
      }

      executor.tell(Text.green(`Cloned ${clonedPokemonName} from slot ${selectedPartySlot} to ${recipientName}.`))

      // Online player names are unique, and comparing JS strings avoids Rhino
      // attempting to resolve Java UUID.equals(Object).
      if (recipientName !== operatorName) {
        target.tell(Text.green(`${operatorName} gave you a clone of ${clonedPokemonName}.`))
      }

      return 1
    } catch (error) {
      var pokecloneErrorDetail = `${String(error)}${error?.stack ? `\n${String(error.stack)}` : ''}`
      console.error(`[pokeclone] ${pokecloneErrorDetail}`)

      if (cloneWasAdded) {
        executor.tell(Text.red('The clone was added, but pokeclone failed while reporting success. Check the KubeJS server log.'))
      } else {
        executor.tell(Text.red(`Pokeclone failed: ${String(error)}`))
      }

      return 0
    }
  }

  event.register(
    Commands.literal('pokeclone')
      .requires(src => !!src.player && src.hasPermission(2))
      .then(
        Commands.argument('user_slot', IntegerArgumentType.integer(1, 6))
          .executes(ctx => clonePartyPokemon(ctx, ctx.source.player))
          .then(
            Commands.argument('target_player', EntityArgument.player())
              .executes(ctx => clonePartyPokemon(
                ctx,
                EntityArgument.getPlayer(ctx, 'target_player')
              ))
          )
      )
  )
})


// Spawn a random NPC from a named, configured pool. Commands are delegated
// through the original source so command blocks keep their dimension,
// position, and permission context.
ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Vec3Argument = Java.loadClass('net.minecraft.commands.arguments.coordinates.Vec3Argument')
  const StringArgumentType = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
  const CONFIG_PATH = 'kubejs/config/npclistspawn.json'
  const NPC_ID_PATTERN = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/
  const LIST_NAME_PATTERN = /^[a-z0-9_-]+$/

  function readConfiguredLists() {
    const config = JsonIO.read(CONFIG_PATH)
    const configuredLists = config?.lists

    if (!configuredLists || typeof configuredLists !== 'object' || Array.isArray(configuredLists)) {
      throw new Error(`Expected "lists" to be an object in ${CONFIG_PATH}`)
    }

    return configuredLists
  }

  function configuredListNames() {
    return Object.keys(readConfiguredLists())
      .filter(name => LIST_NAME_PATTERN.test(name))
      .sort()
  }

  function readNpcPool(listName) {
    const configuredArguments = readConfiguredLists()[listName]

    if (!Array.isArray(configuredArguments)) {
      throw new Error(`Unknown NPC list "${listName}" in ${CONFIG_PATH}`)
    }

    return configuredArguments
      .map(value => String(value).trim())
      .filter(value => {
        if (NPC_ID_PATTERN.test(value)) return true
        console.warn(`[npclistspawn] Ignoring invalid NPC identifier in list "${listName}": ${value}`)
        return false
      })
  }

  function suggestConfiguredLists(ctx, builder) {
    var npcListSuggestionPrefix = ''
    try {
      npcListSuggestionPrefix = String(builder.getRemaining()).toLowerCase()
      configuredListNames().forEach(name => {
        if (!npcListSuggestionPrefix || name.toLowerCase().startsWith(npcListSuggestionPrefix)) builder.suggest(name)
      })
    } catch (error) {
      console.error(`[npclistspawn] Could not read list suggestions: ${String(error)}`)
    }
    return builder.buildFuture()
  }

  function runRandomSpawn(ctx, listName, position) {
    try {
      var npcPool = readNpcPool(listName)
      if (npcPool.length === 0) {
        ctx.source.sendFailure(Text.red(`NPC list "${listName}" has no valid entries in ${CONFIG_PATH}`))
        return 0
      }

      var selectedNpc = npcPool[Math.floor(Math.random() * npcPool.length)]
      var command = position
        ? `npcspawnat ${position.x} ${position.y} ${position.z} ${selectedNpc}`
        : `npcspawn ${selectedNpc}`

      ctx.source.getServer().getCommands().performPrefixedCommand(ctx.source, command)
      return 1
    } catch (error) {
      var errorDetail = `${String(error)}${error?.stack ? `\n${String(error.stack)}` : ''}`
      console.error(`[npclistspawn] ${errorDetail}`)
      ctx.source.sendFailure(Text.red(`npclistspawn failed: ${String(error)}`))
      return 0
    }
  }

  function listArgument(executor) {
    return Commands.argument('list', StringArgumentType.word())
      .suggests(suggestConfiguredLists)
      .executes(executor)
  }

  event.register(
    Commands.literal('npclistspawn')
      .requires(source => source.hasPermission(2))
      .executes(ctx => runRandomSpawn(ctx, 'test', null))
      .then(listArgument(ctx => runRandomSpawn(
        ctx,
        StringArgumentType.getString(ctx, 'list'),
        null
      )))
  )

  event.register(
    Commands.literal('npclistspawnat')
      .requires(source => source.hasPermission(2))
      .then(
        Commands.argument('position', Vec3Argument.vec3())
          .executes(ctx => runRandomSpawn(ctx, 'test', Vec3Argument.getVec3(ctx, 'position')))
          .then(listArgument(ctx => runRandomSpawn(
            ctx,
            StringArgumentType.getString(ctx, 'list'),
            Vec3Argument.getVec3(ctx, 'position')
          )))
      )
  )
})


ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const StringArgumentType = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
  const SLOT_VALUES = ['1', '2', '3', '4', '5', '6']

  function runAsSource(source, command) {
    if (source.player) source.player.runCommandSilent(command)
    else source.server.runCommandSilent(command)
  }

  function getMaxedPokemonSuffix() {
    return (
      `lvl=100 ` +
      `hp_iv=31 attack_iv=31 defence_iv=31 ` +
      `special_attack_iv=31 special_defence_iv=31 speed_iv=31 ` +
      `pokeball=ancient_origin_ball`
    )
  }

  function getResetEVs() {
    return (
      `hp_ev=0 attack_ev=0 defence_ev=0 ` +
      `special_attack_ev=0 special_defence_ev=0 speed_ev=0 `
    )
  }

  function applyAdminRibbon(player, pokemon) {
    var adminMarks = Java.loadClass('com.cobblemon.mod.common.api.mark.Marks')
    var adminResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
    var adminRibbon = adminMarks.getByIdentifier(adminResourceLocation.parse('cobblemon:ribbon_admin'))
    if (adminRibbon == null) {
      player.tell(Text.red('The admin ribbon is not loaded! This Pokémon will not have it.'))
    } else {
      // Granting a mark does not replace the active mark (e.g. Alpha's eyes).
      pokemon.exchangeMark(adminRibbon, true)
    }
  }

  function giveMaxedPokemon(source, args) {
    var maxedPokemonAdded = false
    try {
      var maxedCobblemon = Java.loadClass('com.cobblemon.mod.common.Cobblemon')
      var maxedPropertiesClass = Java.loadClass('com.cobblemon.mod.common.api.pokemon.PokemonProperties')

      // Use the same parser and creation API as /pokegiveother. Award the ribbon
      // before insertion so it also follows the new Pokemon into PC overflow.
      var maxedProperties = maxedPropertiesClass.Companion.parse(args + ' ' + getMaxedPokemonSuffix())
      if (maxedProperties.getSpecies() == null) {
        source.sendFailure(Text.red('Specify a valid Pokémon species.'))
        return 0
      }
      var maxedPokemon = maxedProperties.create()
      applyAdminRibbon(source.player, maxedPokemon)
      var maxedPokemonName = String(maxedPokemon.getDisplayName(false).getString())
      var maxedParty = maxedCobblemon.INSTANCE.getStorage().getParty(source.player)
      if (!maxedParty.add(maxedPokemon)) {
        source.sendFailure(Text.red('Your party and PC could not accept the Pokémon. No Pokémon was given.'))
        return 0
      }
      maxedPokemonAdded = true
      source.player.tell(Text.green('You received ' + maxedPokemonName + ' with perfect IVs, at level 100.'))
      return 1
    } catch (error) {
      console.error('[pokegivemaxed] ' + String(error))
      source.sendFailure(Text.red(maxedPokemonAdded
        ? 'The Pokémon was given, but reporting the result failed. Check your party or PC.'
        : 'Could not give the Pokémon: ' + String(error)))
      return maxedPokemonAdded ? 1 : 0
    }
  }

  function maxPartyPokemon(source, slot, args) {
    if (!SLOT_VALUES.includes(slot)) {
      source.sendFailure(Text.red('Slot must be 1-6.'))
      return 0
    }

    var pokeMaxEdited = false
    try {
      var pokeMaxCobblemon = Java.loadClass('com.cobblemon.mod.common.Cobblemon')
      var pokeMaxPositionClass = Java.loadClass('com.cobblemon.mod.common.api.storage.party.PartyPosition')
      var pokeMaxParty = pokeMaxCobblemon.INSTANCE.getStorage().getParty(source.player)
      var pokeMaxPokemon = pokeMaxParty[
        'get(com.cobblemon.mod.common.api.storage.party.PartyPosition)'
      ](new pokeMaxPositionClass(Number(slot) - 1))
      if (pokeMaxPokemon == null) {
        source.sendFailure(Text.red('Party slot ' + slot + ' is empty.'))
        return 0
      }

      // Entity.runCommandSilent returns void. Dispatch through the source to
      // check whether the native edit succeeded before granting the ribbon.
      var pokeMaxCommand = 'pokeeditother @s ' + slot + ' ' +
        (args ? args + ' ' : '') + getMaxedPokemonSuffix()
      var pokeMaxResult = source.getServer().getCommands().performPrefixedCommand(source, pokeMaxCommand)
      if (pokeMaxResult <= 0) return 0
      pokeMaxEdited = true
      applyAdminRibbon(source.player, pokeMaxPokemon)
      return pokeMaxResult
    } catch (error) {
      console.error('[pokemax] ' + String(error))
      source.sendFailure(Text.red(pokeMaxEdited
        ? 'The Pokémon was maxed, but the Admin Ribbon could not be applied: ' + String(error)
        : 'Could not max the Pokémon: ' + String(error)))
      return pokeMaxEdited ? 1 : 0
    }
  }

  function suggestList(builder, values) {
    const remaining = String(builder.getRemaining()).toLowerCase()
    values.forEach(v => {
      if (!remaining || String(v).toLowerCase().startsWith(remaining)) builder.suggest(v)
    })
    return builder.buildFuture()
  }

  // macro for pokeedit to reset EVs, just add slot
  event.register(
    Commands.literal('resetevs')
      .requires(src => src.hasPermission(2)) // ops only
      .then(
        Commands.argument('slot', StringArgumentType.word())
          .suggests((ctx, builder) => suggestList(builder, SLOT_VALUES))
          .executes(ctx => {
            const source = ctx.source
            const slot = StringArgumentType.getString(ctx, 'slot')

            if (!SLOT_VALUES.includes(slot)) {
              source.player?.tell(Text.red('Slot must be 1-6.'))
              return 0
            }

            const cmd = `pokeeditother @s ${slot} ${getResetEVs()}`
            runAsSource(source, cmd)
            return 1
          })
      )
  )

  // Give a level 100 Pokemon with perfect IVs, an Ancient Origin Ball, and the Admin Ribbon.

  event.register(
    Commands.literal('pokegivemaxed')
      .requires(src => !!src.player && src.hasPermission(2)) // player operators only
      .then(
        Commands.argument('args', StringArgumentType.greedyString())
          .executes(ctx => {
            const source = ctx.source
            const args = StringArgumentType.getString(ctx, 'args')

            return giveMaxedPokemon(source, args)
          })
      )
  )

  // macro for maxing an existing party slot with optional extra pokeedit args

  event.register(
    Commands.literal('pokemax')
      .requires(src => !!src.player && src.hasPermission(2)) // player operators only
      .then(
        Commands.argument('slot', StringArgumentType.word())
          .suggests((ctx, builder) => suggestList(builder, SLOT_VALUES))
          .executes(ctx => {
            const source = ctx.source
            const slot = StringArgumentType.getString(ctx, 'slot')

            return maxPartyPokemon(source, slot, '')
          })
          .then(
            Commands.argument('args', StringArgumentType.greedyString())
              .executes(ctx => {
                const source = ctx.source
                const slot = StringArgumentType.getString(ctx, 'slot')
                const args = StringArgumentType.getString(ctx, 'args')

                return maxPartyPokemon(source, slot, args)
              })
          )
      )
  )
})

  // grant badge or trophy to a player, with lore about who granted it and who earned it

ServerEvents.commandRegistry(event => {
  const Commands = event.commands

  const StringArgumentType = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
  const EntityArgument = Java.loadClass('net.minecraft.commands.arguments.EntityArgument')

  // ---- Helpers ----

  function getIdsFromTag(tag) {
    // Ingredient is globally available in KubeJS; no Java.loadClass needed.
    const ing = Ingredient.of(tag)
    // Different KubeJS builds expose this differently, so support both.
    return ing.itemIds ? ing.itemIds : ing.getItemIds()
  }

  function stripPrefix(id, prefix) {
    return id.startsWith(prefix) ? id.substring(prefix.length) : id
  }

  function choiceListForType(type) {
    // Your tags should be: #lcc:badges and #lcc:trophies
    const tag = type === 'badge' ? '#lcc:badges' : '#lcc:trophies'
    const ids = getIdsFromTag(tag)

    // We suggest "fire" instead of "kubejs:badge_fire"
    const pfx = type === 'badge' ? 'kubejs:badge_' : 'kubejs:trophy_'
    const out = []
    ids.forEach(id => {
      const stripped = stripPrefix(id, pfx)
      if (!stripped.includes(':')) out.push(stripped)
    })
    return out.sort()
  }

  function resolveFullId(type, choice) {
    // Allow fully qualified IDs if the user types them
    if (choice.includes(':')) return choice

    // Expected patterns: kubejs:badge_<choice> / kubejs:trophy_<choice>
    const full = type === 'badge'
      ? `kubejs:badge_${choice}`
      : `kubejs:trophy_${choice}`

    return full
  }

  function hasGymLeaderTag(player) {
    // Vanilla entity tag (not scoreboard) is accessible as getTags()
    try {
      return player.getTags().contains('gym_leader')
    } catch (e) {
      // Some builds expose it as a JS array
      const tags = player.getTags()
      return Array.isArray(tags) ? tags.includes('gym_leader') : false
    }
  }

  function toJsArray(javaIterable) {
  const arr = []
  javaIterable.forEach(v => arr.push(String(v)))
  return arr
  }


  // ---- Command ----

  event.register(
    Commands.literal('grant')
      // Keep base command player-only; specific permission enforced per type inside.
      .requires(src => !!src.player)
      .then(
        Commands.argument('type', StringArgumentType.word())
          .suggests((ctx, builder) => {
            builder.suggest('badge')
            builder.suggest('trophy')
            return builder.buildFuture()
          })
          .then(
            Commands.argument('choice', StringArgumentType.word())
              .suggests((ctx, builder) => {
                const type = StringArgumentType.getString(ctx, 'type')
                if (type !== 'badge' && type !== 'trophy') return builder.buildFuture()

                const remaining = String(builder.getRemaining()).toLowerCase()
                for (const c of choiceListForType(type)) {
                  if (!remaining || c.toLowerCase().startsWith(remaining)) {
                    builder.suggest(c)
                  }
                }
                return builder.buildFuture()
              })
              .then(
                Commands.argument('player', EntityArgument.player())
                  .executes(ctx => {
                    const source = ctx.source
                    const executor = source.player
                    const type = StringArgumentType.getString(ctx, 'type')
                    const choice = StringArgumentType.getString(ctx, 'choice')
                    const target = EntityArgument.getPlayer(ctx, 'player')

                    // Validate type
                    if (type !== 'badge' && type !== 'trophy') {
                      source.player.tell(Text.red('Type must be "badge" or "trophy".'))
                      return 0
                    }

                    // Permission rules
                    if (type === 'trophy') {
                      if (!source.hasPermission(2)) {
                        executor.tell(Text.red('You must be OP to grant trophies.'))
                        return 0
                      }
                    } else if (type === 'badge') {
                      if (!hasGymLeaderTag(executor)) {
                        executor.tell(Text.red('Only players with the "gym_leader" tag can grant badges.'))
                        return 0
                      }
                    }

                    // Resolve and validate the item against the appropriate tag
                    const fullId = resolveFullId(type, choice)
                    const allowedTag = type === 'badge' ? '#lcc:badges' : '#lcc:trophies'
                    const allowedIds = new Set(toJsArray(getIdsFromTag(allowedTag)))

                    if (!allowedIds.has(fullId)) {
                      executor.tell(Text.red(`"${choice}" is not a valid ${type} (not in ${allowedTag}).`))
                      return 0
                    }

                    // Shared structured metadata on badges and trophy items;
                    // trophies also carry the block entity data for placement.
                    const earnedBy = String(target.getGameProfile().getName())
                    const stack = global.lccAwards.stamp(Item.of(fullId), executor, target)

                    target.give(stack)

                    executor.tell(Text.green(`Granted ${type} "${choice}" to ${earnedBy}.`))
                    return 1
                  })
              )
          )
      )
  )
})

// checkspawn but all the buckets at once

ServerEvents.commandRegistry(event => {
  const Commands = event.commands

  event.register(
    Commands.literal('checkallspawns')
      .requires(src => !!src.player) // player-only; remove if console should work
      .requires(src => src.hasPermission(2)) // ops only
      .executes(ctx => {
        const source = ctx.source
        const runner = source.player ?? source.server

        const tiers = [
          { label: 'Common', command: 'checkspawn common' },
          { label: 'Uncommon', command: 'checkspawn uncommon' },
          { label: 'Rare', command: 'checkspawn rare' },
          { label: 'Ultra-Rare', command: 'checkspawn ultra-rare' },
          { label: 'Boss', command: 'checkspawn boss' }
        ]

        tiers.forEach((tier, index) => {
          source.server.scheduleInTicks((index * 10) + 1, () => {
            source.player.tell(Text.gold(`=== ${tier.label} Tier ===`))
            runner.runCommandSilent(tier.command)
          })
        })

        return 1
      })
  )
})



// hypertrain for EV preset/custom setup

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const StringArgumentType = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')

  const SLOT_VALUES = ['1', '2', '3', '4', '5', '6']

  const STAT_ALIASES = {
    hp: 'hp',
    attack: 'attack',
    atk: 'attack',
    defence: 'defence',
    defense: 'defence',
    def: 'defence',
    special_attack: 'special_attack',
    sp_attack: 'special_attack',
    sp_atk: 'special_attack',
    spatk: 'special_attack',
    special_defence: 'special_defence',
    special_defense: 'special_defence',
    sp_defence: 'special_defence',
    sp_defense: 'special_defence',
    sp_def: 'special_defence',
    spdef: 'special_defence',
    speed: 'speed',
    spe: 'speed'
  }

  const STATS = ['hp', 'attack', 'defence', 'special_attack', 'special_defence', 'speed']

  const NATURES = [
    { name: 'adamant', up: 'attack', down: 'special_attack' },
    { name: 'bashful', up: 'special_attack', down: 'special_attack' },
    { name: 'bold', up: 'defence', down: 'attack' },
    { name: 'brave', up: 'attack', down: 'speed' },
    { name: 'calm', up: 'special_defence', down: 'attack' },
    { name: 'careful', up: 'special_defence', down: 'special_attack' },
    { name: 'docile', up: 'defence', down: 'defence' },
    { name: 'gentle', up: 'special_defence', down: 'defence' },
    { name: 'hardy', up: 'attack', down: 'attack' },
    { name: 'hasty', up: 'speed', down: 'defence' },
    { name: 'impish', up: 'defence', down: 'special_attack' },
    { name: 'jolly', up: 'speed', down: 'special_attack' },
    { name: 'lax', up: 'defence', down: 'special_defence' },
    { name: 'lonely', up: 'attack', down: 'defence' },
    { name: 'mild', up: 'special_attack', down: 'defence' },
    { name: 'modest', up: 'special_attack', down: 'attack' },
    { name: 'naive', up: 'speed', down: 'special_defence' },
    { name: 'naughty', up: 'attack', down: 'special_defence' },
    { name: 'quiet', up: 'special_attack', down: 'speed' },
    { name: 'quirky', up: 'special_defence', down: 'special_defence' },
    { name: 'rash', up: 'special_attack', down: 'special_defence' },
    { name: 'relaxed', up: 'defence', down: 'speed' },
    { name: 'sassy', up: 'special_defence', down: 'speed' },
    { name: 'serious', up: 'speed', down: 'speed' },
    { name: 'timid', up: 'speed', down: 'attack' }
  ]

  const NATURE_FROM_TOKEN = {}
  const NATURE_TOKENS = []
  NATURES.forEach(n => {
    if (n.up === n.down) return
    const token = `+${n.up}-${n.down}`
    NATURE_FROM_TOKEN[token] = n.name
    NATURE_TOKENS.push(token)
  })
  const NATURE_TOKEN_SET = new Set(NATURE_TOKENS)
  const NATURE_NEUTRAL_TOKEN = 'neutral'
  const NATURE_INPUT_TOKENS = NATURE_TOKENS.concat([NATURE_NEUTRAL_TOKEN])

  function normalizeStat(input) {
    if (!input) return null
    const key = String(input).toLowerCase().replace(/-/g, '_')
    return STAT_ALIASES[key] ?? null
  }

  function normalizeNatureToken(input) {
    if (!input) return null
    const raw = String(input).toLowerCase().trim().replace(/\s+/g, '')
    const tokenBody = raw.startsWith('+') ? raw.substring(1) : raw
    const parts = tokenBody.split('-')
    if (parts.length !== 2) return null

    const up = normalizeStat(parts[0])
    const down = normalizeStat(parts[1])
    if (!up || !down) return null

    return `+${up}-${down}`
  }

  function runAsSource(source, command) {
    if (source.player) source.player.runCommandSilent(command)
    else source.server.runCommandSilent(command)
  }

  function applyHypertrain(source, slot, statA, statB, nature) {
    if (!SLOT_VALUES.includes(String(slot))) {
      source.player?.tell(Text.red('Slot must be 1-6.'))
      return 0
    }

    const hypertrainCobblemon = Java.loadClass('com.cobblemon.mod.common.Cobblemon')
    const hypertrainPosition = Java.loadClass('com.cobblemon.mod.common.api.storage.party.PartyPosition')
    const hypertrainParty = hypertrainCobblemon.INSTANCE.getStorage().getParty(source.player)
    const hypertrainPokemon = hypertrainParty[
      'get(com.cobblemon.mod.common.api.storage.party.PartyPosition)'
    ](new hypertrainPosition(Number(slot) - 1))
    if (hypertrainPokemon == null) {
      source.player.tell(Text.red('Party slot ' + slot + ' is empty.'))
      return 0
    }

    const resetCmd = `pokeedit ${slot} hp_ev=0 attack_ev=0 defence_ev=0 special_attack_ev=0 special_defence_ev=0 speed_ev=0 nature=serious`
    const applyCmd = `pokeedit ${slot} ${statA}_ev=252 ${statB}_ev=252 nature=${nature}`
    runAsSource(source, resetCmd)
    runAsSource(source, applyCmd)
    const hypertrainStatNames = {
      hp: 'HP', attack: 'Attack', defence: 'Defence',
      special_attack: 'Special Attack', special_defence: 'Special Defence', speed: 'Speed'
    }
    const hypertrainNatureName = nature.charAt(0).toUpperCase() + nature.slice(1)
    source.player.tell(Text.green(
      hypertrainPokemon.getDisplayName(false).getString() + ' was set to max EVs for ' +
      hypertrainStatNames[statA] + ' and ' + hypertrainStatNames[statB] +
      ', with ' + hypertrainNatureName + ' nature.'
    ))
    return 1
  }

  function suggestList(builder, values) {
    const remaining = String(builder.getRemaining()).toLowerCase()
    values.forEach(v => {
      if (!remaining || String(v).toLowerCase().startsWith(remaining)) builder.suggest(v)
    })
    return builder.buildFuture()
  }

  event.register(
    Commands.literal('hypertrain')
      .requires(src => !!src.player && src.hasPermission(2))
      .then(
        Commands.argument('slot', StringArgumentType.word())
          .suggests((ctx, builder) => suggestList(builder, SLOT_VALUES))
          .then(
            Commands.literal('fast_attacker')
              .executes(ctx => {
                const slot = StringArgumentType.getString(ctx, 'slot')
                return applyHypertrain(ctx.source, slot, 'attack', 'speed', 'jolly')
              })
          )
          .then(
            Commands.literal('fast_special_attacker')
              .executes(ctx => {
                const slot = StringArgumentType.getString(ctx, 'slot')
                return applyHypertrain(ctx.source, slot, 'special_attack', 'speed', 'timid')
              })
          )
          .then(
            Commands.literal('physical_tank')
              .executes(ctx => {
                const slot = StringArgumentType.getString(ctx, 'slot')
                return applyHypertrain(ctx.source, slot, 'hp', 'defence', 'relaxed')
              })
          )
          .then(
            Commands.literal('special_tank')
              .executes(ctx => {
                const slot = StringArgumentType.getString(ctx, 'slot')
                return applyHypertrain(ctx.source, slot, 'hp', 'special_defence', 'sassy')
              })
          )
          .then(
            Commands.literal('bulky_physical_attacker')
              .executes(ctx => {
                const slot = StringArgumentType.getString(ctx, 'slot')
                return applyHypertrain(ctx.source, slot, 'attack', 'hp', 'adamant')
              })
          )
          .then(
            Commands.literal('bulky_special_attacker')
              .executes(ctx => {
                const slot = StringArgumentType.getString(ctx, 'slot')
                return applyHypertrain(ctx.source, slot, 'special_attack', 'hp', 'modest')
              })
          )
          .then(
            Commands.literal('fast_support')
              .executes(ctx => {
                const slot = StringArgumentType.getString(ctx, 'slot')
                return applyHypertrain(ctx.source, slot, 'hp', 'speed', 'timid')
              })
          )
          .then(
            Commands.literal('custom')
              .then(
                Commands.argument('stat1', StringArgumentType.word())
                  .suggests((ctx, builder) => suggestList(builder, STATS))
                  .then(
                    Commands.argument('stat2', StringArgumentType.word())
                      .suggests((ctx, builder) => {
                        const stat1 = normalizeStat(StringArgumentType.getString(ctx, 'stat1'))
                        const statChoices = stat1 ? STATS.filter(s => s !== stat1) : STATS
                        return suggestList(builder, statChoices)
                      })
                      .then(
                        Commands.argument('nature', StringArgumentType.word())
                          .suggests((ctx, builder) => suggestList(builder, NATURE_INPUT_TOKENS))
                          .executes(ctx => {
                            const source = ctx.source
                            const slot = StringArgumentType.getString(ctx, 'slot')
                            const stat1Raw = StringArgumentType.getString(ctx, 'stat1')
                            const stat2Raw = StringArgumentType.getString(ctx, 'stat2')
                            const natureRaw = StringArgumentType.getString(ctx, 'nature')

                            const stat1 = normalizeStat(stat1Raw)
                            const stat2 = normalizeStat(stat2Raw)

                            if (!stat1 || !stat2) {
                              source.player?.tell(Text.red('Invalid stat. Use hp, attack, defence, special_attack, special_defence, or speed.'))
                              return 0
                            }

                            if (stat1 === stat2) {
                              source.player?.tell(Text.red('Custom requires two different stats.'))
                              return 0
                            }

                            const nature = String(natureRaw).toLowerCase() === NATURE_NEUTRAL_TOKEN
                              ? 'serious'
                              : (() => {
                                  const natureToken = normalizeNatureToken(natureRaw)
                                  return natureToken && NATURE_TOKEN_SET.has(natureToken)
                                    ? NATURE_FROM_TOKEN[natureToken]
                                    : null
                                })()
                            if (!nature) {
                              source.player?.tell(Text.red('Invalid nature token. Use a valid combo like +attack-speed, or "neutral".'))
                              return 0
                            }

                            return applyHypertrain(source, slot, stat1, stat2, nature)
                          })
                      )
                  )
              )
          )
      )
  )
})
