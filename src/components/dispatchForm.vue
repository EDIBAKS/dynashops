<template>
  <q-card
    flat
    bordered
    class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md"
    style="max-width: 900px; margin: auto"
  >
    <div class="row items-center justify-between q-mb-md text-blue-grey-9">
      <div class="row items-center q-gutter-sm">
        <q-icon name="local_shipping" size="22px" class="text-emerald-600" />
        <div class="text-subtitle1 text-bold">New Dispatch</div>
      </div>
      <q-chip dense square class="bg-slate-100 text-slate-700" icon="badge">
        {{ auth.userDetails?.dpc_id || '—' }}
      </q-chip>
    </div>

    <!-- Main dispatch entry form and validation controls -->
    <q-form @submit.prevent="submitDispatch" class="column" style="gap: 20px">
      <q-btn-toggle
        v-model="dispatchType"
        :options="filteredOptions"
        unelevated
        no-caps
        spread
        toggle-color="blue-grey-9"
        color="grey-2"
        text-color="blue-grey-9"
        class="rounded-lg border border-slate-200"
      />

      <div class="row q-col-gutter-x-md" style="row-gap: 20px">
        <!-- FROM select -->
        <div class="col-12" :class="{ 'col-sm-6': !['PROMOS', 'EXPIRY', 'DEBTS'].includes(dispatchType) }">
          <!-- IF ADMIN OR SUPERADMIN -->
          <q-select
            v-if="isAdmin || isSuperAdmin"
            v-model="fromValue"
            :options="fromOptions"
            :option-label="fromLabel"
            :option-value="fromValueKey"
            :label="fromLabelText"
            dense
            outlined
            options-dense
            behavior="menu"
            popup-content-class="rounded-lg"
            @update:model-value="populateSelects(true)"
          >
            <template #prepend><q-icon name="north_east" size="18px" /></template>
          </q-select>

          <!-- IF NORMAL USER -->
          <q-input
            v-else
            v-model="fromValue.dpc_id"
            label="DPC Code"
            outlined
            dense
            readonly
            input-class="text-blue text-bold text-center"
          />
        </div>
        <!-- TO select (only show for DPC or SHOPS or DEBTS) -->
        <div class="col-12 col-sm-6" v-if="!['PROMOS', 'EXPIRY', 'DEBTS'].includes(dispatchType)">
          <q-select
            v-model="toValue"
            :options="toOptions"
            :option-label="toLabel"
            :option-value="toValueKey"
            :label="toLabelText"
            dense
            outlined
            options-dense
            behavior="menu"
            popup-content-class="rounded-lg"
          >
            <template #prepend><q-icon name="south_west" size="18px" /></template>
          </q-select>
        </div>
      </div>

      <div class="row q-col-gutter-x-md" style="row-gap: 20px">
        <div class="col-12 col-sm-6">
          <q-input
            v-model="dispatchDate"
            type="date"
            label="Dispatch Date"
            dense
            outlined
            @update:model-value="onDispatchDateChange"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input v-model="expiryDate" type="date" label="Expiry Date" dense outlined />
        </div>
      </div>

      <div
        v-if="dispatchType === 'PROMOS' || dispatchType === 'DEBTS'"
        class="column rounded-lg border border-slate-200 bg-slate-50 q-pa-md"
        style="gap: 16px"
      >
        <q-input v-model="distributoridno" label="Distributor ID" dense outlined bg-color="white" />
        <DistributorSearch v-model="distributoridno" v-model:name="distributorname" />
      </div>
      <!-- FOR SHOP selection -->
      <!--
       <q-input
        v-if="dispatchType === 'SHOP'"
        :model-value="fromValue?.dpc_id || auth.userDetails?.dpc_id"
        label="From (DPC)"
        readonly
        dense
        outlined
      />
      
       -->

      <!-- Product Select -->
      <q-select
        v-model="selectedProduct"
        :options="filteredProducts"
        option-label="productname"
        option-value="productcode"
        label="Select Product"
        use-input
        input-debounce="300"
        dense
        outlined
        options-dense
        behavior="menu"
        popup-content-class="rounded-lg"
        @filter="filterProducts"
      >
        <template #prepend><q-icon name="inventory_2" size="18px" /></template>
      </q-select>

      <div class="row q-col-gutter-x-md" style="row-gap: 20px">
        <div class="col-12 col-sm-6">
          <q-input
            v-model="availableStock"
            label="Available Stock"
            readonly
            dense
            outlined
            bg-color="grey-2"
            input-class="text-blue-grey-9 text-bold text-center"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model.number="dispatchQty"
            type="number"
            min="1"
            :max="availableStock"
            label="Dispatch Quantity"
            dense
            outlined
          />
        </div>
      </div>

      <q-btn
        type="submit"
        label="Submit Dispatch"
        icon="send"
        unelevated
        no-caps
        class="bg-blue-grey-9 text-white rounded-lg full-width"
        :loading="loading"
        :disable="
          loading /* ⛔ prevent double submit */ ||
          !fromValue ||
          (!['PROMOS', 'EXPIRY', 'DEBTS'].includes(dispatchType) && !toValue) ||
          !selectedProduct ||
          dispatchQty < 1 ||
          dispatchQty > availableStock
        "
      />
    </q-form>
  </q-card>
