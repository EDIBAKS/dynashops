<template>
  <q-card flat bordered class="q-pa-md">
    <!-- DPC SELECT -->
    <div class="q-mb-md">
      <q-select
        v-if="isAdmin"
        v-model="form.dpccode"
        :options="dpcOptions"
        label="Select Shop"
        dense
        outlined
        emit-value
        map-options
        class="full-width white-select"
        option-label="label"
        option-value="value"
      />

      <q-input
        v-else
        v-model="form.dpccode"
        label="DPC Code"
        dense
        outlined
        readonly
        class="full-width"
        input-class="text-center text-bold text-white"
      />
    </div>

    <!-- DATE RANGE -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6">
        <div class="text-caption text-bold q-mb-xs">{{ $t('startDate') }}</div>
        <q-input v-model="form.startDate" type="date" dense outlined class="full-width" />
      </div>

      <div class="col-12 col-sm-6">
        <div class="text-caption text-bold q-mb-xs">{{ $t('endDate') }}</div>
        <q-input v-model="form.endDate" type="date" dense outlined class="full-width" />
      </div>
    </div>

    <!-- GENERATE BUTTON -->
    <q-btn
      label="Generate Stock Report"
      color="primary"
      class="full-width q-mb-md"
      @click="fetchStock"
    />
    <div class="row q-gutter-sm q-mt-md">
      <q-btn label="Export Excel" color="green" @click="exportStockToExcel" />
      <q-btn label="Export PDF" color="red" @click="exportStockToPDF" />
    </div>
    <!-- EXPORT -->
    <!--<reportExporter v-if="reportData.length" reportType="stock" :reportData="reportData" />  -->

    <!-- REPORT HEADER -->
    <q-card-section v-if="reportData.length" class="bg-grey-2 q-pa-sm">
      <div class="row justify-between">
        <div>
          <div><strong>DPC:</strong> {{ shopName }}</div>
        </div>
        <div class="text-right">
          <div><strong>Date:</strong> {{ currentDate }}</div>
          <div><strong>User:</strong> {{ auth.userDetails?.firstname }}</div>
        </div>
      </div>
    </q-card-section>

    <!-- EMPTY -->
    <div v-if="!stock.length" class="text-center text-red q-mt-md">No stock found.</div>

    <!-- FILTERS -->
    <q-card-section v-if="stock.length">
      <q-option-group v-model="stockFilter" :options="filterOptions" inline type="radio" />
    </q-card-section>
    <q-banner class="bg-blue-1 text-black q-mb-sm">
      Total Stock: <strong>{{ stockTotals.totalQty }}</strong>
    </q-banner>
    <!-- TABLE -->
    <q-table
      v-if="stock.length"
      title="Stock Summary"
      :rows="filteredStock"
      :columns="columns"
      row-key="productcode"
      flat
      bordered
      dense
      separator="cell"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #body-cell-quantity="props">
        <q-td :props="props" :class="rowColor(props.row.quantity)">
          {{ props.row.quantity }}
        </q-td>
      </template>

      <template #bottom-row>
        <q-tr>
          <!-- Code -->
          <q-td />

          <!-- Product -->
          <q-td />

          <!-- Qty (optional total) -->
          <q-td class="text-bold text-right">
            {{ stockTotals.totalQty }}
          </q-td>

          <!-- DP -->
          <q-td />

          <!-- BV -->
          <q-td />

          <!-- CIF -->
          <q-td />

          <!-- DP VALUE -->
          <q-td class="text-bold text-right">
            {{ stockTotals.totalDpValue.toFixed(2) }}
          </q-td>

          <!-- BV VALUE -->
          <q-td class="text-bold text-right">
            {{ stockTotals.totalBvValue.toFixed(2) }}
          </q-td>

          <!-- CIF VALUE -->
          <q-td class="text-bold text-right">
            {{ stockTotals.totalCifValue.toFixed(2) }}
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </q-card>
</template>
<script setup>
// Stock lookup, role checks, and report export dependencies.
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuth } from 'stores/auth'
import { supabase } from 'boot/supabase'
import { useQuasar } from 'quasar'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
//import reportExporter from 'src/components/ExporterComponent.vue'

