<template>
  <q-page class="q-pa-sm bg-transparent">
    <q-card class="q-pa-sm bg-transparent responsive-card" style="border: 0; box-shadow: none">
      <!-- Header -->
      <q-card-section class="reports-context-header">
        <div class="reports-context-copy">
          <div class="reports-context-title">
            <q-icon name="storefront" size="19px" />
            <span>{{ shopName }}</span>
          </div>
          <div class="reports-context-meta">
            <span>
              <q-icon name="calendar_today" size="14px" />
              {{ currentDateTime.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US') }}
            </span>
            <span>
              <q-icon name="schedule" size="14px" />
              {{ $t('loginTime') }}:
              {{
                loginDateTime.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }}
            </span>
            <span v-if="form.dpccode" class="reports-context-code">
              {{ form.dpccode }}
            </span>
          </div>
          <div v-if="selectedReportTitle" class="reports-context-report">
            {{ selectedReportTitle }}
          </div>
        </div>
      </q-card-section>

      <q-card-section class="custom-form">
        <!-- Report type -->
        <div class="col-12 col-sm-4 col-md-3">
          <div class="reports-filter-label text-caption text-bold q-mb-xs">
            {{ $t('report') }}
          </div>
          <div class="select-wrapper">
            <select
              v-model="form.reportType"
              class="custom-select reports-select native-select full-width"
            >
              <!-- Default translated placeholder -->
              <option value="">
                {{ $t('select_report_type') }}
              </option>

              <!-- Real selectable options -->
              <option v-for="option in reportOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Start Date -->
        <div class="col-12 col-sm-4 col-md-3">
          <div class="reports-filter-label text-caption text-bold q-mb-xs">{{ $t('startDate') }}</div>
          <q-input
            v-model="form.startDate"
            type="date"
            input-class="reports-input-text text-center"
            dense
            outlined
            class="reports-filter-input full-width"
          />
        </div>

        <!-- End Date -->
        <div class="col-12 col-sm-4 col-md-3">
          <div class="reports-filter-label text-caption text-bold q-mb-xs">{{ $t('endDate') }}</div>
          <q-input
            v-model="form.endDate"
            type="date"
            dense
            outlined
            class="reports-filter-input full-width"
            input-class="reports-input-text text-center"
          />
        </div>
        <div class="row items-center q-col-gutter-sm q-mt-md" style="width: 100%">
          <div class="col">
            <div
              v-if="form.reportType === 'dailySales'"
              class="reports-filter-label text-caption text-bold q-mb-xs"
            >
              {{ $t('from') }}
            </div>
            <q-input
              v-if="form.reportType === 'dailySales'"
              v-model="fromReceipt"
              input-class="reports-input-text text-center text-bold"
              outlined
              dense
              class="reports-filter-input"
              @update:model-value="(val) => (fromReceipt = val.toUpperCase())"
            />
          </div>

          <div class="col">
            <div
              v-if="form.reportType === 'dailySales'"
              class="reports-filter-label text-caption text-bold q-mb-xs"
            >
              {{ $t('to') }}
            </div>
            <q-input
              v-if="form.reportType === 'dailySales'"
              v-model="toReceipt"
              input-class="reports-input-text text-center text-bold"
              outlined
              dense
              class="reports-filter-input"
              @update:model-value="(val) => (toReceipt = val.toUpperCase())"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-section class="custom-form">
        <!-- DPC select / input -->
        <div
          class="col-12 col-md-3"
          v-if="
            ['dailySales', 'tallys', 'sales', 'stock', 'queriedSales', 'bestCustomers'].includes(
              form.reportType,
            )
          "
        >
          <div class="reports-filter-label text-caption text-bold q-mb-xs">Shop</div>
          <select
            v-if="permissions.canSelectDpc"
            v-model="form.dpccode"
            class="custom-select reports-select native-select full-width"
          >
            <option v-for="option in dpcOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>

          <q-input
            v-else
            v-model="form.dpccode"
            dense
            outlined
            readonly
            class="reports-filter-input full-width"
            input-class="reports-input-text text-center text-bold"
          />
        </div>

        <!-- Distributor ID + Search (only when personalBV) -->

        <div class="col-12 col-md-3">
          <!-- Distributor ID -->
          <div
            v-if="form.reportType === 'personalBV'"
            class="reports-filter-label text-caption text-bold q-mb-xs"
          >
            {{ $t('distributorID') }}
          </div>
          <q-input
            v-if="form.reportType === 'personalBV'"
            v-model="form.distributoridno"
            dense
            outlined
            caps
            class="reports-filter-input q-mt-md"
            input-class="reports-input-text text-center text-bold"
            @update:model-value="(val) => (form.distributoridno = val.toUpperCase())"
          />

          <!-- Distributor Search -->
          <DistributorSearch
            v-if="form.reportType === 'personalBV'"
            v-model="form.distributoridno"
          />
        </div>
      </q-card-section>
      <q-card-section class="custom-form reports-fetch-section">
        <!-- Fetch Button -->
        <div class="col-12 col-md-3 flex items-end">
          <q-btn
            :label="
              selectedReportTitle
                ? $t('fetchSelectedReport', { report: selectedReportTitle })
                : $t('fetchSales')
            "
            @click="fetchData"
            class="reports-fetch-btn full-width text-white"
            :loading="reportLoading"
            :disable="reportLoading"
          />
        </div>
        <div v-if="salesStore.error" class="reports-fetch-error text-orange">
          {{ salesStore.error }}
        </div>
      </q-card-section>

      <!-- Sales Results -->
      <CurrencyToggle compact>
        <template #toolbar-center>
          <div
            v-if="['dailySales', 'tallys', 'sales', 'bestCustomers'].includes(form.reportType)"
            class="pending-receipts-badge"
            role="status"
            aria-live="polite"
          >
            <q-spinner v-if="pendingLoading" size="15px" color="white" />
            <template v-else>
              <q-icon
                :name="pendingCount === 0 ? 'check_circle' : 'pending_actions'"
                size="17px"
              />
              <span>{{
                pendingCount === 0
                  ? $t('allCleared')
                  : `${pendingCount} ${$t('pendingReceipts')}`
              }}</span>
            </template>
          </div>
        </template>
        <template #toolbar-end>
          <div class="reports-export-controls">
            <reportExporter
              v-if="form.reportType === 'dailySales'"
              compact
              reportType="dailySales"
              :reportData="paginatedSales"
              :dpccode="form.dpccode"
              :startDate="form.startDate"
              :endDate="form.endDate"
            />
            <reportExporter
              v-else-if="form.reportType === 'personalBV'"
              compact
              reportType="personalBV"
              :reportData="salesByDistributor"
            />
            <reportExporter
              v-else-if="form.reportType === 'tallys'"
              compact
              reportType="tallys"
              :reportData="filteredTallyReportData"
              :dpccode="form.dpccode"
              :startDate="form.startDate"
              :endDate="form.endDate"
              :extraInfo="{ tallyType }"
            />
            <reportExporter
              v-else-if="form.reportType === 'sales'"
              compact
              reportType="sales"
              :reportData="dailySalesTotals"
              :dpccode="form.dpccode"
              :startDate="form.startDate"
              :endDate="form.endDate"
            />
            <reportExporter
              v-else-if="form.reportType === 'stock'"
              compact
              reportType="stock"
              :reportData="stockExportRows"
              :dpccode="form.dpccode"
              :startDate="form.startDate"
              :endDate="form.endDate"
            />
            <reportExporter
              v-else-if="form.reportType === 'queriedSales'"
              compact
              reportType="dailySales"
              :reportData="paginatedSales"
              :dpccode="form.dpccode"
              :startDate="form.startDate"
              :endDate="form.endDate"
            />
            <reportExporter
              v-else-if="form.reportType === 'bestCustomers'"
              compact
              reportType="bestCustomers"
              :reportData="sortedCustomers"
              :dpccode="form.dpccode"
              :startDate="form.startDate"
              :endDate="form.endDate"
            />
          </div>
        </template>
        <template #toolbar-pagination>
          <div class="reports-pagination">
            <label class="reports-page-size-label" for="reports-rows-per-page">
              {{ $t('rowsPerPage') }}
            </label>
            <select
              id="reports-rows-per-page"
              v-model="rowsPerPage"
              class="pagination-select native-select"
            >
              <option v-for="opt in pageOptions" :key="opt" :value="opt">
                {{ opt }}
              </option>
            </select>
            <q-pagination
              v-model="currentPage"
              :max="totalPages"
              direction-links
              :max-pages="3"
              color="blue-grey-7"
              active-design="unelevated"
              active-color="blue-grey-9"
              active-text-color="white"
              class="reports-pagination-buttons"
              @update:model-value="changePage"
            />
          </div>
        </template>
        <template #default="{ convert }">
        <q-card-section
          v-if="reportLoading && form.reportType === 'personalBV'"
          class="personal-summary-grid"
          role="status"
          aria-live="polite"
        >
          <div v-for="metric in 3" :key="metric" class="personal-summary-card">
            <span class="personal-summary-label">
              {{
                metric === 1
                  ? $t('totalPersonalSales')
                  : metric === 2
                    ? $t('totalPersonalBV')
                    : $t('activeLegs')
              }}
            </span>
            <span class="personal-summary-value personal-summary-loading">
              <q-spinner color="blue-grey-8" size="18px" />
            </span>
          </div>
        </q-card-section>
        <q-card-section
          v-else-if="
            reportLoading &&
            !(form.reportType === 'sales' && salesStore.salesTally.length > 0)
          "
          class="reports-loading-panel"
          role="status"
          aria-live="polite"
        >
          <q-spinner-orbit color="blue-grey-8" size="42px" />
          <span>{{ $t('loadingReport') }}</span>
        </q-card-section>
        <q-card-section v-else class="q-pa-sm bg-transparent" style="border-radius: 12px">
          <!-- Daily Sales -->
          <template v-if="form.reportType === 'dailySales'">
            <!-- ✅ Show "No Data Found" Banner -->
            <q-banner
              v-if="!paginatedSales || paginatedSales.length === 0"
              class="bg-grey-2 text-center text-dark q-pa-md q-mt-md"
              rounded
            >
              <q-icon name="info" color="primary" size="md" class="q-mr-sm" />
              {{ $t('noDataFound') }}
            </q-banner>
            <!-- ✅ Show Sales Cards Only If There Is Data -->
            <div v-else>
              <div
                v-for="sale in paginatedSales"
                :key="sale.receiptno"
                class="daily-sale-card-wrap mt-4"
              >
                <q-card flat bordered class="daily-sale-card overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
                  <q-card-section class="daily-sale-header bg-gradient-to-r from-slate-800 to-slate-700 p-3 text-white sm:p-4">
                    <div class="daily-sale-header-details">
                      <div class="daily-sale-detail-tile">
                        <span class="daily-sale-detail-label">
                          {{ $t('receiptNo') }}
                        </span>
                        <span class="daily-sale-receipt-number">
                          {{ sale.receiptno }}
                        </span>
                        <q-chip
                          dense
                          icon="sell"
                          text-color="white"
                          :color="statusColor(sale.status)"
                          class="daily-sale-status font-bold uppercase"
                        >
                          {{ sale.status }}
                        </q-chip>
                      </div>
                      <div class="daily-sale-detail-tile">
                        <span class="daily-sale-detail-label">{{ $t('distributorID') }}</span>
                        <span class="break-all font-semibold">{{ sale.distributoridno || '—' }}</span>
                        <span class="break-words text-slate-300">
                          {{ sale.distributorname || 'Fetching...' }}
                        </span>
                      </div>
                      <div class="daily-sale-detail-tile">
                        <span class="daily-sale-detail-label">Sale date</span>
                        <span class="font-semibold">{{ formatDateTime(sale.salesdate) }}</span>
                        <span class="daily-sale-detail-secondary">
                          {{ $t('lastmodified') }}: {{ formatDateTime(sale.lastmodified) }}
                        </span>
                        <span class="daily-sale-detail-secondary">
                          By {{ sale.createdby || 'Unknown' }}
                        </span>
                      </div>
                    </div>
                  </q-card-section>

                  <q-card-section class="daily-sale-products p-2 sm:p-3">
                    <div class="daily-sale-products-heading">
                      <div class="daily-sale-product-label">Product</div>
                      <div class="daily-sale-column-label">Qty</div>
                      <div class="daily-sale-column-label">Amount</div>
                      <div class="daily-sale-column-label">BV</div>
                    </div>
                    <div
                      v-for="(item, i) in sale.salesdetails"
                      :key="i"
                      class="daily-sale-product-row"
                    >
                      <div class="daily-sale-product-identity min-w-0">
                        <span class="daily-sale-product-code">{{ item.productcode || '—' }}</span>
                        <span class="daily-sale-product-name">
                          {{ item.productname || 'Fetching...' }}
                        </span>
                      </div>
                      <div class="daily-sale-metric">
                        <span class="daily-sale-mobile-label">Qty</span>
                        <span class="font-semibold">{{ item.quantity }}</span>
                      </div>
                      <div class="daily-sale-metric">
                        <span class="daily-sale-mobile-label">Amount</span>
                        <span class="font-semibold">
                          {{ (item.unitprice * item.quantity).toFixed(2) }}
                        </span>
                      </div>
                      <div class="daily-sale-metric daily-sale-bv">
                        <span class="daily-sale-mobile-label">BV</span>
                        <span class="font-semibold">{{ (item.unitbv * item.quantity).toFixed(2) }}</span>
                      </div>
                    </div>
                  </q-card-section>

                  <q-card-section class="daily-sale-totals px-2 pb-2 pt-0 sm:px-3 sm:pb-3">
                    <div class="daily-sale-total-tile daily-sale-total-primary">
                      <span>{{ $t('TotalPrice') }}</span>
                      <strong>{{ totalPrice(sale).toFixed(2) }} $</strong>
                    </div>
                    <div class="daily-sale-total-tile">
                      <span>Local total</span>
                      <strong>
                        <q-icon name="mdi-piggy-bank" size="18px" class="q-mr-xs" />
                        {{ (totalPrice(sale) * exchangeRate).toFixed(0) }}
                      </strong>
                    </div>
                    <div class="daily-sale-total-tile daily-sale-total-bv">
                      <span>{{ $t('totalBV') }}</span>
                      <strong>{{ totalBV(sale).toFixed(2) }}</strong>
                    </div>
                  </q-card-section>

                  <q-separator />
                  <q-card-section class="daily-sale-actions flex flex-wrap items-center justify-center gap-1 p-2 sm:justify-end">
                    <q-btn
                      v-if="isAdmin"
                      unelevated
                      no-caps
                      class="daily-sale-action-btn daily-sale-action-edit rounded-xl px-3 font-semibold transition"
                      label="Update"
                      icon="edit"
                      title="Edit receipt"
                      :aria-label="`Edit receipt ${sale.receiptno}`"
                      @click="
                        $router.push({ name: 'EditSale', params: { receiptno: sale.receiptno } })
                      "
                    />

                    <q-btn
                      v-if="isAdmin"
                      unelevated
                      no-caps
                      class="daily-sale-action-btn daily-sale-action-delete rounded-xl px-3 font-semibold transition"
                      icon="delete_outline"
                      label="Delete"
                      title="Delete receipt"
                      :aria-label="`Delete receipt ${sale.receiptno}`"
                      @click="confirmDeleteReceipt(sale)"
                    />

                    <q-btn
                      unelevated
                      no-caps
                      :icon="sale.status === 'pending' ? 'task_alt' : 'pending_actions'"
                      :label="sale.status === 'pending' ? $t('markCorrect') : $t('setPending')"
                      :class="[
                        'daily-sale-action-btn rounded-xl px-3 font-semibold transition',
                        sale.status === 'pending'
                          ? 'daily-sale-action-status-pending'
                          : 'daily-sale-action-status-complete',
                      ]"
                      :title="sale.status === 'pending' ? $t('markCorrect') : $t('setPending')"
                      :disable="sale.status === 'pending' && !isAdmin"
                      @click="toggleStatus(sale)"
                    />
                  </q-card-section>
                </q-card>
                <q-dialog v-model="editDialog">
                  <q-card style="min-width: 400px">
                    <q-card-section>
                      <div class="text-h6">{{ $t('EditReciept') }}</div>
                    </q-card-section>

                    <q-card-section>
                      <q-input
                        v-model="editForm.distributoridno"
                        label="Distributor ID"
                        dense
                        outlined
                      />
                      <q-input v-model="editForm.dpccode" label="DPC Code" dense outlined />
                      <q-input
                        v-model="editForm.salesdate"
                        label="Sales Date"
                        type="date"
                        dense
                        outlined
                      />
                      <!-- Product details would go here (table or list) -->
                    </q-card-section>

                    <q-card-actions align="right">
                      <q-btn flat label="Cancel" v-close-popup />
                      <q-btn color="primary" label="Save" @click="submitUpdate" />
                    </q-card-actions>
                  </q-card>
                </q-dialog>
              </div>
            </div>
          </template>

          <!-- Personal BV -->
          <template v-else-if="form.reportType === 'personalBV'">
            <q-banner
              v-if="!paginatedSales.length"
              class="bg-grey-2 text-center text-dark q-pa-md q-mt-md"
              rounded
            >
              <q-icon name="info" color="primary" size="md" class="q-mr-sm" />
              {{ $t('NoSales') }} {{ form.distributoridno || 'the selected distributor' }}.
            </q-banner>

            <div v-else>
              <div
                v-for="sale in paginatedSales"
                :key="sale.receiptno"
                class="daily-sale-card-wrap mt-4"
              >
                <q-card
                  flat
                  bordered
                  class="daily-sale-card overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm"
                >
                  <q-card-section
                    class="daily-sale-header bg-gradient-to-r from-slate-800 to-slate-700 p-3 text-white sm:p-4"
                  >
                    <div class="daily-sale-header-details">
                      <div class="daily-sale-detail-tile">
                        <span class="daily-sale-detail-label">{{ $t('receiptNo') }}</span>
                        <span class="daily-sale-receipt-number">{{ sale.receiptno }}</span>
                        <q-chip
                          dense
                          icon="sell"
                          text-color="white"
                          :color="statusColor(sale.status)"
                          class="daily-sale-status font-bold uppercase"
                        >
                          {{ sale.status }}
                        </q-chip>
                      </div>
                      <div class="daily-sale-detail-tile">
                        <span class="daily-sale-detail-label">{{ $t('distributorID') }}</span>
                        <span class="break-all font-semibold">{{ sale.distributoridno || '—' }}</span>
                        <span class="break-words text-slate-300">
                          {{ sale.distributorname || 'Fetching...' }}
                        </span>
                      </div>
                      <div class="daily-sale-detail-tile">
                        <span class="daily-sale-detail-label">Sale date</span>
                        <span class="font-semibold">{{ formatDateTime(sale.salesdate) }}</span>
                        <span class="daily-sale-detail-secondary">
                          {{ $t('lastmodified') }}: {{ formatDateTime(sale.lastmodified) }}
                        </span>
                        <span class="daily-sale-detail-secondary">
                          By {{ sale.createdby || 'Unknown' }}
                        </span>
                      </div>
                    </div>
                  </q-card-section>

                  <q-card-section class="daily-sale-products p-2 sm:p-3">
                    <div class="daily-sale-products-heading">
                      <div class="daily-sale-product-label">Product</div>
                      <div class="daily-sale-column-label">Qty</div>
                      <div class="daily-sale-column-label">Amount</div>
                      <div class="daily-sale-column-label">BV</div>
                    </div>
                    <div
                      v-for="(item, i) in sale.salesdetails || []"
                      :key="i"
                      class="daily-sale-product-row"
                    >
                      <div class="daily-sale-product-identity min-w-0">
                        <span class="daily-sale-product-code">{{ item?.productcode || 'N/A' }}</span>
                        <span class="daily-sale-product-name">
                          {{ item.productname || 'Fetching...' }}
                        </span>
                      </div>
                      <div class="daily-sale-metric">
                        <span class="daily-sale-mobile-label">Qty</span>
                        <span class="font-semibold">{{ item.quantity }}</span>
                      </div>
                      <div class="daily-sale-metric">
                        <span class="daily-sale-mobile-label">Amount</span>
                        <span class="font-semibold">
                          {{ (item.unitprice * item.quantity).toFixed(2) }}
                        </span>
                      </div>
                      <div class="daily-sale-metric daily-sale-bv">
                        <span class="daily-sale-mobile-label">BV</span>
                        <span class="font-semibold">
                          {{ (item.unitbv * item.quantity).toFixed(2) }}
                        </span>
                      </div>
                    </div>
                  </q-card-section>

                  <q-card-section class="daily-sale-totals px-2 pb-2 pt-0 sm:px-3 sm:pb-3">
                    <div class="daily-sale-total-tile daily-sale-total-primary">
                      <span>{{ $t('TotalPrice') }}</span>
                      <strong>{{ totalPrice(sale).toFixed(2) }} $</strong>
                    </div>
                    <div class="daily-sale-total-tile">
                      <span>Local total</span>
                      <strong>
                        <q-icon name="mdi-piggy-bank" size="18px" class="q-mr-xs" />
                        {{ (totalPrice(sale) * exchangeRate).toFixed(0) }}
                      </strong>
                    </div>
                    <div class="daily-sale-total-tile daily-sale-total-bv">
                      <span>{{ $t('totalBV') }}</span>
                      <strong>{{ totalBV(sale).toFixed(2) }}</strong>
                    </div>
                  </q-card-section>

                  <q-card-section
                    class="daily-sale-actions flex flex-wrap items-center justify-center gap-1 p-2 sm:justify-end"
                  >
                    <q-btn
                      v-if="isAdmin"
                      unelevated
                      no-caps
                      class="daily-sale-action-btn daily-sale-action-edit rounded-xl px-3 font-semibold transition"
                      label="Update"
                      icon="edit"
                      title="Edit receipt"
                      :aria-label="`Edit receipt ${sale.receiptno}`"
                      @click="
                        $router.push({ name: 'EditSale', params: { receiptno: sale.receiptno } })
                      "
                    />
                    <q-btn
                      v-if="isAdmin"
                      unelevated
                      no-caps
                      class="daily-sale-action-btn daily-sale-action-delete rounded-xl px-3 font-semibold transition"
                      icon="delete_outline"
                      :label="$t('delete')"
                      title="Delete receipt"
                      :aria-label="`Delete receipt ${sale.receiptno}`"
                      @click="confirmDeleteReceipt(sale)"
                    />
                    <q-btn
                      unelevated
                      no-caps
                      :icon="sale.status === 'pending' ? 'task_alt' : 'pending_actions'"
                      :label="sale.status === 'pending' ? $t('markCorrect') : $t('setPending')"
                      :class="[
                        'daily-sale-action-btn rounded-xl px-3 font-semibold transition',
                        sale.status === 'pending'
                          ? 'daily-sale-action-status-pending'
                          : 'daily-sale-action-status-complete',
                      ]"
                      :title="sale.status === 'pending' ? $t('markCorrect') : $t('setPending')"
                      :disable="sale.status === 'pending' && !isAdmin"
                      @click="toggleStatus(sale)"
                    />
                  </q-card-section>
                </q-card>
              </div>
            </div>
          </template>

          <!-- Tallies -->
          <template v-else-if="form.reportType === 'tallys'">
            <!-- Radio buttons for Daily / Monthly -->

            <q-card flat bordered class="q-mb-md bg-grey-1">
              <q-card-section class="row items-center justify-start q-gutter-sm flex-wrap">
                <q-radio
                  v-model="tallyType"
                  val="daily"
                  :label="$t('daily')"
                  color="green-10"
                  dense
                />

                <q-radio
                  v-model="tallyType"
                  val="monthly"
                  :label="$t('monthly')"
                  color="green-10"
                  dense
                />
                <!-- Debug raw store data -->
              </q-card-section>
            </q-card>

            <div class="tally-controls">
              <q-input
                v-model="tallyProductCodeFilter"
                dense
                outlined
                clearable
                :label="$t('productCodeFilter')"
                class="tally-filter-input"
              />
              <q-input
                v-model="tallyProductNameFilter"
                dense
                outlined
                clearable
                :label="$t('productNameFilter')"
                class="tally-filter-input"
              />
              <q-input
                v-model.number="tallyMinQuantity"
                dense
                outlined
                type="number"
                min="0"
                :label="$t('minQuantity')"
                class="tally-filter-input tally-quantity-filter"
              />
              <q-input
                v-model.number="tallyMaxQuantity"
                dense
                outlined
                type="number"
                min="0"
                :label="$t('maxQuantity')"
                class="tally-filter-input tally-quantity-filter"
              />
              <div class="tally-sort-tools">
                <label class="tally-sort-label" for="tally-sort-field">{{ $t('sortBy') }}</label>
                <select
                  id="tally-sort-field"
                  v-model="tallySortField"
                  class="custom-select reports-select native-select tally-sort-select"
                >
                  <option value="productcode">{{ $t('Productcode') }}</option>
                  <option value="productname">{{ $t('ProductName') }}</option>
                  <option value="quantity">{{ $t('Quantity') }}</option>
                  <option value="unitprice">{{ $t('DistributorPrice') }}</option>
                  <option value="bv">{{ $t('totalBV') }}</option>
                  <option value="amount">{{ $t('Amount') }}</option>
                </select>
                <q-btn
                  flat
                  round
                  dense
                  color="blue-grey-9"
                  :icon="tallySortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'"
                  :aria-label="
                    tallySortDirection === 'asc' ? $t('sortAscending') : $t('sortDescending')
                  "
                  :title="
                    tallySortDirection === 'asc' ? $t('sortAscending') : $t('sortDescending')
                  "
                  @click="tallySortDirection = tallySortDirection === 'asc' ? 'desc' : 'asc'"
                />
              </div>
            </div>

            <!-- Daily view -->
            <div v-if="tallyType === 'daily'">
              <div v-if="!filteredDailyTallies.length" class="text-center text-red q-mt-md">
                {{ $t('NoTallies') }}
              </div>

              <q-card
                v-for="day in filteredDailyTallies"
                :key="day.date"
                flat
                bordered
                class="tally-day-card q-mb-md"
              >
                <q-card-section class="text-bold">
                  {{ formatDateTime(day.date) }}
                </q-card-section>

                <q-table
                  :rows="day.items"
                  :columns="tallyColumns"
                  row-key="productcode"
                  dense
                  flat
                  separator="horizontal"
                  class="tally-table"
                >
                  <!-- Quantity highlight -->
                  <template #body-cell-quantity="props">
                    <q-td :props="props" class="text-blue-9 text-bold">
                      {{ props.value }}
                    </q-td>
                  </template>

                  <!-- Amount -->
                  <template #body-cell-amount="props">
                    <q-td :props="props">
                      {{ convert((props.row.unitprice * props.row.quantity).toFixed(2)) }}
                    </q-td>
                  </template>

                  <!-- Footer totals -->
                  <template #bottom>
                    <div class="tally-daily-footer">
                      <div class="tally-daily-footer-stats">
                        <div>
                          <span>Products:</span>
                        {{ day.items.reduce((s, i) => s + Number(i.quantity || 0), 0) }}
                        </div>
                        <div>
                          <span>BV:</span>
                          {{
                            day.items
                              .reduce((s, i) => s + Number(i.bvs || 0) * Number(i.quantity || 0), 0)
                              .toFixed(2)
                          }}
                        </div>
                      </div>
                      <div class="tally-daily-footer-total">
                        <span>Total</span>
                        <strong>
                          {{
                            convert(
                              day.items
                                .reduce(
                                  (s, i) =>
                                    s + Number(i.unitprice || 0) * Number(i.quantity || 0),
                                  0,
                                )
                                .toFixed(2),
                            )
                          }}
                        </strong>
                      </div>
                    </div>
                  </template>
                </q-table>
              </q-card>
            </div>

            <!-- Monthly view -->
            <div v-else-if="tallyType === 'monthly'">
              <div v-if="!filteredMonthlyTallies.length" class="text-center text-red q-mt-md">
                {{ $t('noMonthlyTallies') }}
              </div>

              <q-card
                v-else
                flat
                bordered
                class="q-mb-md"
                v-for="monthItem in filteredMonthlyTallies"
                :key="monthItem.month"
              >
                <q-card-section>
                  <!-- Month header -->
                  <div class="text-h6 text-bold text-primary q-mb-sm">
                    {{ monthItem.month }}
                  </div>

                  <q-table
                    :rows="monthItem.items"
                    :columns="monthlyColumns"
                    row-key="productcode"
                    dense
                    flat
                    separator="horizontal"
                    v-model:pagination="monthPagination"
                    :rows-per-page-options="[5, 10, 15, 0]"
                    class="tally-table"
                  >
                    <!-- Quantity -->
                    <template #body-cell-totalQuantity="props">
                      <q-td :props="props" align="right" class="text-blue-9 text-bold">
                        {{ props.value }}
                      </q-td>
                    </template>

                    <!-- Distributor Price -->
                    <template #body-cell-unitprice="props">
                      <q-td :props="props" align="right">
                        {{ convert(props.value.toFixed(2)) }}
                      </q-td>
                    </template>

                    <!-- BV -->
                    <template #body-cell-totalBvs="props">
                      <q-td :props="props" align="right">
                        {{ props.value.toFixed(2) }}
                      </q-td>
                    </template>

                    <!-- Amount -->
                    <template #body-cell-totalAmount="props">
                      <q-td :props="props" align="right">
                        {{ convert(props.value.toFixed(2)) }}
                      </q-td>
                    </template>

                    <!-- Footer Totals -->
                    <template #bottom>
                      <q-tr>
                        <q-td colspan="2" class="text-right text-bold">Totals:</q-td>
                        <q-td class="text-right text-bold">{{ monthItem.quantityTotal }}</q-td>
                        <q-td class="text-right text-bold">-</q-td>
                        <q-td class="text-right text-bold">{{
                          monthItem.bvsTotal.toFixed(2)
                        }}</q-td>
                        <q-td class="text-right text-bold">{{
                          convert(monthItem.amountTotal.toFixed(2))
                        }}</q-td>
                      </q-tr>
                    </template>
                  </q-table>
                </q-card-section>
              </q-card>
            </div>
          </template>

          <template v-else-if="form.reportType === 'sales'">
            <q-card flat bordered class="q-mb-md bg-grey-1">
              <!-- Report Header -->
              <q-card-section v-if="dailySalesTotals.length > 0" class="q-pa-sm bg-grey-2">
                <div class="row justify-between items-center">
                  <div>
                    <div><strong>Report Type:</strong> {{ form.reportType }}</div>
                    <div><strong>DPC:</strong> {{ shopName }}</div>
                  </div>
                  <div class="text-right">
                    <div><strong>Date:</strong> {{ currentDate }}</div>
                    <div><strong>User:</strong> {{ auth.userDetails.firstname }}</div>
                  </div>
                </div>
              </q-card-section>

              <!-- Daily Sales Totals -->
              <div v-if="!dailySalesTotals.length" class="text-center text-red q-mt-md">
                No sales found for the selected date range.
              </div>

              <q-card v-else flat bordered class="q-mb-md">
                <q-card-section>
                  <div class="table-responsive">
                    <table class="q-table q-mb-sm q-table--striped" style="width: 100%">
                      <thead>
                        <tr>
                          <th class="text-uppercase text-bold">{{ $t('Date') }}</th>
                          <th class="text-uppercase text-bold">{{ $t('TotalSales') }}</th>
                          <th class="text-uppercase text-bold">Top customer</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="day in dailySalesTotals" :key="day.date">
                          <td>{{ day.date }}</td>
                          <td>{{ convert(day.total.toFixed(2)) }}</td>
                          <td>
                            <span
                              v-if="salesStore.distributorDetailsLoading"
                              class="daily-top-customer-loading"
                              role="status"
                            >
                              <q-spinner size="16px" class="q-mr-xs" />
                              Loading customer…
                            </span>
                            <q-badge
                              v-else-if="day.topCustomer"
                              color="blue-grey-8"
                              class="daily-top-customer-badge q-pa-sm"
                            >
                              <div>
                                <div
                                  class="text-weight-bold top-customer-name"
                                  :title="day.topCustomer.name"
                                >
                                  {{ day.topCustomer.name || 'Name unavailable' }}
                                </div>
                                <div>ID: {{ day.topCustomer.distributoridno }}</div>
                                <div>Tel: {{ day.topCustomer.telephone || 'Not provided' }}</div>
                                <div>BV: {{ day.topCustomer.totalBV.toFixed(2) }}</div>
                              </div>
                            </q-badge>
                            <span v-else>—</span>
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr>
                          <td class="text-right text-bold">Grand Total:</td>
                          <td class="text-bold">
                            {{
                              convert(
                                dailySalesTotals.reduce((sum, d) => sum + d.total, 0).toFixed(2),
                              )
                            }}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </q-card-section>
              </q-card>

              <q-card
                v-if="monthlyTopCustomers.length"
                flat
                bordered
                class="q-mb-md"
              >
                <q-card-section>
                  <div
                    v-for="month in monthlyTopCustomers"
                    :key="month.month"
                    class="q-mb-md"
                  >
                    <div class="text-bold text-uppercase monthly-top-customers-title q-mb-xs">
                      Top 5 customers by BV — {{ month.month }}
                    </div>
                    <div class="table-responsive">
                      <table class="q-table q-table--striped" style="width: 100%">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Customer</th>
                            <th>ID</th>
                            <th>BV</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(c, i) in month.customers" :key="c.distributoridno">
                            <td>{{ i + 1 }}</td>
                            <td>
                              <div class="monthly-top-customer-name" :title="c.name">
                                {{ c.name || 'Name unavailable' }}
                              </div>
                            </td>
                            <td>{{ c.distributoridno }}</td>
                            <td>{{ c.totalBV.toFixed(2) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </q-card>
          </template>
          <template v-else-if="form.reportType === 'stock'">
            <q-card flat bordered class="q-mb-md bg-grey-1">
              <!-- Report Header -->
              <q-card-section v-if="stock.length > 0" class="q-pa-sm bg-grey-2">
                <div class="row justify-between items-center">
                  <div>
                    <div><strong>Report Type:</strong> {{ form.reportType }}</div>
                    <div><strong>DPC:</strong> {{ shopName }}</div>
                  </div>
                  <div class="text-right">
                    <div><strong>Date:</strong> {{ currentDate }}</div>
                    <div><strong>User:</strong> {{ auth.userDetails.firstname }}</div>
                  </div>
                </div>
              </q-card-section>

              <!-- Daily Sales Totals -->
              <div v-if="stockLoading" class="reports-loading-panel" role="status" aria-live="polite">
                <q-spinner-orbit color="blue-grey-8" size="36px" />
                <span>{{ $t('loadingReport') }}</span>
              </div>
              <q-banner
                v-else-if="stockError"
                class="bg-red-1 text-red-9 q-mt-md"
                rounded
                role="alert"
              >
                <q-icon name="error_outline" class="q-mr-sm" />
                {{ stockError }}
              </q-banner>
              <div v-else-if="!stock.length" class="text-center text-red q-mt-md">
                No stock found for the selected shop.
              </div>

              <q-card
                v-if="!stockLoading && !stockError && stock.length > 0"
                flat
                bordered
                class="q-mb-md"
              >
                <!-- FILTERS -->
                <q-card-section class="q-gutter-sm">
                  <q-option-group
                    v-model="stockFilter"
                    :options="[
                      { label: 'All', value: 'all' },
                      { label: 'Above 20', value: 'above20' },
                      { label: 'Below 5', value: 'below5' },
                    ]"
                    type="radio"
                    inline
                  />
                </q-card-section>

                <!-- TABLE -->
                <q-card-section>
                  <div>
                    <q-table
                      :rows="filteredStock"
                      :columns="columns2"
                      row-key="productcode"
                      flat
                      bordered
                      dense
                      separator="cell"
                      v-model:pagination="stockPagination"
                      :sort-method="sortStockRows"
                      class="stock-table"
                    >
                      <!-- 🔥 ENHANCED HEADER (replaces title) -->
                      <template #top>
                        <div class="column full-width q-pb-sm">
                          <!-- Title row -->
                          <div class="row justify-between items-center">
                            <div class="text-h6">Stock Summary</div>

                            <div class="text-subtitle2 text-grey-7">
                              {{ currentDate }}
                            </div>
                          </div>

                          <!-- Info row -->
                          <div class="row justify-between items-center q-mt-xs">
                            <div class="text-subtitle2 text-primary">
                              <q-icon name="store" size="16px" class="q-mr-xs" />
                              {{ shopName }} ({{ form.dpccode }})
                            </div>

                            <div class="text-subtitle2">
                              <q-icon name="person" size="16px" class="q-mr-xs" />
                              {{ auth.userDetails.firstname }}
                            </div>
                          </div>
                        </div>
                      </template>

                      <!-- ✅ Quantity cell color logic (UNCHANGED) -->
                      <template #body-cell-quantity="props">
                        <q-td :props="props" :class="rowColor(props.row.quantity)">
                          {{ props.row.quantity }}
                        </q-td>
                      </template>

                      <!-- ✅ Product name wrap (UNCHANGED) -->
                      <template #body-cell-productname="props">
                        <q-td :props="props">
                          <div class="product-wrap">
                            {{ props.row.productname }}
                          </div>
                        </q-td>
                      </template>

                      <!-- ✅ Footer totals (UNCHANGED) -->
                      <template #bottom-row>
                        <q-tr>
                          <q-td colspan="3" class="text-right text-bold">Grand Totals:</q-td>
                          <q-td class="text-bold">
                            {{ convert(stockTotals.totalDpValue.toFixed(2)) }}
                          </q-td>
                          <q-td class="text-bold">
                            {{ stockTotals.totalBvValue.toFixed(2) }}
                          </q-td>
                        </q-tr>
                      </template>
                    </q-table>
                  </div>
                </q-card-section>
              </q-card>
            </q-card>
          </template>
          <template v-if="form.reportType === 'queriedSales'">
            <!-- Exporter -->

            <!-- No Records Banner -->
            <div v-if="!paginatedSales.length" class="q-mt-lg">
              <q-banner dense rounded class="bg-grey-3 text-grey-8 text-center q-pa-sm">
                <q-icon name="info" color="primary" size="20px" class="q-mr-sm" />
                {{ $t('noRecordsFound') }}
              </q-banner>
            </div>

            <!-- Sales List -->
            <div v-else>
              <div v-for="sale in paginatedSales" :key="sale.receiptno" class="q-mt-md">
                <q-card flat bordered style="border-radius: 30px">
                  <!-- Section 1: Receipt & Date -->
                  <q-card-section class="row justify-between items-center">
                    <div class="text-subtitle2 text-bold text-green-14">
                      <b>{{ $t('receiptNo') }}:</b> {{ sale.receiptno }}
                    </div>
                    <div class="text-subtitle2">
                      <b>{{ $t('saleDate') }}:</b> {{ formatDateTime(sale.salesdate) }}
                    </div>
                  </q-card-section>

                  <!-- Section 2: Distributor info & status -->
                  <q-card-section class="row justify-between items-center q-pt-xs q-pb-xs">
                    <div class="column">
                      <div>
                        <b>{{ $t('distributorID') }}:</b> {{ sale.distributoridno }}
                      </div>
                      <div class="text-red-9 text-bold">
                        <b>{{ $t('name') }}:</b> {{ sale.distributorname || 'Fetching...' }}
                      </div>
                      <div class="text-orange-14">
                        {{ $t('lastmodified') }}: {{ formatDateTime(sale.lastmodified) }}
                      </div>
                    </div>
                    <div>
                      <q-chip :color="statusColor(sale.status)" text-color="white" class="q-mb-xs">
                        {{ sale.status }}
                      </q-chip>
                    </div>
                  </q-card-section>

                  <q-separator />

                  <!-- Section 3: Products -->
                  <q-card-section class="q-pa-xs">
                    <div
                      v-for="(item, i) in sale.salesdetails"
                      :key="i"
                      class="row items-center no-wrap q-mb-xs"
                      style="font-size: var(--product-font-size)"
                    >
                      <div class="col-2 text-truncate">{{ item.productcode }}</div>
                      <div class="col-5 text-truncate" style="min-width: 0">
                        {{ item.productname || 'Fetching...' }}
                      </div>
                      <div class="col-1 text-right">{{ item.quantity }}</div>
                      <div class="col-2 text-right">
                        {{ (item.unitprice * item.quantity).toFixed(2) }}
                      </div>
                      <div class="col-2 text-right">
                        {{ (item.unitbv * item.quantity).toFixed(2) }}
                      </div>
                    </div>
                  </q-card-section>

                  <q-separator />

                  <!-- Section 4: Totals -->
                  <q-card-section class="row items-center justify-between q-pt-xs q-pb-xs no-wrap">
                    <div
                      class="row items-center justify-between q-gutter-md no-wrap"
                      style="width: 100%"
                    >
                      <div class="flex-grow">
                        <b>{{ $t('TotalPrice') }}</b> {{ totalPrice(sale).toFixed(2) }} $
                      </div>
                      <div
                        class="flex-grow text-blue-10 text-bold text-center"
                        style="flex: 1 1 auto; min-width: 0"
                      >
                        <q-icon name="mdi-piggy-bank" size="18px" class="q-mr-xs" />
                        {{ (totalPrice(sale) * exchangeRate).toFixed(0) }}
                      </div>
                      <div
                        class="flex-grow text-orange-10 text-right"
                        style="flex: 1 1 auto; min-width: 0"
                      >
                        <b>{{ $t('totalBV') }}:</b> {{ totalBV(sale).toFixed(2) }}
                      </div>
                    </div>
                  </q-card-section>

                  <q-separator />

                  <!-- Section 5: Actions -->
                  <q-card-section class="row justify-center items-center q-pt-xs q-pb-xs">
                    <div class="row justify-evenly items-center full-width q-gutter-xs wrap">
                      <q-btn
                        v-if="isAdmin"
                        flat
                        no-caps
                        color="orange"
                        label="Update"
                        icon="edit_note"
                        @click="
                          $router.push({ name: 'EditSale', params: { receiptno: sale.receiptno } })
                        "
                      />
                      <q-btn
                        v-if="isAdmin"
                        flat
                        no-caps
                        color="red"
                        icon="delete"
                        label="Delete"
                        @click="confirmDeleteReceipt(sale)"
                      />
                      <q-btn
                        flat
                        no-caps
                        :color="sale.status === 'pending' ? 'red' : 'green'"
                        :icon="sale.status === 'pending' ? 'check_circle' : 'warning'"
                        :label="sale.status === 'pending' ? $t('markCorrect') : $t('setPending')"
                        :disable="sale.status === 'pending' && !isAdmin"
                        @click="toggleStatus(sale)"
                      />
                    </div>
                  </q-card-section>
                </q-card>
              </div>
            </div>
          </template>
          <template v-if="form.reportType === 'bestCustomers'">
            <!-- Export -->

            <!-- Empty State -->
            <div v-if="!sortedCustomers.length" class="q-mt-lg">
              <q-banner dense rounded class="bg-grey-3 text-grey-8 text-center q-pa-sm">
                <q-icon name="info" color="primary" size="20px" class="q-mr-sm" />
                {{ $t('noRecordsFound') }}
              </q-banner>
            </div>

            <!-- Report Table -->
            <div v-else class="q-mt-md">
              <!-- Report Info Header -->
              <q-card flat bordered class="q-pa-md q-mb-md" style="border-radius: 20px">
                <div class="row justify-between">
                  <div>
                    <div>
                      <b>{{ $t('dateRange') }}:</b> {{ form.startDate }} — {{ form.endDate }}
                    </div>
                    <div>
                      <b>{{ $t('currentUser') }}:</b>
                      {{ auth.userDetails?.name || auth.userDetails?.firstname }}
                    </div>
                  </div>
                  <div>
                    <div><b>DPC:</b> {{ isAdmin ? form.dpccode : auth.userDetails?.dpc_id }}</div>
                  </div>
                </div>
              </q-card>

              <!-- 🏆 Best Customers Table -->
              <q-table
                :rows="sortedCustomers"
                :columns="columns"
                row-key="DistributorIDNO"
                flat
                bordered
                dense
                class="shadow-2 rounded-borders"
              >
                <!-- 🥇 Position Column -->
                <template v-slot:body-cell-position="props">
                  <q-td class="text-center text-bold">
                    {{ props.pageIndex + 1 }}
                  </q-td>
                </template>

                <!-- 🟢 Dot Column (BV Indicator) -->
                <template v-slot:body-cell-bvIndicator="props">
                  <q-td class="text-center">
                    <q-icon name="flag" :color="bvColor(props.row.TotalBV)" size="14px" />
                  </q-td>
                </template>

                <!-- TotalBV Column -->
                <template v-slot:body-cell-TotalBV="props">
                  <q-td class="text-right">
                    {{ Number(props.row.TotalBV).toFixed(2) }}
                  </q-td>
                </template>
              </q-table>
            </div>
          </template>

          <template v-if="summaryTotals">
            <div
              v-if="form.reportType !== 'personalBV'"
              class="text-h6 text-bold text-black q-mb-sm"
            >
              {{ summaryTotals.label }}
            </div>
            <!-- Daily Sales -->
            <div
              v-if="form.reportType === 'dailySales'"
              class="q-mb-sm row justify-end items-center"
            >
              <div class="text-subtitle1 text-bold text-black">Total Amount</div>
              <div class="currency-display text-bold text-light-green-14 q-ml-sm">
                <span class="amount">{{ convert(summaryTotals.totalAmount.toFixed(2)) }}</span>
              </div>
              <div class="q-ml-lg text-subtitle1 text-bold text-black">Total BV</div>
              <div class="currency-display text-bold text-light-green-14 q-ml-sm">
                <span class="amount">{{ summaryTotals.totalBv.toFixed(2) }}</span>
              </div>
            </div>

            <!-- Personal BV -->
            <div
              v-else-if="form.reportType === 'personalBV'"
              class="personal-summary-grid"
            >
              <div class="personal-summary-card">
                <span class="personal-summary-label">{{ $t('totalPersonalSales') }}</span>
                <strong class="personal-summary-value">
                  {{ convert(Number(personalTotalSales || 0).toFixed(2)) }}
                </strong>
              </div>
              <div class="personal-summary-card">
                <span class="personal-summary-label">{{ $t('totalPersonalBV') }}</span>
                <strong class="personal-summary-value">
                  {{ Number(personalTotalBV || 0).toFixed(2) }}
                </strong>
              </div>
              <div class="personal-summary-card">
                <span class="personal-summary-label">{{ $t('activeLegs') }}</span>
                <strong v-if="activeLegLoading" class="personal-summary-value personal-summary-loading">
                  <q-spinner size="14px" class="q-mr-xs" />
                  {{ $t('calculating') }}
                </strong>
                <strong v-else-if="activeLegCount !== null" class="personal-summary-value">
                  {{ activeLegCount }}
                </strong>
                <strong v-else class="personal-summary-value">—</strong>
              </div>
            </div>

            <!-- Sales -->
            <div
              v-else-if="form.reportType === 'sales'"
              class="q-mb-sm row justify-end items-center"
            >
              <div class="text-subtitle1 text-bold text-black">Total Sales</div>
              <div class="currency-display text-bold text-light-green-14 q-ml-sm">
                <span class="amount">{{ convert(summaryTotals.totalSales.toFixed(2)) }}</span>
              </div>
            </div>

            <!-- Tallys -->
            <div
              v-else-if="form.reportType === 'tallys'"
              class="tally-summary-total q-mb-sm"
            >
              <span class="tally-summary-label">
                {{ tallyType === 'daily' ? 'Tally Total' : 'Total Amount' }}
              </span>
              <strong class="tally-summary-value">
                {{ convert(summaryTotals.totalAmount.toFixed(2)) }}
              </strong>
            </div>
          </template>
      </q-card-section>
      </template>
      </CurrencyToggle>
    </q-card>
  </q-page>
</template>

<script setup>
// Dependencies for report data, routing, and shared UI.
import { ref, reactive, onMounted, computed, watch, nextTick } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useAuth } from 'stores/auth'
import { useSaleStore } from '../stores/storeSales'
import { supabase } from 'boot/supabase'
import { useSalesStore } from '../stores/salesStore'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import DistributorSearch from 'components/DistributorSearch.vue'
import CurrencyToggle from '../components/currencyTogle.vue'
import reportExporter from 'src/components/ExporterComponent.vue'

