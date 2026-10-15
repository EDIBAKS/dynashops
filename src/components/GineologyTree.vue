<template>
    <!-- Search controls and the expandable downline report. -->
  <div class="column q-pb-xl" style="max-width: 900px; margin: auto; gap: 40px">
    <q-card flat bordered class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md">
      <div class="row items-center q-gutter-sm q-mb-md text-blue-grey-9">
        <q-icon name="account_tree" size="22px" class="text-emerald-600" />
        <div class="text-subtitle1 text-bold">Genealogy</div>
      </div>

      <div class="column" style="gap: 20px">
        <DistributorLookup v-model="rootId" v-model:name="rootName" />

        <div class="row q-col-gutter-x-md" style="row-gap: 20px">
          <div class="col-12 col-sm-6">
            <q-input v-model="startDate" type="date" label="From" dense outlined />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="endDate" type="date" label="To" dense outlined />
          </div>
        </div>

        <q-btn
          label="Load Genealogy"
          icon="search"
          unelevated
          no-caps
          class="bg-blue-grey-9 text-white rounded-lg full-width"
          @click="loadRoot"
          :loading="loading"
          :disable="!rootId"
        />
      </div>
    </q-card>

    <q-card flat bordered class="rounded-2xl border border-slate-200 bg-white shadow-sm q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="row items-center q-gutter-sm text-blue-grey-9">
          <q-icon name="groups" size="22px" class="text-emerald-600" />
          <div class="text-subtitle1 text-bold">Downline</div>
        </div>
        <div class="row items-center q-gutter-sm">
          <q-chip dense square class="bg-slate-100 text-slate-700">
            {{ nodes.length }} direct
          </q-chip>
          <q-btn
            dense
            unelevated
            no-caps
            icon="grid_on"
            label="Excel"
            class="bg-emerald-600 text-white rounded-lg q-px-sm"
            :disable="!nodes.length"
            @click="exportExcel"
          />
          <q-btn
            dense
            unelevated
            no-caps
            icon="picture_as_pdf"
            label="PDF"
            class="bg-blue-grey-9 text-white rounded-lg q-px-sm"
            :disable="!nodes.length"
            @click="exportPDF"
          />
        </div>
      </div>

      <!-- 📦 EVERYTHING INSIDE HERE WILL BE EXPORTED -->
      <div ref="reportRef">
        <div
          v-if="rootId"
          class="rounded-lg border border-slate-200 bg-slate-50 q-pa-sm q-px-md q-mb-md text-caption text-slate-700"
        >
          <b>Root:</b> {{ rootName }} ({{ rootId }})<br />
          <b>Period:</b> {{ startDate }} → {{ endDate }}
        </div>

        <div v-if="!nodes.length" class="text-grey text-center q-pa-md">
          Select a distributor and period, then load the genealogy.
        </div>

        <template v-else>
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-6">
              <div class="rounded-lg border border-slate-200 q-pa-sm q-px-md">
                <div class="text-caption text-grey-7">Direct PBV</div>
                <div class="text-subtitle1 text-bold text-blue-grey-9">
                  {{ totals.pbv.toLocaleString() }}
                </div>
              </div>
            </div>
            <div class="col-6">
              <div class="rounded-lg border border-slate-200 q-pa-sm q-px-md">
                <div class="text-caption text-grey-7">Direct GBV</div>
                <div class="text-subtitle1 text-bold text-blue-grey-9">
                  {{ totals.gbv.toLocaleString() }}
                </div>
              </div>
            </div>
          </div>

          <div class="row items-center no-wrap q-mb-md" style="gap: 8px" data-html2canvas-ignore>
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
            <span class="text-caption text-grey-7 gt-xs">Applies to every level</span>
          </div>

          <q-list bordered class="rounded-lg border border-slate-200">
            <GeneNode
              v-for="node in sortedNodes"
              :key="node.out_distributoridno"
              :node="node"
              :startDate="startDate"
              :endDate="endDate"
              :sort-by="sortBy"
              :descending="descending"
            />
          </q-list>
        </template>
      </div>
    </q-card>
  </div>
</template>

