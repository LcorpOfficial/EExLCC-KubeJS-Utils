// Add future stickers here and supply their effect in server_scripts/stickers.js.
global.lccStickerVariants = [
  { item: 'kubejs:sticker_alpha', name: 'Alpha Sticker', effect: 'alpha', adjective: 'Alpha' },
  { item: 'kubejs:sticker_shiny', name: 'Shiny Sticker', effect: 'shiny', adjective: 'Shiny' }
]

StartupEvents.registry('item', event => {
  global.lccStickerVariants.forEach(variant => {
    event.create(variant.item)
      .displayName(variant.name)
      .rarity('epic')
      .tag('lcc:stickers')
      .texture('kubejs:item/stickers/' + variant.item.split(':')[1])
      .tooltip(Text.gray('A sticker to apply to a Pokémon which changes them to be ' + variant.adjective))
  })
})
