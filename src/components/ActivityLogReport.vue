<template>
  <div class="q-mt-md">
    <!-- Sort controls and the selected date-range summary -->
    <q-card flat bordered class="q-pa-md q-mb-md" style="border-radius: 20px">
      <div class="row q-col-gutter-sm items-end">
        <div class="col-12 col-sm-4">
          <div class="text-caption text-bold q-mb-xs">Sort by</div>
          <q-select
            v-model="sortField"
            :options="sortOptions"
            emit-value
            map-options
            dense
            outlined
          />
        </div>
        <div class="col-6 col-sm-3">
          <div class="text-caption text-bold q-mb-xs">Order</div>
          <q-btn-toggle
            v-model="sortDirection"
            :options="[
              { label: 'Asc', value: 'asc' },
              { label: 'Desc', value: 'desc' },
            ]"
            dense
            unelevated
            toggle-color="blue-grey-8"
          />
        </div>
        <div class="col-6 col-sm-5 text-right text-caption">
          {{ sortedRows.length }} record(s) · {{ startDate }} — {{ endDate }}
        </div>
      </div>
    </q-card>

    <q-banner
      v-if="!sortedRows.length"
      dense
      rounded
      class="bg-grey-3 text-grey-8 text-center q-pa-sm"
    >
      <q-icon name="info" color="primary" size="20px" class="q-mr-sm" />
      No activity recorded for the selected date range.
    </q-banner>

    <!-- Responsive table and card layouts for activity records -->
    <q-table
      v-else
      :rows="sortedRows"
      :columns="columns"
      row-key="id"
      flat
      bordered
      dense
      :grid="$q.screen.lt.sm"
      :rows-per-page-options="[10, 25, 50, 0]"
      :pagination="{ rowsPerPage: 25 }"
      class="shadow-2 rounded-borders"
    >
      <template #body-cell-activity="props">
        <q-td :props="props">
          <q-badge :color="activityColor(props.row.activity)" class="q-pa-xs">
            {{ props.row.activity }}
          </q-badge>
        </q-td>
      </template>

      <template #item="props">
        <div class="col-12 q-pa-xs">
          <q-card flat bordered>
            <q-card-section class="q-pa-sm">
              <div class="row justify-between items-center">
                <q-badge :color="activityColor(props.row.activity)">
                  {{ props.row.activity }}
                </q-badge>
                <span class="text-caption">{{ formatDateTime(props.row.created_at) }}</span>
              </div>
              <div class="text-weight-bold q-mt-xs">{{ props.row.username }}</div>
              <div class="text-caption">{{ props.row.description }}</div>
              <div v-if="props.row.reference" class="text-caption text-grey-7">
                Ref: {{ props.row.reference }}
              </div>
            </q-card-section>
          </q-card>
        </div>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Activity records and their selected date range come from the parent.
const props = defineProps({
  rows: { type: Array, default: () => [] },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
})

// Sorting preferences for the activity list.
const sortField = ref('created_at')
const sortDirection = ref('desc')

const sortOptions = [
  { label: 'Date & time', value: 'created_at' },
  { label: 'Activity', value: 'activity' },
  { label: 'User', value: 'username' },
]

// Table fields for timestamps, actors, activity, and details.
const columns = [
  {
    name: 'created_at',
    label: 'Date & Time',
    field: (r) => formatDateTime(r.created_at),
    align: 'left',
  },
  { name: 'username', label: 'User', field: 'username', align: 'left' },
  { name: 'activity', label: 'Activity', field: 'activity', align: 'left' },
  { name: 'reference', label: 'Reference', field: 'reference', align: 'left' },
  {
    name: 'description',
    label: 'Details',
    field: 'description',
    align: 'left',
    style: 'white-space: normal; min-width: 240px',
  },
]

// Sort a copy so the parent-provided rows remain unchanged.
const sortedRows = computed(() => {
  const dir = sortDirection.value === 'asc' ? 1 : -1
  const field = sortField.value
  return [...props.rows].sort((a, b) => {
    if (field === 'created_at') {
      return (new Date(a.created_at) - new Date(b.created_at)) * dir
    }
    const cmp = String(a[field] || '').localeCompare(String(b[field] || ''))
    // Newest first within equal activity/user groups
    return cmp !== 0 ? cmp * dir : new Date(b.created_at) - new Date(a.created_at)
  })
})

// Display timestamps consistently and color-code activity categories.
function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : ''
}

function activityColor(activity = '') {
  if (/delete|reversal|removed/i.test(activity)) return 'negative'
  if (/debt/i.test(activity)) return 'orange-8'
  if (/dispatch|withdraw|return/i.test(activity)) return 'blue-8'
  return 'positive'
}
</script>
