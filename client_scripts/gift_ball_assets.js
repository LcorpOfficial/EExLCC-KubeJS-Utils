const $GiftBallClientAssetPaths = Java.loadClass('dev.latvian.mods.kubejs.KubeJSPaths')

// KubeJS Sync merges icons into kubejs/assets during its runtime deployment.
// Generate models in the final asset stage so they supersede both registration
// defaults and static models, and are re-evaluated after a synced resource reload.
ClientEvents.generateAssets('last', event => {
  global.lccGiftBallVariants.forEach(variant => {
    var giftBallAssetName = variant.item.split(':')[1]
    var giftBallAssetModel = { parent: 'kubejs:item/strange_gift_ball' }
    // KubeJS can select resolve(Path) and convert this relative string into an
    // absolute GAMEDIR path, discarding ASSETS. Force the String overload.
    var giftBallAssetFile = $GiftBallClientAssetPaths.ASSETS['resolve(java.lang.String)'](
      `kubejs/textures/item/gift_ball/${giftBallAssetName}.png`
    ).toFile()

    if (giftBallAssetFile.isFile()) {
      giftBallAssetModel.textures = {
        layer0: `kubejs:item/gift_ball/${giftBallAssetName}`
      }
    }

    event.json(`kubejs:models/item/${giftBallAssetName}.json`, giftBallAssetModel)
  })
})
