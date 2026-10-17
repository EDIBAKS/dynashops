<template>
  <q-page class="q-pa-md">
    <q-card flat class="q-pa-md" style="max-width: 1200px; margin: 0 auto">
      <!-- DISPATCH TYPE -->
      <div class="row items-center justify-center q-mb-md">
        <q-option-group v-model="dispatchType" :options="dispatchTypes" inline type="radio" />
      </div>

      <!-- FROM / TO SELECTION -->
      <div class="row no-wrap items-stretch q-col-gutter-sm full-width">
        <div class="col">
          <q-select
            v-if="isAdminOrSuperAdmin"
            v-model="fromValue"
            :options="fromOptions"
            option-label="label"
            option-value="value"
            emit-value
            map-options
            label="From"
            options-dense
            behavior="menu"
            popup-content-class="rounded-lg"
            dense
            outlined
            class="full-width"
            @update:model-value="loadToOptions"
          />

          <q-input
            v-else
            v-model="fromValue"
            label="Your DPC"
            outlined
            dense
            readonly
            input-class="text-blue text-bold text-center"
          />
        </div>

        <div class="col">
          <!-- Admin / SuperAdmin -->
          <q-select
            v-if="isAdminOrSuperAdmin"
            v-model="toValue"
            :options="toOptions"
            option-label="label"
            option-value="value"
            emit-value
            map-options
            label="To"
            options-dense
            behavior="menu"
            popup-content-class="rounded-lg"
            dense
            outlined
            class="full-width"
          />

          <!-- Normal user -->
          <q-input v-else v-model="toValue" label="To" dense outlined class="full-width" disable />
        </div>
      </div>

      <!-- DATE FILTERS -->
      <div class="row q-col-gutter-sm q-mt-md">
        <div class="col">
          <q-input
            v-model="startDate"
            type="date"
            label="Start Date"
            dense
            outlined
            class="full-width"
          />
        </div>
        <div class="col">
          <q-input
            v-model="endDate"
            type="date"
            label="End Date"
            dense
            outlined
            class="full-width"
          />
        </div>
      </div>

      <!-- ACTION BUTTONS -->
      <div class="row justify-end items-center q-mt-md q-gutter-sm">
        <q-btn
          unelevated
          no-caps
          rounded
          color="blue-grey-9"
          text-color="white"
          icon="search"
          label="Fetch Dispatches"
          :loading="loading"
          @click="fetchDispatches"
        />
        <q-btn-dropdown
          outline
          no-caps
          rounded
          color="blue-grey-8"
          icon="file_download"
          label="Export"
          :disable="!dispatchesByDate.length"
        >
          <q-list style="min-width: 190px">
            <q-item clickable v-close-popup @click="exportToExcel">
              <q-item-section avatar><q-icon name="table_view" color="green-8" /></q-item-section>
              <q-item-section>Excel (.xlsx)</q-item-section>
            </q-item>
            <q-separator />
            <q-item clickable v-close-popup @click="exportToPDF">
              <q-item-section avatar>
                <q-icon name="picture_as_pdf" color="red-8" />
              </q-item-section>
              <q-item-section>PDF</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>

      <!-- REPORT FILTERS (applied to the fetched results, also used by exports) -->
      <div v-if="dispatches.length" class="row q-col-gutter-sm q-mt-md items-center">
        <div class="col-12 col-sm-4">
          <q-select
            v-model="filterProduct"
            :options="productFilterOptions"
            label="Product"
            options-dense
            behavior="menu"
            popup-content-class="rounded-lg"
            dense
            outlined
            clearable
            use-input
            input-debounce="0"
            emit-value
            map-options
            @filter="filterProductOptions"
          >
            <template #prepend><q-icon name="inventory_2" size="18px" /></template>
          </q-select>
        </div>
        <div class="col-12 col-sm-4">
          <q-select
            v-model="filterUser"
            :options="userOptions"
            label="Dispatched by"
            options-dense
            behavior="menu"
            popup-content-class="rounded-lg"
            dense
            outlined
            clearable
          >
            <template #prepend><q-icon name="person" size="18px" /></template>
          </q-select>
        </div>
        <div class="col-12 col-sm-4">
          <q-select
            v-model="sortBy"
            :options="sortOptions"
            label="Sort by"
            options-dense
            behavior="menu"
            popup-content-class="rounded-lg"
            dense
            outlined
            emit-value
            map-options
          >
            <template #prepend><q-icon name="sort" size="18px" /></template>
          </q-select>
        </div>
        <div class="col-12 text-caption text-grey-7">
          Showing {{ filteredDispatches.length }} of {{ dispatches.length }} dispatches
          <q-btn
            v-if="filterProduct || filterUser"
            flat
            dense
            no-caps
            size="sm"
            color="blue-grey-8"
            label="Clear filters"
            class="q-ml-sm"
            @click="clearFilters"
          />
        </div>
      </div>

      <!-- GROUP BY DATE TOGGLE -->
      <div v-if="dispatchesByDate.length" class="text-center q-mt-lg q-mb-sm">
        <q-toggle v-model="groupByDate" label="Group by Date" color="primary" dense />
      </div>

      <!-- DISPATCH LIST -->
      <div v-if="dispatchesByDate.length" class="q-mt-md">
        <div v-for="group in dispatchesByDate" :key="group.date" class="q-mb-lg">
          <div v-if="group.date" class="text-uppercase text-bold text-primary q-mb-sm">
            {{ group.date }}
          </div>

          <q-separator class="q-mb-sm" />

          <q-list bordered padding class="bg-grey-1">
            <template v-for="row in group.rows" :key="row.id">
              <q-item>
                <q-item-section>
                  <div class="text-subtitle2 text-bold">
                    {{ row.productcode }} - {{ row.productname }}
                  </div>

                  <div class="row items-center q-gutter-sm">
                    <q-avatar size="35px" class="bg-black text-white flex flex-center">
                      <span class="text-caption font-bold">
                        {{ row.quantity }}
                      </span>
                    </q-avatar>

                    <div class="text-caption">
                      DP: {{ row.distributorprice.toLocaleString() }} | Value:
                      {{ row.totalValue.toLocaleString() }}
                    </div>
                  </div>

                  <div class="text-caption">
                    From: {{ row.fromName }} → To: {{ row.toName }} | By: {{ row.createdby }} |
                    Type: {{ row.dispatchtype }}
                  </div>

                  <div class="row items-center q-gutter-xs q-mt-xs">
                    <q-chip dense square outline color="blue-grey-7" icon="warehouse">
                      {{ row.fromName }} stock: {{ stockOf(row.from_location, row.productcode) }}
                    </q-chip>
                    <q-chip
                      dense
                      square
                      outline
                      :color="isInsufficient(row) ? 'negative' : 'blue-grey-7'"
                      :icon="isInsufficient(row) ? 'warning' : 'storefront'"
                    >
                      {{ row.toName }} stock: {{ stockOf(row.to_location, row.productcode) }}
                      <span v-if="isInsufficient(row)" class="q-ml-xs text-bold">
                        · Insufficient (need {{ row.quantity }})
                      </span>
                    </q-chip>
                  </div>
                </q-item-section>

                <q-item-section side top v-if="isAdminOrSuperAdmin">
                  <q-btn
                    dense
                    unelevated
                    no-caps
                    size="sm"
                    icon="replay"
                    label="Reverse"
                    color="blue-grey-8"
                    text-color="white"
                    class="q-px-sm"
                    :disable="loading || isInsufficient(row)"
                    @click="confirmReturn(row)"
                  >
                    <q-tooltip v-if="isInsufficient(row)">
                      Insufficient stock in {{ row.toName }} to reverse
                    </q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>

              <!-- Separator after each row -->
              <q-separator inset />
            </template>
          </q-list>
        </div>
      </div>

      <div v-else class="text-center q-mt-md text-grey">No dispatch records found.</div>
    </q-card>
  </q-page>
