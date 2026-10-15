<template>
  <div>
    <!-- Label -->
    <div class="text-caption text-white text-bold q-mb-xs flex justify-between items-center">
      <span>{{ $t('searchByName') }}</span>
      <span
        v-if="searchQuery.trim() !== '' && !filteredDistributors.length && !confirmedDistributor"
        class="text-red"
      >
        No results found
      </span>
    </div>

    <!-- Input -->
    <q-input
      v-model="searchQuery"
      dense
      outlined
      class="white-input text-semi-bold text-center text-uppercase"
      input-class="text-black text-bold text-center text-uppercase"
      label="Type Distributor Name..."
      label-color="white"
    />

    <!-- Suggestions -->
    <ul
      v-if="filteredDistributors.length && searchQuery.trim() !== '' && !confirmedDistributor"
      class="suggestion-list"
    >
      <li
        v-for="distributor in filteredDistributors"
        :key="distributor.DistributorIDNO"
        @click="selectDistributor(distributor)"
        class="distributor-option"
      >
        {{ distributor.DistributorNames }}
      </li>
    </ul>
  </div>
</template>

<script setup>
// Dependencies for distributor search, selection, and model synchronization.
import { ref, watch, onMounted } from 'vue'
import { supabase } from 'boot/supabase'

// v-model for DistributorIDNO
const modelValue = defineModel() // this is distributoridno

// new v-model for the name
const modelName = defineModel('name', { default: '' }) // distributorname

const searchQuery = ref('')
const filteredDistributors = ref([])
const confirmedDistributor = ref(false)

// 🔍 Fetch distributors by name
const fetchDistributors = async (query) => {
  if (!query.trim()) {
    filteredDistributors.value = []
    return
  }

  const { data } = await supabase
    .from('Distributors')
    .select('DistributorIDNO, DistributorNames')
    .ilike('DistributorNames', `%${query}%`)

  filteredDistributors.value = data || []
}

// 🔍 Fetch distributor by ID (for pre-filling name)
const fetchDistributorName = async (id) => {
  if (!id) {
    searchQuery.value = ''
    confirmedDistributor.value = false
    modelName.value = ''
    return
  }

  const { data, error } = await supabase
    .from('Distributors')
    .select('DistributorNames')
    .eq('DistributorIDNO', id)
    .single()

  if (!error && data) {
    searchQuery.value = data.DistributorNames
    confirmedDistributor.value = true
    modelName.value = data.DistributorNames // emit name to parent
  } else {
    searchQuery.value = ''
    confirmedDistributor.value = false
    modelName.value = ''
  }
}

// ✅ On click select
const selectDistributor = (distributor) => {
  modelValue.value = distributor.DistributorIDNO
  searchQuery.value = distributor.DistributorNames
  confirmedDistributor.value = true
  filteredDistributors.value = []
  modelName.value = distributor.DistributorNames // emit name to parent
}

// 🔄 Watch for input changes
watch(searchQuery, (val) => {
  if (!val.trim()) {
    modelValue.value = ''
    modelName.value = ''
    confirmedDistributor.value = false
    filteredDistributors.value = []
  } else {
    fetchDistributors(val)
  }
})

// 🔄 Watch for v-model changes (parent updating distributoridno)
watch(modelValue, (val) => {
  fetchDistributorName(val)
})

// Optional: fetch on mount if modelValue is already set
onMounted(() => {
  if (modelValue.value) {
    fetchDistributorName(modelValue.value)
  }
})
</script>

<style scoped>
.suggestion-list {
  border: 1px solid #ccc;
  max-height: 150px;
  overflow-y: auto;
  padding: 0;
  margin: 0;
  list-style: none;
  background-color: #000; /* black background */
  color: #fff; /* white text */
}
.distributor-option {
  padding: 8px;
  cursor: pointer;
}
.distributor-option:hover {
  background: #b7e033;
}
</style>
