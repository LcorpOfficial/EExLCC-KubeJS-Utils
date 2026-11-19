// Commands, legacy advancement overrides, and a replacement for lccreward's
// login grant. In auto mode the old mod grants the configured ticket while it
// is installed, without a duplicate KubeJS login grant.
;(function () {
  var config = JSON.parse(JsonIO.readString('kubejs/config/poke_lures.json'))
  var daily = config.dailyReward || { mode: 'off' }
  var ZoneId = Java.loadClass('java.time.ZoneId')
  var ZonedDateTime = Java.loadClass('java.time.ZonedDateTime')
  var Tag = Java.loadClass('net.minecraft.nbt.CompoundTag')
  var LEGACY_MOD = Platform.isLoaded('lccreward')
  var CLAIM_KEY = 'lccPokeLureRewardWindow'
  var times = (daily.times || []).map(function (time) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid daily reward time: ' + time)
    return Number(time.substring(0, 2)) * 60 + Number(time.substring(3))
  }).sort(function (a, b) { return a - b })
  if (['auto', 'kubejs', 'off'].indexOf(daily.mode) < 0) throw new Error('Invalid daily reward mode')
  var rewardCount = daily.count == null ? 1 : Number(daily.count)
  if (!Number.isInteger(rewardCount) || rewardCount < 1 || rewardCount > 64) throw new Error('Invalid daily reward count')
  if (daily.mode !== 'off' && !Item.exists(daily.item)) throw new Error('Daily reward must be a registered item')
  var zone = ZoneId.of(daily.timezone || 'America/Indiana/Indianapolis')

  function giveStack(player, stack) {
    var inventory = player.getInventory()
    for (var slot = 0; slot < 36 && !stack.isEmpty(); slot++) {
      var current = inventory.getItem(slot)
      if (current.isEmpty() || !current.equalsIgnoringCount(stack)) continue
      var room = Math.min(current.getMaxStackSize(), inventory.getMaxStackSize()) - Number(current.getCount())
      if (room > 0) { var added = Math.min(room, Number(stack.getCount())); current.grow(added); stack.shrink(added) }
    }
    for (var empty = 0; empty < 36 && !stack.isEmpty(); empty++) {
      if (!inventory.getItem(empty).isEmpty()) continue
      var count = Math.min(stack.getMaxStackSize(), inventory.getMaxStackSize(), Number(stack.getCount()))
      inventory.setItem(empty, stack.copyWithCount(count))
      stack.shrink(count)
    }
    if (!stack.isEmpty() && player.drop(stack, false, false) == null) throw new Error('Could not give or drop the item')
    inventory.setChanged()
  }
  function give(player, itemId, amount) { giveStack(player, Item.of(itemId, amount)) }
  function persisted(player) {
    // Forge copies PlayerPersisted on death. Do not let dying reset a claim.
    var root = player.getForgePersistentData()
    if (!root.contains('PlayerPersisted', 10)) root.put('PlayerPersisted', new Tag())
    return root.getCompound('PlayerPersisted')
  }
  function windowKey() {
    var now = ZonedDateTime.now(zone)
    var minutes = Number(now.getHour()) * 60 + Number(now.getMinute())
    var last = -1
    for (var i = 0; i < times.length; i++) if (times[i] <= minutes) last = times[i]
    // Match the old mod: no grant before today's first scheduled time.
    return last < 0 ? -1 : Number(now.toLocalDate().toEpochDay()) * 1440 + last
  }
  function migrateClaim(player) {
    if (!LEGACY_MOD) return
    var old = player.getNbt().getCompound('neoforge:attachments')
    if (!old.contains('lccreward:last_reward_window')) return
    var value = Number(old.getLong('lccreward:last_reward_window'))
    var saved = persisted(player)
    if (value >= 0 && (!saved.contains(CLAIM_KEY) || value > Number(saved.getLong(CLAIM_KEY)))) saved.putLong(CLAIM_KEY, value)
  }
  function claim(player, force) {
    if (daily.mode === 'off' || (daily.mode === 'auto' && LEGACY_MOD)) return false
    var key = windowKey()
    if (!force && key < 0) return false
    var saved = persisted(player)
    if (!force && saved.contains(CLAIM_KEY) && Number(saved.getLong(CLAIM_KEY)) >= key) return false
    give(player, daily.item, rewardCount)
    saved.putLong(CLAIM_KEY, key)
    if (daily.message) player.tell(Text.green(daily.message))
    return true
  }
  PlayerEvents.loggedIn(function (event) {
    event.server.scheduleInTicks(1, function () {
      try { migrateClaim(event.player); claim(event.player) }
      catch (error) { console.error('[poke_lures] Daily reward failed: ' + String(error)) }
    })
  })

  ServerEvents.generateData('last', function (event) {
    // Completely disable the old random-spawn-on-food advancement. The native
    // lure callback is the only place allowed to create/consume the reward.
    event.json('gachapotion:advancement/drink_coin.json', {
      criteria: { replaced_by_kubejs: { trigger: 'minecraft:impossible' } }
    })
    // Retire direct/macro function calls as well, even on an older world pack.
    var retired = '# Retired: throwable Poke Lures are handled by KubeJS projectile impacts.\n'
    event.text('gachapotion:function/drink_coin.mcfunction', retired)
    event.text('gachapotion:function/spawn_macro.mcfunction', retired)
    event.json('lcc:advancement/lets_go_gambling.json', {
      parent: 'cobblemon:catching/root_catching',
      display: {
        icon: { id: 'kubejs:poke_lure' }, title: { text: "Let's Go Gambling!" },
        description: { text: 'Aw dangit!' }, hidden: true
      },
      // Retain the criterion's old key to preserve earned player progress.
      // Only the successful spawn callback explicitly awards this advancement.
      criteria: { consume_poke_lure: { trigger: 'minecraft:impossible' } },
      sends_telemetry_event: false
    })
  })

  ServerEvents.commandRegistry(function (event) {
    var Commands = event.commands
    var EntityArgument = Java.loadClass('net.minecraft.commands.arguments.EntityArgument')
    var IntegerArgument = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType')
    var StringArgument = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
    var BoolArgument = Java.loadClass('com.mojang.brigadier.arguments.BoolArgumentType')
    function guarded(action) {
      return function (ctx) {
        try { return Number(action(ctx)) }
        catch (error) { ctx.source.sendFailure(Text.red(String(error))); return 0 }
      }
    }
    function self(ctx) {
      var player = ctx.source.player
      if (player == null) throw new Error('Specify a player when running from the console')
      return player
    }
    function grant(ctx, item, target, count) { give(target, item, count); return 1 }
    function claimTargets(ctx, force) {
      var targets = EntityArgument.getPlayers(ctx, 'targets').iterator()
      var count = 0
      while (targets.hasNext()) if (claim(targets.next(), force)) count++
      return count
    }
    var root = Commands.literal('pokelure')
    root.then(Commands.literal('claim').executes(guarded(function (ctx) {
      if (claim(self(ctx))) return 1
      ctx.source.sendFailure(Text.gray('No daily reward is available right now.'))
      return 0
    })))
    var giving = Commands.literal('give').requires(function (source) { return source.hasPermission(2) })
    config.items.forEach(function (definition) {
      var item = definition.id
      giving.then(Commands.literal(item.split(':')[1])
        .executes(guarded(function (ctx) { return grant(ctx, item, self(ctx), 1) }))
        .then(Commands.argument('player', EntityArgument.player())
          .executes(guarded(function (ctx) { return grant(ctx, item, EntityArgument.getPlayer(ctx, 'player'), 1) }))
          .then(Commands.argument('count', IntegerArgument.integer(1, 64))
            .executes(guarded(function (ctx) { return grant(ctx, item, EntityArgument.getPlayer(ctx, 'player'), IntegerArgument.getInteger(ctx, 'count')) }))))
      )
    })
    root.then(giving)
    root.then(Commands.literal('configure').requires(function (source) { return source.hasPermission(2) })
      .then(Commands.argument('json', StringArgument.greedyString()).executes(guarded(function (ctx) {
        var player = self(ctx)
        if (typeof global.lccPokeLures.configure !== 'function') throw new Error('Lure configuration is not loaded')
        global.lccPokeLures.configure(player.getMainHandItem(), StringArgument.getString(ctx, 'json'))
        player.getInventory().setChanged()
        player.tell(Text.green('Held lure stack updated.'))
        return 1
      }))))
    event.register(root)
    // Keep the old operator command available after removing the helper mod.
    if (!LEGACY_MOD) event.register(Commands.literal('lccreward').requires(function (source) { return source.hasPermission(2) })
      .then(Commands.literal('give')
        .executes(guarded(function (ctx) { return claim(self(ctx)) ? 1 : 0 }))
        .then(Commands.argument('targets', EntityArgument.players())
          .executes(guarded(function (ctx) { return claimTargets(ctx, false) }))
          .then(Commands.argument('force', BoolArgument.bool())
            .executes(guarded(function (ctx) { return claimTargets(ctx, BoolArgument.getBool(ctx, 'force')) }))))))
  })
  global.lccPokeLures.claim = claim
  global.lccPokeLures.windowKey = windowKey
  global.lccPokeLures.giveStack = giveStack
})()
