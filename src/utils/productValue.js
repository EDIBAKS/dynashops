import { supabase } from 'src/boot/supabase'

// productcode -> distributor price
// Load distributor prices indexed by product code.
export async function fetchPriceMap() {
  const { data } = await supabase.from('products').select('productcode, distributorprice')
  return Object.fromEntries((data || []).map((p) => [p.productcode, Number(p.distributorprice) || 0]))
}

// Calculate the extended value across all rows.
export function totalValue(rows, prices) {
  return rows.reduce((s, r) => s + Number(r.quantity || 0) * (prices[r.productcode] || 0), 0)
}

// Format a value with two fractional digits for display.
export const formatMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
