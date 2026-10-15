<template>
    <!-- Recursive distributor card with its lazily loaded descendants. -->
  <q-expansion-item
    dense
    class="gene-node"
    expand-icon="chevron_right"
    :disable="!node.has_children"
    @show="onExpand"
  >
    <template #header>
      <div class="row items-center no-wrap full-width q-py-xs">
        <q-avatar size="32px" class="q-mr-sm bg-blue-grey-1 text-blue-grey-9 text-weight-bold">
          <span style="font-size: 12px">{{ initials }}</span>
        </q-avatar>

        <div class="col text-left" style="min-width: 0">
          <div class="ellipsis text-weight-medium name">{{ node.distributorname }}</div>
          <div class="text-caption text-grey-7">{{ node.out_distributoridno }}</div>
        </div>

        <div class="row items-center no-wrap q-gutter-xs">
          <q-badge :color="pbvColor" outline class="text-bold q-pa-xs">
            PBV {{ Number(node.personal_bv ?? 0).toLocaleString() }}
          </q-badge>
          <q-badge color="blue-grey-9" class="text-bold q-pa-xs">
            GBV {{ gbvLabel }}
          </q-badge>
        </div>
      </div>
    </template>

    <q-inner-loading :showing="loading">
      <div class="text-center q-pa-sm">Loading...</div>
    </q-inner-loading>

    <q-list v-if="sortedChildren.length" class="children">
      <GeneNode
        v-for="child in sortedChildren"
        :key="child.out_distributoridno"
        :node="child"
        :startDate="startDate"
        :endDate="endDate"
        :sort-by="sortBy"
        :descending="descending"
        :color-by-personal-bv="colorByPersonalBv"
      />
    </q-list>
  </q-expansion-item>
</template>

<script setup>
// Dependencies for recursive rendering, data loading, and genealogy display.
import { computed, ref, inject } from 'vue'
import { supabase } from 'src/boot/supabase'
import GeneNode from './GeneNode.vue'
import { useQuasar } from 'quasar'
import { withGbv, sortNodes, nodeInitials } from 'src/utils/genealogy'

const props = defineProps({
  node: Object,
  startDate: String,
  endDate: String,
  sortBy: { type: String, default: 'name' },
  descending: { type: Boolean, default: false },
  colorByPersonalBv: { type: Boolean, default: false },
})

const $q = useQuasar()
// Parent report can provide a cache so exports include expanded branches
const geneCache = inject('geneCache', null)
// Cached children and loading flags control expansion requests.
const children = ref([])
const loading = ref(false)
const loaded = ref(false)

// Labels and colors are derived from the current distributor.
const initials = computed(() => nodeInitials(props.node))
const sortedChildren = computed(() =>
  sortNodes(children.value, props.sortBy === 'members' ? 'name' : props.sortBy, props.descending),
)

const gbvLabel = computed(() => {
  const v = props.node.gbv ?? props.node.group_bv ?? props.node.out_gbv
  return v == null ? '—' : Number(v).toLocaleString()
})

const pbvColor = computed(() => {
  const pbv = Number(props.node.personal_bv ?? 0)
  if (!props.colorByPersonalBv) return 'primary'
  if (pbv >= 50) return 'positive'
  if (pbv >= 10) return 'orange-8'
  return 'negative'
})

// Load direct reports once, then share them with report exports.
async function onExpand() {
  if (loaded.value) return
  loading.value = true
  try {
    const { data, error } = await supabase.rpc('get_direct_children_with_bv', {
      p_root: props.node.out_distributoridno,
      p_date_from: props.startDate,
      p_date_to: props.endDate,
    })
    if (error) throw error
    children.value = await withGbv(Array.isArray(data) ? data : [], props.startDate, props.endDate)
    if (geneCache) geneCache[props.node.out_distributoridno] = children.value
    loaded.value = true
  } catch (err) {
    console.error('Failed to load distributor downline:', err)
    $q.notify({
      type: 'negative',
      message: err?.message || 'Failed to load distributor downline',
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.gene-node {
  border-bottom: 1px solid #e2e8f0;
}
.gene-node:last-child {
  border-bottom: none;
}
.gene-node :deep(.q-item) {
  min-height: 46px;
}
.children {
  margin-left: 18px;
  border-left: 2px solid #e2e8f0;
}
.gene-node.q-expansion-item--expanded > .q-expansion-item__container > .q-item .name {
  color: #21ba45;
}
.gene-node.q-expansion-item--expanded > .q-expansion-item__container > .q-item {
  background-color: rgba(33, 186, 69, 0.06);
}
</style>
