<template>
  <q-card flat bordered class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md">
    <!-- Month, user, and search controls with report exports -->
    <div class="row items-center justify-between q-mb-md">
      <div class="row items-center q-gutter-sm text-blue-grey-9">
        <q-icon :name="cfg.icon" size="22px" class="text-emerald-600" />
        <div class="text-subtitle1 text-bold">
          {{ isSuperAdmin ? 'All' : 'My' }} {{ cfg.title }}
        </div>
      </div>
      <div class="row items-center q-gutter-sm">
        <q-chip dense square class="bg-slate-100 text-slate-700">
          {{ visibleRows.length }} record{{ visibleRows.length === 1 ? '' : 's' }} ·
          {{ totalQty }} pcs
        </q-chip>
        <q-btn
          dense
          unelevated
          no-caps
          icon="grid_on"
          label="Excel"
          class="bg-emerald-600 text-white rounded-lg q-px-sm"
          :disable="!visibleRows.length"
          @click="exportReport('excel')"
        />
        <q-btn
          dense
          unelevated
          no-caps
          icon="picture_as_pdf"
          label="PDF"
          class="bg-blue-grey-9 text-white rounded-lg q-px-sm"
          :disable="!visibleRows.length"
          @click="exportReport('pdf')"
        />
      </div>
    </div>

    <div class="row q-col-gutter-x-md items-end q-mb-md" style="row-gap: 12px">
      <div class="col-12 col-sm-4">
        <q-select
          v-model="month"
          :options="monthOptions"
          label="Month"
          dense
          outlined
          emit-value
          map-options
          options-dense
          behavior="menu"
          popup-content-class="rounded-lg"
        >
          <template #prepend><q-icon name="calendar_month" size="18px" /></template>
        </q-select>
      </div>
      <div v-if="isSuperAdmin" class="col-12 col-sm-4">
        <q-select
          v-model="userFilter"
          :options="userOptions"
          label="User"
          dense
          outlined
          options-dense
          behavior="menu"
          popup-content-class="rounded-lg"
        >
          <template #prepend><q-icon name="person" size="18px" /></template>
        </q-select>
      </div>
      <div class="col-12" :class="isSuperAdmin ? 'col-sm-4' : 'col-sm-8'">
        <q-input v-model="search" dense outlined clearable placeholder="Search...">
          <template #prepend><q-icon name="search" size="18px" /></template>
        </q-input>
      </div>
    </div>

    <!-- Total value for the currently visible rows -->
    <div class="row items-center justify-between rounded-lg border border-slate-200 bg-slate-50 q-pa-sm q-px-md q-mb-md">
      <div class="row items-center q-gutter-sm text-slate-700">
        <q-icon name="payments" size="20px" class="text-emerald-600" />
        <span class="text-caption">Total product value (distributor price)</span>
      </div>
      <div class="text-subtitle1 text-bold text-blue-grey-9">{{ formatMoney(reportValue) }}</div>
    </div>

    <!-- Monthly records with search, sorting, and pagination -->
    <q-table
      v-model:pagination="pagination"
      flat
      dense
      row-key="key"
      :rows="visibleRows"
      :columns="columns"
      :loading="loading"
      :filter="search"
      :filter-method="filterRows"
      :rows-per-page-options="[10, 25, 50, 0]"
      table-header-class="bg-slate-100 text-slate-700"
      no-data-label="No records for this month"
    />
  </q-card>
</template>

<script setup>
// Dependencies for monthly data, pricing, and report exports.
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'src/boot/supabase'
import { useAuth } from 'stores/auth'
import { buildExportData, buildMeta, exportExcel, exportPdf } from 'src/utils/reportExport'
import { fetchPriceMap, totalValue, formatMoney } from 'src/utils/productValue'

// The report type selects the source table and displayed columns.
const props = defineProps({ type: { type: String, default: 'SHOP' } })

const $q = useQuasar()
const auth = useAuth()
const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')

// Per-type source table and column mapping
const CONFIG = {
  SHOP: { title: 'Shop Dispatches', icon: 'storefront', table: 'dispatches', dateCol: 'datecreated', userCol: 'createdby', filterType: 'SHOP' },
  DPC: { title: 'DPC Dispatches', icon: 'warehouse', table: 'dispatches', dateCol: 'datecreated', userCol: 'createdby', filterType: 'DPC' },
  PROMOS: { title: 'Promos', icon: 'redeem', table: 'promos', dateCol: 'date', userCol: 'addedby' },
  DEBTS: { title: 'Debts', icon: 'request_quote', table: 'debts', dateCol: 'date', userCol: 'addedby' },
  EXPIRY: { title: 'Expiries', icon: 'event_busy', table: 'expiry', dateCol: 'dateadded', userCol: 'modifiedby' },
}
const cfg = computed(() => CONFIG[props.type] || CONFIG.SHOP)

const pad = (n) => String(n).padStart(2, '0')
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

const monthOptions = computed(() => {
  const now = new Date()
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return {
      value: monthKey(d),
      label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    }
  })
})

const month = ref(monthKey(new Date()))
const rows = ref([])
const loading = ref(false)
const search = ref('')
const userFilter = ref('All users')
const productNames = ref({})
const pagination = ref({ sortBy: 'date', descending: false, rowsPerPage: 10 })