// Optional: icon logic (you can keep it same or change)
//const bvIcon = (bv) => 'mdi-star-circle'

// Shared stores, form values, and reactive report state.
const auth = useAuth()
const salesStore = useSaleStore()
const store = useSalesStore()
const $q = useQuasar()
const { t: $t, locale } = useI18n()
const userRole = ref('')
const dpcOptions = ref([])
const editDialog = ref(false)
const editForm = ref({})
const tallyType = ref('daily') // default daily
const tallyProductCodeFilter = ref('')
const tallyProductNameFilter = ref('')
const tallyMinQuantity = ref(null)
const tallyMaxQuantity = ref(null)
const tallySortField = ref('productcode')
const tallySortDirection = ref('asc')
const reportLoading = ref(false)
const reportDataReady = ref(false)
const activeLegCount = ref(null)
const activeLegLoading = ref(false)
const activeLegRequestId = ref(0)
const pendingCount = ref(0)
const pendingLoading = ref(false)

// Count pending receipts for the currently selected shop and dates.
const fetchPendingCount = async () => {
  if (!form.dpccode || !form.startDate || !form.endDate) return

  pendingLoading.value = true

  try {
    const { count, error } = await supabase
      .from('salesheader')
      .select('*', { count: 'exact', head: true })
      .eq('dpccode', form.dpccode)
      .eq('status', 'pending')
      .gte('salesdate', form.startDate)
      .lte('salesdate', form.endDate)

    if (error) throw error

    pendingCount.value = count || 0
  } catch (err) {
    console.error('Pending count error:', err.message)
    pendingCount.value = 0
  } finally {
    pendingLoading.value = false
  }
}

