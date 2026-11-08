ServerEvents.recipes(event => {
  event.stonecutting(
    'kubejs:pkmn_statue',        // output
    'minecraft:polished_andesite' // input
  )

  event.shaped('kubejs:lumisene_furnace', [
    'DBD',
    'BNB',
    'DTD'
  ], {
    D: 'minecraft:polished_deepslate',
    B: 'dndecor:netherite_dot_bolt',
    N: 'minecraft:nether_star',
    T: 'create:fluid_tank'
  }).id('kubejs:lumisene_furnace')

  const pokeTables = [
    ['poke_table_poke_ball', 'poke_ball'],
    ['poke_table_great_ball', 'great_ball'],
    ['poke_table_ultra_ball', 'ultra_ball'],
    ['poke_table_master_ball', 'master_ball']
  ]

  pokeTables.forEach(([table, ball]) => {
    event.shaped(`kubejs:${table}`, [
      'B',
      'S',
      'L'
    ], {
      B: `cobblemon:${ball}`,
      S: 'create:shaft',
      L: 'minecraft:smooth_stone_slab'
    })
  })

  const denseApricornColors = ['black', 'blue', 'green', 'pink', 'red', 'white', 'yellow']

  denseApricornColors.forEach(color => {
    const apricorn = `cobblemon:${color}_apricorn`
    const denseApricorn = `kubejs:${color}_apricorn_dense`

    event.shaped(denseApricorn, [
      'AAA',
      'AAA',
      'AAA'
    ], {
      A: apricorn
    })

    event.shapeless(Item.of(apricorn, 9), [denseApricorn])
  })

  const unownGlyphs = 'abcdefghijklmnopqrstuvwxyz'.split('').concat(['blank'])
  const unownBlockTypes = [
    { id: 'sandstone', input: 'minecraft:sandstone' },
    { id: 'red_sandstone', input: 'minecraft:red_sandstone' },
    { id: 'end_stone', input: 'minecraft:end_stone' }
  ]

  unownBlockTypes.forEach(type => {
    unownGlyphs.forEach(glyph => {
      event.stonecutting(`kubejs:${glyph}_glyphed_${type.id}`, type.input)
    })
  })
})
