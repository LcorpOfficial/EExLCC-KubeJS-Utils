// Run with: node tests/gift_ball.test.cjs (no packages required).
// Exercise the real scripts with small stand-ins for Minecraft's Java objects.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '..')
function test(name, run) {
  run()
  console.log('PASS ' + name)
}

class Tag {
  constructor(values = {}) { this.values = values }
  copy() {
    return new Tag(Object.fromEntries(Object.entries(this.values).map(([key, value]) =>
      [key, value instanceof Tag ? value.copy() : value])))
  }
  contains(key, type) {
    const value = this.values[key]
    return type === 10 ? value instanceof Tag : type === 8 ? typeof value === 'string' : key in this.values
  }
  getCompound(key) { return this.values[key] instanceof Tag ? this.values[key] : new Tag() }
  getString(key) { return this.values[key] || '' }
  getInt(key) { return this.values[key] || 0 }
  getUUID(key) { return this.values[key] }
  put(key, value) { this.values[key] = value }
  putString(key, value) { this.put(key, value) }
  putInt(key, value) { this.put(key, value) }
  putUUID(key, value) { this.put(key, value) }
  remove(key) { delete this.values[key] }
  isEmpty() { return Object.keys(this.values).length === 0 }
}

class Stack {
  constructor(id) { this.id = id; this.count = 1; this.components = new Map() }
  get(key) { return this.components.get(key) }
  set(key, value) { this.components.set(key, value) }
  remove(key) { this.components.delete(key) }
  isEmpty() { return this.count === 0 }
  shrink(count) { this.count -= count }
}

class Pokemon {
  constructor() { this.state = { uuid: 'pokemon-uuid', ball: 'cobblemon:ultra_ball', name: 'Eevee', ivs: '31/12/31/8/31/31' } }
  saveToNBT(registry, tag) { tag.putString('state', JSON.stringify(this.state)); return tag }
  loadFromNBT(registry, tag) { this.state = JSON.parse(tag.getString('state')); return this }
  setCaughtBall(ball) { this.state.ball = ball.id }
  getUuid() { return this.state.uuid }
  getDisplayName() { return { getString: () => this.state.name } }
}

function environment() {
  const builders = new Map()
  const recipes = []
  const handlers = new Map()
  const missing = new Set()
  const textures = new Set()
  const errors = []
  var assetHandler
  const components = Object.fromEntries(['CUSTOM_DATA', 'CUSTOM_NAME', 'CUSTOM_MODEL_DATA', 'LORE'].map(key => [key, key]))
  const storage = { getParty: player => player.party }
  const paths = { ASSETS: { resolve: name => ({ toFile: () => ({ isFile: () => textures.has(name) }) }) } }
  const classes = {
    'dev.latvian.mods.kubejs.KubeJSPaths': paths,
    'com.cobblemon.mod.common.Cobblemon': { INSTANCE: { getStorage: () => storage } },
    'com.cobblemon.mod.common.CobblemonItemComponents': { POKEMON_ITEM: 'pokemon_item' },
    'com.cobblemon.mod.common.pokemon.Pokemon': Pokemon,
    'com.cobblemon.mod.common.item.PokemonItem': { from: () => {
      const stack = new Stack('cobblemon:pokemon_model')
      stack.set('pokemon_item', { species: 'eevee' })
      return stack
    } },
    'com.cobblemon.mod.common.util.PlayerExtensionsKt': { getBattleState: player => player.battle || null },
    'net.minecraft.core.component.DataComponents': components,
    'net.minecraft.nbt.CompoundTag': Tag,
    'net.minecraft.world.item.component.CustomData': { of: tag => ({ copyTag: () => tag.copy() }) },
    'net.minecraft.core.registries.BuiltInRegistries': { ITEM: { get: id => ({ getPokeBall: () => ({ id }) }) } },
    'net.minecraft.resources.ResourceLocation': { parse: id => id },
    'net.minecraft.world.item.component.CustomModelData': class { constructor(value) { this.value = value } },
    'net.minecraft.world.item.component.ItemLore': class { constructor(lines) { this.lines = lines } },
    'java.util.ArrayList': class extends Array { add(value) { this.push(value) } },
    'java.util.UUID': { randomUUID: () => 'test-session' }
  }
  const text = value => ({ value, getStyle: () => ({ withItalic: () => ({}) }), setStyle() { return this } })
  classes['net.minecraft.network.chat.Component'] = { literal: text }
  classes['net.minecraft.network.chat.Style'] = { EMPTY: { withItalic: () => ({}) } }
  const context = vm.createContext({
    global: {},
    Java: { loadClass: name => classes[name] || {} },
    Text: { gray: text, red: text, green: text },
    console: { error: message => errors.push(message) },
    StartupEvents: { registry: (type, callback) => callback({ create: id => {
      const builder = { id }
      for (const method of ['displayName', 'unstackable', 'tag', 'tooltip', 'modelGenerator']) {
        builder[method] = value => { builder[method + 'Value'] = value; return builder }
      }
      builders.set(id, builder)
      return builder
    } }) },
    ServerEvents: { recipes: callback => callback({ remove() {}, shaped: (output, pattern, ingredients) => ({ id: id => {
      recipes.push({ id, output, pattern, ingredients })
    } }) }) },
    PlayerEvents: { inventoryChanged() {} },
    ItemEvents: { rightClicked: (id, callback) => handlers.set(id, callback) },
    ClientEvents: { generateAssets: (stage, callback) => {
      assert.equal(stage, 'last')
      assetHandler = callback
    } },
    Item: { exists: id => !missing.has(id), of: id => new Stack(id) }
  })
  const run = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file })
  run('startup_scripts/gift_balls.js')
  run('server_scripts/gift_ball.js')
  run('client_scripts/gift_ball_assets.js')
  // Presentation formatting is unchanged apart from a variety line; isolate
  // transfer tests from Minecraft's text, species, stat, and move registries.
  context.giftBallPokemonTitle = pokemon => pokemon.state.name
  context.giftBallPokemonLore = (pokemon, variant) => variant?.name || 'Legacy gift'
  function reloadAssets() {
    const models = new Map()
    // Disk assets override registration models. The final client asset stage
    // must then override disk models, including stale icon references.
    for (const id of builders.keys()) {
      const name = id.split(':')[1]
      models.set(id, JSON.parse(fs.readFileSync(path.join(root, 'assets/kubejs/models/item', name + '.json'), 'utf8')))
    }
    assetHandler({ json: (id, model) => {
      const itemId = id.replace(':models/item/', ':').replace(/\.json$/, '')
      models.set(itemId, JSON.parse(JSON.stringify(model)))
    } })
    return models
  }
  return { context, builders, recipes, handlers, missing, textures, errors, reloadAssets }
}

