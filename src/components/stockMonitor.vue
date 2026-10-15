<template>
  <q-dialog v-model="showExportChoice">
    <q-card style="width: 800px">
      <q-card-section>
        <div class="text-h6">Choose Export Type</div>
        <div class="text-subtitle2">Select how you want the PDF exported.</div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Detailed" color="primary" @click="exportDetailed" />
        <q-btn flat label="Summary" color="primary" @click="exportSummary" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <q-page padding>
    <div class="pivot-container">
      <q-card
        class="q-pa-sm bg-transparent"
        style="
          max-width: 1600px;
          width: 100%;
          border: 0px solid green;
          border-radius: 0;
          box-shadow: none;
        "
      >
        <!-- HEADER -->
        <div style="width: 100%; margin: 0 auto"></div>
        <q-card-section class="q-pa-sm">
          <!-- TITLE -->
          <div class="q-mb-sm">
            <h6 class="q-ma-none">Stock Pivot</h6>
            <div class="text-subtitle2">Products as rows; provinces + shops as columns</div>
          </div>

          <!-- SEARCH BAR (FULL WIDTH) -->
          <q-input
            v-model="searchText"
            filled
            label="Search Product by Name"
            debounce="300"
            class="q-mb-md full-width"
          />
          <q-card flat bordered class="q-pa-sm q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Show / Hide Columns</div>

            <!-- Columns ready -->
            <div v-if="allColumns.length" class="row q-col-gutter-sm">
              <div
                v-for="col in allColumns"
                :key="col.name"
                class="col-6 col-sm-4 col-md-3 col-lg-2"
              >
                <q-checkbox v-model="visibleColumns" :val="col.name" :label="col.label" dense />
              </div>
            </div>

            <!-- Loading fallback -->
            <div v-else class="text-caption text-grey">Columns loading…</div>

            <q-separator spaced />

            <div class="row q-gutter-sm">
              <q-btn
                size="sm"
                outline
                label="Select All"
                color="primary"
                @click="selectAllColumns"
              />
              <q-btn
                size="sm"
                outline
                label="Clear All"
                color="negative"
                @click="clearAllColumns"
              />
            </div>
          </q-card>

          <!-- BUTTONS ROW -->
          <div class="row q-gutter-sm items-center justify-between">
            <!-- LEFT SIDE BUTTONS -->
            <div class="row q-gutter-sm items-center">
              <!-- Refresh -->
              <q-btn dense color="primary" label="Refresh" @click="buildStockPivot" />

              <!-- Export -->
              <q-btn
                dense
                color="primary"
                icon="picture_as_pdf"
                label="Export PDF"
                @click="openExportChoiceDialog"
              />
            </div>

            <!-- COLUMN VISIBILITY MENU (RIGHT) -->
            <!-- 
            -->
          </div>
        </q-card-section>

        <q-separator />

        <!-- TABLE -->

        <!-- LIST VIEW -->
        <q-card-section>
          <q-list bordered separator class="rounded-borders">
            <q-item-label header class="text-bold text-primary">
              Stock Summary (List View)
            </q-item-label>

            <q-expansion-item
              v-for="row in filteredRows"
              :key="row.productcode"
              expand-separator
              icon="inventory_2"
            >
              <!-- Custom Header -->
              <template #header>
                <div class="row items-center justify-between" style="width: 100%">
                  <!-- Left side: Product Name + Code + Badge -->
                  <div class="column q-gutter-xs">
                    <div class="text-subtitle2">{{ row.productname }}</div>

                    <div class="row items-center q-gutter-sm">
                      <div class="text-caption">Code: {{ row.productcode }}</div>
                      <q-badge
                        :label="row.TotalProduct"
                        :color="getBadgeColor(row.TotalProduct)"
                        class="text-white flex items-center justify-center"
                        style="min-width: 36px; height: 18px; font-size: 0.75rem; line-height: 18px"
                      />
                    </div>
                  </div>

                  <!-- Right side: View Details text -->
                  <div
                    class="text-caption text-primary cursor-pointer"
                    @click.stop="$refs['expItem' + row.productcode]?.toggle()"
                  ></div>
                </div>
              </template>

              <!-- MAIN SUMMARY -->
              <q-card class="q-pa-sm q-mb-sm">
                <div class="row justify-between">
                  <div class="text-subtitle2">Total Stock</div>
                  <div class="text-h6 text-primary">{{ row.TotalProduct }}</div>
                </div>
              </q-card>

              <!-- DETAILS AS A LIST -->
              <q-list bordered separator dense>
                <q-item
                  v-for="col in filteredColumns.filter(
                    (c) => !['productcode', 'productname', 'TotalProduct'].includes(c.name),
                  )"
                  :key="col.name"
                >
                  <q-item-section>
                    <q-item-label class="text-weight-bold">{{ col.label }}</q-item-label>
                  </q-item-section>

                  <q-item-section side>
                    <q-btn
                      flat
                      class="uniform-btn"
                      :style="{
                        color: col.classes?.includes('light-green') ? '#2E7D32' : '#E65100',
                      }"
                      :label="String(row[col.label] ?? 0)"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-expansion-item>
          </q-list>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
