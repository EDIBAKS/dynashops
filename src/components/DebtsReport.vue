<template>
  <q-page class="q-pa-md bg-grey-2">
    <q-card flat bordered class="debts-card">
      <!-- HEADER -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div>
          <div class="text-h5 text-bold text-primary">Debts Report</div>

          <div class="text-caption text-grey">Filter and manage outstanding debts</div>
        </div>
        <div class="col-12 col-md-4">
          <div class="text-caption text-grey q-mb-xs">Search By Name</div>

          <DistributorSearch v-model="filterDistributor" v-model:name="filterDistributorName" />
        </div>

        <div class="col-auto self-end">
          <q-btn
            color="primary"
            icon="refresh"
            label="Refresh"
            unelevated
            :loading="loading"
            @click="fetchDebts"
          />
        </div>
      </div>

      <!-- FILTER AREA -->
      <q-card flat bordered class="q-pa-md filter-card q-mb-lg">
        <!-- TOP FILTERS -->
        <div class="row q-col-gutter-md items-start">
          <!-- START DATE -->
          <div class="col-12 col-md-2">
            <q-input v-model="startDate" type="date" label="Start Date" dense outlined />
          </div>

          <!-- END DATE -->
          <div class="col-12 col-md-2">
            <q-input v-model="endDate" type="date" label="End Date" dense outlined />
          </div>

          <div class="col-12 col-md-2">
            <q-select
              v-model="sortBy"
              :options="sortOptions"
              label="Sort By"
              dense
              outlined
              emit-value
              map-options
            />
          </div>

          <!-- PRODUCT -->
          <!-- PRODUCT NAME SEARCH -->

          <!-- 
           <div class="col-12 col-md-4">
            <q-input
              v-model="productSearchText"
              label="Search Product Name"
              dense
              outlined
              clearable
              debounce="300"
              placeholder="Type product name..."
            >
              <template #prepend>
                <q-icon name="search" />
              </template>
            </q-input>
          </div> 
        -->

          <!-- SHOP -->
          <div class="col-12 col-md-3">
            <q-select
              v-model="selectedShopCode"
              :options="shops"
              option-label="dpcname"
              option-value="dpccode"
              emit-value
              map-options
              clearable
              dense
              outlined
              label="Select Shop"
            />
          </div>
          <div class="col-12 col-md-2">
            <q-btn
              color="primary"
              icon="search"
              label="Apply"
              unelevated
              class="full-width filter-btn"
              @click="fetchDebts"
            />
          </div>

          <!-- REFRESH -->
        </div>

        <!-- SECOND ROW -->
        <!-- SECOND ROW -->
        <div class="row q-col-gutter-md items-start q-mt-sm">
          <!-- DISTRIBUTOR -->

          <!-- PRODUCT NAME SEARCH -->
          <div class="col-12 col-md-4">
            <q-input
              v-model="productSearchText"
              label="Search Product Name"
              dense
              outlined
              clearable
              debounce="300"
              placeholder="Type product name..."
            >
              <template #prepend>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>

          <!-- SORT -->

          <!-- CLEAR -->
          <div class="col-12 col-md-8">
            <div class="row items-center no-wrap q-gutter-sm">
              <q-btn
                flat
                color="negative"
                icon="clear"
                label="Clear Filters"
                class="filter-btn"
                @click="clearFilters"
              />

              <q-btn
                color="green"
                icon="table_view"
                label="Excel"
                unelevated
                @click="exportToExcel"
              />

              <q-btn
                color="red"
                icon="picture_as_pdf"
                label="PDF"
                unelevated
                @click="exportToPDF"
              />
            </div>
          </div>
        </div>
      </q-card>

      <!-- SUMMARY -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12 col-md-4">
          <q-card flat bordered class="summary-card">
            <q-card-section>
              <div class="text-caption text-grey">Total Debt Rows</div>

              <div class="text-h5 text-bold">
                {{ filteredDebts.length }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-4">
          <q-card flat bordered class="summary-card">
            <q-card-section>
              <div class="text-caption text-grey">Total Quantity Owed</div>

              <div class="text-h5 text-bold">
                {{ totalQuantity }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-4">
          <q-card flat bordered class="summary-card">
            <q-card-section>
              <div class="text-caption text-grey">Total Debt Value</div>

              <div class="text-h5 text-bold text-negative">
                {{
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(totalDebtValue)
                }}
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- LOADING -->
      <div v-if="loading" class="text-center q-py-xl">
        <q-spinner color="primary" size="50px" />
      </div>

      <!-- RESULTS -->
      <div v-else-if="debtsByGroup.length">
        <div v-for="group in debtsByGroup" :key="group.key" class="q-mb-xl">
          <!-- GROUP HEADER -->
          <div class="group-header">
            <div>
              <div class="text-subtitle1 text-bold">
                {{ group.shopcode }}
              </div>

              <div class="text-caption">
                {{ group.date }}
              </div>
            </div>

            <q-badge color="white" text-color="primary" :label="`${group.rows.length} Items`" />
          </div>

          <!-- ROWS -->
          <q-list bordered separator>
            <q-item v-for="row in group.rows" :key="row.id">
              <q-item-section>
                <div class="text-subtitle2 text-bold">
                  {{ row.productcode }}
                </div>

                <div class="text-body2">
                  {{ row.productname }}
                </div>

                <div class="row q-col-gutter-sm q-mt-sm">
                  <div class="col-auto">
                    <q-chip dense color="black" text-color="white">
                      Qty: {{ row.quantity }}
                    </q-chip>
                  </div>
                  <div class="col-auto">
                    <q-chip dense color="negative" text-color="white">
                      Value:
                      {{
                        new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        }).format(row.debtvalue || 0)
                      }}
                    </q-chip>
                  </div>

                  <div class="col-auto">
                    <q-chip dense color="primary" text-color="white">
                      {{ row.distributorname }}
                    </q-chip>
                  </div>
                </div>

                <div class="text-caption text-grey q-mt-sm">Added By: {{ row.addedby }}</div>
              </q-item-section>

              <!-- ACTION -->
              <q-item-section side top>
                <q-btn
                  color="green"
                  icon="payments"
                  label="Pay Debt"
                  unelevated
                  :loading="processingId === row.id"
                  @click="confirmDebtClear(row)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </div>

      <!-- EMPTY -->
      <div v-else class="text-center text-grey q-py-xl">No debts found</div>
      <!-- PRODUCT TALLY -->
      <q-card v-if="productTally.length" flat bordered class="q-mt-xl tally-card">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6 text-bold">Product Debt Tally</div>

          <div class="text-caption">Consolidated product totals</div>
        </q-card-section>

        <q-separator />

        <q-table
          flat
          :rows="productTally"
          :columns="tallyColumns"
          row-key="productcode"
          dense
          :pagination="{ rowsPerPage: 0 }"
        >
          <template #body-cell-totalvalue="props">
            <q-td :props="props">
              {{
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(props.row.totalvalue)
              }}
            </q-td>
          </template>

          <template #bottom>
            <div class="full-width row justify-end q-pa-md">
              <div class="text-subtitle1 text-bold text-negative">
                Grand Total:
                {{
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(totalDebtValue)
                }}
              </div>
            </div>
          </template>
        </q-table>
      </q-card>
    </q-card>
  </q-page>
