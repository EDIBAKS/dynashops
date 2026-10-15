<script setup>
// Search state, synchronization watchers, and initial value loading.
import { ref, watch, onMounted } from 'vue'
import { supabase } from 'boot/supabase'

const modelValue = defineModel()
const modelName = defineModel('name', { default: '' })

// Keep the typed query, matches, and selected-shop status together.
const searchQuery = ref('')
const filteredShops = ref([])
const confirmedShop = ref(false)

// Return matching shops for the current search text.
const fetchShops = async (query) => {
  if (!query.trim()) {
    filteredShops.value = []
    return
  }

  const { data } = await supabase
    .from('shops')
    .select('shopcode, shop_name')
    .ilike('shop_name', `%${query}%`)

  filteredShops.value = data || []
}

const fetchShopName = async (shopcode) => {
  if (!shopcode) {
    searchQuery.value = ''
    confirmedShop.value = false
    modelName.value = ''
    return
  }

  const { data } = await supabase
    .from('shops')
    .select('shop_name')
    .eq('shopcode', shopcode)
    .single()

  if (data) {
    searchQuery.value = data.shop_name
    modelName.value = data.shop_name
    confirmedShop.value = true
  }
}

//const selectShop = (shop) => {
//  modelValue.value = shop.shopcode
//  modelName.value = shop.shop_name
//  searchQuery.value = shop.shop_name
////  confirmedShop.value = true
//  filteredShops.value = []
//}

// Keep the parent model synchronized with the query and selection.
watch(searchQuery, async (val) => {
  if (!val.trim()) {
    modelValue.value = ''
    modelName.value = ''
    confirmedShop.value = false
    filteredShops.value = []
  } else {
    fetchShops(val)
  }
})

watch(modelValue, (val) => {
  fetchShopName(val)
})

// Restore the displayed shop name when a value is already selected.
onMounted(() => {
  if (modelValue.value) {
    fetchShopName(modelValue.value)
  }
})
</script>