// Reactive inventory data, saved column preferences, and PDF export.
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'boot/supabase'
import { useAuth } from 'stores/auth'
import jsPDF from 'jspdf'
//import autoTable from 'jspdf-autotable'
// Table, filtering, and export state for the stock monitor.
const showExportDialog = ref(false)
//const mode = ref('summary') // summary | detailed

const loading = ref(false)
const rows = ref([])

const columns = ref([])
const allColumns = ref([])
const visibleColumns = ref([])

const $q = useQuasar()
const auth = useAuth()

const searchText = ref('')

const filteredRows = computed(() => {
  if (!searchText.value.trim()) return rowsWithTotal.value

  return rowsWithTotal.value.filter((r) =>
    r.productname.toLowerCase().includes(searchText.value.toLowerCase()),
  )
})

const getBadgeColor = (value) => {
  if (value === 0) return 'red'
  if (value < 20) return 'yellow-14'
  if (value > 50) return 'light-green-14' // Ensure this exists in your theme
  return 'grey-4'
}

// ✅ Rows with TotalProduct automatically calculated
const rowsWithTotal = computed(() => {
  return rows.value.map((row) => {
    let total = 0

    // sum ONLY numeric dynamic columns (province + shop)
    Object.keys(row).forEach((key) => {
      if (key !== 'productcode' && key !== 'productname') {
        const val = Number(row[key])
        if (!isNaN(val)) total += val
      }
    })

    return {
      ...row,
      TotalProduct: total,
    }
  })
})

// ✅ Computed: only visible columns shown
const filteredColumns = computed(() =>
  columns.value.filter((c) => visibleColumns.value.includes(c.name)),
)

// ✅ Watch: persist visibility preferences
watch(visibleColumns, (val) => localStorage.setItem('visibleStockCols', JSON.stringify(val)), {
  deep: true,
})

// ✅ On mount: restore visibility + build data
onMounted(() => {
  const saved = localStorage.getItem('visibleStockCols')
  if (saved) visibleColumns.value = JSON.parse(saved)
  buildStockPivot()
})

// ✅ Select all columns
function selectAllColumns() {
  visibleColumns.value = allColumns.value.map((c) => c.name)
}

// ✅ Clear all columns
function clearAllColumns() {
  visibleColumns.value = []
}

// ✅ Fetch stock per table
async function fetchStockForTable(tableName, productCodes = []) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('productcode, quantity')
      .in('productcode', productCodes)
    if (error) {
      console.warn(`Error reading ${tableName}:`, error.message)
      return new Map()
    }
    const map = new Map()
    for (const r of data || []) map.set(r.productcode, Number(r.quantity || 0))
    return map
  } catch (err) {
    console.error(`fetchStockForTable(${tableName}) threw:`, err)
    return new Map()
  }
}

// ✅ Build pivot data
async function buildStockPivot() {
  try {
    loading.value = true
    const countryCode = auth.userDetails?.country_code
    if (!countryCode) throw new Error('Current user country_code not available')

    // 🔹 Fetch products
    const { data: productsData, error: prodErr } = await supabase
      .from('products')
      .select('productcode, productname')
      .eq('status', 'active')
      .order('productname')
    if (prodErr) throw prodErr
    const products = productsData || []
    const productCodes = products.map((p) => p.productcode)

    // 🔹 Fetch provinces
    const { data: provincesData, error: provErr } = await supabase
      .from('province')
      .select('province_code, name')
      .eq('country_code', countryCode)
      .order('name')
    if (provErr) throw provErr
    const provinces = provincesData || []
    const provCodes = provinces.map((p) => p.province_code)

    // 🔹 Fetch shops
    let shops = []
    if (provCodes.length > 0) {
      const { data: shopsData, error: shopErr } = await supabase
        .from('shops')
        .select('shopcode, shop_name, province_code')
        .in('province_code', provCodes)
      if (!shopErr && shopsData) shops = shopsData
    }

    // 🔹 Build location list
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

    // 🔹 Fetch stock data for all
    const stockPromises = locations.map((loc) => fetchStockForTable(loc.tableName, productCodes))
    const stockResults = await Promise.all(stockPromises)
    locations.forEach((loc, i) => (loc.stockMap = stockResults[i]))

    // 🔹 Define columns
    const baseCols = [
      {
        name: 'productcode',
        label: 'Product Code',
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
        style: 'white-space: normal;',
      },
      {
        name: 'TotalProduct',
        label: 'Total',
        field: 'TotalProduct',
        align: 'right',
      },
    ]

    // ✅ Add background colors to province/shop columns
    const locCols = locations.map((loc, i) => ({
      name: `loc_${i}`,
      label: loc.label,
      field: (row) => row[loc.label] ?? 0,
      align: 'center',
      sortable: true,
      classes:
        loc.type === 'province'
          ? 'bg-light-green-14 text-dark text-weight-bold'
          : 'bg-orange text-dark text-weight-bold',
    }))

    columns.value = [...baseCols, ...locCols]
    allColumns.value = [...baseCols, ...locCols]

    // 🔹 Default visible columns
    if (visibleColumns.value.length === 0) {
      visibleColumns.value = baseCols.map((c) => c.name)
    }

    // 🔹 Build rows
    rows.value = products.map((prod) => {
      const row = { productcode: prod.productcode, productname: prod.productname }
      for (const loc of locations) {
        row[loc.label] = loc.stockMap.get(prod.productcode) ?? 0
      }
      return row
    })
  } catch (err) {
    console.error('buildStockPivot error:', err)
    $q.notify({ type: 'negative', message: err.message || 'Failed to build stock report' })
  } finally {
    loading.value = false
  }
}

