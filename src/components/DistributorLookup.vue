<template>
  <div class="row q-col-gutter-x-md" style="row-gap: 20px">
    <!-- Distributor ID -->
    <div class="col-12 col-sm-5">
      <q-input
        :model-value="idText"
        label="Distributor ID"
        dense
        outlined
        clearable
        :loading="idLoading"
        :error="idNotFound"
        error-message="ID not found"
        @update:model-value="onIdInput"
        @clear="resetAll"
      >
        <template #prepend><q-icon name="badge" size="18px" /></template>
        <template #append>
          <q-icon v-if="confirmed" name="check_circle" color="positive" size="22px">
            <q-tooltip>Distributor found</q-tooltip>
          </q-icon>
        </template>
      </q-input>
    </div>

    <!-- Distributor name -->
    <div class="col-12 col-sm-7">
      <q-input
        :model-value="nameText"
        label="Distributor name (type a clue)"
        dense
        outlined
        clearable
        autocomplete="off"
        :loading="nameLoading"
        @update:model-value="onNameInput"
        @clear="resetAll"
      >
        <template #prepend><q-icon name="person_search" size="18px" /></template>
        <q-menu
          :model-value="showList"
          no-parent-event
          no-focus
          no-refocus
          fit
          class="rounded-lg"
          @update:model-value="showList = $event"
        >
          <q-list dense style="max-height: 240px; overflow-y: auto">
            <q-item
              v-for="d in suggestions"
              :key="d.DistributorIDNO"
              clickable
              @click="pick(d)"
            >
              <q-item-section>
                <q-item-label>{{ d.DistributorNames }}</q-item-label>
                <q-item-label caption>{{ d.DistributorIDNO }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="!suggestions.length">
              <q-item-section class="text-grey">No matching names</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-input>
    </div>
  </div>
</template>

<script setup>
// Dependencies for reactive lookup and distributor queries.
import { ref, watch, onMounted } from 'vue'
import { supabase } from 'boot/supabase'

// Keep confirmed model values separate from the in-progress lookup text.
const modelValue = defineModel() // confirmed DistributorIDNO
const modelName = defineModel('name', { default: '' })

const idText = ref('')
const nameText = ref('')
const confirmed = ref(false)
const idNotFound = ref(false)
const idLoading = ref(false)
const nameLoading = ref(false)
const suggestions = ref([])
const showList = ref(false)

let idTimer = null
let nameTimer = null
let idSeq = 0
let nameSeq = 0

// Strip characters that would break the PostgREST filter
const clean = (s) => s.replace(/[,()%*\\]/g, ' ').trim()

function resetAll() {
  clearTimeout(idTimer)
  clearTimeout(nameTimer)
  idSeq++
  nameSeq++
  idText.value = ''
  nameText.value = ''
  confirmed.value = false
  idNotFound.value = false
  suggestions.value = []
  showList.value = false
  modelValue.value = ''
  modelName.value = ''
}

function confirm(d) {
  idSeq++
  nameSeq++
  idText.value = d.DistributorIDNO
  nameText.value = d.DistributorNames
  confirmed.value = true
  idNotFound.value = false
  suggestions.value = []
  showList.value = false
  modelValue.value = d.DistributorIDNO
  modelName.value = d.DistributorNames
}

function unconfirm() {
  if (!confirmed.value) return
  confirmed.value = false
  modelValue.value = ''
  modelName.value = ''
}

function onIdInput(val) {
  idText.value = val || ''
  clearTimeout(idTimer)
  idNotFound.value = false
  const wasConfirmed = confirmed.value
  unconfirm()
  if (wasConfirmed) nameText.value = ''
  showList.value = false

  const id = idText.value.trim()
  if (!id) {
    nameText.value = ''
    return
  }
  const seq = ++idSeq
  idTimer = setTimeout(async () => {
    idLoading.value = true
    const { data } = await supabase
      .from('Distributors')
      .select('DistributorIDNO, DistributorNames')
      .eq('DistributorIDNO', id)
      .maybeSingle()
    idLoading.value = false
    if (seq !== idSeq) return
    if (data) confirm(data)
    else {
      idNotFound.value = true
      nameText.value = ''
    }
  }, 350)
}

function onNameInput(val) {
  nameText.value = val || ''
  clearTimeout(nameTimer)
  if (confirmed.value) {
    unconfirm()
    idText.value = ''
  }
  idNotFound.value = false

  const q = clean(nameText.value)
  if (!q) {
    suggestions.value = []
    showList.value = false
    return
  }
  const seq = ++nameSeq
  nameTimer = setTimeout(async () => {
    nameLoading.value = true
    const { data } = await supabase
      .from('Distributors')
      .select('DistributorIDNO, DistributorNames')
      .ilike('DistributorNames', `%${q}%`)
      .order('DistributorNames')
      .limit(30)
    nameLoading.value = false
    if (seq !== nameSeq) return
    suggestions.value = data || []
    showList.value = true
  }, 300)
}

function pick(d) {
  confirm(d)
}

async function loadById(id) {
  const { data } = await supabase
    .from('Distributors')
    .select('DistributorIDNO, DistributorNames')
    .eq('DistributorIDNO', id)
    .maybeSingle()
  if (data) confirm(data)
}

// Parent changed the ID (e.g. prefilled or cleared)
watch(modelValue, (val) => {
  if (val) {
    if (val !== idText.value || !confirmed.value) loadById(val)
  } else if (confirmed.value) {
    resetAll()
  }
})

// Resolve a distributor ID provided by the parent on initialization.
onMounted(() => {
  if (modelValue.value) loadById(modelValue.value)
})
</script>
