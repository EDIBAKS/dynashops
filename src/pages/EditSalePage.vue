<template>
  <q-page class="flex justify-center bg-gray-100 px-4 py-3 sm:px-6 sm:py-4">
    <div class="w-full max-w-3xl">
      <!-- HEADER -->
      <div
        class="mb-3 flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 px-3 py-3 text-white sm:px-4"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300"
          >
            <q-icon name="edit_note" size="24px" />
          </div>
          <div class="min-w-0">
            <div class="truncate text-base font-bold sm:text-xl">Edit Sale</div>
            <div class="mt-0.5 truncate text-[0.7rem] font-medium text-slate-200 sm:text-xs">
              Receipt {{ form.receiptno || 'unknown' }}
            </div>
          </div>
        </div>
        <div
          class="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold sm:text-sm"
        >
          {{ originalDpc || form.dpccode || 'DPC' }}
        </div>
      </div>

    <q-card flat class="rounded-2xl border border-slate-200 shadow-sm" style="position: relative">
      <q-card-section>
        <!-- Edit receipt metadata before managing its product lines. -->
        <div class="text-subtitle2 text-slate-700 q-mb-sm">Receipt details</div>
        <div class="q-mt-sm">
          <DistributorSearch v-model="form.distributoridno" v-model:name="form.distributorname" />
        </div>
        <div class="q-mt-sm row q-col-gutter-sm">
          <div class="col">
            <q-select
              v-model="form.dpccode"
              :options="dpcs"
              option-value="dpccode"
              option-label="dpcname"
              label="DPC"
              dense
              outlined
              emit-value
              map-options
            />
          </div>
          <div class="col">
            <q-input v-model="form.salesdate" label="Sales Date" type="date" dense outlined />
          </div>
        </div>
      </q-card-section>

      <!-- PRODUCT LIST -->
      <q-card-section>
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle2 text-slate-700">
            Products ({{ form.salesdetails.length }})
          </div>
          <q-btn
            unelevated
            no-caps
            dense
            class="rounded-lg bg-blue-grey-9 px-3 text-white"
            icon="add_shopping_cart"
            label="Add product"
            @click="addProduct"
          />
        </div>
        <div
          v-for="(item, index) in form.salesdetails"
          :key="item.rowId"
          class="q-mb-sm row q-col-gutter-sm items-center rounded-xl border border-slate-200 bg-slate-50 q-pa-xs"
        >
          <!-- Product name / select wraps above on mobile -->
          <div class="col-12 col-sm-4">
            <q-select
              v-model="item.productcode"
              :options="products"
              option-value="productcode"
              option-label="productname"
              label="Product"
              dense
              outlined
              emit-value
              map-options
              @update:model-value="() => selectProduct(item)"
              @popup-show="refreshAllStock"
              :disable="item.isExisting"
            />
          </div>

          <!-- Other inputs: qty, price, BV + delete button -->
          <div class="col-12 col-sm row items-center no-wrap q-gutter-sm">
            <q-input
              v-model.number="item.quantity"
              type="number"
              label="Qty"
              dense
              outlined
              :disable="item.availableQty === 0 || item.stockLoading"
              @update:model-value="() => changeQuantity(item)"
              class="col"
            />
            <q-input
              v-model.number="item.unitprice"
              type="number"
              label="Price"
              dense
              outlined
              readonly
              class="col"
            />
            <q-input
              v-model.number="item.unitbv"
              type="number"
              label="BV"
              dense
              outlined
              readonly
              class="col"
            />
            <q-btn dense flat color="negative" icon="delete" @click="removeProduct(index, item)" />
          </div>

          <!-- Available qty -->
          <div class="col-12 text-caption text-slate-600">
            <q-spinner v-if="item.stockLoading" size="12px" color="primary" />
            <template v-else-if="item.productcode">
              In stock now: <b>{{ item.dbQty }}</b>
              <template v-if="item.heldQty > 0">
                + on this receipt: <b>{{ item.heldQty }}</b>
              </template>
              = you can dispatch up to <b>{{ item.availableQty }}</b>
            </template>
          </div>
        </div>
        <div
          v-if="form.salesdetails.length === 0"
          class="rounded-xl border border-dashed border-slate-300 py-4 text-center text-sm text-slate-500"
        >
          No products. Saving an empty receipt deletes it and returns all its stock.
        </div>
      </q-card-section>

      <!-- FOOTER ACTIONS -->
      <q-card-actions align="right" class="q-pa-md">
        <q-spinner-hourglass v-if="loading" color="primary" size="30px" />
        <q-btn flat no-caps label="Cancel" @click="$router.back()" />
        <q-btn
          unelevated
          no-caps
          class="rounded-lg bg-blue-grey-9 px-5 text-white"
          label="Save changes"
          :disable="loading || form.salesdetails.some((it) => it.stockLoading)"
          @click="submitUpdate"
        />
      </q-card-actions>
    </q-card>
    </div>
  </q-page>
