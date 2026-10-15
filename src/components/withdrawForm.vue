<template>
  <div class="column q-gutter-y-lg q-pb-xl" style="max-width: 900px; margin: auto">
    <q-card flat bordered class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md">
      <div class="row items-center q-gutter-sm q-mb-md text-blue-grey-9">
        <q-icon name="undo" size="22px" class="text-emerald-600" />
        <div class="text-subtitle1 text-bold">New Withdrawal</div>
      </div>

      <q-form
        ref="formRef"
        @submit.prevent="submitWithdrawJS"
        class="column"
        style="gap: 20px"
      >
        <!-- Withdraw type -->
        <q-btn-toggle
          v-model="withdrawType"
          :options="withdrawOptions"
          unelevated
          no-caps
          spread
          toggle-color="blue-grey-9"
          color="grey-2"
          text-color="blue-grey-9"
          class="rounded-lg border border-slate-200"
        />

        <div class="row q-col-gutter-x-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="selectedFrom"
              :options="fromOptions"
              option-label="name"
              option-value="code"
              label="From"
              dense
              outlined
              emit-value
              map-options
              options-dense
              behavior="menu"
              popup-content-class="rounded-lg"
            >
              <template #prepend><q-icon name="north_east" size="18px" /></template>
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section avatar style="min-width: 32px">
                    <q-icon :name="withdrawType === 'SHOP' ? 'storefront' : 'warehouse'" size="18px" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ scope.opt.name }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.code }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item><q-item-section class="text-grey">No locations available</q-item-section></q-item>
              </template>
            </q-select>
          </div>

          <div class="col-12 col-sm-6">
            <q-select
              v-model="selectedTo"
              :options="toOptions"
              option-label="name"
              option-value="code"
              label="To"
              dense
              outlined
              emit-value
              map-options
              options-dense
              behavior="menu"
              popup-content-class="rounded-lg"
            >
              <template #prepend><q-icon name="south_west" size="18px" /></template>
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section avatar style="min-width: 32px">
                    <q-icon name="warehouse" size="18px" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ scope.opt.name }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.code }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item><q-item-section class="text-grey">No locations available</q-item-section></q-item>
              </template>
            </q-select>
          </div>
        </div>

        <!-- Product -->
        <q-select
          v-model="selectedProduct"
          :options="filteredProducts"
          option-label="productname"
          option-value="productcode"
          label="Select Product"
          dense
          outlined
          emit-value
          map-options
          use-input
          input-debounce="300"
          fill-input
          hide-selected
          options-dense
          behavior="menu"
          popup-content-class="rounded-lg"
          @filter="filterProducts"
          @update:model-value="onProductSelected"
        >
          <template #prepend><q-icon name="inventory_2" size="18px" /></template>
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.productname }}</q-item-label>
                <q-item-label caption>{{ scope.opt.productcode }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <template #no-option>
            <q-item><q-item-section class="text-grey">No products found</q-item-section></q-item>
          </template>
        </q-select>

        <div class="row q-col-gutter-x-md q-mb-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="availableStock"
              label="Available Stock"
              readonly
              dense
              outlined
              input-class="text-blue text-bold text-center"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="quantity"
              type="number"
              label="Quantity to Withdraw"
              dense
              outlined
              lazy-rules
              :rules="[
                (val) => val > 0 || 'Enter a valid quantity',
                (val) => val <= availableStock || 'Cannot exceed available stock',
              ]"
            />
          </div>
        </div>

        <q-btn
          label="Submit Withdrawal"
          icon="send"
          type="submit"
          unelevated
          no-caps
          class="bg-blue-grey-9 text-white rounded-lg"
          :disable="!formReady"
        />
      </q-form>
    </q-card>

    <!-- My / all withdrawals report -->
    <q-card flat bordered class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="row items-center q-gutter-sm text-blue-grey-9">
          <q-icon name="history" size="22px" class="text-emerald-600" />
          <div class="text-subtitle1 text-bold">
            {{ isSuperAdmin ? 'All Withdrawals' : 'My Withdrawals' }}
          </div>
        </div>
        <div class="row items-center q-gutter-sm">
          <q-chip dense square class="bg-slate-100 text-slate-700">
            {{ filteredReportRows.length }} record{{ filteredReportRows.length === 1 ? '' : 's' }}
          </q-chip>
          <q-btn
            dense
            unelevated
            no-caps
            icon="grid_on"
            label="Excel"
            class="bg-emerald-600 text-white rounded-lg q-px-sm"
            :disable="!filteredReportRows.length"
            @click="exportReport('excel')"
          />
          <q-btn
            dense
            unelevated
            no-caps
            icon="picture_as_pdf"
            label="PDF"
            class="bg-blue-grey-9 text-white rounded-lg q-px-sm"
            :disable="!filteredReportRows.length"
            @click="exportReport('pdf')"
          />
        </div>
      </div>

      <div class="row q-col-gutter-sm items-end q-mb-sm">
        <div class="col-6 col-sm-3">
          <q-input v-model="reportFrom" type="date" label="From date" dense outlined />
        </div>
        <div class="col-6 col-sm-3">
          <q-input v-model="reportTo" type="date" label="To date" dense outlined />
        </div>
        <div v-if="isSuperAdmin" class="col-12 col-sm-3">
          <q-select
            v-model="reportUser"
            :options="reportUserOptions"
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
        <div class="col-12 col-sm-3">
          <q-btn
            label="Apply"
            icon="search"
            unelevated
            no-caps
            class="bg-blue-grey-9 text-white rounded-lg full-width"
            :loading="reportLoading"
            @click="fetchMyWithdraws"
          />
        </div>
      </div>

      <div class="row items-center justify-between rounded-lg border border-slate-200 bg-slate-50 q-pa-sm q-px-md q-mb-md">
        <div class="row items-center q-gutter-sm text-slate-700">
          <q-icon name="payments" size="20px" class="text-emerald-600" />
          <span class="text-caption">Total product value (distributor price)</span>
        </div>
        <div class="text-subtitle1 text-bold text-blue-grey-9">{{ formatMoney(reportValue) }}</div>
      </div>

      <q-table
        v-model:pagination="reportPagination"
        flat
        dense
        row-key="id"
        :rows="filteredReportRows"
        :columns="reportColumns"
        :loading="reportLoading"
        :rows-per-page-options="[10, 25, 50, 0]"
        table-header-class="bg-slate-100 text-slate-700"
        no-data-label="No withdrawals in this period"
      />
    </q-card>
  </div>