// Pagination for monthly table
const monthPagination = ref({
  page: 1,
  rowsPerPage: 5, // default rows per page
  rowsNumber: 0, // total rows, will set dynamically
})

watch(
  [
    tallyProductCodeFilter,
    tallyProductNameFilter,
    tallyMinQuantity,
    tallyMaxQuantity,
    tallySortField,
    tallySortDirection,
    tallyType,
  ],
  () => {
    monthPagination.value.page = 1
  },
)

// Columns for monthly q-table
const monthlyColumns = [
  {
    name: 'productcode',
    label: $t('Productcode'),
    field: 'productcode',
    required: true,
    align: 'left',
    classes: 'tally-code-cell',
    headerClasses: 'tally-code-cell',
    style: 'width: 14%;',
    headerStyle: 'width: 14%;',
  },
  {
    name: 'productname',
    label: $t('ProductName'),
    field: 'productname',
    required: true,
    align: 'left',
    classes: 'tally-product-name-cell',
    headerClasses: 'tally-product-name-cell',
    style: 'width: 32%;',
    headerStyle: 'width: 32%;',
  },
  {
    name: 'totalQuantity',
    label: $t('Quantity'),
    field: 'totalQuantity',
    required: true,
    align: 'right',
    classes: 'tally-number-cell',
    headerClasses: 'tally-number-cell',
    style: 'width: 12%;',
    headerStyle: 'width: 12%;',
  },
  {
    name: 'unitprice',
    label: $t('DistributorPrice'),
    field: 'unitprice',
    align: 'right',
    classes: 'tally-number-cell',
    headerClasses: 'tally-number-cell',
    style: 'width: 14%;',
    headerStyle: 'width: 14%;',
  },
  {
    name: 'totalBvs',
    label: 'BV',
    field: 'totalBvs',
    align: 'right',
    classes: 'tally-number-cell',
    headerClasses: 'tally-number-cell',
    style: 'width: 12%;',
    headerStyle: 'width: 12%;',
  },
  {
    name: 'totalAmount',
    label: $t('Amount'),
    field: 'totalAmount',
    align: 'right',
    classes: 'tally-number-cell',
    headerClasses: 'tally-number-cell',
    style: 'width: 16%;',
    headerStyle: 'width: 16%;',
  },
]

