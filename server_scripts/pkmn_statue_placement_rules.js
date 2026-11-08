const BOTTOM = 'kubejs:pkmn_statue'
const TOP    = 'kubejs:pkmn_statue_top'

// console.info('[pkmn_statue] rules loaded')

function idOf(block) {
  return String(block.id)
}

function isReplaceableForTop(block) {
  // Strict: only air
  return idOf(block) === 'minecraft:air'
}

BlockEvents.placed(event => {
  if (String(event.block.id) !== BOTTOM) return

  const base = event.block
  const above = base.up

  const aboveId = idOf(above)

  // Ceiling check: undo next tick so it sticks
  if (!isReplaceableForTop(above)) {
    // console.info('[pkmn_statue] blocked above by ' + aboveId + ' -> undo')

    event.server.scheduleInTicks(1, () => {
      // IMPORTANT: use block wrapper, not level.setBlock
      base.set('minecraft:air')

      if (event.player && !event.player.creativeMode) {
        event.player.give(BOTTOM)
      }
    })

    return
  }

  // Place top next tick (more stable)
  const facing = base.blockState.getValue(BlockProperties.HORIZONTAL_FACING)

  event.server.scheduleInTicks(1, () => {
    above.set(TOP)
    // Copy facing onto top half
    above.setBlockState(
      above.blockState.setValue(BlockProperties.HORIZONTAL_FACING, facing),
      3
    )
  })
})

// Break either half -> remove the other half
BlockEvents.broken(BOTTOM, event => {
  const base = event.block
  const above = base.up

  if (idOf(above) === TOP) {
    above.set('minecraft:air')
  }
})

BlockEvents.broken(TOP, event => {
  const top = event.block
  const below = top.down

  // If the base exists, break it too
  if (String(below.id) === BOTTOM) {
    below.set('minecraft:air')
  }

  // Drop the statue item (unless creative)
  if (event.player && !event.player.creativeMode) {
    event.block.popItem(BOTTOM)
  }
})

// Ensure top never drops anything
BlockEvents.drops(TOP, event => {
  event.itemEntities.clear()
})
