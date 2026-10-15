<template>
    <!-- Select a distributor and period before reviewing active legs. -->
  <div class="column q-pb-xl" style="max-width: 900px; margin: auto; gap: 40px">
    <q-card flat bordered class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md">
      <div class="row items-center q-gutter-sm q-mb-md text-blue-grey-9">
        <q-icon name="timeline" size="22px" class="text-emerald-600" />
        <div class="text-subtitle1 text-bold">Active Legs</div>
      </div>

      <div class="column" style="gap: 20px">
        <DistributorLookup v-model="form.distributoridno" v-model:name="form.distributorname" />

        <div class="row q-col-gutter-x-md" style="row-gap: 20px">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.date_from" type="date" label="From" dense outlined />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.date_to" type="date" label="To" dense outlined />
          </div>
        </div>

        <div class="row q-col-gutter-x-md" style="row-gap: 12px">
          <div class="col-12 col-sm-6">
            <q-btn
              label="View Group BV"
              icon="search"
              unelevated
              no-caps
              class="bg-blue-grey-9 text-white rounded-lg full-width"
              :loading="loading"
              @click="fetchLegs"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-btn-dropdown
              label="Export"
              icon="download"
              unelevated
              no-caps
              :disable="!visibleLegs.length"
              class="bg-emerald-600 text-white rounded-lg full-width"
            >
              <q-list>
                <q-item v-close-popup clickable @click="exportLegs('pdf')">
                  <q-item-section avatar><q-icon name="picture_as_pdf" /></q-item-section>
                  <q-item-section>PDF</q-item-section>
                </q-item>
                <q-item v-close-popup clickable @click="exportLegs('excel')">
                  <q-item-section avatar><q-icon name="grid_on" /></q-item-section>
                  <q-item-section>Excel</q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </div>
        </div>
      </div>
    </q-card>

    <!-- Results -->
    <q-card
      v-if="legs.length"
      flat
      bordered
      class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md"
    >
      <q-tabs
        v-model="reportView"
        dense
        no-caps
        align="left"
        active-color="blue-grey-9"
        indicator-color="emerald-6"
        class="q-mb-md text-slate-700"
      >
        <q-tab name="summary" label="Leg Summary" icon="format_list_bulleted" />
        <q-tab name="tree" label="Network Tree" icon="account_tree" />
      </q-tabs>

      <q-tab-panels v-model="reportView" animated>
        <q-tab-panel name="summary" class="q-pa-none">
          <!-- Filters -->
          <div class="column q-mb-md" style="gap: 16px">
            <div class="row q-col-gutter-x-md" style="row-gap: 16px">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="legSearch"
                  dense
                  outlined
                  clearable
                  placeholder="Search leg name or ID..."
                >
                  <template #prepend><q-icon name="search" size="18px" /></template>
                </q-input>
              </div>
              <div class="col-6 col-sm-3">
                <q-select
                  v-model="statusFilter"
                  :options="statusOptions"
                  label="Status"
                  dense
                  outlined
                  options-dense
                  behavior="menu"
                  popup-content-class="rounded-lg"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input v-model.number="minPbv" type="number" min="0" label="Min PBV" dense outlined />
              </div>
            </div>

            <div class="row items-center no-wrap" style="gap: 8px">
              <q-btn-toggle
                v-model="sortBy"
                :options="sortOptions"
                unelevated
                no-caps
                dense
                toggle-color="blue-grey-9"
                color="grey-2"
                text-color="blue-grey-9"
                class="rounded-lg border border-slate-200"
              />
              <q-btn
                dense
                unelevated
                no-caps
                :icon="descending ? 'arrow_downward' : 'arrow_upward'"
                :label="descending ? 'Desc' : 'Asc'"
                class="bg-slate-100 text-slate-700 rounded-lg q-px-sm"
                @click="descending = !descending"
              />
              <q-btn
                v-if="filtersActive"
                dense
                flat
                no-caps
                icon="filter_alt_off"
                label="Reset"
                class="text-slate-700"
                @click="resetFilters"
              />
            </div>
          </div>

          <div class="row items-center justify-between q-mb-sm">
            <div class="text-subtitle1 text-bold text-blue-grey-9">Direct Leg Summary</div>
            <q-chip dense square class="bg-slate-100 text-slate-700">
              {{ visibleLegs.length }} of {{ legs.length }} leg{{ legs.length === 1 ? '' : 's' }}
            </q-chip>
          </div>
          <div v-if="!visibleLegs.length" class="text-grey text-center q-pa-md">
            No legs match the filters.
          </div>
          <q-list v-else bordered separator class="rounded-lg border border-slate-200">
            <q-item v-for="leg in visibleLegs" :key="leg.leg_code">
              <q-item-section>
                <div class="text-bold text-blue-grey-9">{{ leg.leg_name }}</div>
                <div class="text-caption text-grey">{{ leg.leg_code }}</div>
              </q-item-section>
              <q-item-section side class="text-right">
                <div class="text-caption">{{ leg.total_members }} members</div>
                <div class="text-bold text-green-14">
                  Personal BV: {{ Number(leg.personal_bv ?? 0).toLocaleString() }}
                </div>
                <div class="text-bold text-blue-grey-8">
                  Group BV: {{ Number(leg.group_bv ?? 0).toLocaleString() }}
                </div>
                <q-badge
                  class="q-mt-xs"
                  :color="leg.leg_status === 'ACTIVE' ? 'positive' : 'grey-7'"
                >
                  {{ leg.leg_status }}
                </q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>

        <q-tab-panel name="tree" class="q-pa-none">
          <div class="text-subtitle1 text-bold text-blue-grey-9 q-mb-sm">Network Tree</div>
          <div class="row items-center q-gutter-sm q-mb-sm">
            <span class="text-caption">Personal BV:</span>
            <q-badge color="positive">50 and above</q-badge>
            <q-badge color="orange-8">10 to under 50</q-badge>
            <q-badge color="negative">Below 10</q-badge>
          </div>
          <div class="text-caption text-grey q-mb-sm">
            Expand a distributor to view their downline. Filters and sort from the summary apply.
          </div>

          <q-list bordered class="network-tree rounded-lg border border-slate-200">
            <GeneNode
              v-for="node in visibleLegs"
              :key="node.out_distributoridno"
              :node="node"
              :startDate="form.date_from"
              :endDate="form.date_to"
              :sort-by="sortBy"
              :descending="descending"
              color-by-personal-bv
            />
          </q-list>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </div>