</template>

<script setup>
// Dependencies for dispatch storage, activity logging, and user controls.
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from 'src/boot/supabase'
import { logActivity, ACTIVITY_TYPES } from 'src/utils/activityLog'
import { useAuth } from 'stores/auth'
import DistributorSearch from './DistributorSearch.vue'
import { Dialog } from 'quasar'
import { useQuasar } from 'quasar'
const auth = useAuth()
const $q = useQuasar()
const emit = defineEmits(['dispatched', 'typeChange'])
const fromOptions = ref([])
const toOptions = ref([])
const fromValue = ref(null)
const toValue = ref(null)
const localProvinces = ref([])
const localShops = ref([])
const dispatchDate = ref(localStorage.getItem('dispatchDate') || '')
//let previousDate = '' // last accepted date

const expiryDate = ref('')
const selectedProduct = ref(null)
const dispatchQty = ref(1)
const distributoridno = ref('')
const distributorname = ref('')
// User role checks
const isAdmin = computed(() => auth.userDetails?.role === 'Admin')
const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')
const isUser = computed(() => !isAdmin.value && !isSuperAdmin.value)
// set default dispatch type based on role
const dispatchType = ref(isAdmin.value || isSuperAdmin.value ? 'SHOP' : 'PROMOS')
watch(dispatchType, (t) => emit('typeChange', t), { immediate: true })
const availableStock = ref(0)
// Reactive reference for stock
const loading = ref(false)

// Same payload => same request id, so a retry after a lost response is applied only once
let pendingRequest = { key: null, id: null }
function getRequestId(...parts) {
  const key = JSON.stringify(parts)
  if (pendingRequest.key !== key) {
    pendingRequest = { key, id: crypto.randomUUID() }
  }
  return pendingRequest.id
}
function clearRequestId() {
  pendingRequest = { key: null, id: null }
}
// ✅ Reactive form object

// For non-admin users
const userDPCCODE = computed(() => auth.userDetails?.dpc_id || 'N/A')

// ✅ Option lists
const activeProducts = ref([])
const filteredProducts = ref([])

async function fetchActiveProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('productname, productcode')
    .eq('status', 'active')

  if (!error) {
    activeProducts.value = data
    filteredProducts.value = data // initialize search list
  }
}

function filterProducts(val, update) {
  if (val === '') {
    update(() => {
      filteredProducts.value = activeProducts.value
    })
    return
  }

  update(() => {
    const needle = val.toLowerCase()
    filteredProducts.value = activeProducts.value.filter((p) =>
      p.productname.toLowerCase().includes(needle),
    )
  })
}
// =======================================================
// 🟨 Identify the correct stock table based on dispatchType
// =======================================================

