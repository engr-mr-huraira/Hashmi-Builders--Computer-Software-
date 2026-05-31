/**
 * Tabular export helpers - CSV download, print-to-paper, and PDF (via the
 * browser's print-to-PDF dialog). All run client-side, no backend needed.
 */

function escapeCsv(value) {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function exportCSV({ filename = 'export.csv', columns, rows }) {
  const headers = columns.map((c) => c.label || c.key)
  const lines = [headers.map(escapeCsv).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsv(c.export ? c.export(row) : row[c.key])).join(','))
  }
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename)
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Open a print-friendly window with the table rendered. The user can choose
 * "Save as PDF" in the print dialog or send to a real printer.
 */
export function printTable({ title = 'Report', subtitle = '', columns, rows }) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  const headerHtml = columns.map((c) => `<th>${escapeHtml(c.label || c.key)}</th>`).join('')
  const rowsHtml = rows.map((row) => {
    const tds = columns.map((c) => {
      let v = c.export ? c.export(row) : row[c.key]
      if (v === null || v === undefined) v = ''
      return `<td>${escapeHtml(String(v))}</td>`
    }).join('')
    return `<tr>${tds}</tr>`
  }).join('')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;padding:24px}
  h1{margin:0 0 4px 0;font-size:20px}
  .sub{color:#64748b;font-size:12px;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f1f5f9;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
  tfoot{font-size:11px;color:#64748b}
  @media print { body{padding:0} }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<div class="sub">${escapeHtml(subtitle)} · Generated ${new Date().toLocaleString()}</div>
<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml || '<tr><td colspan="' + columns.length + '" style="text-align:center;color:#94a3b8;padding:24px">No records</td></tr>'}</tbody></table>
<p class="sub" style="margin-top:18px">Total: ${rows.length} record(s)</p>
<script>window.onload=function(){window.focus();window.print();}</script>
</body></html>`
  win.document.write(html)
  win.document.close()
}

export const exportPDF = printTable // PDF is produced via the print dialog's "Save as PDF"

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