</template>

<script setup>
// Data, UI, and distributor lookup dependencies.
import { ref, computed, onMounted } from 'vue'
import { supabase } from 'boot/supabase'
import { useQuasar } from 'quasar'

import DistributorSearch from 'components/DistributorSearch.vue'
//import ProductSearch from 'components/ProductSearch.vue'
//import ShopSearch from 'components/ShopSearch.vue'

// Component state and role-aware report filters.
const $q = useQuasar()

const debts = ref([])
const products = ref([])
import { useAuth } from 'stores/auth'
const auth = useAuth()
const currentUser = computed(() => {
  console.log('AUTH DETAILS', auth.userDetails)

  return (
    auth.userDetails?.firstname ||
    auth.userDetails?.firstName ||
    auth.user?.user_metadata?.firstname ||
    auth.user?.email ||
    'Unknown User'
  )
})
const loading = ref(false)
const processingId = ref(null)

const productsMap = ref({})

const startDate = ref(new Date().toISOString().split('T')[0])

const endDate = ref(new Date().toISOString().split('T')[0])

const shops = ref([])

import * as XLSX from 'xlsx'

import jsPDF from 'jspdf'

import autoTable from 'jspdf-autotable'

const selectedShopCode = ref('')

// FILTERS
const filterProduct = ref('')
const filterProductName = ref('')