// Derive the visible rows, totals, and columns from the selected report.
const userOptions = computed(() => [
  'All users',
  ...new Set(rows.value.map((r) => r.user).filter(Boolean)),
])
const visibleRows = computed(() =>
  !isSuperAdmin.value || userFilter.value === 'All users'
    ? rows.value
    : rows.value.filter((r) => r.user === userFilter.value),
)
const totalQty = computed(() => visibleRows.value.reduce((s, r) => s + Number(r.quantity || 0), 0))
const prices = ref({})
const reportValue = computed(() => totalValue(visibleRows.value, prices.value))

const columns = computed(() => {
  const t = props.type
  const isTransfer = t === 'SHOP' || t === 'DPC'
  return [
    { name: 'date', label: 'Date', field: 'date', align: 'left', sortable: true },
    { name: 'from', label: isTransfer ? 'From' : 'Shop', field: 'from', align: 'left', sortable: true },
    isTransfer && { name: 'to', label: 'To', field: 'to', align: 'left', sortable: true },
    (t === 'PROMOS' || t === 'DEBTS') && { name: 'distributor', label: 'Distributor', field: 'distributor', align: 'left', sortable: true },
    { name: 'productname', label: 'Product', field: 'productname', align: 'left', sortable: true },
    { name: 'quantity', label: 'Qty', field: 'quantity', align: 'right', sortable: true },
    t === 'EXPIRY' && { name: 'expirydate', label: 'Expiry Date', field: 'expirydate', align: 'left', sortable: true },
    isSuperAdmin.value && { name: 'user', label: 'User', field: 'user', align: 'left', sortable: true },
  ].filter(Boolean)
})

// Match records against the table search text.
function filterRows(list, terms) {
  const needle = String(terms || '').toLowerCase()
  return list.filter((r) =>
    [r.productname, r.productcode, r.from, r.to, r.distributor, r.user]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle)),
  )
}

async function loadProductNames() {
  const { data } = await supabase.from('products').select('productcode, productname')
  productNames.value = Object.fromEntries((data || []).map((p) => [p.productcode, p.productname]))
}

function normalize(r, c, i) {
  return {
    key: r.id ?? `${i}-${r.productcode}`,
    date: String(r[c.dateCol] || '').slice(0, 10),
    from: r.from_location ?? r.shopcode ?? '',
    to: r.to_location ?? '',
    distributor: r.distributorname || r.distributoridno || '',
    productcode: r.productcode,
    productname: productNames.value[r.productcode] || r.productcode,
    quantity: r.quantity,
    expirydate: r.expirydate ? String(r.expirydate).slice(0, 10) : '',
    user: r[c.userCol] ?? '',
  }
}

async function fetchRows() {
  const c = cfg.value
  const username = auth.userDetails?.firstname
  if (!isSuperAdmin.value && !username) return

  const [y, m] = month.value.split('-').map(Number)
  const start = `${y}-${pad(m)}-01`
  const endExclusive = toISODate(new Date(y, m, 1))

  loading.value = true
  try {
    // Page through results: the API caps a single response at 1000 rows
    const pageSize = 1000
    const all = []
    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from(c.table)
        .select('*')
        .gte(c.dateCol, start)
        .lt(c.dateCol, endExclusive)
        .order(c.dateCol, { ascending: true })
        .range(from, from + pageSize - 1)
      if (c.filterType) query = query.eq('dispatchtype', c.filterType)
      if (!isSuperAdmin.value) query = query.eq(c.userCol, username)

      const { data, error } = await query
      if (error) throw error
      all.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
    rows.value = all.map((r, i) => normalize(r, c, i))
    userFilter.value = 'All users'
  } catch (err) {
    rows.value = []
    $q.notify({ type: 'negative', message: err.message || 'Failed to load report' })
  } finally {
    loading.value = false
  }
}

// Refresh the report when its type or month changes.
watch([() => props.type, month], fetchRows)

// Export exactly what the table shows (user filter, search and sort applied)
function exportReport(kind) {
  const { head, body } = buildExportData(
    columns.value,
    filterRows(visibleRows.value, search.value),
    pagination.value,
  )
  const [y, m] = month.value.split('-').map(Number)
  const from = `${y}-${pad(m)}-01`
  const to = toISODate(new Date(y, m, 0))
  const payload = {
    title: `${cfg.value.title} Report`,
    meta: buildMeta({
      from,
      to,
      printedBy: auth.userDetails?.firstname,
      extra: [
        ['User', isSuperAdmin.value ? userFilter.value : auth.userDetails?.firstname || ''],
        ['Records', body.length],
        ['Total Qty', totalQty.value],
        ['Total Value', formatMoney(reportValue.value)],
      ],
    }),
    filename: `${cfg.value.title.replace(/\s+/g, '_')}_${month.value}`,
    head,
    body,
  }
  if (kind === 'excel') exportExcel(payload)
  else exportPdf(payload)
}

// Load pricing, product labels, and the initial month on mount.
onMounted(async () => {
  prices.value = await fetchPriceMap()
  await loadProductNames()
  await fetchRows()
})

defineExpose({ refresh: fetchRows })
</script>