</template>

<script setup>
// Vue, router, database, and activity-log dependencies.
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { supabase } from 'boot/supabase'
import { logActivity, ACTIVITY_TYPES } from 'src/utils/activityLog'
import DistributorSearch from 'components/DistributorSearch.vue'
//import { useAuthStore } from 'stores/auth'
//const storeAuth = useAuthStore()
// Current receipt, editable fields, and original values for change tracking.
const route = useRoute()
const router = useRouter()
const $q = useQuasar()

const loading = ref(false)
const products = ref([])
const dpcs = ref([])

const form = ref({
  receiptno: '',
  distributoridno: '',
  distributorname: '',
  dpccode: '',
  salesdate: '',
  salesdetails: [], // productcode, quantity, unitprice, unitbv, availableQty, isExisting
})

// snapshot of original items (used to compute diffs)
const originalItems = ref([])
const originalDpc = ref('')
const originalHeader = ref({ distributoridno: '', salesdate: '' })
const loadedLastModified = ref(null)

/* ------------------------- Load Receipt ------------------------- */
async function fetchReceipt(receiptno) {
  try {
    // Fetch sales header
    const { data: header, error: headerErr } = await supabase
      .from('salesheader')
      .select('*')
      .eq('receiptno', receiptno)
      .maybeSingle()
    if (headerErr) throw headerErr

    // Fetch sales details
    const { data: details, error: detailsErr } = await supabase
      .from('salesdetails')
      .select('*')
      .eq('receiptno', receiptno)
    if (detailsErr) throw detailsErr

    // Map details and mark existing products
    const mappedDetails = (details || []).map((d) => ({
      rowId: newRowId(),
      productcode: d.productcode,
      quantity: d.quantity,
      unitprice: d.unitprice ?? 0,
      unitbv: d.unitbv ?? 0,
      availableQty: 0, // will be loaded separately
      dbQty: 0,
      heldQty: 0,
      isExisting: true, // existing products are unchangeable
    }))

    // Populate form reactive object
    // NOTE: for distributorname we prefer header value but fall back to any existing edited value
    form.value = {
      receiptno: header?.receiptno || receiptno,
      distributoridno: header?.distributoridno || form.value.distributoridno || '',
      distributorname: (header?.distributorname ?? form.value.distributorname) || '',
      dpccode: header?.dpccode || form.value.dpccode || '',
      salesdate: header?.salesdate ? header.salesdate.split('T')[0] : form.value.salesdate || '',
      salesdetails: mappedDetails,
    }

    // Keep a snapshot of original items for diffing
    originalItems.value = JSON.parse(JSON.stringify(mappedDetails))
    originalDpc.value = form.value.dpccode
    originalHeader.value = {
      distributoridno: form.value.distributoridno,
      salesdate: form.value.salesdate,
    }
    loadedLastModified.value = header?.lastmodified ?? null

    // Load available stock for each item concurrently
    await Promise.all(form.value.salesdetails.map((item) => loadStock(item)))
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: err.message || 'Failed to load receipt' })
  }
}

/* ------------------------- Stock utilities ------------------------- */
async function loadStock(item) {
  // Only the latest request for a row may write its result (guards against out-of-order replies)
  const requestId = (item.stockRequestId || 0) + 1
  item.stockRequestId = requestId

  if (!form.value.dpccode || !item.productcode) {
    item.availableQty = 0
    item.dbQty = 0
    item.heldQty = 0
    item.stockLoading = false
    return
  }

  item.stockLoading = true
  const stockTable = `${form.value.dpccode}_STOCK`
  const { data, error } = await supabase
    .from(stockTable)
    .select('quantity')
    .eq('productcode', item.productcode)
    .maybeSingle()
  if (requestId !== item.stockRequestId) return

  item.stockLoading = false
  if (error) {
    item.availableQty = 0
    $q.notify({ type: 'negative', message: `Could not load stock: ${error.message}` })
    return
  }

  // Stock already held by this receipt is available again when its DPC is unchanged
  item.dbQty = data?.quantity ?? 0
  item.heldQty =
    form.value.dpccode === originalDpc.value
      ? (originalItems.value.find((o) => o.productcode === item.productcode)?.quantity ?? 0)
      : 0
  item.availableQty = item.dbQty + item.heldQty
}

