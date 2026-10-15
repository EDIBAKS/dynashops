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
      <div class="row justify-end q-mt-sm q-gutter-sm">
        <q-btn color="light-green-14" label="Fetch Dispatches" @click="fetchDispatches" />
        <q-btn
          dense
          flat
          icon="table_view"
          color="light-green-14"
          @click="exportToExcel"
          title="Export to Excel"
        />
        <q-btn
          dense
          flat
          icon="picture_as_pdf"
          color="light-green-14"
          @click="exportToPDF"
          title="Export to PDF"
        />
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
                </q-item-section>

                <q-item-section side top v-if="isAdminOrSuperAdmin">
                  <q-btn
                    dense
                    size="sm"
                    icon="replay"
                    label="Reverse"
                    class="bg-light-green-14 text-white"
                    :disable="loading"
                    @click="confirmReturn(row)"
                  />
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
import { ref, computed, onMounted } from 'vue'
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

// --- GROUP BY DATE ---
const dispatchesByDate = computed(() => {
  const map = {}

  dispatches.value.forEach((d) => {
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
