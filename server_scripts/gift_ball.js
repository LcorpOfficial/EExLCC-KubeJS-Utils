// Empty Gift Balls have their own kubejs:*_gift_ball IDs. Legacy componentless
// cobblemon:pokemon_model stacks still work as generic Gift Balls.
//
// Once filled, the complete Pokemon is stored as NBT in minecraft:custom_data
// alongside the gift variety, while Cobblemon's own
// pokemon_item component supplies the species/aspects used by its item renderer.

const $GiftBallCobblemon = Java.loadClass('com.cobblemon.mod.common.Cobblemon')
const $GiftBallItemComponents = Java.loadClass('com.cobblemon.mod.common.CobblemonItemComponents')
const $GiftBallPokemonItem = Java.loadClass('com.cobblemon.mod.common.item.PokemonItem')
const $GiftBallPokemon = Java.loadClass('com.cobblemon.mod.common.pokemon.Pokemon')
const $GiftBallStats = Java.loadClass('com.cobblemon.mod.common.api.pokemon.stats.Stats')
const $GiftBallPartySelectCallbacks = Java.loadClass(
  'com.cobblemon.mod.common.api.callback.PartySelectCallbacks'
)
const $GiftBallPlayerExtensions = Java.loadClass('com.cobblemon.mod.common.util.PlayerExtensionsKt')
const $GiftBallDataComponents = Java.loadClass('net.minecraft.core.component.DataComponents')
const $GiftBallCustomData = Java.loadClass('net.minecraft.world.item.component.CustomData')
const $GiftBallCustomModelData = Java.loadClass('net.minecraft.world.item.component.CustomModelData')
const $GiftBallItemLore = Java.loadClass('net.minecraft.world.item.component.ItemLore')
const $GiftBallCompoundTag = Java.loadClass('net.minecraft.nbt.CompoundTag')
const $GiftBallComponent = Java.loadClass('net.minecraft.network.chat.Component')
const $GiftBallStyle = Java.loadClass('net.minecraft.network.chat.Style')
const $GiftBallSimpleColor = Java.loadClass('dev.latvian.mods.kubejs.color.SimpleColor')
const $GiftBallArrayList = Java.loadClass('java.util.ArrayList')
const $GiftBallUUID = Java.loadClass('java.util.UUID')
const $GiftBallBuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
const $GiftBallResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')

const GIFT_BALL_DATA_KEY = 'lccGiftBall'
const GIFT_BALL_POKEMON_KEY = 'pokemon'
const GIFT_BALL_VERSION_KEY = 'version'
const GIFT_BALL_VARIANT_KEY = 'giftBall'
const GIFT_BALL_SESSION_KEY = 'lccGiftBallSession'
const GIFT_BALL_MODEL_DATA = 1
const GIFT_BALL_PRESENTATION_VERSION = 3
const GIFT_BALL_COLOR_GRAY = 0xAAAAAA
const GIFT_BALL_COLOR_NAME = 0xFF55FF
const GIFT_BALL_COLOR_ASPECT = 0x55FFFF
const GIFT_BALL_COLOR_GOOD = 0x55FF55

function giftBallVariantForItem(itemId) {
  return global.lccGiftBallVariants.find(variant => variant.item === String(itemId)) || null
}

function giftBallVariant(stack) {
  const data = giftBallReadCustomData(stack).getCompound(GIFT_BALL_DATA_KEY)
  if (!data.contains(GIFT_BALL_VARIANT_KEY, 8)) return giftBallVariantForItem(stack.id)

  const itemId = String(data.getString(GIFT_BALL_VARIANT_KEY))
  const variant = giftBallVariantForItem(itemId)
  if (variant == null) throw new Error('Unknown Gift Ball variety: ' + itemId)
  return variant
}

function giftBallCaughtBall(variant) {
  // Resolve through the actual item, including Fai's custom PokeBallItem.
  // Missing/removed ball mods must leave the gift intact rather than silently
  // releasing its Pokemon with a different ball.
  if (!Item.exists(variant.ball)) throw new Error('Missing Poké Ball item: ' + variant.ball)
  const ballItem = $GiftBallBuiltInRegistries.ITEM.get($GiftBallResourceLocation.parse(variant.ball))
  return ballItem.getPokeBall()
}