</template>

<script setup>
// Dependencies for dispatch queries, user context, and report exports.
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from 'boot/supabase'
import { logActivity, ACTIVITY_TYPES } from 'src/utils/activityLog'
import { useAuth } from 'stores/auth'
import { useQuasar } from 'quasar'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const auth = useAuth()
const $q = useQuasar()

// STATE
const dispatchType = ref('P2S')
const groupByDate = ref(true)
const fromOptions = ref([])
const toOptions = ref([])
const fromValue = ref(null)
const toValue = ref(null)
const startDate = ref(null)
const endDate = ref(null)
const dispatches = ref([])
const productsMap = ref({})
const loading = ref(false)

const isAdmin = computed(() => auth.userDetails?.role === 'Admin')
const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')
const isAdminOrSuperAdmin = computed(() => isAdmin.value || isSuperAdmin.value)

const dispatchTypes = computed(() =>
  isAdminOrSuperAdmin.value
    ? [
        { label: 'Province → Shop', value: 'P2S' },
        { label: 'Province → Province', value: 'P2P' },
      ]
    : [{ label: 'Shop Dispatches', value: 'SHOP' }],
)

// --- FETCH PRODUCTS ---
async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('productcode, productname, distributorprice')
  if (!error) productsMap.value = data.reduce((acc, p) => ({ ...acc, [p.productcode]: p }), {})
}