// Number formatting helper
//function convert(val) {
// return Number(val).toLocaleString()
//}
const tallyColumns = [
  {
    name: 'productcode',
    label: $t('Productcode'),
    field: 'productcode',
    required: true,
    align: 'left',
    classes: 'tally-code-cell',
    headerClasses: 'tally-code-cell',
    style: 'width: 14%;',
    headerStyle: 'width: 14%;',
  },
  {
    name: 'productname',
    label: $t('ProductName'),
    field: 'productname',
    required: true,
    align: 'left',
    classes: 'tally-product-name-cell',
    headerClasses: 'tally-product-name-cell',
    style: 'width: 32%;',
    headerStyle: 'width: 32%;',
  },
  {
    name: 'quantity',
    label: $t('Quantity'),
    field: 'quantity',
    required: true,
    align: 'right',
    classes: 'tally-number-cell',
    headerClasses: 'tally-number-cell',
    style: 'width: 12%;',
    headerStyle: 'width: 12%;',
  },
  {
    name: 'unitprice',
    label: $t('DistributorPrice'),
    field: 'unitprice',
    align: 'right',
    classes: 'tally-number-cell',
    headerClasses: 'tally-number-cell',
    style: 'width: 14%;',
    headerStyle: 'width: 14%;',
  },
  {
    name: 'bvs',
    label: 'BV',
    field: 'bvs',
    align: 'right',
    classes: 'tally-number-cell',
    headerClasses: 'tally-number-cell',
    style: 'width: 12%;',
    headerStyle: 'width: 12%;',
  },
  {
    name: 'amount',
    label: $t('Amount'),
    field: 'amount',
    align: 'right',
    classes: 'tally-number-cell',
    headerClasses: 'tally-number-cell',
    style: 'width: 16%;',
    headerStyle: 'width: 16%;',
  },
]

const fromReceipt = ref('')
const toReceipt = ref('')

const getFirstDayOfMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}
// Get last day of current month
const getLastDayOfMonth = () => {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
}
const form = reactive({
  startDate: localStorage.getItem('reportStartDate') || getFirstDayOfMonth(),
  endDate: localStorage.getItem('reportEndDate') || getLastDayOfMonth(),
  dpccode: localStorage.getItem('reportDpccode') || '', // 🔹 load last selected DPC
  reportType: '',
  distributoridno: '',
})
// Current date & time
const currentDateTime = new Date()
const currentDate = currentDateTime.toLocaleString()
const loginDateTime = currentDateTime
const selectedReportTitle = computed(
  () => reportOptions.value.find((option) => option.value === form.reportType)?.label || '',
)