function playerWith(stack) {
  const pokemon = new Pokemon()
  const inventory = {
    stack, failInstall: false,
    getContainerSize: () => 1,
    getItem() { return this.stack },
    setItem(slot, value) {
      if (this.failInstall) throw new Error('Simulated inventory failure')
      this.stack = value
    },
    setChanged() {}
  }
  const party = {
    pokemon, full: false,
    get(uuid) { return this.pokemon?.getUuid() === uuid ? this.pokemon : null },
    remove(value) { if (this.pokemon !== value) return false; this.pokemon = null; return true },
    add(value) { if (this.full) return false; this.pokemon = value; return true }
  }
  return { party, inventory, messages: [], getInventory: () => inventory,
    getServer: () => ({ registryAccess: () => ({}) }), tell(message) { this.messages.push(message) }, runCommandSilent() {} }
}

function store(env, itemId) {
  const empty = new Stack(itemId)
  const player = playerWith(empty)
  const original = player.party.pokemon
  const tag = new Tag()
  tag.putUUID('lccGiftBallSession', 'test-session')
  env.context.giftBallWriteCustomData(empty, tag)
  env.context.giftBallStoreSelectedPokemon(player, 'test-session', original)
  return { player, empty, original, filled: player.inventory.stack }
}

test('every registered variety crafts from its exact ball, keeps Pokemon data, and changes its caught ball', () => {
  const env = environment()
  assert.equal(env.recipes.length, 49)
  assert.equal(env.builders.size, 49)
  assert.equal(new Set(env.recipes.map(recipe => recipe.id)).size, 49)
  for (const recipe of env.recipes) {
    assert.equal(recipe.ingredients.L, 'cobblemon:link_cable')
    assert.equal(recipe.pattern.join(''), 'LBL')
    assert.ok(!recipe.ingredients.B.startsWith('#'))
    assert.ok(env.handlers.has(recipe.output))
    assert.ok('unstackableValue' in env.builders.get(recipe.output))
    const { player, original, filled } = store(env, recipe.output)
    assert.equal(player.party.pokemon, null)
    assert.equal(original.state.ball, 'cobblemon:ultra_ball')
    assert.equal(filled.id, 'cobblemon:pokemon_model')
    const payload = env.context.giftBallReadCustomData(filled).getCompound('lccGiftBall')
    assert.equal(payload.getString('giftBall'), recipe.output)
    assert.equal(JSON.parse(payload.getCompound('pokemon').getString('state')).ball, recipe.ingredients.B)
    env.context.giftBallReleasePokemon(player, filled)
    assert.equal(player.party.pokemon.state.ball, recipe.ingredients.B)
    assert.equal(player.party.pokemon.state.uuid, original.state.uuid)
    assert.equal(player.party.pokemon.state.ivs, original.state.ivs)
    assert.equal(filled.count, 0)
  }
  assert.deepEqual(env.errors, [])
})