</template>

<script setup>
// Withdrawal form state, stock queries, activity logging, and exports.
import { ref, computed, onMounted, watch } from 'vue'
import { Dialog, useQuasar } from 'quasar'
import { supabase } from 'src/boot/supabase'
import { logActivity, ACTIVITY_TYPES } from 'src/utils/activityLog'
import { useAuth } from 'stores/auth'
import { buildExportData, buildMeta, exportExcel, exportPdf } from 'src/utils/reportExport'
import { fetchPriceMap, totalValue, formatMoney } from 'src/utils/productValue'

const $q = useQuasar()
const auth = useAuth()

// 🟦 Form state
const withdrawType = ref('DPC') // ✅ Default to Province (DPC)
const selectedFrom = ref(null)
const selectedTo = ref(null)
const selectedProduct = ref(null)
const availableStock = ref(0)
const quantity = ref(0)
const formRef = ref(null)
// 🟦 Options
const withdrawOptions = [
  { label: 'DPC', value: 'DPC' },
  { label: 'SHOP', value: 'SHOP' },
]

// 🟦 Data lists
const activeProducts = ref([])
const provinceOptions = ref([])
const shopOptions = ref([])
const fromOptions = ref([])
const toOptions = ref([])

// ✅ Fetch provinces for the current user’s country
async function fetchProvinces() {
  const { data, error } = await supabase
    .from('province')
    .select('name, province_code')
    .eq('country_code', auth.userDetails?.country_code)

  if (!error && data) provinceOptions.value = data
}

