import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Build head/body arrays from q-table style columns, applying the table's current sort
export function buildExportData(columns, rows, pagination) {
  const cols = columns.filter((c) => c.label)
  let list = rows
  const sortBy = pagination?.sortBy
  if (sortBy) {
    const dir = pagination.descending ? -1 : 1
    list = [...rows].sort((a, b) => {
      const x = a[sortBy] ?? ''
      const y = b[sortBy] ?? ''
      return (
        (typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y))) * dir
      )
    })
  }
  const head = cols.map((c) => c.label)
  const body = list.map((r) =>
    cols.map((c) => {
      const v = typeof c.field === 'function' ? c.field(r) : r[c.field]
      if (v == null) return ''
      return c.format ? c.format(v, r) : v
    }),
  )
  return { head, body }
}

// Assemble the report details shown above exported tables.
export function buildMeta({ from, to, printedBy, extra = [] }) {
  return [
    ['From', from],
    ['To', to],
    ...extra,
    ['Printed On', new Date().toLocaleString()],
    ['Printed By', printedBy || ''],
  ]
}

// Write the report contents to an Excel workbook.
export function exportExcel({ title, meta = [], filename, head, body }) {
  const ws = XLSX.utils.aoa_to_sheet([[title], ...meta, [], head, ...body])
  ws['!cols'] = head.map((h) => ({ wch: Math.max(16, h.length + 4) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Render the report contents as a landscape PDF.
export function exportPdf({ title, meta = [], filename, head, body }) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text(title, 14, 15)
  doc.setFontSize(9)
  let y = 22
  meta.forEach(([label, value]) => {
    doc.setFont(undefined, 'bold')
    doc.text(`${label}:`, 14, y)
    doc.setFont(undefined, 'normal')
    doc.text(String(value ?? ''), 40, y)
    y += 5
  })
  autoTable(doc, {
    head: [head],
    body,
    startY: y + 2,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [38, 50, 56] },
    didDrawPage: () => {
      doc.setFontSize(8)
      doc.text(`Page ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 25, doc.internal.pageSize.getHeight() - 8)
    },
  })
  doc.save(`${filename}.pdf`)
}
