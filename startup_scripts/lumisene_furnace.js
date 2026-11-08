// MC 1.21.1 / KubeJS 2101.7: native, saved NeoForge fluid capability.
// JavaAdapter supplies comparator methods absent from the stock block builder.
// Server globals are a read-only map. Create this mutable callback holder at startup.
global.lumiseneFurnaceHooks = { checkSignal: null }

StartupEvents.registry('block', event => {
  const CardinalBuilder = Java.loadClass('dev.latvian.mods.kubejs.block.custom.CardinalBlockBuilder')
  const CardinalEntityBlock = Java.loadClass('dev.latvian.mods.kubejs.block.custom.CardinalBlockBuilder$WithEntity')
  const ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
  const Registries = Java.loadClass('net.minecraft.core.registries.Registries')
  const TagKey = Java.loadClass('net.minecraft.tags.TagKey')
  const FluidIngredient = Java.loadClass('net.neoforged.neoforge.fluids.crafting.FluidIngredient')

  const builder = new JavaAdapter(CardinalBuilder, {
    createObject: function () {
      return new JavaAdapter(CardinalEntityBlock, {
        hasAnalogOutputSignal: function (state) { return true },
        getAnalogOutputSignal: function (state, level, pos) {
          const be = level.getBlockEntity(pos)
          if (be == null) return 0
          const tank = be.attachments.get('lumisene')
          if (tank == null || tank.getFluidAmount() <= 0) return 0
          return Math.min(15, 1 + Math.floor(14 * tank.getFluidAmount() / 16000))
        },
        neighborChanged: function (state, level, pos, neighbor, neighborPos, moving) {
          if (!level.isClientSide() && typeof global.lumiseneFurnaceHooks.checkSignal === 'function') {
            // Vanilla neighbour updates do not have KubeJS's event error guard.
            // Log script failures here instead of letting them crash the server.
            try {
              global.lumiseneFurnaceHooks.checkSignal(level, pos)
            } catch (error) {
              console.error(`[lumisene_furnace] Redstone callback failed: ${String(error)}`)
            }
          }
        }
      }, builder)
    }
  }, ResourceLocation.parse('kubejs:lumisene_furnace'))

  builder
    .displayName('Lumisene Furnace')
    .soundType('stone')
    .hardness(3.5)
    .resistance(6)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .fullBlock(true)
    .opaque(true)
    .blockEntity(info => {
      // A tag defers the fluid lookup until registries/datapacks are ready.
      const fuel = TagKey.create(Registries.FLUID, ResourceLocation.parse('kubejs:lumisene_furnace_fuel'))
      // Empty directions means unrestricted in KubeJS: all faces AND null-side
      // capability queries (used by Jade to discover and display fluid storage).
      info.fluidTank('lumisene', Direction.EMPTY_SET, 16000, FluidIngredient.tag(fuel))
      info.rightClickFillsTank('lumisene')
      info.serverTicking()
      info.tickFrequency(1)
      info.enableSync()
    })

  // Register the adapted builder with normal item, loot and block-entity generation.
  event.add(Registries.BLOCK, builder)
  event.created.add(builder)
})