<script setup>
// Data, tree, and export dependencies for the genealogy report.
import { ref, computed, reactive, provide } from 'vue'
import { supabase } from 'src/boot/supabase'
import GeneNode from './GeneNode.vue'
import DistributorLookup from 'components/DistributorLookup.vue'
import { withGbv, sortNodes, flattenTree } from 'src/utils/genealogy'
import { buildMeta, exportExcel as exportExcelFile, exportPdf as exportPdfFile } from 'src/utils/reportExport'
import { useAuth } from 'stores/auth'
import { useQuasar } from 'quasar'
const $q = useQuasar()
const auth = useAuth()

// Children loaded by expanded nodes, so exports match what is on screen
const geneCache = reactive({})
provide('geneCache', geneCache)

// Current root, date range, and loading state for the report.
const rootId = ref('') // DistributorIDNO (from search)
const rootName = ref('') // DistributorNames (from search)

const startDate = ref('')
const endDate = ref('')
const nodes = ref([])
const loading = ref(false)
const sortBy = ref('name')
const descending = ref(false)
// Derived totals and ordering keep the displayed tree consistent.
const sortedNodes = computed(() => sortNodes(nodes.value, sortBy.value, descending.value))
const totals = computed(() => ({
  pbv: nodes.value.reduce((s, n) => s + Number(n.personal_bv ?? 0), 0),
  gbv: nodes.value.reduce((s, n) => s + Number(n.gbv ?? 0), 0),
}))
const sortOptions = [
  { label: 'Name', value: 'name', icon: 'sort_by_alpha' },
  { label: 'PBV', value: 'pbv', icon: 'person' },
  { label: 'GBV', value: 'gbv', icon: 'groups' },
]

// Fetch the selected distributor?s direct reports for the date range.
async function loadRoot() {
  if (!rootId.value) return

  // 🚫 BLOCK if dates not selected
  if (!startDate.value || !endDate.value) {
    $q.notify({
      type: 'warning',
      position: 'top',
      message: 'Please select BOTH From and To dates before loading genealogy',
    })
    return
  }

  loading.value = true
  nodes.value = []
  Object.keys(geneCache).forEach((k) => delete geneCache[k])

  const { data, error } = await supabase.rpc('get_direct_children_with_bv', {
    p_root: rootId.value,
    p_date_from: startDate.value,
    p_date_to: endDate.value,
  })

  if (error) {
    loading.value = false
    console.error('RPC error:', error)
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to load genealogy data',
    })
    return
  }

  const safeData = Array.isArray(data) ? data : []

  // ✅ Only immediate children (extra safety)
  nodes.value = await withGbv(
    safeData.filter((d) => d.out_parentidno === rootId.value),
    startDate.value,
    endDate.value,
  )
  loading.value = false
}

const reportRef = ref(null)

// Same rows, same order as on screen (sort applied at every level, expanded branches included)
function exportData() {
  const rows = flattenTree(sortedNodes.value, geneCache, sortBy.value, descending.value)
  return rows
}

const sortLabel = () =>
  `${sortOptions.find((o) => o.value === sortBy.value)?.label} ${descending.value ? 'descending' : 'ascending'}`

function exportMeta(count) {
  return buildMeta({
    from: startDate.value,
    to: endDate.value,
    printedBy: auth.userDetails?.firstname,
    extra: [
      ['Root', `${rootName.value} (${rootId.value})`],
      ['Sorted By', sortLabel()],
      ['Records', count],
    ],
  })
}

function exportPDF() {
  const rows = exportData()
  if (!rows.length) return
  exportPdfFile({
    title: 'Genealogy Report',
    meta: exportMeta(rows.length),
    filename: `Genealogy_${rootId.value}`,
    head: ['Distributor ID', 'Name', 'PBV', 'GBV'],
    body: rows.map((r) => [r.id, `${'      '.repeat(r.level - 1)}${r.name}`, r.pbv, r.gbv]),
  })
}

function exportExcel() {
  const rows = exportData()
  if (!rows.length) return
  exportExcelFile({
    title: 'Genealogy',
    meta: exportMeta(rows.length),
    filename: `Genealogy_${rootId.value}`,
    head: ['Level', 'Distributor ID', 'Name', 'PBV', 'GBV'],
    body: rows.map((r) => [r.level, r.id, r.name, r.pbv, r.gbv]),
  })
}
</script>
