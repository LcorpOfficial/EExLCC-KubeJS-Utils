// Mutable hooks survive server/client script reloads without duplicate Jade callbacks.
global.lccAwards = {
  key: 'lccAward',
  trophies: ['kubejs:trophy_tournament', 'kubejs:trophy_champion'],
  stamp: null,
  appendJade: null,
  jadeRegistered: false
}
