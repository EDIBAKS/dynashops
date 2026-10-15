<template>
  <div class="q-pa-md">
    <q-card flat bordered>
      <q-card-section>
        <div class="row items-center justify-between">
          <div class="text-h6">Stock Table View</div>

          <!-- SEARCH BAR -->
          <q-input
            dense
            debounce="300"
            outlined
            v-model="searchText"
            placeholder="Search product name..."
            class="q-ml-md"
            style="max-width: 250px"
          >
            <template #append>
              <q-icon name="search" />
            </template>
          </q-input>

          <!-- EXPORT BUTTON -->
          <!-- EXPORT BUTTONS -->
          <div class="row q-gutter-sm">
            <q-btn
              color="primary"
              icon="picture_as_pdf"
              label="Export PDF"
              dense
              flat
              @click="exportPDFTable"
            />
            <q-btn
              color="green"
              icon="table_view"
              label="Export Excel"
              dense
              flat
              @click="exportExcelTable"
            />
          </div>
        </div>
      </q-card-section>

      <!-- COLUMN SELECTION -->
      <q-card-section>
        <q-option-group
          v-model="visibleColumns"
          :options="allColumnsOptions"
          type="checkbox"
          inline
        />

        <div class="row q-gutter-sm q-mt-sm">
          <q-btn dense label="Select All" @click="selectAllColumns" />
          <q-btn dense color="negative" label="Clear All" @click="clearAllColumns" />
        </div>
      </q-card-section>

      <!-- STOCK TABLE -->
      <q-card-section>
        <q-table
          flat
          dense
          :rows="filteredRows"
          :columns="filteredColumns"
          row-key="productcode"
          :loading="loading"
          v-model:sort-by="sortBy"
          v-model:descending="descending"
        />
      </q-card-section>

      <!-- EXPORT DIALOG -->
    </q-card>
  </div>
</template>

<script setup>
/* ----------------------------------------------
   IMPORTS
---------------------------------------------- */
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

import autoTable from 'jspdf-autotable'
import { supabase } from 'boot/supabase'
import { useAuth } from 'stores/auth'

/* ----------------------------------------------
   STATE
---------------------------------------------- */
const $q = useQuasar()
const auth = useAuth()

const loading = ref(false)

const rows = ref([])
const columns = ref([])
const allColumns = ref([])
const visibleColumns = ref([])
const sortBy = ref('productname')
const descending = ref(false)

const searchText = ref('')

/* ----------------------------------------------
   FILTERED ROWS
---------------------------------------------- */
const rowsWithTotal = computed(() =>
  rows.value.map((row) => {
    let total = 0

        // Sum dynamic location quantities while excluding product identifiers.
    Object.keys(row).forEach((key) => {
      if (key !== 'productcode' && key !== 'productname') {
        const val = Number(row[key])
        if (!isNaN(val)) total += val
      }
    })

    return { ...row, TotalProduct: total }
  }),
)

const filteredRows = computed(() => {
  if (!searchText.value.trim()) return rowsWithTotal.value

  return rowsWithTotal.value.filter((r) =>
    r.productname.toLowerCase().includes(searchText.value.toLowerCase()),
  )
})

const filteredColumns = computed(() =>
  columns.value.filter((c) => visibleColumns.value.includes(c.name)),
)

const allColumnsOptions = computed(() =>
  allColumns.value.map((c) => ({
    label: c.label,
    value: c.name,
  })),
)

/* ----------------------------------------------
   WATCHERS
---------------------------------------------- */
watch(visibleColumns, (val) => localStorage.setItem('visibleStockCols', JSON.stringify(val)), {
  deep: true,
})

/* ----------------------------------------------
   LIFECYCLE
---------------------------------------------- */
onMounted(() => {
  const saved = localStorage.getItem('visibleStockCols')
  if (saved) visibleColumns.value = JSON.parse(saved)

  buildStockPivot()
})

/* ----------------------------------------------
   COLUMN CONTROL
---------------------------------------------- */
function selectAllColumns() {
  visibleColumns.value = allColumns.value.map((c) => c.name)
}

function clearAllColumns() {
  visibleColumns.value = []
}

