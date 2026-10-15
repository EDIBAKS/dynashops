<template>
  <q-page class="q-pa-md">
    <!-- 🔵 TOTAL STOCK VALUE -->
    <div class="q-mb-lg">
      <q-card flat bordered class="q-pa-md bg-primary text-white">
        <div class="text-subtitle1">Total Stock Value</div>
        <div class="text-h5">${{ formatNumber(totalStockValue) }}</div>
      </q-card>
    </div>

    <!-- 🟢 DPC SUMMARY -->
    <div class="row q-col-gutter-md q-mb-lg" v-if="dpcSummary.length">
      <div v-for="dpc in dpcSummary" :key="dpc.name" class="col-12 col-md-3">
        <q-card flat bordered class="q-pa-md">
          <div class="text-subtitle1 text-bold">
            {{ dpc.name }}
          </div>

          <div class="text-h6 text-green">${{ formatNumber(dpc.total) }}</div>

          <div class="text-caption">{{ dpc.percent.toFixed(1) }}% of total</div>

          <q-linear-progress :value="dpc.percent / 100" size="10px" color="green" class="q-mt-sm" />
        </q-card>
      </div>
    </div>

    <!-- 🟠 SHOP SUMMARY -->
    <div class="row q-col-gutter-md" v-if="shopSummary.length">
      <div v-for="shop in shopSummary" :key="shop.shop" class="col-12 col-md-4">
        <q-card flat bordered class="q-pa-md">
          <div class="text-subtitle1 text-bold">
            {{ shop.shop }}
          </div>

          <div class="text-h6 text-primary">${{ formatNumber(shop.total) }}</div>

          <div class="text-caption">{{ shop.percent.toFixed(1) }}% of total stock</div>

          <q-linear-progress
            :value="shop.percent / 100"
            size="10px"
            :color="shop.percent >= 20 ? 'positive' : 'warning'"
            class="q-mt-sm"
          />
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
/* ----------------------------------------------
   IMPORTS
---------------------------------------------- */
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'boot/supabase'
import { useAuth } from 'stores/auth'

/* ----------------------------------------------
   STATE
---------------------------------------------- */
const $q = useQuasar()
const auth = useAuth()

const rows = ref([])
const loading = ref(false)

/* ----------------------------------------------
   TOTAL STOCK VALUE
---------------------------------------------- */
const totalStockValue = computed(() => {
  return rows.value.reduce((sum, r) => sum + (r.TotalValue || 0), 0)
})

/* ----------------------------------------------
   DPC SUMMARY
---------------------------------------------- */
const dpcSummary = computed(() => {
  const map = {}

  rows.value.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key.endsWith('_value') && !key.includes('(')) {
        const dpc = key.replace('_value', '')

        if (!map[dpc]) map[dpc] = 0
        map[dpc] += Number(row[key]) || 0
      }
    })
  })

  return Object.keys(map)
    .map((dpc) => ({
      name: dpc,
      total: map[dpc],
      percent: totalStockValue.value ? (map[dpc] / totalStockValue.value) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
})

/* ----------------------------------------------
   SHOP SUMMARY
---------------------------------------------- */
const shopSummary = computed(() => {
  const map = {}

  rows.value.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key.endsWith('_value') && key.includes('(')) {
        const shop = key.replace('_value', '')

        if (!map[shop]) map[shop] = 0
        map[shop] += Number(row[key]) || 0
      }
    })
  })

  return Object.keys(map)
    .map((shop) => ({
      shop,
      total: map[shop],
      percent: totalStockValue.value ? (map[shop] / totalStockValue.value) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
})

/* ----------------------------------------------
   FETCH + BUILD DATA
---------------------------------------------- */
onMounted(() => {
  buildStockData()
})

async function fetchStockForTable(tableName, productCodes = []) {
  try {
    const { data } = await supabase
      .from(tableName)
      .select('productcode, quantity')
      .in('productcode', productCodes)

    const map = new Map()
    for (const r of data || []) {
      map.set(r.productcode, Number(r.quantity || 0))
    }
    return map
  } catch {
    return new Map()
  }
}

async function buildStockData() {
  try {
    loading.value = true

    const countryCode = auth.userDetails?.country_code

    /* -------- PRODUCTS -------- */
    const { data: productsData } = await supabase
      .from('products')
      .select('productcode, productname, distributorprice')
      .eq('status', 'active')

    const products = productsData || []
    const productCodes = products.map((p) => p.productcode)

    /* -------- PROVINCES -------- */
    const { data: provincesData } = await supabase
      .from('province')
      .select('province_code, name')
      .eq('country_code', countryCode)

    const provinces = provincesData || []

    /* -------- SHOPS -------- */
    const { data: shopsData } = await supabase
      .from('shops')
      .select('shopcode, shop_name, province_code')

    const shops = shopsData || []

    /* -------- LOCATIONS -------- */
    const provinceLocations = provinces.map((p) => ({
      label: p.name,
      tableName: p.province_code,
      type: 'province',
    }))

    const shopLocations = shops.map((s) => ({
      label: `${s.shop_name} (${s.province_code})`,
      tableName: `${s.shopcode}_STOCK`,
      type: 'shop',
    }))

    const locations = [...provinceLocations, ...shopLocations]

    /* -------- FETCH STOCK -------- */
    const stockMaps = await Promise.all(
      locations.map((loc) => fetchStockForTable(loc.tableName, productCodes)),
    )

    locations.forEach((loc, i) => {
      loc.stockMap = stockMaps[i]
    })

    /* -------- BUILD ROWS -------- */
    rows.value = products.map((prod) => {
            // Aggregate each product?s stock and value across all locations.
      const row = {
        productcode: prod.productcode,
        productname: prod.productname,
        distributorprice: prod.distributorprice || 0,
      }

      locations.forEach((loc) => {
        const qty = loc.stockMap.get(prod.productcode) ?? 0
        const value = qty * (prod.distributorprice || 0)

        row[loc.label] = qty
        row[`${loc.label}_value`] = value
      })

      row.TotalValue = locations.reduce((sum, loc) => {
        return sum + (row[`${loc.label}_value`] || 0)
      }, 0)

      return row
    })
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    loading.value = false
  }
}

/* ----------------------------------------------
   FORMATTER
---------------------------------------------- */
function formatNumber(val) {
  return new Intl.NumberFormat().format(val || 0)
}
</script>

<style scoped>
.text-bold {
  font-weight: bold;
}
</style>