/* ------------------------- Product selection ------------------------- */
async function selectProduct(item) {
  const p = products.value.find((x) => x.productcode === item.productcode)
  if (!p) return

  const duplicate = form.value.salesdetails.some(
    (other) => other !== item && other.productcode === item.productcode,
  )
  if (duplicate) {
    $q.notify({ type: 'warning', message: `${p.productname} is already on this receipt` })
    item.productcode = ''
    item.availableQty = 0
    item.unitprice = 0
    item.unitbv = 0
    return
  }

  item.unitprice = p.distributorprice ?? 0
  item.unitbv = p.bvs ?? 0
  item.availableQty = 0
  await loadStock(item)

  // Quantity can only be set once the current DB stock is known
  if (item.availableQty < 1) {
    item.quantity = 0
    $q.notify({ type: 'warning', message: `${p.productname} is out of stock in ${form.value.dpccode}` })
  } else if (!item.quantity || item.quantity > item.availableQty) {
    item.quantity = Math.min(item.quantity || 1, item.availableQty)
  }
}

/* ------------------------- Quantity changes ------------------------- */
async function changeQuantity(item) {
  if (!item.quantity || item.quantity < 1) item.quantity = 1
  if (item.quantity > item.availableQty) {
    item.quantity = item.availableQty
    $q.notify({ type: 'warning', message: `Only ${item.availableQty} available` })
  }
}

/* ------------------------- Add/Remove ------------------------- */
let rowCounter = 0
const newRowId = () => ++rowCounter

function addProduct() {
  form.value.salesdetails.push({
    rowId: newRowId(),
    productcode: '',
    quantity: 0, // set once the product's stock has been loaded
    unitprice: 0,
    unitbv: 0,
    availableQty: 0,
    dbQty: 0,
    heldQty: 0,
    stockLoading: false,
    isExisting: false, // allow editing the product on new rows
  })
}

function removeProduct(index, item) {
  $q.dialog({
    title: 'Confirm Removal',
    message: `Remove ${item.productname || item.productcode || 'this product'}?`,
    ok: { label: 'Yes', color: 'negative' },
    cancel: { label: 'Cancel', color: 'grey' },
    persistent: true,
  }).onOk(() => {
    // JUST remove from array (do NOT update stock)
    form.value.salesdetails.splice(index, 1)
    refreshAllStock()

    $q.notify({
      type: 'positive',
      message: 'Product removed',
    })
  })
}

/* ------------------------- Compute diffs ------------------------- */
const getInserts = () =>
  form.value.salesdetails.filter(
    (it) => !originalItems.value.some((o) => o.productcode === it.productcode),
  )
const getUpdates = () =>
  form.value.salesdetails.filter((it) => {
    const o = originalItems.value.find((x) => x.productcode === it.productcode)
    return o && o.quantity !== it.quantity
  })
const getDeletes = () =>
  originalItems.value.filter(
    (o) => !form.value.salesdetails.some((it) => it.productcode === o.productcode),
  )

/* ------------------------- Submit Update ------------------------- */
const ERROR_MESSAGES = {
  NOT_AUTHENTICATED: 'Please sign in again.',
  NOT_AUTHORIZED: 'You are not allowed to edit this receipt.',
  RECEIPT_NOT_FOUND: 'This receipt no longer exists.',
  STALE_RECEIPT: 'This receipt was changed elsewhere. Reload it and try again.',
  INVALID_DPC: 'Invalid DPC.',
  INVALID_DISTRIBUTOR: 'Distributor ID not found.',
  INVALID_DATE: 'Invalid sales date.',
  DATE_NOT_ALLOWED: 'Sales date is outside the allowed period.',
  INVALID_ITEMS: 'Invalid product list.',
  INVALID_QUANTITY: 'Quantities must be whole numbers of at least 1.',
  PRODUCT_NOT_FOUND: 'Product not found or inactive',
  PRODUCT_NOT_IN_STOCK: 'Product is not in this DPC stock',
  INSUFFICIENT_STOCK: 'Insufficient stock for',
}

function friendlyError(err) {
  const msg = String(err?.message || '')
  const code = Object.keys(ERROR_MESSAGES).find((c) => msg.startsWith(c))
  if (!code) return msg || 'Update failed!'
  const product = msg.split(': ')[1]
  return product ? `${ERROR_MESSAGES[code]}: ${product}` : ERROR_MESSAGES[code]
}