const auth = useAuth()
const $q = useQuasar()

/* ---------------- STATE ---------------- */
const stock = ref([])
const dpcOptions = ref([])
const stockFilter = ref('all')

const stockTotals = computed(() => {
  return stock.value.reduce(
    (acc, item) => {
      acc.totalDpValue += item.dpValue
      acc.totalBvValue += item.bvValue
      acc.totalCifValue += item.cifValue
      acc.totalQty += item.quantity
      return acc
    },
    {
      totalDpValue: 0,
      totalBvValue: 0,
      totalCifValue: 0,
      totalQty: 0,
    },
  )
})
const form = reactive({
  startDate: '',
  endDate: '',
  dpccode: '',
})

/* ---------------- COMPUTED ---------------- */
const isAdmin = computed(() => ['Admin', 'SuperAdmin'].includes(auth.userDetails?.role))

const reportData = computed(() => stock.value || [])

const filteredStock = computed(() => {
  if (!Array.isArray(stock.value)) return []

  if (stockFilter.value === 'above20') return stock.value.filter((s) => s.quantity > 20)

  if (stockFilter.value === 'below5') return stock.value.filter((s) => s.quantity < 5)

  return stock.value
})

const shopName = computed(() => {
  const found = dpcOptions.value.find((d) => d.value === form.dpccode)
  return found?.label || ''
})

const currentDate = computed(() => new Date().toLocaleDateString())

/* ---------------- TABLE CONFIG ---------------- */
const columns = [
  { name: 'productcode', label: 'Code', field: 'productcode', align: 'left', sortable: true },
  { name: 'productname', label: 'Product', field: 'productname', align: 'left', sortable: true },

  { name: 'quantity', label: 'Qty', field: 'quantity', align: 'right', sortable: true },

  {
    name: 'distributorprice',
    label: 'DP',
    field: 'distributorprice',
    align: 'right',
    sortable: true,
  },
  { name: 'bv', label: 'BV', field: 'bv', align: 'right', sortable: true },
  { name: 'cifprice', label: 'CIF', field: 'cifprice', align: 'right', sortable: true },

  { name: 'dpValue', label: 'DP Value', field: 'dpValue', align: 'right', sortable: true },
  { name: 'bvValue', label: 'BV Value', field: 'bvValue', align: 'right', sortable: true },
  { name: 'cifValue', label: 'CIF Value', field: 'cifValue', align: 'right', sortable: true },
]
const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Above 20', value: 'above20' },
  { label: 'Below 5', value: 'below5' },
]

/* ---------------- METHODS ---------------- */
function rowColor(qty) {
  if (qty < 5) return 'bg-red-2'
  if (qty > 20) return 'bg-green-2'
  return ''
}

async function fetchStock() {
  if (!form.dpccode) {
    $q.notify({ type: 'negative', message: 'No DPC selected' })
    return
  }

  const tableName = `${form.dpccode}_STOCK`

  try {
    const { data, error } = await supabase.from(tableName).select(`
    productcode,
    quantity,
    products (
      productname,
      distributorprice,
      bvs,
      cifprice
    )
  `)
    if (error) throw error

    stock.value = (data || []).map((i) => {
      const qty = Number(i.quantity) || 0

      const price = i.products?.distributorprice ?? 0
      const bv = i.products?.bvs ?? 0 // ✅ FIXED HERE
      const cif = i.products?.cifprice ?? 0

      return {
        productcode: i.productcode,
        productname: i.products?.productname || '',
        quantity: qty,

        distributorprice: price,
        bv,
        cifprice: cif,

        dpValue: qty * price,
        bvValue: qty * bv,
        cifValue: qty * cif,
      }
    })
  } catch (err) {
    console.error(err)
    stock.value = []
  }
}