function giftBallPlainText(value) {
  return $GiftBallComponent.literal(value).setStyle($GiftBallStyle.EMPTY.withItalic(false))
}

function giftBallGrayText(value) {
  const line = Text.gray(value)
  return line.setStyle(line.getStyle().withItalic(false))
}

function giftBallColorComponent(component, rgb) {
  var giftBallColoredComponent = component.copy()
  // ComponentKJS has a single, strongly typed color method. Calling it directly
  // avoids Rhino's ambiguous resolution of Style.withColor's three overloads.
  giftBallColoredComponent.color(new $GiftBallSimpleColor(rgb & 0xFFFFFF))
  giftBallColoredComponent.italic(false)
  return giftBallColoredComponent
}

function giftBallColoredLiteral(value, rgb) {
  return giftBallColorComponent($GiftBallComponent.literal(String(value)), rgb)
}

function giftBallLorePairComponent(label, component, rgb) {
  var giftBallPairLine = giftBallGrayText(label)
  giftBallPairLine.append(giftBallColorComponent(component, rgb))
  return giftBallPairLine
}

function giftBallPrettyId(value) {
  var giftBallPrettyWords = String(value).replace(/[_-]+/g, ' ').split(' ')
  var giftBallPrettyIndex
  var giftBallPrettyWord

  for (giftBallPrettyIndex = 0; giftBallPrettyIndex < giftBallPrettyWords.length; giftBallPrettyIndex++) {
    giftBallPrettyWord = giftBallPrettyWords[giftBallPrettyIndex]
    if (giftBallPrettyWord.length > 0) {
      giftBallPrettyWords[giftBallPrettyIndex] =
        giftBallPrettyWord.substring(0, 1).toUpperCase() + giftBallPrettyWord.substring(1)
    }
  }

  return giftBallPrettyWords.join(' ')
}

function giftBallStatLine(label, stats, perfectValue) {
  var giftBallStatLineComponent = giftBallGrayText(label)
  var giftBallStatValues = [
    stats.getOrDefault($GiftBallStats.HP),
    stats.getOrDefault($GiftBallStats.ATTACK),
    stats.getOrDefault($GiftBallStats.DEFENCE),
    stats.getOrDefault($GiftBallStats.SPECIAL_ATTACK),
    stats.getOrDefault($GiftBallStats.SPECIAL_DEFENCE),
    stats.getOrDefault($GiftBallStats.SPEED)
  ]
  var giftBallStatIndex
  var giftBallStatValue

  for (giftBallStatIndex = 0; giftBallStatIndex < giftBallStatValues.length; giftBallStatIndex++) {
    if (giftBallStatIndex > 0) giftBallStatLineComponent.append(giftBallGrayText('/'))
    giftBallStatValue = Number(giftBallStatValues[giftBallStatIndex])
    giftBallStatLineComponent.append(giftBallColoredLiteral(
      giftBallStatValue,
      giftBallStatValue === perfectValue ? GIFT_BALL_COLOR_GOOD : GIFT_BALL_COLOR_GRAY
    ))
  }

  return giftBallStatLineComponent
}

function giftBallTypeLine(pokemon) {
  var giftBallPrimaryType = pokemon.getPrimaryType()
  var giftBallSecondaryType = pokemon.getSecondaryType()
  var giftBallTypeComponent = giftBallColorComponent(
    giftBallPrimaryType.getDisplayName(),
    giftBallPrimaryType.getPrimaryColor()
  )

  if (giftBallSecondaryType != null && giftBallSecondaryType !== giftBallPrimaryType) {
    giftBallTypeComponent.append(giftBallGrayText(' / '))
    giftBallTypeComponent.append(giftBallColorComponent(
      giftBallSecondaryType.getDisplayName(),
      giftBallSecondaryType.getPrimaryColor()
    ))
  }

  return giftBallTypeComponent
}

