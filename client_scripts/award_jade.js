// Jade is optional. Trophy block entities already sync the small award record,
// so this callback needs no extra server requests or Jade server-data provider.
;(() => {
  if (!Platform.isLoaded('jade')) return

  // Rhino can redeclare const bindings inside top-level conditionals. Keep all
  // bindings local to this invocation, including when Sync reloads the script.
  var AwardJadeRegistration = Java.loadClass('snownee.jade.impl.WailaClientRegistration')
  var AwardJadeCallback = Java.loadClass('snownee.jade.api.callback.JadeTooltipCollectedCallback')
  var AwardJadeBlockAccessor = Java.loadClass('snownee.jade.api.BlockAccessor')
  var AwardJadeRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')

  global.lccAwards.appendJade = (box, accessor) => {
    if (!(accessor instanceof AwardJadeBlockAccessor)) return
    var trophyId = String(AwardJadeRegistries.BLOCK.getKey(accessor.getBlock()))
    if (!global.lccAwards.trophies.some(id => String(id) === trophyId)) return
    var entity = accessor.getBlockEntity()
    if (entity == null) return
    var saved = entity.saveWithoutMetadata(accessor.getLevel().registryAccess())
    var record = saved.getCompound('data').getCompound(global.lccAwards.key)
    if (!record.contains('grantedBy', 8) || !record.contains('grantedTo', 8)) return

    var tooltip = box.getTooltip()
    tooltip.add(Text.gray('Earned by: ' + record.getString('grantedTo')))
    tooltip.add(Text.gray('Granted by: ' + record.getString('grantedBy')))
  }

  if (!global.lccAwards.jadeRegistered) {
    var registration = AwardJadeRegistration.instance()
    // Register directly in the active collection: Jade may otherwise queue this
    // in a registration session after the script has already sorted the list.
    registration.tooltipCollectedCallback.add(0, new JavaAdapter(AwardJadeCallback, {
      onTooltipCollected: function (box, accessor) {
        global.lccAwards.appendJade(box, accessor)
      }
    }))
    // Client scripts may load after Jade's own plugin-registration phase.
    registration.tooltipCollectedCallback.sort()
    global.lccAwards.jadeRegistered = true
  }
})()
