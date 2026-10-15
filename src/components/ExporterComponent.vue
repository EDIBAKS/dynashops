<template>
  <div
    :class="
      compact
        ? 'export-actions export-actions--compact'
        : 'export-actions row q-gutter-xs q-mb-sm items-center no-wrap'
    "
  >
    <!-- Use icon-only actions in compact layouts and labeled buttons otherwise -->
    <template v-if="compact">
      <q-btn
        round
        dense
        flat
        color="blue-grey-9"
        icon="table_view"
        aria-label="Export Excel"
        @click="downloadExcel"
      >
        <q-tooltip>Excel</q-tooltip>
      </q-btn>
      <q-btn
        round
        dense
        flat
        color="blue-grey-9"
        icon="picture_as_pdf"
        aria-label="Export PDF"
        @click="downloadPDF"
      >
        <q-tooltip>PDF</q-tooltip>
      </q-btn>
    </template>
    <template v-else>
      <q-btn
        color="primary"
        icon="download"
        label="Excel"
        flat
        dense
        style="min-width: 90px"
        @click="downloadExcel"
      />
      <q-btn
        color="red"
        icon="picture_as_pdf"
        label="PDF"
        flat
        dense
        style="min-width: 90px"
        @click="downloadPDF"
      />
    </template>
  </div>
</template>

<script setup>
import {} from 'vue'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuth } from 'src/stores/auth'

const auth = useAuth()

//const form = reactive({
// startDate:
//  localStorage.getItem('reportStartDate') || dayjs().startOf('month').format('YYYY-MM-DD'),
// endDate: localStorage.getItem('reportEndDate') || dayjs().endOf('month').format('YYYY-MM-DD'),
// dpccode: localStorage.getItem('reportDpccode') || '',
// shopName: '',
//})

// Props provide the selected report data and its export context.
const props = defineProps({
  reportType: { type: String, required: true },
  reportData: { type: Array, required: true },
  extraInfo: { type: Object, default: () => ({}) },
  dpccode: String,
  startDate: String,
  endDate: String,
  compact: { type: Boolean, default: false },
})

