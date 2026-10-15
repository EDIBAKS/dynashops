<template>
  <q-page class="q-pa-sm">
    <!-- Filters -->
    <div class="row q-col-gutter-sm q-mb-sm items-center justify-between q-gutter-xs">
      <!-- Date inputs -->
      <q-input
        dense
        type="date"
        v-model="startDate"
        label="From"
        outlined
        class="col-xs-12 col-sm-3"
      />
      <q-input dense type="date" v-model="endDate" label="To" outlined class="col-xs-12 col-sm-3" />

      <!-- Action buttons -->
      <div class="col-xs-12 col-sm-6 row justify-end q-gutter-sm q-mt-xs q-mt-sm-0">
        <q-btn
          dense
          color="primary"
          icon="search"
          label="Load"
          :loading="loading"
          @click="fetchData"
        />
        <q-btn dense color="secondary" icon="file_download" label="Excel" @click="exportExcel" />
        <q-btn dense color="secondary" icon="picture_as_pdf" label="PDF" @click="exportPdf" />
      </div>
    </div>

    <!-- Table -->
    <q-table
      v-if="rows.length"
      flat
      dense
      bordered
      row-key="productcode"
      :rows="rows"
      :columns="columns"
      hide-bottom
      :pagination="{ rowsPerPage: rows.length }"
      virtual-scroll
      :virtual-scroll-sticky-size-start="48"
    >
      <!-- Render numeric cells aligned right -->
      <template v-slot:body-cell="props">
        <q-td
          :props="props"
          :class="
            props.col.name === 'productcode' || props.col.name === 'productname' ? '' : 'text-right'
          "
        >
          <!-- Only format numbers -->
          <span v-if="typeof props.value === 'number'">{{ format(props.value) }}</span>
          <span v-else>{{ props.value }}</span>
        </q-td>
      </template>
    </q-table>

    <div v-else class="text-grey text-center q-mt-md">No data loaded</div>
  </q-page>
</template>

<script setup>
// Dependencies for dispatch data and spreadsheet/PDF generation.
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'boot/supabase'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable' // note: import as default

// Date filters and reference data used to build the dispatch matrix.
const $q = useQuasar()
const startDate = ref(null)
const endDate = ref(null)
const rawDispatches = ref([])
const products = ref([])
const shops = ref([])
const provinces = ref([])
const loading = ref(false)

// --- Fetching data (same as before) ---
async function fetchData() {
  if (!startDate.value || !endDate.value) {
    $q.notify({ type: 'negative', message: 'Select start and end date' })
    return
  }

  loading.value = true
  try {
    const { data: dispatchData, error: dispatchError } = await supabase.rpc(
      'fetch_dispatches_raw',
      { p_start_date: startDate.value, p_end_date: endDate.value },
    )
    if (dispatchError) throw dispatchError
    rawDispatches.value = dispatchData || []

    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('productcode, productname')
      .eq('status', 'active')
    if (productError) throw productError
    products.value = productData || []

    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .select('shopcode, shop_name')
    if (shopError) throw shopError
    shops.value = shopData || []

    const { data: provinceData, error: provinceError } = await supabase
      .from('province')
      .select('province_code')
    if (provinceError) throw provinceError
    provinces.value = (provinceData || []).map((p) => p.province_code)
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message || 'Failed to fetch data' })
  } finally {
    loading.value = false
  }
}

// --- Map dispatches to rows ---
const rows = computed(() => {
  const map = {}
  products.value.forEach((p) => {
    const row = { productcode: p.productcode, productname: p.productname, __total: 0 }
    provinces.value.forEach((prov) => (row[prov] = 0))
    shops.value.forEach((s) => (row[s.shop_name] = 0))
    map[p.productcode] = row
  })

  rawDispatches.value.forEach((d) => {
    const row = map[d.productcode]
    if (!row) return

    const type = (d.dispatchtype || '').toUpperCase()
    let colName = ''
    if (type === 'SHOP') {
      const shop = shops.value.find((s) => d.to_location.startsWith(s.shopcode))
      if (!shop) return
      colName = shop.shop_name
    } else if (type === 'DPC') {
      if (!provinces.value.includes(d.to_location)) return
      colName = d.to_location
    } else return

    row[colName] = (row[colName] || 0) + d.quantity
    row.__total += d.quantity
  })

  return Object.values(map)
})

// --- Columns ---
const columns = computed(() => {
  const provinceCols = provinces.value.map((p) => ({ name: p, label: p, field: p, align: 'right' }))
  const shopCols = shops.value.map((s) => ({
    name: s.shop_name,
    label: s.shop_name,
    field: s.shop_name,
    align: 'right',
  }))

  return [
    { name: 'productcode', label: 'Code', field: 'productcode', align: 'left' },
    { name: 'productname', label: 'Product', field: 'productname', align: 'left' },
    ...provinceCols,
    ...shopCols,
    { name: '__total', label: 'Total', field: '__total', align: 'right' },
  ]
})

function format(val) {
  return Number(val || 0).toLocaleString()
}

// --- Export Excel ---
function exportExcel() {
  const wsData = [
    [
      'Summary Dispatches',
      '',
      '',
      'From',
      startDate.value || '',
      'To',
      endDate.value || '',
      'PrintDate',
      new Date().toLocaleDateString(),
      'PrintedBy',
      'CurrentUser',
    ],
    [],
    columns.value.map((c) => c.label), // headers
    ...rows.value.map((r) => columns.value.map((c) => r[c.field])),
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'DispatchSummary')
  XLSX.writeFile(wb, `DispatchSummary_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// Render destinations as columns in the printable summary.
function exportPdf() {
  const doc = new jsPDF('landscape', 'mm', 'a4')

  // --- Header ---
  doc.setFontSize(12)
  doc.text(`Summary Dispatches`, 14, 10)
  doc.setFontSize(10)
  doc.text(
    `From: ${startDate.value || ''}   To: ${endDate.value || ''}   PrintDate: ${new Date().toLocaleDateString()}   PrintedBy: CurrentUser`,
    14,
    16,
  )

  // --- Prepare table ---
  const maxNameLength = 25 // max characters to display in product name
  const tableColumns = columns.value.map((c) => c.label)
  const tableRows = rows.value.map((r) =>
    columns.value.map((c) => {
      let val = r[c.field]
      // Truncate product names to fit
      if (c.field === 'productname') {
        val =
          String(val || '').length > maxNameLength
            ? String(val || '').substring(0, maxNameLength - 3) + '...'
            : val
      }
      return val
    }),
  )

  // --- Column widths for compact layout ---
  const colWidths = {}
  columns.value.forEach((c) => {
    if (c.field === 'productcode') colWidths[c.field] = 20
    else if (c.field === 'productname') colWidths[c.field] = 50
    else colWidths[c.field] = 15 // provinces and shops
  })

  autoTable(doc, {
    startY: 20,
    head: [tableColumns],
    body: tableRows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [100, 100, 100] },
    columnStyles: colWidths,
    theme: 'grid',
    foot: [
      Array(columns.value.length - 1).fill(''), // empty cells
      'Signature: ________________________', // last cell
    ],
    margin: { top: 20, left: 10, right: 10 },
  })

  // --- Save PDF ---
  doc.save(`DispatchSummary_${new Date().toISOString().slice(0, 10)}.pdf`)
}
</script>

<style scoped>
.q-table__middle {
  overflow-x: auto;
}
</style>
