export function receiptNumber(receipt, dpc) {
  const value = String(receipt || '').trim().toUpperCase()
  const prefix = String(dpc || '').trim().toUpperCase()
  const suffix = prefix && value.startsWith(prefix) ? value.slice(prefix.length) : value
  return /^\d+$/.test(suffix) ? Number(suffix) : null
}

export function filterSalesByReceipt(sales, dpc, from, to) {
  if ((from && !/^\d+$/.test(from)) || (to && !/^\d+$/.test(to))) return []
  const lower = /^\d+$/.test(from) ? Number(from) : null
  const upper = /^\d+$/.test(to) ? Number(to) : null
  return sales.filter((sale) => {
    if (lower === null && upper === null) return true
    const number = receiptNumber(sale.receiptno, dpc)
    return number !== null && (lower === null || number >= lower) && (upper === null || number <= upper)
  })
}

export function distributorBvTotals(sales) {
  const totals = new Map()
  for (const sale of sales) {
    const id = String(sale.distributoridno || '').trim().toUpperCase()
    if (!id) continue
    const bv = (sale.salesdetails || []).reduce(
      (sum, item) => sum + Number(item.unitbv || 0) * Number(item.quantity || 0),
      0,
    )
    totals.set(id, (totals.get(id) || 0) + bv)
  }
  return totals
}
