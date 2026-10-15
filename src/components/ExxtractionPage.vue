<template>
  <q-page class="q-pa-md">
    <q-card flat class="q-pa-md" style="max-width: 1200px; margin: 0 auto">
      <!-- FILTER SECTION -->
      <div class="row q-gutter-sm items-center q-mb-md justify-between">
        <!-- Left Controls -->
        <div class="row q-gutter-sm items-center">
          <q-input filled v-model="startDate" type="date" label="Start Date" dense />
          <q-input filled v-model="endDate" type="date" label="End Date" dense />
          <q-select
            filled
            v-model="reportType"
            :options="reportOptions"
            label="Report Type"
            dense
          />
          <q-btn label="Load Data" color="primary" @click="loadData" dense />
        </div>

        <!-- Right Controls (Selected Count + Export) -->
        <div class="row items-center q-gutter-sm">
          <div v-if="selectedRows.length" class="text-subtitle2 text-primary">
            Selected: {{ selectedRows.length }}
          </div>
          <q-btn label="Export to Excel" color="secondary" @click="exportExcel" dense />
        </div>
      </div>

      <!-- DATA TABLE -->
      <q-table
        v-if="data.length"
        :columns="columns"
        :rows="data"
        row-key="receiptno"
        selection="multiple"
        v-model:selected="selectedRows"
        flat
        dense
      />

      <div v-else class="q-mt-md text-grey text-center">No data found.</div>
    </q-card>
  </q-page>
</template>

<script setup>
// Dependencies for querying sales records and creating Excel exports.
import { ref } from 'vue'
import ExcelJS from 'exceljs'
import { supabase } from 'boot/supabase'

// Date range, report selection, fetched rows, and table state.
const startDate = ref('')
const endDate = ref('')
const reportType = ref('SalesHeader')
const reportOptions = ['SalesHeader', 'SalesDetails']

const data = ref([])
const columns = ref([])
const selectedRows = ref([])

// --- Load Data ---
const loadData = async () => {
  if (!startDate.value || !endDate.value) return
  let resultData = []

  if (reportType.value === 'SalesHeader') {
    const { data: headers, error } = await supabase
      .from('salesheader')
      .select('*')
      .gte('salesdate', startDate.value)
      .lte('salesdate', endDate.value)
      .order('salesdate', { ascending: true })
    if (error) return alert(error.message)
    resultData = headers
  } else {
    const { data: headers, error: hErr } = await supabase
      .from('salesheader')
      .select('receiptno')
      .gte('salesdate', startDate.value)
      .lte('salesdate', endDate.value)
    if (hErr) return alert(hErr.message)

    const receiptNos = headers.map((h) => h.receiptno)
    const { data: details, error: dErr } = await supabase
      .from('salesdetails')
      .select('*')
      .in('receiptno', receiptNos)
    if (dErr) return alert(dErr.message)

    resultData = details
  }

  data.value = resultData
  columns.value = resultData.length
    ? Object.keys(resultData[0]).map((key) => ({ name: key, label: key, field: key }))
    : []
  selectedRows.value = []
}

// --- Export to Excel ---
const exportExcel = async () => {
  const exportData = selectedRows.value.length ? selectedRows.value : data.value
  if (!exportData.length) return alert('No data to export')

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Report')

  worksheet.columns = Object.keys(exportData[0]).map((key) => ({ header: key, key }))
  exportData.forEach((row) => worksheet.addRow(row))

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${reportType.value}_${startDate.value}_to_${endDate.value}.xlsx`
  a.click()
}
</script>