function giftBallTitleDetails(pokemon) {
  var giftBallAspectIterator = pokemon.getAspects().iterator()
  var giftBallTitleAspects = []
  var giftBallSeenAspects = {}
  var giftBallAspect
  var giftBallAspectLower
  var giftBallGender = String(pokemon.getGender().getSerializedName()).toLowerCase()
  var giftBallForm = pokemon.getForm() == null ? '' : String(pokemon.getForm().getName())
  var giftBallFormLower = giftBallForm.toLowerCase()

  if (giftBallForm.length > 0 && giftBallFormLower !== 'normal' &&
      giftBallFormLower !== 'standard' && giftBallFormLower !== giftBallGender) {
    giftBallTitleAspects.push(giftBallPrettyId(giftBallForm))
    giftBallSeenAspects[giftBallFormLower] = true
  }

  while (giftBallAspectIterator.hasNext()) {
    giftBallAspect = String(giftBallAspectIterator.next())
    giftBallAspectLower = giftBallAspect.toLowerCase()
    if (giftBallAspectLower === 'male' || giftBallAspectLower === 'female' ||
        giftBallAspectLower === 'genderless' || giftBallAspectLower === 'shiny' ||
        giftBallSeenAspects[giftBallAspectLower]) continue

    giftBallTitleAspects.push(giftBallPrettyId(giftBallAspect))
    giftBallSeenAspects[giftBallAspectLower] = true
  }

  return giftBallTitleAspects.join(', ')
}

function giftBallPokemonTitle(pokemon) {
  var giftBallTitle = giftBallColorComponent(
    pokemon.getDisplayName(false),
    GIFT_BALL_COLOR_NAME
  )
  var giftBallSpecies
  var giftBallDetails

  if (pokemon.getNickname() != null) {
    giftBallSpecies = pokemon.getSpecies().getTranslatedName()
    giftBallTitle.append(giftBallColoredLiteral(' (', GIFT_BALL_COLOR_NAME))
    giftBallTitle.append(giftBallColorComponent(giftBallSpecies, GIFT_BALL_COLOR_NAME))
    giftBallTitle.append(giftBallColoredLiteral(')', GIFT_BALL_COLOR_NAME))
  }

  giftBallDetails = giftBallTitleDetails(pokemon)
  if (giftBallDetails.length > 0) {
    giftBallTitle.append(giftBallColoredLiteral(
      ' (' + giftBallDetails + ')',
      GIFT_BALL_COLOR_ASPECT
    ))
  }

  giftBallTitle.append(giftBallColoredLiteral(
    ' Lv.' + pokemon.getLevel(),
    GIFT_BALL_COLOR_GOOD
  ))
  return giftBallTitle
}

function giftBallPokemonLore(pokemon, variant) {
  var giftBallLore = new $GiftBallArrayList()
  var giftBallHeldItem = pokemon.heldItem()
  var giftBallAbility = pokemon.getAbility()
  var giftBallNature = pokemon.getNature()
  var giftBallMoveIterator = pokemon.getMoveSet().getMoves().iterator()
  var giftBallMove
  var giftBallMoveType
  var giftBallOriginalTrainer = pokemon.getOriginalTrainerName()

  giftBallLore.add(giftBallTypeLine(pokemon))
  giftBallLore.add(giftBallLorePairComponent(
    'Item: ',
    giftBallHeldItem.isEmpty() ? $GiftBallComponent.literal('None') : giftBallHeldItem.getHoverName(),
    GIFT_BALL_COLOR_GRAY
  ))
  giftBallLore.add(giftBallLorePairComponent(
    'Ability: ',
    giftBallAbility == null
      ? $GiftBallComponent.literal('None')
      : $GiftBallComponent.translatable(String(giftBallAbility.getDisplayName())),
    GIFT_BALL_COLOR_GRAY
  ))
  giftBallLore.add(giftBallStatLine('IVs: ', pokemon.getIvs(), 31))
  giftBallLore.add(giftBallStatLine('EVs: ', pokemon.getEvs(), 252))
  giftBallLore.add(giftBallLorePairComponent(
    'Nature: ',
    giftBallNature == null
      ? $GiftBallComponent.literal('None')
      : $GiftBallComponent.translatable(String(giftBallNature.getDisplayName())),
    GIFT_BALL_COLOR_GRAY
  ))

  while (giftBallMoveIterator.hasNext()) {
    giftBallMove = giftBallMoveIterator.next()
    giftBallMoveType = giftBallMove.getType()
    giftBallLore.add(giftBallLorePairComponent(
      '- ',
      giftBallMove.getDisplayName(),
      giftBallMoveType.getPrimaryColor()
    ))
  }

  if (giftBallOriginalTrainer == null || String(giftBallOriginalTrainer).length === 0) {
    giftBallOriginalTrainer = 'Unknown'
  }
  giftBallLore.add(giftBallGrayText(''))
  if (variant != null) giftBallLore.add(giftBallGrayText('Gift Ball: ' + variant.name))
  giftBallLore.add(giftBallGrayText('OT: ' + giftBallOriginalTrainer))

  return new $GiftBallItemLore(giftBallLore)
}

