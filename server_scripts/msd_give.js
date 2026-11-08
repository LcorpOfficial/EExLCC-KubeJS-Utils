// Gives Mega Showdown items by their loaded datapack registry entry.
//
// Built-in MSD entries usually have a real item with the same components.
// Datapack entries may instead be a vanilla carrier item whose recipe output
// supplies custom model data, name, lore, and MSD registry components. Build a
// template index from both sources so copies look and behave like crafted ones.
ServerEvents.commandRegistry(event => {
  const Commands = event.commands

  const StringArgumentType = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
  const IntegerArgumentType = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType')
  const EntityArgument = Java.loadClass('net.minecraft.commands.arguments.EntityArgument')
  const Component = Java.loadClass('net.minecraft.network.chat.Component')
  const ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
  const BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
  const ItemStack = Java.loadClass('net.minecraft.world.item.ItemStack')

  const MsdRegistries = Java.loadClass(
    'com.github.yajatkaul.mega_showdown.datapack.MegaShowdownDatapackRegister'
  )
  const MsdComponents = Java.loadClass(
    'com.github.yajatkaul.mega_showdown.components.MegaShowdownDataComponents'
  )

  const TYPE_COMPONENT = MsdComponents.REGISTRY_TYPE_COMPONENT.get()
  const LOCATION_COMPONENT = MsdComponents.RESOURCE_LOCATION_COMPONENT.get()

  // Command-facing names can be friendlier than MSD's internal component type.
  // These cover every item-backed registry accepted by the installed /msd apply.
  const CATEGORIES = {
    mega: {
      type: 'mega',
      registry: () => MsdRegistries.MEGA_REGISTRY
    },
    zcrystal: {
      type: 'z_crystal_item',
      registry: () => MsdRegistries.Z_CRYSTAL_ITEM_REGISTRY
    },
    showdown_item: {
      type: 'showdown_item',
      registry: () => MsdRegistries.SHOWDOWN_ITEM_REGISTRY
    },
    held_form_change: {
      type: 'held_form_change',
      registry: () => MsdRegistries.HELD_ITEM_FORM_CHANGE_REGISTRY
    },
    solo_fusion: {
      type: 'solo_fusion',
      registry: () => MsdRegistries.SOLO_FUSION_REGISTRY
    },
    du_fusion: {
      type: 'du_fusion',
      registry: () => MsdRegistries.DU_FUSION_REGISTRY
    },
    form_change_interact: {
      type: 'form_change_interact',
      registry: () => MsdRegistries.FORM_CHANGE_INTERACT_REGISTRY
    },
    form_change_toggle_interact: {
      type: 'form_change_toggle_interact',
      registry: () => MsdRegistries.FORM_CHANGE_TOGGLE_INTERACT_REGISTRY
    }
  }

  const CATEGORY_NAMES = Object.keys(CATEGORIES)
  let templateIndex = null

  function stackKey(type, location) {
    return `${String(type)}|${String(location)}`
  }

  function indexStack(index, stack) {
    if (!stack || stack.isEmpty()) return

    const type = stack.get(TYPE_COMPONENT)
    const location = stack.get(LOCATION_COMPONENT)
    if (type == null || location == null) return

    const key = stackKey(type, location)
    // Prefer a registered item's default stack. Recipes fill entries that have
    // no concrete item ID, which is the common custom-model-data case.
    if (!index.has(key)) {
      const template = stack.copy()
      template.setCount(1)
      index.set(key, template)
    }
  }

  function buildTemplateIndex(server) {
    const index = new Map()

    // Built-in MSD items and custom items registered by an item-creation mod.
    BuiltInRegistries.ITEM.keySet().forEach(itemId => {
      try {
        indexStack(index, new ItemStack(BuiltInRegistries.ITEM.get(itemId)))
      } catch (error) {
        console.warn(`[msd give] Could not inspect registered item ${String(itemId)}: ${String(error)}`)
      }
    })

    // Vanilla-carrier custom items. getResultItem returns the complete loaded
    // result, including CMD, item name, lore, and mod data components.
    server.getRecipeManager().getRecipes().forEach(holder => {
      try {
        // Rhino can misread a block-scoped declaration here as a redeclaration
        // when Java invokes this callback repeatedly.
        var recipeResultStack = holder.value().getResultItem(server.registryAccess())
        indexStack(index, recipeResultStack)
      } catch (error) {
        console.warn(`[msd give] Could not inspect recipe ${String(holder.id())}: ${String(error)}`)
      }
    })

    return index
  }

  function getTemplate(server, category, location) {
    if (templateIndex == null) templateIndex = buildTemplateIndex(server)
    return templateIndex.get(stackKey(category.type, location)) ?? null
  }

  function getRegistryIds(category) {
    const registry = category.registry()
    const ids = []
    if (registry == null) return ids

    registry.keySet().forEach(id => ids.push(String(id)))
    ids.sort()
    return ids
  }

  function suggestRegistryIds(builder, category) {
    const remaining = String(builder.getRemaining()).toLowerCase()
    const suggestedPaths = new Set()

    getRegistryIds(category).forEach(id => {
      const separator = id.indexOf(':')
      const path = separator >= 0 ? id.substring(separator + 1) : id
      if ((!remaining || path.toLowerCase().startsWith(remaining)) && !suggestedPaths.has(path)) {
        suggestedPaths.add(path)
        builder.suggest(path)
      }
    })

    return builder.buildFuture()
  }

  function resolveEntry(rawEntry, category) {
    // Keep fully-qualified IDs available for namespace collisions and automation,
    // but make the normal command and tab-completion path namespace-free.
    if (rawEntry.includes(':')) {
      const location = ResourceLocation.tryParse(rawEntry)
      return location == null
        ? { location: null, error: `Invalid resource location: ${rawEntry}` }
        : { location: location, error: null }
    }

    const matches = []
    const registry = category.registry()
    if (registry != null) {
      registry.keySet().forEach(id => {
        const fullId = String(id)
        const separator = fullId.indexOf(':')
        const path = separator >= 0 ? fullId.substring(separator + 1) : fullId
        if (path === rawEntry) matches.push(id)
      })
    }

    if (matches.length === 1) return { location: matches[0], error: null }
    if (matches.length === 0) {
      return {
        location: null,
        error: `${rawEntry} is not loaded in the ${category.type} registry.`
      }
    }

    return {
      location: null,
      error: `${rawEntry} is ambiguous (${matches.map(id => String(id)).join(', ')}); use a full namespace:id.`
    }
  }

  function fail(source, message) {
    source.sendFailure(Component.literal(message))
    return 0
  }

  function giveEntry(ctx, target, category, count) {
    const source = ctx.source
    if (target == null) return fail(source, 'Specify a player when using this command from the console.')

    const rawEntry = StringArgumentType.getString(ctx, 'entry')
    const resolvedEntry = resolveEntry(rawEntry, category)
    if (resolvedEntry.error != null) return fail(source, resolvedEntry.error)
    const location = resolvedEntry.location

    const registry = category.registry()
    if (registry == null || !registry.containsKey(location)) {
      return fail(source, `${String(location)} is not loaded in the ${category.type} registry.`)
    }

    const template = getTemplate(source.server, category, location)
    if (template == null) {
      return fail(
        source,
        `${String(location)} is mechanically registered, but no registered item or recipe result provides its item stack.`
      )
    }

    const stack = template.copy()
    stack.setCount(count)
    target.give(stack)

    const targetName = String(target.getGameProfile().getName())
    const successMessage = `Gave ${count}x ${String(location)} (${category.type}) to ${targetName}.`
    if (source.player != null) {
      source.player.tell(Text.green(successMessage))
    } else {
      console.info(`[msd give] ${successMessage}`)
    }
    return 1
  }

  function categoryNode(categoryName, targetResolver) {
    const category = CATEGORIES[categoryName]

    return Commands.literal(categoryName)
      .then(
        Commands.argument('entry', StringArgumentType.word())
          .suggests((ctx, builder) => suggestRegistryIds(builder, category))
          .executes(ctx => giveEntry(ctx, targetResolver(ctx), category, 1))
          .then(
            Commands.argument('count', IntegerArgumentType.integer(1, 64))
              .executes(ctx => giveEntry(
                ctx,
                targetResolver(ctx),
                category,
                IntegerArgumentType.getInteger(ctx, 'count')
              ))
          )
      )
  }

  const giveRoot = Commands.literal('give')
    .requires(source => source.hasPermission(2))

  // /msd give <category> <entry> [count]
  CATEGORY_NAMES.forEach(categoryName => {
    giveRoot.then(categoryNode(categoryName, ctx => ctx.source.player))
  })

  // /msd give <player> <category> <entry> [count]
  const playerArgument = Commands.argument('player', EntityArgument.player())
  CATEGORY_NAMES.forEach(categoryName => {
    playerArgument.then(categoryNode(
      categoryName,
      ctx => EntityArgument.getPlayer(ctx, 'player')
    ))
  })
  giveRoot.then(playerArgument)

  // Brigadier merges this literal with Mega Showdown's existing /msd root.
  event.register(
    Commands.literal('msd')
      .then(giveRoot)
  )
})