// --- FETCH PROVINCES & SHOPS ---
async function fetchProvinces() {
  const { data } = await supabase
    .from('province')
    .select('name, province_code')
    .eq('country_code', auth.userDetails?.country_code)
  fromOptions.value = data.map((p) => ({ label: p.name, value: p.province_code }))
}

async function fetchShops(province_code) {
  const { data } = await supabase
    .from('shops')
    .select('shop_name, shopcode')
    .eq('province_code', province_code)
  toOptions.value = data.map((s) => ({ label: s.shop_name, value: s.shopcode }))
}

function resolveToLocation() {
  if (dispatchType.value === 'P2S') {
    return `${toValue.value}_STOCK`
  }
  return toValue.value
}
function resolveReturnToTable(row) {
  if (dispatchType.value === 'SHOP') {
    return `${row.from_location}_STOCK`
  }
  return row.from_location
}

async function loadToOptions() {
  // Province changed: drop the old destination and any results tied to it
  toValue.value = null
  toOptions.value = []
  dispatches.value = []
  clearFilters()
  if (!fromValue.value) return

  if (dispatchType.value === 'P2P') {
    // Province → Province
    toOptions.value = fromOptions.value.filter((p) => p.value !== fromValue.value)
  }

  if (dispatchType.value === 'P2S') {
    // Province → Shop
    await fetchShops(fromValue.value)
  }
}

async function fetchDispatches() {
  if (!fromValue.value || !toValue.value) {
    $q.notify({ type: 'negative', message: 'Select FROM and TO locations.' })
    return
  }

  if (!startDate.value || !endDate.value) {
    $q.notify({ type: 'negative', message: 'Select start and end dates.' })
    return
  }

  // 🔎 LOG EXACT VALUES BEING SENT
  console.log('📤 FETCH DISPATCHES PARAMS')
  console.log('FROM:', fromValue.value)
  console.log('TO:', toValue.value)
  console.log('START DATE:', startDate.value)
  console.log('END DATE:', endDate.value)

  loading.value = true
  try {
    const { data, error } = await supabase.rpc('fetch_dispatches_by_location_and_date', {
      p_from_location: fromValue.value,
      p_to_location: resolveToLocation(),
      p_start_date: startDate.value,
      p_end_date: endDate.value,
    })

    if (error) throw error

    //console.log('📥 RAW DISPATCHES RETURNED:', data)

    dispatches.value = data.map((d) => {
      const product = productsMap.value[d.productcode] || {}

      return {
        ...d,
        productname: product.productname || d.productcode,
        distributorprice: Number(product.distributorprice) || 0,
        totalValue: (Number(product.distributorprice) || 0) * Number(d.quantity || 0),
        fromName:
          fromOptions.value.find((p) => p.value === d.from_location)?.label || d.from_location,
        toName: toOptions.value.find((p) => p.value === d.to_location)?.label || d.to_location,
      }
    })

    if (!dispatches.value.length) {
      $q.notify({ type: 'info', message: 'No dispatches found.' })
    }
    await loadStockLevels()
  } catch (err) {
    console.error('❌ fetchDispatches error:', err)
    $q.notify({
      type: 'negative',
      message: err.message || 'Failed to fetch dispatches.',
    })
  } finally {
    loading.value = false
  }
}

// --- STOCK LEVELS (current quantity per location + product) ---
const stockLevels = ref({})

function stockOf(location, productcode) {
  return stockLevels.value[`${location}|${productcode}`] ?? 0
}

