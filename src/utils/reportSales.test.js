import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  distributorBvTotals,
  fetchClientPeriodBv,
  fetchDailySales,
  filterSalesByReceipt,
  periodBv,
  receiptNumber,
} from './reportSales.js'

const sales = [
  { receiptno: 'DPC12' + '001', distributoridno: 'A', salesdetails: [{ unitbv: 2, quantity: 3 }] },
  { receiptno: 'DPC12' + '002', distributoridno: 'a', salesdetails: [{ unitbv: 1.5, quantity: 2 }] },
  { receiptno: 'DPC12' + '010', distributoridno: 'B', salesdetails: [{ unitbv: 4, quantity: 1 }] },
]

test('receipt ranges exclude digits in the DPC prefix and include both endpoints', () => {
  assert.equal(receiptNumber('DPC12002', 'DPC12'), 2)
  assert.deepEqual(filterSalesByReceipt(sales, 'DPC12', '2', '10'), sales.slice(1))
  assert.deepEqual(filterSalesByReceipt(sales, 'DPC12', '', ''), sales)
  assert.deepEqual(filterSalesByReceipt(sales, 'DPC12', '2', ''), sales.slice(1))
  assert.deepEqual(filterSalesByReceipt(sales, 'DPC12', '', '2'), sales.slice(0, 2))
  assert.deepEqual(filterSalesByReceipt(sales, 'DPC12', 'x', ''), [])
})

test('period and client totals include every receipt regardless of receipt filter or page', () => {
  const totals = distributorBvTotals(sales)
  assert.equal(totals.get('A'), 9)
  assert.equal(totals.get('B'), 4)
  assert.equal(periodBv(sales), 13)
  const visible = filterSalesByReceipt(sales, 'DPC12', '2', '10').slice(0, 1)
  assert.equal(periodBv(visible), 3)
  assert.equal(totals.get('A'), 9)
  const newSale = { distributoridno: ' a ', salesdetails: [{ unitbv: '2.5', quantity: '2' }] }
  assert.equal(distributorBvTotals([...sales, newSale]).get('A'), 14)
  assert.equal(periodBv([...sales, newSale]), 18)
})

test('daily sales fetch includes the full end date and all server-capped pages', async () => {
  const records = Array.from({ length: 1205 }, (_, i) => ({ receiptno: `R${i}` }))
  const ranges = []
  const filters = []
  const query = {
    select(fields, options) { assert.match(fields, /salesdetails/); assert.equal(options.count, 'exact'); return this },
    gte(field, value) { filters.push([field, value]); return this },
    lt(field, value) { filters.push([field, value]); return this },
    eq(field, value) { filters.push([field, value]); return this },
    order(field) { assert.equal(field, 'receiptindex'); return this },
    range(start, end) {
      ranges.push([start, end])
      return Promise.resolve({ data: records.slice(start, Math.min(end + 1, start + 500)), count: records.length, error: null })
    },
  }
  const client = { from(table) { assert.equal(table, 'salesheader'); return query } }
  const result = await fetchDailySales(client, '2024-02-01', '2024-02-29', 'SHOP')
  assert.deepEqual(result, records)
  assert.deepEqual(ranges, [[0, 999], [500, 1499], [1000, 1999]])
  assert.deepEqual(filters.slice(0, 3), [
    ['salesdate', '2024-02-01'],
    ['salesdate', '2024-03-01'],
    ['dpccode', 'SHOP'],
  ])
})

test('client BV reads purchases from all shops for the whole selected period', async () => {
  const filters = []
  const records = [
    { salesdetails: [{ unitbv: 2, quantity: 3 }] },
    { salesdetails: [{ unitbv: 4, quantity: 2 }] },
  ]
  const query = {
    select(fields, options) { assert.equal(fields, 'salesdetails(unitbv, quantity)'); assert.equal(options.count, 'exact'); return this },
    gte(field, value) { filters.push([field, value]); return this },
    lt(field, value) { filters.push([field, value]); return this },
    ilike(field, value) { filters.push([field, value]); return this },
    order(field) { assert.equal(field, 'receiptindex'); return this },
    range(start) { return Promise.resolve({ data: records.slice(start, start + 1), count: 2, error: null }) },
  }
  assert.equal(await fetchClientPeriodBv({ from: () => query }, '2026-01-01', '2026-01-31', 'A_1'), 14)
  assert.deepEqual(filters.slice(0, 3), [
    ['salesdate', '2026-01-01'],
    ['salesdate', '2026-02-01'],
    ['distributoridno', 'A\\_1'],
  ])
})

test('daily sales fetch surfaces errors and incomplete results', async () => {
  const query = {
    select() { return this },
    gte() { return this },
    lt() { return this },
    eq() { return this },
    order() { return this },
    range() { return Promise.resolve({ data: [], count: 1, error: null }) },
  }
  await assert.rejects(fetchDailySales({ from: () => query }, '2026-01-01', '2026-01-31', 'SHOP'), /Unable to load all/)
  query.range = () => Promise.resolve({ data: null, count: null, error: new Error('query failed') })
  await assert.rejects(fetchDailySales({ from: () => query }, '2026-01-01', '2026-01-31', 'SHOP'), /query failed/)
})

test('client BV fetch surfaces incomplete pages instead of displaying a partial total', async () => {
  const query = {
    select() { return this },
    gte() { return this },
    lt() { return this },
    ilike() { return this },
    order() { return this },
    range() { return Promise.resolve({ data: [], count: 1, error: null }) },
  }
  await assert.rejects(
    fetchClientPeriodBv({ from: () => query }, '2026-01-01', '2026-01-31', 'A'),
    /Unable to load all client sales/,
  )
})
