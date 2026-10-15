<template>
  <q-page class="sales-page flex justify-center bg-gray-100 px-4 py-3 sm:px-6 sm:py-4">
    <div class="sales-card w-full max-w-5xl">
      <div
        class="mb-2 flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 px-3 py-2 text-white sm:px-4"
      >
        <div class="flex min-w-0 items-center gap-4">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300 sm:h-10 sm:w-10"
          >
            <q-icon name="shopping_bag" size="21px" />
          </div>
          <div class="min-w-0">
            <div class="truncate text-base font-bold sm:text-xl">{{ shopName }}</div>
            <div class="mt-0.5 text-[0.7rem] font-medium text-slate-200 sm:text-xs">
              {{ $t('newSalesEntry') }}
            </div>
          </div>
        </div>
        <div
          class="hidden shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white sm:flex"
        >
          <q-icon name="shopping_cart" size="18px" class="text-emerald-300" />
          <span>{{ form.items.length }}</span>
          <span>{{ $t('products') }}</span>
        </div>
      </div>

      <CurrencyToggle v-slot="{ convert, formatCurrency }">
        <!-- Gather sale details, products, and cart items for submission. -->
        <q-form @submit.prevent="submitSale" class="custom-form sales-form space-y-2 px-1 py-1 pb-8 sm:px-3">
          <!-- Receipt, distributor, and date details. -->
          <section class="sales-details-section">
            <div class="sales-details-grid">
              <div class="sales-field">
                <label class="sales-label">{{ isAdmin ? $t('selectDPC') : $t('dpcCode') }}</label>
                <div v-if="isAdmin" class="select-wrapper">
                  <select v-model="form.dpccode" class="sales-select">
                    <option v-for="option in dpcOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <input
                  v-else
                  v-model="form.dpccode"
                  readonly
                  class="sales-native-input"
                />
              </div>

              <div class="sales-field">
                <label class="sales-label">{{ $t('salesDate') }}</label>
                <input
                  v-model="form.salesdate"
                  type="date"
                  class="sales-native-input"
                  :min="dateMin"
                  :max="dateMax"
                  :disabled="loading"
                />
              </div>

              <div class="sales-field">
                <label class="sales-label">{{ $t('receiptNo') }}</label>
                <div class="receipt-input-wrap">
                  <input
                    v-model="form.receiptno"
                    type="text"
                    autocomplete="off"
                    ref="receiptInput"
                    class="sales-native-input uppercase receipt-number-input"
                    :readonly="loading || receiptCheckStatus === 'checking'"
                    @input="resetReceiptCheckStatus"
                    @blur="handleReceiptBlur"
                  />
                  <q-spinner
                    v-if="receiptCheckStatus === 'checking'"
                    size="18px"
                    color="primary"
                    class="receipt-check-status"
                    role="status"
                    aria-label="Checking receipt number"
                  />
                  <q-icon
                    v-else-if="receiptCheckStatus === 'valid'"
                    name="check_circle"
                    size="20px"
                    color="positive"
                    class="receipt-check-status"
                    role="status"
                    aria-label="Receipt number is available"
                  />
                </div>
              </div>

              <div class="sales-field">
                <label class="sales-label">{{ $t('distributorId') }}</label>
                <div class="receipt-input-wrap">
                  <input
                    v-model="form.distributoridno"
                    type="text"
                    autocomplete="off"
                    class="sales-native-input uppercase receipt-number-input"
                    @input="resetDistributorCheckStatus"
                    @blur="validateDistributorIDNO"
                    :disabled="loading"
                  />
                  <q-icon
                    v-if="distributorCheckStatus === 'valid'"
                    name="check_circle"
                    size="20px"
                    color="positive"
                    class="receipt-check-status"
                    role="status"
                    aria-label="Distributor ID is valid"
                  />
                </div>
              </div>

              <div class="sales-field">
                <label class="sales-label">{{ $t('searchByName') }}</label>
                <input
                  v-model="searchQuery"
                  type="search"
                  autocomplete="off"
                  class="sales-native-input"
                  :disabled="loading"
                />
                <div
                  v-if="searchQuery.trim() !== '' && !confirmedDistributor && !filteredDistributors.length"
                  class="mt-1 text-xs font-medium text-red-600"
                >
                  {{ $t('noResultsFound') }}
                </div>
              </div>

              <ul
                v-if="filteredDistributors.length && searchQuery.trim() !== '' && !confirmedDistributor"
                class="suggestion-list sales-suggestion-list"
              >
                <li
                  v-for="distributor in filteredDistributors"
                  :key="distributor.DistributorIDNO"
                  @click="selectDistributor(distributor)"
                  class="distributor-option"
                >
                  <q-icon name="person" size="18px" class="mr-2 text-slate-500" />
                  {{ distributor.DistributorNames }}
                </li>
              </ul>

              <div v-if="distributorError" class="sales-field-error text-sm font-medium text-red-600">
                {{ distributorError }}
              </div>
            </div>
          </section>

          <!-- Choose a product and set its sale quantity. -->
          <section class="sales-product-section">
            <div class="sales-field sales-product-field mb-2">
              <label class="sales-label text-xs">{{ $t('selectProduct') }}</label>
              <div class="sales-product-picker">
                <q-icon name="search" size="19px" class="sales-product-search-icon" />
                <input
                  v-model="productSearch"
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="sales-product-options"
                  :aria-expanded="showProductOptions"
                  :placeholder="$t('selectProduct')"
                  class="sales-native-input sales-product-search"
                  :disabled="loading"
                  @focus="showProductOptions = true"
                  @blur="showProductOptions = false"
                  @input="handleProductSearch"
                  @keydown.esc="showProductOptions = false"
                />
                <button
                  v-if="productSearch"
                  type="button"
                  class="sales-product-clear"
                  :aria-label="$t('clearProductSelection')"
                  @mousedown.prevent
                  @click="clearProductSelection"
                >
                  <q-icon name="close" size="18px" />
                </button>

                <ul
                  v-if="showProductOptions"
                  id="sales-product-options"
                  role="listbox"
                  class="sales-product-options"
                >
                  <li v-for="product in productOptions" :key="product.productcode">
                    <button
                      type="button"
                      role="option"
                      :aria-selected="selectedProductCode === product.productcode"
                      class="sales-product-option"
                      @mousedown.prevent
                      @click="chooseProduct(product)"
                    >
                      <span class="min-w-0 truncate">{{ product.productname }}</span>
                      <q-icon
                        v-if="selectedProductCode === product.productcode"
                        name="check"
                        size="17px"
                        class="shrink-0 text-light-green-4"
                      />
                    </button>
                  </li>
                  <li v-if="productOptions.length === 0" class="sales-product-empty">
                    {{ $t('noResultsFound') }}
                  </li>
                </ul>
              </div>
            </div>

            <div class="sales-stock-indicator">
              <q-icon name="inventory" size="15px" class="text-blue-grey-7" />
              <span>{{ $t('quantity') }}:</span>
              <q-spinner-dots
                v-if="stockLoading"
                color="blue-grey-8"
                size="20px"
                aria-label="Loading available quantity"
              />
              <strong v-else>{{ availableQuantity }}</strong>
            </div>

            <div class="sales-quantity-grid">
              <div class="sales-field">
                <label class="sales-label">{{ $t('qty') }}</label>
                <input
                  v-model.number="selectedQuantity"
                  type="number"
                  min="1"
                  inputmode="numeric"
                  class="sales-native-input text-center font-semibold"
                  @input="updateTotals"
                  :disabled="loading"
                />
              </div>
              <div class="sales-field">
                <label class="sales-label">{{ $t('price') }}</label>
                <div class="sales-readonly-value">{{ totalPrice || '—' }}</div>
              </div>
              <div class="sales-field">
                <label class="sales-label">{{ $t('bv') }}</label>
                <div class="sales-readonly-value">{{ totalBV || '—' }}</div>
              </div>
            </div>

            <q-btn
              icon="add_shopping_cart"
              color="blue-grey-9"
              :label="$t('addProduct')"
              class="sales-action-btn full-width q-mt-sm rounded-xl bg-blue-grey-9 font-semibold text-white shadow-md"
              @click="addProduct"
              :disable="disableAddButton"
            />
          </section>

          <!-- Review and remove products before saving the sale. -->
          <section class="sales-cart-section">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <div class="sales-section-icon bg-amber-50 text-amber-700">
                  <q-icon name="shopping_cart" size="18px" />
                </div>
                <div>
                  <p class="text-[0.65rem] text-slate-500">{{ form.items.length }} {{ $t('products') }}</p>
                </div>
              </div>
              <q-badge
                rounded
                color="blue-grey-1"
                text-color="blue-grey-9"
                class="px-3 py-2 text-sm font-bold"
              >
                {{ form.items.length }}
              </q-badge>
            </div>

            <div v-if="form.items.length === 0" class="sales-empty-cart rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
              <q-icon name="production_quantity_limits" size="40px" class="text-slate-400" />
              <p class="mt-1 text-sm text-slate-500">{{ $t('selectProduct') }}</p>
            </div>

            <q-list v-else class="sales-cart-list">
              <q-item
                v-for="(product, index) in form.items"
                :key="index"
                class="sales-cart-item px-3 py-3 sm:px-4"
              >
                <q-item-section class="min-w-0">
                  <q-item-label class="sales-cart-product-name">
                    {{ product.productname }}
                  </q-item-label>
                  <div class="sales-cart-product-details">
                    <span>{{ $t('price') }}: {{ convert(product.unitprice * product.quantity) }}</span>
                    <span>{{ $t('bv') }}: {{ product.unitbv * product.quantity }}</span>
                    <span>{{ $t('qty') }}: {{ product.quantity }}</span>
                  </div>
                </q-item-section>
                <q-item-section side class="sales-cart-actions">
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete_outline"
                    color="negative"
                    aria-label="Remove product"
                    @click="removeItem(index)"
                  />
                </q-item-section>
              </q-item>
            </q-list>

            <div class="sales-cart-totals">
              <div class="sales-cart-total-heading">
                <q-icon name="receipt" size="18px" />
                <span>{{ $t('totalAmount') }}</span>
              </div>
              <div class="sales-cart-total-row">
                <span>USD</span>
                <strong>{{ formatCurrency(totalReceiptAmount, 'dollar') }}</strong>
              </div>
              <div class="sales-cart-total-row">
                <span>FC</span>
                <strong>{{ formatCurrency(totalReceiptAmount, 'local') }}</strong>
              </div>
              <div class="sales-cart-total-row sales-cart-total-bv">
                <span>{{ $t('bv') }}</span>
                <strong>{{ totalReceiptBv }}</strong>
              </div>
            </div>
          </section>

          <q-btn
            :label="$t('submitSale')"
            icon="check_circle"
            color="blue-grey-9"
            text-color="white"
            class="sales-action-btn sales-submit-btn full-width rounded-xl bg-blue-grey-9 font-bold text-white shadow-lg"
            type="submit"
            :loading="loading"
          />
        </q-form>
      </CurrencyToggle>
    </div>
  </q-page>