const filterShop = ref('')
const filterShopName = ref('')

const filterDistributor = ref('')
const filterDistributorName = ref('')
const productSearchText = ref('')
// SORT
const sortBy = ref('date_desc')

const sortOptions = [
  {
    label: 'Date Descending',
    value: 'date_desc',
  },
  {
    label: 'Date Ascending',
    value: 'date_asc',
  },
  {
    label: 'Product Code',
    value: 'productcode',
  },
  {
    label: 'Shop Code',
    value: 'shopcode',
  },
  {
    label: 'Distributor',
    value: 'distributor',
  },
]

const tallyColumns = [
  {
    name: 'productcode',
    label: 'Product Code',
    field: 'productcode',
    align: 'left',
  },

  {
    name: 'productname',
    label: 'Product Name',
    field: 'productname',
    align: 'left',
  },

  {
    name: 'totalquantity',
    label: 'Total Quantity',
    field: 'totalquantity',
    align: 'right',
  },

  {
    name: 'totalvalue',
    label: 'Total Value',
    field: 'totalvalue',
    align: 'right',
  },
]

// FETCH PRODUCTS
async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      productcode,
      productname,
      distributorprice
    `,
    )
    .order('productname')

  if (error) {
    console.error(error)
    return
  }

  products.value = data || []

  productsMap.value = data.reduce((acc, p) => {
    acc[p.productcode] = p

    return acc
  }, {})
}

// FETCH DEBTS
async function fetchDebts() {
  loading.value = true

  try {
    let query = supabase.from('debts').select('*').order('date', {
      ascending: false,
    })

    if (startDate.value) {
      query = query.gte('date', startDate.value)
    }

    if (endDate.value) {
      query = query.lte('date', endDate.value)
    }

    const { data, error } = await query

    if (error) throw error

    debts.value = (data || []).map((d) => {
      const product = productsMap.value[d.productcode] || {}

      const distributorprice = Number(product.distributorprice || 0)
      const quantity = Number(d.quantity || 0)

      return {
        ...d,

        productname: product.productname || d.productcode,

        distributorprice,

        debtvalue: distributorprice * quantity,
      }
    })
  } catch (err) {
    console.error(err)

    $q.notify({
      type: 'negative',
      message: err.message || 'Failed to fetch debts',
    })
  } finally {
    loading.value = false
  }
}

// FILTERED
const filteredDebts = computed(() => {
  let filtered = [...debts.value]

  // PRODUCT CODE FILTER
  if (filterProduct.value) {
    filtered = filtered.filter((d) => d.productcode === filterProduct.value)
  }

  // PRODUCT NAME SEARCH
  if (productSearchText.value) {
    const search = productSearchText.value.toLowerCase().trim()

    filtered = filtered.filter((d) => (d.productname || '').toLowerCase().includes(search))
  }

  // SHOP FILTER
  if (selectedShopCode.value) {
    const fullShopCode = `${selectedShopCode.value}_STOCK`

    filtered = filtered.filter((d) => d.shopcode === fullShopCode)
  }

  // DISTRIBUTOR FILTER
  if (filterDistributor.value) {
    filtered = filtered.filter((d) => d.distributoridno === filterDistributor.value)
  }

  // SORTING
  switch (sortBy.value) {
    case 'date_asc':
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date))
      break

    case 'date_desc':
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
      break

    case 'productcode':
      filtered.sort((a, b) => (a.productcode || '').localeCompare(b.productcode || ''))
      break

    case 'shopcode':
      filtered.sort((a, b) => (a.shopcode || '').localeCompare(b.shopcode || ''))
      break

    case 'distributor':
      filtered.sort((a, b) => (a.distributorname || '').localeCompare(b.distributorname || ''))
      break

    case 'productname':
      filtered.sort((a, b) => (a.productname || '').localeCompare(b.productname || ''))
      break
  }

  return filtered
})
// GROUPING
const debtsByGroup = computed(() => {
  const grouped = {}

  filteredDebts.value.forEach((d) => {
    const key = `${d.shopcode}_${d.date}`

    if (!grouped[key]) {
      grouped[key] = {
        key,
        shopcode: d.shopcode,
        date: d.date,
        rows: [],
      }
    }

    grouped[key].rows.push(d)
  })

  return Object.values(grouped)
})

// TOTAL
const totalQuantity = computed(() => {
  return filteredDebts.value.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
})

const totalDebtValue = computed(() => {
  return filteredDebts.value.reduce((sum, row) => {
    return sum + Number(row.debtvalue || 0)
  }, 0)
})

const productTally = computed(() => {
  const grouped = {}

  filteredDebts.value.forEach((row) => {
    const key = row.productcode

    if (!grouped[key]) {
      grouped[key] = {
        productcode: row.productcode,
        productname: row.productname,
        totalquantity: 0,
        totalvalue: 0,
      }
    }

    grouped[key].totalquantity += Number(row.quantity || 0)

    grouped[key].totalvalue += Number(row.debtvalue || 0)
  })

  return Object.values(grouped).sort((a, b) => a.productname.localeCompare(b.productname))
})

// CLEAR FILTERS
function clearFilters() {
  filterProduct.value = ''
  filterProductName.value = ''

  filterShop.value = ''
  filterShopName.value = ''

  filterDistributor.value = ''
  filterDistributorName.value = ''

  sortBy.value = 'date_desc'
}

// CONFIRM
function confirmDebtClear(row) {
  $q.dialog({
    title: 'Confirm Debt Payment',
    message: `Return ${row.quantity} × ` + `${row.productname} back to stock?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    processDebtClear(row)
  })
}