/* ----------------------------------------------
   FETCH STOCK PER TABLE
---------------------------------------------- */
async function fetchStockForTable(tableName, productCodes = []) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('productcode, quantity')
      .in('productcode', productCodes)

    if (error) return new Map()

    const map = new Map()
    for (const r of data || []) map.set(r.productcode, Number(r.quantity || 0))
    return map
  } catch {
    return new Map()
  }
}

/* ----------------------------------------------
   BUILD PIVOT DATA
---------------------------------------------- */
async function buildStockPivot() {
  try {
    loading.value = true
    const countryCode = auth.userDetails?.country_code
    if (!countryCode) throw new Error('User country_code missing')

    // Fetch Products
    const { data: productsData } = await supabase
      .from('products')
      .select('productcode, productname')
      .eq('status', 'active')
      .order('productname')

    const products = productsData || []
    const productCodes = products.map((p) => p.productcode)

    // Fetch Provinces
    const { data: provincesData } = await supabase
      .from('province')
      .select('province_code, name')
      .eq('country_code', countryCode)
      .order('name')

    const provinces = provincesData || []
    const provCodes = provinces.map((p) => p.province_code)

    // Fetch Shops
    let shops = []
    if (provCodes.length > 0) {
      const { data: shopsData } = await supabase
        .from('shops')
        .select('shopcode, shop_name, province_code')
        .in('province_code', provCodes)

      if (shopsData) shops = shopsData
    }

    // Build location list
    const provinceLocations = provinces.map((prov) => ({
      label: prov.name,
      tableName: prov.province_code,
      type: 'province',
    }))

    const shopLocations = shops.map((sh) => ({
      label: `${sh.shop_name} (${sh.province_code})`,
      tableName: `${sh.shopcode}_STOCK`,
      type: 'shop',
    }))

    const locations = [...provinceLocations, ...shopLocations]

    // Fetch stock from all tables
    const stockMaps = await Promise.all(
      locations.map((loc) => fetchStockForTable(loc.tableName, productCodes)),
    )

    locations.forEach((loc, i) => (loc.stockMap = stockMaps[i]))

    // Build columns

    const baseCols = [
      {
        name: 'productcode',
        label: 'Code',
        field: 'productcode',
        align: 'left',
        sortable: true,
      },
      {
        name: 'productname',
        label: 'Product Name',
        field: 'productname',
        align: 'left',
        sortable: true,
      },
      {
        name: 'TotalProduct',
        label: 'Total',
        field: 'TotalProduct',
        align: 'right',
        sortable: true,
        sort: (a, b) => Number(a) - Number(b), // numeric sort
      },
    ]

    const locCols = locations.map((loc, i) => ({
      name: `loc_${i}`,
      label: loc.label,
      field: (row) => row[loc.label] ?? 0,
      align: 'center',
      classes:
        loc.type === 'province'
          ? 'bg-light-green-14 text-dark text-bold'
          : 'bg-orange text-dark text-bold',
    }))

    columns.value = [...baseCols, ...locCols]
    allColumns.value = [...baseCols, ...locCols]

    if (visibleColumns.value.length === 0) visibleColumns.value = baseCols.map((c) => c.name)

    // Build rows
    rows.value = products.map((prod) => {
      const row = {
        productcode: prod.productcode,
        productname: prod.productname,
        cifprice: prod.cifprice ?? 0,
        distributorprice: prod.distributorprice ?? 0,
        bvs: prod.bvs ?? 0,
      }

      // Fill in quantities per location
      locations.forEach((loc) => {
        const qty = loc.stockMap.get(prod.productcode) ?? 0
        row[loc.label] = Number(qty) // ensure number
      })

      locations.forEach((loc) => {
        const qty = loc.stockMap.get(prod.productcode) ?? 0
        const value = qty * (prod.distributorprice || 0)

        row[loc.label] = qty
        row[`${loc.label}_value`] = value
      })

      // TotalProduct = sum only of location quantities
      row.TotalValue = locations.reduce((sum, loc) => {
        const qty = Number(row[loc.label]) || 0
        const price = Number(prod.distributorprice) || 0
        return sum + qty * price
      }, 0)

      // Round total to integer to remove decimals
      row.TotalProduct = Math.round(row.TotalProduct)

      return row
    })
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    loading.value = false
  }
}

