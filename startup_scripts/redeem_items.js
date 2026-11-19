// Gift-o-Tron currencies. Pool costs are configured on each machine.
StartupEvents.registry('item', function (event) {
  var items = [
    ['lure_ticket', 'Lure Ticket', 'epic', 'A mysterious ticket which appeared on your person'],
    ['spooky_ticket', 'Spooky Ticket', 'epic', 'a spooky-themed ticket which appeared on your person'],
    ['festive_ticket', 'Festive Ticket', 'epic', 'a festive-themed ticket which appeared on your person'],
    ['tricked_treat', 'Tricked Treat', 'rare', 'an unusual inedible candy gag gift'],
    ['holiday_cheer', 'Holiday Cheer', 'rare', 'a glistening ball of pure festive joy']
  ]

  items.forEach(function (item) {
    event.create(item[0])
      .displayName(item[1])
      .rarity(item[2])
      .texture('kubejs:item/redeem_items/' + item[0])
      .tag('lcc:redeem_items')
      .tooltip(Text.gray(item[3]))
      .tooltip(Text.gray('Can be redeemed at a Gift-o-Tron'))
  })
})