// =======================================================
// 🟨 Identify the correct stock table based on dispatchType
// =======================================================
function getStockTable() {
  const from = typeof fromValue.value === 'object' ? fromValue.value : {}
  const to = typeof toValue.value === 'object' ? toValue.value : {}

  switch (dispatchType.value) {
    case 'SHOP':
      // DPC → Shop: Deduct from Province (e.g., RCD)
      return from.province_code || auth.userDetails?.province_code || null

    case 'DPC':
      // Province → Province: Deduct from source province
      return from.province_code || auth.userDetails?.province_code || null

    case 'PROMOS':
    case 'DEBTS':
    case 'EXPIRY':
      // Shop → PROMOS/DEBTS/EXPIRY
      if (from.shopcode) return `${from.shopcode}_STOCK`
      if (to.shopcode) return `${to.shopcode}_STOCK`
      if (auth.userDetails?.shopcode) return `${auth.userDetails.shopcode}_STOCK`
      return null

    default:
      return null
  }
}

// =======================================================
// 🟧 Fetch stock quantity for selected product
// =======================================================

async function fetchStockQuantity() {
  const table = getStockTable()
  const product =
    typeof selectedProduct.value === 'object'
      ? selectedProduct.value.productcode
      : selectedProduct.value

  if (!table || !product) {
    availableStock.value = 0
    return
  }

  try {
    // Sum rows so the total is right even if the table holds several rows per product
    const { data, error } = await supabase
      .from(table)
      .select('quantity')
      .eq('productcode', product)

    if (error) {
      console.error(`Error fetching stock from ${table}:`, error)
      availableStock.value = 0
    } else {
      availableStock.value = (data || []).reduce((sum, r) => sum + (r.quantity || 0), 0)
    }
  } catch (err) {
    console.error('Stock fetch error:', err)
    availableStock.value = 0
  }
}

// Function to fetch stock for selected province and product
watch(dispatchType, () => populateSelects(false))

// =======================================================
// 🟦 Watch for changes to trigger stock lookup
// =======================================================
watch([dispatchType, fromValue, toValue, selectedProduct], () => {
  // Prevent crash when product is not yet selected
  if (!selectedProduct.value || typeof selectedProduct.value !== 'object') {
    availableStock.value = 0
    return
  }

  fetchStockQuantity()
})

// Automatically set the correct default
watch(
  [isAdmin, isSuperAdmin, userDPCCODE],
  ([admin, superAdmin, dpc]) => {
    if (admin || superAdmin) {
      fromValue.value = null // user will select manually
    } else {
      fromValue.value = dpc // automatically use current user's DPC
    }
  },
  { immediate: true }, // run immediately on component mount
)

watch(dispatchDate, (newDate) => {
  if (newDate) {
    localStorage.setItem('dispatchDate', newDate)
  }
})

watch(
  () => auth.userDetails,
  (newVal) => {
    if (isUser.value && newVal) {
      fromValue.value = {
        dpc_id: newVal.dpc_id,
        province_code: newVal.province_code,
        shopcode: newVal.shopcode,
      }
    }
  },
)

function onDispatchDateChange(newDate) {
  if (!newDate) return

  const selected = new Date(newDate)
  const today = new Date()

  // Compare with CURRENT MONTH & YEAR
  const isSameMonth =
    selected.getMonth() === today.getMonth() && selected.getFullYear() === today.getFullYear()

  if (!isSameMonth) {
    Dialog.create({
      title: 'Confirm Date Selection',
      message: 'You are selecting a date outside the current month. Are you sure?',
      cancel: true,
      persistent: true,
    })
      .onOk(() => {
        // ✅ Accept new date
        dispatchDate.value = newDate
        localStorage.setItem('dispatchDate', newDate)
      })
      .onCancel(() => {
        // 🔁 Revert to current date
        const current = new Date().toISOString().slice(0, 10)
        dispatchDate.value = current
        localStorage.setItem('dispatchDate', current)
      })
  } else {
    // ✅ Same month → accept silently
    dispatchDate.value = newDate
    localStorage.setItem('dispatchDate', newDate)
  }
}
let previousDispatchType = dispatchType.value
const options = [
  { label: 'SHOPS', value: 'SHOP' },
  { label: 'DPC', value: 'DPC' },

  { label: 'PROMOS', value: 'PROMOS' },
  { label: 'DEBTS', value: 'DEBTS' },
  { label: 'EXPIRY', value: 'EXPIRY' },
]

