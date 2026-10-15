import { supabase } from 'src/boot/supabase'

const knownGbv = (n) => n.gbv ?? n.group_bv ?? n.out_gbv ?? null

// Make sure every node carries a numeric `gbv` so siblings can be sorted by it.
// By default it is always computed with compute_group_bv: RPC row fields are not reliable.
export async function withGbv(nodes, startDate, endDate, { trustRowValue = false } = {}) {
  const result = []
  const chunkSize = 10
  for (let i = 0; i < nodes.length; i += chunkSize) {
    const part = await Promise.all(
      nodes.slice(i, i + chunkSize).map(async (n) => {
        const known = trustRowValue ? knownGbv(n) : null
        if (known != null) return { ...n, gbv: Number(known) }
        const { data, error } = await supabase.rpc('compute_group_bv', {
          p_distributor: n.out_distributoridno,
          p_date_from: startDate,
          p_date_to: endDate,
        })
        return { ...n, gbv: error ? null : Number(data ?? 0) }
      }),
    )
    result.push(...part)
  }
  return result
}

const nameOf = (n) => String(n.distributorname ?? n.out_distributorname ?? '')
const pbvOf = (n) => Number(n.personal_bv ?? n.out_pbv ?? 0)
const gbvOf = (n) => Number(knownGbv(n) ?? 0)

// Sort sibling nodes by the selected hierarchy metric.
export function sortNodes(nodes, key = 'name', descending = false) {
  const dir = descending ? -1 : 1
  return [...nodes].sort((a, b) => {
    if (key === 'pbv') return (pbvOf(a) - pbvOf(b)) * dir
    if (key === 'gbv') return (gbvOf(a) - gbvOf(b)) * dir
    if (key === 'members') return (Number(a.total_members ?? 0) - Number(b.total_members ?? 0)) * dir
    return nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' }) * dir
  })
}

// Flatten the tree in on-screen order: every level sorted, only loaded (expanded) branches included
export function flattenTree(roots, cache, sortBy, descending, level = 1, out = []) {
  const childSort = sortBy === 'members' ? 'name' : sortBy
  for (const n of roots) {
    out.push({
      level,
      id: n.out_distributoridno ?? '',
      name: nameOf(n),
      pbv: pbvOf(n),
      gbv: gbvOf(n),
    })
    const kids = cache?.[n.out_distributoridno]
    if (kids?.length) flattenTree(sortNodes(kids, childSort, descending), cache, sortBy, descending, level + 1, out)
  }
  return out
}

// Build a compact avatar label from the distributor name.
export const nodeInitials = (n) =>
  nameOf(n)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?'
