// Jade is optional. Trophy block entities already sync the small award record,
// so this callback needs no extra server requests or Jade server-data provider.
;(() => {
  if (!Platform.isLoaded('jade')) return

  // Rhino can redeclare const bindings inside top-level conditionals. Keep all
  // bindings local to this invocation, including when Sync reloads the script.
  var AwardJadeRegistration = Java.loadClass('snownee.jade.impl.WailaClientRegistration')
  var AwardJadeCallback = Java.loadClass('snownee.jade.api.callback.JadeTooltipCollectedCallback')
  var AwardJadeBlockAccessor = Java.loadClass('snownee.jade.api.BlockAccessor')
  var AwardJadeBlockEntity = Java.loadClass('dev.latvian.mods.kubejs.block.entity.KubeBlockEntity')

  global.lccAwards.appendJade = (box, accessor) => {
    if (!(accessor instanceof AwardJadeBlockAccessor)) return
    var entity = accessor.getBlockEntity()
    if (!(entity instanceof AwardJadeBlockEntity) ||
        !global.lccAwards.trophies.includes(String(entity.getBlock().id))) return
    var record = entity.data.getCompound(global.lccAwards.key)
    if (!record.contains('grantedBy', 8) || !record.contains('grantedTo', 8)) return

    var tooltip = box.getTooltip()
    tooltip.add(Text.gray('Earned by: ' + record.getString('grantedTo')))
    tooltip.add(Text.gray('Granted by: ' + record.getString('grantedBy')))
  }

  if (!global.lccAwards.jadeRegistered) {
    var registration = AwardJadeRegistration.instance()
    registration.addTooltipCollectedCallback(0, new JavaAdapter(AwardJadeCallback, {
      onTooltipCollected: function (box, accessor) {
        global.lccAwards.appendJade(box, accessor)
      }
    }))
    // Client scripts may load after Jade's own plugin-registration phase.
    registration.tooltipCollectedCallback.sort()
    global.lccAwards.jadeRegistered = true
  }
})()