// radio selection
const stockFilter = ref('all')
const stock = ref([]) // raw stock from Supabase
const stockPagination = ref({
  sortBy: null,
  descending: false,
  page: 1,
  rowsPerPage: 0,
})
const stockLoading = ref(false)
const stockError = ref('')
const stockTotals = ref({
  totalDpValue: 0,
  totalBvValue: 0,
})

// Load stock records and enrich them with product values.
const fetchStock = async (dpccode = form.dpccode) => {
  if (!dpccode) {
    throw new Error('No DPC selected. Select a shop before fetching current stock.')
  }

  const tableName = `${dpccode}_STOCK`
  stockLoading.value = true
  stockError.value = ''
  stock.value = []
  stockTotals.value = { totalDpValue: 0, totalBvValue: 0 }

  try {
    // 1) Fetch stock
    const { data: stockData, error: stockError } = await supabase
      .from(tableName)
      .select('productcode, productname, quantity')
      .order('productname', { ascending: true })

    if (stockError) throw stockError

    if (!stockData || !stockData.length) {
      stock.value = []
      stockTotals.value = { totalDpValue: 0, totalBvValue: 0 }
      return
    }

    // 2) Prepare reactivity (VERY IMPORTANT)
    // Create baseline with all fields so Vue tracks dpValue & bvValue
    stock.value = stockData.map((item) => ({
      productcode: item.productcode,
      productname: item.productname,
      quantity: Number(item.quantity) || 0,

      // predefine these fields for Vue reactivity
      distributorprice: 0,
      bvs: 0,
      dpValue: 0,
      bvValue: 0,
    }))

    // 3) Get productcodes
    const productCodes = stockData.map((i) => i.productcode)

    // 4) Fetch distributorprice & bvs from products table
    let productsData = []
    if (productCodes.length) {
      const { data, error: prodError } = await supabase
        .from('products')
        .select('productcode, distributorprice, bvs')
        .in('productcode', productCodes)

      if (prodError) throw prodError
      productsData = data || []
    }

    // 5) Build lookup
    const productLookup = {}
    productsData.forEach((p) => {
      productLookup[p.productcode] = p
    })

    // 6) Totals
    let totalDpValue = 0
    let totalBvValue = 0

    // 7) Merge into reactive stock array
    stock.value = stock.value.map((item) => {
      const productInfo = productLookup[item.productcode] || {}

      const distributorprice = Number(productInfo.distributorprice) || 0
      const bvs = Number(productInfo.bvs) || 0
      const qty = Number(item.quantity) || 0

      const dpValue = distributorprice * qty
      const bvValue = bvs * qty

      totalDpValue += dpValue
      totalBvValue += bvValue

      return {
        ...item,
        distributorprice,
        bvs,
        dpValue,
        bvValue,
      }
    })

    // 8) Save totals
    stockTotals.value = {
      totalDpValue,
      totalBvValue,
    }
  } catch (err) {
    console.error(`Failed to load stock for ${tableName}:`, err)
    stockError.value = `Failed to load stock for ${dpccode}: ${err.message}`
    throw err
  } finally {
    stockLoading.value = false
  }
}

// FILTER + SORT
const filteredStock = computed(() => {
  let result = [...stock.value]

  if (stockFilter.value === 'above20') {
    result = result.filter((item) => item.quantity > 20)
  } else if (stockFilter.value === 'below5') {
    result = result.filter((item) => item.quantity < 5)
  }

  return result.sort((a, b) => a.quantity - b.quantity)
})

const permissions = computed(() => {
  const role = auth.userDetails?.role

  return {
    canSelectDpc: ['Admin', 'SuperAdmin', 'User2'].includes(role),
    isAdmin: ['Admin', 'SuperAdmin'].includes(role),
  }
})

const rowColor = (qty) => {
  if (qty <= 20) return 'row-red'
  if (qty <= 50) return 'row-orange'
  if (qty <= 100) return 'row-green'
  return ''
}

// -------------------------------------------
// WATCH DPC CODE → REFETCH WHEN IT CHANGES
// -------------------------------------------
watch(
  () => form.dpccode,
  async (newDpccode, oldDpccode) => {
    if (newDpccode && newDpccode !== oldDpccode && form.reportType === 'stock') {
      try {
        await fetchStock(newDpccode)
      } catch (err) {
        $q.notify({ type: 'negative', message: stockError.value || err.message })
      }
    }
  },
)

// Persist the selected shop and refresh its pending count when filters change.
watch(
  () => form.dpccode,
  (newVal) => {
    if (newVal) {
      localStorage.setItem('reportDpccode', newVal)
    }
  },
)

watch(
  () => [form.dpccode, form.startDate, form.endDate],
  () => {
    fetchPendingCount()
  },
  { immediate: true },
)
// Derived values and display helpers for report results.
const exchangeRate = computed(() => store.headerData.exchangeRate)
//const isAdmin = computed(() => ['Admin', 'SuperAdmin'].includes(auth.userDetails?.role))
const isAdmin = computed(() => ['Admin', 'SuperAdmin'].includes(auth.userDetails?.role))
const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')

// Status color mapping
const statusColor = (status) => {
  switch (status) {
    case 'pending':
      return 'green-10'
    case 'complete':
      return 'orange-10'
    case 'correct':
      return 'light-green-14'
    default:
      return 'grey'
  }
}
// Computed totals for personal BV
const personalTotalSales = computed(() =>
  salesStore.sales.reduce(
    (acc, sale) =>
      acc + sale.salesdetails.reduce((sum, item) => sum + item.unitprice * item.quantity, 0),
    0,
  ),
)
// Personal BV total
const personalTotalBV = computed(() =>
  salesStore.sales.reduce(
    (acc, sale) =>
      acc + sale.salesdetails.reduce((sum, item) => sum + item.unitbv * item.quantity, 0),
    0,
  ),
)

// Access data from store
const sortedCustomers = computed(() => salesStore.bestCustomers || [])

const columns = [
  {
    name: 'position',
    label: '#',
    field: 'position',
    align: 'center',
    sortable: false,
  },
  {
    name: 'bvIndicator',
    label: '',
    field: 'bvIndicator',
    align: 'center',
    sortable: false,
  },
  {
    name: 'DistributorNames',
    label: 'Distributor',
    field: 'DistributorNames',
    align: 'left',
    sortable: true,
  },
  {
    name: 'DistributorTelephone',
    label: 'Telephone',
    field: 'DistributorTelephone',
    align: 'left',
  },
  {
    name: 'TotalBV',
    label: 'Total BV',
    field: 'TotalBV',
    align: 'right',
    sortable: true,
  },
]

const columns2 = [
  {
    name: 'productcode',
    label: 'Code',
    field: 'productcode',
    align: 'left',
    sortable: true,
  },
  {
    name: 'productname',
    label: 'Product',
    field: 'productname',
    align: 'left',
    sortable: true,
  },
  {
    name: 'quantity',
    label: 'Qty',
    field: 'quantity',
    align: 'center',
    sortable: true,
  },
  {
    name: 'dpValue',
    label: 'DP Value',
    field: (row) => row.dpValue.toFixed(2),
    align: 'right',
    sortable: true,
  },
  {
    name: 'bvValue',
    label: 'BV Value',
    field: (row) => row.bvValue.toFixed(2),
    align: 'right',
    sortable: true,
  },
]

const sortStockRows = (rows, sortBy, descending) => {
  const column = columns2.find((item) => item.name === sortBy)
  if (!column || column.field === undefined) return rows

  const direction = descending ? -1 : 1
  const getValue =
    typeof column.field === 'function' ? (row) => column.field(row) : (row) => row[column.field]

  return [...rows].sort((firstRow, secondRow) => {
    let first = getValue(firstRow)
    let second = getValue(secondRow)

    if (first === null || first === undefined) return -1 * direction
    if (second === null || second === undefined) return 1 * direction
    if (
      typeof first === 'number' &&
      isFinite(first) &&
      typeof second === 'number' &&
      isFinite(second)
    ) {
      return (first - second) * direction
    }
    if (typeof first === 'boolean' && typeof second === 'boolean') {
      return (Number(first) - Number(second)) * direction
    }

    first = (first + '').toLocaleString().toLowerCase()
    second = (second + '').toLocaleString().toLowerCase()
    return first < second ? -1 * direction : first === second ? 0 : direction
  })
}

const stockExportRows = computed(() => {
  const { sortBy, descending } = stockPagination.value
  return sortBy ? sortStockRows(filteredStock.value, sortBy, descending) : filteredStock.value
})

// BV color logic
const bvColor = (bv) => {
  if (bv > 60) return 'green-8'
  if (bv > 20) return 'orange-8'
  return 'red-8'
}

// Watch user role changes
watch(
  () => auth.userDetails,
  (newVal) => {
    if (newVal) {
      userRole.value = newVal.dpc_id
    }
  },
  { immediate: true },
)
//Watch to clear distributor ID when report type changes
watch(
  () => form.reportType,
  (newVal) => {
    console.log('Report type changed to:', newVal)
    reportDataReady.value = false
    activeLegCount.value = null
    activeLegLoading.value = false
    activeLegRequestId.value += 1
    if (newVal === 'personalBV') {
      form.distributoridno = auth.userDetails?.idno || ''
    } else {
      form.distributoridno = ''
    }
  },
)
// Invalidate active-leg results whenever their query inputs change.
watch(
  () => [form.distributoridno, form.startDate, form.endDate],
  () => {
    if (!activeLegLoading.value) return

    activeLegRequestId.value += 1
    activeLegCount.value = null
    activeLegLoading.value = false
  },
)
//watch to store dates in localStorage
watch(
  () => [form.startDate, form.endDate, form.dpccode],
  ([newStart, newEnd, newDpc]) => {
    localStorage.setItem('reportStartDate', newStart)
    localStorage.setItem('reportEndDate', newEnd)
    localStorage.setItem('reportDpccode', newDpc)
    console.log('Stored dpccode:', localStorage.getItem('reportDpccode'))
  },
)

// watch for reportType change
// Watch for report type changes and clear previous results
watch(
  () => form.reportType,
  (newVal) => {
    // Clear the underlying store data
    salesStore.sales = []
    salesStore.talliesRaw = []

    // Reset pagination
    currentPage.value = 1

    // Clear distributor ID if switching from personalBV
    if (newVal === 'personalBV') {
      form.distributoridno = auth.userDetails?.idno || ''
    } else {
      form.distributoridno = ''
    }
  },
)

// Preserve report filters while navigating to and from receipt editing.
const REPORT_RESTORE_KEY = 'reports-restore'
const REPORT_RESTORE_MAX_AGE_MS = 30 * 60 * 1000

// Remember the report being viewed so it can be rebuilt after editing a receipt
onBeforeRouteLeave((to) => {
  if (to.name === 'EditSale' && form.reportType) {
    sessionStorage.setItem(
      REPORT_RESTORE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        reportType: form.reportType,
        distributoridno: form.distributoridno,
        startDate: form.startDate,
        endDate: form.endDate,
        dpccode: form.dpccode,
      }),
    )
  }
})

async function restoreReportState() {
  let saved = null
  try {
    saved = JSON.parse(sessionStorage.getItem(REPORT_RESTORE_KEY) || 'null')
  } catch {
    saved = null
  }
  sessionStorage.removeItem(REPORT_RESTORE_KEY)

  if (!saved || Date.now() - saved.savedAt > REPORT_RESTORE_MAX_AGE_MS) return
  if (!reportOptions.value.some((option) => option.value === saved.reportType)) return

  form.startDate = saved.startDate
  form.endDate = saved.endDate
  if (dpcOptions.value.some((o) => o.value === saved.dpccode)) form.dpccode = saved.dpccode
  form.reportType = saved.reportType

  // The reportType watchers reset the distributor ID, so set it after they have run
  await nextTick()
  form.distributoridno = saved.distributoridno || ''

  await fetchData()
}

// Responsive font size for products
const productFontSize = ref('14px')
// Load shop choices, responsive sizing, and any previously viewed report.
onMounted(async () => {
  // --- Load exchange rate ---
  store.fetchExchangeRate()

  // --- Responsive font size ---
  const updateFontSize = () => {
    productFontSize.value = window.innerWidth < 400 ? '10px' : '14px'
  }
  updateFontSize()
  window.addEventListener('resize', updateFontSize)

  try {
    const role = auth.userDetails?.role
    const provinceCode = auth.userDetails?.province_code
    const userDpc = auth.userDetails?.dpc_id

    let data = []
    let error = null

    // --- Fetch DPCs based on role ---
    if (role === 'SuperAdmin') {
      ;({ data, error } = await supabase
        .from('shops')
        .select('shopcode, shop_name, province_code, country_code')
        .order('shop_name'))
    } else if (role === 'Admin' || role === 'User2') {
      ;({ data, error } = await supabase
        .from('shops')
        .select('shopcode, shop_name')
        .eq('province_code', provinceCode)
        .order('shop_name'))
    }

    if (error) throw error

    if (role === 'SuperAdmin' || role === 'Admin' || role === 'User2') {
      // Populate dropdown
      dpcOptions.value = (data || []).map((d) => ({
        label: d.shop_name,
        value: d.shopcode,
      }))

      // Preselect stored DPC if valid
      const storedDPC = localStorage.getItem('reportDpccode')
      if (storedDPC && dpcOptions.value.some((o) => o.value === storedDPC)) {
        form.dpccode = storedDPC
      } else {
        // Otherwise select first DPC by default
        form.dpccode = dpcOptions.value[0]?.value || ''
      }
    } else {
      // Regular user: only their DPC
      dpcOptions.value = [
        {
          label: auth.userDetails?.dpcname || 'My DPC',
          value: userDpc,
        },
      ]
      form.dpccode = userDpc
    }
  } catch (err) {
    console.error('Error loading DPCs:', err.message)
    $q.notify({
      type: 'negative',
      message: 'Failed to load DPCs: ' + err.message,
    })
    return
  }

  await restoreReportState()
})

