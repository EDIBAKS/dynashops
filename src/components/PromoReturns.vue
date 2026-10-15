<template>
  <q-page class="q-pa-sm">
    <!-- FILTER CARD -->
    <q-card flat bordered class="q-pa-sm q-mb-md">
      <div class="row q-col-gutter-sm">
        <div class="col-6">
          <q-input v-model="startDate" type="date" dense outlined label="Start Date" />
        </div>

        <div class="col-6">
          <q-input v-model="endDate" type="date" dense outlined label="End Date" />
        </div>

        <div class="col-12">
          <q-btn
            color="primary"
            label="Fetch Promos"
            icon="search"
            class="full-width"
            :loading="loading"
            @click="fetchPromos"
          />
        </div>
      </div>
    </q-card>

    <!-- PROMO LIST -->
    <q-card flat bordered>
      <q-list separator v-if="promos.length">
        <q-item v-for="row in promos" :key="row.id" clickable class="q-py-sm">
          <!-- LEFT -->
          <q-item-section avatar>
            <q-avatar rounded size="42px" color="primary" text-color="white">
              {{ row.quantity }}
            </q-avatar>
          </q-item-section>

          <!-- CENTER -->
          <q-item-section>
            <div class="text-subtitle2 text-bold">
              {{ row.productcode }}
            </div>

            <div class="text-caption">
              Shop: <span class="text-bold">{{ row.shopcode }}</span>
            </div>

            <div class="text-caption text-grey">
              {{ row.distributorname || row.distributoridno }}
            </div>
          </q-item-section>

          <!-- RIGHT -->
          <q-item-section side top>
            <div class="text-caption text-grey">
              {{ formatDate(row.date) }}
            </div>

            <q-btn dense flat round icon="undo" color="positive" @click.stop="confirmReturn(row)" />
          </q-item-section>
        </q-item>
      </q-list>

      <div v-else class="q-pa-md text-center text-grey">No promo records found</div>
    </q-card>
  </q-page>
</template>

<script setup>
// Reactive form state, notifications, and promo-return persistence.
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'src/boot/supabase'
import { logActivity, ACTIVITY_TYPES } from 'src/utils/activityLog'

const $q = useQuasar()

// The selected period and fetched promo records drive this view.
const startDate = ref('')
const endDate = ref('')
const promos = ref([])
const loading = ref(false)

/* ---------------- FETCH PROMOS ---------------- */
async function fetchPromos() {
  if (!startDate.value || !endDate.value) {
    $q.notify({
      type: 'negative',
      message: 'Please select both start and end dates',
    })
    return
  }

  loading.value = true

  const { data, error } = await supabase.rpc('fetch_promos_by_date', {
    p_start_date: startDate.value,
    p_end_date: endDate.value,
  })

  loading.value = false

  if (error) {
    $q.notify({ type: 'negative', message: error.message })
    return
  }

  promos.value = data.sort((a, b) => {
    if (a.shopcode !== b.shopcode) {
      return a.shopcode.localeCompare(b.shopcode)
    }
    return new Date(a.date) - new Date(b.date)
  })
}

/* ---------------- RETURN PROMO ---------------- */
function confirmReturn(row) {
  $q.dialog({
    title: 'Confirm Return',
    message: `Return ${row.quantity} of ${row.productcode} to ${row.shopcode}?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    const { error } = await supabase.rpc('return_promo_product', {
      p_promo_id: row.id,
    })

    if (error) {
      $q.notify({ type: 'negative', message: error.message })
      return
    }

    logActivity(ACTIVITY_TYPES.PROMO_RETURN, {
      reference: String(row.id),
      dpccode: row.shopcode,
      description: `Promo returned: ${row.quantity} × ${row.productcode} to ${row.shopcode}`,
    })

    $q.notify({
      type: 'positive',
      message: 'Product returned successfully',
    })

    fetchPromos()
  })
}

/* ---------------- UTILS ---------------- */
function formatDate(date) {
  return new Date(date).toLocaleDateString()
}
</script>

<style scoped>
.q-item {
  align-items: flex-start;
}
</style>