const downloadExcel = () => {
  if (!props.reportData || !props.reportData.length) return

  const wb = XLSX.utils.book_new()
  const header = [
    ['DYNAPHARM'],
    [props.reportType.toUpperCase()],
    [`Period: ${props.startDate} - ${props.endDate}`],
    [`DPC: ${(props.dpccode || '').toUpperCase()}`],
    [],
  ]

  const marginRow = ['']

  const addSheet = (name, data) => {
    let safeName = (name || 'Sheet1').substring(0, 31)
    const ws = XLSX.utils.aoa_to_sheet(data)

    // Auto column widths
    const colWidths = data[0].map(
      (_, i) => Math.max(...data.map((r) => (r[i] ? r[i].toString().length : 10))) + 2,
    )
    ws['!cols'] = colWidths.map((w) => ({ wch: w }))

    XLSX.utils.book_append_sheet(wb, ws, safeName)
  }

  // --- GRAND TOTALS TRACKER ---
  let grandTotals = { amount: 0, bv: 0 }

  // =========================================================
  // DAILY / PERSONAL REPORTS
  // =========================================================
  if (['dailySales', 'personalBV', 'personalSales'].includes(props.reportType)) {
    props.reportData.forEach((dist) => {
      const sheetData = [...header]
      const receipts = dist.sales || [dist] // match PDF logic

      if (dist.distributoridno) {
        sheetData.push([
          `Distributor ID: ${dist.distributoridno}`,
          `Name: ${dist.distributorname || ''}`,
        ])
        sheetData.push(marginRow)
      }

      let distTotalAmount = 0
      let distTotalBV = 0

      receipts.forEach((r) => {
        const items = r.salesdetails || []
        const formattedDate = dayjs(r.salesdate).format('MMM D, YYYY')

        sheetData.push([
          `Receipt No: ${r.receiptno}`,
          `Date: ${formattedDate}`,
          `Status: ${r.status || ''}`,
        ])

        if (items.length) {
          sheetData.push(['Product Code', 'Product Name', 'Price', 'Qty', 'BV', 'Total'])

          let receiptTotal = { amount: 0, bv: 0 }

          items.forEach((i) => {
            const price = i.unitprice || 0
            const qty = i.quantity || 0
            const bv = (i.unitbv || 0) * qty
            const amt = price * qty

            sheetData.push([
              i.productcode,
              i.productname,
              price.toFixed(2),
              qty,
              bv.toFixed(2),
              amt.toFixed(2),
            ])

            receiptTotal.amount += amt
            receiptTotal.bv += bv
          })

          // Totals per receipt
          sheetData.push(['', '', '', '', 'Receipt Total Amount', receiptTotal.amount.toFixed(2)])
          sheetData.push(['', '', '', '', 'Receipt Total BV', receiptTotal.bv.toFixed(2)])
          sheetData.push(marginRow)

          distTotalAmount += receiptTotal.amount
          distTotalBV += receiptTotal.bv
        }
      })

      // Distributor totals
      sheetData.push(['', '', '', '', 'Total Amount', distTotalAmount.toFixed(2)])
      sheetData.push(['', '', '', '', 'Total BV', distTotalBV.toFixed(2)])
      sheetData.push(marginRow)
      sheetData.push([
        'Printed by',
        auth.userDetails.firstname || 'System User',
        'Date',
        new Date().toLocaleString(),
      ])

      addSheet(dist.distributorname || dist.distributoridno, sheetData)

      grandTotals.amount += distTotalAmount
      grandTotals.bv += distTotalBV
    })
  }

  // =========================================================
  // TALLYS (DAILY / MONTHLY)
  // =========================================================
  else if (props.reportType === 'tallys') {
    const tallyType = props.extraInfo?.tallyType || 'daily'
    const sheetData = [...header, [`Tally Type: ${tallyType.toUpperCase()}`], []]
    let grandAmount = 0
    let grandBV = 0

    if (tallyType === 'daily') {
      props.reportData.forEach((day) => {
        const formattedDate = dayjs(day.date).format('MMM D, YYYY')
        sheetData.push([`Date: ${formattedDate}`])
        sheetData.push(['Product Code', 'Product Name', 'Qty', 'Price', 'BV', 'Amount'])

        let totalQty = 0,
          totalBV = 0,
          totalAmt = 0

        day.items.forEach((i) => {
          const bv = i.bvs * i.quantity || 0
          const amt = i.unitprice * i.quantity || 0

          sheetData.push([
            i.productcode,
            i.productname,
            i.quantity,
            i.unitprice.toFixed(2),
            bv.toFixed(2),
            amt.toFixed(2),
          ])

          totalQty += i.quantity
          totalBV += bv
          totalAmt += amt
        })

        sheetData.push([
          `Total Qty: ${totalQty}`,
          '',
          '',
          `Total BV: ${totalBV.toFixed(2)}`,
          '',
          `Total Amount: ${totalAmt.toFixed(2)}`,
        ])
        sheetData.push(marginRow)

        grandAmount += totalAmt
        grandBV += totalBV
      })
    } else {
      props.reportData.forEach((period) => {
        sheetData.push([`Month: ${period.month}`])
        sheetData.push(['Product Code', 'Product Name', 'BV', 'Price', 'Qty', 'Amount'])

        let totalBV = 0,
          totalAmt = 0

        period.items.forEach((i) => {
          const bv = i.totalBvs || 0
          const amt = i.totalAmount || 0

          sheetData.push([
            i.productcode,
            i.productname,
            bv.toFixed(2),
            (i.unitprice || 0).toFixed(2),
            i.totalQuantity,
            amt.toFixed(2),
          ])

          totalBV += bv
          totalAmt += amt
        })

        sheetData.push([
          '',
          '',
          `Total BV: ${totalBV.toFixed(2)}`,
          '',
          '',
          `Total Amount: ${totalAmt.toFixed(2)}`,
        ])
        sheetData.push(marginRow)

        grandAmount += totalAmt
        grandBV += totalBV
      })
    }

    sheetData.push(['Grand Total Amount', grandAmount.toFixed(2)])
    sheetData.push(['Grand Total BV', grandBV.toFixed(2)])
    sheetData.push([
      'Printed by',
      auth.userDetails.firstname || 'System User',
      'Date',
      new Date().toLocaleString(),
    ])

    addSheet('Tallys', sheetData)
  }

  // =========================================================
  // SALES
  // =========================================================
  else if (props.reportType === 'sales') {
    const sheetData = [...header, ['Date', 'Total Sales']]
    let grandAmount = 0

    props.reportData.forEach((s) => {
      const amt = s.total || 0
      sheetData.push([dayjs(s.date).format('MMM D, YYYY'), amt.toFixed(2)])
      grandAmount += amt
    })

    sheetData.push([])
    sheetData.push(['Grand Total Amount', grandAmount.toFixed(2)])
    sheetData.push([
      'Printed by',
      auth.userDetails.firstname || 'System User',
      'Date',
      new Date().toLocaleString(),
    ])

    addSheet('Sales', sheetData)
  } else if (props.reportType === 'stock') {
    const sheetData = [
      ['DYNAPHARM'],
      ['STOCK REPORT'],
      [`Period: ${props.startDate} - ${props.endDate}`],
      [`DPC: ${(props.dpccode || '').toUpperCase()}`],
      [],
      ['Product Code', 'Product Name', 'Qty', 'DP Value', 'BV Value'],
    ]

    let totalQty = 0,
      totalDP = 0,
      totalBV = 0

    props.reportData.forEach((item) => {
      const qty = item.quantity || 0
      const dp = item.dpValue || 0
      const bv = item.bvValue || 0

      sheetData.push([item.productcode, item.productname, qty, dp.toFixed(2), bv.toFixed(2)])

      totalQty += qty
      totalDP += dp
      totalBV += bv
    })

    // Add grand totals row
    sheetData.push(['Grand Totals', '', totalQty, totalDP.toFixed(2), totalBV.toFixed(2)])
    sheetData.push([])
    sheetData.push([
      'Printed by',
      auth.userDetails.firstname || 'System User',
      'Date',
      new Date().toLocaleString(),
    ])

    addSheet('Stock Report', sheetData)
  }

  XLSX.writeFile(wb, `${props.reportType}_${dayjs().format('YYYY-MM-DD')}.xlsx`)
}

