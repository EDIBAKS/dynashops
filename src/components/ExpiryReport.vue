<template>
  <q-page class="q-pa-md">
    <!-- Filters -->
    <q-card flat bordered class="q-pa-md q-mb-md">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-4">
          <q-input v-model="startDate" type="date" label="Start Date" dense outlined />
        </div>

        <div class="col-12 col-md-4">
          <q-input v-model="endDate" type="date" label="End Date" dense outlined />
        </div>

        <div class="col-12 col-md-4 flex flex-center">
          <q-btn label="Load Expiry Data" color="primary" @click="loadData" />
        </div>
        <div class="q-mb-md">
          <q-btn label="Export Excel" color="green" @click="exportToExcel" class="q-mr-sm" />
          <q-btn label="Export PDF" color="red" @click="exportToPDF" />
        </div>
      </div>
    </q-card>

    <!-- Grouped Results -->
    <!-- Grouped Results -->
    <div v-for="(group, productCode) in groupedData" :key="productCode" class="q-mb-lg">
      <q-card bordered flat>
        <!-- Product Header -->
        <q-card-section class="bg-primary text-white">
          <div class="header-row">
            <div class="text-h6">{{ group.productname }} ({{ productCode }})</div>

            <div class="text-subtitle2">Total Qty: {{ getTotalQty(group.items) }}</div>

            <div class="text-subtitle2">
              Expiry Value:
              {{ getTotalValue(group.items, group.distributorprice).toLocaleString() }}
            </div>
          </div>
        </q-card-section>

        <!-- Table -->
        <q-table
          :rows="group.items"
          :columns="columns"
          row-key="id"
          flat
          dense
          :pagination="{ rowsPerPage: 0 }"
        >
          <!-- Action Column -->
          <template v-slot:body-cell-action="props">
            <q-td align="center">
              <q-btn label="Return" color="negative" size="sm" @click="confirmReturn(props.row)" />
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
// Data, permission, and document-export dependencies.
import { ref, computed } from 'vue'
import { supabase } from 'boot/supabase'
import { logActivity, ACTIVITY_TYPES } from 'src/utils/activityLog'
import { Dialog, Notify } from 'quasar'
import { useAuth } from 'stores/auth'
// Date filters, role access, and fetched expiry records.
const auth = useAuth()
const startDate = ref('')
const endDate = ref('')
const expiryData = ref([])
const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
// ✅ Use shop_name instead of shopcode
const columns = [
  { name: 'shop_name', label: 'Shop', field: 'shop_name' },
  { name: 'quantity', label: 'Qty', field: 'quantity' },
  { name: 'expirydate', label: 'Expiry Date', field: 'expirydate' },
  { name: 'dateadded', label: 'Date Added', field: 'dateadded' },
  { name: 'modifiedby', label: 'Modified By', field: 'modifiedby' },
  { name: 'action', label: 'Action', field: 'action' },
]

/**
 * Load data from Supabase
 */
const loadData = async () => {
  if (!startDate.value || !endDate.value) return

  const { data, error } = await supabase
    .from('expiry')
    .select(
      `
      *,
      products (
        productname,
        distributorprice
      )
    `,
    )
    .gte('expirydate', startDate.value)
    .lte('expirydate', endDate.value)
    .order('productcode')
    .order('expirydate')

  if (error) {
    console.error('Fetch error:', error)
    return
  }

  await attachShopNames(data)
}

