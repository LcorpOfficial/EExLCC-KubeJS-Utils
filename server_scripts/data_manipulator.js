const DATA_MANIPULATOR = 'kubejs:data_manipulator'

function getPlayerName(player) {
  return String(player.username ?? player.name?.string ?? player.getName().string)
}

function isSneaking(player) {
  try {
    if (player.isShiftKeyDown()) return true
  } catch (e) {}

  try {
    if (player.isCrouching()) return true
  } catch (e) {}

  return !!player.crouching
}

BlockEvents.rightClicked(DATA_MANIPULATOR, event => {
  if (!event.player) return
  if (event.hand && String(event.hand).toLowerCase().includes('off')) return
  if (isSneaking(event.player)) return

  event.server.runCommandSilent(`tutormoves menu general ${getPlayerName(event.player)}`)
  event.cancel()
})