// PROCESS
async function processDebtClear(row) {
  processingId.value = row.id

  try {
    const { error } = await supabase.rpc('clear_debt_and_return_stock', {
      p_debt_id: row.id,
      p_shopcode: row.shopcode,
      p_productcode: row.productcode,
      p_quantity: Number(row.quantity),
    })

    if (error) throw error

    debts.value = debts.value.filter((d) => d.id !== row.id)

    $q.notify({
      type: 'positive',
      message: 'Debt paid successfully.',
    })
  } catch (err) {
    console.error(err)

    $q.notify({
      type: 'negative',
      message: err.message || 'Failed to process debt payment.',
    })
  } finally {
    processingId.value = null
  }
}

async function fetchShops() {
  const { data, error } = await supabase
    .from('dpc')
    .select(
      `
      dpccode,
      dpcname
    `,
    )
    .eq('enabled', true)
    .order('dpcname')

  if (error) {
    console.error(error)

    $q.notify({
      type: 'negative',
      message: 'Failed to load shops',
    })

    return
  }

  shops.value = data || []
}

function exportToExcel() {
  // =========================
  // DETAILED SHEET
  // =========================
  const detailedRows = filteredDebts.value.map((d) => ({
    Date: d.date,
    ShopCode: d.shopcode,
    ProductCode: d.productcode,
    ProductName: d.productname,
    Quantity: d.quantity,
    DistributorPrice: d.distributorprice,
    DebtValue: d.debtvalue,
    Distributor: d.distributorname,
  }))

  // =========================
  // TALLY SHEET
  // =========================
  const tallyRows = productTally.value.map((p) => ({
    ProductCode: p.productcode,
    ProductName: p.productname,
    TotalQuantity: p.totalquantity,
    TotalValue: p.totalvalue,
  }))

  // ADD GRAND TOTAL ROW
  tallyRows.push({})

  tallyRows.push({
    ProductName: 'GRAND TOTAL',
    TotalValue: totalDebtValue.value,
  })

  // =========================
  // CREATE WORKBOOK
  // =========================
  const workbook = XLSX.utils.book_new()

  // DETAILS SHEET
  const detailSheet = XLSX.utils.json_to_sheet(detailedRows)

  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Outstanding Debts')

  // TALLY SHEET
  const tallySheet = XLSX.utils.json_to_sheet(tallyRows)

  XLSX.utils.book_append_sheet(workbook, tallySheet, 'Product Tally')

  // EXPORT
  XLSX.writeFile(workbook, `Outstanding_Debt_Report_${Date.now()}.xlsx`)
}