</template>

<script setup>
// Vue and application dependencies for the sales entry flow.
import { ref, reactive, onMounted, watch, computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSalesStore } from '../stores/salesStore'
//import { useAuth } from '../stores/auth'
import { useQuasar } from 'quasar'
import { supabase } from '../boot/supabase'
import { useAuth } from '../stores/auth.js'
import CurrencyToggle from '../components/currencyTogle.vue'
// Session, sale form, product selection, and validation state.
const auth = useAuth()
const $q = useQuasar()
const notifySales = (options) => {
  const classes = [options.classes, 'sales-notification'].filter(Boolean).join(' ')
  $q.notify({ ...options, classes })
}
const store = useSalesStore()
const { t: $t, locale } = useI18n()
//const userStore = useAuth()
const loading = ref(false)
const availableQuantity = ref(0)
const stockLoading = ref(false)
let stockRequestId = 0
import { toRaw } from 'vue'
const searchQuery = ref('') // Search query for filtering
const distributors = ref([])
const filteredDistributors = ref([])
const shopName = ref('')
const DistributorIDNO = ref('')
const distributorError = ref('')
const receiptInput = ref(null)
const receiptCheckStatus = ref('idle')
let receiptCheckPromise = null
let receiptCheckRequestId = 0
let verifiedReceiptNo = ''
const distributorCheckStatus = ref('idle')
let distributorCheckRequestId = 0
let verifiedDistributorId = ''
const confirmedDistributor = ref(false)
const dpcOptions = ref([])
const salesDateError = ref('') // For date validation
//const searchError = ref('') // For "no results found"

