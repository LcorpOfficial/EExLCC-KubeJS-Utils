// kubejs/startup_scripts/items.js

// badges

StartupEvents.registry('item', event => {
  event.create('badge_generic')
    .displayName('Badge')
    .unstackable()
    .rarity('rare')
    .fireResistant()
    .tag('lcc:badges')

  event.create('badge_normal').displayName('Normal Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_fighting').displayName('Fighting Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_flying').displayName('Flying Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_poison').displayName('Poison Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_ground').displayName('Ground Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_rock').displayName('Rock Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_bug').displayName('Bug Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_ghost').displayName('Ghost Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_steel').displayName('Steel Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_fire').displayName('Fire Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_water').displayName('Water Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_grass').displayName('Grass Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_electric').displayName('Electric Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_psychic').displayName('Psychic Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_ice').displayName('Ice Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_dragon').displayName('Dragon Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_dark').displayName('Dark Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')
  event.create('badge_fairy').displayName('Fairy Badge').unstackable().rarity('rare').fireResistant().tag('lcc:badges').parentModel('kubejs:item/badge_generic')

  event.create('badge_league')
    .displayName('League Badge')
    .unstackable()
    .rarity('epic')
    .fireResistant()
    .tag('lcc:badges')
    .parentModel('kubejs:item/badge_generic')

  for (let i = 1; i <= 16; i++) {
    event.create(`badge_special_${i}`)
      .displayName(`Special Badge ${i}`)
      .unstackable()
      .rarity('rare')
      .fireResistant()
      .tag('lcc:badges')
      .tag('lcc:special_badges')
      .parentModel('kubejs:item/badge_generic')
  }

  const tutorUiItems = [
    'alphabetical',
    'cancel',
    'category',
    'close',
    'confirm',
    'filler',
    'left',
    'right',
    'search',
    'type'
  ]

  tutorUiItems.forEach(name => {
    const displayName = name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    event.create(`tutor_ui_${name}`)
      .displayName(`Tutor UI ${displayName}`)
      .texture(`kubejs:item/tutor_ui/${name}`)
      .parentModel('kubejs:item/filler')
  })
})