function giftBallRefreshFilledPresentation(player, stack) {
  if (player == null || !giftBallHasStoredPokemon(stack)) return

  var giftBallRefreshRoot
  var giftBallRefreshData
  var giftBallRefreshPokemonNbt
  var giftBallRefreshPokemon

  try {
    giftBallRefreshRoot = giftBallReadCustomData(stack)
    giftBallRefreshData = giftBallRefreshRoot.getCompound(GIFT_BALL_DATA_KEY)
    if (giftBallRefreshData.getInt(GIFT_BALL_VERSION_KEY) >= GIFT_BALL_PRESENTATION_VERSION &&
        stack.get($GiftBallDataComponents.LORE) != null) return

    giftBallRefreshPokemonNbt = giftBallRefreshData.getCompound(GIFT_BALL_POKEMON_KEY).copy()
    giftBallRefreshPokemon = new $GiftBallPokemon()
    giftBallRefreshPokemon.loadFromNBT(player.getServer().registryAccess(), giftBallRefreshPokemonNbt)

    stack.set(
      $GiftBallDataComponents.CUSTOM_NAME,
      giftBallPokemonTitle(giftBallRefreshPokemon)
    )
    stack.set($GiftBallDataComponents.LORE, giftBallPokemonLore(giftBallRefreshPokemon, giftBallVariant(stack)))
    stack.remove($GiftBallDataComponents.CUSTOM_MODEL_DATA)

    giftBallRefreshData.putInt(GIFT_BALL_VERSION_KEY, GIFT_BALL_PRESENTATION_VERSION)
    giftBallRefreshRoot.put(GIFT_BALL_DATA_KEY, giftBallRefreshData)
    giftBallWriteCustomData(stack, giftBallRefreshRoot)
  } catch (giftBallRefreshError) {
    console.error(`[gift_ball] Failed to refresh filled Gift Ball tooltip: ${String(giftBallRefreshError)}`)
  }
}

function giftBallReadCustomData(stack) {
  const data = stack.get($GiftBallDataComponents.CUSTOM_DATA)
  return data == null ? new $GiftBallCompoundTag() : data.copyTag()
}

function giftBallWriteCustomData(stack, tag) {
  if (tag.isEmpty()) {
    stack.remove($GiftBallDataComponents.CUSTOM_DATA)
  } else {
    stack.set($GiftBallDataComponents.CUSTOM_DATA, $GiftBallCustomData.of(tag))
  }
}

function giftBallHasStoredPokemon(stack) {
  const root = giftBallReadCustomData(stack)
  if (!root.contains(GIFT_BALL_DATA_KEY, 10)) return false

  return root.getCompound(GIFT_BALL_DATA_KEY).contains(GIFT_BALL_POKEMON_KEY, 10)
}

function giftBallIsEmpty(stack) {
  return (giftBallVariantForItem(stack.id) != null || String(stack.id) === 'cobblemon:pokemon_model') &&
    stack.get($GiftBallItemComponents.POKEMON_ITEM) == null && !giftBallHasStoredPokemon(stack)
}