// Filter options based on user role
const filteredOptions = computed(() => {
  if (isAdmin.value || isSuperAdmin.value) {
    return options
  }
  return options.filter((opt) => ['PROMOS', 'DEBTS', 'EXPIRY'].includes(opt.value))
})

const fromLabel = computed(() => {
  if (['PROMOS', 'EXPIRY', 'DEBTS'].includes(dispatchType.value)) return 'shop_name'
  return 'name'
})

const fromValueKey = computed(() => {
  if (['PROMOS', 'EXPIRY', 'DEBTS'].includes(dispatchType.value)) return 'shopcode'
  return 'province_code'
})

const fromLabelText = computed(() => {
  if (['PROMOS', 'EXPIRY', 'DEBTS'].includes(dispatchType.value)) return 'From (Shop)'
  return 'From (Province)'
})

const toLabel = computed(() => (dispatchType.value === 'DPC' ? 'name' : 'shop_name'))
const toValueKey = computed(() => (dispatchType.value === 'DPC' ? 'province_code' : 'shopcode'))
const toLabelText = computed(() => (dispatchType.value === 'DPC' ? 'To (Province)' : 'To (Shop)'))

// ✅ Load all provinces for user's country
async function loadProvinces() {
  const { data, error } = await supabase
    .from('province')
    .select('province_code, name')
    .eq('country_code', auth.userDetails?.country_code)
    .order('name')

  if (error) console.error('Province error:', error)
  else localProvinces.value = data
}

// ✅ Load shops for user's country or province depending on role
async function loadShops() {
  let query = supabase.from('shops').select('shopcode, shop_name, province_code, country_code')

  if (isSuperAdmin.value) {
    query = query.eq('country_code', auth.userDetails?.country_code)
  } else if (isAdmin.value) {
    query = query.eq('province_code', auth.userDetails?.province_code)
  }

  const { data, error } = await query
  if (error) console.error('Shops error:', error)
  else localShops.value = data
}

function populateSelects(triggeredByUser = false) {
  const userProvinceCode = auth.userDetails?.province_code
  const userProvince = localProvinces.value.find((p) => p.province_code === userProvinceCode)

  /* ==============================
     🚫 ADMIN SHOP PROVINCE GUARD
  ============================== */
  if (
    dispatchType.value === 'SHOP' &&
    triggeredByUser &&
    isAdminRestrictedFrom.value &&
    fromValue.value &&
    fromValue.value.province_code !== userProvinceCode
  ) {
    $q.notify({
      type: 'warning',
      message: 'You can only dispatch to shops within your province',
    })

    fromValue.value = userProvince || null
    toOptions.value = localShops.value.filter((s) => s.province_code === userProvinceCode)
    toValue.value = null
    return
  }

  /* =======================
     DPC
  ======================= */
  if (dispatchType.value === 'DPC') {
    if (isAdminRestrictedFrom.value) {
      fromOptions.value = userProvince ? [userProvince] : []

      if (!triggeredByUser) {
        fromValue.value = userProvince || null
      }

      toOptions.value = localProvinces.value.filter((p) => p.province_code !== userProvinceCode)

      if (!triggeredByUser) {
        toValue.value = null
      }
    } else {
      fromOptions.value = localProvinces.value
      toOptions.value = localProvinces.value

      if (!triggeredByUser) {
        fromValue.value = null
        toValue.value = null
      }
    }

    return
  }

  /* =======================
     SHOP
  ======================= */
  if (dispatchType.value === 'SHOP') {
    if (isAdminRestrictedFrom.value) {
      fromOptions.value = userProvince ? [userProvince] : []
      fromValue.value = userProvince || null

      toOptions.value = localShops.value.filter((s) => s.province_code === userProvinceCode)
      toValue.value = null
    } else {
      fromOptions.value = localProvinces.value

      toOptions.value = fromValue.value
        ? localShops.value.filter((s) => s.province_code === fromValue.value.province_code)
        : []

      toValue.value = null
    }

    return
  }

  /* =======================
     PROMOS / EXPIRY / DEBTS
  ======================= */
  if (['PROMOS', 'EXPIRY', 'DEBTS'].includes(dispatchType.value)) {
    fromOptions.value = isSuperAdmin.value
      ? localShops.value
      : localShops.value.filter((s) => s.province_code === userProvinceCode)

    if (!triggeredByUser) {
      fromValue.value = null
    }

    toOptions.value = []
    toValue.value = null
  }
}

