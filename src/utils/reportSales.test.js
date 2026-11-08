import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distributorBvTotals, filterSalesByReceipt, receiptNumber } from './reportSales.js'

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

test('client totals include all matching receipts, irrespective of pagination or ID case', () => {
  const totals = distributorBvTotals(sales)
  assert.equal(totals.get('A'), 9)
  assert.equal(totals.get('B'), 4)
  assert.equal(distributorBvTotals(filterSalesByReceipt(sales, 'DPC12', '2', '10')).get('A'), 3)
})