const showExportChoice = ref(false)

function openExportChoiceDialog() {
  showExportChoice.value = true
}

function exportSummary() {
  showExportChoice.value = false
  exportToPDF('summary')
}

function exportDetailed() {
  showExportChoice.value = false
  exportToPDF('detailed')
}

async function exportToPDF(mode) {
  showExportDialog.value = false

  const doc = new jsPDF('p', 'mm', 'a4')
  let y = 20

  // HEADER
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('STOCK MANIFEST', 14, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Printed By: ${auth.userDetails?.firstname || ''} ${auth.userDetails?.lastname || ''}`,
    14,
    y,
  )
  y += 5
  doc.text(`Print Date: ${new Date().toLocaleString()}`, 14, y)
  y += 8

  doc.line(14, y, 195, y)
  y += 6

  // USE FILTERED ROWS
  filteredRows.value.forEach((row) => {
    // PAGE BREAK
    if (y > 260) {
      doc.addPage()
      y = 20
    }

    // PRODUCT NAME + CODE
    doc.setFontSize(13)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(`${row.productname}  |  Code: ${row.productcode}`, 14, y)
    y += 10

    // SUMMARY OR DETAILED DATA
    const detailRows =
      mode === 'summary'
        ? [{ label: 'Total Stock', value: row.TotalProduct, bold: true }]
        : buildDetailList(row)

    detailRows.forEach((item) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }

      doc.setFontSize(11)
      doc.setFont('helvetica', item.bold ? 'bold' : 'normal')
      doc.setTextColor(0, 0, 0)

      doc.text(item.label, 20, y)
      doc.text(String(item.value), 180, y, { align: 'right' })

      y += 6

      // Line after each row only in detailed mode
      if (mode === 'detailed' && !item.bold) {
        doc.setDrawColor(200)
        doc.line(20, y - 3, 190, y - 3)
        y += 2
      }
    })

    // Divider after product
    doc.setDrawColor(0)
    doc.line(14, y, 195, y)
    y += 6
  })

  doc.save(`STOCK_MANIFEST_${mode.toUpperCase()}.pdf`)
}

// Build list entries for detailed PDF
function buildDetailList(row) {
  const list = []

  // Total Stock first (bold)
  list.push({ label: 'Total Stock', value: row.TotalProduct, bold: true })

  // Add provinces/shops as normal rows
  filteredColumns.value.forEach((c) => {
    if (!['productcode', 'productname', 'TotalProduct'].includes(c.name)) {
      list.push({ label: c.label, value: row[c.label] || 0, bold: false })
    }
  })

  return list
}
</script>

<style scoped>
.uniform-btn {
  min-width: 60px;
  height: 28px;
  font-size: 13px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
}
/* 1. Reduce font sizes on mobile */
@media (max-width: 600px) {
  h6 {
    font-size: 16px !important;
  }

  .text-subtitle2 {
    font-size: 12px !important;
  }

  .q-input input {
    font-size: 13px !important;
  }

  .q-btn {
    font-size: 11px !important;
    padding: 5px 10px !important;
  }

  /* 2. Smaller expansion item header */
  .q-expansion-item__content,
  .q-item,
  .q-item__label {
    font-size: 12px !important;
    line-height: 14px !important;
  }

  /* 3. Allow product names to wrap into 2–3 lines */
  .q-expansion-item .q-item__label {
    white-space: normal !important;
    word-wrap: break-word !important;
  }

  /* 4. Make card full-width and centered */
  .pivot-card {
    width: 100% !important;
    max-width: 500px;
    margin: 0 auto;
  }
}
</style>
