<template>
  <div style="max-width: 720px">
    <q-form class="q-gutter-sm" @submit.prevent="createProvince">
      <q-select
        v-model="form.country_code"
        :options="countries"
        label="Country"
        outlined
        dense
        emit-value
        map-options
      />
      <q-input v-model="form.province_code" label="Province code" outlined dense />
      <q-input v-model="form.name" label="Province name" outlined dense />
      <q-btn type="submit" color="primary" label="Create Province" :loading="saving" />
    </q-form>

    <q-table
      flat
      bordered
      dense
      class="q-mt-lg"
      title="Provinces"
      row-key="province_code"
      :rows="provinces"
      :columns="columns"
      :loading="loading"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'boot/supabase'

const $q = useQuasar()
const countries = ref([])
const provinces = ref([])
const loading = ref(false)
const saving = ref(false)
const form = reactive({ country_code: '', province_code: '', name: '' })

const columns = [
  { name: 'province_code', label: 'Code', field: 'province_code', align: 'left', sortable: true },
  { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
  { name: 'country_code', label: 'Country', field: 'country_code', align: 'left', sortable: true },
]

const fetchCountries = async () => {
  const { data, error } = await supabase
    .from('country')
    .select('name, code')
    .order('name', { ascending: true })
  if (error) return $q.notify({ type: 'negative', message: error.message })
  countries.value = data.map((c) => ({ label: c.name, value: c.code }))
}

const fetchProvinces = async () => {
  loading.value = true
  const { data, error } = await supabase
    .from('province')
    .select('province_code, name, country_code')
    .order('name', { ascending: true })
  loading.value = false
  if (error) return $q.notify({ type: 'negative', message: error.message })
  provinces.value = data
}

// The database trigger creates the province's stock table on insert.
const createProvince = async () => {
  const province_code = form.province_code.trim().toUpperCase()
  const name = form.name.trim()
  if (!form.country_code || !province_code || !name) {
    return $q.notify({ type: 'warning', message: 'Fill in all fields.' })
  }
  if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(province_code)) {
    return $q.notify({
      type: 'warning',
      message: 'Code must start with a letter and use only letters, digits or underscore.',
    })
  }

  saving.value = true
  const { error } = await supabase
    .from('province')
    .insert({ province_code, name, country_code: form.country_code })
  saving.value = false

  if (error) return $q.notify({ type: 'negative', message: error.message })

  $q.notify({ type: 'positive', message: `Province ${province_code} created.` })
  form.province_code = ''
  form.name = ''
  fetchProvinces()
}

onMounted(() => {
  fetchCountries()
  fetchProvinces()
})
</script>
