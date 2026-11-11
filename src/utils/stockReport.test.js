import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchStockQuantities } from './stockReport.js'

function clientFor(responses) {
  const ranges = []
  const query = {
    select(fields, options) { assert.equal(fields, 'productcode, quantity'); assert.equal(options.count, 'exact'); return this },
    in(field, values) { assert.equal(field, 'productcode'); assert.deepEqual(values, ['A', 'B']); return this },
    order() { return this },
    range(start, end) { ranges.push([start, end]); return Promise.resolve(responses.shift()) },
  }
  return { client: { from: () => query }, ranges }
}

test('stock report sums product rows across server-capped pages', async () => {
  const { client, ranges } = clientFor([
    { data: [{ productcode: 'A', quantity: 3 }], count: 3, error: null },
    { data: [{ productcode: 'A', quantity: 4 }], count: 3, error: null },
    { data: [{ productcode: 'B', quantity: 2 }], count: 3, error: null },
  ])
  assert.deepEqual([...await fetchStockQuantities(client, 'SHOP_STOCK', ['A', 'B'])], [['A', 7], ['B', 2]])
  assert.deepEqual(ranges, [[0, 999], [1, 1000], [2, 1001]])
})

test('stock report fails visibly on errors, incomplete pages and invalid quantities', async () => {
  for (const response of [
    { data: null, count: null, error: { message: 'denied' } },
    { data: [], count: 1, error: null },
    { data: [{ productcode: 'A', quantity: null }], count: 1, error: null },
  ]) {
    const { client } = clientFor([response])
    await assert.rejects(fetchStockQuantities(client, 'SHOP_STOCK', ['A', 'B']))
  }
})
