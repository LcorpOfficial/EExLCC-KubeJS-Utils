// One catalogue drives item registration, recipes, and the ball stored in a gift.
// Keep IDs stable: saved filled gifts refer to these empty item IDs.
const $GiftBallAssetPaths = Java.loadClass('dev.latvian.mods.kubejs.KubeJSPaths')

global.lccGiftBallVariants = [
  'poke', 'slate', 'azure', 'verdant', 'roseate', 'citrine',
  'great', 'ultra', 'master', 'safari', 'fast', 'level', 'lure',
  'heavy', 'love', 'friend', 'moon', 'sport', 'net', 'dive',
  'nest', 'repeat', 'timer', 'luxury', 'premier', 'dusk', 'heal',
  'quick', 'cherish', 'park', 'dream', 'beast',
  'ancient_poke', 'ancient_citrine', 'ancient_verdant', 'ancient_azure',
  'ancient_roseate', 'ancient_slate', 'ancient_ivory', 'ancient_great',
  'ancient_ultra', 'ancient_feather', 'ancient_wing', 'ancient_jet',
  'ancient_heavy', 'ancient_leaden', 'ancient_gigaton', 'ancient_origin'
].map(prefix => ({
  item: `kubejs:${prefix}_gift_ball`,
  ball: `cobblemon:${prefix}_ball`,
  name: prefix.split('_').map(word =>
    word === 'poke' ? 'Poké' : word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ') + ' Gift Ball'
}))

global.lccGiftBallVariants.push({
  item: 'kubejs:myth_gift_ball',
  ball: 'faismythicalmonstrosities:myth_ball',
  name: 'Myth Gift Ball'
})

StartupEvents.registry('item', event => {
  global.lccGiftBallVariants.forEach(variant => {
    event.create(variant.item)
      .displayName(variant.name)
      .unstackable()
      .tag('lcc:gift_balls')
      .tooltip(Text.gray('Right-Click to store a Pokémon inside'))
      .tooltip(Text.gray('Right-Click with a Pokémon inside to obtain it.'))
      .modelGenerator(model => {
        // This callback runs again on client resource reload. Parent inheritance
        // supplies layer0 until the matching PNG is dropped into kubejs/assets.
        const texturePath = `kubejs/textures/item/gift_ball/${variant.item.split(':')[1]}.png`
        model.parent('kubejs:item/strange_gift_ball')
        if ($GiftBallAssetPaths.ASSETS.resolve(texturePath).toFile().isFile()) {
          model.texture('layer0', `kubejs:item/gift_ball/${variant.item.split(':')[1]}`)
        }
      })
  })
})
