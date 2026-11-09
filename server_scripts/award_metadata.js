const $AwardComponents = Java.loadClass('net.minecraft.core.component.DataComponents')
const $AwardCustomData = Java.loadClass('net.minecraft.world.item.component.CustomData')
const $AwardTag = Java.loadClass('net.minecraft.nbt.CompoundTag')
const $AwardLore = Java.loadClass('net.minecraft.world.item.component.ItemLore')
const $AwardList = Java.loadClass('java.util.ArrayList')

function lccAwardIsTrophy(stack) {
  return global.lccAwards.trophies.includes(String(stack.id))
}

function lccAwardIsItem(stack) {
  return stack != null && !stack.isEmpty() &&
    (lccAwardIsTrophy(stack) || Ingredient.of('#lcc:badges').test(stack))
}

function lccAwardReadComponent(stack, component) {
  const data = stack.get(component)
  return data == null ? new $AwardTag() : data.copyTag()
}

function lccAwardValid(record) {
  return record != null && record.contains('grantedBy', 8) && record.contains('grantedTo', 8)
}

function lccAwardReadItem(stack) {
  const key = global.lccAwards.key
  const custom = lccAwardReadComponent(stack, $AwardComponents.CUSTOM_DATA)
  if (lccAwardValid(custom.getCompound(key))) return custom.getCompound(key).copy()

  const blockData = lccAwardReadComponent(stack, $AwardComponents.BLOCK_ENTITY_DATA)
  const blockRecord = blockData.getCompound('data').getCompound(key)
  if (lccAwardValid(blockRecord)) return blockRecord.copy()

  // Upgrade old /grant items from their existing lore. UUIDs cannot be recovered
  // reliably from names, so legacy records retain just the recorded names.
  const lore = stack.get($AwardComponents.LORE)
  if (lore == null) return null
  var earnedBy = ''
  var grantedBy = ''
  lore.lines().forEach(line => {
    var awardLine = String(line.getString())
    if (awardLine.startsWith('Earned by: ')) earnedBy = awardLine.substring(11)
    if (awardLine.startsWith('Granted by: ')) grantedBy = awardLine.substring(12)
  })
  if (!earnedBy || !grantedBy) return null

  const record = new $AwardTag()
  record.putString('grantedBy', grantedBy)
  record.putString('grantedTo', earnedBy)
  return record
}

function lccAwardGray(value) {
  const line = Text.gray(value)
  return line.setStyle(line.getStyle().withItalic(false))
}

function lccAwardApplyItem(stack, record) {
  const key = global.lccAwards.key
  const custom = lccAwardReadComponent(stack, $AwardComponents.CUSTOM_DATA)
  custom.put(key, record.copy())
  stack.set($AwardComponents.CUSTOM_DATA, $AwardCustomData.of(custom))

  if (lccAwardIsTrophy(stack)) {
    // Vanilla BlockItem loads this component into the block entity on placement,
    // including offhand placement. KubeBlockEntity saves/syncs its "data" tag.
    const blockData = lccAwardReadComponent(stack, $AwardComponents.BLOCK_ENTITY_DATA)
    const data = blockData.getCompound('data')
    data.put(key, record.copy())
    blockData.put('data', data)
    blockData.putString('id', String(stack.id))
    stack.set($AwardComponents.BLOCK_ENTITY_DATA, $AwardCustomData.of(blockData))
  }

  const lines = new $AwardList()
  const oldLore = stack.get($AwardComponents.LORE)
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
  const record = new $AwardTag()
  // Entity#getUUID is renamed by KubeJS's script API. GameProfile's identity
  // getters are available directly and return the same player's UUID.
  const grantorProfile = grantor.getGameProfile()
  const recipientProfile = recipient.getGameProfile()
  record.putString('grantedBy', String(grantorProfile.getName()))
  record.putString('grantedByUuid', String(grantorProfile.getId()))
  record.putString('grantedTo', String(recipientProfile.getName()))
  record.putString('grantedToUuid', String(recipientProfile.getId()))
  return lccAwardApplyItem(stack, record)
}

function lccAwardMigrateItem(stack) {
  if (!lccAwardIsItem(stack)) return false
  const key = global.lccAwards.key
  const custom = lccAwardReadComponent(stack, $AwardComponents.CUSTOM_DATA)
  const blockRecord = lccAwardReadComponent(stack, $AwardComponents.BLOCK_ENTITY_DATA)
    .getCompound('data').getCompound(key)
  if (lccAwardValid(custom.getCompound(key)) &&
      (!lccAwardIsTrophy(stack) || lccAwardValid(blockRecord))) return false

  const record = lccAwardReadItem(stack)
  if (record == null) return false
  lccAwardApplyItem(stack, record)
  return true
}

PlayerEvents.inventoryChanged(event => {
  if (lccAwardMigrateItem(event.item)) event.player.getInventory().setChanged()
})

PlayerEvents.loggedIn(event => {
  const inventory = event.player.getInventory()
  var changed = false
  for (var slot = 0; slot < inventory.getContainerSize(); slot++) {
    if (lccAwardMigrateItem(inventory.getItem(slot))) changed = true
  }
  if (changed) inventory.setChanged()
})

global.lccAwards.trophies.forEach(id => {
  BlockEvents.placed(id, event => {
    // The placement event can precede BlockItem's component restoration. Send
    // the complete saved data after that finishes so Jade sees the award at once.
    const level = event.level
    const pos = event.block.pos.immutable()
    event.server.scheduleInTicks(1, () => {
      if (!level.hasChunkAt(pos)) return
      const block = level.getBlock(pos)
      if (String(block.id) !== id || block.entity == null) return
      block.entity.sync()
    })
  })

  BlockEvents.drops(id, event => {
    // KubeJS caches the original block entity here even if the world block was
    // already removed. Mutate existing drops to preserve tool/creative loot rules.
    const entity = event.block.entity
    if (entity == null) return
    const record = entity.data.getCompound(global.lccAwards.key)
    if (!lccAwardValid(record)) return

    event.items.forEach(stack => {
      if (String(stack.id) === id) lccAwardApplyItem(stack, record)
    })
  })
})