function truncate(text, max = 8) {
  if (text === null || text === undefined) return ''
  const str = String(text)
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

function chunkArray(arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/* ----------------------------------------------
   EXPORT PDF
---------------------------------------------- */
function exportPDFTable() {
  const doc = new jsPDF('l', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()

  /* -------- COLUMN GROUPS -------- */
  const fixedCols = filteredColumns.value.filter((c) =>
    ['productcode', 'productname', 'TotalProduct'].includes(c.name),
  )

  const dynamicCols = filteredColumns.value.filter(
    (c) => !['productcode', 'productname', 'TotalProduct'].includes(c.name),
  )

  /* -------- PAGE METRICS -------- */
  const margin = 6
  const usableWidth = pageWidth - margin * 2

  const fixedWidths = {
    productcode: 16,
    productname: 40,
    TotalProduct: 14,
  }

  const fixedTotal = fixedWidths.productcode + fixedWidths.productname + fixedWidths.TotalProduct

  /* -------- MAX COLUMNS PER PAGE -------- */
  const MIN_DYNAMIC_WIDTH = 7 // minimum readable
  const maxDynamicColsPerPage = Math.floor((usableWidth - fixedTotal) / MIN_DYNAMIC_WIDTH)

  const columnPages = chunkArray(dynamicCols, maxDynamicColsPerPage)

  /* -------- RENDER -------- */
  columnPages.forEach((pageCols, pageIndex) => {
    if (pageIndex > 0) doc.addPage()

    /* -------- HEADER -------- */
    doc.setFontSize(11)
    doc.text('STOCK TABLE REPORT', margin, 12)

    doc.setFontSize(6.5)
    doc.text(`Printed by: ${auth.userDetails?.firstname || ''}`, margin, 17)
    doc.text(`Date: ${new Date().toLocaleString()}`, margin, 21)

    const pageColumns = [...fixedCols, ...pageCols]

    /* -------- HEADERS -------- */
    const headers = pageColumns.map((col) => {
      if (col.name === 'productcode') return 'Code'
      if (col.name === 'productname') return 'Product'
      if (col.name === 'TotalProduct') return 'Total'
      return truncate(col.label, 7)
    })

    /* -------- BODY -------- */
    const body = filteredRows.value.map((row) =>
      pageColumns.map((col) => {
        if (col.name === 'productname') {
          return truncate(row.productname, 18)
        }
        if (typeof col.field === 'function') {
          return col.field(row)
        }
        return row[col.field] ?? row[col.name] ?? ''
      }),
    )

    /* -------- EQUILIBRATED WIDTHS -------- */
    const dynamicWidth = (usableWidth - fixedTotal) / pageCols.length

    const columnStyles = {
      0: { cellWidth: fixedWidths.productcode },
      1: { cellWidth: fixedWidths.productname },
      2: { cellWidth: fixedWidths.TotalProduct },
    }

    pageCols.forEach((_, i) => {
      columnStyles[i + 3] = {
        cellWidth: dynamicWidth,
      }
    })

    autoTable(doc, {
      startY: 26,
      head: [headers],
      body,

      styles: {
        fontSize: 6,
        cellPadding: 0.6,
        overflow: 'ellipsize',
        valign: 'middle',
      },

      headStyles: {
        fontSize: 6.2,
        fillColor: [240, 240, 240],
        textColor: 20,
        halign: 'center',
      },

      columnStyles,
      tableWidth: usableWidth,
      theme: 'grid',
      margin: { left: margin, right: margin },
    })
  })

  doc.save('stock_table.pdf')
}

function exportExcelTable() {
  const data = filteredRows.value.map((row) => {
    const obj = {}
    filteredColumns.value.forEach((col) => {
      if (typeof col.field === 'function') {
        obj[col.label] = col.field(row)
      } else {
        obj[col.label] = row[col.field] ?? row[col.name] ?? ''
      }
    })
    return obj
  })

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock')

  XLSX.writeFile(workbook, 'stock_table.xlsx')
}
</script>

<style scoped>
.text-bold {
  font-weight: bold;
}
</style>