function resetDispatchForm() {
  //dispatchType.value = null
  //fromValue.value = null
  //toValue.value = null
  //dispatchDate.value = ''
  expiryDate.value = ''
  distributoridno.value = ''
  distributorname.value = ''
  selectedProduct.value = null
  availableStock.value = 0
  dispatchQty.value = 0
}

const isAdminRestrictedFrom = computed(() => {
  return isAdmin.value && !isSuperAdmin.value && ['SHOPS', 'DPC'].includes(dispatchType.value)
})

// ✅ Watch for dispatch type change
//watch(dispatchType, () => populateSelects())

watch(dispatchType, (newVal, oldVal) => {
  if (oldVal === newVal) return

  Dialog.create({
    title: 'Confirm Change',
    message: `Are you sure you want to switch to "${newVal}"?`,
    cancel: true,
    persistent: true,
  })
    .onOk(() => {
      // User confirmed → keep the new value
      previousDispatchType = newVal
      populateSelects() // your function
    })
    .onCancel(() => {
      // User cancelled → revert to previous value
      dispatchType.value = previousDispatchType
    })
})

// Load locations and products before the form is used.
onMounted(async () => {
  await loadProvinces()
  await fetchActiveProducts()
  await loadShops()
  populateSelects()
  getModifiedBy()

  // If nothing stored, default to today
  if (!dispatchDate.value) {
    dispatchDate.value = new Date().toISOString().slice(0, 10)
  }

  // Baseline = last accepted date (stored or today)
  //previousDate = dispatchDate.value

  if (isUser.value) {
    // Automatically assign the user’s DPC/shop/province for later stock operations
    fromValue.value = {
      dpc_id: auth.userDetails?.dpc_id || null,
      shopcode: auth.userDetails?.dpc_id || null,
    }
  }
})

// =======================================================
// 🛠️ Helpers
// =======================================================

// Extract a primitive value safely from v-model (avoiding [object Object])
function getValue(obj, key) {
  if (!obj) return null
  if (typeof obj === 'object' && obj[key]) return obj[key]
  return obj
}

// Get current user's name for audit
function getModifiedBy() {
  return auth.userDetails?.firstname || 'system'
}

async function handleShopDispatch() {
  if (loading.value) return false
  loading.value = true

  try {
    const province = getValue(fromValue.value, 'province_code')
    const shop = getValue(toValue.value, 'shopcode')
    const product = getValue(selectedProduct.value, 'productcode')
    const productname = getValue(selectedProduct.value, 'productname')
    const qty = Number(dispatchQty.value)

    if (isNaN(qty) || qty <= 0) throw new Error('Invalid quantity.')

    const { error } = await supabase.rpc('transfer_stock', {
      p_request_id: getRequestId('SHOP', province, shop, product, qty, dispatchDate.value),
      p_province: province, // ✅ 1st
      p_shopcode: shop, // ✅ 2nd
      p_productcode: product, // ✅ 3rd
      p_productname: productname, // ✅ 4th
      p_quantity: qty, // ✅ 5th
      p_modifiedby: getModifiedBy(), // ✅ 6th
      p_dispatch_date: dispatchDate.value, // ✅ 7th
      p_dispatchtype: dispatchType.value, // ✅ 8t
    })

    if (error) throw error

    logActivity(ACTIVITY_TYPES.DISPATCH, {
      reference: product,
      description: `Dispatch ${qty} × ${productname || product} from ${province} to shop ${shop}`,
    })
    $q.notify({
      type: 'positive',
      position: 'top',
      message: `✅ ${qty} × ${productname} successfully dispatched from ${province} → ${shop}`,
      timeout: 3500,
      actions: [{ icon: 'close', color: 'white' }],
    })
    clearRequestId()
    return true
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message,
    })
    return false
  } finally {
    loading.value = false
  }
}