function giftBallApplyEmptyComponents(stack) {
  if (!giftBallIsEmpty(stack)) return
  // Modern empty items get their name, tooltip, and model from registration.
  if (giftBallVariantForItem(stack.id) != null) return

  const lore = new $GiftBallArrayList()
  lore.add(giftBallGrayText('Right-Click to store a Pokémon inside'))
  lore.add(giftBallGrayText('Right-Click with a Pokémon inside to obtain it.'))

  stack.set($GiftBallDataComponents.CUSTOM_NAME, giftBallPlainText('Gift Ball'))
  stack.set($GiftBallDataComponents.LORE, new $GiftBallItemLore(lore))
  stack.set(
    $GiftBallDataComponents.CUSTOM_MODEL_DATA,
    new $GiftBallCustomModelData(GIFT_BALL_MODEL_DATA)
  )
}

ServerEvents.recipes(event => {
  event.remove({ id: 'lcc:gift_ball' })
  global.lccGiftBallVariants.forEach(variant => {
    if (!Item.exists(variant.ball)) return
    event.shaped(variant.item, ['LBL'], {
      L: 'cobblemon:link_cable',
      B: variant.ball
    }).id('lcc:' + variant.item.split(':')[1])
  })
})

function giftBallFindSessionStack(player, sessionId) {
  var giftBallSearchInventory = player.getInventory()
  var giftBallExpectedSession = String(sessionId)
  var giftBallSearchSlot
  var giftBallSearchStack
  var giftBallSearchRoot

  for (giftBallSearchSlot = 0; giftBallSearchSlot < giftBallSearchInventory.getContainerSize(); giftBallSearchSlot++) {
    giftBallSearchStack = giftBallSearchInventory.getItem(giftBallSearchSlot)
    if (giftBallSearchStack.isEmpty() || !giftBallIsEmpty(giftBallSearchStack)) continue

    giftBallSearchRoot = giftBallReadCustomData(giftBallSearchStack)
    if (!giftBallSearchRoot.contains(GIFT_BALL_SESSION_KEY)) continue

    try {
      if (String(giftBallSearchRoot.getUUID(GIFT_BALL_SESSION_KEY)) === giftBallExpectedSession) {
        return {
          inventory: giftBallSearchInventory,
          slot: giftBallSearchSlot,
          stack: giftBallSearchStack
        }
      }
    } catch (giftBallSessionLookupError) {
      // Ignore malformed session data and continue looking for the real stack.
    }
  }

  return null
}

function giftBallClearSession(player, sessionId) {
  const located = giftBallFindSessionStack(player, sessionId)
  if (located == null) return

  const root = giftBallReadCustomData(located.stack)
  root.remove(GIFT_BALL_SESSION_KEY)
  giftBallWriteCustomData(located.stack, root)
  located.inventory.setChanged()
}

function giftBallPartyPokemon(party) {
  const pokemon = new $GiftBallArrayList()
  const iterator = party.iterator()

  while (iterator.hasNext()) pokemon.add(iterator.next())
  return pokemon
}

function giftBallPokemonName(pokemon) {
  return String(pokemon.getDisplayName(false).getString())
}

function giftBallPlaySound(player, sound, pitch) {
  player.runCommandSilent(`playsound ${sound} master @s ~ ~ ~ 1 ${pitch}`)
}