// ---------------- PDF ----------------
const downloadPDF = () => {
  if (!props.reportData || !props.reportData.length) return

  const doc = new jsPDF()
  const margin = 10
  let y = 50
  const grandTotals = { amount: 0, bv: 0 }

  const addPageIfNeeded = (currentY) =>
    currentY > doc.internal.pageSize.height - 30 ? (doc.addPage(), margin) : currentY

  // --- Header ---
  doc.setFontSize(18)
  doc.setTextColor(200, 0, 0)
  doc.text('DYNAPHARM', 105, 10, { align: 'center' })

  doc.setFontSize(14)
  doc.setTextColor(0)
  doc.text(props.reportType.toUpperCase(), 105, 18, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`Period: ${props.startDate} - ${props.endDate}`, margin, 28)
  doc.setTextColor(0, 0, 200)
  doc.text(`DPC: ${(props.dpccode || '').toUpperCase()}`, margin, 39)
  doc.setTextColor(0)

  // --- DAILY / PERSONAL ---
  if (['dailySales', 'personalBV', 'personalSales'].includes(props.reportType)) {
    props.reportData.forEach((dist) => {
      const receipts = dist.sales || [dist]
      receipts.forEach((r) => {
        const items = r.salesdetails || []

        if (dist.distributoridno) {
          doc.setFontSize(11)
          doc.text(`Distributor ID: ${dist.distributoridno}`, margin, y)
          y += 6
          doc.text(`Name: ${dist.distributorname || ''}`, margin, y)
          y += 8
        }

        const formattedDate = dayjs(r.salesdate).format('MMM D, YYYY')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(0, 0, 255)
        doc.text(`Receipt No: ${r.receiptno}`, margin, y)
        const textWidth = doc.getTextWidth(`Receipt No: ${r.receiptno}`)
        doc.setTextColor(0)
        doc.text(` | Date: ${formattedDate} | Status: ${r.status || ''}`, margin + textWidth, y)
        y += 5

        if (items.length) {
          // Display the table using precomputed totals
          autoTable(doc, {
            startY: y,
            head: [['Product Code', 'Product Name', 'Price', 'Qty', 'BV', 'Total']],
            body: items.map((i) => [
              i.productcode,
              i.productname,
              (i.unitprice || 0).toFixed(2),
              i.quantity,
              (i.unitbv * i.quantity).toFixed(2),
              (i.unitprice * i.quantity).toFixed(2),
            ]),
            styles: { fontSize: 9 },
            margin: { left: margin, right: margin },
          })

          const finalY = doc.lastAutoTable.finalY

          // Compute totals using precomputed values only
          const receiptTotal = items.reduce(
            (tot, i) => {
              tot.amount += (i.unitprice || 0) * (i.quantity || 0)
              tot.bv += (i.unitbv || 0) * (i.quantity || 0)
              return tot
            },
            { amount: 0, bv: 0 },
          )

          doc.text(`Receipt Total Amount: ${receiptTotal.amount.toFixed(2)}`, margin, finalY + 8)
          doc.text(`Receipt Total BV: ${receiptTotal.bv.toFixed(2)}`, margin, finalY + 16)

          // Add to grand totals
          grandTotals.amount += receiptTotal.amount
          grandTotals.bv += receiptTotal.bv

          y = finalY + 24
        } else y += 15

        doc.setDrawColor(200)
        doc.setLineWidth(0.4)
        doc.line(margin, y, 200, y)
        y += 10
        y = addPageIfNeeded(y)
      })
    })
  }

  // --- TALLYS / DAILY & MONTHLY ---
  else if (props.reportType === 'tallys') {
    const tallyType = props.extraInfo?.tallyType || 'daily'
    doc.setFontSize(12)
    doc.text(`Tally Type: ${tallyType.toUpperCase()}`, margin, y)
    y += 10

    // --- DAILY TALLY ---
    if (tallyType === 'daily') {
      props.reportData.forEach((day) => {
        const formattedDate = dayjs(day.date).format('MMM D, YYYY')
        doc.setFontSize(11)
        doc.text(`Date: ${formattedDate}`, margin, y)
        y += 4

        autoTable(doc, {
          startY: y,
          head: [['Product Code', 'Product Name', 'Qty', 'Price', 'BV', 'Amount']],
          body: day.items.map((i) => [
            i.productcode,
            i.productname,
            i.quantity,
            i.unitprice.toFixed(2),
            (i.bvs * i.quantity).toFixed(2),
            (i.unitprice * i.quantity).toFixed(2),
          ]),
          styles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        })

        const finalY = doc.lastAutoTable.finalY
        const totalQty = day.items.reduce((sum, i) => sum + i.quantity, 0)
        const totalBV = day.items.reduce((sum, i) => sum + i.bvs * i.quantity, 0)
        const totalAmt = day.items.reduce((sum, i) => sum + i.unitprice * i.quantity, 0)

        doc.text(`Total Qty: ${totalQty}`, margin, finalY + 6)
        doc.text(`Total BV: ${totalBV.toFixed(2)}`, margin + 60, finalY + 6)
        doc.text(`Total Amount: ${totalAmt.toFixed(2)}`, margin + 120, finalY + 6)

        grandTotals.amount += totalAmt
        grandTotals.bv += totalBV

        y = finalY + 14
        y = addPageIfNeeded(y)
      })
    }

    // --- MONTHLY TALLY ---
    else {
      props.reportData.forEach((period) => {
        doc.setFontSize(11)
        doc.text(`Month: ${period.month}`, margin, y)
        y += 4

        autoTable(doc, {
          startY: y,
          head: [['Product Code', 'Product Name', 'BV', 'Price', 'Qty', 'Amount']],
          body: period.items.map((i) => [
            i.productcode,
            i.productname,
            (i.totalBvs || 0).toFixed(2),
            (i.unitprice || 0).toFixed(2),
            i.totalQuantity,
            (i.totalAmount || 0).toFixed(2),
          ]),
          styles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        })

        const finalY = doc.lastAutoTable.finalY
        const totalBV = period.items.reduce((sum, i) => sum + (i.totalBvs || 0), 0)
        const totalAmt = period.items.reduce((sum, i) => sum + (i.totalAmount || 0), 0)

        doc.text(`Total BV: ${totalBV.toFixed(2)}`, margin, finalY + 6)
        doc.text(`Total Amount: ${totalAmt.toFixed(2)}`, margin + 80, finalY + 6)

        grandTotals.amount += totalAmt
        grandTotals.bv += totalBV

        y = finalY + 14
        y = addPageIfNeeded(y)
      })
    }
  }

  // --- SALES ---
  else if (props.reportType === 'sales') {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Total Sales']],
      body: props.reportData.map((s) => [dayjs(s.date).format('MMM D, YYYY'), s.total.toFixed(2)]),
      styles: { fontSize: 10 },
      margin: { left: margin, right: margin },
    })
    grandTotals.amount += props.reportData.reduce((sum, s) => sum + (s.total || 0), 0)
    y = doc.lastAutoTable.finalY + 10
  } else if (props.reportType === 'stock') {
    autoTable(doc, {
      startY: y,
      head: [['Product Code', 'Product Name', 'Qty', 'DP Value', 'BV Value']],
      body: props.reportData.map((item) => [
        item.productcode,
        item.productname,
        item.quantity || 0,
        (item.dpValue || 0).toFixed(2),
        (item.bvValue || 0).toFixed(2),
      ]),
      styles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    })

    const finalY = doc.lastAutoTable.finalY

    // Grand totals
    const totalQty = props.reportData.reduce((sum, i) => sum + (i.quantity || 0), 0)
    const totalDP = props.reportData.reduce((sum, i) => sum + (i.dpValue || 0), 0)
    const totalBV = props.reportData.reduce((sum, i) => sum + (i.bvValue || 0), 0)

    doc.setFont('helvetica', 'bold')
    doc.text(`Total Qty: ${totalQty}`, margin, finalY + 8)
    doc.text(`Total DP: ${totalDP.toFixed(2)}`, margin + 60, finalY + 8)
    doc.text(`Total BV: ${totalBV.toFixed(2)}`, margin + 120, finalY + 8)

    y = finalY + 16
  }

  // --- Grand Totals ---
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`Grand Total Amount: ${grandTotals.amount.toFixed(2)}`, margin, y)
  doc.text(`Grand Total BV: ${grandTotals.bv.toFixed(2)}`, 110, y)
  y += 8
  doc.text(`Printed by: ${auth.userDetails.firstname || 'System User'}`, margin, y)
  doc.text(`Date: ${new Date().toLocaleString()}`, 110, y)

  doc.save(`${props.reportType}_${dayjs().format('YYYY-MM-DD')}.pdf`)
}
</script>

<style scoped>
.export-actions--compact {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.125rem;
}

.export-actions--compact :deep(.q-btn) {
  min-width: 2.25rem;
  min-height: 2.25rem;
  color: #37474f !important;
}

.export-actions--compact :deep(.q-btn:hover) {
  background: #eceff1;
}
</style>
