// MC 1.21.1 / KubeJS 2101.7.2. Configure names/textures/tooltips here. These
// definitions sync with startup scripts; clients need no server config file.
// Pool references and odds live in config/poke_lures.json and support /reload.
;(function () {
  var catalog = [
    {
      id: 'kubejs:poke_lure', name: 'Poké Lure', texture: 'kubejs:item/poke_lures/poke_lure',
      tooltip: ['Throw to attract a random Pokémon where it lands.']
    },
    {
      id: 'kubejs:spooky_poke_lure', name: 'Spooky Poké Lure', texture: 'kubejs:item/poke_lures/spooky_lure',
      tooltip: ['Throw to attract a spooky Pokémon where it lands.']
    },
    {
      id: 'kubejs:festive_poke_lure', name: 'Festive Poké Lure', texture: 'kubejs:item/poke_lures/festive_lure',
      tooltip: ['Throw to attract a festive Pokémon where it lands.']
    }
  ]
  // Server globals are read-only; a holder created at startup can be mutated.
  global.lccPokeLures = { items: catalog }

  StartupEvents.registry('item', function (event) {
    catalog.forEach(function (definition) {
      var item = event.create(definition.id)
        .displayName(definition.name)
        .texture(definition.texture)
        .rarity('epic')
        .tag('lcc:poke_lures')
      ;(definition.tooltip || []).forEach(function (line) { item.tooltip(Text.gray(line)) })
    })
  })
})()
