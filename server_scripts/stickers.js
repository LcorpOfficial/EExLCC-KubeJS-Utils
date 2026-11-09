const $StickerCobblemon = Java.loadClass('com.cobblemon.mod.common.Cobblemon')
const $StickerPartySelectCallbacks = Java.loadClass('com.cobblemon.mod.common.api.callback.PartySelectCallbacks')
const $StickerPlayerExtensions = Java.loadClass('com.cobblemon.mod.common.util.PlayerExtensionsKt')
const $StickerMarks = Java.loadClass('com.cobblemon.mod.common.api.mark.Marks')
const $StickerResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
const $StickerDataComponents = Java.loadClass('net.minecraft.core.component.DataComponents')
const $StickerCustomData = Java.loadClass('net.minecraft.world.item.component.CustomData')
const $StickerCompoundTag = Java.loadClass('net.minecraft.nbt.CompoundTag')
const $StickerComponent = Java.loadClass('net.minecraft.network.chat.Component')
const $StickerArrayList = Java.loadClass('java.util.ArrayList')
const $StickerHashSet = Java.loadClass('java.util.HashSet')
const $StickerUUID = Java.loadClass('java.util.UUID')

const STICKER_SESSION_KEY = 'lccStickerSession'

function stickerReadData(stack) {
  const data = stack.get($StickerDataComponents.CUSTOM_DATA)
  return data == null ? new $StickerCompoundTag() : data.copyTag()
}

function stickerWriteData(stack, tag) {
  if (tag.isEmpty()) stack.remove($StickerDataComponents.CUSTOM_DATA)
  else stack.set($StickerDataComponents.CUSTOM_DATA, $StickerCustomData.of(tag))
}

function stickerFindStack(player, sessionId, variant) {
  const inventory = player.getInventory()
  for (let slot = 0; slot < inventory.getContainerSize(); slot++) {
    const stack = inventory.getItem(slot)
    if (stack.isEmpty() || String(stack.id) !== variant.item) continue
    const data = stickerReadData(stack)
    if (!data.contains(STICKER_SESSION_KEY, 8)) continue
    if (String(data.getString(STICKER_SESSION_KEY)) === sessionId) return stack
  }
  return null
}

function stickerClearSession(player, sessionId, variant) {
  const stack = stickerFindStack(player, sessionId, variant)
  if (stack == null) return
  const data = stickerReadData(stack)
  data.remove(STICKER_SESSION_KEY)
  stickerWriteData(stack, data)
  player.getInventory().setChanged()
}

function stickerAlreadyApplied(pokemon, variant) {
  if (variant.effect === 'alpha') return pokemon.isAlpha()
  if (variant.effect === 'shiny') return pokemon.getShiny()
  throw new Error('Unknown sticker effect: ' + variant.effect)
}

function stickerApplyEffect(pokemon, variant) {
  if (variant.effect === 'alpha') {
    // Inspected Cobblemon 1.8.4: PokemonProperties.apply (used by /pokeedit)
    // calls setAlpha. It grants AND activates cobblemon:mark_alpha and updates
    // aspects, including alpha and the active mark's alpha_eyes. Do not force
    // alpha_eyes: the player must remain able to toggle it via their mark.
    if ($StickerMarks.getByIdentifier($StickerResourceLocation.parse('cobblemon:mark_alpha')) == null) {
      throw new Error('The Alpha Mark is unavailable.')
    }
    pokemon.setAlpha(true)
  } else if (variant.effect === 'shiny') {
    pokemon.setShiny(true)
  } else {
    throw new Error('Unknown sticker effect: ' + variant.effect)
  }
}