// ✅ Fetch shops based on user’s role
async function fetchShops() {
  let query = supabase.from('shops').select('shopcode, shop_name, province_code, country_code')

  if (auth.userDetails?.role === 'Admin') {
    query = query.eq('province_code', auth.userDetails?.province_code)
  } else if (auth.userDetails?.role === 'SuperAdmin') {
    query = query.eq('country_code', auth.userDetails?.country_code)
  }

  const { data, error } = await query
  if (!error && data) shopOptions.value = data
}

// ✅ Fetch active products
async function fetchActiveProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('productname, productcode')
    .eq('status', 'active')

  if (!error && data) {
    activeProducts.value = data
    filteredProducts.value = data // 👈 important
  }
}

function onProductSelected() {
  // 🚫 FROM not selected
  if (!selectedFrom.value) {
    $q.notify({
      type: 'warning',
      message: 'Please select FROM location first',
      position: 'top',
    })

    // 🔄 Reset product
    selectedProduct.value = null
    availableStock.value = 0
    return
  }

  // ✅ FROM selected → proceed
  fetchAvailableStock()
}

// ✅ Populate select lists based on selected type
function populateOptions() {
  if (withdrawType.value === 'DPC') {
    if (auth.userDetails?.role === 'SuperAdmin') {
      // SuperAdmin → can withdraw from any province
      fromOptions.value = provinceOptions.value.map((p) => ({
        name: p.name,
        code: p.province_code,
      }))
      toOptions.value = provinceOptions.value.map((p) => ({ name: p.name, code: p.province_code }))
    } else {
      // Admin → cannot withdraw from DPC
      fromOptions.value = [] // empty
      toOptions.value = [] // empty
      selectedFrom.value = null
      selectedTo.value = null
      $q.notify({
        type: 'warning',
        message: 'Admins cannot withdraw from DPC. Please select SHOP.',
      })
    }
  } else if (withdrawType.value === 'SHOP') {
    // FROM → only shops within admin's province
    let filteredShops = shopOptions.value
    if (auth.userDetails?.role === 'Admin') {
      filteredShops = shopOptions.value.filter(
        (s) => s.province_code === auth.userDetails.province_code,
      )
    }

    fromOptions.value = filteredShops.map((s) => ({ name: s.shop_name, code: s.shopcode }))

    // TO → province store (Admin can only return to their province)
    let filteredProvinces = provinceOptions.value
    if (auth.userDetails?.role === 'Admin') {
      filteredProvinces = provinceOptions.value.filter(
        (p) => p.province_code === auth.userDetails.province_code,
      )
    }
    toOptions.value = filteredProvinces.map((p) => ({ name: p.name, code: p.province_code }))

    // Reset selected values
    selectedFrom.value = null
    selectedTo.value = null
  }
}

const filteredProducts = ref([])

/**
 * Called automatically when user types in the select
 */
function filterProducts(val, update) {
  // 🚫 Prevent searching before FROM is selected
  if (!selectedFrom.value) {
    update(() => {
      filteredProducts.value = []
    })
    return
  }

  update(() => {
    if (!val) {
      filteredProducts.value = activeProducts.value
    } else {
      const needle = val.toLowerCase()
      filteredProducts.value = activeProducts.value.filter((p) =>
        p.productname.toLowerCase().includes(needle),
      )
    }
  })
}

watch(withdrawType, async (newVal, oldVal) => {
  if (oldVal && newVal !== oldVal) {
    Dialog.create({
      title: 'Confirm Switch',
      message: `Switch withdraw type to ${newVal}? This will reset your form.`,
      cancel: true,
      persistent: true,
    })
      .onOk(() => {
        selectedFrom.value = null
        selectedTo.value = null
        selectedProduct.value = null
        availableStock.value = 0
        quantity.value = null
        populateOptions() // applies role restrictions
      })
      .onCancel(() => {
        withdrawType.value = oldVal // revert
      })
  } else {
    populateOptions()
  }
})