async function handleDPCDispatch() {
  if (loading.value) return false
  loading.value = true

  try {
    const fromStore = getValue(fromValue.value, 'province_code') // source store table
    const toStore = getValue(toValue.value, 'province_code') // destination store table
    const productCode = getValue(selectedProduct.value, 'productcode')
    const qty = Number(dispatchQty.value)

    if (!fromStore || !toStore || !productCode) {
      throw new Error('Please select source and destination stores and a product.')
    }
    if (fromStore === toStore) {
      throw new Error('Source and destination stores cannot be the same.')
    }
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Invalid quantity.')
    }

    const { error } = await supabase.rpc('transfer_store_stock', {
      p_request_id: getRequestId('DPC', fromStore, toStore, productCode, qty, dispatchDate.value),
      p_from_store: fromStore, // must be first
      p_to_store: toStore, // second
      p_productcode: productCode, // third
      p_quantity: qty, // fourth
      p_modifiedby: getModifiedBy(), // fifth
      p_dispatch_date: dispatchDate.value, // sixth
      p_dispatchtype: dispatchType.value, // seventh
    })

    if (error) throw error

    logActivity(ACTIVITY_TYPES.DISPATCH, {
      reference: productCode,
      description: `Store transfer ${qty} × ${productCode} from ${fromStore} to ${toStore}`,
    })

    $q.notify({
      type: 'positive',
      message: `✅ ${qty} x ${productCode} moved from ${fromStore} → ${toStore}`,
      position: 'top',
      timeout: 5000,
      icon: 'mdi-truck-delivery',
    })

    dispatchQty.value = 0
    selectedProduct.value = null
    clearRequestId()
    return true
  } catch (err) {
    console.error('DPC Dispatch error:', err)
    $q.notify({
      type: 'negative',
      message: err.message,
      position: 'top',
    })
    return false
  } finally {
    loading.value = false
  }
}

// =======================================================
// 🟦 3️⃣ PROMOS DISPATCH: Shop → PROMOS table
// =======================================================

async function handlePromoDispatch() {
  if (loading.value) return false
  loading.value = true

  try {
    const shop = getValue(fromValue.value, 'shopcode') // dynamic shop table
    const productCode = getValue(selectedProduct.value, 'productcode')
    const distributorId = distributoridno.value?.trim()
    const distributorName = distributorname.value || null
    const qty = Number(dispatchQty.value)
    const date = dispatchDate.value || null

    if (!shop || !productCode || !distributorId) {
      throw new Error('Please select shop, product, and distributor ID.')
    }
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Invalid quantity.')
    }

    const { error } = await supabase.rpc('promo_dispatch', {
      p_request_id: getRequestId('PROMOS', shop, productCode, qty, distributorId, date),
      p_shop_table: `${shop}_STOCK`,
      p_productcode: productCode,
      p_quantity: qty,
      p_distributorid: distributorId,
      p_distributorname: distributorName,
      p_date: date,
      p_modifiedby: getModifiedBy(),
    })

    if (error) throw error

    logActivity(ACTIVITY_TYPES.DISPATCH, {
      reference: distributorId,
      description: `Promo dispatch ${qty} × ${productCode} from ${shop} to distributor ${distributorId}`,
    })

    $q.notify({
      type: 'positive',
      message: `🎁 ${qty} promo units of ${productCode} sent to ${distributorId}`,
      position: 'top',
      timeout: 5000,
      icon: 'mdi-gift',
    })

    // Reset fields
    dispatchQty.value = 0
    selectedProduct.value = null
    distributoridno.value = ''
    distributorname.value = ''
    clearRequestId()
    return true
  } catch (err) {
    console.error('Promo Dispatch error:', err)
    $q.notify({
      type: 'negative',
      message: err.message,
      position: 'top',
    })
    return false
  } finally {
    loading.value = false
  }
}

// =======================================================
// 🟦 4️⃣ EXPIRY DISPATCH: Shop → Expiry table (unique entries)
// =======================================================

