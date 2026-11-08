// One attempt per rising redstone edge. Tank contents and edge latch persist in NBT.
;(() => {
  const BLOCK_ID = 'kubejs:lumisene_furnace'
  const NPC_ID = 'cobblemon:lumisene_construct'
  const BUCKET = 1000
  const Enemy = Java.loadClass('net.minecraft.world.entity.monster.Enemy')
  const LivingEntity = Java.loadClass('net.minecraft.world.entity.LivingEntity')
  const NPCClasses = Java.loadClass('com.cobblemon.mod.common.api.npc.NPCClasses')
  const NPCEntity = Java.loadClass('com.cobblemon.mod.common.entity.npc.NPCEntity')
  const BlockPos = Java.loadClass('net.minecraft.core.BlockPos')
  const AABB = Java.loadClass('net.minecraft.world.phys.AABB')
  const ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
  const BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
  const ParticleTypes = Java.loadClass('net.minecraft.core.particles.ParticleTypes')
  const SoundEvents = Java.loadClass('net.minecraft.sounds.SoundEvents')
  const SoundSource = Java.loadClass('net.minecraft.sounds.SoundSource')
  const FluidAction = Java.loadClass('net.neoforged.neoforge.fluids.capability.IFluidHandler$FluidAction')

  const dangerousGround = new Set([
    'minecraft:magma_block', 'minecraft:campfire', 'minecraft:soul_campfire',
    'minecraft:cactus', 'minecraft:fire', 'minecraft:soul_fire',
    'minecraft:powder_snow', 'minecraft:sweet_berry_bush', 'minecraft:wither_rose'
  ])

  // Include the outer shell: actual distance from the mob is checked below.
  const offsets = []
  for (let x = -8; x <= 8; x++) {
    for (let y = -8; y <= 8; y++) {
      for (let z = -8; z <= 8; z++) {
        if (x * x + y * y + z * z <= 81) offsets.push([x, y, z])
      }
    }
  }
  offsets.sort((a, b) => (a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
    - (b[0] * b[0] + b[1] * b[1] + b[2] * b[2]))

  function comparatorValue(tank) {
    const amount = tank.getFluidAmount()
    return amount <= 0 ? 0 : Math.min(15, 1 + Math.floor(14 * amount / 16000))
  }

  function updateComparator(level, pos, be, tank) {
    const signal = comparatorValue(tank)
    if (!be.data.contains('comparator') || be.data.getInt('comparator') !== signal) {
      be.data.putInt('comparator', signal)
      be.save()
      level.updateNeighbourForOutputSignal(pos, be.getBlockState().getBlock())
    }
    const amount = tank.getFluidAmount()
    if (!be.data.contains('syncedAmount') || be.data.getInt('syncedAmount') !== amount) {
      be.data.putInt('syncedAmount', amount)
      be.sync()
    }
  }

  function fail(level, pos) {
    // Coordinates select the eight-argument Player overload. The BlockPos form
    // is ambiguous between Player and Entity when its first argument is null.
    level.playSound(null, pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5,
      SoundEvents.TRIAL_SPAWNER_DETECT_PLAYER, SoundSource.BLOCKS, 1, 1)
    level.sendParticles(ParticleTypes.ANGRY_VILLAGER,
      pos.getX() + 0.5, pos.getY() + 1.15, pos.getZ() + 0.5, 12, 0.35, 0.2, 0.35, 0)
  }

  function safePosition(level, pos, mob, npc) {
    const x = pos.getX() + 0.5
    const y = pos.getY()
    const z = pos.getZ() + 0.5
    if (mob.distanceToSqr(x, y, z) > 64) return false
    if (!level.isInWorldBounds(pos.below()) || !level.isInWorldBounds(pos.above())) return false
    if (!level.hasChunkAt(pos)) return false
    if (!level.getBlockState(pos).isAir() || !level.getBlockState(pos.above()).isAir()) return false
    const below = pos.below()
    const ground = level.getBlockState(below)
    if (!ground.isFaceSturdy(level, below, Direction.UP) || !ground.getFluidState().isEmpty()) return false
    if (dangerousGround.has(String(BuiltInRegistries.BLOCK.getKey(ground.getBlock())))) return false

    // KubeJS hides Entity.moveTo; this script-facing helper delegates to it.
    npc.setPositionAndRotation(x, y, z, 0, 0)
    const bounds = npc.getBoundingBox()
    // KubeJS can convert boxes to several position types, making the vanilla
    // isWithinBounds overloads ambiguous. Check the entire hitbox numerically.
    const border = level.getWorldBorder()
    if (bounds.minX < border.getMinX() || bounds.maxX > border.getMaxX()
      || bounds.minZ < border.getMinZ() || bounds.maxZ > border.getMaxZ()) return false
    // Do not make collision/fluid queries pull unloaded neighboring chunks into memory.
    for (let bx = Math.floor(bounds.minX); bx <= Math.floor(bounds.maxX); bx++) {
      for (let bz = Math.floor(bounds.minZ); bz <= Math.floor(bounds.maxZ); bz++) {
        if (!level.hasChunkAt(new BlockPos(bx, pos.getY(), bz))) return false
      }
    }
    if (!level.noCollision(npc, bounds) || !level.isUnobstructed(npc) || level.containsAnyLiquid(bounds)) return false
    return level.getEntitiesOfClass(LivingEntity, bounds, e => e.isAlive() && !e.isSpectator()).isEmpty()
  }

  function activate(level, pos, be, tank) {
    if (tank.getFluidAmount() < BUCKET) { fail(level, pos); return }
    const npcClass = NPCClasses.getByIdentifier(ResourceLocation.parse(NPC_ID))
    if (npcClass == null) {
      console.warn(`[lumisene_furnace] Missing NPC class ${NPC_ID}; load its datapack in this world.`)
      fail(level, pos)
      return
    }

    const cx = pos.getX() + 0.5
    const cy = pos.getY() + 0.5
    const cz = pos.getZ() + 0.5
    const found = level.getEntitiesOfClass(LivingEntity,
      new AABB(cx - 32, cy - 32, cz - 32, cx + 32, cy + 32, cz + 32),
      e => e instanceof Enemy && e.isAlive() && !e.isSpectator() && e.distanceToSqr(cx, cy, cz) <= 1024)
    const mobs = []
    for (let i = 0; i < found.size(); i++) mobs.push(found.get(i))
    mobs.sort((a, b) => a.distanceToSqr(cx, cy, cz) - b.distanceToSqr(cx, cy, cz))
    if (mobs.length === 0) { fail(level, pos); return }

    // Match Cobblemon's npcspawnat setup; initialize its AI/config/party as well.
    const npc = new NPCEntity(level)
    let spawnedAt = null
    try {
      npc.setNpc(npcClass)
      npc.initialize(1)
      for (let m = 0; m < mobs.length && spawnedAt == null; m++) {
        // Rhino 2101.2.7 can redeclare loop-body lexical bindings on iteration.
        // Function-scoped locals avoid that runtime error during the search.
        var mob = mobs[m]
        var origin = mob.blockPosition()
        for (let i = 0; i < offsets.length; i++) {
          var offset = offsets[i]
          var target = origin.offset(offset[0], offset[1], offset[2])
          if (!safePosition(level, target, mob, npc)) continue
          if (!level.addFreshEntity(npc)) { npc.discard(); fail(level, pos); return }
          spawnedAt = target
          break
        }
      }
    } catch (error) {
      npc.discard()
      console.error(`[lumisene_furnace] Spawn failed: ${String(error)}`)
      fail(level, pos)
      return
    }
    if (spawnedAt == null) { npc.discard(); fail(level, pos); return }
    // Fluid is charged only once addFreshEntity confirms success. Keep visual
    // notifications outside the spawn catch so effect errors cannot undo a paid spawn.
    tank['drain(int,net.neoforged.neoforge.fluids.capability.IFluidHandler$FluidAction)'](BUCKET, FluidAction.EXECUTE)
    updateComparator(level, pos, be, tank)
    level.levelEvent(3011, pos, 0)
    level.levelEvent(3012, spawnedAt, 0)
  }

  function checkSignal(level, pos) {
    if (level.isClientSide()) return
    const be = level.getBlockEntity(pos)
    if (be == null) return
    const tank = be.attachments.get('lumisene')
    if (tank == null) return
    const powered = level.hasNeighborSignal(pos)
    const wasPowered = be.data.getBoolean('powered')
    if (powered !== wasPowered) {
      // Latch before any comparator notifications can re-enter neighborChanged.
      be.data.putBoolean('powered', powered)
      be.save()
      if (powered) activate(level, pos, be, tank)
    }
  }

  // Keep ticking independent of the startup callback holder: /reload can repair
  // existing sessions immediately, even before the new startup script is loaded.
  if (global.lumiseneFurnaceHooks != null) {
    global.lumiseneFurnaceHooks.checkSignal = checkSignal
  }

  BlockEvents.blockEntityTick(BLOCK_ID, event => {
    const block = event.block
    const be = block.entity
    if (be == null || event.level.isClientSide()) return
    const tank = be.attachments.get('lumisene')
    if (tank == null) return
    checkSignal(event.level, block.pos)
    updateComparator(event.level, block.pos, be, tank)
  })
})()