test('icons inherit Strange, use available PNGs, and detect later additions and removals', () => {
  const env = environment()
  function modelFor(id) {
    return env.reloadAssets().get(id)
  }
  for (const id of env.builders.keys()) {
    const model = modelFor(id)
    assert.equal(model.parent, 'kubejs:item/strange_gift_ball')
    assert.equal(model.textures, undefined)
  }
  for (const file of fs.readdirSync(path.join(root, 'assets/kubejs/textures/item/gift_ball'))) {
    env.textures.add('kubejs/textures/item/gift_ball/' + file)
  }
  assert.equal(modelFor('kubejs:great_gift_ball').textures.layer0, 'kubejs:item/gift_ball/great_gift_ball')
  const mythTexture = 'kubejs/textures/item/gift_ball/myth_gift_ball.png'
  env.textures.delete(mythTexture)
  assert.equal(modelFor('kubejs:myth_gift_ball').textures, undefined)
  env.textures.add(mythTexture)
  assert.equal(modelFor('kubejs:myth_gift_ball').textures.layer0, 'kubejs:item/gift_ball/myth_gift_ball')
  env.textures.delete(mythTexture)
  assert.equal(modelFor('kubejs:myth_gift_ball').textures, undefined)
  // A removed synced icon must override its shipped static model with fallback.
  env.textures.delete('kubejs/textures/item/gift_ball/great_gift_ball.png')
  assert.equal(modelFor('kubejs:great_gift_ball').textures, undefined)
})

test('synced static item models directly reference each existing icon', () => {
  const env = environment()
  for (const id of env.builders.keys()) {
    const name = id.split(':')[1]
    const model = JSON.parse(fs.readFileSync(path.join(root, 'assets/kubejs/models/item', name + '.json'), 'utf8'))
    assert.equal(model.parent, 'kubejs:item/strange_gift_ball')
    if (fs.existsSync(path.join(root, 'assets/kubejs/textures/item/gift_ball', name + '.png'))) {
      assert.equal(model.textures.layer0, 'kubejs:item/gift_ball/' + name)
    } else {
      assert.equal(model.textures, undefined)
    }
  }
})

test('full storage leaves the filled gift intact for a later attempt', () => {
  const env = environment()
  const { player, filled } = store(env, 'kubejs:great_gift_ball')
  player.party.full = true
  env.context.giftBallReleasePokemon(player, filled)
  assert.equal(filled.count, 1)
  assert.equal(player.party.pokemon, null)
  player.party.full = false
  env.context.giftBallReleasePokemon(player, filled)
  assert.equal(filled.count, 0)
  assert.equal(player.party.pokemon.state.ball, 'cobblemon:great_ball')
})

test('failed installation restores the original Pokemon without changing its ball', () => {
  const env = environment()
  const empty = new Stack('kubejs:great_gift_ball')
  const player = playerWith(empty)
  const original = player.party.pokemon
  player.inventory.failInstall = true
  const rootTag = new Tag()
  rootTag.putUUID('lccGiftBallSession', 'test-session')
  env.context.giftBallWriteCustomData(empty, rootTag)
  env.context.giftBallStoreSelectedPokemon(player, 'test-session', original)
  assert.equal(player.party.pokemon, original)
  assert.equal(original.state.ball, 'cobblemon:ultra_ball')
  assert.equal(player.inventory.stack, empty)
  assert.equal(env.context.giftBallReadCustomData(empty).contains('lccGiftBallSession'), false)
  assert.equal(env.errors.length, 1)
})

test('missing Myth Ball leaves its Pokemon safely inside the gift', () => {
  const env = environment()
  const { player, filled } = store(env, 'kubejs:myth_gift_ball')
  env.missing.add('faismythicalmonstrosities:myth_ball')
  env.context.giftBallReleasePokemon(player, filled)
  assert.equal(filled.count, 1)
  assert.equal(player.party.pokemon, null)
  assert.equal(env.errors.length, 1)
})

test('legacy gifts retain their original ball and ordinary Pokemon models remain untouched', () => {
  const env = environment()
  const { player, filled } = store(env, 'cobblemon:pokemon_model')
  env.context.giftBallReleasePokemon(player, filled)
  assert.equal(player.party.pokemon.state.ball, 'cobblemon:ultra_ball')
  const model = new Stack('cobblemon:pokemon_model')
  model.set('pokemon_item', { species: 'eevee' })
  env.handlers.get(model.id)({ item: model, player, cancel() { assert.fail('Ordinary model was handled as a gift') } })
  assert.deepEqual(env.errors, [])
})

test('battle use is cancelled before storing or receiving Pokemon', () => {
  const env = environment()
  const { player, filled } = store(env, 'kubejs:great_gift_ball')
  player.battle = {}
  const cancelled = new Error('KubeJS event exit')
  assert.throws(() => env.handlers.get(filled.id)({ item: filled, player, cancel() { throw cancelled } }), error => error === cancelled)
  assert.equal(filled.count, 1)
  assert.equal(player.party.pokemon, null)
})
