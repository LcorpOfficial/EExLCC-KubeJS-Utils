const $AwardComponents = Java.loadClass('net.minecraft.core.component.DataComponents')
const $AwardCustomData = Java.loadClass('net.minecraft.world.item.component.CustomData')
const $AwardTag = Java.loadClass('net.minecraft.nbt.CompoundTag')
const $AwardLore = Java.loadClass('net.minecraft.world.item.component.ItemLore')
const $AwardList = Java.loadClass('java.util.ArrayList')
const $AwardDropsEvent = Java.loadClass('net.neoforged.neoforge.event.level.BlockDropsEvent')
const $AwardRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')

// Use function-scoped locals below: this Rhino build mishandles const bindings
// in conditional branches, including the trophy-only block entity component.
function lccAwardIsTrophy(stack) {
  return lccAwardIsTrophyId(stack.id)
}

function lccAwardIsTrophyId(id) {
  var value = String(id)
  return global.lccAwards.trophies.some(trophy => String(trophy) === value)
}

function lccAwardIsItem(stack) {
  return stack != null && !stack.isEmpty() &&
    (lccAwardIsTrophy(stack) || Ingredient.of('#lcc:badges').test(stack))
}

function lccAwardReadComponent(stack, component) {
  var data = stack.get(component)
  return data == null ? new $AwardTag() : data.copyTag()
}

function lccAwardValid(record) {
  return record != null && record.contains('grantedBy', 8) && record.contains('grantedTo', 8)
}

function lccAwardReadItem(stack) {
  var key = global.lccAwards.key
  var custom = lccAwardReadComponent(stack, $AwardComponents.CUSTOM_DATA)
  if (lccAwardValid(custom.getCompound(key))) return custom.getCompound(key).copy()

  var blockData = lccAwardReadComponent(stack, $AwardComponents.BLOCK_ENTITY_DATA)
  var blockRecord = blockData.getCompound('data').getCompound(key)
  if (lccAwardValid(blockRecord)) return blockRecord.copy()

  // Upgrade old /grant items from their existing lore. UUIDs cannot be recovered
  // reliably from names, so legacy records retain just the recorded names.
  var lore = stack.get($AwardComponents.LORE)
  if (lore == null) return null
  var earnedBy = ''
  var grantedBy = ''
  lore.lines().forEach(line => {
    var awardLine = String(line.getString())
    if (awardLine.startsWith('Earned by: ')) earnedBy = awardLine.substring(11)
    if (awardLine.startsWith('Granted by: ')) grantedBy = awardLine.substring(12)
  })
  if (!earnedBy || !grantedBy) return null

  var record = new $AwardTag()
  record.putString('grantedBy', grantedBy)
  record.putString('grantedTo', earnedBy)
  return record
}

function lccAwardGray(value) {
  var line = Text.gray(value)
  return line.setStyle(line.getStyle().withItalic(false))
}

function lccAwardApplyItem(stack, record) {
  var key = global.lccAwards.key
  var custom = lccAwardReadComponent(stack, $AwardComponents.CUSTOM_DATA)
  custom.put(key, record.copy())
  stack.set($AwardComponents.CUSTOM_DATA, $AwardCustomData.of(custom))

  if (lccAwardIsTrophy(stack)) {
    // Vanilla BlockItem loads this component into the block entity on placement,
    // including offhand placement. KubeBlockEntity saves/syncs its "data" tag.
    var blockData = lccAwardReadComponent(stack, $AwardComponents.BLOCK_ENTITY_DATA)
    var data = blockData.getCompound('data')
    data.put(key, record.copy())
    blockData.put('data', data)
    blockData.putString('id', String(stack.id))
    stack.set($AwardComponents.BLOCK_ENTITY_DATA, $AwardCustomData.of(blockData))
  }

  var lines = new $AwardList()
  var oldLore = stack.get($AwardComponents.LORE)
  if (oldLore != null) {
    oldLore.lines().forEach(line => {
      var oldAwardLine = String(line.getString())
      if (!oldAwardLine.startsWith('Earned by: ') && !oldAwardLine.startsWith('Granted by: ')) {
        lines.add(line)
      }
    })
  }
  lines.add(lccAwardGray('Earned by: ' + record.getString('grantedTo')))
  lines.add(lccAwardGray('Granted by: ' + record.getString('grantedBy')))
  stack.set($AwardComponents.LORE, new $AwardLore(lines))
  return stack
}