function stickerApplySelected(player, sessionId, variant, selected) {
  const stack = stickerFindStack(player, sessionId, variant)
  if (stack == null) {
    player.tell(Text.red('The sticker must remain in your inventory while choosing a Pokémon.'))
    return
  }

  // Clear before applying, so this callback can only spend its stack once.
  stickerClearSession(player, sessionId, variant)
  if ($StickerPlayerExtensions.getBattleState(player) != null) {
    player.tell(Text.red('Stickers cannot be used during battle.'))
    return
  }

  // Resolve by UUID again: slots may have moved since the party UI opened.
  const pokemon = $StickerCobblemon.INSTANCE.getStorage().getParty(player).get(selected.getUuid())
  if (pokemon == null || String(pokemon.getOwnerUUID()) !== String(player.getUUID())) {
    player.tell(Text.red('That Pokémon is no longer in your party.'))
    return
  }
  if (stickerAlreadyApplied(pokemon, variant)) {
    player.tell(Text.red('That Pokémon is already ' + variant.adjective + '.'))
    return
  }

  // Keep the same Pokemon object and store coordinates. These native setters
  // synchronize changes and preserve unrelated stats, moves, aspects and marks.
  const before = {
    alpha: pokemon.isAlpha(), shiny: pokemon.getShiny(),
    scale: pokemon.getScaleModifier(), marks: new $StickerHashSet(pokemon.getMarks()),
    activeMark: pokemon.getActiveMark()
  }
  try {
    stickerApplyEffect(pokemon, variant)
  } catch (error) {
    try {
      pokemon.setAlpha(before.alpha)
      pokemon.setShiny(before.shiny)
      pokemon.setScaleModifier(before.scale)
      pokemon.setMarks(before.marks)
      pokemon.setActiveMark(before.activeMark)
    } catch (rollbackError) {
      console.error('[stickers] Failed to restore Pokémon after an error: ' + String(rollbackError))
    }
    console.error('[stickers] Failed to apply ' + variant.name + ': ' + String(error))
    player.tell(Text.red('The sticker could not be applied. It was not consumed; please contact staff.'))
    return
  }

  stack.shrink(1)
  player.getInventory().setChanged()
  player.tell(Text.green(pokemon.getDisplayName(false).getString() + ' is now ' + variant.adjective + '!'))
}

function stickerOpenParty(player, stack, variant) {
  const party = $StickerCobblemon.INSTANCE.getStorage().getParty(player)
  const pokemon = new $StickerArrayList()
  const iterator = party.iterator()
  let eligible = false
  while (iterator.hasNext()) {
    const member = iterator.next()
    pokemon.add(member)
    if (!stickerAlreadyApplied(member, variant)) eligible = true
  }
  if (pokemon.isEmpty()) {
    player.tell(Text.red('There are no Pokémon in your party to apply a sticker to.'))
    return
  }
  if (!eligible) {
    player.tell(Text.red('Every Pokémon in your party is already ' + variant.adjective + '.'))
    return
  }

  const sessionId = String($StickerUUID.randomUUID())
  const data = stickerReadData(stack)
  data.putString(STICKER_SESSION_KEY, sessionId)
  stickerWriteData(stack, data)
  player.getInventory().setChanged()
  try {
    // The same native party picker used by Gift Balls; ineligible entries are disabled.
    $StickerPartySelectCallbacks.INSTANCE.createFromPokemon(
      player,
      $StickerComponent.literal('Apply ' + variant.name + ' to which Pokémon?'),
      pokemon,
      selected => !stickerAlreadyApplied(selected, variant),
      cancelledBy => stickerClearSession(cancelledBy, sessionId, variant),
      selected => stickerApplySelected(player, sessionId, variant, selected)
    )
  } catch (error) {
    stickerClearSession(player, sessionId, variant)
    console.error('[stickers] Failed to open party selection: ' + String(error))
    player.tell(Text.red('The party selection could not be opened. Please contact staff.'))
  }
}

global.lccStickerVariants.forEach(variant => {
  ItemEvents.rightClicked(variant.item, event => {
    if (event.player == null || event.item == null) return
    if ($StickerPlayerExtensions.getBattleState(event.player) != null) {
      event.player.tell(Text.red('Stickers cannot be used during battle.'))
      event.cancel()
      return
    }
    stickerOpenParty(event.player, event.item, variant)
    event.cancel()
  })
})
