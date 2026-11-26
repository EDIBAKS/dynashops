function receiptParts(receipt, dpc = '') {
  const value = String(receipt || '').trim().toUpperCase()
  const prefix = String(dpc || '').trim().toUpperCase()
  const suffix = prefix && value.startsWith(prefix) ? value.slice(prefix.length) : value
  const match = /^([A-Z]*)(\d+)$/.exec(suffix)
  return match ? { series: match[1], number: Number(match[2]) } : null
}

export function validReceiptSuffix(value) {
  return !value || /^[A-Z]*\d+$/i.test(value)
}

export function receiptNumber(receipt, dpc) {
  const parts = receiptParts(receipt, dpc)
  return parts && !parts.series ? parts.number : null
}

function compareReceiptParts(a, b) {
  if (a.series !== b.series) return a.series < b.series ? -1 : 1
  return a.number - b.number
}

export function compareReceipts(a, b, dpc) {
  const first = receiptParts(a, dpc)
  const second = receiptParts(b, dpc)
  if (!first || !second) return first ? 1 : second ? -1 : 0
  return compareReceiptParts(first, second)
}

export function filterSalesByReceipt(sales, dpc, from, to) {
  if (!validReceiptSuffix(from) || !validReceiptSuffix(to)) return []
  const lower = from ? receiptParts(from) : null
  const upper = to ? receiptParts(to) : null
  return sales.filter((sale) => {
    if (lower === null && upper === null) return true
    const receipt = receiptParts(sale.receiptno, dpc)
    return receipt !== null &&
      (lower && upper || receipt.series === (lower || upper).series) &&
      (lower === null || compareReceiptParts(receipt, lower) >= 0) &&
      (upper === null || compareReceiptParts(receipt, upper) <= 0)
  })
}

export function filterDailySales(sales, receipt, date) {
  const search = String(receipt || '').trim().toUpperCase()
  return sales.filter((sale) =>
    (!search || String(sale.receiptno || '').toUpperCase().includes(search)) &&
    (!date || String(sale.salesdate || '').slice(0, 10) === date),
  )
}

export function saleBv(sale) {
  return (sale.salesdetails || []).reduce(
    (sum, item) => sum + Number(item.unitbv || 0) * Number(item.quantity || 0),
    0,
  )
}

export function periodBv(sales) {
  return sales.reduce((sum, sale) => sum + saleBv(sale), 0)
}

export function distributorBvTotals(sales) {
  const totals = new Map()
  for (const sale of sales) {
    const id = String(sale.distributoridno || '').trim().toUpperCase()
    if (!id) continue
    totals.set(id, (totals.get(id) || 0) + saleBv(sale))
  }
  return totals
}

function nextDate(end) {
  const endDate = new Date(`${end}T00:00:00Z`)
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  return endDate.toISOString().slice(0, 10)
}

export async function fetchDailySales(supabase, start, end, dpc) {
  const endExclusive = nextDate(end)
  const sales = []
  const pageSize = 1000
  let count

  do {
    const { data, error, count: total } = await supabase
      .from('salesheader')
      .select(
        'receiptno, distributoridno, salesdate, createdby, dpccode, status,lastmodified, salesdetails(productcode, unitprice, unitbv, quantity)',
        { count: 'exact' },
      )
      .gte('salesdate', start)
      .lt('salesdate', endExclusive)
      .eq('dpccode', dpc)
      .order('receiptindex', { ascending: true })
      .range(sales.length, sales.length + pageSize - 1)

    if (error) throw error
    if (total === null || total === undefined) throw new Error('Unable to count daily sales')
    count = total
    if (!data?.length && sales.length < count) throw new Error('Unable to load all daily sales')
    sales.push(...(data || []))
  } while (sales.length < count)

  return sales
}

export async function fetchClientPeriodBv(supabase, start, end, distributorId) {
  let totalBv = 0
  let offset = 0
  let count
  const pattern = distributorId.replace(/[\\%_]/g, '\\$&')

  do {
    const { data, error, count: total } = await supabase
      .from('salesheader')
      .select('salesdetails(unitbv, quantity)', { count: 'exact' })
      .gte('salesdate', start)
      .lt('salesdate', nextDate(end))
      .ilike('distributoridno', pattern)
      .order('receiptindex', { ascending: true })
      .range(offset, offset + 999)

    if (error) throw error
    if (total === null || total === undefined) throw new Error('Unable to count client sales')
    count = total
    if (!data?.length && offset < count) throw new Error('Unable to load all client sales')
    totalBv += periodBv(data || [])
    offset += data?.length || 0
  } while (offset < count)

  return totalBv
}

export async function loadClientPeriodBvs(supabase, start, end, sales, { isActive, onResult }) {
  const clients = [...new Set(sales
    .map((sale) => String(sale.distributoridno || '').trim().toUpperCase())
    .filter(Boolean))]

  for (let i = 0; i < clients.length && isActive(); i += 5) {
    await Promise.all(clients.slice(i, i + 5).map(async (id) => {
      let result
      try {
        const value = await fetchClientPeriodBv(supabase, start, end, id)
        result = { status: 'ready', value }
      } catch (error) {
        result = { status: 'error', error }
      }
      if (isActive()) onResult(id, result)
    }))
  }
}
