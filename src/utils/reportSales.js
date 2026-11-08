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
