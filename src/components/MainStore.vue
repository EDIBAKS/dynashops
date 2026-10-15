<template>
  <div class="column q-gutter-y-lg q-pb-xl" style="max-width: 1000px; margin: auto">
    <!-- ADD STOCK -->
    <q-card flat bordered class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md">
      <div class="row items-center q-gutter-sm q-mb-md text-blue-grey-9">
        <q-icon name="warehouse" size="22px" class="text-emerald-600" />
        <div class="text-subtitle1 text-bold">Add Stock to Main Store</div>
      </div>

      <q-banner rounded dense class="bg-amber-1 text-amber-10 q-mb-md">
        <template #avatar><q-icon name="info" color="amber-9" /></template>
        Use this only to enter new stock into a province store. It is not for daily dispatching.
      </q-banner>

      <q-form class="column" style="gap: 20px" @submit.prevent="submitAddition">
        <q-select
          v-model="form.province"
          :options="provinceOptions"
          option-label="name"
          option-value="province_code"
          label="Province Store"
          dense
          outlined
          emit-value
          map-options
          options-dense
          behavior="menu"
          popup-content-class="rounded-lg"
        >
          <template #prepend><q-icon name="place" size="18px" /></template>
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section avatar style="min-width: 32px">
                <q-icon name="warehouse" size="18px" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ scope.opt.name }}</q-item-label>
                <q-item-label caption>{{ scope.opt.province_code }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <template #no-option>
            <q-item><q-item-section class="text-grey">No provinces available</q-item-section></q-item>
          </template>
        </q-select>

        <q-select
          v-model="form.product"
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

        <div class="row q-col-gutter-x-md">
          <div class="col-12 col-sm-6">
            <q-input
              :model-value="currentStock"
              label="Current Stock"
              readonly
              dense
              outlined
              input-class="text-blue text-bold text-center"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.quantity"
              type="number"
              min="1"
              label="Quantity (pcs)"
              dense
              outlined
            />
          </div>
        </div>

        <div class="row q-col-gutter-x-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.dateAdded" type="date" label="Date Added" dense outlined />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.expiryDate" type="date" label="Expiry Date" dense outlined />
          </div>
        </div>

        <q-btn
          type="submit"
          label="Add Stock"
          icon="add_circle"
          unelevated
          no-caps
          class="bg-blue-grey-9 text-white rounded-lg"
          :loading="saving"
          :disable="!canAdd || saving"
        />
      </q-form>
    </q-card>

    <!-- ADDITIONS REPORT -->
    <q-card flat bordered class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="row items-center q-gutter-sm text-blue-grey-9">
          <q-icon name="history" size="22px" class="text-emerald-600" />
          <div class="text-subtitle1 text-bold">Stock Additions</div>
        </div>
        <div class="row items-center q-gutter-sm">
          <q-chip dense square class="bg-slate-100 text-slate-700">
            {{ rows.length }} record{{ rows.length === 1 ? '' : 's' }} · {{ totalQty }} pcs
          </q-chip>
          <q-btn
            dense
            unelevated
            no-caps
            icon="grid_on"
            label="Excel"
            class="bg-emerald-600 text-white rounded-lg q-px-sm"
            :disable="!rows.length"
            @click="exportReport('excel')"
          />
          <q-btn
            dense
            unelevated
            no-caps
            icon="picture_as_pdf"
            label="PDF"
            class="bg-blue-grey-9 text-white rounded-lg q-px-sm"
            :disable="!rows.length"
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
        <div class="col-12 col-sm-3">
          <q-btn
            label="Apply"
            icon="search"
            unelevated
            no-caps
            class="bg-blue-grey-9 text-white rounded-lg full-width"
            :loading="reportLoading"
            @click="fetchAdditions"
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
        v-model:pagination="pagination"
        flat
        dense
        row-key="id"
        :rows="rows"
        :columns="columns"
        :loading="reportLoading"
        :rows-per-page-options="[10, 25, 50, 0]"
        table-header-class="bg-slate-100 text-slate-700"
        no-data-label="No additions in this period"
      >
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <q-btn flat round dense size="sm" icon="edit" color="blue-grey-8" @click="openEdit(props.row)">
              <q-tooltip>Edit quantity</q-tooltip>
            </q-btn>
            <q-btn flat round dense size="sm" icon="delete" color="negative" @click="confirmDelete(props.row)">
              <q-tooltip>Delete addition</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- EDIT DIALOG -->
    <q-dialog v-model="editOpen" persistent>
      <q-card class="rounded-2xl" style="min-width: 320px">
        <q-card-section class="text-subtitle1 text-bold text-blue-grey-9">
          Edit Addition
        </q-card-section>
        <q-card-section class="q-pt-none column" style="gap: 12px">
          <div class="text-caption text-grey-8">
            {{ editRow?.productname }} → {{ editRow?.to_location }}
          </div>
          <q-input
            v-model.number="editQty"
            type="number"
            min="1"
            label="New quantity"
            dense
            outlined
            autofocus
          />
          <div class="text-caption text-grey-7">
            The province stock is adjusted by the difference.
          </div>
        </q-card-section>
        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat no-caps label="Cancel" v-close-popup :disable="editSaving" />
          <q-btn
            unelevated
            no-caps
            label="Save"
            class="bg-blue-grey-9 text-white rounded-lg"
            :loading="editSaving"
            :disable="!editQty || editQty < 1 || editQty === editRow?.quantity"
            @click="saveEdit"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
// Dependencies for stock entry, audit logging, and addition reporting.
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'src/boot/supabase'
import { logActivity, ACTIVITY_TYPES } from 'src/utils/activityLog'
import { useAuth } from 'stores/auth'
import { buildExportData, buildMeta, exportExcel, exportPdf } from 'src/utils/reportExport'
import { fetchPriceMap, totalValue, formatMoney } from 'src/utils/productValue'

const $q = useQuasar()
const auth = useAuth()
const currentUser = computed(() => auth.userDetails?.firstname || 'system')

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, '0')
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Same payload reuses the same id so a retry after a lost response applies only once
let pending = { key: null, id: null }
function requestId(...parts) {
  const key = JSON.stringify(parts)
  if (pending.key !== key) pending = { key, id: crypto.randomUUID() }
  return pending.id
}

