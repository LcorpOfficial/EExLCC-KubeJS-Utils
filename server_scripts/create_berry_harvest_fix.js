// Create/Sable harvesters need Cobblemon's berry harvest, not just block loot.
// Spawn the berries as world items for magnet backpacks to collect.
// Reload with: /kubejs reload server-scripts (KubeJS 2101.7.2).
// This handles future harvests; existing age-0 plants are left alone.
;(() => {
  const BerryBlock = Java.loadClass('com.cobblemon.mod.common.block.BerryBlock')
  const BerryBlockEntity = Java.loadClass('com.cobblemon.mod.common.block.entity.BerryBlockEntity')
  const VanillaBlock = Java.loadClass('net.minecraft.world.level.block.Block')
  const AGE = BerryBlock.Companion.getAGE()
  let loggedHarvest = false
  let loggedEmptyYield = false

  BlockEvents.drops(event => {
    // Create's harvester supplies no breaking entity. Ignore player breaks.
    if (event.entity) return

    const original = event.block
    const originalState = original.blockState
    const berryBlock = originalState.getBlock()
    if (!(berryBlock instanceof BerryBlock)) return
    if (Number(originalState.getValue(AGE)) !== BerryBlock.FRUIT_AGE) return

    const level = event.level
    const pos = original.pos.immutable()
    const liveState = level.getBlockState(pos)
    // Another handler may already have harvested the tree. Do not pay twice.
    if (!liveState.is(berryBlock)) return
    if (Number(liveState.getValue(AGE)) !== BerryBlock.FRUIT_AGE) return

    const originalEntity = original.entity
    if (!(originalEntity instanceof BerryBlockEntity)) return
    // Create destroys and recreates the block entity. Preserve the actual ripe
    // yield (including mutated berries), mulch and other data before it is lost.
    const berryData = originalEntity.saveWithoutMetadata(level.registryAccess())

    // Create removes the block and replants it AFTER the drops event, so an
    // immediate correction would be overwritten. Do not retain its cached
    // LevelBlock wrapper for the delayed check.
    event.server.scheduleInTicks(1, () => {
      if (!level.hasChunkAt(pos)) return

      const currentState = level.getBlockState(pos)
      if (!currentState.is(berryBlock)) return
      if (Number(currentState.getValue(AGE)) !== 0) return

      const berryEntity = level.getBlockEntity(pos)
      if (!(berryEntity instanceof BerryBlockEntity)) return

      berryEntity.loadWithComponents(berryData, level.registryAccess())
      const ripeState = Block.withProperties(currentState, { age: '5' })
      // Cobblemon returns the stored berries, sets age 3 and resets refresh
      // timers. Use the live replanted entity so the timer changes persist.
      const berries = berryEntity.harvest(level, ripeState, pos)
      berryEntity.setChanged()
      level.sendBlockUpdated(pos, currentState, level.getBlockState(pos), 3)

      // Create 6.0.10 ignores additions to the BlockDropsEvent item list. Spawn
      // real item entities here, after its harvest, for the farm's magnets.
      let count = 0
      berries.forEach(stack => {
        if (stack.isEmpty()) return
        VanillaBlock.popResource(level, pos, stack)
        count += stack.getCount()
      })

      if (count > 0 && !loggedHarvest) {
        console.info('[create_berry_harvest_fix] First harvest: spawned ' + count + ' berries at ' + pos)
        loggedHarvest = true
      } else if (count === 0 && !loggedEmptyYield) {
        console.warn('[create_berry_harvest_fix] A ripe tree had no stored berry yield at ' + pos)
        loggedEmptyYield = true
      }
    })
  })

  console.info('[create_berry_harvest_fix] Loaded: native berry harvest, age 3 regrowth, world item drops')
})()
