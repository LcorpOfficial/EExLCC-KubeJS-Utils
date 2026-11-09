// Run with: node tests/award_metadata.test.cjs (no packages required).
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '..')
function test(name, run) { run(); console.log('PASS ' + name) }

class Tag {
  constructor(values = {}) { this.values = values }
  copy() {
    return new Tag(Object.fromEntries(Object.entries(this.values).map(([key, value]) =>
      [key, value instanceof Tag ? value.copy() : value])))
  }
  contains(key, type) { return type === 8 ? typeof this.values[key] === 'string' : key in this.values }
  getCompound(key) { return this.values[key] instanceof Tag ? this.values[key] : new Tag() }
  getString(key) { return this.values[key] || '' }
  put(key, value) { this.values[key] = value }
  putString(key, value) { this.put(key, value) }
}
class Stack {
  constructor(id) { this.id = id; this.components = new Map() }
  get(component) { return this.components.get(component) }
  set(component, value) { this.components.set(component, value) }
  isEmpty() { return false }
}
class BlockEntity {
  constructor(id, data = new Tag()) { this.id = id; this.data = data; this.synced = false }
  getBlock() { return { id: this.id } }
  sync() { this.synced = true }
}
class BlockAccessor {
  constructor(entity) { this.entity = entity }
  getBlockEntity() { return this.entity }
}
class Lore {
  constructor(lines) { this.value = lines }
  lines() { return this.value }
}
const text = value => ({
  getString: () => value,
  getStyle: () => ({ withItalic: () => ({}) }),
  setStyle() { return this }
})
const components = { CUSTOM_DATA: 'custom', BLOCK_ENTITY_DATA: 'block', LORE: 'lore' }
function component(tag) { return { copyTag: () => tag.copy() } }
function actor(name) {
  // KubeJS does not expose Entity#getUUID under that Java method name. Use the
  // actual GameProfile API, and do not mock an unsupported player getter.
  return { getGameProfile: () => ({ getName: () => name, getId: () => name + '-uuid' }) }
}

function environment(jade = true) {
  const handlers = { placed: new Map(), drops: new Map() }
  const callbacks = []
  const classes = {
    'net.minecraft.core.component.DataComponents': components,
    'net.minecraft.world.item.component.CustomData': { of: component },
    'net.minecraft.nbt.CompoundTag': Tag,
    'net.minecraft.world.item.component.ItemLore': Lore,
    'java.util.ArrayList': class extends Array { add(value) { this.push(value) } },
    'snownee.jade.api.BlockAccessor': BlockAccessor,
    'dev.latvian.mods.kubejs.block.entity.KubeBlockEntity': BlockEntity,
    'snownee.jade.api.callback.JadeTooltipCollectedCallback': {},
    'snownee.jade.impl.WailaClientRegistration': { instance: () => ({
      addTooltipCollectedCallback: (priority, callback) => callbacks.push(callback),
      tooltipCollectedCallback: { sort() {} }
    }) }
  }
  const context = vm.createContext({
    global: {},
    Java: { loadClass: name => {
      assert.ok(name in classes, 'Unexpected Java dependency: ' + name)
      return classes[name]
    } },
    JavaAdapter: function (type, methods) { return methods },
    Platform: { isLoaded: id => id === 'jade' && jade },
    Text: { gray: text },
    Ingredient: { of: tag => ({ test: stack => tag === '#lcc:badges' && stack.id.startsWith('kubejs:badge_') }) },
    PlayerEvents: {
      inventoryChanged: callback => { handlers.inventoryChanged = callback },
      loggedIn: callback => { handlers.loggedIn = callback }
    },
    BlockEvents: {
      placed: (id, callback) => handlers.placed.set(id, callback),
      drops: (id, callback) => handlers.drops.set(id, callback)
    }
  })
  function run(file) { vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }) }
  run('startup_scripts/award_metadata.js')
  run('server_scripts/award_metadata.js')
  run('client_scripts/award_jade.js')
  return { context, handlers, callbacks, run }
}

function recordOf(stack) { return stack.get('custom').copyTag().getCompound('lccAward') }
function values(record) { return { ...record.values } }
function tooltip(env, accessor) {
  const lines = []
  const box = { getTooltip: () => ({ add: line => lines.push(line.getString()) }) }
  env.callbacks[0].onTooltipCollected(box, accessor)
  return lines
}

test('both trophy types and badges store the grantor and recipient names and UUIDs', () => {
  const env = environment()
  for (const id of ['kubejs:trophy_tournament', 'kubejs:trophy_champion', 'kubejs:badge_fire', 'kubejs:badge_special_1']) {
    const stack = env.context.global.lccAwards.stamp(new Stack(id), actor('Leader'), actor('Winner'))
    assert.deepEqual(values(recordOf(stack)), {
      grantedBy: 'Leader', grantedByUuid: 'Leader-uuid', grantedTo: 'Winner', grantedToUuid: 'Winner-uuid'
    })
    assert.deepEqual(Array.from(stack.get('lore').lines(), line => line.getString()), ['Earned by: Winner', 'Granted by: Leader'])
    if (id.startsWith('kubejs:trophy_')) {
      const blockData = stack.get('block').copyTag()
      assert.equal(blockData.getString('id'), id)
      assert.deepEqual(values(blockData.getCompound('data').getCompound('lccAward')), values(recordOf(stack)))
    } else {
      assert.equal(stack.get('block'), undefined)
    }
  }
})