</template>

<script setup>
// Tree, filtering, and export helpers for the active-leg report.
import { computed, ref } from 'vue'
import DistributorLookup from 'components/DistributorLookup.vue'
import GeneNode from './GeneNode.vue'
import { supabase } from 'boot/supabase'
import { useQuasar } from 'quasar'
import { buildMeta, exportExcel as exportExcelFile, exportPdf as exportPdfFile } from 'src/utils/reportExport'
import { sortNodes } from 'src/utils/genealogy'
import { useAuth } from 'stores/auth'

const $q = useQuasar()
const auth = useAuth()

// Selection and results state shared by the summary and network views.
const form = ref({
  distributoridno: '',
  distributorname: '',
  date_from: '',
  date_to: '',
})

const legs = ref([])
const loading = ref(false)
const reportView = ref('summary')

// Derived tree, filter, and sort values drive the visible summary.
const treeNodes = computed(() =>
  legs.value.map((leg) => ({
    ...leg,
    out_distributoridno: leg.leg_code,
    distributorname: leg.leg_name,
    has_children: Number(leg.total_members ?? 0) > 1,
  })),
)

const legSearch = ref('')
const statusFilter = ref('All')
const minPbv = ref(null)
const sortBy = ref('gbv')
const descending = ref(true)
const sortOptions = [
  { label: 'Name', value: 'name' },
  { label: 'PBV', value: 'pbv' },
  { label: 'GBV', value: 'gbv' },
  { label: 'Members', value: 'members' },
]

