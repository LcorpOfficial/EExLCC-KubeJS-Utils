// The grant implementation is refreshed by server script reloads.
global.lccAwards = {
  key: 'lccAward',
  trophies: ['kubejs:trophy_tournament', 'kubejs:trophy_champion'],
  stamp: null,
  // Sync removes retired client scripts during its later runtime phase. Prevent
  // an old award_jade.js copy from installing its callback before that removal.
  jadeRegistered: true
}