async function handleExpiryDispatch() {
  if (loading.value) return false
  loading.value = true

  try {
    const shop = getValue(fromValue.value, 'shopcode')
    const product = getValue(selectedProduct.value, 'productcode')
    const qty = Number(dispatchQty.value)
    const expDate = expiryDate.value
    const table = `${shop}_STOCK`

    if (!shop || !product || isNaN(qty) || qty <= 0)
      throw new Error('Please select shop, product, and valid quantity.')

    if (!expDate) throw new Error('Please provide an expiry date.')

    const { error } = await supabase.rpc('expiry_dispatch', {
      p_request_id: getRequestId('EXPIRY', table, product, qty, expDate, dispatchDate.value),
      p_shop_table: table,
      p_productcode: product,
      p_quantity: qty,
      p_expirydate: expDate,
      p_modifiedby: getModifiedBy(),
      p_dispatch_date: dispatchDate.value, // ✅ IMPORTANT
    })

    if (error) throw new Error(error.message)

    logActivity(ACTIVITY_TYPES.DISPATCH, {
      reference: product,
      description: `Expiry dispatch ${qty} × ${product} from ${shop} (expiry ${expDate})`,
    })

    $q.notify({
      type: 'positive',
      message: `🧾 ${qty} expired units of ${product} recorded successfully.`,
    })
    clearRequestId()
    return true
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
    return false
  } finally {
    loading.value = false
  }
}

// =======================================================
// 🟦 5️⃣ DEBTS DISPATCH: Shop → DEBTS table
// =======================================================

async function handleDebtDispatch() {
  if (loading.value) return false
  loading.value = true

  try {
    const shop = getValue(fromValue.value, 'shopcode')
    const product = getValue(selectedProduct.value, 'productcode')
    const distributor = distributoridno.value?.trim()
    const distributorName = distributorname.value || null
    const qty = Number(dispatchQty.value)
    const date = dispatchDate.value || new Date().toISOString().slice(0, 10)

    if (!shop || !product || !distributor)
      throw new Error('Please select shop, product, and distributor ID.')
    if (isNaN(qty) || qty <= 0) throw new Error('Invalid quantity.')

    const table = `${shop}_STOCK`

    const { error } = await supabase.rpc('debt_dispatch', {
      p_request_id: getRequestId('DEBTS', table, product, qty, distributor, date),
      p_shop_table: table,
      p_productcode: product,
      p_quantity: qty,
      p_distributorid: distributor,
      p_distributorname: distributorName,
      p_date: date,
      p_addedby: getModifiedBy(),
    })

    if (error) throw new Error(error.message)

    $q.notify({
      type: 'warning',
      message: `💳 ${qty} of ${product} recorded as debt for ${distributor}`,
    })
    clearRequestId()
    return true
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
    return false
  } finally {
    loading.value = false
  }
}

// =======================================================
// REUSABLE LOGGING FUNCTION
// =======================================================

// =======================================================
// 🟩 Master Dispatch Controller
// =======================================================
async function submitDispatch() {
  try {
    if (!dispatchType.value) throw new Error('Please select a dispatch type.')

    let ok = false
    switch (dispatchType.value) {
      case 'SHOP':
        ok = await handleShopDispatch()
        break

      case 'DPC':
        ok = await handleDPCDispatch()
        break

      case 'PROMOS':
        ok = await handlePromoDispatch()
        break

      case 'EXPIRY':
        ok = await handleExpiryDispatch()
        break

      case 'DEBTS':
        ok = await handleDebtDispatch()
        break

      default:
        throw new Error('Unknown dispatch type selected.')
    }
    // Keep the form intact on failure so the user can safely retry
    if (ok) {
      resetDispatchForm()
      emit('dispatched')
    }
  } catch (err) {
    console.error('Dispatch error:', err)
    $q.notify({ type: 'negative', message: err.message })
  }
}
</script>

<style scoped>
/* Make radio group shrink proportionally on mobile */
.dispatch-type-group {
  transform: scale(1);
  transition: transform 0.2s ease;
}

@media (max-width: 600px) {
  .dispatch-type-group {
    transform: scale(0.85);
  }
}

/* Ensure all selects/inputs align perfectly */
.full-width {
  width: 100%;
}
.dispatch-option-label.active {
  color: #f5100c; /* light-green-14 */
  font-weight: bold;
}

.dispatch-option-label.inactive {
  color: #100f0f; /* grey-6 */
  font-weight: normal;
}
</style>