// ✅ Watcher for withdrawType — triggers when user switches
watch(withdrawType, async (newVal, oldVal) => {
  if (oldVal && newVal !== oldVal) {
    Dialog.create({
      title: 'Confirm Switch',
      message: `Switch withdraw type to ${newVal}? This will reset your form.`,
      cancel: true,
      persistent: true,
    })
      .onOk(() => {
        selectedFrom.value = null
        selectedTo.value = null
        selectedProduct.value = null
        availableStock.value = 0
        quantity.value = null
        populateOptions()
      })
      .onCancel(() => {
        withdrawType.value = oldVal // revert to previous
      })
  } else {
    // Initial mount setup
    populateOptions()
  }
})

// ✅ Fetch available stock from dynamic table
async function fetchAvailableStock() {
  if (!withdrawType.value || !selectedFrom.value || !selectedProduct.value) return

  // Determine the table name based on withdraw type
  let tableName = ''
  if (withdrawType.value === 'DPC') {
    // For provinces, table name is just the province_code
    tableName = selectedFrom.value
  } else if (withdrawType.value === 'SHOP') {
    // For shops, table name is <shopcode>_STOCK
    tableName = `${selectedFrom.value}_STOCK`
  }

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('quantity')
      .eq('productcode', selectedProduct.value)
      .maybeSingle()

    if (!error && data) {
      availableStock.value = data.quantity || 0
    } else {
      availableStock.value = 0
    }
  } catch (err) {
    console.error('Error fetching stock:', err)
    availableStock.value = 0
  }
}

// Same payload reuses the same id so a retry after a lost response applies only once
let pendingWithdraw = { key: null, id: null }
function withdrawRequestId(...parts) {
  const key = JSON.stringify(parts)
  if (pendingWithdraw.key !== key) pendingWithdraw = { key, id: crypto.randomUUID() }
  return pendingWithdraw.id
}

const submitWithdrawJS = async () => {
  // 🔐 Always validate the form first
  const valid = await formRef.value.validate()
  if (!valid) return

  try {
    const qty = quantity.value
    const product = selectedProduct.value
    const currentUser = auth.userDetails?.firstname || 'Unknown'

    // 🔹 Determine FROM and TO
    let fromTable
    let toProvince

    if (withdrawType.value === 'DPC') {
      // Province → Province
      fromTable = selectedFrom.value.toUpperCase()
      toProvince = selectedTo.value.toUpperCase()
    } else if (withdrawType.value === 'SHOP') {
      // Shop → Province
      fromTable = `${selectedFrom.value.toUpperCase()}_STOCK`
      toProvince = selectedTo.value.toUpperCase()
    } else {
      throw new Error('Invalid withdrawal type')
    }

    // 🚀 Call RPC
    const { error } = await supabase.rpc('withdraw_stock', {
      p_from_table: fromTable,
      p_to_province: toProvince,
      p_productcode: product,
      p_quantity: qty,
      p_createdby: currentUser,
      p_request_id: withdrawRequestId(fromTable, toProvince, product, qty),
    })

    if (error) throw error
    pendingWithdraw = { key: null, id: null }

    logActivity(ACTIVITY_TYPES.WITHDRAWAL, {
      reference: product,
      description: `Withdrawal ${qty} × ${product} from ${fromTable} to ${toProvince}`,
    })

    // ✅ Success
    $q.notify({
      type: 'positive',
      message: `📦 ${qty} ${product} transferred successfully`,
    })

    // 🔄 Reset form state
    selectedFrom.value = null
    selectedTo.value = null
    selectedProduct.value = null
    quantity.value = 0
    availableStock.value = 0

    formRef.value.resetValidation()
    fetchMyWithdraws()
  } catch (err) {
    console.error(err)

    $q.notify({
      type: 'negative',
      message: err.message || 'Withdrawal failed',
    })
  }
}