// Fetch supplementary active-leg metrics for personal BV reports.
const fetchActiveLegCount = async (distributorId, dateFrom, dateTo) => {
  const requestId = ++activeLegRequestId.value
  activeLegCount.value = null
  activeLegLoading.value = true

  try {
    const { data, error } = await supabase.rpc('get_manager_leg_volumes', {
      p_upline_code: distributorId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    })

    if (error) throw error
    if (requestId !== activeLegRequestId.value) return

    activeLegCount.value = (data || []).filter((leg) => Number(leg.group_bv) >= 600).length
  } catch (error) {
    console.error('Active leg count fetch error:', error)
    if (requestId === activeLegRequestId.value) {
      $q.notify({
        type: 'negative',
        message: error.message || $t('activeLegLoadFailed'),
      })
    }
  } finally {
    if (requestId === activeLegRequestId.value) {
      activeLegLoading.value = false
    }
  }
}

// Dispatch the selected report request and manage its loading state.
const fetchData = async () => {
  if (reportLoading.value) return

  if (!form.startDate || !form.endDate) {
    $q.notify({ type: 'warning', message: 'Please select both start and end dates.' })
    return
  }

  reportLoading.value = true
  reportDataReady.value = false
  activeLegCount.value = null
  activeLegLoading.value = false
  activeLegRequestId.value += 1

  try {
    const dpccodeToUse = permissions.value.canSelectDpc ? form.dpccode : auth.userDetails?.dpc_id

    if (!dpccodeToUse) {
      $q.notify({ type: 'negative', message: 'No DPC code available' })
      return
    }

    // Update store filters before fetching
    salesStore.setFilters({
      startDate: form.startDate,
      endDate: form.endDate,
      dpccode: dpccodeToUse,
    })

    switch (form.reportType) {
      case 'dailySales':
        await salesStore.fetchSales(form.startDate, form.endDate, dpccodeToUse)
        break

      case 'personalBV': {
        if (!form.distributoridno) {
          $q.notify({ type: 'negative', message: 'Please enter a Distributor ID' })
          return
        }
        await salesStore.fetchPersonalSales(form.startDate, form.endDate, form.distributoridno)
        if (salesStore.error) throw new Error(salesStore.error)

        void fetchActiveLegCount(form.distributoridno, form.startDate, form.endDate)
        break
      }

      case 'tallys':
        // simplified: fetch raw sales; aggregation will be done in component
        await salesStore.fetchSalesRaw(form.startDate, form.endDate, dpccodeToUse)
        break
      case 'sales':
        await salesStore.fetchSalesRaw(form.startDate, form.endDate, dpccodeToUse, {
          includeDistributorDetails: true,
        })
        if (salesStore.error) throw new Error(salesStore.error)
        break
      case 'stock':
        await fetchStock(dpccodeToUse)
        break

      case 'queriedSales':
        await salesStore.fetchQueriedSales(form.startDate, form.endDate, dpccodeToUse)
        break

      case 'bestCustomers':
        await salesStore.bestCustomer(form.startDate, form.endDate, dpccodeToUse)
        $q.notify({
          type: 'positive',
          message: 'Best customers loaded successfully.',
          timeout: 2000,
        })
        break

      default:
        console.warn('Unknown report type:', form.reportType)
        $q.notify({ type: 'warning', message: 'Unknown report type selected.' })
    }

    reportDataReady.value = reportOptions.value.some(
      (option) => option.value === form.reportType,
    )
  } catch (err) {
    console.error('Fetch error:', err)
    $q.notify({ type: 'negative', message: err.message || 'Error fetching data' })
  } finally {
    reportLoading.value = false
  }
}

// Build derived report rows, filters, and summary values.
const shopName = computed(() => {
  if (!dpcOptions.value.length) return 'Loading...'

  // Find DPC name using form.dpccode (always set for Admins and Users)
  const currentDPC = dpcOptions.value.find((d) => d.value === form.dpccode)
  return currentDPC ? currentDPC.label : 'Unknown Shop'
})

// Daily tallies
const dailyTallies = computed(() => {
  const raw = salesStore.salesTally || []
  if (!raw.length) return []

  // Flatten all salesdetails with parent sale info
  const allItems = raw.flatMap((sale) =>
    (sale.salesdetails || []).map((item) => ({
      ...item,
      salesdate: sale.salesdate,
      receiptno: sale.receiptno,
      distributoridno: sale.distributoridno,
    })),
  )

  // Group by date
  const grouped = {}
  allItems.forEach((item) => {
    const date = item.salesdate
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(item)
  })

  return Object.entries(grouped).map(([date, items]) => ({ date, items }))
})

// Sales aggregated for pagination

// 🔹 Computed daily totals
const dailySalesTotals = computed(() => {
  if (!salesStore.salesTally || !salesStore.salesTally.length) return []

  const grouped = new Map()

  salesStore.salesTally.forEach((sale) => {
    const date = String(sale.salesdate || '').slice(0, 10)
    if (!date) return

    if (!grouped.has(date)) grouped.set(date, { total: 0, customers: new Map() })
    const day = grouped.get(date)
    const details = sale.salesdetails || []

    details.forEach((item) => {
      const quantity = Number(item.quantity || 0)
      day.total += quantity * Number(item.unitprice || 0)

      if (sale.distributoridno) {
        const distributoridno = sale.distributoridno
        const customer = day.customers.get(distributoridno) || {
          distributoridno,
          name: sale.distributorname,
          telephone: sale.distributortelephone,
          totalBV: 0,
        }
        customer.totalBV += quantity * Number(item.unitbv ?? item.bvs ?? 0)
        day.customers.set(distributoridno, customer)
      }
    })
  })

  return [...grouped.entries()]
    .map(([date, day]) => ({
      date,
      total: day.total,
      topCustomer: [...day.customers.values()].sort(
        (a, b) => b.totalBV - a.totalBV || a.distributoridno.localeCompare(b.distributoridno),
      )[0],
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})
// Top 5 customers per month by total BV
const monthlyTopCustomers = computed(() => {
  const months = new Map()

  ;(salesStore.salesTally || []).forEach((sale) => {
    const month = String(sale.salesdate || '').slice(0, 7)
    if (!month || !sale.distributoridno) return

    if (!months.has(month)) months.set(month, new Map())
    const customers = months.get(month)
    const customer = customers.get(sale.distributoridno) || {
      distributoridno: sale.distributoridno,
      name: sale.distributorname,
      totalBV: 0,
    }
    ;(sale.salesdetails || []).forEach((item) => {
      customer.totalBV += Number(item.quantity || 0) * Number(item.unitbv ?? item.bvs ?? 0)
    })
    customers.set(sale.distributoridno, customer)
  })

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, customers]) => ({
      month,
      customers: [...customers.values()]
        .sort(
          (a, b) => b.totalBV - a.totalBV || a.distributoridno.localeCompare(b.distributoridno),
        )
        .slice(0, 5),
    }))
})
// Monthly tallies grouped by month and productcode
const monthlyTallies = computed(() => {
  const raw = salesStore.salesTally || []
  if (!raw.length) return []

  // Flatten all salesdetails
  const allItems = raw.flatMap((sale) =>
    (sale.salesdetails || []).map((item) => ({
      ...item,
      salesdate: sale.salesdate,
      receiptno: sale.receiptno,
      distributoridno: sale.distributoridno,
    })),
  )

  // 🔹 Aggregate by productcode ONLY (no month grouping)
  const productMap = {}

  allItems.forEach((item) => {
    const code = item.productcode

    if (!productMap[code]) {
      productMap[code] = {
        productcode: code,
        productname: item.productname,
        unitprice: item.unitprice || 0,
        totalQuantity: 0,
        totalAmount: 0,
        totalBvs: 0,
      }
    }

    productMap[code].totalQuantity += Number(item.quantity || 0)
    productMap[code].totalAmount += (item.unitprice || 0) * (item.quantity || 0)
    productMap[code].totalBvs += (item.bvs || 0) * (item.quantity || 0)
  })

  const products = Object.values(productMap)

  return [
    {
      // Label only (not grouping)
      month: `${form.startDate} → ${form.endDate}`,

      items: products,

      quantityTotal: products.reduce((s, p) => s + p.totalQuantity, 0),
      amountTotal: products.reduce((s, p) => s + p.totalAmount, 0),
      bvsTotal: products.reduce((s, p) => s + p.totalBvs, 0),
    },
  ]
})

const matchesTallyFilters = (item, quantity) => {
  const codeFilter = tallyProductCodeFilter.value.trim().toLocaleLowerCase()
  const nameFilter = tallyProductNameFilter.value.trim().toLocaleLowerCase()
  const minQuantity = tallyMinQuantity.value
  const maxQuantity = tallyMaxQuantity.value

  return (
    String(item.productcode || '').toLocaleLowerCase().includes(codeFilter) &&
    String(item.productname || '').toLocaleLowerCase().includes(nameFilter) &&
    (minQuantity === null || minQuantity === '' || quantity >= Number(minQuantity)) &&
    (maxQuantity === null || maxQuantity === '' || quantity <= Number(maxQuantity))
  )
}

const tallySortValue = (item) => {
  switch (tallySortField.value) {
    case 'productname':
      return String(item.productname || '').toLocaleLowerCase()
    case 'quantity':
      return Number(item.quantity ?? item.totalQuantity ?? 0)
    case 'unitprice':
      return Number(item.unitprice || 0)
    case 'bv':
      return Number(item.totalBvs ?? Number(item.bvs || 0) * Number(item.quantity || 0))
    case 'amount':
      return Number(item.totalAmount ?? Number(item.unitprice || 0) * Number(item.quantity || 0))
    default:
      return String(item.productcode || '').toLocaleLowerCase()
  }
}

const sortTallyItems = (items) =>
  [...items].sort((a, b) => {
    const first = tallySortValue(a)
    const second = tallySortValue(b)
    const comparison =
      typeof first === 'string' && typeof second === 'string'
        ? first.localeCompare(second)
        : first - second

    return tallySortDirection.value === 'asc' ? comparison : -comparison
  })

const filteredDailyTallies = computed(() =>
  dailyTallies.value
    .map((day) => ({
      ...day,
      items: sortTallyItems(
        day.items.filter((item) => matchesTallyFilters(item, Number(item.quantity || 0))),
      ),
    }))
    .filter((day) => day.items.length),
)

const filteredMonthlyTallies = computed(() =>
  monthlyTallies.value
    .map((period) => {
      const items = sortTallyItems(
        period.items.filter((item) =>
          matchesTallyFilters(item, Number(item.totalQuantity || 0)),
        ),
      )

      return {
        ...period,
        items,
        quantityTotal: items.reduce((sum, item) => sum + Number(item.totalQuantity || 0), 0),
        amountTotal: items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
        bvsTotal: items.reduce((sum, item) => sum + Number(item.totalBvs || 0), 0),
      }
    })
    .filter((period) => period.items.length),
)

const filteredTallyReportData = computed(() =>
  tallyType.value === 'daily' ? filteredDailyTallies.value : filteredMonthlyTallies.value,
)

const formatDateTime = (dateStr) => {
  if (!dateStr) return ''

  const d = new Date(dateStr)

  const pad = (n) => (n < 10 ? '0' + n : n)

  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = d.getFullYear()
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())

  return `${day}/${month}/${year}:${hours}:${minutes}:${seconds}`
}

const summaryTotals = computed(() => {
  if (!form.reportType || !reportDataReady.value) return null

  if (form.reportType === 'dailySales') {
    if (!sortedSales.value.length || !paginatedSales.value.length) return null

    // Sum across all receipts
    const totalAmount = paginatedSales.value.reduce((sum, sale) => sum + totalPrice(sale), 0)
    const totalBv = paginatedSales.value.reduce((sum, sale) => sum + totalBV(sale), 0)
    return { label: 'Daily Totals', totalAmount, totalBv }
  }

  if (form.reportType === 'personalBV') {
    if (!salesStore.sales.length) return null

    return {
      label: 'Personal BV Totals',
      totalAmount: personalTotalSales,
      totalBv: personalTotalBV,
    }
  }

  if (form.reportType === 'sales') {
    if (!dailySalesTotals.value.length) return null

    const totalSales = dailySalesTotals.value.reduce((sum, d) => sum + d.total, 0)
    return { label: 'Sales Totals', totalSales }
  }

  if (form.reportType === 'tallys') {
    if (tallyType.value === 'daily' && !filteredDailyTallies.value.length) return null
    if (tallyType.value === 'monthly' && !filteredMonthlyTallies.value.length) return null

    let totalAmount = 0
    if (tallyType.value === 'daily') {
      totalAmount = filteredDailyTallies.value.reduce(
        (sum, day) => sum + day.items.reduce((s, i) => s + i.unitprice * i.quantity, 0),
        0,
      )
    } else if (tallyType.value === 'monthly') {
      totalAmount = filteredMonthlyTallies.value.reduce((sum, m) => sum + m.amountTotal, 0)
    }
    return { label: 'Tally Totals', totalAmount }
  }

  return null
})

// Computed: group sales by distributor
const salesByDistributor = computed(() => {
  const groups = {}
  paginatedSales.value.forEach((sale) => {
    const distId = sale.distributoridno
    if (!groups[distId]) {
      groups[distId] = {
        distributoridno: distId,
        distributorname: sale.distributorname,
        distributorposition: sale.distributorposition,
        registereddpc: sale.registereddpc,
        lastmodified: sale.lastmodified,

        sales: [],
      }
    }
    groups[distId].sales.push(sale)
  })
  return Object.values(groups)
})

