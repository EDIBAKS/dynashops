<template>
  <q-page class="q-pa-md">
    <q-card flat class="q-pa-md" style="max-width: 1200px; margin: 0 auto">
      <!-- FILTER CONTROLS -->
      <div class="row items-center justify-center">
        <q-option-group v-model="dispatchType" :options="dispatchTypes" inline type="radio" />
      </div>

      <div class="row no-wrap items-stretch q-col-gutter-sm full-width">
        <!-- ===================== P2P ===================== -->
        <template v-if="dispatchType === 'P2P'">
          <div class="col">
            <q-select
              v-if="isAdminOrSuperAdmin"
              v-model="fromValue"
              :options="fromOptions"
              label="From Province"
              dense
              outlined
              emit-value
              map-options
              @update:model-value="loadToOptions"
            />
          </div>

          <div class="col" v-if="isAdminOrSuperAdmin">
            <q-select
              v-model="toValue"
              :options="toOptions"
              label="To Province"
              dense
              outlined
              emit-value
              map-options
            />
          </div>
        </template>

        <!-- ===================== S2P ===================== -->
        <template v-else-if="dispatchType === 'S2P'">
          <!-- TO: Province FIRST -->
          <div class="col">
            <q-select
              v-model="toValue"
              :options="provinceOptions"
              label="To Province"
              dense
              outlined
              emit-value
              map-options
              @update:model-value="loadShopsForS2P"
            />
          </div>

          <!-- FROM: Shop -->
          <div class="col">
            <q-select
              v-model="fromValue"
              :options="fromOptions"
              label="From Shop"
              dense
              outlined
              emit-value
              map-options
              :disable="!toValue"
            />
          </div>
        </template>
      </div>

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

      <!-- FETCH BUTTON -->
      <div class="row justify-end q-mt-sm">
        <q-btn color="primary" label="Fetch Dispatches" @click="fetchDispatches" />
      </div>

      <!-- TABLE -->
      <q-table
        v-if="dispatches.length"
        :rows="mappedDispatches"
        :columns="columns"
        row-key="id"
        flat
        dense
        class="q-mt-md"
      />
      <div v-else class="text-center q-mt-md text-grey">No dispatch records found.</div>
    </q-card>
  </q-page>
</template>

<script setup>
// Role-aware dispatch data, option loading, and report dependencies.
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from 'boot/supabase'
import { useAuth } from 'stores/auth'
import { useQuasar } from 'quasar'

const auth = useAuth()
const $q = useQuasar()

/* ---------------------------------------------------
   STATE
--------------------------------------------------- */
const dispatchType = ref('P2P')
const fromOptions = ref([])
const toOptions = ref([])
const provinceOptions = ref([])

const fromValue = ref(null)
const toValue = ref(null)

const startDate = ref(null)
const endDate = ref(null)

const dispatches = ref([])

const productsMap = ref({}) // productcode → { productname, distributorprice }

/* ---------------------------------------------------
   ROLE COMPUTED STATES
--------------------------------------------------- */
const isAdmin = computed(() => auth.userDetails?.role === 'Admin')
const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')
const isAdminOrSuperAdmin = computed(() => isAdmin.value || isSuperAdmin.value)

/* ---------------------------------------------------
   DISPATCH TYPE OPTIONS
--------------------------------------------------- */
const dispatchTypes = computed(() => {
  return isAdminOrSuperAdmin.value
    ? [
        { label: 'Province → Province', value: 'P2P' },
        { label: 'Shop → Province', value: 'S2P' }, // ✅ FIX
      ]
    : [{ label: 'Shop Withdraws', value: 'SHOP' }]
})

/* ---------------------------------------------------
   HELPERS
--------------------------------------------------- */
function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()

  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')

  return `${dd}-${mm}-${yyyy}:${hh}-${min}`
}

// WATCHERS TO UPDATE SELECTS BASED ON DISPATCH TYPE
watch([dispatchType, fromValue], async () => {
  if (!fromValue.value && dispatchType.value !== 'SHOP') return

  if (dispatchType.value === 'P2P') {
    // Both From & To are provinces
    fromOptions.value = await fetchProvinces() // in case From changed dynamically
    toOptions.value = fromOptions.value.filter((p) => p.value !== fromValue.value)
  } else if (dispatchType.value === 'S2P') {
    // From = Shops in user's province, To = Provinces
    await fetchShops(auth.userDetails?.province_code)
    toOptions.value = fromOptions.value.filter((p) => p.value !== auth.userDetails?.province_code)
  }
})

watch(dispatchType, async (type) => {
  fromValue.value = null
  toValue.value = null
  fromOptions.value = []
  toOptions.value = []

  if (type === 'P2P') {
    fromOptions.value = provinceOptions.value
  }

  if (type === 'S2P') {
    toOptions.value = provinceOptions.value
  }
})

/* ---------------------------------------------------
   FETCH PROVINCES
--------------------------------------------------- */
async function fetchProvinces() {
  const { data } = await supabase
    .from('province')
    .select('name, province_code')
    .eq('country_code', auth.userDetails.country_code)

  provinceOptions.value = data.map((p) => ({
    label: p.name,
    value: p.province_code,
  }))

  // Used for P2P From
  fromOptions.value = provinceOptions.value
}