const statusOptions = computed(() => [
  'All',
  ...new Set(legs.value.map((l) => l.leg_status).filter(Boolean)),
])

const filtersActive = computed(
  () => !!legSearch.value || statusFilter.value !== 'All' || Number(minPbv.value) > 0,
)

const resetFilters = () => {
  legSearch.value = ''
  statusFilter.value = 'All'
  minPbv.value = null
}

const visibleLegs = computed(() => {
  const q = (legSearch.value || '').toLowerCase().trim()
  const min = Number(minPbv.value) || 0
  const list = treeNodes.value.filter(
    (l) =>
      (!q ||
        String(l.leg_name ?? '').toLowerCase().includes(q) ||
        String(l.leg_code ?? '').toLowerCase().includes(q)) &&
      (statusFilter.value === 'All' || l.leg_status === statusFilter.value) &&
      Number(l.personal_bv ?? 0) >= min,
  )
  return sortNodes(list, sortBy.value, descending.value)
})

// Build export rows from the currently visible, filtered legs.
function legsExportData() {
  const filters = []
  if (legSearch.value) filters.push(`Search: ${legSearch.value}`)
  if (statusFilter.value !== 'All') filters.push(`Status: ${statusFilter.value}`)
  if (Number(minPbv.value) > 0) filters.push(`Min PBV: ${minPbv.value}`)
  const sortLabel = sortOptions.find((o) => o.value === sortBy.value)?.label
  const meta = buildMeta({
    from: form.value.date_from,
    to: form.value.date_to,
    printedBy: auth.userDetails?.firstname,
    extra: [
      ['Distributor', `${form.value.distributorname} (${form.value.distributoridno})`],
      ['Sorted By', `${sortLabel} ${descending.value ? 'descending' : 'ascending'}`],
      ['Filters', filters.length ? filters.join(', ') : 'None'],
      ['Records', `${visibleLegs.value.length} of ${legs.value.length}`],
    ],
  })
  const head = ['#', 'Distributor Name', 'Distributor ID', 'Members', 'Personal BV', 'Group BV', 'Status']
  const body = visibleLegs.value.map((l, i) => [
    i + 1,
    l.leg_name,
    l.leg_code,
    l.total_members ?? 0,
    l.personal_bv ?? 0,
    l.group_bv ?? 0,
    l.leg_status ?? '',
  ])
  return { title: 'Active Legs Report', meta, head, body, filename: `Active_Legs_${form.value.distributoridno}` }
}

const exportLegs = (type) => {
  const data = legsExportData()
  if (type === 'pdf') exportPdfFile(data)
  else exportExcelFile(data)
}

/* Fetch legs BV */
const fetchLegs = async () => {
  if (!form.value.distributoridno || !form.value.date_from || !form.value.date_to) {
    $q.notify({
      type: 'negative',
      message: 'Please select distributor and date range',
    })
    return
  }

  loading.value = true
  legs.value = []

  const { data, error } = await supabase.rpc('get_manager_leg_volumes', {
    p_upline_code: form.value.distributoridno,
    p_date_from: form.value.date_from,
    p_date_to: form.value.date_to,
  })

  loading.value = false

  if (error) {
    console.error(error)
    $q.notify({ type: 'negative', message: error.message || 'Failed to load data' })
  } else {
    legs.value = (data || []).sort((a, b) => (b.group_bv ?? 0) - (a.group_bv ?? 0))
    reportView.value = 'summary'
  }
}
</script>

<style scoped>
.network-tree :deep(.gene-node .q-expansion-item__content > .q-list) {
  margin-left: 16px;
  border-left: 1px solid var(--q-separator-color);
}
</style>