/* ---------------- INIT ---------------- */
onMounted(async () => {
  if (isAdmin.value) {
    const { data } = await supabase.from('shops').select('shopcode, shop_name').order('shop_name')

    dpcOptions.value = (data || []).map((d) => ({
      label: d.shop_name,
      value: d.shopcode,
    }))

    form.dpccode = dpcOptions.value[0]?.value || ''
  } else {
    form.dpccode = auth.userDetails?.dpc_id
  }
})

const exportStockToExcel = () => {
  const wb = XLSX.utils.book_new()

  const data = []

  // 🔹 HEADER
  data.push(['Stock Report'])
  data.push(['Shop:', shopName.value])
  data.push(['Date:', currentDate.value])
  data.push(['User:', auth.userDetails?.firstname])
  data.push([])

  // 🔹 TOTAL STOCK
  data.push(['Total Stock', stockTotals.value.totalQty])
  data.push([])

  // 🔹 TABLE HEADER
  data.push(['Code', 'Product', 'Qty', 'DP', 'BV', 'CIF', 'DP Value', 'BV Value', 'CIF Value'])

  // 🔹 ROWS
  filteredStock.value.forEach((row) => {
    data.push([
      row.productcode,
      row.productname,
      row.quantity,
      row.distributorprice,
      row.bv,
      row.cifprice,
      row.dpValue,
      row.bvValue,
      row.cifValue,
    ])
  })

  // 🔹 TOTALS
  data.push([])
  data.push([
    '',
    '',
    '',
    '',
    '',
    'Totals:',
    stockTotals.value.totalDpValue,
    stockTotals.value.totalBvValue,
    stockTotals.value.totalCifValue,
  ])

  const ws = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Report')

  XLSX.writeFile(wb, 'Stock_Report.xlsx')
}

const exportStockToPDF = () => {
  const doc = new jsPDF({
    orientation: 'landscape', // ✅ Landscape mode
    unit: 'mm',
    format: 'a4',
  })

  // 🔹 HEADER
  doc.setFontSize(14)
  doc.text('Stock Report', 14, 10)

  doc.setFontSize(10)
  doc.text(`Shop: ${shopName.value}`, 14, 18)
  doc.text(`Date: ${currentDate.value}`, 14, 24)
  doc.text(`User: ${auth.userDetails?.firstname}`, 14, 30)

  // 🔹 TOTAL STOCK
  doc.text(`Total Stock: ${stockTotals.value.totalQty}`, 14, 38)

  // 🔹 TABLE
  autoTable(doc, {
    startY: 45,

    head: [['Code', 'Product', 'Qty', 'DP', 'BV', 'CIF', 'DP Value', 'BV Value', 'CIF Value']],

    body: filteredStock.value.map((row) => [
      row.productcode,
      row.productname,
      row.quantity,
      row.distributorprice,
      row.bv,
      row.cifprice,
      row.dpValue.toFixed(2),
      row.bvValue.toFixed(2),
      row.cifValue.toFixed(2),
    ]),

    foot: [
      [
        '', // Code
        'Totals', // Product (label here ✅)
        stockTotals.value.totalQty, // Qty (optional)
        '', // DP
        '', // BV
        '', // CIF
        stockTotals.value.totalDpValue.toFixed(2), // DP Value ✅
        stockTotals.value.totalBvValue.toFixed(2), // BV Value ✅
        stockTotals.value.totalCifValue.toFixed(2), // CIF Value ✅
      ],
    ],

    // ✅ IMPROVEMENTS FOR LANDSCAPE
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },

    headStyles: {
      fillColor: [41, 128, 185], // blue header
      textColor: 255,
    },

    footStyles: {
      fillColor: [220, 220, 220],
      textColor: 0,
      fontStyle: 'bold',
    },

    columnStyles: {
      0: { cellWidth: 30 }, // Code
      1: { cellWidth: 70 }, // Product (wider)
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },

    didDrawPage: (data) => {
      // ✅ Footer (page numbers)
      const pageCount = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${pageCount}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 5,
      )
    },
  })

  doc.save('Stock_Report.pdf')
}
</script>

<style>
.white-select .q-field__control {
  background: white;
}

.white-select .q-field__native {
  text-align: right;
}
</style>