function resolveWithdrawFromLocation() {
  // Shop → Province or SHOP user
  if (dispatchType.value === 'S2P' || dispatchType.value === 'SHOP') {
    return `${fromValue.value}_STOCK`
  }

  // Province → Province
  return fromValue.value
}

function resolveWithdrawToLocation() {
  // Always province (never STOCK)
  return toValue.value
}

/* ---------------------------------------------------
   FETCH SHOPS FOR A PROVINCE
--------------------------------------------------- */
async function fetchShops(province_code) {
  const { data, error } = await supabase
    .from('shops')
    .select('shop_name, shopcode, province_code')
    .eq('province_code', province_code)

  if (error) {
    console.error('❌ Error fetching shops:', error.message)
    return
  }

  toOptions.value = data.map((shop) => ({
    label: shop.shop_name,
    value: shop.shopcode,
  }))
}

async function loadShopsForS2P(provinceCode) {
  fromValue.value = null

  const { data } = await supabase
    .from('shops')
    .select('shop_name, shopcode')
    .eq('province_code', provinceCode)

  fromOptions.value = data.map((s) => ({
    label: s.shop_name,
    value: s.shopcode,
  }))
}

/* ---------------------------------------------------
   FETCH PRODUCTS (names + prices)
--------------------------------------------------- */
async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('productcode, productname, distributorprice')

  if (error) {
    console.error('❌ Error fetching products:', error.message)
    return
  }

  productsMap.value = data.reduce((acc, p) => {
    acc[p.productcode] = {
      productname: p.productname,
      distributorprice: p.distributorprice,
    }
    return acc
  }, {})
}

/* ---------------------------------------------------
   MAP DATA FOR TABLE
--------------------------------------------------- */
const mappedDispatches = computed(() => {
  return dispatches.value.map((d) => {
    const fromName =
      fromOptions.value.find((p) => p.value === d.from_location)?.label ||
      d.from_location.replace('_STOCK', '')

    const toName =
      toOptions.value.find((p) => p.value === d.to_location)?.label ||
      d.to_location.replace('_STOCK', '')

    const product = productsMap.value[d.productcode] || {}
    const price = product.distributorprice || 0

    return {
      fromName,
      toName,
      productcode: d.productcode,
      productname: product.productname || d.productcode,
      quantity: d.quantity,
      value: price * d.quantity,
      createdby: d.createdby,
      datecreated: formatDate(d.datecreated),
    }
  })
})

/* ---------------------------------------------------
   UPDATE TO OPTIONS WHEN FROM CHANGES
--------------------------------------------------- */
async function loadToOptions() {
  if (!fromValue.value) return

  if (dispatchType.value === 'P2P') {
    toOptions.value = fromOptions.value.filter((p) => p.value !== fromValue.value)
  }

  if (dispatchType.value === 'P2S') {
    await fetchShops(fromValue.value)
  }
}

const columns = [
  { name: 'fromName', label: 'From', field: 'fromName', align: 'left' },
  { name: 'toName', label: 'To', field: 'toName', align: 'left' },
  { name: 'productcode', label: 'Product Code', field: 'productcode', align: 'left' },
  { name: 'productname', label: 'Product Name', field: 'productname', align: 'left' },
  { name: 'quantity', label: 'Qty', field: 'quantity', align: 'right' },
  { name: 'value', label: 'Value', field: 'value', align: 'right' },
  { name: 'createdby', label: 'Created By', field: 'createdby', align: 'left' },
  { name: 'datecreated', label: 'Date', field: 'datecreated', align: 'left' },
]

/* ---------------------------------------------------
   ON MOUNT
--------------------------------------------------- */
onMounted(async () => {
  await fetchProvinces()
  await fetchProducts()

  if (!isAdminOrSuperAdmin.value) {
    fromValue.value = auth.userDetails?.dpc_id
    await fetchShops(auth.userDetails?.province_code)
  } else if (dispatchType.value === 'S2P') {
    await fetchShops(auth.userDetails?.province_code)
  }
})

/* ---------------------------------------------------
   FETCH WITHDRAWS (MAIN FUNCTION)
--------------------------------------------------- */
async function fetchDispatches() {
  try {
    if (!startDate.value || !endDate.value) {
      $q.notify({ type: 'negative', message: 'Please select both start and end dates.' })
      return
    }

    if (!fromValue.value || !toValue.value) {
      $q.notify({ type: 'negative', message: 'Please select FROM and TO.' })
      return
    }

    const fromLoc = resolveWithdrawFromLocation()
    const toLoc = resolveWithdrawToLocation()

    // 🔎 HARD DEBUG (keep this while testing)
    console.log('📤 WITHDRAW RPC PARAMS')
    console.log('Dispatch Type:', dispatchType.value)
    console.log('FROM (resolved):', fromLoc)
    console.log('TO:', toLoc)
    console.log('START:', startDate.value)
    console.log('END:', endDate.value)

    const { data, error } = await supabase.rpc('fetch_withdraws_report', {
      p_from_location: fromLoc,
      p_to_location: toLoc,
      p_start_date: startDate.value,
      p_end_date: endDate.value,
    })

    if (error) throw error

    console.log('📥 WITHDRAWS RETURNED:', data)

    dispatches.value = data || []
  } catch (err) {
    console.error('🔥 fetchWithdraws failed:', err)
    $q.notify({ type: 'negative', message: err.message || 'Failed to fetch withdraws' })
  }
}
</script>
