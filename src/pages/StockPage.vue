<template>
  <q-page class="flex flex-center q-pa-md">
    <q-card flat class="q-pa-md" style="max-width: 900px; width: 100%">
      <q-banner class="bg-orange-8 text-white q-mb-md" rounded dense> 🏪 Stock Overview </q-banner>

      <!-- Tabs -->
      <q-tabs v-model="tab" class="bg-grey-9 text-white rounded-borders" dense align="justify">
        <q-tab name="reports" icon="assessment" label="Reports" class="text-orange" />
        <q-tab name="dispatches" icon="local_shipping" label="Dispatches" class="text-cyan" />
      </q-tabs>

      <q-separator />

      <!-- Tab Panels -->
      <q-tab-panels v-model="tab" animated class="q-mt-md">
        <!-- Reports Tab -->
        <q-tab-panel name="reports">
          <!-- DPC Selector -->
          <div v-if="['Admin', 'SuperAdmin'].includes(auth.userDetails?.role)" class="q-mb-md">
            <q-select
              v-model="form.dpccode"
              :options="dpcOptions"
              label="Select DPC or Main Store"
              outlined
              dense
              class="custom-form"
              @update:model-value="
                () => {
                  pagination.page = 1
                  fetchStock()
                }
              "
            />
          </div>

          <!-- 🔍 Search Bar -->
          <div v-if="stockData.length" class="q-mb-md">
            <q-input
              v-model="searchQuery"
              outlined
              dense
              debounce="300"
              placeholder="Search by product name..."
              clearable
              :disable="loading"
            >
              <template v-slot:prepend>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>

          <!-- Loading -->
          <div v-if="loading" class="text-center q-pa-lg">
            <q-spinner color="primary" size="2em" />
            <div>Loading stock data...</div>
          </div>

          <!-- Stock Table -->
          <div v-else class="table-responsive">
            <q-table
              :rows="filteredStockData"
              :columns="columns"
              row-key="productcode"
              flat
              bordered
              class="custom-list"
              :pagination="pagination"
              @request="onRequest"
              rows-per-page-label="Rows per page"
            >
              <template v-slot:body-cell-quantity="props">
                <q-td :props="props">
                  <span :class="props.row.quantity <= 5 ? 'text-negative' : ''">
                    {{ props.row.quantity.toLocaleString() }}
                  </span>
                </q-td>
              </template>

              <template v-slot:body-cell-lastmodified="props">
                <q-td :props="props">
                  {{ new Date(props.row.lastmodified).toLocaleString() }}
                </q-td>
              </template>

              <template v-slot:no-data>
                <div class="text-center text-grey q-pa-md">No stock found for this location.</div>
              </template>
            </q-table>
          </div>
        </q-tab-panel>

        <!-- Dispatches Tab -->
        <q-tab-panel name="dispatches" class="text-center text-grey q-pa-lg">
          <q-icon name="local_shipping" size="48px" class="q-mb-md text-cyan" />
          <div class="text-subtitle1">🚚 Dispatches section coming soon</div>
          <div class="text-caption q-mt-sm">
            This tab will handle dispatch management between DPCs and Main Store.
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-page>
</template>

<script setup>
// Vue, stock data, and authenticated-user dependencies.
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'boot/supabase'
import { useAuth } from 'stores/auth'

// Selected location, stock rows, and table/search state.
const $q = useQuasar()
const auth = useAuth()

const tab = ref('reports') // 👈 default tab
const form = ref({ dpccode: null })
const dpcOptions = ref([])
const stockData = ref([])
const loading = ref(false)
const searchQuery = ref('')
const columns = [
  { name: 'productcode', label: 'Code', field: 'productcode', align: 'left' },
  { name: 'productname', label: 'Product Name', field: 'productname', align: 'left' },
  { name: 'quantity', label: 'Qty', field: 'quantity', align: 'right' },
  { name: 'lastmodified', label: 'Last Modified', field: 'lastmodified', align: 'left' },
  { name: 'modifiedby', label: 'Modified By', field: 'modifiedby', align: 'left' },
]

// ✅ Fetch available DPCs for Admin/SuperAdmin
onMounted(async () => {
  if (['Admin', 'SuperAdmin'].includes(auth.userDetails?.role)) {
    const { data, error } = await supabase.from('dpc').select('dpccode, dpcname')
    if (error) {
      $q.notify({ type: 'negative', message: 'Failed to load DPC list.' })
      return
    }

    // Add MainStore option + all DPCs
    dpcOptions.value = [
      { label: 'Main Store', value: 'MAIN' },
      ...data.map((d) => ({
        label: d.dpcname,
        value: d.dpccode,
      })),
    ]
  }

  // Preselect DPC based on user role
  if (auth.userDetails?.role === 'User') {
    form.value.dpccode = auth.userDetails?.dpc_id
    fetchStock()
  }
})

const pagination = ref({
  page: 1,
  rowsPerPage: 10, // default
  rowsPerPageOptions: [10, 20, 50, 100, 0], // 0 means “All” in Quasar
  rowsNumber: 0,
})

async function fetchStock() {
  let selectedCode = form.value.dpccode

  if (typeof selectedCode === 'object' && selectedCode !== null) {
    selectedCode = selectedCode.value
  }

  console.log('📦 Selected DPC Code:', selectedCode)
  if (!selectedCode) return

  loading.value = true
  stockData.value = []

  try {
    const tableName = selectedCode === 'MAIN' ? 'mainstore' : `${selectedCode}_STOCK`
    console.log('🧾 Table name being queried:', tableName)

    // Fetch all records (no pagination range)
    const { data, error } = await supabase
      .from(tableName)
      .select('productcode, productname, quantity, lastmodified, modifiedby')
      .order('productname', { ascending: true })

    if (error) throw error

    stockData.value = data || []
    pagination.value.rowsNumber = stockData.value.length
  } catch (err) {
    console.error('❌ Stock fetch error:', err)
    $q.notify({
      type: 'negative',
      message: `Error loading stock for ${form.value.dpccode}.`,
    })
  } finally {
    loading.value = false
  }
}

// No backend pagination now, so just update pagination info
function onRequest(props) {
  pagination.value = props.pagination
}

// Computed list filtered by search
const filteredStockData = computed(() => {
  if (!searchQuery.value.trim()) return stockData.value
  const q = searchQuery.value.toLowerCase()
  return stockData.value.filter((item) => item.productname?.toLowerCase().includes(q))
})

// Triggered when the user changes page or rows per page
//function onRequest(props) {
//pagination.value = props.pagination
// fetchStock()
//}
</script>

<style scoped>
.table-responsive {
  overflow-x: auto;
}

.custom-list {
  font-size: 14px;
  border: 1.5px solid #1b5e20;
  background-color: #f7f3f3;
  border-radius: 6px;
}

.custom-form ::v-deep(.q-field--outlined .q-field__control) {
  border: 2px solid #b6acac !important;
  border-radius: 8px;
}

.custom-form ::v-deep(.q-field--outlined:hover .q-field__control) {
  border-color: #111 !important;
}

.custom-form ::v-deep(.q-field--outlined.q-field--focused .q-field__control) {
  border: 2px solid #0d47a1 !important;
  box-shadow: 0 0 4px rgba(13, 71, 161, 0.5);
}

/* Responsive tweaks */
@media (max-width: 600px) {
  .custom-list {
    font-size: 13px;
  }
}
</style>