test('award identity survives repeated native placement, disk reload, and original block-entity drop cycles', () => {
  const env = environment()
  for (const id of env.context.global.lccAwards.trophies) {
    var stack = env.context.global.lccAwards.stamp(new Stack(id), actor('Leader'), actor('Winner'))
    const expected = values(recordOf(stack))
    for (let cycle = 0; cycle < 3; cycle++) {
      // Match BlockItem's native BLOCK_ENTITY_DATA restoration. It uses the
      // placed stack, so the identity does not depend on either player's hands.
      const placedData = stack.get('block').copyTag().getCompound('data')
      const reloadedEntity = new BlockEntity(id, placedData.copy())
      const dropped = new Stack(id)
      const unrelatedDrop = new Stack('minecraft:gold_nugget')
      env.handlers.drops.get(id)({
        block: { id, entity: reloadedEntity }, // cached original; world can already be air
        items: [dropped, unrelatedDrop], entity: actor('OtherPlayer')
      })
      assert.deepEqual(values(recordOf(dropped)), expected)
      assert.equal(unrelatedDrop.get('custom'), undefined)
      assert.deepEqual(tooltip(env, new BlockAccessor(reloadedEntity)), ['Earned by: Winner', 'Granted by: Leader'])
      stack = dropped
    }
  }
})

test('placement sync waits until vanilla has restored item data and ignores blocks removed before the tick', () => {
  const env = environment()
  const id = 'kubejs:trophy_tournament'
  const placed = new BlockEntity(id)
  var liveBlock = { id, entity: placed }
  var scheduled
  const event = {
    level: { hasChunkAt: () => true, getBlock: () => liveBlock },
    block: { pos: { immutable: () => 'position' } },
    server: { scheduleInTicks: (ticks, callback) => { assert.equal(ticks, 1); scheduled = callback } }
  }
  env.handlers.placed.get(id)(event)
  assert.equal(placed.synced, false)
  scheduled()
  assert.equal(placed.synced, true)
  placed.synced = false
  env.handlers.placed.get(id)(event)
  liveBlock = { id: 'minecraft:air', entity: null }
  scheduled()
  assert.equal(placed.synced, false)
})

test('legacy award lore upgrades on login and inventory changes while unrelated data and lore survive', () => {
  const env = environment()
  for (const id of ['kubejs:trophy_champion', 'kubejs:badge_league']) {
    const stack = new Stack(id)
    stack.set('lore', new Lore(['A special event', 'Earned by: OldWinner', 'Granted by: OldLeader'].map(text)))
    stack.set('custom', component(new Tag({ otherMod: 'preserved' })))
    var changed = false
    const inventory = { getContainerSize: () => 1, getItem: () => stack, setChanged: () => { changed = true } }
    const player = { getInventory: () => inventory }
    env.handlers.loggedIn({ player })
    assert.equal(changed, true)
    assert.deepEqual(values(recordOf(stack)), { grantedBy: 'OldLeader', grantedTo: 'OldWinner' })
    assert.equal(stack.get('custom').copyTag().getString('otherMod'), 'preserved')
    assert.deepEqual(Array.from(stack.get('lore').lines(), line => line.getString()),
      ['A special event', 'Earned by: OldWinner', 'Granted by: OldLeader'])
    changed = false
    env.handlers.inventoryChanged({ item: stack, player })
    assert.equal(changed, false)
    assert.equal(stack.get('lore').lines().length, 3)
  }
})

test('unawarded items and suppressed drops do not gain invented metadata or extra drops', () => {
  const env = environment()
  const trophy = new Stack('kubejs:trophy_champion')
  assert.equal(env.context.lccAwardMigrateItem(trophy), false)
  assert.equal(trophy.get('custom'), undefined)
  const items = [trophy]
  env.handlers.drops.get(trophy.id)({ block: { entity: new BlockEntity(trophy.id) }, items })
  assert.equal(trophy.get('custom'), undefined)
  const awarded = env.context.global.lccAwards.stamp(new Stack(trophy.id), actor('Leader'), actor('Winner'))
  env.handlers.drops.get(trophy.id)({
    block: { entity: new BlockEntity(trophy.id, awarded.get('block').copyTag().getCompound('data')) }, items: []
  })
  assert.equal(items.length, 1)
})

test('Jade ignores unrelated block/entity targets and reloads its callback without duplicate lines', () => {
  const env = environment()
  assert.deepEqual(tooltip(env, {}), [])
  assert.deepEqual(tooltip(env, new BlockAccessor({})), [])
  assert.deepEqual(tooltip(env, new BlockAccessor(new BlockEntity('kubejs:lumisene_furnace'))), [])
  assert.deepEqual(tooltip(env, new BlockAccessor(new BlockEntity('kubejs:trophy_champion'))), [])
  env.run('client_scripts/award_jade.js')
  assert.equal(env.callbacks.length, 1)
  const absent = environment(false)
  assert.equal(absent.callbacks.length, 0)
  assert.ok(absent.context.global.lccAwards.stamp)
})