function giftBallStoreSelectedPokemon(player, sessionId, selectedPokemon) {
  var giftBallPokemonRemoved = false
  var giftBallItemInstalled = false
  var giftBallStoreServer
  var giftBallStoredPokemonNbt
  var giftBallStoredPokemon
  var giftBallStoreVariant
  var giftBallFilledStack
  var giftBallFilledRoot
  var giftBallStoredData
  const located = giftBallFindSessionStack(player, sessionId)
  if (located == null) {
    player.tell(Text.red('The Gift Ball must remain in your inventory while choosing a Pokémon.'))
    return
  }

  const storage = $GiftBallCobblemon.INSTANCE.getStorage()
  const party = storage.getParty(player)
  const currentPokemon = party.get(selectedPokemon.getUuid())

  if (currentPokemon == null) {
    giftBallClearSession(player, sessionId)
    player.tell(Text.red('That Pokémon is no longer in your party.'))
    return
  }

  try {
    giftBallStoreServer = player.getServer()
    giftBallStoredPokemonNbt = currentPokemon.saveToNBT(
      giftBallStoreServer.registryAccess(),
      new $GiftBallCompoundTag()
    )

    // Change a detached copy so a failed store never alters the party Pokemon.
    giftBallStoreVariant = giftBallVariant(located.stack)
    giftBallStoredPokemon = new $GiftBallPokemon()
    giftBallStoredPokemon.loadFromNBT(giftBallStoreServer.registryAccess(), giftBallStoredPokemonNbt)
    if (giftBallStoreVariant != null) {
      giftBallStoredPokemon.setCaughtBall(giftBallCaughtBall(giftBallStoreVariant))
    }
    giftBallStoredPokemonNbt = giftBallStoredPokemon.saveToNBT(
      giftBallStoreServer.registryAccess(),
      new $GiftBallCompoundTag()
    )

    // Cobblemon installs its pokemon_item component internally in this factory.
    // Do not copy that component with ItemStack#set: KubeJS attempts to pass it
    // through the component codec, which rejects Cobblemon's nullable tint.
    giftBallFilledStack = $GiftBallPokemonItem.from(giftBallStoredPokemon)

    giftBallFilledRoot = giftBallReadCustomData(giftBallFilledStack)
    giftBallStoredData = new $GiftBallCompoundTag()
    giftBallStoredData.putInt(GIFT_BALL_VERSION_KEY, GIFT_BALL_PRESENTATION_VERSION)
    if (giftBallStoreVariant != null) {
      giftBallStoredData.putString(GIFT_BALL_VARIANT_KEY, giftBallStoreVariant.item)
    }
    giftBallStoredData.put(GIFT_BALL_POKEMON_KEY, giftBallStoredPokemonNbt)
    giftBallFilledRoot.remove(GIFT_BALL_SESSION_KEY)
    giftBallFilledRoot.put(GIFT_BALL_DATA_KEY, giftBallStoredData)
    giftBallWriteCustomData(giftBallFilledStack, giftBallFilledRoot)

    // Mirror Cobblemon's compact party-summary formatting while retaining the
    // selected Pokemon's nickname, species, special aspects, and level.
    giftBallFilledStack.set(
      $GiftBallDataComponents.CUSTOM_NAME,
      giftBallPokemonTitle(giftBallStoredPokemon)
    )
    giftBallFilledStack.set(
      $GiftBallDataComponents.LORE,
      giftBallPokemonLore(giftBallStoredPokemon, giftBallStoreVariant)
    )
    giftBallFilledStack.remove($GiftBallDataComponents.CUSTOM_MODEL_DATA)

    if (!party.remove(currentPokemon)) {
      giftBallClearSession(player, sessionId)
      player.tell(Text.red('That Pokémon could not be removed from your party.'))
      return
    }

    giftBallPokemonRemoved = true
    located.inventory.setItem(located.slot, giftBallFilledStack)
    giftBallItemInstalled = true
    located.inventory.setChanged()

    giftBallPlaySound(player, 'cobblemon:item.pokedex.scan_register_pokemon', 0.6)
    giftBallPlaySound(player, 'cobblemon:poke_ball.recall', 2)
    player.tell(Text.green(`${giftBallPokemonName(currentPokemon)} was stored in the Gift Ball.`))
  } catch (error) {
    // The party slot was just vacated, so it can safely accept the same object
    // if building/installing the filled item failed before installation.
    if (giftBallPokemonRemoved && !giftBallItemInstalled) party.add(currentPokemon)
    if (!giftBallItemInstalled) giftBallClearSession(player, sessionId)
    console.error(`[gift_ball] Failed to store Pokémon: ${String(error)}${error?.stack ? `\n${String(error.stack)}` : ''}`)
    player.tell(giftBallItemInstalled
      ? Text.red('The Pokémon was stored, but reporting the result failed. Check the KubeJS server log.')
      : Text.red(`The Pokémon could not be stored: ${String(error)}`)
    )
  }
}

