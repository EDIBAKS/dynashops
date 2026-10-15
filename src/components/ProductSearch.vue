<template>
    <!-- Search and select a product by its name or code. -->
  <q-select
    v-model="selectedProduct"
    :options="filteredProducts"
    option-label="label"
    option-value="value"
    use-input
    fill-input
    hide-selected
    input-debounce="300"
    dense
    outlined
    clearable
    emit-value
    map-options
    label="Search Product"
    @filter="filterProducts"
    @update:model-value="selectProduct"
  >
    <!-- OPTION -->
    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section>
          <q-item-label class="text-bold">
            {{ scope.opt.productname }}
          </q-item-label>

          <q-item-label caption>
            {{ scope.opt.productcode }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
// Product search uses local selection state and a Supabase lookup.
import { ref } from 'vue'
import { supabase } from 'boot/supabase'

// MAIN MODEL
const modelValue = defineModel()

// OPTIONAL NAME MODEL
const modelName = defineModel('name', {
  default: '',
})

const selectedProduct = ref(null)

const filteredProducts = ref([])

// FILTER PRODUCTS
async function filterProducts(val, update) {
  if (!val) {
    update(() => {
      filteredProducts.value = []
    })

    return
  }

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      productcode,
      productname
    `,
    )
    .or(
      `
      productname.ilike.%${val}%,
      productcode.ilike.%${val}%
    `,
    )
    .order('productname')
    .limit(20)

  if (error) {
    console.error(error)

    update(() => {
      filteredProducts.value = []
    })

    return
  }

  update(() => {
    filteredProducts.value = (data || []).map((p) => ({
      label: `${p.productname} (${p.productcode})`,
      value: p.productcode,
      productname: p.productname,
      productcode: p.productcode,
    }))
  })
}

// SELECT
function selectProduct(productcode) {
  const product = filteredProducts.value.find((p) => p.value === productcode)

  if (!product) {
    modelValue.value = ''
    modelName.value = ''

    return
  }

  modelValue.value = product.productcode

  modelName.value = product.productname
}
</script>
