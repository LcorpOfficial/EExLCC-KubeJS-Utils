// A private, unspawned ItemEntity is rendered by vanilla's item entity renderer.
// It never joins a level, has no pickup/collision, and consumes no entity packets.
;(function () {
  // This ClientEvents event is STARTUP-only in KubeJS 2101.7.2. Guard before
  // loading any client classes so dedicated servers can load this file too.
  if (!Platform.isClientEnvironment()) return
  // Model pixels are 1/16 block. Lower the glass display by 1.5 pixels while
  // keeping the final ejection position in the lower block unchanged.
  var DISPLAY_Y = 1.40 - 1.5 / 16
  var EJECT_Y = 0.30
  var Registries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
  var Location = Java.loadClass('net.minecraft.resources.ResourceLocation')
  var Renderer = Java.loadClass('net.minecraft.client.renderer.blockentity.BlockEntityRenderer')
  var Minecraft = Java.loadClass('net.minecraft.client.Minecraft')
  var ItemEntity = Java.loadClass('net.minecraft.world.entity.item.ItemEntity')
  var EntityType = Java.loadClass('net.minecraft.world.entity.EntityType')
  var Stack = Java.loadClass('net.minecraft.world.item.ItemStack')
  var Axis = Java.loadClass('com.mojang.math.Axis')
  var Mth = Java.loadClass('net.minecraft.util.Mth')
  var WeakHashMap = Java.loadClass('java.util.WeakHashMap')
  var cache = new WeakHashMap()

  function read(level, tag) { return Stack.parseOptional(level.registryAccess(), tag) }
  function display(be, partial) {
    var level = be.getLevel()
    var state = be.data.getCompound('lccGiftOMatic')
    // LevelMixin remaps getGameTime to getTime for scripts.
    var time = Number(level.getTime()) + Number(partial)
    var index = 0
    var list
    var pool
    var cost
    var player
    var elapsed
    if (state.contains('active', 10)) {
      var active = state.getCompound('active')
      if (active.getBoolean('delivered')) {
        // Return the idle display from the already-synced timestamp. The
        // server keeps the transaction locked briefly AFTER this return,
        // rather than sharing a packet for both reappearance and unlocking.
        if (time < Number(active.getLong('resetAt'))) return null
      } else {
        elapsed = Math.max(0, time - active.getLong('started'))
        if (elapsed < 40) {
          list = active.getList('previews', 10)
          if (list.isEmpty()) return null
          index = Math.floor(elapsed / 2) % list.size()
          return { stack: read(level, list.getCompound(index)), y: DISPLAY_Y }
        }
        return {
          stack: read(level, active.getCompound('prize')),
          y: DISPLAY_Y + (EJECT_Y - DISPLAY_Y) * Math.max(0, Math.min(1, (elapsed - 48) / 12))
        }
      }
    }
    list = state.getList('pools', 10)
    if (list.isEmpty()) return null
    player = Minecraft.getInstance().player
    if (player != null) {
      // Preview locally for this viewer. Main hand wins if both hands match.
      var held = [player.getMainHandItem(), player.getOffhandItem()]
      for (var hand = 0; hand < held.length; hand++) {
        for (var p = 0; p < list.size(); p++) {
          pool = list.getCompound(p)
          cost = read(level, pool.getCompound('cost'))
          if (!held[hand].isEmpty() && Stack.isSameItemSameComponents(held[hand], cost)) {
            var entries = pool.getList('rewards', 10)
            if (entries.isEmpty()) return null
            index = Math.floor(time / 20) % entries.size()
            return { stack: read(level, entries.getCompound(index)), y: DISPLAY_Y }
          }
        }
      }
    }
    index = Math.floor(time / 20) % list.size()
    return { stack: read(level, list.getCompound(index).getCompound('cost')), y: DISPLAY_Y }
  }

  ClientEvents.blockEntityRendererRegistry(function (event) {
    var type = Registries.BLOCK_ENTITY_TYPE.get(Location.parse('kubejs:gift_o_matic'))
    event.register(type, function (context) {
      var renderFailed = false
      function draw(be, partial, pose, buffers, light) {
        var shown = display(be, partial)
        if (shown == null || shown.stack.isEmpty()) return
        var fake = cache.get(be)
        if (fake == null) {
          fake = new ItemEntity(EntityType.ITEM, be.getLevel())
          cache.put(be, fake)
        }
        // One item visual even when the configured reward is a full stack.
        fake.setItem(shown.stack.copyWithCount(1))
        pose.pushPose()
        try {
          // Vanilla adds sin(age / 10 + bobOffs) * 0.1 + 0.1 to item Y.
          // bobOffs is random even on an entity that never ticks. Cancel its
          // varying part, preserving the fixed lift used to center the model.
          // Use vanilla's sine lookup so the correction matches its renderer.
          var bob = Number(Mth.sin(Number(fake.getAge()) / 10 + Number(fake.bobOffs))) * 0.1
          pose.translate(0.5, shown.y - bob, 0.5)
          pose.mulPose(Axis.YP.rotationDegrees(((Number(be.getLevel().getTime()) + Number(partial)) * 3) % 360))
          // Draw only the item renderer, without world shadows/debug hitboxes
          // that assume the entity has actually been spawned at a world pos.
          Minecraft.getInstance().getEntityRenderDispatcher().getRenderer(fake)
            // The unspawned entity has no age. Keep its own partial tick at
            // zero; the pose above supplies continuous world-time rotation.
            .render(fake, 0, 0, pose, buffers, light)
        } finally {
          pose.popPose()
        }
      }
      return new JavaAdapter(Renderer, {
        render: function (be, partial, pose, buffers, light, overlay) {
          if (renderFailed) return
          try {
            draw(be, partial, pose, buffers, light)
          } catch (error) {
            // Unlike KubeJS event listeners, JavaAdapter render calls have no
            // script error guard. Fail the display once, not the entire world.
            renderFailed = true
            console.error('[gift_o_matic] Item display disabled after renderer error: ' + String(error))
          }
        },
        // The base can be outside the camera while the upper glass is visible.
        shouldRenderOffScreen: function (be) { return true },
        getViewDistance: function () { return 48 }
      })
    })
  })
})()