global.lccAwards.stamp = (stack, grantor, recipient) => {
  var record = new $AwardTag()
  // Entity#getUUID is renamed by KubeJS's script API. GameProfile's identity
  // getters are available directly and return the same player's UUID.
  var grantorProfile = grantor.getGameProfile()
  var recipientProfile = recipient.getGameProfile()
  record.putString('grantedBy', String(grantorProfile.getName()))
  record.putString('grantedByUuid', String(grantorProfile.getId()))
  record.putString('grantedTo', String(recipientProfile.getName()))
  record.putString('grantedToUuid', String(recipientProfile.getId()))
  return lccAwardApplyItem(stack, record)
}

function lccAwardMigrateItem(stack) {
  if (!lccAwardIsItem(stack)) return false
  var key = global.lccAwards.key
  var custom = lccAwardReadComponent(stack, $AwardComponents.CUSTOM_DATA)
  var blockRecord = lccAwardReadComponent(stack, $AwardComponents.BLOCK_ENTITY_DATA)
    .getCompound('data').getCompound(key)
  if (lccAwardValid(custom.getCompound(key)) &&
      (!lccAwardIsTrophy(stack) || lccAwardValid(blockRecord))) return false

  var record = lccAwardReadItem(stack)
  if (record == null) return false
  lccAwardApplyItem(stack, record)
  return true
}

PlayerEvents.inventoryChanged(event => {
  if (lccAwardMigrateItem(event.item)) event.player.getInventory().setChanged()
})

PlayerEvents.loggedIn(event => {
  var inventory = event.player.getInventory()
  var changed = false
  for (var slot = 0; slot < inventory.getContainerSize(); slot++) {
    if (lccAwardMigrateItem(inventory.getItem(slot))) changed = true
  }
  if (changed) inventory.setChanged()
})

global.lccAwards.trophies.forEach(id => {
  var trophyId = String(id)
  BlockEvents.placed(trophyId, event => {
    // The placement event can precede BlockItem's component restoration. Send
    // the complete saved data after that finishes so Jade sees the award at once.
    var level = event.level
    var pos = event.block.pos.immutable()
    event.server.scheduleInTicks(1, () => {
      if (!level.hasChunkAt(pos)) return
      var block = level.getBlock(pos)
      if (String(block.id) !== trophyId || block.entity == null) return
      block.entity.sync()
    })
  })

})

NativeEvents.onEvent($AwardDropsEvent, event => {
  var trophyId = String($AwardRegistries.BLOCK.getKey(event.getState().getBlock()))
  if (!lccAwardIsTrophyId(trophyId)) return

  // CachedLevelBlock.getEntity() discards entities marked removed and asks the
  // world for a replacement. At drop time that world position is often air.
  // The native event retains the original entity, including all its saved data.
  var entity = event.getBlockEntity()
  if (entity == null) return
  var saved = entity.saveWithoutMetadata(event.getLevel().registryAccess())
  var record = saved.getCompound('data').getCompound(global.lccAwards.key)
  if (!lccAwardValid(record)) {
    record = saved.getCompound('components').getCompound('minecraft:custom_data')
      .getCompound(global.lccAwards.key)
  }
  if (!lccAwardValid(record)) return

  event.getDrops().forEach(drop => {
    var stack = drop.getItem()
    if (String(stack.id) !== trophyId) return
    lccAwardApplyItem(stack, record)
    drop.setItem(stack)
  })
})