// 🧠 Form Ready Check
const formReady = computed(() => {
  return (
    !!withdrawType.value &&
    !!selectedFrom.value &&
    !!selectedTo.value &&
    !!selectedProduct.value &&
    quantity.value > 0 &&
    quantity.value <= availableStock.value
  )
})

// 🟩 On mount: load data and default DPC mode
onMounted(async () => {
  prices.value = await fetchPriceMap()
  await fetchProvinces()
  await fetchShops()
  await fetchActiveProducts()
  populateOptions()
  await fetchMyWithdraws()
})

// 🟦 My withdrawals report (defaults to the current month)
const pad = (n) => String(n).padStart(2, '0')
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date()
const reportFrom = ref(toISODate(new Date(now.getFullYear(), now.getMonth(), 1)))
const reportTo = ref(toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)))
const reportRows = ref([])
const reportLoading = ref(false)
const reportUser = ref('All users')
const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')

const reportUserOptions = computed(() => [
  'All users',
  ...new Set(reportRows.value.map((r) => r.createdby).filter(Boolean)),
])
const filteredReportRows = computed(() =>
  !isSuperAdmin.value || reportUser.value === 'All users'
    ? reportRows.value
    : reportRows.value.filter((r) => r.createdby === reportUser.value),
)

const reportColumns = [
  { name: 'from_location', label: 'From', field: 'from_location', align: 'left', sortable: true },
  { name: 'to_location', label: 'To', field: 'to_location', align: 'left', sortable: true },
  { name: 'productcode', label: 'Product', field: 'productcode', align: 'left', sortable: true },
  { name: 'quantity', label: 'Qty', field: 'quantity', align: 'right', sortable: true },
  {
    name: 'datecreated',
    label: 'Date / Time',
    field: 'datecreated',
    align: 'left',
    sortable: true,
    format: (val) => (val ? new Date(val).toLocaleString() : ''),
  },
  { name: 'createdby', label: 'Username', field: 'createdby', align: 'left', sortable: true },
]

const reportPagination = ref({ sortBy: 'datecreated', descending: true, rowsPerPage: 10 })
const prices = ref({})
const reportValue = computed(() => totalValue(filteredReportRows.value, prices.value))

function exportReport(kind) {
  const { head, body } = buildExportData(
    reportColumns,
    filteredReportRows.value,
    reportPagination.value,
  )
  const title = isSuperAdmin.value ? 'All Withdrawals' : 'My Withdrawals'
  const payload = {
    title,
    meta: buildMeta({
      from: reportFrom.value,
      to: reportTo.value,
      printedBy: auth.userDetails?.firstname,
      extra: [['User', isSuperAdmin.value ? reportUser.value : auth.userDetails?.firstname || ''], ['Records', body.length], ['Total Value', formatMoney(reportValue.value)]],
    }),
    filename: `Withdrawals_${reportFrom.value}_${reportTo.value}`,
    head,
    body,
  }
  if (kind === 'excel') exportExcel(payload)
  else exportPdf(payload)
}

async function fetchMyWithdraws() {
  if (!reportFrom.value || !reportTo.value) return
  if (reportFrom.value > reportTo.value) {
    $q.notify({ type: 'warning', message: 'Start date must be before end date.' })
    return
  }

  const username = auth.userDetails?.firstname
  if (!username) return

  const [y, m, d] = reportTo.value.split('-').map(Number)
  const endExclusive = toISODate(new Date(y, m - 1, d + 1))

  reportLoading.value = true
  try {
    let query = supabase
      .from('withdraws')
      .select('id, from_location, to_location, productcode, quantity, datecreated, createdby')
      .gte('datecreated', `${reportFrom.value}T00:00:00`)
      .lt('datecreated', `${endExclusive}T00:00:00`)
      .order('datecreated', { ascending: false })

    if (!isSuperAdmin.value) query = query.eq('createdby', username)

    const { data, error } = await query

    if (error) throw error
    reportRows.value = data || []
    reportUser.value = 'All users'
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message || 'Failed to load withdrawals' })
  } finally {
    reportLoading.value = false
  }
}
</script>