const confirmReturn = (row) => {
  Dialog.create({
    title: 'Confirm Return',
    message: `Are you sure you want to return "${row.productname}"?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    // 🔥 Permission check
    if (!isSuperAdmin.value) {
      Notify.create({
        message: 'Only Super Admin can reverse expiries',
        color: 'negative',
        icon: 'warning',
      })
      return
    }

    // ✅ Allowed
    returnItem(row)
  })
}

/**
 * Attach shop names + flatten product data
 */
const attachShopNames = async (data) => {
  if (!data || data.length === 0) {
    expiryData.value = []
    return
  }

  // ✅ Extract only codes ending with _STOCK
  const prefixes = [
    ...new Set(
      data
        .filter((item) => item.shopcode?.endsWith('_STOCK'))
        .map((item) => item.shopcode.split('_')[0]),
    ),
  ]

  let shopMap = {}

  if (prefixes.length > 0) {
    const { data: shops, error } = await supabase
      .from('shops')
      .select('shopcode, shop_name')
      .in('shopcode', prefixes)

    if (error) {
      console.error('Shop fetch error:', error)
    } else {
      shops.forEach((s) => {
        shopMap[s.shopcode] = s.shop_name
      })
    }
  }

  // ✅ Transform final data
  expiryData.value = data.map((item) => {
    let shop_name = item.shopcode

    if (item.shopcode?.endsWith('_STOCK')) {
      const prefix = item.shopcode.split('_')[0]
      shop_name = shopMap[prefix] || item.shopcode
    }

    return {
      ...item,
      productname: item.products?.productname || item.productcode,
      distributorprice: item.products?.distributorprice || 0,
      shop_name,
    }
  })
}

/**
 * Group by product
 */
const groupedData = computed(() => {
  const groups = {}

  expiryData.value.forEach((item) => {
    if (!groups[item.productcode]) {
      groups[item.productcode] = {
        productname: item.productname,
        distributorprice: item.distributorprice,
        items: [],
      }
    }

    groups[item.productcode].items.push(item)
  })

  return groups
})

/**
 * Helpers
 */
const getTotalQty = (items) => items.reduce((sum, i) => sum + i.quantity, 0)

const getTotalValue = (items, price) => getTotalQty(items) * price

/**
 * Return action
 */
const returnItem = async (row) => {
  // 👉 store dismiss function
  const dismiss = Notify.create({
    message: 'Processing return...',
    color: 'info',
    spinner: true,
    timeout: 0,
  })

  try {
    const { error } = await supabase.rpc('return_expiry_item', {
      expiry_id: row.id,
    })

    if (error) throw error

    logActivity(ACTIVITY_TYPES.EXPIRY_RETURN, {
      reference: String(row.id),
      description: `Expiry item returned: ${row.quantity ?? ''} × ${row.productcode ?? row.productname ?? ''}`,
    })

    // ✅ REMOVE loading notification
    dismiss()

    Notify.create({
      message: 'Item returned successfully',
      color: 'positive',
      icon: 'check_circle',
    })

    await loadData()
  } catch (err) {
    console.error('Return failed:', err)

    // ✅ ALSO remove loading on error
    dismiss()

    Notify.create({
      message: err.message || 'Return failed',
      color: 'negative',
    })
  }
}

const exportToExcel = () => {
  const wb = XLSX.utils.book_new()
  const ws_data = []

  Object.keys(groupedData.value).forEach((productCode) => {
    const group = groupedData.value[productCode]

    // 🔹 Header
    ws_data.push([`Product: ${group.productname} (${productCode})`, '', '', ''])

    // 🔹 Totals
    ws_data.push([
      'Total Qty',
      getTotalQty(group.items),
      'Expiry Value',
      getTotalValue(group.items, group.distributorprice),
    ])

    // 🔹 Table header
    ws_data.push(['Shop', 'Qty', 'Expiry Date', 'Date Added', 'Modified By'])

    // 🔹 Rows
    group.items.forEach((item) => {
      ws_data.push([
        item.shop_name,
        item.quantity,
        item.expirydate,
        item.dateadded,
        item.modifiedby,
      ])
    })

    // 🔹 Space between groups
    ws_data.push([])
  })

  const ws = XLSX.utils.aoa_to_sheet(ws_data)
  XLSX.utils.book_append_sheet(wb, ws, 'Expiry Report')

  XLSX.writeFile(wb, 'Expiry_Report.xlsx')
}

const exportToPDF = () => {
  const doc = new jsPDF()

  let y = 10

  Object.keys(groupedData.value).forEach((productCode) => {
    const group = groupedData.value[productCode]

    // 🔹 Title
    doc.setFontSize(12)
    doc.text(`${group.productname} (${productCode})`, 10, y)

    y += 6

    // 🔹 Totals
    doc.setFontSize(10)
    doc.text(
      `Total Qty: ${getTotalQty(group.items)} | Expiry Value: ${getTotalValue(
        group.items,
        group.distributorprice,
      ).toLocaleString()}`,
      10,
      y,
    )

    y += 4

    // 🔹 Table
    autoTable(doc, {
      startY: y,
      head: [['Shop', 'Qty', 'Expiry Date', 'Date Added', 'Modified By']],
      body: group.items.map((item) => [
        item.shop_name,
        item.quantity,
        item.expirydate,
        item.dateadded,
        item.modifiedby,
      ]),
    })

    y = doc.lastAutoTable.finalY + 10
  })

  doc.save('Expiry_Report.pdf')
}
</script>
<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

/* 📱 Mobile */
@media (max-width: 600px) {
  .header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
