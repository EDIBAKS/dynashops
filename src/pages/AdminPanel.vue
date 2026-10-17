<template>
  <q-page class="flex justify-center bg-gray-100 px-3 py-3 sm:px-6 sm:py-4">
    <div class="w-full max-w-7xl">
      <!-- HEADER -->
      <div
        class="mb-3 flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 px-3 py-3 text-white sm:px-4"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300"
          >
            <q-icon :name="activeItem?.icon || 'admin_panel_settings'" size="24px" />
          </div>
          <div class="min-w-0">
            <div class="truncate text-base font-bold sm:text-xl">Admin Panel</div>
            <div class="mt-0.5 truncate text-[0.7rem] font-medium text-slate-200 sm:text-xs">
              {{ activeItem?.label || '' }}
            </div>
          </div>
        </div>
        <div
          class="hidden shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold sm:flex"
        >
          <q-icon name="event" size="18px" class="text-emerald-300" />
          <span>{{ currentDate }}</span>
        </div>
      </div>

      <!-- NAVIGATION: grouped menus, scrollable on mobile -->
      <div
        class="mb-3 flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <q-btn
          v-for="item in actionItems"
          :key="item.value"
          unelevated
          no-caps
          dense
          :icon="item.icon"
          :label="item.label"
          class="shrink-0 rounded-lg px-3 py-1"
          :class="
            tab === item.value
              ? 'bg-blue-grey-9 text-white'
              : 'bg-slate-100 text-slate-700'
          "
          @click="tab = item.value"
        />

        <q-btn-dropdown
          v-for="group in reportGroups"
          :key="group.label"
          unelevated
          no-caps
          dense
          :icon="group.icon"
          :label="group.label"
          class="shrink-0 rounded-lg px-3 py-1"
          :class="
            group.items.some((i) => i.value === tab)
              ? 'bg-blue-grey-9 text-white'
              : 'bg-slate-100 text-slate-700'
          "
        >
          <q-list style="min-width: 220px">
            <q-item
              v-for="item in group.items"
              :key="item.value"
              v-close-popup
              clickable
              :active="tab === item.value"
              active-class="bg-blue-grey-1 text-blue-grey-9"
              @click="tab = item.value"
            >
              <q-item-section avatar style="min-width: 36px">
                <q-icon :name="item.icon" size="20px" />
              </q-item-section>
              <q-item-section>{{ item.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>

      <q-card flat class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <q-card-section class="q-pa-none" style="min-height: 60vh">
        <div style="width: 100%; margin: 0 auto">
          <q-tab-panels
            v-model="tab"
            animated
            transition-next="fade"
            transition-prev="fade"
            class="bg-transparent"
          >
            <!-- Dispatch Tab -->
            <q-tab-panel name="Dispatch" class="q-pa-md transparent-panel full-height">
              <div class="column fit q-gutter-md">
                <div class="text-h6 text-primary text-bold">📦 Dispatch</div>
                <div class="q-pa-md" style="min-height: 70vh; overflow-y: auto">
                  <dispatchForm
                    @dispatched="dispatchTable?.refresh()"
                    @type-change="dispatchReportType = $event"
                  />
                  <div style="max-width: 900px; margin: 40px auto 0">
                    <DispatchMonthTable ref="dispatchTable" :type="dispatchReportType" />
                  </div>
                </div>
              </div>
            </q-tab-panel>

            <!-- Withdraw Tab -->
            <q-tab-panel name="Withdraw" class="q-pa-md transparent-panel full-height">
              <div class="column fit q-gutter-md">
                <div class="row items-center q-gutter-sm text-primary text-bold text-h6">
                  <q-icon name="undo" />
                  <span>Withdraw</span>
                </div>
                <div class="q-pa-md" style="min-height: 70vh; overflow-y: auto">
                  <WithdrawForm />
                </div>
              </div>
            </q-tab-panel>

            <!-- Main Store Tab -->
            <q-tab-panel v-if="isSuperAdmin" name="MainStore" class="q-pa-md transparent-panel full-height">
              <div class="column fit q-gutter-md">
                <div class="row items-center q-gutter-sm text-primary text-bold text-h6">
                  <q-icon name="warehouse" />
                  <span>Main Store</span>
                </div>
                <div class="q-pa-md" style="min-height: 70vh; overflow-y: auto">
                  <MainStore />
                </div>
              </div>
            </q-tab-panel>

            <!-- Reports Tab -->
            <q-tab-panel name="StockReport">
              <div class="text-subtitle1 text-weight-bold text-slate-700">Current Stock</div>

              <q-btn-toggle
                v-model="displayMode"
                unelevated
                no-caps
                spread
                toggle-color="blue-grey-9"
                color="grey-3"
                text-color="blue-grey-9"
                class="q-mt-md rounded-lg border border-slate-200"
                style="max-width: 560px"
                :options="[
                  { label: 'List', value: 'list', icon: 'view_list' },
                  { label: 'Table', value: 'table', icon: 'table_chart' },
                  { label: 'Per Shop', value: 'shop', icon: 'storefront' },
                  { label: 'Tracker', value: 'graphs', icon: 'insights' },
                ]"
              />

              <div class="q-mt-md">
                <stockMonitor v-if="displayMode === 'list'" />
                <stockTable v-else-if="displayMode === 'table'" />
                <shopView v-else-if="displayMode === 'shop'" />
                <StockDashBoard v-else-if="displayMode === 'graphs'" />
              </div>
            </q-tab-panel>
            <q-tab-panel name="SalesReport">
              <div class="text-h6">📊 Sales Report</div>

              <!-- 🔥 RADIO BUTTONS -->

              <SalesReport />
            </q-tab-panel>

            <q-tab-panel v-if="isSuperAdmin" name="Extraction">
              <div class="text-h6">📊 Admin Only</div>
              <ExxtractionPage />
            </q-tab-panel>
            <q-tab-panel name="DispatchReport">
              <div class="text-h6">📊 DispatchReport</div>
              <dispatchReport />
            </q-tab-panel>
            <q-tab-panel name="withdrawReport">
              <div class="text-h6">📊 Withdraws</div>
              <WithdrawReport />
            </q-tab-panel>
            <q-tab-panel name="activeLegs">
              <div class="text-h6">📊 Distributor Performance</div>
              <ManagerLegs />
            </q-tab-panel>
            <q-tab-panel name="gineology">
              <div class="text-h6">📊 Distributor Performance</div>
              <GineologyTree />
            </q-tab-panel>
            <q-tab-panel name="Promos">
              <div class="text-h6">📊 Promotional GiveAway</div>
              <PromoReturns />
            </q-tab-panel>
            <q-tab-panel name="Debts">
              <div class="text-h6">📊 Debts</div>
              <DebtReport />
            </q-tab-panel>
            <q-tab-panel name="Expiries">
              <div class="text-h6">📊 Expiries WithDrawn</div>
              <ExpiryReport />
            </q-tab-panel>
            <q-tab-panel name="TotalDispatch">
              <div class="text-h6">📊Consolidated Dispatch</div>
              <CompactDispatch />
            </q-tab-panel>
            <q-tab-panel v-if="isSuperAdmin" name="Province">
              <div class="text-h6 q-mb-md">Create Province</div>
              <ProvinceManager />
            </q-tab-panel>
            <!-- Review recorded activity for the selected date range. -->
            <q-tab-panel v-if="isSuperAdmin" name="ActivityLogs">
              <div class="text-h6 q-mb-md">Activity Logs</div>
              <div class="row q-col-gutter-md items-end q-mb-md">
                <div class="col-12 col-sm-4">
                  <div class="text-caption text-bold q-mb-xs">Start date</div>
                  <q-input v-model="activityStartDate" type="date" dense outlined />
                </div>
                <div class="col-12 col-sm-4">
                  <div class="text-caption text-bold q-mb-xs">End date</div>
                  <q-input v-model="activityEndDate" type="date" dense outlined />
                </div>
                <div class="col-12 col-sm-4">
                  <q-btn
                    color="primary"
                    label="Load activity"
                    icon="search"
                    :loading="activityLogLoading"
                    :disable="activityLogLoading"
                    class="full-width"
                    @click="fetchActivityLogs"
                  />
                </div>
              </div>
              <q-banner v-if="activityLogError" rounded class="bg-negative text-white q-mb-md">
                {{ activityLogError }}
              </q-banner>
              <q-banner
                v-else-if="!activityLogLoading && activityLogs.length === 0"
                rounded
                class="bg-grey-3 text-grey-8 q-mb-md"
              >
                No activity logs were found for the selected dates. Confirm the migration has
                been applied and that activity was recorded during this period.
              </q-banner>
              <ActivityLogReport
                v-if="activityLogs.length"
                :rows="activityLogs"
                :start-date="activityStartDate"
                :end-date="activityEndDate"
              />
            </q-tab-panel>
          </q-tab-panels>
        </div>
      </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
// Admin panel data, report, and management-view dependencies.
import { ref, onMounted, computed } from 'vue'

import { supabase } from 'boot/supabase'
import { useAuth } from 'stores/auth'
import dispatchForm from '../components/dispatchForm.vue'
import DispatchMonthTable from 'src/components/DispatchMonthTable.vue'
import MainStore from 'src/components/MainStore.vue'
import WithdrawForm from 'src/components/withdrawForm.vue'
import stockMonitor from 'src/components/stockMonitor.vue'
import stockTable from 'src/components/stockTable.vue'
import shopView from 'src/components/shopView.vue'
import ExxtractionPage from 'src/components/ExxtractionPage.vue'
import dispatchReport from 'src/components/dispatchReport.vue'
import WithdrawReport from 'src/components/WithdrawReport.vue'
import SalesReport from 'src/components/salesReport.vue'
import ManagerLegs from 'src/components/ManagerLegs.vue'
import PromoReturns from 'src/components/PromoReturns.vue'
import DebtReport from 'src/components/DebtsReport.vue'
import CompactDispatch from 'src/components/CompactDispatch.vue'
import GineologyTree from 'src/components/GineologyTree.vue'
import ExpiryReport from 'src/components/ExpiryReport.vue'
import StockDashBoard from 'src/components/StockDashBoard.vue'
import ActivityLogReport from 'src/components/ActivityLogReport.vue'
import ProvinceManager from 'src/components/ProvinceManager.vue'
// Current panel selection, permissions, and report navigation state.
const auth = useAuth()
const currentDate = ref('')
const tab = ref('Dispatch')
const dispatchTable = ref(null)
const dispatchReportType = ref('SHOP')
const isAdmin = computed(() => auth.userDetails?.role === 'Admin')
const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')
const isAdminOrSuper = computed(() => isAdmin.value || isSuperAdmin.value)

const actionItems = computed(() =>
  [
    { value: 'Dispatch', label: 'Dispatch', icon: 'local_shipping', show: true },
    { value: 'Withdraw', label: 'Withdraw', icon: 'undo', show: isAdminOrSuper.value },
    { value: 'MainStore', label: 'Main Store', icon: 'warehouse', show: isSuperAdmin.value },
  ].filter((i) => i.show),
)

const reportGroups = computed(() =>
  [
    {
      label: 'Stock',
      icon: 'inventory_2',
      items: [
        { value: 'DispatchReport', label: 'Dispatches', icon: 'local_shipping', show: true },
        { value: 'withdrawReport', label: 'Withdraws', icon: 'undo', show: true },
        { value: 'StockReport', label: 'Stock Report', icon: 'inventory', show: isAdminOrSuper.value },
        { value: 'TotalDispatch', label: 'Total Dispatch', icon: 'summarize', show: isAdminOrSuper.value },
        { value: 'Expiries', label: 'Expiries', icon: 'event_busy', show: isAdminOrSuper.value },
        { value: 'Promos', label: 'Promos', icon: 'redeem', show: true },
      ],
    },
    {
      label: 'Sales',
      icon: 'point_of_sale',
      items: [
        { value: 'SalesReport', label: 'Sales Report', icon: 'bar_chart', show: isAdminOrSuper.value },
        { value: 'Debts', label: 'Debts', icon: 'request_quote', show: true },
      ],
    },
    {
      label: 'Network',
      icon: 'groups',
      items: [
        { value: 'gineology', label: 'Gineology', icon: 'account_tree', show: true },
        { value: 'activeLegs', label: 'Active Legs', icon: 'timeline', show: true },
      ],
    },
    {
      label: 'System',
      icon: 'settings',
      items: [
        { value: 'Extraction', label: 'Data Extract', icon: 'download', show: isSuperAdmin.value },
        { value: 'ActivityLogs', label: 'Activity Logs', icon: 'history', show: isSuperAdmin.value },
        { value: 'Province', label: 'Create Province', icon: 'add_location_alt', show: isSuperAdmin.value },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length),
)

const activeItem = computed(() =>
  [...actionItems.value, ...reportGroups.value.flatMap((g) => g.items)].find(
    (i) => i.value === tab.value,
  ),
)
const displayMode = ref('list') // 'list' or 'table'
// Date filters and results for the activity-log report.
const activityLogs = ref([])
const activityLogLoading = ref(false)
const activityLogError = ref('')
const activityStartDate = ref(getFirstDayOfMonth())
const activityEndDate = ref(getToday())

// Format activity-log dates and load records within the selected range.
function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getFirstDayOfMonth() {
  const today = new Date()
  return formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
}

function getToday() {
  return formatDateInput(new Date())
}

async function fetchActivityLogs() {
  activityLogs.value = []
  activityLogError.value = ''

  const from = new Date(`${activityStartDate.value}T00:00:00`)
  const to = new Date(`${activityEndDate.value}T00:00:00`)
  if (
    !activityStartDate.value ||
    !activityEndDate.value ||
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from > to
  ) {
    activityLogError.value = 'Choose a valid date range with the start date on or before the end date.'
    return
  }

  to.setDate(to.getDate() + 1)
  activityLogLoading.value = true
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('id, created_at, username, activity, reference, description, dpccode')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) throw error
    activityLogs.value = data || []
  } catch (error) {
    console.error('Activity log fetch failed:', error)
    activityLogError.value = `Unable to load activity logs: ${error.message || 'Unknown error'}`
  } finally {
    activityLogLoading.value = false
  }
}

function getCurrentDate() {
  const today = new Date()
  const options = { year: 'numeric', month: 'short', day: 'numeric' } // Example: "Oct 30, 2025"
  currentDate.value = today.toLocaleDateString(undefined, options)
}
// Call on mount
onMounted(() => {
  getCurrentDate()
})
</script>
<style scoped>
/* Desktop default */
.responsive-tabs .q-tab__label {
  font-size: 14px;
}
.responsive-tabs .q-tab__icon {
  font-size: 22px;
}

/* Mobile adjustments */
@media (max-width: 600px) {
  .responsive-tabs {
    width: 100%; /* stretch across the page */
  }
  .responsive-tabs .q-tab {
    min-width: auto; /* allow tabs to shrink */
    padding: 4px 8px; /* smaller padding */
    flex-shrink: 1; /* let tab shrink to avoid wrapping */
  }
  .responsive-tabs .q-tab__label {
    font-size: 11px; /* smaller labels */
  }
  .responsive-tabs .q-tab__icon {
    font-size: 16px; /* smaller icons */
    margin-right: 4px; /* space between icon and label */
  }
}

.info-bar {
  width: 100%;
  flex-wrap: nowrap; /* prevent wrapping */
  gap: 16px; /* space between items */
  font-size: 14px;
}

@media (max-width: 600px) {
  .info-bar {
    gap: 8px; /* slightly tighter spacing for small screens */
    font-size: 12px; /* smaller text for mobile */
  }
}
.transparent-panel {
  background-color: transparent !important;
  box-shadow: none !important;
}
.responsive-card {
  width: 100%;
  max-width: 1400px; /* 👈 wider for desktop */
  margin: 0 auto;
}

/* Ultra large screens */
@media (min-width: 1600px) {
  .responsive-card {
    max-width: 1600px;
  }
}

/* Mobile */
@media (max-width: 600px) {
  .responsive-card {
    max-width: 100%;
    padding: 8px;
  }
}
</style>
