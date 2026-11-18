// Copy-only configuration; no real inventory/cursor items ever enter this menu.
// Saved below KubeBlockEntity's "data.lccGiftOMatic" NBT, including full 1.21
// item components. Rewards are infinite templates, one equally likely entry per
// occupied slot. Repeated entries can weight a reward. All locals use var for Rhino.
;(function () {
  var BASE = 'kubejs:gift_o_matic'
  var TOP = 'kubejs:gift_o_matic_top'
  var KEY = 'lccGiftOMatic'
  var Tag = Java.loadClass('net.minecraft.nbt.CompoundTag')
  var ListTag = Java.loadClass('net.minecraft.nbt.ListTag')
  var Stack = Java.loadClass('net.minecraft.world.item.ItemStack')
  var UUID = Java.loadClass('java.util.UUID')
  var ChestMenu = Java.loadClass('net.minecraft.world.inventory.ChestMenu')
  var MenuType = Java.loadClass('net.minecraft.world.inventory.MenuType')
  var ClickType = Java.loadClass('net.minecraft.world.inventory.ClickType')
  var Container = Java.loadClass('net.minecraft.world.SimpleContainer')
  var Provider = Java.loadClass('net.minecraft.world.SimpleMenuProvider')
  var Components = Java.loadClass('net.minecraft.core.component.DataComponents')
  var Component = Java.loadClass('net.minecraft.network.chat.Component')
  var Sounds = Java.loadClass('net.minecraft.sounds.SoundEvents')
  var Source = Java.loadClass('net.minecraft.sounds.SoundSource')

  function data(be) {
    if (!be.data.contains(KEY, 10)) be.data.put(KEY, new Tag())
    return be.data.getCompound(KEY)
  }

  function permitted(player) { return player.isCreative() && player.hasPermissions(2) }
  function owner(player) { return String(player.getGameProfile().getId()) }
  function read(level, tag) { return Stack.parseOptional(level.registryAccess(), tag) }
  function write(level, stack) { return stack.isEmpty() ? new Tag() : stack.save(level.registryAccess()) }
  function sound(level, pos, value, pitch) {
    // Coordinates choose the unambiguous Player overload; null + BlockPos does not.
    level.playSound(null, pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5,
      value, Source.BLOCKS, 0.8, pitch)
  }
  function sync(be) { be.save(); be.sync() }

  function giveReward(player, prize) {
    var inventory = player.getInventory()
    var limit
    var existing
    // Inventory.add silently deletes overflow in creative mode. Insert into
    // the 36 normal inventory slots explicitly so ALL players get ground overflow.
    for (var slot = 0; slot < 36 && !prize.isEmpty(); slot++) {
      existing = inventory.getItem(slot)
      if (!existing.isEmpty() && Stack.isSameItemSameComponents(existing, prize)) {
        limit = Math.min(existing.getMaxStackSize(), inventory.getMaxStackSize()) - existing.getCount()
        if (limit > 0) {
          limit = Math.min(limit, prize.getCount())
          existing.grow(limit)
          prize.shrink(limit)
        }
      }
    }
    for (var empty = 0; empty < 36 && !prize.isEmpty(); empty++) {
      if (!inventory.getItem(empty).isEmpty()) continue
      limit = Math.min(prize.getMaxStackSize(), inventory.getMaxStackSize(), prize.getCount())
      inventory.setItem(empty, prize.copyWithCount(limit))
      prize.shrink(limit)
    }
    if (!prize.isEmpty()) player.drop(prize, false, false)
    inventory.setChanged()
  }

  function pools(be) { return data(be).getList('pools', 10) }
  function rewards(pool) { return pool.getList('rewards', 10) }
  function matching(level, list, stack) {
    if (stack.isEmpty()) return -1
    for (var i = 0; i < list.size(); i++) {
      if (Stack.isSameItemSameComponents(stack, read(level, list.getCompound(i).getCompound('cost')))) return i
    }
    return -1
  }
  function hasTop(be) {
    var level = be.getLevel()
    var above = be.getBlockPos().above()
    return level.isInWorldBounds(above) && level.hasChunkAt(above) && String(level.getBlock(above).id) === TOP
  }
  function editor(be) {
    var record = data(be).getCompound('editor')
    if (!record.contains('owner', 8)) return null
    var player = be.getLevel().getServer().getPlayerList().getPlayer(UUID.fromString(record.getString('owner')))
    if (player != null && player.containerMenu !== player.inventoryMenu &&
        Number(player.containerMenu.containerId) === Number(record.getInt('menu'))) return player
    data(be).remove('editor')
    be.save()
    return null
  }

  function icon(id, name) {
    var stack = Item.of(id)
    stack.set(Components.CUSTOM_NAME, Component.literal(name))
    return stack
  }

  function configure(player, be) {
    var level = be.getLevel()
    var pos = be.getBlockPos().immutable()
    var draft = []
    var saved = pools(be)
    for (var i = 0; i < 9; i++) {
      draft.push(i < saved.size() ? saved.getCompound(i).copy() : new Tag())
    }
    var selected = 0
    var brush = Stack.EMPTY
    // SimpleContainer also has ItemStack... constructors. KubeJS's ItemStack
    // wrapper makes Rhino try that overload for a numeric JS argument.
    var ghost = new Container['(int)'](54)
    var menu = null
    var session = String(UUID.randomUUID())

    function valid(who) {
      return permitted(who) && !be.isRemoved() && who.level === level &&
        who.getDistanceSq(pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5) <= 64 &&
        hasTop(be) && !data(be).contains('active', 10)
    }
    function refresh() {
      for (var slot = 0; slot < 54; slot++) ghost.setItem(slot, Stack.EMPTY)
      for (var p = 0; p < 9; p++) {
        var cost = read(level, draft[p].getCompound('cost'))
        ghost.setItem(p, cost.isEmpty() ? icon('minecraft:gray_stained_glass_pane', 'Empty pool ' + (p + 1)) : cost)
      }
      var entries = rewards(draft[selected])
      for (var r = 0; r < Math.min(36, entries.size()); r++) ghost.setItem(9 + r, read(level, entries.getCompound(r)))
      ghost.setItem(45, icon('minecraft:barrier', 'Clear selection / right-click reward to erase'))
      ghost.setItem(46, icon('minecraft:paper', 'Pool ' + (selected + 1) + ': top row selects; right-click sets cost'))
      ghost.setItem(47, brush.isEmpty() ? icon('minecraft:paper', 'Click your inventory to select a template') : brush.copy())
      ghost.setItem(49, icon('minecraft:lime_concrete', 'Save all pools and close'))
      ghost.setItem(50, icon('minecraft:book', 'Rows 2-5: left-click copies selected stack; right-click clears'))
      ghost.setItem(51, icon('minecraft:oak_door', 'Cancel without saving'))
      ghost.setItem(53, icon('minecraft:red_concrete', 'Delete selected pool (save to confirm)'))
      if (menu != null) menu.sendAllDataToRemote()
    }
    function save() {
      var result = new ListTag()
      var seen = []
      for (var p = 0; p < 9; p++) {
        var cost = read(level, draft[p].getCompound('cost'))
        var entries = rewards(draft[p])
        var cleaned = new ListTag()
        for (var r = 0; r < entries.size(); r++) {
          var reward = read(level, entries.getCompound(r))
          if (!reward.isEmpty()) cleaned.add(write(level, reward))
        }
        if (cost.isEmpty() && cleaned.isEmpty()) continue
        if (cost.isEmpty() || cleaned.isEmpty()) {
          player.tell(Text.red('Pool ' + (p + 1) + ' needs a currency and at least one reward.'))
          return false
        }
        for (var s = 0; s < seen.length; s++) {
          if (Stack.isSameItemSameComponents(cost, seen[s])) {
            player.tell(Text.red('Each pool must use a different currency item/components.'))
            return false
          }
        }
        seen.push(cost)
        var pool = new Tag()
        pool.put('cost', write(level, cost))
        pool.put('rewards', cleaned)
        result.add(pool)
      }
      data(be).putInt('version', 1)
      data(be).put('pools', result)
      sync(be)
      return true
    }
    refresh()
    var provider = new Provider(function (id, inventory, who) {
      menu = new JavaAdapter(ChestMenu, {
        stillValid: function (who) { return valid(who) },
        quickMoveStack: function (who, slot) { return Stack.EMPTY },
        clicked: function (slot, button, click, who) {
          slot = Number(slot)
          button = Number(button)
          if (!valid(who)) { who.closeMenu(); return }
          // Reject drag, number keys, shift, clone, throw, and double-click.
          // Never call super.clicked: client predictions are corrected below.
          if (click === ClickType.PICKUP && (button === 0 || button === 1)) {
            if (slot >= 54 && slot < 90) {
              brush = menu.getSlot(slot).getItem().copy()
            } else if (slot >= 0 && slot < 9) {
              selected = slot
              if (button === 1 && !brush.isEmpty()) draft[slot].put('cost', write(level, brush))
            } else if (slot >= 9 && slot < 45) {
              var entries = rewards(draft[selected])
              while (entries.size() < 36) entries.add(new Tag())
              entries.set(slot - 9, button === 1 ? new Tag() : write(level, brush))
              draft[selected].put('rewards', entries)
            } else if (slot === 45) {
              brush = Stack.EMPTY
            } else if (slot === 49) {
              if (save()) { who.closeMenu(); return }
            } else if (slot === 51) {
              who.closeMenu(); return
            } else if (slot === 53) {
              draft[selected] = new Tag()
            }
          }
          refresh()
        },
        removed: function (who) {
          // No real carried stack can be created by this menu. Clearing the
          // ghost container before vanilla cleanup also prevents ghost drops.
          ghost.clearContent()
          if (String(data(be).getCompound('editor').getString('session')) === session) {
            data(be).remove('editor')
            be.save()
          }
        }
      }, MenuType.GENERIC_9x6, id, inventory, ghost, 6)
      var lock = new Tag()
      lock.putString('owner', owner(who))
      lock.putInt('menu', id)
      lock.putString('session', session)
      data(be).put('editor', lock)
      be.save()
      return menu
    }, Component.literal('Gift-o-Matic Setup'))
    player.openMenu(provider)
    player.tell(Text.gray('Click inventory to select a stack. Top row: left selects pool, right sets its cost. Middle rows: left copies reward, right clears. Green saves; door cancels.'))
  }

  BlockEvents.placed(BASE, function (event) {
    var level = event.level
    var pos = event.block.pos.immutable()
    var original = event.block.entity
    var player = event.player
    var facing = event.block.blockState.getValue(BlockProperties.HORIZONTAL_FACING)
    // Match the statue's strict air-only check and deferred helper placement.
    event.server.scheduleInTicks(1, function () {
      if (!level.hasChunkAt(pos)) return
      var base = level.getBlock(pos)
      if (String(base.id) !== BASE || base.entity !== original) return
      var above = pos.above()
      if (!level.isInWorldBounds(above) || !level.hasChunkAt(above) || !level.getBlockState(above).isAir()) {
        base.set('minecraft:air')
        if (player != null && !player.isCreative()) player.give(BASE)
        return
      }
      var top = level.getBlock(above)
      top.set(TOP)
      top.setBlockState(top.blockState.setValue(BlockProperties.HORIZONTAL_FACING, facing), 3)
      original.sync()
    })
  })

  function protectOrRemove(event, base, other) {
    if (event.player == null || !event.player.isCreative() ||
        (base != null && base.entity != null &&
          (data(base.entity).contains('active', 10) || editor(base.entity) != null))) {
      event.cancel()
      return
    }
    if (other != null) other.set('minecraft:air')
  }
  BlockEvents.broken(BASE, function (event) {
    protectOrRemove(event, event.block, String(event.block.up.id) === TOP ? event.block.up : null)
  })
  BlockEvents.broken(TOP, function (event) {
    var base = String(event.block.down.id) === BASE ? event.block.down : null
    protectOrRemove(event, base, base)
  })
  BlockEvents.rightClicked(TOP, function (event) { event.cancel() })

  function interact(event) {
    var player = event.player
    var be = event.block.entity
    if (be == null || !hasTop(be)) return
    if (data(be).contains('active', 10) || editor(be) != null) return
    if (player.isShiftKeyDown() && permitted(player)) { configure(player, be); return }
    if (player.isSpectator()) return
    var list = pools(be)
    var index = matching(event.level, list, event.item)
    if (index < 0) return
    var pool = list.getCompound(index)
    var cost = read(event.level, pool.getCompound('cost'))
    if (event.item.getCount() < cost.getCount()) {
      player.tell(Text.red('This pool costs ' + cost.getCount() + ' of the held currency.'))
      return
    }
    var entries = rewards(pool)
    if (entries.isEmpty()) return
    var prize = read(event.level, entries.getCompound(event.level.getRandom().nextInt(entries.size())))
    if (prize.isEmpty()) return
    var active = new Tag()
    active.putString('owner', owner(player))
    active.putLong('started', event.level.getTime())
    active.put('prize', write(event.level, prize))
    active.put('previews', entries.copy())
    active.putBoolean('delivered', false)
    // Set the lock synchronously, before consuming payment or any effects.
    data(be).put('active', active)
    event.item.shrink(cost.getCount())
    player.getInventory().setChanged()
    sync(be)
    sound(event.level, be.getBlockPos(), Sounds.VAULT_INSERT_ITEM, 1)
  }
  BlockEvents.rightClicked(BASE, function (event) {
    if (event.level.isClientSide()) return
    // KubeEvent.cancel throws EventExit: it MUST be the last call.
    interact(event)
    event.cancel()
  })

  BlockEvents.blockEntityTick(BASE, function (event) {
    var be = event.block.entity
    if (be == null) return
    var state = data(be)
    if (!state.contains('active', 10)) return
    var active = state.getCompound('active')
    var now = Number(event.level.getTime())
    var elapsed = now - active.getLong('started')
    if (!active.getBoolean('delivered')) {
      if (elapsed < 40 && elapsed % 2 === 0) {
        sound(event.level, be.getBlockPos(), elapsed % 4 === 0 ? Sounds.COPPER_BULB_TURN_ON : Sounds.COPPER_BULB_TURN_OFF, 1.8)
      }
      // 40 ticks spinning, 8 ticks showing the chosen prize, 12 descending.
      if (elapsed < 60) return
      var player = event.server.getPlayerList().getPlayer(UUID.fromString(active.getString('owner')))
      // Keep the selected prize and lock in NBT until its owner reconnects.
      if (player == null) return
      var prize = read(event.level, active.getCompound('prize'))
      if (!prize.isEmpty()) giveReward(player, prize)
      active.putBoolean('delivered', true)
      active.putLong('resetAt', now + 20)
      sync(be)
      sound(event.level, be.getBlockPos(), Sounds.VAULT_EJECT_ITEM, 1)
    } else if (now >= active.getLong('resetAt')) {
      state.remove('active')
      sync(be)
    }
  })
})()
