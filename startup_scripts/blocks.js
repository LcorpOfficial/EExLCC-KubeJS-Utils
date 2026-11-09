StartupEvents.registry('block', event => {
  // Bottom (the one you place / get as an item)
  event.create('pkmn_statue')
    .displayName('Pokémon Statue')
    .soundType('stone')
    .hardness(1.5)
    .resistance(6)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .tagBlock('lcc:statues')
    .notSolid()
    .transparent(true)
    .property(BlockProperties.HORIZONTAL_FACING)
    .defaultState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, Direction.NORTH))
    .placementState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, s.horizontalDirection.opposite))

  // Top (invisible helper block; no item)
  event.create('pkmn_statue_top')
    .displayName('Pokémon Statue (Top)')
    .noItem()
    .soundType('stone')
    .hardness(1.5)
    .resistance(6)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .tagBlock('lcc:statues')
    .notSolid()
    .transparent(true)
    .property(BlockProperties.HORIZONTAL_FACING)
    .defaultState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, Direction.NORTH))

  event.create('trophy_tournament')
    .displayName('Tournament Trophy')
    .soundType('metal')
    .hardness(1)
    .resistance(6)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .tagBoth('lcc:trophies')
    .blockEntity(info => info.enableSync())
    .notSolid()
    .transparent(true)
    .property(BlockProperties.HORIZONTAL_FACING)
    .defaultState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, Direction.NORTH))
    .placementState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, s.horizontalDirection.opposite))

  event.create('trophy_champion')
    .displayName('Champion Trophy')
    .soundType('metal')
    .hardness(1)
    .resistance(6)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .tagBoth('lcc:trophies')
    .blockEntity(info => info.enableSync())
    .notSolid()
    .transparent(true)
    .property(BlockProperties.HORIZONTAL_FACING)
    .defaultState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, Direction.NORTH))
    .placementState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, s.horizontalDirection.opposite))

  event.create('data_manipulator')
    .displayName('Data Manipulator')
    .soundType('metal')
    .hardness(2)
    .resistance(6)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .property(BlockProperties.HORIZONTAL_FACING)
    .defaultState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, Direction.NORTH))
    .placementState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, s.horizontalDirection.opposite))

  const pokeTables = [
    ['poke_table_poke_ball', 'Poké Table (Poké Ball)'],
    ['poke_table_great_ball', 'Poké Table (Great Ball)'],
    ['poke_table_ultra_ball', 'Poké Table (Ultra Ball)'],
    ['poke_table_master_ball', 'Poké Table (Master Ball)']
  ]

  pokeTables.forEach(([id, name]) => {
    event.create(id)
      .displayName(name)
      .soundType('metal')
      .hardness(2)
      .resistance(6)
      .requiresTool(true)
      .tagBlock('minecraft:mineable/pickaxe')
      .tagBlock('lcc:tables')
      .tagBoth('adorn:tables')
      .defaultTranslucent()
      .box(0, 0, 0, 16, 16, 16)
      .property(BlockProperties.HORIZONTAL_FACING)
      .defaultState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, Direction.NORTH))
      .placementState(s => s.setValue(BlockProperties.HORIZONTAL_FACING, s.horizontalDirection))
  })

  const denseApricornColors = [
    ['black', 'Black'],
    ['blue', 'Blue'],
    ['green', 'Green'],
    ['pink', 'Pink'],
    ['red', 'Red'],
    ['white', 'White'],
    ['yellow', 'Yellow']
  ]

  denseApricornColors.forEach(([color, name]) => {
    event.create(`${color}_apricorn_dense`)
      .displayName(`Dense ${name} Apricorn`)
      .soundType('wood')
      .hardness(2)
      .resistance(2)
      .tagBlock('minecraft:mineable/axe')
      .opaque(true)
      .fullBlock(true)
      .box(0, 0, 0, 16, 16, 16)
  })

  const unownGlyphs = 'abcdefghijklmnopqrstuvwxyz'.split('').concat(['blank'])
  const unownBlockTypes = [
    {
      id: 'sandstone',
      name: 'Sandstone',
      copyFrom: 'minecraft:chiseled_sandstone',
      hardness: 0.8,
      resistance: 0.8,
      endTexture: 'minecraft:block/sandstone_top',
      tags: [
        'minecraft:mineable/pickaxe',
        'cobblemon:desert_pyramid_blocks',
        'cobblemon:habitat_mimics',
        'cobblemon:ocean_ruin_blocks'
      ]
    },
    {
      id: 'red_sandstone',
      name: 'Red Sandstone',
      copyFrom: 'minecraft:chiseled_red_sandstone',
      hardness: 0.8,
      resistance: 0.8,
      endTexture: 'minecraft:block/red_sandstone_top',
      tags: [
        'minecraft:mineable/pickaxe',
        'cobblemon:habitat_mimics'
      ]
    },
    {
      id: 'end_stone',
      name: 'End Stone',
      copyFrom: 'minecraft:end_stone_bricks',
      hardness: 3,
      resistance: 9,
      endTexture: 'minecraft:block/end_stone_bricks',
      emissive: true,
      tags: [
        'minecraft:mineable/pickaxe',
        'cataclysm:ender_guardian_can_destroy',
        'cataclysm:endermaptera_can_not_spawn',
        'cobblemon:end_city_blocks',
        'cobblemon:habitat_mimics',
        'sable:end_stones'
      ]
    }
  ]

  unownBlockTypes.forEach(type => {
    unownGlyphs.forEach(glyph => {
      const glyphName = glyph === 'blank' ? 'Blank' : glyph.toUpperCase()
      const textureBase = `kubejs:block/unown/${type.id}/${glyph}`
      const block = event.create(`${glyph}_glyphed_${type.id}`)
        .displayName(`${glyphName}-Glyphed ${type.name}`)
        .copyPropertiesFrom(type.copyFrom)
        .hardness(type.hardness)
        .resistance(type.resistance)
        .parentModel(type.emissive
          ? 'kubejs:block/glyphed_end_stone_column'
          : 'minecraft:block/cube_column')
        .texture('side', textureBase)
        .texture('end', type.endTexture)
        .tagBlock('lcc:unown_blocks')

      if (type.emissive) {
        block
          .texture('emissive', `${textureBase}_emissive`)
          .renderType('cutout')
      }

      type.tags.forEach(tag => block.tagBlock(tag))
    })
  })
})
