<template>
  <q-page class="q-pa-md">
    <!-- Filters -->
    <q-card flat bordered class="q-pa-md q-mb-md">
      <div class="row q-col-gutter-md items-center">
        <div class="col-12 col-md-4">
          <q-input v-model="startDate" type="date" label="Start Date" outlined dense />
        </div>

        <div class="col-12 col-md-4">
          <q-input v-model="endDate" type="date" label="End Date" outlined dense />
        </div>

        <div class="col-12 col-md-4">
          <q-btn
            label="Fetch Data"
            color="primary"
            class="full-width"
            :loading="loading"
            @click="fetchSalesReport"
          />
        </div>
      </div>
    </q-card>

    <!-- Results Table -->
    <q-card flat bordered>
      <q-card-section class="row q-gutter-sm">
        <q-btn label="Export PDF" color="negative" icon="picture_as_pdf" @click="exportToPDF" />

        <q-btn label="Export Excel" color="positive" icon="table_view" @click="exportToExcel" />
      </q-card-section>
      <!-- Shop Sales Summary -->
      <div class="row q-col-gutter-md q-mb-md" v-if="shopSummary.length">
        <div v-for="shop in shopSummary" :key="shop.shop" class="col-12 col-md-4">
          <q-card flat bordered class="q-pa-md">
            <div class="text-subtitle1 text-bold">
              {{ shop.shop }}
            </div>

            <div class="text-h6 text-primary">${{ formatNumber(shop.total) }}</div>

            <div class="text-caption">{{ shop.percent.toFixed(1) }}% of $15,000 target</div>

            <q-linear-progress
              :value="shop.percent / 100"
              size="10px"
              :color="shop.percent >= 100 ? 'positive' : 'warning'"
              class="q-mt-sm"
            />
          </q-card>
        </div>
      </div>
      <div v-if="totalSales" class="q-mb-md">
        <q-card flat bordered class="q-pa-md bg-grey-1">
          <div class="row items-center justify-between">
            <div class="text-subtitle1 text-bold">Total Sales (All Shops)</div>

            <div class="text-h5 text-primary">${{ formatNumber(totalSales) }}</div>
          </div>
        </q-card>
      </div>
      <q-table
        title="Sales Pivot by Shop"
        :rows="rows"
        :columns="columns"
        row-key="productcode"
        dense
        flat
        :row-class="getRowClass"
      />
    </q-card>
  </q-page>
</template>

<script setup>
// Sales data, authentication, and export libraries for this report.
import { ref } from 'vue'
import { supabase } from 'src/boot/supabase'
import { date } from 'quasar'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuth } from 'stores/auth'
const auth = useAuth()
// Pivoted product rows and shop totals for the selected date range.
const rows = ref([])
const loading = ref(false)
const columns = ref([])
const user = auth.userDetails.firstname
// Default dates (today)
const today = date.formatDate(new Date(), 'YYYY-MM-DD')
const startDate = ref(today)
const endDate = ref(today)
const shopSummary = ref([])
const SALES_TARGET = 15000
const totalSales = ref(0)
// Fetch sales and rebuild the product-by-shop report data.
async function fetchSalesReport() {
  loading.value = true
  rows.value = []
  columns.value = []

  const { data, error } = await supabase.rpc('get_shop_sales_normalized', {
    p_start_date: startDate.value,
    p_end_date: endDate.value,
  })

  loading.value = false

  if (error) {
    console.error(error)
    return
  }

  const pivoted = pivotSalesData(data)

  // Base columns
  columns.value = [
    { name: 'productcode', label: 'Code', field: 'productcode', sortable: true },
    {
      name: 'productname',
      label: 'Product',
      field: 'productname',
      sortable: true,
      align: 'left',
      classes: 'ellipsis-col',
      headerClasses: 'text-left',
    },

    { name: 'distributorprice', label: 'Price', field: 'distributorprice', align: 'right' },
  ]

  // Dynamic shop columns
  pivoted.shops.forEach((shop) => {
    columns.value.push({
      name: shop,
      label: shop,
      field: shop,
      align: 'right',
      format: (val, row) => (row.productname === 'TOTAL SALES' ? formatNumber(val) : val),
    })
  })

  rows.value = pivoted.rows
}

