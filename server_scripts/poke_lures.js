// Native PokemonProperties parsing and spawning, without executing player input
// as commands. Function-scoped locals avoid Rhino 2101's conditional const bug.
;(function () {
  var PATH = 'kubejs/config/poke_lures.json'
  var KEY = 'lccPokeLure'
  var Components = Java.loadClass('net.minecraft.core.component.DataComponents')
  var CustomData = Java.loadClass('net.minecraft.world.item.component.CustomData')
  var Tag = Java.loadClass('net.minecraft.nbt.CompoundTag')
  var Properties = Java.loadClass('com.cobblemon.mod.common.api.pokemon.PokemonProperties')
  var Cobblemon = Java.loadClass('com.cobblemon.mod.common.Cobblemon')
  var Marks = Java.loadClass('com.cobblemon.mod.common.api.mark.Marks')
  var Location = Java.loadClass('net.minecraft.resources.ResourceLocation')
  var SpawnType = Java.loadClass('net.minecraft.world.entity.MobSpawnType')
  var BlockPos = Java.loadClass('net.minecraft.core.BlockPos')
  var PlayerExtensions = Java.loadClass('com.cobblemon.mod.common.util.PlayerExtensionsKt')
  var Snowball = Java.loadClass('net.minecraft.world.entity.projectile.Snowball')
  var ItemStack = Java.loadClass('net.minecraft.world.item.ItemStack')
  var ItemEntity = Java.loadClass('net.minecraft.world.entity.item.ItemEntity')
  var ImpactEvent = Java.loadClass('net.neoforged.neoforge.event.entity.ProjectileImpactEvent')
  var UUID = Java.loadClass('java.util.UUID')
  var Sounds = Java.loadClass('net.minecraft.sounds.SoundEvents')
  var SoundSource = Java.loadClass('net.minecraft.sounds.SoundSource')
  var SoundEvent = Java.loadClass('net.minecraft.sounds.SoundEvent')
  var ParticlePacket = Java.loadClass('com.cobblemon.mod.common.net.messages.client.effect.SpawnSnowstormParticlePacket')
  var PokeBalls = Java.loadClass('com.cobblemon.mod.common.api.pokeball.PokeBalls')
  var PROJECTILE_KEY = 'lccPokeLureProjectile'
  global.lccPokeLures.configure = null
  global.lccPokeLures.roll = null
  var config = JSON.parse(JsonIO.readString(PATH))
  var definitions = {}
  var busy = {}
  var lastUse = {}

  function fail(message) { throw new Error(message) }
  function array(value, label) { if (!Array.isArray(value)) fail(label + ' must be a list'); return value }
  function weight(value, label) {
    var number = value == null ? 1 : Number(value)
    if (!isFinite(number) || number < 0) fail(label + ' has an invalid weight')
    return number
  }
  function chance(value, label) {
    var number = value == null ? 1 : Number(value)
    if (!isFinite(number) || number < 0 || number > 1) fail(label + ' chance must be between 0 and 1')
    return number
  }
  function text(value, label) {
    if (value == null) return ''
    if (typeof value !== 'string' || value.length > 4096 || /[\r\n]/.test(value)) fail(label + ' must be a single property string')
    return value.trim()
  }
  function validatePerfectIVs(value) {
    if (value != null && (!Number.isInteger(value) || value < 0 || value > 6)) fail('min_perfect_ivs must be null or an integer from 0 to 6')
  }
  function validateSendOutBall(value) {
    if (value != null && (typeof value !== 'string' || !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(value))) fail('send_out_ball must be a namespaced Poke Ball identifier')
  }
  function modifiers(list) {
    array(list || [], 'modifiers').forEach(function (modifier) {
      if (!modifier || typeof modifier.id !== 'string' || !modifier.id) fail('Each modifier needs an id')
      chance(modifier.chance, modifier.id)
      text(modifier.properties, modifier.id)
      text(modifier.otherwise, modifier.id + '.otherwise')
      validateMarks(modifier.marks || [])
    })
  }
  function validateMarks(list) {
    array(list, 'marks').forEach(function (mark) {
      var id = typeof mark === 'string' ? mark : mark && mark.id
      if (typeof id !== 'string' || !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id)) fail('Invalid mark identifier')
      if (typeof mark !== 'string') chance(mark.chance, id)
    })
  }
  function entry(value) {
    var result = typeof value === 'string' ? { pokemon: value } : value
    if (!result || !text(result.pokemon, 'entry.pokemon')) fail('Each entry needs a Pokémon property string')
    weight(result.weight, result.pokemon)
    validatePerfectIVs(result.min_perfect_ivs)
    validateSendOutBall(result.send_out_ball)
    modifiers(result.modifiers || [])
    validateMarks(result.marks || [])
    return result
  }
  function resolvePool(value) {
    if (typeof value === 'string') {
      if (!Object.prototype.hasOwnProperty.call(config.pools, value)) fail('Unknown lure pool: ' + value)
      return config.pools[value]
    }
    return value == null ? [] : value
  }
  function validatePool(value) {
    var pool = resolvePool(value)
    if (Array.isArray(pool)) { pool.forEach(entry); return }
    if (!pool || typeof pool !== 'object') fail('A pool must be a list or an object with tiers')
    var tiers = pool.tiers || pool.buckets
    if (tiers != null) {
      array(tiers, 'tiers').forEach(function (tier) {
        weight(tier.weight, tier.name || 'tier')
        var entries = array(tier.entries, 'tier.entries')
        if (weight(tier.weight, 'tier') > 0 && entries.length === 0) fail('A positive-weight tier cannot be empty')
        entries.forEach(entry)
        text(tier.properties, 'tier.properties')
        validatePerfectIVs(tier.min_perfect_ivs)
        validateSendOutBall(tier.send_out_ball)
        modifiers(tier.modifiers || [])
        validateMarks(tier.marks || [])
      })
    } else if (pool.entries != null) array(pool.entries, 'entries').forEach(entry)
    else if (Object.keys(pool).length !== 0) fail('Pool needs entries or tiers')
  }
  function validateOverride(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Lure settings must be a JSON object')
    Object.keys(value).forEach(function (key) {
      if (['pool', 'properties', 'modifiers', 'marks', 'min_perfect_ivs', 'send_out_ball'].indexOf(key) < 0) fail('Unknown lure setting: ' + key)
    })
    if (value.pool != null) validatePool(value.pool)
    text(value.properties, 'properties')
    validatePerfectIVs(value.min_perfect_ivs)
    validateSendOutBall(value.send_out_ball)
    modifiers(value.modifiers || [])
    validateMarks(value.marks || [])
    return value
  }

  if (Number(config.version) !== 1) fail('Unsupported poke_lures.json version')
  if (!config.pools || typeof config.pools !== 'object' || Array.isArray(config.pools)) fail('Missing pools map')
  Object.keys(config.pools).forEach(function (name) { validatePool(config.pools[name]) })
  var defaults = config.defaults || {}
  validatePerfectIVs(defaults.min_perfect_ivs)
  validateSendOutBall(defaults.send_out_ball)
  var levelSettings = defaults.level || { partyScale: 0.8, minimum: 25, variation: 4 }
  if (!isFinite(levelSettings.partyScale) || levelSettings.partyScale <= 0 ||
      !Number.isInteger(levelSettings.minimum) || !Number.isInteger(levelSettings.variation) ||
      levelSettings.variation < 0 || levelSettings.minimum - levelSettings.variation < 1) fail('Invalid party-scaled level settings')
  modifiers(defaults.modifiers || [])
  array(config.items, 'items').forEach(function (definition) {
    if (definitions[definition.id] != null) fail('Duplicate lure item: ' + definition.id)
    if (!global.lccPokeLures.items.some(function (registered) { return registered.id === definition.id })) fail('New lure items require a restart: ' + definition.id)
    validatePool(definition.pool)
    text(definition.properties, 'item.properties')
    validatePerfectIVs(definition.min_perfect_ivs)
    validateSendOutBall(definition.send_out_ball)
    modifiers(definition.modifiers || [])
    validateMarks(definition.marks || [])
    definitions[definition.id] = definition
  })

  function choose(list, random) {
    var total = 0
    for (var i = 0; i < list.length; i++) total += weight(typeof list[i] === 'string' ? 1 : list[i].weight, 'entry')
    if (!isFinite(total) || total <= 0) fail('A nonempty pool needs positive weights')
    var roll = Number(random.nextDouble()) * total
    var last = null
    for (var j = 0; j < list.length; j++) {
      var current = weight(typeof list[j] === 'string' ? 1 : list[j].weight, 'entry')
      if (current <= 0) continue
      last = list[j]
      roll -= current
      if (roll < 0) return last
    }
    return last
  }
  function select(poolValue, random) {
    var pool = resolvePool(poolValue)
    var tier = {}
    var list = pool
    if (!Array.isArray(pool)) {
      var tiers = pool.tiers || pool.buckets
      if (tiers && tiers.length > 0) { tier = choose(tiers, random); list = tier.entries }
      else list = pool.entries || []
    }
    return { tier: tier, entry: list.length === 0 ? { pokemon: 'random' } : entry(choose(list, random)) }
  }
  function customData(stack) {
    var component = stack.get(Components.CUSTOM_DATA)
    return component == null ? new Tag() : component.copyTag()
  }
  function overrideFor(stack) {
    var record = customData(stack).getCompound(KEY)
    return record.contains('config', 8) ? validateOverride(JSON.parse(String(record.getString('config')))) : {}
  }
  function mergedModifiers(layers) {
    var result = []
    var indices = {}
    layers.forEach(function (layer) {
      ;(layer || []).forEach(function (modifier) {
        var key = '$' + modifier.id
        if (indices[key] == null) { indices[key] = result.length; result.push(modifier) }
        else result[indices[key]] = modifier
      })
    })
    return result
  }
  // Preserve quoted nicknames/custom properties; repeated keys use the last
  // value so appended modifiers reliably override a conflicting entry value.
  function normalizedProperties(parts) {
    var tokens = []
    var keys = {}
    var joined = parts.filter(function (part) { return !!part }).join(' ')
    var current = '', quote = '', escaped = false
    for (var i = 0; i < joined.length; i++) {
      var char = joined.charAt(i)
      if (escaped) { current += char; escaped = false; continue }
      if (char === '\\') { current += char; escaped = true; continue }
      if (quote) { current += char; if (char === quote) quote = ''; continue }
      if (char === '"' || char === "'") { quote = char; current += char; continue }
      if (/\s/.test(char)) { if (current) { tokens.push(current); current = '' } }
      else current += char
    }
    if (quote || escaped) fail('Unclosed quote or escape in Pokémon properties')
    if (current) tokens.push(current)
    var result = []
    tokens.forEach(function (token) {
      if (token === 'alpha' || token === 'shiny') token += '=true'
      var equal = token.indexOf('=')
      if (equal > 0) {
        var key = token.substring(0, equal).toLowerCase()
        if (key === 'level') key = 'lvl'
        if (key === 'hiddenability') key = 'ha'
        if (keys['$' + key] != null) result[keys['$' + key]] = null
        keys['$' + key] = result.length
      }
      result.push(token)
    })
    return result.filter(function (token) { return token != null }).join(' ')
  }
  function rollMarks(list, random, result) {
    ;(list || []).forEach(function (mark) {
      var value = typeof mark === 'string' ? { id: mark } : mark
      var probability = chance(value.chance, value.id)
      if (probability === 1 || (probability > 0 && Number(random.nextDouble()) < probability)) result.push(value)
    })
  }
  function rollLevel(player, random) {
    var highest = 0
    if (player != null) {
      var party = Cobblemon.INSTANCE.getStorage().getParty(player).iterator()
      while (party.hasNext()) {
        var member = party.next()
        if (member == null) continue
        var memberLevel = Number(member.getLevel())
        if (isFinite(memberLevel) && memberLevel > highest) highest = memberLevel
      }
    }
    // Apply the minimum to the scaled baseline, NOT to the final random level.
    // Thus a low/empty party produces 21-29, and a level-100 party produces 76-84.
    var baseline = Math.max(levelSettings.minimum, Math.floor(highest * levelSettings.partyScale))
    return baseline + Number(random.nextInt(levelSettings.variation * 2 + 1)) - levelSettings.variation
  }
  function roll(stack, random, player) {
    var definition = definitions[String(stack.id)]
    if (!definition) fail('Unknown lure item: ' + stack.id)
    var override = overrideFor(stack)
    var selection = select(override.pool != null ? override.pool : definition.pool, random)
    var selected = selection.entry
    var tier = selection.tier
    var level = rollLevel(player, random)
    var parts = ['lvl=' + level, text(defaults.properties), selected.pokemon,
      text(tier.properties), text(definition.properties), text(override.properties)]
    var marks = []
    rollMarks(tier.marks, random, marks)
    rollMarks(selected.marks, random, marks)
    rollMarks(definition.marks, random, marks)
    rollMarks(override.marks, random, marks)
    mergedModifiers([defaults.modifiers, definition.modifiers, tier.modifiers, selected.modifiers, override.modifiers])
      .forEach(function (modifier) {
        var probability = chance(modifier.chance, modifier.id)
        var success = probability === 1 || (probability > 0 && Number(random.nextDouble()) < probability)
        parts.push(text(success ? modifier.properties : modifier.otherwise))
        if (success) rollMarks(modifier.marks, random, marks)
      })
    // An omitted field inherits; null or zero disables the inherited guarantee.
    // This is a fixed minimum, so it does not consume a modifier chance roll.
    var perfectIVs = null
    var sendOutBall = 'cobblemon:ancient_origin_ball'
    ;[defaults, definition, tier, selected, override].forEach(function (layer) {
      if (Object.prototype.hasOwnProperty.call(layer, 'min_perfect_ivs')) perfectIVs = layer.min_perfect_ivs
      if (layer.send_out_ball != null) sendOutBall = layer.send_out_ball
    })
    if (perfectIVs > 0) parts.push('min_perfect_ivs=' + perfectIVs)
    if (PokeBalls.getPokeBall(Location.parse(sendOutBall)) == null) fail('Unknown send_out_ball: ' + sendOutBall)
    return { properties: normalizedProperties(parts), marks: marks, tier: tier.name || null, sendOutBall: sendOutBall }
  }

  function positionEntity(entity, anchor, level) {
    var offsets = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]
    var heights = [0, 1, -1, 2]
    var border = level.getWorldBorder()
    for (var h = 0; h < heights.length; h++) {
      for (var i = 0; i < offsets.length; i++) {
        var x = Number(anchor.x) + offsets[i][0]
        var y = Number(anchor.y) + heights[h]
        var z = Number(anchor.z) + offsets[i][1]
        var pos = new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z))
        if (!level.isInWorldBounds(pos) || !level.hasChunkAt(pos)) continue
        entity.setPositionAndRotation(x, y, z, 0, 0)
        var bounds = entity.getBoundingBox()
        if (bounds.minX < border.getMinX() || bounds.maxX > border.getMaxX() ||
            bounds.minZ < border.getMinZ() || bounds.maxZ > border.getMaxZ()) continue
        if (bounds.maxY > level.getMaxBuildHeight() || bounds.minY < level.getMinBuildHeight()) continue
        var loaded = true
        for (var bx = Math.floor(bounds.minX / 16); bx <= Math.floor(bounds.maxX / 16); bx++) {
          for (var bz = Math.floor(bounds.minZ / 16); bz <= Math.floor(bounds.maxZ / 16); bz++) {
            if (!level.hasChunkAt(new BlockPos(bx * 16, pos.getY(), bz * 16))) loaded = false
          }
        }
        if (!loaded || !level.hasChunkAt(new BlockPos(Math.floor(bounds.maxX), pos.getY(), Math.floor(bounds.maxZ)))) continue
        if (level.noCollision(entity, bounds)) return pos
      }
    }
    fail('There is not enough room at the impact for this Pokémon')
  }
  function feedback(label, action) {
    try { action() }
    catch (error) { console.error('[poke_lures] ' + label + ' failed: ' + String(error)) }
  }
  function effects(level, anchor, sendOutBall) {
    var x = Number(anchor.x), y = Number(anchor.y), z = Number(anchor.z)
    // Match native send-out naming: underscores removed from the ball's path.
    var ballPath = (sendOutBall || 'cobblemon:ancient_origin_ball').split(':')[1].replace(/_/g, '')
    var particles = ['cobblemon:evo_bigsparkle', 'cobblemon:evo_flyingsparkles',
      'cobblemon:' + ballPath + '/casual/ballsparks', 'cobblemon:' + ballPath + '/casual/ballsendsparkle',
      'cobblemon:' + ballPath + '/casual/sendflash']
    // Use the same positional packet as /bedrockparticle, without running a
    // permission-gated command as a projectile. It survives projectile removal.
    // Native sendflash omits sleep_time: Cobblemon defaults it to zero and
    // stops the emitter after active_time, despite its "looping" JSON type.
    particles.forEach(function (id) {
      feedback('Impact particle ' + id, function () {
        var packet = new ParticlePacket(Location.parse(id), anchor)
        var viewers = level.getServer().getPlayerList().getPlayers().iterator()
        while (viewers.hasNext()) {
          var viewer = viewers.next()
          if (viewer.level !== level) continue
          var dx = Number(viewer.getX()) - x, dy = Number(viewer.getY()) - y, dz = Number(viewer.getZ()) - z
          if (dx * dx + dy * dy + dz * dz <= 64 * 64) {
            feedback('Impact particle delivery', function () { packet.sendToPlayer(viewer) })
          }
        }
      })
    })
    ;[['cobblemon:poke_ball.break', 0.6], ['cobblemon:block.campfire_pot.open', 2],
      ['cobblemon:block.fossil_machine.finished', 2]].forEach(function (sound) {
      feedback('Impact sound ' + sound[0], function () {
        // poke_ball.break is a client sound asset, not a registered server
        // SoundEvent. Create a direct event, as /playsound does, to retain it.
        level.playSound(null, x, y, z, SoundEvent.createVariableRangeEvent(Location.parse(sound[0])), SoundSource.AMBIENT, 1, sound[1])
      })
    })
  }
  function throwLure(stack, level, player) {
    var id = String(player.getGameProfile().getId())
    var now = Number(level.getTime())
    if (stack.isEmpty() || !definitions[String(stack.id)] || busy[id] ||
        (lastUse[id] != null && now - lastUse[id] < 10) || player.isSpectator()) return false
    if (PlayerExtensions.getBattleState(player) != null) { player.tell(Text.red('You cannot use a Poké Lure during battle.')); return false }
    busy[id] = true
    var committed = false
    try {
      // Roll once at throw time, then save the result and full item components
      // on the vanilla projectile. Reloads/hand changes cannot change its prize.
      var rolled = roll(stack, level.getRandom(), player)
      var snapshot = stack.copyWithCount(1)
      var thrownItem = stack.getItem()
      var projectile = new Snowball['(net.minecraft.world.level.Level,net.minecraft.world.entity.LivingEntity)'](level, player)
      projectile.setItem(snapshot)
      var record = new Tag()
      record.putString('owner', id)
      record.putString('roll', JSON.stringify(rolled))
      record.put('stack', snapshot.save(level.registryAccess()))
      projectile.persistentData.put(PROJECTILE_KEY, record)
      var look = player.getLookAngle()
      projectile.shoot(Number(look.x), Number(look.y), Number(look.z), 1.5, 1)
      if (!level.addFreshEntity(projectile)) fail('The lure throw was cancelled')
      committed = true
      lastUse[id] = now
      stack.shrink(1)
      player.getInventory().setChanged()
      try {
        player.addItemCooldown(thrownItem, 10)
        level.playSound(null, player.getX(), player.getY(), player.getZ(), Sounds.SNOWBALL_THROW, SoundSource.PLAYERS, 0.5, 1)
      } catch (effectError) { console.error('[poke_lures] Throw succeeded; feedback failed: ' + String(effectError)) }
      return true
    } catch (error) {
      console.error('[poke_lures] ' + String(error))
      player.tell(Text.red(committed ? 'The lure was thrown, but its feedback failed.' : 'The lure was not thrown: ' + String(error)))
      return committed
    } finally { delete busy[id] }
  }
  Object.keys(definitions).forEach(function (id) {
    ItemEvents.rightClicked(id, function (event) {
      if (event.level.isClientSide()) return
      // LivingEntityKJS exposes swing(hand); it hides vanilla's two-arg form.
      if (throwLure(event.item, event.level, event.player)) event.player.swing(event.hand)
      event.cancel()
    })
  })

  function impactLure(event) {
    var projectile = event.getProjectile()
    var level = projectile.level
    if (level.isClientSide()) return
    var record = projectile.persistentData.getCompound(PROJECTILE_KEY)
    if (!record.contains('roll', 8)) return
    // Suppress vanilla snowball damage/hit behavior and settle each lure once.
    event.setCanceled(true)
    if (record.getBoolean('settled')) return
    record.putBoolean('settled', true)
    var anchor = event.getRayTraceResult().getLocation()
    var player = level.getServer().getPlayerList().getPlayer(UUID.fromString(record.getString('owner')))
    var snapshot = ItemStack.parseOptional(level.registryAccess(), record.getCompound('stack'))
    var committed = false
    try {
      var rolled = JSON.parse(String(record.getString('roll')))
      var grantedMarks = rolled.marks.map(function (mark) {
        var resolved = Marks.getByIdentifier(Location.parse(mark.id))
        if (resolved == null) fail('Unknown Pokémon mark: ' + mark.id)
        return { mark: resolved, active: mark.active === true }
      })
      var properties = Properties.Companion.parse(rolled.properties)
      var species = properties.getSpecies()
      // The native parser resolves/validates identifiers, including non-Cobblemon
      // namespaces. A second getByName lookup would reject valid namespaced IDs.
      if (species == null) fail('No valid Pokémon species in: ' + rolled.properties)
      var entity = properties.createEntity(level)
      var pos = positionEntity(entity, anchor, level)
      entity.finalizeSpawn(level, level.getCurrentDifficultyAt(pos), SpawnType.COMMAND, null)
      var pokemon = entity.getPokemon()
      grantedMarks.forEach(function (grant) {
        pokemon.exchangeMark(grant.mark, true)
        if (grant.active) pokemon.setActiveMark(grant.mark)
      })
      // Send the opening effects at the actual collision point before the
      // spawn packet, even when the Pokemon needs a nearby clear position.
      effects(level, anchor, rolled.sendOutBall)
      if (!level.addFreshEntity(entity)) fail('The Pokémon spawn was cancelled')
      committed = true
      // Award only after the Pokemon was actually added to the world. Neither
      // obtaining a ticket, throwing, nor a failed impact can earn it.
      feedback('Spawn advancement', function () {
        if (player != null) player.unlockAdvancement(Location.parse('lcc:lets_go_gambling'))
      })
    } catch (error) {
      console.error('[poke_lures] ' + String(error))
      if (!committed && !snapshot.isEmpty()) {
        try {
          if (player != null && typeof global.lccPokeLures.giveStack === 'function') global.lccPokeLures.giveStack(player, snapshot)
          else {
            var refund = new ItemEntity(level, Number(anchor.x), Number(anchor.y), Number(anchor.z), snapshot)
            refund.setDefaultPickUpDelay()
            if (!level.addFreshEntity(refund)) fail('The lure refund drop was cancelled')
          }
          if (player != null) player.tell(Text.red('No Pokémon could spawn there. Your lure was returned.'))
        } catch (refundError) { console.error('[poke_lures] Refund failed: ' + String(refundError)) }
      }
    } finally { projectile.discard() }
  }
  NativeEvents.onEvent(ImpactEvent, function (event) {
    // Native event consumers, like renderer callbacks, need their own guard.
    try { impactLure(event) }
    catch (error) { console.error('[poke_lures] Impact callback failed: ' + String(error)) }
  })

  function isLegacy(stack) {
    var legacy = config.legacy || {}
    if (!legacy.enabled || stack.isEmpty() || String(stack.id) !== legacy.item) return false
    var model = stack.get(Components.CUSTOM_MODEL_DATA)
    return model != null && Number(model.value()) === Number(legacy.customModelData)
  }
  function convertLegacy(player) {
    var inventory = player.getInventory()
    var changed = false
    for (var slot = 0; slot < inventory.getContainerSize(); slot++) {
      var stack = inventory.getItem(slot)
      if (!isLegacy(stack)) continue
      var replacement = Item.of(config.legacy.replacement, Number(stack.getCount()))
      var custom = stack.get(Components.CUSTOM_DATA)
      if (custom != null) replacement.set(Components.CUSTOM_DATA, custom)
      inventory.setItem(slot, replacement)
      changed = true
    }
    if (changed) inventory.setChanged()
  }
  PlayerEvents.inventoryChanged(function (event) { convertLegacy(event.player) })
  PlayerEvents.loggedIn(function (event) {
    convertLegacy(event.player)
    // The old reward mod can run after this listener; sweep after all login hooks.
    event.server.scheduleInTicks(1, function () { convertLegacy(event.player) })
  })
  PlayerEvents.loggedOut(function (event) {
    var id = String(event.player.getGameProfile().getId())
    delete busy[id]
    delete lastUse[id]
  })
  ItemEvents.firstRightClicked('cobblemon:npc_editor', function (event) {
    if (!isLegacy(event.item)) return
    convertLegacy(event.player)
    event.cancel()
  })

  // Reusable operations for the admin commands and daily-reward script.
  global.lccPokeLures.roll = roll
  global.lccPokeLures.configure = function (stack, json) {
    if (!definitions[String(stack.id)]) fail('Hold a Poké Lure first')
    var override = validateOverride(JSON.parse(String(json)))
    var custom = customData(stack)
    var record = new Tag()
    record.putString('config', JSON.stringify(override))
    custom.put(KEY, record)
    stack.set(Components.CUSTOM_DATA, CustomData.of(custom))
  }
})()