const form = reactive({
  receiptno: '',
  distributoridno: '',
  salesdate: '',
  dpccode: '',
  createdby: auth.userDetails.firstname,
  lastModifiedby: auth.userDetails.firstname,
  entrysource: 'app',
  entered_by: auth.user.id, // maybe set from auth
  items: [],
})

const selectedProductCode = ref(null)
//const selectedQuantity = ref(1)
const selectedProduct = ref(null)
const productSearch = ref('')
const showProductOptions = ref(false)

const selectedQuantity = ref(1)
const unitPrice = ref(0)
const unitBV = ref(0)

// Get current date info
const today = new Date()
const year = today.getFullYear()
const month = today.getMonth()

// Format function (yyyy-mm-dd)
const formatDate = (date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Compute first & last day of current month
const firstDay = formatDate(new Date(year, month, 1))
const lastDay = formatDate(new Date(year, month + 1, 0))

// Role-based restriction
// Derived role permissions, date limits, and sale totals.
const userRole = computed(() => auth.userDetails?.role || 'User')

const dateMin = computed(() => {
  return ['Admin', 'SuperAdmin'].includes(userRole.value)
    ? null // No restriction
    : firstDay
})

const dateMax = computed(() => {
  return ['Admin', 'SuperAdmin'].includes(userRole.value)
    ? null // No restriction
    : lastDay
})

// Cart operations and stock lookup for selected products.
const removeItem = (index) => {
  form.items.splice(index, 1)
}

const fetchShopName = async () => {
  try {
    const { data: shop, error } = await supabase
      .from('shops')
      .select('shop_name')
      .eq('shopcode', auth.userDetails?.dpc_id) // match the shopcode
      .maybeSingle() // returns null if no match

    if (error) {
      console.error('Error fetching shop name:', error.message)
      return
    }

    if (shop) {
      shopName.value = shop.shop_name
    } else {
      shopName.value = 'Unknown Shop'
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

//const totalPrice = computed(() => unitPrice.value * selectedQuantity.value)
//const totalBV = computed(() => unitBV.value * selectedQuantity.value)
const totalPrice = computed(() => {
  if (!unitPrice.value || !selectedQuantity.value) return ''
  return unitPrice.value * selectedQuantity.value
})

const totalBV = computed(() => {
  if (!unitBV.value || !selectedQuantity.value) return ''
  return unitBV.value * selectedQuantity.value
})
const productOptions = computed(() => {
  const needle = productSearch.value.trim().toLowerCase()
  return store.products.filter((product) =>
    String(product.productname || '')
      .toLowerCase()
      .includes(needle),
  )
})

const handleProductSearch = () => {
  showProductOptions.value = true

  if (selectedProduct.value && productSearch.value !== selectedProduct.value.productname) {
    selectedProductCode.value = null
    selectedProduct.value = null
    availableQuantity.value = 0
    unitPrice.value = 0
    unitBV.value = 0
    selectedQuantity.value = 1
  }
}

const chooseProduct = async (product) => {
  productSearch.value = product.productname
  selectedProductCode.value = product.productcode
  showProductOptions.value = false
  await updateSelectedProduct(product.productcode)
}

const clearProductSelection = () => {
  stockRequestId += 1
  stockLoading.value = false
  productSearch.value = ''
  selectedProductCode.value = null
  selectedProduct.value = null
  availableQuantity.value = 0
  unitPrice.value = 0
  unitBV.value = 0
  selectedQuantity.value = 1
  showProductOptions.value = true
}
//watch that quantity never goes below 1
// Keep quantity changes within the available stock.
watch(selectedQuantity, (val) => {
  if (val < 1) selectedQuantity.value = 1
})

watch(selectedQuantity, (newQty) => {
  if (selectedProduct.value && availableQuantity.value > 0 && newQty > availableQuantity.value) {
    notifySales({
      type: 'negative',
      message: $t('quantityExceedsStock'),
      position: 'center',
      icon: 'warning',
    })
  }
})

async function updateSelectedProduct(code) {
  const requestId = ++stockRequestId
  selectedProduct.value = store.products.find((p) => p.productcode === code)

  if (selectedProduct.value) {
    unitPrice.value = selectedProduct.value.distributorprice
    unitBV.value = selectedProduct.value.bvs
    selectedQuantity.value = 1

    if (form.dpccode) {
      const fromTable = `${form.dpccode}_STOCK`
      stockLoading.value = true

      try {
        const { data, error } = await supabase
          .from(fromTable)
          .select('quantity')
          .eq('productcode', code)
          .maybeSingle()

        if (requestId !== stockRequestId) return

        if (error) {
          console.error('Error fetching stock:', error.message)
          availableQuantity.value = 0
        } else {
          availableQuantity.value = data ? data.quantity : 0
        }
      } catch (error) {
        if (requestId === stockRequestId) {
          console.error('Unexpected error fetching stock:', error)
          availableQuantity.value = 0
        }
      } finally {
        if (requestId === stockRequestId) stockLoading.value = false
      }
    } else {
      stockLoading.value = false
      availableQuantity.value = 0
    }
  }
}

const disableAddButton = computed(() => {
  // No product selected
  if (!selectedProduct.value) return true

  // No stock or negative stock
  if (availableQuantity.value <= 0) return true

  // Quantity entered is invalid or exceeds stock
  if (selectedQuantity.value > availableQuantity.value) return true

  // Valid: button enabled
  return false
})

function updateTotals() {
  if (selectedProduct.value) {
    // 🚨 Check if quantity entered exceeds available stock
    if (selectedQuantity.value > availableQuantity.value) {
      notifySales({
        type: 'negative',
        message: $t('dispatchLimitError'),
        position: 'center',
        color: 'negative',
        icon: 'warning',
        timeout: 3000,
      })

      // 🔁 Reset values since quantity is invalid
      selectedQuantity.value = 0
      totalPrice.value = 0
      totalBV.value = 0

      return
    }

    // ✅ Safe to calculate totals
    totalPrice.value = selectedProduct.value.distributorprice * selectedQuantity.value
    totalBV.value = selectedProduct.value.bvs * selectedQuantity.value
  } else {
    // 🔁 Reset everything if no product is selected
    totalPrice.value = 0
    totalBV.value = 0
    selectedQuantity.value = 0
  }
}

// Add selected product to salesItems

function addProduct() {
  if (!selectedProduct.value || selectedQuantity.value <= 0) return

  stockRequestId += 1
  stockLoading.value = false
  form.items.push({
    productname: selectedProduct.value.productname,
    productcode: selectedProduct.value.productcode,
    unitprice: selectedProduct.value.distributorprice,
    unitbv: selectedProduct.value.bvs,
    quantity: selectedQuantity.value,
  })

  selectedProductCode.value = null
  selectedProduct.value = null
  productSearch.value = ''
  showProductOptions.value = false
  availableQuantity.value = 0
  selectedQuantity.value = 1
  unitPrice.value = 0
  unitBV.value = 0
}

// ----------------------------
// Distributor Search (remote + debounced)
// ----------------------------

const fetchDistributors = async (query) => {
  const { data, error } = await supabase
    .from('Distributors')
    .select('DistributorIDNO, DistributorNames')
    .ilike('DistributorNames', `%${query}%`)

  if (error) {
    console.error('Error fetching distributors:', error)
  } else {
    distributors.value = data
  }
}

const resetDistributorCheckStatus = () => {
  distributorCheckRequestId += 1
  verifiedDistributorId = ''
  distributorCheckStatus.value = 'idle'
}

const validateDistributorIDNO = async () => {
  const id = String(form.distributoridno || '').trim().toUpperCase()
  if (!id) {
    resetDistributorCheckStatus()
    return
  }
  if (distributorCheckStatus.value === 'valid' && verifiedDistributorId === id) return

  const requestId = ++distributorCheckRequestId
  form.distributoridno = id

  try {
    const { data, error } = await supabase
      .from('Distributors')
      .select('DistributorNames')
      .ilike('DistributorIDNO', id)
      .maybeSingle()

    if (requestId !== distributorCheckRequestId) return

    if (error || !data) {
      if (error) console.error('Distributor ID lookup failed:', error)
      notifySales({
        type: 'negative',
        message: error ? $t('distributorLookupFailed') : $t('distributorNotFound'),
        position: 'center',
        timeout: 2500,
        classes: 'text-center text-h6',
      })

      form.distributoridno = ''
      searchQuery.value = ''
      confirmedDistributor.value = false
      distributorError.value = ''
      resetDistributorCheckStatus()
      return
    }

    distributorError.value = ''
    searchQuery.value = data.DistributorNames
    confirmedDistributor.value = true
    verifiedDistributorId = id
    distributorCheckStatus.value = 'valid'
  } catch (error) {
    if (requestId !== distributorCheckRequestId) return
    console.error('Distributor ID lookup failed:', error)
    notifySales({
      type: 'negative',
      message: $t('distributorLookupFailed'),
      position: 'center',
      timeout: 2500,
    })
    form.distributoridno = ''
    searchQuery.value = ''
    confirmedDistributor.value = false
    distributorError.value = ''
    resetDistributorCheckStatus()
  }
}

// Select a distributor from the list
const selectDistributor = (distributor) => {
  resetDistributorCheckStatus()
  searchQuery.value = distributor.DistributorNames
  DistributorIDNO.value = distributor.DistributorIDNO

  // ✅ Sync to store
  form.distributoridno = distributor.DistributorIDNO
  verifiedDistributorId = String(distributor.DistributorIDNO).trim().toUpperCase()
  distributorCheckStatus.value = 'valid'

  // ✅ Hide suggestions
  confirmedDistributor.value = true
  filteredDistributors.value = []

  // Optional: refocus the input
  //document.querySelector('.search-input').focus()
  document.querySelector('.search-input')?.focus()
}

const totalReceiptAmount = computed(() => {
  if (!form.items || form.items.length === 0) return 0
  return form.items.reduce((sum, item) => sum + item.unitprice * item.quantity, 0)
})
const totalReceiptBv = computed(() => {
  if (!form.items || form.items.length === 0) return 0
  return form.items.reduce((sum, item) => sum + item.unitbv * item.quantity, 0)
})

//const totalReceiptAmountUSD = computed(() => {
// if (!exchangeRate.value) return 0
//  return (totalReceiptAmount.value * exchangeRate.value).toFixed(0)
//})

// Watch for changes in searchQuery and fetch matching distributors
watchEffect(() => {
  if (searchQuery.value.trim() !== '') {
    fetchDistributors(searchQuery.value)
  } else {
    distributors.value = []
  }
})

// Filter distributors based on searchQuery
watchEffect(() => {
  filteredDistributors.value = distributors.value.filter((distributor) =>
    distributor.DistributorNames.toLowerCase().includes(searchQuery.value.toLowerCase()),
  )
})

// Clear DistributorIDNO if searchQuery is cleared
// Clear DistributorIDNO if searchQuery is cleared

watch(searchQuery, (newVal) => {
  if (!newVal.trim()) {
    DistributorIDNO.value = ''
    distributorError.value = ''
    form.distributoridno = ''
    confirmedDistributor.value = false // 👈 reset confirmation so search works again
  }
})
watch(searchQuery, (newVal) => {
  if (!newVal.trim()) {
    // user cleared the field completely
    confirmedDistributor.value = false
    form.distributoridno = ''
    DistributorIDNO.value = ''
  }
})

watch(
  () => form.dpccode,
  (dpccode) => {
    receiptCheckRequestId += 1
    receiptCheckPromise = null
    verifiedReceiptNo = ''
    receiptCheckStatus.value = 'idle'
    form.receiptno = dpccode ? String(dpccode).trim().toUpperCase() : ''
  },
)

// ----------------------------
// Product Select + Add to Cart
// ----------------------------

const resetReceiptCheckStatus = () => {
  receiptCheckRequestId += 1
  receiptCheckPromise = null
  verifiedReceiptNo = ''
  receiptCheckStatus.value = 'idle'
}

const handleReceiptBlur = async (event) => {
  const nextTarget = event.relatedTarget
  const validation = validateReceiptNo()
  if (receiptCheckStatus.value !== 'checking') return

  receiptInput.value?.focus()
  await validation
  if (nextTarget?.isConnected && typeof nextTarget.focus === 'function') {
    nextTarget.focus()
  }
}

const validateReceiptNo = () => {
  if (receiptCheckPromise) return receiptCheckPromise

  const requestId = ++receiptCheckRequestId
  const check = async () => {
    const prefix = String(form.dpccode || '')
      .trim()
      .toUpperCase()
    const resetReceiptNo = () => {
      form.receiptno = prefix
      verifiedReceiptNo = ''
      receiptCheckStatus.value = 'idle'
    }

    if (!form.salesdate) {
      salesDateError.value = $t('selectSalesDate')
      resetReceiptNo()
      return false
    }
    salesDateError.value = ''

    let receipt = String(form.receiptno || '')
      .trim()
      .toUpperCase()
    if (!receipt || receipt === prefix) return false
    if (prefix && !receipt.startsWith(prefix)) receipt = `${prefix}${receipt}`
    while (prefix && receipt.startsWith(`${prefix}${prefix}`)) {
      receipt = receipt.slice(prefix.length)
    }
    if (receiptCheckStatus.value === 'valid' && verifiedReceiptNo === receipt) return true

    if (!/^[a-zA-Z0-9_-]+$/.test(receipt)) {
      notifySales({
        type: 'negative',
        message: $t('receiptInvalidChars'),
        position: 'center',
        timeout: 2000,
        classes: 'text-center text-h6',
      })
      resetReceiptNo()
      return false
    }

    form.receiptno = receipt
    receiptCheckStatus.value = 'checking'

    try {
      const [salesResp, usedResp] = await Promise.all([
        supabase
          .from('salesheader')
          .select('distributoridno, datecreated')
          .ilike('receiptno', receipt)
          .maybeSingle(),
        supabase
          .from('UsedCsi')
          .select('"ReceiptNo", "DistributorIDNO", "SalesDate"')
          .eq('"ReceiptNo"', receipt)
          .maybeSingle(),
      ])

      if (requestId !== receiptCheckRequestId) return false

      if (salesResp.error || usedResp.error) {
        console.error('Receipt lookup failed:', salesResp.error || usedResp.error)
        notifySales({ type: 'negative', message: $t('receiptLookupFailed'), timeout: 3000 })
        resetReceiptNo()
        return false
      }

      const salesMatch = salesResp.data
      const usedMatch = usedResp.data

      if (salesMatch || usedMatch) {
        const distributoridno =
          salesMatch?.distributoridno || usedMatch?.DistributorIDNO || null
        const datecreated = salesMatch?.datecreated || usedMatch?.SalesDate || null

        let distName = 'Unknown'
        if (distributoridno) {
          const { data: distributor, error: distErr } = await supabase
            .from('Distributors')
            .select('"DistributorNames"')
            .ilike('"DistributorIDNO"', distributoridno.trim())
            .maybeSingle()

          if (distErr) console.error('Distributors query error', distErr)

          distName = distributor?.DistributorNames || 'Unknown'
        }

        const formattedDate = datecreated
          ? new Date(datecreated).toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US')
          : $t('receiptPreviouslyUsed')

        notifySales({
          type: 'negative',
          message: $t('noExists', {
            date: formattedDate,
            client: distName,
            distributorid: distributoridno || receipt,
          }),
          timeout: 6500,
          position: 'center',
        })

        resetReceiptNo()
        return false
      }

      form.receiptno = receipt
      verifiedReceiptNo = receipt
      receiptCheckStatus.value = 'valid'
      return true
    } catch (err) {
      if (requestId !== receiptCheckRequestId) return false
      console.error('validateReceiptNo error', err)
      notifySales({ type: 'negative', message: $t('unexpectedError'), timeout: 3000 })
      resetReceiptNo()
      return false
    }
  }

  receiptCheckPromise = check().finally(() => {
    if (requestId === receiptCheckRequestId) {
      if (receiptCheckStatus.value === 'checking') receiptCheckStatus.value = 'idle'
      receiptCheckPromise = null
    }
  })
  return receiptCheckPromise
}

const submitSale = async () => {
  if (loading.value) return

  loading.value = true

  try {
    // 1️⃣ Basic header validation
    const receiptPrefix = String(form.dpccode || '').trim().toUpperCase()
    const receiptValue = String(form.receiptno || '').trim().toUpperCase()
    if (
      !form.salesdate ||
      !form.distributoridno ||
      !receiptValue ||
      receiptValue === receiptPrefix
    ) {
      notifySales({
        type: 'negative',
        message: $t('fillRequiredHeader'),
        position: 'center',
      })
      return
    }

    // 2️⃣ At least one product
    if (!form.items || form.items.length === 0) {
      notifySales({
        type: 'negative',
        message: $t('addAtLeastOneProduct'),
        position: 'center',
      })
      return
    }

    if (!(await validateReceiptNo())) return

    // 4️⃣ Clean deep clone (required)
    const payload = JSON.parse(JSON.stringify(toRaw(form)))

    // 5️⃣ Submit to store → RPC transaction
    const result = await store.submitSale(payload)
    if (!result.success) throw result.error

    // 6️⃣ Success message
    notifySales({
      type: 'positive',
      message: $t('saleSubmitted'),
      position: 'center',
    })

    // 7️⃣ Reset form
    resetForm()
  } catch (err) {
    console.error('Error submitting sale:', err)
    notifySales({
      type: 'negative',
      message: $t('saleSubmitFailed'),
      position: 'center',
    })
  } finally {
    loading.value = false
  }
}

function resetForm() {
  const currentRate = form.exchangeRate
  const selectedDpc = form.dpccode
  const selectedSalesDate = form.salesdate

  Object.assign(form, {
    dpccode: selectedDpc,
    receiptno: selectedDpc ? String(selectedDpc).trim().toUpperCase() : '',
    salesdate: selectedSalesDate,
    distributoridno: '',
    createdby: auth.userDetails.firstname,
    lastModifiedby: auth.userDetails.firstname,
    entrysource: 'app',
    entered_by: auth.id,
    items: [],
    exchangeRate: currentRate,
  })

  resetReceiptCheckStatus()
  searchQuery.value = ''
}

// ----------------------------
// On Component Mount
// ----------------------------
onMounted(async () => {
  // --- Set today’s date ---
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  form.salesdate = `${yyyy}-${mm}-${dd}`

  // --- Load essential data ---
  auth.loadFromLocalStorage()
  store.fetchProducts()
  store.fetchExchangeRate()
  fetchShopName()

  try {
    const role = auth.userDetails?.role
    const provinceCode = auth.userDetails?.province_code
    const userDpc = auth.userDetails?.dpc_id

    let { data, error } = { data: [], error: null }

    if (role === 'SuperAdmin') {
      // ✅ SuperAdmin gets all DPCs
      ;({ data, error } = await supabase
        .from('shops')
        .select('shopcode, shop_name, province_code, country_code'))
    } else if (role === 'Admin') {
      // ✅ Admin only sees DPCs in their province
      ;({ data, error } = await supabase
        .from('shops')
        .select('shopcode, shop_name')
        .eq('province_code', provinceCode))
    }

    if (error) throw error

    if (role === 'SuperAdmin' || role === 'Admin') {
      // ✅ Populate dropdown
      dpcOptions.value = (data || []).map((d) => ({
        label: d.shop_name,
        value: d.shopcode,
      }))

      // ✅ Preselect user's own DPC if it exists
      if (!form.dpccode) form.dpccode = userDpc
    } else if (role === 'User') {
      // ✅ User cannot change DPC
      if (!form.dpccode) form.dpccode = userDpc
    }
  } catch (err) {
    console.error('Error loading DPCs:', err.message)
    notifySales({
      type: 'negative',
      message: $t('dpcLoadFailed'),
    })
  }
})

// Computed to check role
const isAdmin = computed(() => ['Admin', 'SuperAdmin'].includes(auth.userDetails?.role))
watch(
  () => auth.userDetails,
  (newVal) => {
    if (newVal && !form.dpccode) {
      form.dpccode = newVal.dpc_id
    }
  },
  { immediate: true },
)
</script>

<style scoped>
*,
*::before,
*::after {
  box-sizing: border-box;
}

.rounded-borders {
  border-radius: 0.5rem;
}
.hover\:bg-blue-1:hover {
  background-color: #e3f2fd;
}
.search-input {
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.distributor-option {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #ddd;
}

.distributor-option:hover {
  background-color: #f1f1f1;
}

.distributor-container {
  display: flex;
  align-items: center;
  gap: 8px; /* Adds spacing between the name and the GIF */
}
.suggestion-list {
  background-color: #ffffff;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-top: 4px;
  padding: 8px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  position: absolute;
  width: 100%;
}

.distributor-option {
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.distributor-option:hover {
  background-color: #f0f0f0;
}
/* Apply to all outlined inputs/selects inside your form */
.custom-form ::v-deep(.q-field--outlined .q-field__control) {
  border: 1px solid #5eee42 !important; /* darker border */
  border-radius: 4px; /* optional: smoother edges */
}

/* Stronger border on hover */
.custom-form ::v-deep(.q-field--outlined:hover .q-field__control) {
  border-color: #111 !important;
}

/* Stronger + colored border when focused */
.custom-form ::v-deep(.q-field--outlined.q-field--focused .q-field__control) {
  border: 2px solid #0d47a1 !important; /* deep blue when focused */
  box-shadow: 0 0 4px rgba(13, 71, 161, 0.5); /* optional glow */
}
.custom-list {
  font-size: 14px; /* default */
  border: 1.5px solid #1b5e20; /* stronger blue border */
  background-color: #f7f3f3; /* light background */
  border-radius: 6px; /* keep rounded look */
}

.custom-list .q-item__label {
  white-space: nowrap; /* ✅ prevent text from wrapping */
  overflow: hidden; /* optional: hide overflow */
  text-overflow: ellipsis; /* optional: show "..." */
}

@media (max-width: 600px) {
  .custom-list {
    font-size: 12px; /* ✅ smaller font on mobile */
  }
}
.custom-list .q-item__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px; /* adjust based on layout */
}
.product-summary {
  white-space: nowrap;
  overflow-x: auto; /* allow horizontal scroll if too long */
}

@media (max-width: 600px) {
  .product-summary {
    font-size: 0.75rem; /* smaller text on small screens */
  }
  .product-summary span {
    margin-left: 0.25rem; /* reduce space for small screens */
  }
}
.currency-display {
  font-size: 2.2rem; /* bigger and noticeable */
  font-weight: bold;
  display: flex;
  align-items: baseline;
  letter-spacing: 0.5px; /* improves readability */
}

.currency-display .currency {
  font-size: 1.2rem; /* smaller than amount */
  margin-left: 4px; /* space between number and currency */
  opacity: 0.8; /* subtle, not overpowering */
}
.select-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.custom-select {
  width: 100%;
  padding: 8px;
  border: 1px solid white;
  border-radius: 8px;
  color: white;
  text-align: center;
  background-color: #263238; /* matches Quasar bg-blue-grey-10 */
  appearance: none;
  box-sizing: border-box;
  max-width: 100%;
  font-size: 14px;
}

.custom-select option {
  background-color: #263238; /* dropdown list color */
  color: white;
}

.custom-select:focus {
  outline: none;
  border-color: #00bfa5; /* teal focus border */
}
.custom-select {
  background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 16px;
  padding-right: 32px; /* make room for arrow */
}

.native-select {
  width: 120px;
  background-color: #263238;
  color: white; /* white text */
  border: 1px solid white; /* white outline */
  border-radius: 6px; /* rounded corners */
  padding: 8px; /* inner spacing */
  height: 38px; /* CONTROL HEIGHT */
  appearance: none; /* remove default arrow */
  -moz-appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

/* Optional: add custom dropdown arrow on the right (cleaner UI) */
.native-select {
  background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='16' viewBox='0 0 24 24' width='16' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.custom-list {
  border-color: white !important; /* Makes outer border white */
}

.custom-item-separator:not(:last-child) {
  border-bottom: 1px solid white !important; /* Adds white line between items */
}
.q-field__native {
  text-align: center !important;
}

/* Target inactive (disabled) month/year text in the QDate popup */
.q-date__view--months .q-date__months-item.q-date__months-item--inactive,
.q-date__view--years .q-date__years-item.q-date__years-item--inactive {
  color: orange !important; /* Make inactive months/years orange */
  opacity: 1 !important; /* Ensure full visibility */
}
.quantity-label {
  width: 100%;
  padding: 12px;

  color: white;
  font-size: 1.2rem;
  font-weight: semi-bold;

  border-radius: 10px;
  text-align: center;
}

.sales-page {
  width: 100%;
}

.sales-details-section {
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 1rem;
}

.sales-section-icon {
  display: flex;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
}

.sales-label {
  display: block;
  margin-bottom: 0.25rem;
  color: #334155;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.125rem;
}

.sales-action-btn {
  min-height: 2.875rem;
}

.sales-submit-btn {
  margin-top: 0;
}

.sales-cart-list {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  background: #fff;
  padding: 0;
  box-shadow: 0 4px 12px rgb(15 23 42 / 5%);
}

.sales-product-section,
.sales-cart-section {
  min-width: 0;
  padding: 0.25rem 0;
}

.sales-cart-item {
  min-height: 0;
  background: #fff;
  transition:
    background-color 150ms ease,
    transform 150ms ease;
}

.sales-cart-item:not(:last-child) {
  border-bottom: 1px solid #e2e8f0;
}

.sales-cart-item:hover {
  background: #f8fafc;
}

.sales-cart-item:nth-child(odd) {
  background: #f1f5f9;
}

.sales-cart-item:nth-child(odd):hover {
  background: #e2e8f0;
}

.sales-cart-product-name {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  color: #0f172a;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.25rem;
  line-clamp: 2;
  text-align: center;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.sales-cart-product-details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.25rem 0.75rem;
  margin-top: 0.4rem;
  color: #475569;
  font-size: 0.75rem;
  line-height: 1rem;
  text-align: center;
}

.sales-cart-actions {
  min-width: 2.5rem;
  padding-left: 0.375rem;
}

.sales-cart-totals {
  margin-top: 0.5rem;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 1rem;
  background: linear-gradient(110deg, #1e293b, #334155);
  padding: 0.75rem 1rem;
  color: #fff;
}

.sales-cart-total-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
  color: #cbd5e1;
  font-size: 0.8125rem;
  font-weight: 700;
}

.sales-cart-total-heading .q-icon {
  color: #a5d6a7;
}

.sales-cart-total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0;
  color: #cbd5e1;
  font-size: 0.8125rem;
}

.sales-cart-total-row strong {
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 700;
  text-align: right;
}

.sales-cart-total-bv {
  margin-top: 0.25rem;
  border-top: 1px solid rgb(255 255 255 / 15%);
  padding-top: 0.5rem;
}

.sales-cart-total-bv strong {
  color: #fcd34d;
}

.select-leading-icon {
  position: absolute;
  top: 50%;
  left: 0.875rem;
  z-index: 1;
  color: #64748b;
  pointer-events: none;
  transform: translateY(-50%);
}

.native-select:focus-visible {
  border-color: #2563eb;
  outline: none;
  box-shadow: 0 0 0 4px rgb(37 99 235 / 14%);
}

.sales-form :deep(.q-field--outlined .q-field__control) {
  border-radius: 0.75rem;
  background: #fff;
}

.sales-form :deep(.q-field--outlined .q-field__control::before) {
  border-color: #cbd5e1;
}

.sales-form :deep(.q-field--outlined:hover .q-field__control::before) {
  border-color: #94a3b8;
}

.sales-form :deep(.q-field--filled .q-field__control) {
  border-radius: 0.75rem;
  background: #f8fafc;
}

.sales-form :deep(.q-field--filled .q-field__control::before) {
  border-bottom: 1px solid #cbd5e1;
}

.sales-form :deep(.q-field__native),
.sales-form :deep(.q-field__input) {
  color: #111827;
  font-size: 1rem;
}

.native-select {
  height: 44px;
  border: 1px solid #cbd5e1;
  border-radius: 0.75rem;
  background-color: #fff;
  color: #1e293b;
}

.custom-list {
  border-color: #e2e8f0 !important;
  background: #fff !important;
}

.custom-item-separator:not(:last-child) {
  border-bottom-color: #e2e8f0 !important;
}

:global(.sales-notification) {
  max-width: min(92vw, 32rem);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 0.875rem;
  box-shadow: 0 12px 32px rgb(15 23 42 / 24%);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

:global(.sales-notification .q-notification__message) {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
}

.sales-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sales-details-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}

.sales-quantity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
}

.sales-field {
  min-width: 0;
  margin-bottom: 0;
}

.sales-field-error {
  grid-column: 1 / -1;
}

.sales-products {
  min-width: 0;
}

.sales-form :deep(.q-field__native),
.sales-form :deep(.q-field__input) {
  color: #111827 !important;
  font-size: 0.9375rem;
  font-weight: 500;
}

.sales-form :deep(.q-field__control) {
  transition:
    box-shadow 150ms ease,
    background-color 150ms ease;
}

.sales-form :deep(.q-field--outlined.q-field--focused .q-field__control) {
  background: #fff;
  box-shadow: 0 0 0 4px rgb(37 99 235 / 14%);
}

.sales-form :deep(.q-field--outlined.q-field--focused .q-field__control::before) {
  border: 2px solid #2563eb !important;
}

.sales-form :deep(.q-field--filled.q-field--focused .q-field__control) {
  background: #fff;
  box-shadow: 0 0 0 4px rgb(37 99 235 / 14%);
}

.sales-form :deep(.q-field--filled.q-field--focused .q-field__control::before) {
  border-bottom: 2px solid #2563eb !important;
}

.sales-form :deep(.q-field__control) {
  min-height: 46px;
  border-radius: 0.75rem;
}

.sales-form :deep(.q-field--dense .q-field__control),
.sales-form :deep(.q-field--dense .q-field__marginal) {
  height: 46px;
}

.sales-form :deep(.q-field--outlined .q-field__control::before) {
  border-color: #cbd5e1;
}

.sales-form :deep(.q-field--outlined:hover .q-field__control::before) {
  border-color: #64748b;
}

.sales-form :deep(.q-field--outlined.q-field--focused .q-field__control::before) {
  border: 2px solid #475569;
}

.sales-form :deep(.q-field--filled .q-field__control) {
  background: #fff;
}

.sales-form :deep(.q-field--filled .q-field__control::before) {
  border-bottom: 1px solid #cbd5e1;
}

.native-select {
  height: 46px;
  border-color: #cbd5e1;
  border-radius: 0.875rem;
  color: #111827;
  font-size: 1rem;
  background-image: url("data:image/svg+xml;utf8,<svg fill='%23475569' height='16' viewBox='0 0 24 24' width='16' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
}

.sales-suggestion-list {
  position: relative;
  grid-column: 1 / -1;
  width: 100%;
  margin: -0.5rem 0 0;
}

.custom-list {
  border-color: #cbd5e1 !important;
}

.custom-item-separator:not(:last-child) {
  border-bottom-color: #e2e8f0 !important;
}

@media (min-width: 768px) {
  .sales-quantity-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 480px) and (max-width: 767px) {
  .sales-quantity-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.sales-page,
.sales-card,
.sales-form,
.sales-field,
.sales-details-section,
.sales-details-grid,
.sales-product-section,
.sales-cart-section,
.sales-quantity-grid {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

.sales-page {
  width: 100%;
  padding-right: max(clamp(0.75rem, 4vw, 1.5rem), env(safe-area-inset-right, 0px));
  padding-left: max(clamp(0.75rem, 4vw, 1.5rem), env(safe-area-inset-left, 0px));
  overflow-x: hidden;
}

.sales-card,
.sales-form,
.sales-field,
.sales-product-picker {
  width: 100%;
}

.sales-native-input,
.sales-readonly-value,
.sales-select,
.sales-action-btn {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

.sales-stock-indicator {
  display: flex;
  width: 100%;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0.625rem 0 0.875rem;
  border: 1px solid #86efac;
  border-radius: 0.875rem;
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  padding: 0.625rem 0.875rem;
  color: #166534;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.25rem;
  box-shadow: 0 2px 5px rgb(22 101 52 / 8%);
}

.sales-stock-indicator strong {
  color: #14532d;
  font-size: 1.125rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.sales-cart-item > :deep(.q-item__section--main) {
  min-width: 0;
}

.sales-cart-item :deep(.q-item__label) {
  overflow-wrap: anywhere;
}

.sales-action-btn {
  width: 100%;
  max-width: 100%;
}

@media (min-width: 360px) {
  .sales-quantity-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 349px) {
  .sales-details-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .sales-quantity-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sales-cart-item {
    padding-right: 0.5rem;
    padding-left: 0.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sales-native-input,
  .sales-cart-item {
    transition: none;
  }
}

.sales-native-input,
.sales-readonly-value {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 2.625rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.75rem;
  background-color: #fff;
  padding: 0.5rem 0.625rem;
  color: #111827;
  font: inherit;
  font-size: 0.875rem;
  line-height: 1.125rem;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.receipt-input-wrap {
  position: relative;
}

.receipt-number-input {
  padding-right: 2.75rem;
}

.receipt-check-status {
  position: absolute;
  top: 50%;
  right: 0.875rem;
  transform: translateY(-50%);
  pointer-events: none;
}

.sales-readonly-value {
  display: flex;
  align-items: center;
  background-color: #f1f5f9;
  color: #334155;
  font-weight: 600;
}

.sales-native-input:focus-visible {
  border-color: #2563eb;
  outline: none;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 18%);
}

.sales-native-input:disabled {
  cursor: not-allowed;
  background-color: #f1f5f9;
  color: #64748b;
}

.sales-select {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.625rem;
  appearance: none;
  border: 1px solid #455a64;
  border-radius: 0.75rem;
  background-color: #37474f;
  background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='18' viewBox='0 0 24 24' width='18' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
  background-position: right 0.75rem center;
  background-repeat: no-repeat;
  padding: 0.5rem 2.25rem 0.5rem 0.625rem;
  color: #fff;
  font-size: 0.875rem;
}

.sales-select option {
  background-color: #37474f;
  color: #fff;
}

.sales-select:focus-visible {
  border-color: #93c5fd;
  outline: none;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 24%);
}

.sales-action-btn {
  box-sizing: border-box;
  min-height: 2.625rem;
  background: #37474f !important;
  color: #fff !important;
}

.sales-action-btn :deep(.q-btn__content) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
}

.sales-action-btn:hover {
  background: #263238 !important;
}

.sales-cart-item {
  align-items: center;
  border-color: #e2e8f0;
  background: linear-gradient(135deg, #fff, #f8fafc);
}

.sales-product-picker {
  position: relative;
  width: 100%;
  min-width: 0;
}

.sales-product-search {
  min-height: 2.75rem;
  padding-right: 2.75rem;
  padding-left: 2.5rem;
  border-color: #455a64;
  background: #37474f;
  color: #fff;
}

.sales-product-search::placeholder {
  color: #cbd5e1;
  opacity: 1;
}

.sales-product-search:focus-visible {
  border-color: #90a4ae;
  box-shadow: 0 0 0 3px rgb(55 71 79 / 24%);
}

.sales-product-search-icon {
  position: absolute;
  top: 50%;
  left: 0.75rem;
  z-index: 1;
  color: #cbd5e1;
  pointer-events: none;
  transform: translateY(-50%);
}

.sales-product-clear {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  display: flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: #cbd5e1;
  transform: translateY(-50%);
}

.sales-product-clear:hover,
.sales-product-clear:focus-visible {
  background: #455a64;
  color: #fff;
  outline: none;
}

.sales-product-options {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  left: 0;
  z-index: 20;
  max-height: min(42vh, 18rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid #455a64;
  border-radius: 0.75rem;
  background: #37474f;
  padding: 0.25rem;
  color: #fff;
  box-shadow: 0 12px 24px rgb(15 23 42 / 24%);
  list-style: none;
}

.sales-product-option {
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  padding: 0.5rem 0.625rem;
  color: #fff;
  font-size: 0.875rem;
  text-align: left;
}

.sales-product-option:hover,
.sales-product-option:focus-visible,
.sales-product-option[aria-selected='true'] {
  background: #455a64;
  outline: none;
}

.sales-product-empty {
  padding: 0.75rem;
  color: #e2e8f0;
  font-size: 0.875rem;
}
</style>