// ---------- add stock ----------
const provinceOptions = ref([])
const products = ref([])
const filteredProducts = ref([])
const productNames = ref({})
const prices = ref({})
const reportValue = computed(() => totalValue(rows.value, prices.value))
const currentStock = ref(0)
const saving = ref(false)
// Keep the selected store, product, quantity, and dates together.
const form = reactive({ province: null, product: null, quantity: 1, dateAdded: '', expiryDate: '' })

const canAdd = computed(() => form.province && form.product && form.quantity > 0)

async function loadLookups() {
  const [prov, prod] = await Promise.all([
    supabase
      .from('province')
      .select('name, province_code')
      .eq('country_code', auth.userDetails?.country_code),
    supabase.from('products').select('productname, productcode, status'),
  ])
  if (!prov.error) provinceOptions.value = prov.data || []
  if (!prod.error) {
    const all = prod.data || []
    productNames.value = Object.fromEntries(all.map((p) => [p.productcode, p.productname]))
    products.value = all.filter((p) => p.status === 'active')
    filteredProducts.value = products.value
  }
}

function filterProducts(val, update) {
  update(() => {
    const needle = (val || '').toLowerCase()
    filteredProducts.value = needle
      ? products.value.filter(
          (p) =>
            p.productname.toLowerCase().includes(needle) ||
            p.productcode.toLowerCase().includes(needle),
        )
      : products.value
  })
}

async function refreshStock() {
  currentStock.value = 0
  if (!form.province || !form.product) return
  const { data } = await supabase
    .from(form.province)
    .select('quantity')
    .eq('productcode', form.product)
    .maybeSingle()
  currentStock.value = data?.quantity || 0
}

// Refresh the displayed balance whenever the stock lookup changes.
watch(() => [form.province, form.product], refreshStock)

async function submitAddition() {
  if (!canAdd.value || saving.value) return
  const qty = Number(form.quantity)
  if (!Number.isInteger(qty) || qty <= 0) {
    $q.notify({ type: 'negative', message: 'Invalid quantity.' })
    return
  }

  saving.value = true
  try {
    const { error } = await supabase.rpc('add_store_stock', {
      p_store_table: form.province,
      p_productcode: form.product,
      p_quantity: qty,
      p_dateadded: form.dateAdded || null,
      p_expirydate: form.expiryDate || null,
      p_modifiedby: currentUser.value,
      p_request_id: requestId('ADD', form.province, form.product, qty, form.dateAdded, form.expiryDate),
    })
    if (error) throw error
    pending = { key: null, id: null }

    logActivity(ACTIVITY_TYPES.DISPATCH, {
      reference: form.product,
      description: `Store addition ${qty} × ${form.product} to ${form.province}`,
    })
    $q.notify({ type: 'positive', message: `${qty} × ${form.product} added to ${form.province}` })

    Object.assign(form, { product: null, quantity: 1, dateAdded: '', expiryDate: '' })
    await Promise.all([fetchAdditions(), refreshStock()])
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message || 'Failed to add stock' })
  } finally {
    saving.value = false
  }
}

