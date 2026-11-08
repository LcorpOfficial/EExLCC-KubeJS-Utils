// Randomly replace selected blocks in newly generated chunks with A-Z Unown variants.
// Blank-Glyphed blocks are intentionally excluded from world generation.

const $ChunkLoadEvent = Java.loadClass('net.neoforged.neoforge.event.level.ChunkEvent$Load')
const $ServerLevel = Java.loadClass('net.minecraft.server.level.ServerLevel')
const $LevelChunk = Java.loadClass('net.minecraft.world.level.chunk.LevelChunk')
const $RandomSource = Java.loadClass('net.minecraft.util.RandomSource')
const $BlockPos = Java.loadClass('net.minecraft.core.BlockPos')

const UNOWN_GLYPHS = 'abcdefghijklmnopqrstuvwxyz'.split('')

function unownStates(blockType) {
  return UNOWN_GLYPHS.map(letter =>
    Block.getBlock(`kubejs:${letter}_glyphed_${blockType}`).defaultBlockState()
  )
}

const UNOWN_REPLACEMENT_FAMILIES = [
  {
    targets: [Blocks.CHISELED_SANDSTONE, Blocks.CUT_SANDSTONE],
    chance: 0.02,
    states: unownStates('sandstone')
  },
  {
    targets: [Blocks.CHISELED_RED_SANDSTONE, Blocks.CUT_RED_SANDSTONE],
    chance: 0.03,
    states: unownStates('red_sandstone')
  },
  {
    targets: [Blocks.END_STONE_BRICKS],
    chance: 0.005,
    states: unownStates('end_stone')
  }
]

function replacementFamily(state) {
  for (const family of UNOWN_REPLACEMENT_FAMILIES) {
    for (const target of family.targets) {
      if (state.is(target)) {
        return family
      }
    }
  }

  return null
}

NativeEvents.onEvent($ChunkLoadEvent, event => {
  if (!event.isNewChunk()) {
    return
  }

  const level = event.getLevel()
  const chunk = event.getChunk()

  if (!(level instanceof $ServerLevel) || !(chunk instanceof $LevelChunk)) {
    return
  }

  const chunkPos = chunk.getPos()
  const random = $RandomSource.create(level.getSeed())
    .forkPositional()
    .at(new $BlockPos(chunkPos.getMinBlockX(), 0, chunkPos.getMinBlockZ()))

  let replacements = 0

  for (const section of chunk.getSections()) {
    if (section.hasOnlyAir() || !section.maybeHas(candidateState => replacementFamily(candidateState) !== null)) {
      continue
    }

    for (let y = 0; y < 16; y++) {
      for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
          var currentState = section.getBlockState(x, y, z)
          var family = replacementFamily(currentState)

          if (family !== null && random.nextFloat() < family.chance) {
            var replacement = family.states[random.nextInt(family.states.length)]
            section.setBlockState(x, y, z, replacement, false)
            replacements++
          }
        }
      }
    }
  }

  if (replacements > 0) {
    chunk.setUnsaved(true)
  }
})
