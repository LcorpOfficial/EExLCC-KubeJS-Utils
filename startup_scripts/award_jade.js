// Jade freezes its provider registries at FML load-complete. Register during
// startup init, on BOTH client and server, so its normal block data request and
// tooltip pipeline know the same provider ID before that freeze.
StartupEvents.init(() => {
  if (!Platform.isLoaded('jade')) return

  // Function-scoped locals avoid this Rhino build's conditional const bug.
  var AwardResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
  var AwardRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
  var AwardBlock = Java.loadClass('net.minecraft.world.level.block.Block')
  var AwardCommonRegistration = Java.loadClass('snownee.jade.impl.WailaCommonRegistration')
  var AwardServerProvider = Java.loadClass('snownee.jade.api.IServerDataProvider')
  var providerId = AwardResourceLocation.parse('kubejs:lcc_award')
  var awardKey = String(global.lccAwards.key)

  function isTrophy(accessor) {
    var blockId = String(AwardRegistries.BLOCK.getKey(accessor.getBlock()))
    return global.lccAwards.trophies.some(id => String(id) === blockId)
  }

  function validRecord(record) {
    return record.contains('grantedBy', 8) && record.contains('grantedTo', 8)
  }

  AwardCommonRegistration.instance().registerBlockDataProvider(new JavaAdapter(AwardServerProvider, {
    getUid: function () { return providerId },
    shouldRequestData: function (accessor) { return isTrophy(accessor) },
    appendServerData: function (serverData, accessor) {
      if (!isTrophy(accessor)) return
      var entity = accessor.getBlockEntity()
      if (entity == null) return
      var saved = entity.saveWithoutMetadata(accessor.getLevel().registryAccess())
      var record = saved.getCompound('data').getCompound(awardKey)
      if (!validRecord(record)) {
        record = saved.getCompound('components').getCompound('minecraft:custom_data')
          .getCompound(awardKey)
      }
      if (validRecord(record)) serverData.put(awardKey, record.copy())
    }
  }), AwardBlock)

  // Never load client-only registration classes on a dedicated server.
  if (!Platform.isClientEnvironment()) return
  var AwardClientRegistration = Java.loadClass('snownee.jade.impl.WailaClientRegistration')
  var AwardBlockProvider = Java.loadClass('snownee.jade.api.IBlockComponentProvider')

  AwardClientRegistration.instance().registerBlockComponent(new JavaAdapter(AwardBlockProvider, {
    getUid: function () { return providerId },
    enabledByDefault: function () { return true },
    appendTooltip: function (tooltip, accessor, config) {
      if (!isTrophy(accessor)) return
      // The client block entity can be missing or lack synced custom NBT. Jade
      // supplies the authoritative record fetched by appendServerData instead.
      var record = accessor.getServerData().getCompound(awardKey)
      if (!validRecord(record)) return
      // Rhino also considers add(List) for Component arguments. Select the
      // Component overload explicitly so Jade receives two text lines.
      tooltip['add(net.minecraft.network.chat.Component)'](
        Text.gray('Earned by: ' + record.getString('grantedTo'))
      )
      tooltip['add(net.minecraft.network.chat.Component)'](
        Text.gray('Granted by: ' + record.getString('grantedBy'))
      )
    }
  }), AwardBlock)
})