function giftBallOpenParty(player, stack) {
  const party = $GiftBallCobblemon.INSTANCE.getStorage().getParty(player)
  const pokemon = giftBallPartyPokemon(party)

  if (pokemon.isEmpty()) {
    player.tell(Text.red('There are no Pokémon in your party to store.'))
    return
  }

  const sessionId = $GiftBallUUID.randomUUID()
  const root = giftBallReadCustomData(stack)
  root.putUUID(GIFT_BALL_SESSION_KEY, sessionId)
  giftBallWriteCustomData(stack, root)
  player.getInventory().setChanged()

  $GiftBallPartySelectCallbacks.INSTANCE.createFromPokemon(
    player,
    $GiftBallComponent.literal('Choose a Pokémon to store'),
    pokemon,
    selected => true,
    cancelledBy => giftBallClearSession(cancelledBy, sessionId),
    selected => giftBallStoreSelectedPokemon(player, sessionId, selected)
  )
}

function giftBallReleasePokemon(player, stack) {
  var giftBallReleaseRoot
  var giftBallReleaseData
  var giftBallReleasePokemonNbt
  var giftBallReleasedPokemon
  var giftBallReleaseParty
  var giftBallReleaseVariant

  try {
    giftBallReleaseRoot = giftBallReadCustomData(stack)
    giftBallReleaseData = giftBallReleaseRoot.getCompound(GIFT_BALL_DATA_KEY)
    giftBallReleasePokemonNbt = giftBallReleaseData.getCompound(GIFT_BALL_POKEMON_KEY).copy()
    giftBallReleasedPokemon = new $GiftBallPokemon()
    giftBallReleasedPokemon.loadFromNBT(player.getServer().registryAccess(), giftBallReleasePokemonNbt)
    giftBallReleaseVariant = giftBallVariant(stack)
    if (giftBallReleaseVariant != null) {
      giftBallReleasedPokemon.setCaughtBall(giftBallCaughtBall(giftBallReleaseVariant))
    }

    giftBallReleaseParty = $GiftBallCobblemon.INSTANCE.getStorage().getParty(player)
    if (!giftBallReleaseParty.add(giftBallReleasedPokemon)) {
      player.tell(Text.red('Your party and PC are full; the Pokémon stayed in the Gift Ball.'))
      return
    }

    stack.shrink(1)
    player.getInventory().setChanged()
    giftBallPlaySound(player, 'cobblemon:poke_ball.capture_succeeded', 1)
    giftBallPlaySound(player, 'cobblemon:gui.levelup', 1.5)
    player.tell(Text.green(`You received ${giftBallPokemonName(giftBallReleasedPokemon)} as a gift!`))
  } catch (error) {
    console.error(`[gift_ball] Failed to release Pokémon: ${String(error)}${error?.stack ? `\n${String(error.stack)}` : ''}`)
    player.tell(Text.red(`The Pokémon could not be released: ${String(error)}`))
  }
}

// Normalize newly obtained, componentless Pokemon Model stacks into empty Gift
// Balls. Pokemon model stacks that already describe a species are untouched.
PlayerEvents.inventoryChanged('cobblemon:pokemon_model', event => {
  if (giftBallHasStoredPokemon(event.item)) {
    giftBallRefreshFilledPresentation(event.player, event.item)
  } else {
    giftBallApplyEmptyComponents(event.item)
  }
})

function giftBallRightClicked(event) {
  const player = event.player
  const stack = event.item
  if (player == null || stack == null) return

  const hasStoredPokemon = giftBallHasStoredPokemon(stack)
  const isEmptyGiftBall = giftBallIsEmpty(stack)

  // A regular Cobblemon Pokemon Model has a render component but no Gift Ball
  // payload. It must keep its normal behavior.
  if (!hasStoredPokemon && !isEmptyGiftBall) return

  if ($GiftBallPlayerExtensions.getBattleState(player) != null) {
    player.tell(Text.red('A Gift Ball cannot be used during battle.'))
    event.cancel()
  }

  if (hasStoredPokemon) {
    giftBallReleasePokemon(player, stack)
    event.cancel()
  }

  giftBallApplyEmptyComponents(stack)
  giftBallOpenParty(player, stack)
  event.cancel()
}

ItemEvents.rightClicked('cobblemon:pokemon_model', giftBallRightClicked)
global.lccGiftBallVariants.forEach(variant => {
  ItemEvents.rightClicked(variant.item, giftBallRightClicked)
})