const allReports = computed(() => [
  { label: $t('PersonalBV'), value: 'personalBV' },
  { label: $t('dailySales'), value: 'dailySales' },
  { label: $t('tallies'), value: 'tallys' },
  { label: $t('sales'), value: 'sales' },
  { label: $t('mystock'), value: 'stock' },
  { label: $t('flaggedSales'), value: 'queriedSales' },
  { label: $t('bestCustomers'), value: 'bestCustomers' },
])
const reportOptions = computed(() => {
  if (isSuperAdmin.value) {
    return allReports.value
  }
  if (isAdmin.value) {
    return allReports.value
  }
  return allReports.value.filter((r) =>
    [
      'personalBV',
      'dailySales',
      'tallys',
      'sales',
      'stock',
      'queriedSales',
      'bestCustomers',
    ].includes(r.value),
  )
})

// Computed totals
const totalPrice = (sale) => sale.salesdetails.reduce((acc, i) => acc + i.unitprice * i.quantity, 0)
const totalBV = (sale) => sale.salesdetails.reduce((acc, i) => acc + i.unitbv * i.quantity, 0)

// Action buttons (stub)

//const deleteSale = async (sale) => {
// try {
//   const { error } = await supabase.from('salesheader').delete().eq('receiptno', sale.receiptno)

// if (error) throw error

// update local state
// salesStore.sales = salesStore.sales.filter((s) => s.receiptno !== sale.receiptno)
//   return true
// } catch (err) {
//  console.error('Delete failed:', err.message)
//    throw err
// }
//}

// Receipt actions update sale data and report status.
const deleteSale = async (sale) => {
  try {
    // One atomic RPC restores stock to the receipt's own DPC and deletes the receipt
    const { error } = await supabase.rpc('delete_sales_transaction', {
      p_receiptno: sale.receiptno,
    })
    if (error) throw error

    $q.notify({
      message: `Receipt ${sale.receiptno} deleted and stock restored.`,
      color: 'blue',
      position: 'top',
      icon: 'delete',
    })

    // Update local store
    salesStore.sales = salesStore.sales.filter((s) => s.receiptno !== sale.receiptno)

    return true
  } catch (err) {
    console.error('Delete failed:', err.message)
    $q.notify({
      message: `Failed to delete sale: ${err.message}`,
      color: 'red',
      position: 'top',
      icon: 'error',
    })
    throw err
  }
}

const confirmDeleteReceipt = (sale) => {
  $q.dialog({
    title: $t('confirm'), // i18n key for "Confirm"
    message: $t('deleteReceiptMessage', { receipt: sale.receiptno }), // i18n key with interpolation
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await deleteSale(sale)
      $q.notify({ type: 'positive', message: $t('receiptDeleted') })
    } catch (err) {
      $q.notify({ type: 'negative', message: err.message || $t('deleteFailed') })
    }
  })
}

// when button is clicked
const toggleStatus = (sale) => {
  const userRole = auth.userDetails?.role

  $q.dialog({
    title: $t('confirmAction'),
    message: $t('changeStatusMessage'),
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      const updatedStatus = await salesStore.toggleStatus(sale.receiptno, sale.salesdate, userRole)
      sale.status = updatedStatus
      // 🔥 update counter instantly
      fetchPendingCount()

      $q.notify({
        type: 'positive',
        message: $t('statusUpdated', { status: updatedStatus }),
      })
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: err.message || $t('updateFailed'),
      })
    }
  })
}

// Pagination state
const rowsPerPage = ref(5) // default 5
const currentPage = ref(1)

// Options for user
const pageOptions = [5, 10, 20, 50, 'All']

// Sort sales by receiptno
//const sortedSales = computed(() => {
// return [...salesStore.sales].sort((a, b) => {
// if receiptno is numeric
//  return Number(a.receiptno.replace(/\D/g, '')) - Number(b.receiptno.replace(/\D/g, ''))
// })
//})
const sortedSales = computed(() => {
  return [...salesStore.sales]
    .filter((sale) => {
      // Convert receiptno to numeric for comparison
      const saleNo = Number(sale.receiptno.replace(/\D/g, ''))

      const fromNo = fromReceipt.value ? Number(fromReceipt.value.replace(/\D/g, '')) : null
      const toNo = toReceipt.value ? Number(toReceipt.value.replace(/\D/g, '')) : null

      if (fromNo !== null && saleNo < fromNo) return false
      if (toNo !== null && saleNo > toNo) return false
      return true
    })
    .sort((a, b) => {
      return Number(a.receiptno.replace(/\D/g, '')) - Number(b.receiptno.replace(/\D/g, ''))
    })
})

// Apply pagination
const paginatedSales = computed(() => {
  if (rowsPerPage.value === 'All') {
    return sortedSales.value
  }
  const start = (currentPage.value - 1) * rowsPerPage.value
  const end = start + rowsPerPage.value
  return sortedSales.value.slice(start, end)
})

// Total pages
const totalPages = computed(() => {
  if (rowsPerPage.value === 'All') return 1
  return Math.ceil(sortedSales.value.length / rowsPerPage.value)
})

// Change page safely
function changePage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const submitUpdate = async () => {
  try {
    await salesStore.updateSale(editForm.value)
    $q.notify({
      type: 'positive',
      message: $t('saleUpdated'), // i18n key
    })
    editDialog.value = false
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || $t('updateFailed'), // i18n key
    })
  }
}
</script>

<style scoped>
/* Personal BV summary cards and tally tables. */
.personal-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0.5rem 0;
}

.personal-summary-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 0.375rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.875rem;
  background: linear-gradient(145deg, #fff, #f8fafc);
  padding: 0.75rem 1rem;
  box-shadow: 0 4px 12px rgb(15 23 42 / 5%);
}

