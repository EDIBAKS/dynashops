export async function fetchStockQuantities(supabase, tableName, productCodes) {
  const quantities = new Map()
  if (!productCodes.length) return quantities
  let offset = 0
  let count
  do {
    const { data, error, count: total } = await supabase
      .from(tableName)
      .select('productcode, quantity', { count: 'exact' })
      .in('productcode', productCodes)
      .order('productcode')
      .order('quantity')
      .range(offset, offset + 999)
    if (error) throw new Error(`Unable to read ${tableName}: ${error.message}`)
    if (total == null || (!data?.length && offset < total)) {
      throw new Error(`Unable to load all stock from ${tableName}`)
    }
    count = total
    for (const row of data || []) {
      const quantity = Number(row.quantity)
      if (!Number.isFinite(quantity) || row.quantity == null) {
        throw new Error(`Invalid stock quantity in ${tableName} for ${row.productcode}`)
      }
      quantities.set(row.productcode, (quantities.get(row.productcode) || 0) + quantity)
    }
    offset += data?.length || 0
  } while (offset < count)
  return quantities
}