async function submitUpdate() {
  if (loading.value) return
  if (!form.value.dpccode) {
    $q.notify({ type: 'negative', message: 'DPC required!' })
    return
  }
  loading.value = true

  try {
    // Re-read live stock for every row so the checks below use current DB quantities
    await Promise.all(form.value.salesdetails.map((it) => loadStock(it)))

    const seen = new Set()
    for (const it of form.value.salesdetails) {
      if (!it.productcode) {
        $q.notify({ type: 'negative', message: 'Select a product on every line or remove it.' })
        return
      }
      if (seen.has(it.productcode)) {
        $q.notify({ type: 'negative', message: `${it.productcode} appears more than once.` })
        return
      }
      seen.add(it.productcode)
      const qty = Number(it.quantity)
      if (!Number.isInteger(qty) || qty < 1) {
        $q.notify({ type: 'negative', message: `Enter a quantity of at least 1 for ${it.productcode}.` })
        return
      }
      if (qty > it.availableQty) {
        $q.notify({
          type: 'negative',
          message: `Only ${it.availableQty} available for ${it.productcode}.`,
        })
        return
      }
    }
    const inserts = getInserts()
    const updates = getUpdates()
    const deletes = getDeletes()
    const parts = []
    if (form.value.dpccode !== originalDpc.value) {
      parts.push(`DPC ${originalDpc.value} → ${form.value.dpccode}`)
    }
    if (form.value.distributoridno !== originalHeader.value.distributoridno) {
      parts.push(`distributor ${originalHeader.value.distributoridno} → ${form.value.distributoridno}`)
    }
    if (form.value.salesdate !== originalHeader.value.salesdate) {
      parts.push(`date ${originalHeader.value.salesdate} → ${form.value.salesdate}`)
    }
    inserts.forEach((it) => parts.push(`added ${it.productcode} x${it.quantity}`))
    updates.forEach((it) => {
      const o = originalItems.value.find((x) => x.productcode === it.productcode)
      parts.push(`${it.productcode} qty ${o.quantity} → ${it.quantity}`)
    })
    deletes.forEach((o) => parts.push(`removed ${o.productcode} x${o.quantity}`))
    const changeSummary = parts.join('; ') || 'no line changes'

    // Rows without a product are ignored; the server revalidates everything else
    const items = form.value.salesdetails
      .filter((it) => it.productcode)
      .map((it) => ({ productcode: it.productcode, quantity: Number(it.quantity) }))

    // One atomic RPC updates the header, the lines and the DPC stock together
    const { error } = await supabase.rpc('edit_sales_transaction', {
      payload: {
        receiptno: form.value.receiptno,
        distributoridno: form.value.distributoridno,
        dpccode: form.value.dpccode,
        salesdate: form.value.salesdate,
        expected_lastmodified: loadedLastModified.value,
        items,
      },
    })
    if (error) throw error

    // An edit resolves the flag: the receipt becomes correct straight away
    if (items.length > 0) {
      const { error: statusError } = await supabase
        .from('salesheader')
        .update({ status: 'correct' })
        .eq('receiptno', form.value.receiptno)
      if (statusError) throw statusError
    }

    if (items.length === 0) {
      logActivity(ACTIVITY_TYPES.RECEIPT_DELETED, {
        reference: form.value.receiptno,
        dpccode: originalDpc.value,
        description: `Receipt ${form.value.receiptno} deleted by removing all products (${changeSummary}); stock returned to ${originalDpc.value}`,
      })
      $q.notify({ type: 'positive', message: 'All products removed — receipt deleted.' })
      router.back()
      return
    }

    logActivity(ACTIVITY_TYPES.SALE_EDITED, {
      reference: form.value.receiptno,
      dpccode: form.value.dpccode,
      description: `Receipt ${form.value.receiptno} edited: ${changeSummary}`,
    })

    $q.notify({ type: 'positive', message: 'Receipt and stock updated!' })

    // Refresh the receipt to get the latest state (but keep any edited distributorname if missing)
    await fetchReceipt(form.value.receiptno)
    router.back()
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: friendlyError(err) })
  } finally {
    loading.value = false
  }
}

/* ------------------------- Lifecycle ------------------------- */
// Other users may sell from the same DPC while this page is open, so re-read stock regularly
function refreshAllStock() {
  return Promise.all(form.value.salesdetails.filter((it) => it.productcode).map(loadStock))
}
const onVisible = () => {
  if (document.visibilityState === 'visible') refreshAllStock()
}
let stockTimer = null
onMounted(() => {
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', refreshAllStock)
  stockTimer = setInterval(() => {
    if (!loading.value) refreshAllStock()
  }, 30000)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('focus', refreshAllStock)
  clearInterval(stockTimer)
})
onMounted(async () => {
  const { data: d } = await supabase.from('dpc').select('dpccode, dpcname').order('dpcname')
  dpcs.value = d || []

  const { data: p } = await supabase
    .from('products')
    .select('productcode, productname, distributorprice, bvs')
    .eq('status', 'active')
  products.value = p || []

  const receiptno = route.params.receiptno
  if (receiptno) await fetchReceipt(receiptno)
})

watch(
  () => form.value.dpccode,
  async () => {
    // reload stock after DPC change
    await Promise.all(form.value.salesdetails.map((it) => loadStock(it)))
  },
)
</script>