.personal-summary-label {
  color: #475569;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.personal-summary-value {
  display: flex;
  min-height: 1.75rem;
  align-items: center;
  color: #1e293b;
  font-size: clamp(1rem, 2.5vw, 1.375rem);
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.personal-summary-loading {
  color: #64748b;
  font-size: 0.8125rem;
}

.tally-controls {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: center;
  gap: 0.625rem;
  margin: 0 0 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.875rem;
  background: linear-gradient(135deg, #fff, #f8fafc);
  padding: 0.75rem;
  box-shadow: 0 4px 12px rgb(15 23 42 / 5%);
}

.tally-filter-input {
  min-width: 0;
  grid-column: span 2;
}

.tally-quantity-filter {
  grid-column: span 1;
}

.tally-sort-tools {
  display: flex;
  grid-column: span 6;
  align-items: center;
  gap: 0.5rem;
}

.tally-sort-label {
  flex: 0 0 auto;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.tally-sort-select {
  width: min(100%, 16rem);
  min-width: 0;
  flex: 0 1 16rem;
  height: 2.5rem;
  border-color: #cbd5e1;
  border-radius: 0.75rem;
  background-color: #37474f;
  padding: 0.5rem 1.75rem 0.5rem 0.75rem;
  color: #fff;
  font-size: 0.8125rem;
  text-align: left;
}

.tally-day-card,
.tally-table {
  overflow: hidden;
  border-color: #e2e8f0;
  border-radius: 0.875rem;
}

.tally-daily-footer {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: #eceff1;
  padding: 0.625rem 0.75rem;
  color: #455a64;
  font-size: 0.8125rem;
  font-weight: 600;
}

.tally-daily-footer-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 1rem;
}

.tally-daily-footer-stats span {
  color: #607d8b;
}

.tally-daily-footer-total {
  display: flex;
  flex: 0 0 auto;
  align-items: baseline;
  gap: 0.5rem;
  border-radius: 0.625rem;
  background: #37474f;
  padding: 0.5rem 0.75rem;
  color: #fff;
  font-size: 0.875rem;
}

.tally-daily-footer-total strong {
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}

.tally-summary-total {
  display: flex;
  min-width: min(100%, 20rem);
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-left: auto;
  border: 1px solid #cfd8dc;
  border-radius: 0.875rem;
  background: linear-gradient(135deg, #eceff1, #fff);
  padding: 0.75rem 1rem;
  color: #37474f;
  box-shadow: 0 4px 12px rgb(38 50 56 / 8%);
}

.tally-summary-label {
  color: #455a64;
  font-size: 0.9375rem;
  font-weight: 700;
}

.tally-summary-value {
  color: #263238;
  font-size: clamp(1rem, 2.5vw, 1.375rem);
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}

.tally-table :deep(thead tr) {
  background: #f1f5f9;
  color: #334155;
}

.tally-table :deep(table) {
  width: 100%;
  table-layout: fixed;
}

.tally-table :deep(th) {
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.tally-table :deep(tbody tr:nth-child(even)) {
  background: #f8fafc;
}

.tally-table :deep(.tally-code-cell),
.tally-table :deep(.tally-product-name-cell) {
  white-space: nowrap;
}

.tally-table :deep(.tally-product-name-cell) {
  max-width: 18rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tally-table :deep(.tally-number-cell) {
  text-align: right;
  white-space: nowrap;
}

/* Receipt cards, product details, totals, and actions. */
.daily-sale-card-wrap {
  max-width: 100%;
  margin-right: auto;
  margin-left: auto;
}

.daily-sale-card {
  width: 100%;
  max-width: 68rem;
  margin: 0 auto;
  border-color: #e2e8f0;
  border-radius: 0.875rem;
  box-shadow:
    0 7px 18px rgb(15 23 42 / 6%),
    0 2px 5px rgb(15 23 42 / 4%);
}

.daily-sale-header {
  background-image: linear-gradient(115deg, #263238 0%, #37474f 58%, #455a64 100%);
}

.daily-sale-status {
  margin: 0;
  align-self: flex-start;
}

.daily-sale-receipt-number {
  overflow-wrap: anywhere;
  color: #fff;
  font-size: clamp(0.875rem, 2.5vw, 1.125rem);
  font-weight: 700;
  line-height: 1.25;
}

.daily-sale-detail-secondary {
  color: #cbd5e1;
}

.daily-sale-header-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.daily-sale-detail-tile {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1875rem;
  border: 1px solid rgb(255 255 255 / 13%);
  border-radius: 0.625rem;
  background: rgb(255 255 255 / 7%);
  padding: 0.5rem 0.625rem;
  font-size: clamp(0.6875rem, 1.7vw, 0.8125rem);
  line-height: 1.2;
}

.daily-sale-detail-label {
  color: #cbd5e1;
  font-size: clamp(0.5625rem, 1.45vw, 0.6875rem);
  font-weight: 700;
  letter-spacing: 0.075em;
  text-transform: uppercase;
}

.daily-sale-products {
  padding-top: 0.75rem;
}

.daily-sale-products-heading,
.daily-sale-product-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(3, minmax(2.75rem, 0.65fr));
  align-items: center;
  gap: clamp(0.25rem, 1vw, 0.75rem);
}

.daily-sale-products-heading {
  padding: 0 0.625rem 0.375rem;
  color: #64748b;
  font-size: clamp(0.5625rem, 1.4vw, 0.6875rem);
  font-weight: 700;
  letter-spacing: 0.075em;
  text-transform: uppercase;
}

.daily-sale-column-label {
  text-align: right;
}

.daily-sale-product-row {
  min-height: 2.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.625rem;
  background: #fff;
  padding: 0.5rem 0.625rem;
}

.daily-sale-product-row + .daily-sale-product-row {
  margin-top: 0.375rem;
}

.daily-sale-product-row:nth-child(odd) {
  background: #f8fafc;
}

.daily-sale-product-identity {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.daily-sale-product-code {
  color: #64748b;
  font-size: clamp(0.5625rem, 1.4vw, 0.6875rem);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.daily-sale-product-name {
  overflow-wrap: anywhere;
  color: #1e293b;
  font-size: clamp(0.6875rem, 1.8vw, 0.875rem);
  font-weight: 600;
  line-height: 1.2;
}

.daily-sale-metric {
  min-width: 0;
  color: #334155;
  font-size: clamp(0.625rem, 1.8vw, 0.875rem);
  text-align: right;
  overflow-wrap: anywhere;
}

.daily-sale-bv {
  color: #c2410c;
}

.daily-sale-mobile-label {
  display: none;
}

.daily-sale-totals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.625rem;
}

.daily-sale-total-tile {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 0.125rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.625rem;
  background: #f8fafc;
  padding: 0.5rem 0.75rem;
  color: #64748b;
  font-size: clamp(0.5625rem, 1.5vw, 0.75rem);
  font-weight: 600;
}

.daily-sale-total-tile strong {
  color: #1e293b;
  font-size: clamp(0.75rem, 2.1vw, 1rem);
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.daily-sale-total-primary {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.daily-sale-total-primary strong {
  color: #263238;
}

.daily-sale-total-bv strong {
  color: #c2410c;
}

.daily-sale-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 0.75rem;
  gap: 0.375rem 0.5rem;
  border-top: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}

.daily-sale-action-btn {
  min-height: 2.25rem;
  border-radius: 0.625rem;
  font-size: clamp(0.6875rem, 1.7vw, 0.8125rem);
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: 0 1px 2px rgb(15 23 42 / 8%);
  transition:
    transform 150ms ease,
    box-shadow 150ms ease,
    background-color 150ms ease;
}

.daily-sale-action-btn :deep(.q-icon) {
  font-size: 1.125rem;
}

.daily-sale-action-btn:not(.disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 9px rgb(15 23 42 / 12%);
}

.daily-sale-action-btn:focus-visible {
  outline: 2px solid #64748b;
  outline-offset: 2px;
}

.daily-sale-action-edit {
  background: #fef3c7 !important;
  color: #92400e !important;
}

.daily-sale-action-delete {
  background: #ffe4e6 !important;
  color: #be123c !important;
}

.daily-sale-action-status-pending {
  background: #dcfce7 !important;
  color: #166534 !important;
}

.daily-sale-action-status-complete {
  background: #ffedd5 !important;
  color: #9a3412 !important;
}

/* Report context, filters, exports, and pagination controls. */
.reports-context-header {
  display: flex;
  justify-content: flex-start;
  padding: 0.5rem 1rem 0.75rem;
}

.reports-context-copy {
  min-width: 0;
  color: #1e293b;
}

.reports-context-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #263238;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.375rem;
}

.reports-context-title .q-icon {
  flex: 0 0 auto;
  color: #455a64;
}

.reports-context-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.875rem;
  margin-top: 0.25rem;
  color: #475569;
  font-size: 0.75rem;
  line-height: 1rem;
}

.reports-context-meta > span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.reports-context-code {
  border-radius: 9999px;
  background: #eceff1;
  padding: 0.125rem 0.5rem;
  color: #37474f;
  font-weight: 700;
}

.reports-context-report {
  margin-top: 0.375rem;
  color: #334155;
  font-size: 0.8125rem;
  font-weight: 600;
}

.reports-filter-label,
.reports-page-size-label {
  color: #334155;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.125rem;
}

.reports-select {
  min-height: 2.75rem;
  border: 1px solid #455a64;
  border-radius: 0.75rem;
  background-color: #37474f;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.reports-select:focus-visible {
  border-color: #647f8b;
  outline: none;
  box-shadow: 0 0 0 3px rgb(55 71 79 / 20%);
}

.reports-filter-input :deep(.q-field__control) {
  min-height: 2.75rem;
  border-radius: 0.75rem;
  background: #fff;
}

.reports-filter-input :deep(.q-field__control::before) {
  border-color: #cbd5e1;
}

.reports-filter-input :deep(.q-field__control:hover::before) {
  border-color: #64748b;
}

.reports-filter-input :deep(.q-field--focused .q-field__control::before) {
  border: 2px solid #475569;
}

.reports-filter-input :deep(.q-field__native),
.reports-filter-input :deep(.q-field__input),
.reports-filter-input :deep(.q-icon) {
  color: #111827 !important;
  font-size: 0.875rem;
  font-weight: 500;
}

.reports-pagination {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  white-space: nowrap;
}

.reports-pagination .pagination-select.native-select {
  flex: 0 0 4rem;
  width: 4rem;
  min-width: 4rem;
  height: 2.25rem;
  padding-right: 1.5rem;
  padding-left: 0.5rem;
  background-position: right 0.35rem center;
}

.reports-pagination-buttons {
  min-width: 0;
  flex: 0 1 auto;
}

.reports-export-controls {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
}

.reports-export-controls :deep(.export-actions--compact) {
  gap: 0;
}

.reports-export-controls :deep(.export-actions--compact .q-btn) {
  min-width: 1.875rem;
  min-height: 1.875rem;
}

.pending-receipts-badge {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  min-height: 2.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: 1px solid #455a64;
  border-radius: 9999px;
  background: #37474f;
  padding: 0.375rem 0.75rem;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1rem;
  white-space: nowrap;
}

.pending-receipts-badge .q-icon {
  flex: 0 0 auto;
  color: #c5e1a5;
}

.pending-receipts-badge span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.reports-page-size-label {
  white-space: nowrap;
}

.pagination-select.native-select {
  width: 6.25rem;
  min-width: 5rem;
  border: 1px solid #455a64;
  border-radius: 0.625rem;
  background-color: #37474f;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.pagination-select.native-select:focus-visible {
  border-color: #647f8b;
  outline: none;
  box-shadow: 0 0 0 3px rgb(55 71 79 / 20%);
}

.reports-pagination-buttons :deep(.q-btn) {
  min-width: 2rem;
  min-height: 2rem;
  border-radius: 0.625rem;
  font-weight: 600;
}

.reports-pagination-buttons :deep(.q-btn:not(.bg-blue-grey-9)) {
  color: #37474f;
}

.reports-pagination-buttons :deep(.q-btn:hover) {
  background: #eceff1;
}

.reports-fetch-btn {
  border-radius: 0.75rem;
  background: #37474f !important;
  font-weight: 700;
  box-shadow: 0 4px 10px rgb(38 50 56 / 18%);
}

.q-card__section.reports-fetch-section {
  padding: 0.25rem 1rem 0;
}

.reports-fetch-error {
  margin-top: 0.375rem;
}

.reports-loading-panel {
  display: flex;
  min-height: 12rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin: 0 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 1rem;
  background: linear-gradient(135deg, #f8fafc, #eef2f6);
  color: #37474f;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
}

.reports-fetch-btn:hover {
  background: #263238 !important;
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.table-responsive {
  overflow-x: auto;
}
.daily-top-customer-badge {
  display: block;
  box-sizing: border-box;
  width: 11rem;
  max-width: 100%;
  overflow: hidden;
  white-space: normal;
  line-height: 1.3;
  font-size: 0.75rem;
  text-align: left;
}
.daily-top-customer-badge > div {
  width: 100%;
  min-width: 0;
}
.top-customer-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  min-height: 2.6em;
}
.monthly-top-customers-title {
  font-size: 0.95rem;
}
.monthly-top-customer-name {
  max-width: 11rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
}
.daily-top-customer-loading {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
th,
td {
  padding: 4px 8px;

  text-align: left;
}
@media (max-width: 600px) {
  th,
  td {
    font-size: 0.85rem;
  }
}
/* Apply to all outlined inputs/selects inside your form */
.custom-form ::v-deep(.q-field--outlined .q-field__control) {
  border: 2px solid #b6acac !important; /* darker border */
  border-radius: 8px; /* optional: smoother edges */
}

/* Stronger border on hover */
.custom-form ::v-deep(.q-field--outlined:hover .q-field__control) {
  border-color: #111 !important;
}

/* Stronger + colored border when focused */
.custom-form ::v-deep(.q-field--outlined.q-field--focused .q-field__control) {
  border: 2px solid #0d47a1 !important; /* deep blue when focused */
  box-shadow: 0 0 4px rgba(13, 71, 161, 0.5); /* optional glow */
}
.custom-list {
  font-size: 14px; /* default */
  border: 1.5px solid #1b5e20; /* stronger blue border */
  background-color: #f7f3f3; /* light background */
  border-radius: 6px; /* keep rounded look */
}

.custom-list .q-item__label {
  white-space: nowrap; /* ✅ prevent text from wrapping */
  overflow: hidden; /* optional: hide overflow */
  text-overflow: ellipsis; /* optional: show "..." */
}
.currency-display .amount {
  font-size: 1.4rem; /* bigger number */
  font-weight: bold;
}

.personal-active-legs {
  display: block;
  color: #334155;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.25rem;
}

.currency-display .currency {
  font-size: 1.2rem; /* smaller than amount */
  margin-left: 4px; /* space between number and currency */
  opacity: 0.8; /* subtle */
}
.select-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden; /* ensures dropdown stays within parent */
}

.custom-select {
  width: 100%;
  padding: 8px;
  border: 1px solid white;
  border-radius: 4px;
  background-color: #263238; /* matches Quasar bg-blue-grey-10 */
  color: white;
  text-align: center;
  appearance: none;
  box-sizing: border-box;
  max-width: 100%; /* prevent overflow */
}
.pagination-select {
  background-color: #37474f;
}

.custom-select option {
  background-color: transparent; /* matches Quasar bg-blue-grey-10 */
  color: white;
}

.custom-select:focus {
  outline: none;
  border-color: #0d47a1;
}
.native-select {
  width: 120px;
  background-color: #263238;
  color: white; /* white text */
  border: 1px solid white; /* white outline */
  border-radius: 6px; /* rounded corners */
  padding: 8px; /* inner spacing */
  height: 38px; /* CONTROL HEIGHT */
  appearance: none; /* remove default arrow */
  -moz-appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

/* Optional: add custom dropdown arrow on the right (cleaner UI) */
.native-select {
  background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='16' viewBox='0 0 24 24' width='16' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.table-responsive {
  overflow-x: auto;
}

.wrap-text {
  white-space: normal;
  word-break: break-word;
  max-width: 200px;
}
.stock-table .product-wrap {
  white-space: normal !important;
  line-height: 1.2em;
  max-height: 2.4em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stock-table th,
.stock-table td {
  border: 1px solid #e0e0e0 !important;
}

/* Product wrapping max 2 lines then truncate */
.product-wrap {
  max-width: 100%;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2; /* show only 2 lines */
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
}

/* Row colors depending on quantity */
.row-red td {
  color: #ff5252 !important;
}

.row-orange td {
  color: #ff9800 !important;
}

.row-green td {
  color: #4caf50 !important;
}

/* Apply to all outlined inputs/selects inside your form */
.custom-form ::v-deep(.q-field--outlined .q-field__control) {
  border: 1px solid #5eee42 !important; /* darker border */
  border-radius: 4px; /* optional: smoother edges */
}

/* Stronger border on hover */
.custom-form ::v-deep(.q-field--outlined:hover .q-field__control) {
  border-color: #111 !important;
}

/* Stronger + colored border when focused */
.custom-form ::v-deep(.q-field--outlined.q-field--focused .q-field__control) {
  border: 2px solid #0d47a1 !important; /* deep blue when focused */
  box-shadow: 0 0 4px rgba(13, 71, 161, 0.5); /* optional glow */
}
.responsive-card {
  width: 100%;
  max-width: 95vw; /* dynamic width */
  margin: 0 auto;
}

/* Large screens */
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

.custom-form .reports-filter-input :deep(.q-field--outlined .q-field__control) {
  border: 1px solid #cbd5e1 !important;
  border-radius: 0.75rem;
  background: #fff;
  box-shadow: none;
}

.custom-form .reports-filter-input :deep(.q-field--outlined.q-field--focused .q-field__control) {
  border: 2px solid #475569 !important;
  box-shadow: 0 0 0 3px rgb(71 85 105 / 14%);
}

.custom-form .reports-filter-input :deep(.q-field__native),
.custom-form .reports-filter-input :deep(.q-field__input),
.custom-form .reports-filter-input :deep(.q-icon) {
  color: #111827 !important;
}

.custom-select.reports-select {
  min-height: 2.75rem;
  border-color: #455a64;
  border-radius: 0.75rem;
  background-color: #37474f;
  color: #fff;
  font-weight: 500;
}

.custom-select.reports-select.native-select {
  width: 100%;
  background-position: right 0.75rem center;
  padding-right: 2.25rem;
  padding-left: 0.75rem;
  text-align: left;
}

.reports-pagination {
  flex-wrap: wrap;
}

.reports-pagination-buttons :deep(.q-btn) {
  min-width: 1.75rem;
  min-height: 1.75rem;
  padding: 0.125rem;
  background-color: #eceff1;
  color: #37474f;
}

.reports-pagination-buttons :deep(.q-btn.bg-blue-grey-9) {
  background-color: #37474f !important;
  color: #fff !important;
}

@media (max-width: 640px) {
  .personal-summary-grid {
    gap: 0.5rem;
  }

  .personal-summary-card {
    gap: 0.25rem;
    padding: 0.625rem;
  }

  .personal-summary-label {
    font-size: 0.6875rem;
  }

  .personal-summary-value {
    font-size: clamp(0.875rem, 4vw, 1.125rem);
  }

  .tally-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    padding: 0.625rem;
  }

  .tally-filter-input {
    grid-column: span 1;
  }

  .tally-sort-tools {
    grid-column: 1 / -1;
  }

  .tally-sort-select {
    width: auto;
    flex: 1 1 auto;
  }

  .tally-table :deep(thead th:nth-child(n + 4)),
  .tally-table :deep(tbody td:nth-child(n + 4)) {
    display: none;
  }

  .tally-table :deep(col:nth-child(n + 4)) {
    display: none;
  }

  .tally-table :deep(th),
  .tally-table :deep(td) {
    padding: 0.5rem 0.375rem;
    font-size: 0.75rem;
  }

  .tally-table :deep(th:nth-child(1)),
  .tally-table :deep(td:nth-child(1)) {
    width: 24%;
    max-width: 24%;
    text-align: left;
  }

  .tally-table :deep(col:nth-child(1)) {
    width: 24% !important;
  }

  .tally-table :deep(th:nth-child(2)),
  .tally-table :deep(td:nth-child(2)) {
    width: 56%;
    max-width: 56%;
    text-align: left;
  }

  .tally-table :deep(col:nth-child(2)) {
    width: 56% !important;
  }

  .tally-table :deep(th:nth-child(3)),
  .tally-table :deep(td:nth-child(3)) {
    width: 20%;
    max-width: 20%;
    text-align: right;
    white-space: nowrap;
  }

  .tally-table :deep(col:nth-child(3)) {
    width: 20% !important;
  }

  .daily-sale-actions {
    justify-content: stretch;
    gap: 0.375rem;
    padding: 0.5rem;
  }

  .daily-sale-action-btn {
    min-width: 0;
    flex: 1 1 auto;
    padding-right: 0.5rem;
    padding-left: 0.5rem;
  }

  .daily-sale-header-details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.375rem;
  }

  .daily-sale-detail-tile {
    padding: 0.4375rem 0.5rem;
  }

  .daily-sale-product-row {
    grid-template-columns: minmax(0, 1.7fr) repeat(3, minmax(2.5rem, 0.65fr));
    padding: 0.4375rem;
  }

  .daily-sale-column-label,
  .daily-sale-metric {
    text-align: right;
  }

  .daily-sale-totals {
    gap: 0.375rem;
  }

  .daily-sale-total-tile {
    padding: 0.4375rem 0.5rem;
  }

  .reports-page-size-label {
    font-size: 0.75rem;
  }

  .reports-pagination {
    gap: 0.25rem;
  }

  .reports-page-size-label {
    max-width: 4.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .reports-pagination-buttons :deep(.q-btn) {
    min-width: 1.625rem;
    min-height: 1.625rem;
  }
}

@media (max-width: 380px) {
  .daily-sale-header-details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .daily-sale-product-row {
    grid-template-columns: minmax(0, 1.45fr) repeat(3, minmax(2.25rem, 0.6fr));
    gap: 0.25rem;
    padding-right: 0.375rem;
    padding-left: 0.375rem;
  }
}
</style>