function pivotSalesData(data) {
  const productsMap = {}
  const shopSet = new Set()
  const shopTotals = {} // 👈 total sales per shop

  data.forEach((row) => {
    const shop = row.shopcode
    const qty = row.total_quantity || 0
    const price = row.distributorprice || 0
    const saleValue = qty * price

    shopSet.add(shop)

    // init shop total
    if (!shopTotals[shop]) {
      shopTotals[shop] = 0
    }
    shopTotals[shop] += saleValue

    // init product row
    if (!productsMap[row.productcode]) {
      productsMap[row.productcode] = {
        productcode: row.productcode,
        productname: row.productname,
        distributorprice: price,
      }
    }

    // store quantity (not value) per shop
    productsMap[row.productcode][shop] = qty
  })

  // fill missing shop quantities with 0
  Object.values(productsMap).forEach((product) => {
    shopSet.forEach((shop) => {
      if (product[shop] == null) {
        product[shop] = 0
      }
    })
  })

  // 👇 TOTAL ROW
  const totalRow = {
    productcode: '',
    productname: 'TOTAL SALES',
    distributorprice: '',
  }

  shopSet.forEach((shop) => {
    totalRow[shop] = shopTotals[shop]
  })

  const summary = []
  let grandTotal = 0

  shopSet.forEach((shop) => {
    const total = shopTotals[shop] || 0
    const percent = (total / SALES_TARGET) * 100

    grandTotal += total

    summary.push({
      shop,
      total,
      percent,
    })
  })

  shopSummary.value = summary
  totalSales.value = grandTotal

  return {
    rows: [...Object.values(productsMap), totalRow],
    shops: Array.from(shopSet),
  }
}

// Write the current pivoted rows to an Excel workbook.
function exportToExcel() {
  const ws = XLSX.utils.json_to_sheet(rows.value)
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, ws, 'Sales Report')

  XLSX.writeFile(wb, `DynaShop_Sales_${startDate.value}_to_${endDate.value}.xlsx`)
}

function getRowClass(row) {
  if (row.productname === 'TOTAL SALES') {
    return 'total-row'
  }
  return ''
}

function formatNumber(val) {
  if (val == null || val === '') return ''
  return new Intl.NumberFormat().format(val)
}

function exportToPDF() {
  const doc = new jsPDF('l', 'mm', 'a4')

  const title = `DynaShop Monthly Sales`
  const subtitle = `Between ${startDate.value} and ${endDate.value}`
  const printedOn = `Printed on: ${new Date().toLocaleString()}`
  const printedBy = `Printed by: ${user}` // replace from auth store

  doc.setFontSize(14)
  doc.text(title, 14, 15)

  doc.setFontSize(11)
  doc.text(subtitle, 14, 22)

  doc.setFontSize(9)
  doc.text(printedOn, 230, 15)
  doc.text(printedBy, 230, 22)

  const tableColumns = columns.value.map((col) => col.label)
  const tableRows = rows.value.map((row) => columns.value.map((col) => row[col.field] ?? 0))

  autoTable(doc, {
    head: [tableColumns],
    body: tableRows,
    startY: 30,

    styles: {
      fontSize: 8,
      textColor: [0, 0, 0], // 🔴 pure black
      lineColor: [0, 0, 0], // optional: darker borders
      lineWidth: 0.1,
    },

    headStyles: {
      textColor: [0, 0, 0],
      fillColor: [230, 230, 230], // light gray header background
      fontStyle: 'bold',
    },

    bodyStyles: {
      textColor: [0, 0, 0],
    },

    footStyles: {
      textColor: [0, 0, 0],
      fontStyle: 'italic',
    },

    foot: [['', 'Signature:', '', '', '']],
  })

  doc.save(`DynaShop_Sales_${startDate.value}_to_${endDate.value}.pdf`)
}

//function formatCurrency(value) {
//if (value == null) return '-'
//return new Intl.NumberFormat().format(value)
//}
</script>
<style scoped>
.ellipsis-col {
  max-width: 220px; /* adjust to your taste */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  .total-row {
    font-weight: bold;
    background-color: #f5f5f5; /* optional */
  }

  .ellipsis-col {
    max-width: 220px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