// ---------- report ----------
const now = new Date()
const reportFrom = ref(toISODate(new Date(now.getFullYear(), now.getMonth(), 1)))
const reportTo = ref(toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)))
const rows = ref([])
const reportLoading = ref(false)
const pagination = ref({ sortBy: 'dispatchedon', descending: true, rowsPerPage: 10 })

const totalQty = computed(() => rows.value.reduce((s, r) => s + Number(r.quantity || 0), 0))

const columns = [
  {
    name: 'dispatchedon',
    label: 'Date / Time',
    field: 'dispatchedon',
    align: 'left',
    sortable: true,
    format: (v) => (v ? new Date(v).toLocaleString() : ''),
  },
  { name: 'to_location', label: 'Province', field: 'to_location', align: 'left', sortable: true },
  { name: 'productname', label: 'Product', field: 'productname', align: 'left', sortable: true },
  { name: 'quantity', label: 'Qty', field: 'quantity', align: 'right', sortable: true },
  { name: 'dispatchedby', label: 'Added by', field: 'dispatchedby', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]

function exportReport(kind) {
  const { head, body } = buildExportData(columns, rows.value, pagination.value)
  const payload = {
    title: 'Stock Additions',
    meta: buildMeta({
      from: reportFrom.value,
      to: reportTo.value,
      printedBy: auth.userDetails?.firstname,
      extra: [['Records', body.length], ['Total Qty', totalQty.value], ['Total Value', formatMoney(reportValue.value)]],
    }),
    filename: `Stock_Additions_${reportFrom.value}_${reportTo.value}`,
    head,
    body,
  }
  if (kind === 'excel') exportExcel(payload)
  else exportPdf(payload)
}

async function fetchAdditions() {
  if (!reportFrom.value || !reportTo.value) return
  if (reportFrom.value > reportTo.value) {
    $q.notify({ type: 'warning', message: 'Start date must be before end date.' })
    return
  }
  const [y, m, d] = reportTo.value.split('-').map(Number)
  const endExclusive = toISODate(new Date(y, m - 1, d + 1))

  reportLoading.value = true
  try {
    const { data, error } = await supabase
      .from('dispatchlogs')
      .select('id, to_location, productcode, quantity, dispatchedon, dispatchedby')
      .eq('status', 'STORE_ADDITION')
      .gte('dispatchedon', reportFrom.value)
      .lt('dispatchedon', endExclusive)
      .order('dispatchedon', { ascending: false })
    if (error) throw error
    rows.value = (data || []).map((r) => ({
      ...r,
      productname: productNames.value[r.productcode] || r.productcode,
    }))
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message || 'Failed to load additions' })
  } finally {
    reportLoading.value = false
  }
}

// ---------- edit / delete ----------
const editOpen = ref(false)
const editRow = ref(null)
const editQty = ref(null)
const editSaving = ref(false)

function openEdit(row) {
  editRow.value = row
  editQty.value = row.quantity
  editOpen.value = true
}

async function saveEdit() {
  if (editSaving.value || !editRow.value) return
  editSaving.value = true
  try {
    const { error } = await supabase.rpc('edit_store_addition', {
      p_log_id: editRow.value.id,
      p_new_quantity: Number(editQty.value),
      p_modifiedby: currentUser.value,
    })
    if (error) throw error

    logActivity(ACTIVITY_TYPES.DISPATCH, {
      reference: editRow.value.productcode,
      description: `Store addition edited: ${editRow.value.quantity} → ${editQty.value} × ${editRow.value.productcode} in ${editRow.value.to_location}`,
    })
    $q.notify({ type: 'positive', message: 'Addition updated' })
    editOpen.value = false
    await Promise.all([fetchAdditions(), refreshStock()])
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message || 'Failed to update addition' })
  } finally {
    editSaving.value = false
  }
}

function confirmDelete(row) {
  $q.dialog({
    title: 'Delete addition?',
    message: `Remove ${row.quantity} × ${row.productname} from ${row.to_location}? The stock will be reduced by the same amount.`,
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete' },
    persistent: true,
  }).onOk(async () => {
    try {
      const { error } = await supabase.rpc('delete_store_addition', {
        p_log_id: row.id,
        p_modifiedby: currentUser.value,
      })
      if (error) throw error

      logActivity(ACTIVITY_TYPES.DISPATCH_REVERSAL, {
        reference: row.productcode,
        description: `Store addition deleted: ${row.quantity} × ${row.productcode} from ${row.to_location}`,
      })
      $q.notify({ type: 'positive', message: 'Addition deleted' })
      await Promise.all([fetchAdditions(), refreshStock()])
    } catch (err) {
      $q.notify({ type: 'negative', message: err.message || 'Failed to delete addition' })
    }
  })
}

// Load prices, selection lists, and the initial additions report.
onMounted(async () => {
  prices.value = await fetchPriceMap()
  await loadLookups()
  await fetchAdditions()
})
</script>
