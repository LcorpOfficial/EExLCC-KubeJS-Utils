

// don't crample my trops

BlockEvents.farmlandTrampled(event => {
  const e = event.entity
  if (!e) return
  if (!e.player) event.cancel()
})