function isInsufficient(row) {
  return stockOf(row.to_location, row.productcode) < Number(row.quantity)
}

async function loadStockLevels() {
  const byTable = {}
  dispatches.value.forEach((d) => {
    ;[d.from_location, d.to_location].forEach((t) => {
      if (!t) return
      byTable[t] = byTable[t] || new Set()
      byTable[t].add(d.productcode)
    })
  })

  const levels = {}
  await Promise.all(
    Object.entries(byTable).map(async ([table, codes]) => {
      const { data, error } = await supabase
        .from(table)
        .select('productcode, quantity')
        .in('productcode', [...codes])
      if (error) {
        console.error(`Stock lookup failed for ${table}:`, error)
        return
      }
      data.forEach((r) => {
        const key = `${table}|${r.productcode}`
        levels[key] = (levels[key] || 0) + Number(r.quantity || 0)
      })
    }),
  )
  stockLevels.value = levels
}

// --- FILTERS & SORTING ---
const filterProduct = ref(null)
const filterUser = ref(null)
const sortBy = ref('date_asc')
const productSearch = ref('')

const sortOptions = [
  { label: 'Date (oldest first)', value: 'date_asc' },
  { label: 'Date (newest first)', value: 'date_desc' },
  { label: 'Product (A–Z)', value: 'product' },
  { label: 'User (A–Z)', value: 'user' },
  { label: 'Quantity (high → low)', value: 'qty_desc' },
]

const allProductOptions = computed(() => {
  const seen = new Map()
  dispatches.value.forEach((d) => seen.set(d.productcode, `${d.productcode} - ${d.productname}`))
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
})

const productFilterOptions = computed(() => {
  const q = productSearch.value.trim().toLowerCase()
  return q
    ? allProductOptions.value.filter((o) => o.label.toLowerCase().includes(q))
    : allProductOptions.value
})

function filterProductOptions(val, update) {
  update(() => {
    productSearch.value = val
  })
}

const userOptions = computed(() =>
  [...new Set(dispatches.value.map((d) => d.createdby).filter(Boolean))].sort(),
)

function clearFilters() {
  filterProduct.value = null
  filterUser.value = null
}

const filteredDispatches = computed(() => {
  const rows = dispatches.value.filter(
    (d) =>
      (!filterProduct.value || d.productcode === filterProduct.value) &&
      (!filterUser.value || d.createdby === filterUser.value),
  )

  const cmp = {
    date_asc: (a, b) => String(a.datecreated).localeCompare(String(b.datecreated)),
    date_desc: (a, b) => String(b.datecreated).localeCompare(String(a.datecreated)),
    product: (a, b) => String(a.productname).localeCompare(String(b.productname)),
    user: (a, b) => String(a.createdby || '').localeCompare(String(b.createdby || '')),
    qty_desc: (a, b) => Number(b.quantity) - Number(a.quantity),
  }[sortBy.value]

  return [...rows].sort(cmp)
})

// --- GROUP BY DATE ---
const dispatchesByDate = computed(() => {
  const map = {}

  filteredDispatches.value.forEach((d) => {
    // ✅ use DB date, no JS Date()
    const dateKey = d.datecreated.split('T')[0]

    if (!map[dateKey]) map[dateKey] = []
    map[dateKey].push(d)
  })

  return Object.keys(map)
    .sort() // ascending like your SQL
    .map((date) => ({
      date,
      rows: map[date],
    }))
})

// --- RETURN PROCESS ---
async function processReturn(row) {
  const dismiss = $q.notify({
    message: `Processing return of ${row.quantity} × ${row.productname}...`,
    color: 'info',
    timeout: 0,
    spinner: true,
  })

  try {
    const toTable = resolveReturnToTable(row)

    const { error } = await supabase.rpc('return_dispatch', {
      p_dispatch_id: row.id,
      p_from_table: row.to_location,
      p_to_table: toTable,
      p_productcode: row.productcode,
      p_quantity: Number(row.quantity),
      p_createdby: `${auth.userDetails.firstname} ${auth.userDetails.lastname}`,
    })

    if (error) throw error

    logActivity(ACTIVITY_TYPES.DISPATCH_REVERSAL, {
      reference: String(row.id),
      description: `Dispatch reversed: ${row.quantity} × ${row.productname} returned from ${row.to_location} to ${toTable}`,
    })

    dispatches.value = dispatches.value.filter((d) => d.id !== row.id)
    await loadStockLevels()

    dismiss() // ✅ stop spinner immediately
    $q.notify({ message: 'Return successful.', color: 'positive' })
  } catch (err) {
    dismiss() // ✅ stop spinner on failure
    console.error(err)
    $q.notify({
      message: err.message || 'Return failed',
      color: 'negative',
    })
  }
}