function exportToPDF() {
  const doc = new jsPDF('landscape')

  const now = new Date()

  // =========================
  // HEADER
  // =========================
  doc.setFontSize(18)

  doc.text('Outstanding Debt Report', 14, 20)

  doc.setFontSize(10)

  doc.text(`Printed By: ${String(currentUser.value)}`, 14, 30)

  doc.text(`Printed On: ${now.toLocaleString()}`, 14, 36)

  // =========================
  // MAIN DETAIL TABLE
  // =========================
  const tableData = filteredDebts.value.map((d) => [
    d.date,
    d.shopcode,
    d.productcode,
    d.productname,
    d.quantity,
    d.distributorprice,
    d.debtvalue,
    d.distributorname,
  ])

  autoTable(doc, {
    startY: 45,

    head: [
      [
        'Date',
        'Shop Code',
        'Product Code',
        'Product Name',
        'Quantity',
        'Unit Price',
        'Debt Value',
        'Distributor',
      ],
    ],

    body: tableData,

    styles: {
      fontSize: 8,
    },

    headStyles: {
      fillColor: [25, 118, 210],
    },
  })

  // =========================
  // PRODUCT TALLY TITLE
  // =========================
  let tallyStartY = doc.lastAutoTable.finalY + 15

  doc.setFontSize(14)

  doc.text('Product Debt Tally', 14, tallyStartY)

  // =========================
  // PRODUCT TALLY TABLE
  // =========================
  const tallyData = productTally.value.map((p) => [
    p.productcode,
    p.productname,
    p.totalquantity,
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(p.totalvalue),
  ])

  autoTable(doc, {
    startY: tallyStartY + 5,

    head: [['Product Code', 'Product Name', 'Total Quantity', 'Total Value']],

    body: tallyData,

    styles: {
      fontSize: 9,
    },

    headStyles: {
      fillColor: [46, 125, 50],
    },
  })

  // =========================
  // GRAND TOTAL
  // =========================
  const grandTotalY = doc.lastAutoTable.finalY + 12

  doc.setFontSize(13)

  doc.text(
    `Grand Total Debt Value: ${new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(totalDebtValue.value)}`,
    14,
    grandTotalY,
  )

  // =========================
  // SAVE
  // =========================
  doc.save(`Outstanding_Debt_Report_${Date.now()}.pdf`)
}

// LOAD
onMounted(async () => {
  await fetchProducts()
  await fetchShops()
  await fetchDebts()
})
</script>

<style scoped>
.debts-card {
  max-width: 1350px;
  margin: 0 auto;
  border-radius: 16px;
  padding: 20px;
}

.filter-card {
  border-radius: 14px;
  background: white;
}

.filter-btn {
  height: 40px;
}

.group-header {
  background: #1976d2;
  color: white;
  padding: 14px;
  border-radius: 10px 10px 0 0;

  display: flex;
  align-items: center;
  justify-content: space-between;
}

.summary-card {
  border-radius: 14px;
}
.tally-card {
  border-radius: 14px;
  overflow: hidden;
}
</style>
