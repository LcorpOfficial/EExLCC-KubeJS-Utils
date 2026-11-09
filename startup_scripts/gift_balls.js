// One catalogue drives item registration, recipes, and the ball stored in a gift.
// Keep IDs stable: saved filled gifts refer to these empty item IDs.
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
        // Safe registration default. Synced static models and the client asset
        // reload handler supply the individual icons after assets are deployed.
        model.parent('kubejs:item/strange_gift_ball')
      })
  })
})