function confirmReturn(row) {
  if (!isSuperAdmin.value) {
    $q.notify({
      type: 'warning',
      message: 'Only Super Admins can perform return operations.',
      position: 'top',
    })
    return
  }

  // existing confirmation dialog / logic continues here
  $q.dialog({
    title: 'Confirm Return',
    message: `Return ${row.quantity} × ${row.productname}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    processReturn(row)
  })
}

// --- ON MOUNT ---
watch(dispatchType, () => {
  if (isAdminOrSuperAdmin.value) loadToOptions()
})

onMounted(async () => {
  await fetchProvinces()
  await fetchProducts()
  if (!isAdminOrSuperAdmin.value) {
    fromValue.value = auth.userDetails?.province_code
    toValue.value = auth.userDetails?.dpc_id
    await fetchShops(auth.userDetails?.province_code)
  }
})

function exportToExcel() {
  if (!dispatchesByDate.value.length) return

  const sheetData = []

  // 🔹 Header
  sheetData.push([
    `From: ${dispatchesByDate.value[0].rows[0].fromName} → ${dispatchesByDate.value[0].rows[0].toName}`,
  ])
  sheetData.push([`Start Date: ${startDate.value} | End Date: ${endDate.value}`])
  sheetData.push([`Printed On: ${new Date().toLocaleString()}`])
  sheetData.push([])

  // 🔹 Table content grouped by date
  dispatchesByDate.value.forEach((group) => {
    sheetData.push([group.date.toUpperCase()]) // Date header

    // Table headers
    sheetData.push(['Product Code', 'Product Name', 'DP', 'Qty', 'Value', 'Dispatched By', 'Type'])

    group.rows.forEach((row) => {
      sheetData.push([
        row.productcode,
        row.productname,
        row.distributorprice,
        row.quantity,
        row.distributorprice * row.quantity,
        row.createdby,
        row.dispatchtype,
      ])
    })

    sheetData.push([]) // separator between date groups
  })

  // 🔹 Footer
  sheetData.push(
    [],
    ['Dispatched By:', '', '', 'Signature:'],
    ['Received By:', '', '', 'Signature:'],
  )

  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dispatch Report')
  XLSX.writeFile(wb, 'DispatchReport.xlsx')
}
function exportToPDF() {
  if (!dispatchesByDate.value.length) return

  const doc = new jsPDF()
  let startY = 20

  // 🔹 Header
  doc.setFontSize(12)
  doc.text(
    `From: ${dispatchesByDate.value[0].rows[0].fromName} → ${dispatchesByDate.value[0].rows[0].toName}`,
    14,
    startY,
  )
  doc.text(`Start Date: ${startDate.value} | End Date: ${endDate.value}`, 14, startY + 6)
  doc.text(`Printed On: ${new Date().toLocaleString()}`, 14, startY + 12)
  startY += 20

  // 🔹 Grouped rows per date
  dispatchesByDate.value.forEach((group) => {
    doc.setFont(undefined, 'bold')
    doc.text(group.date.toUpperCase(), 14, startY)
    doc.setFont(undefined, 'normal')

    autoTable(doc, {
      startY: startY + 4,
      head: [['Product Code', 'Product Name', 'DP', 'Qty', 'Value', 'Dispatched By', 'Type']],
      body: group.rows.map((row) => [
        row.productcode,
        row.productname,
        row.distributorprice,
        row.quantity,
        row.distributorprice * row.quantity,
        row.createdby,
        row.dispatchtype,
      ]),
      theme: 'grid',
    })

    startY = doc.lastAutoTable.finalY + 10
  })

  // 🔹 Footer
  doc.text('Dispatched By: ______________________', 14, startY)
  doc.text('Received By: ______________________', 14, startY + 10)

  doc.save('DispatchReport.pdf')
}
</script>
