import * as XLSX from 'xlsx'
import type { ParsedPackage, SitecoreItem } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDisplayName(item: SitecoreItem): string {
  const dn = item.fields.find(
    (f) => f.key.toLowerCase() === '__display name' || f.key.toLowerCase() === 'display name'
  )
  return dn?.value || item.name
}

function getField(item: SitecoreItem, key: string): string {
  return item.fields.find((f) => f.key.toLowerCase() === key.toLowerCase())?.value ?? ''
}

// ── Style helpers (XLSX cell styles) ─────────────────────────────────────────

function hCell(value: string) {
  return {
    v: value, t: 's',
    s: {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
      fill: { fgColor: { rgb: '1E293B' }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
      border: {
        bottom: { style: 'thin', color: { rgb: '334155' } },
        right:  { style: 'thin', color: { rgb: '334155' } },
      },
    },
  }
}

function cell(value: string | number, rowIdx: number, style?: object) {
  const base = {
    v: value, t: typeof value === 'number' ? 'n' : 's',
    s: {
      font: { name: 'Arial', sz: 9, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: rowIdx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, patternType: 'solid' },
      alignment: { vertical: 'center', wrapText: false },
      border: {
        bottom: { style: 'hair', color: { rgb: 'E2E8F0' } },
        right:  { style: 'hair', color: { rgb: 'E2E8F0' } },
      },
      ...style,
    },
  }
  return base
}

const DEPLOY_COLORS: Record<string, string> = {
  Delete:    'FEE2E2',
  Overwrite: 'FFF7ED',
  Merge:     'EFF6FF',
  Skip:      'ECFDF5',
  Undefined: 'F8FAFC',
}

const TYPE_COLORS: Record<string, string> = {
  Template:          'EDE9FE',
  'Template Field':  'F5F3FF',
  'Template Section':'FAF5FF',
  Rendering:         'EFF6FF',
  Layout:            'F0F9FF',
  Placeholder:       'ECFEFF',
  Media:             'ECFDF5',
  Setting:           'FFFBEB',
  Content:           'F8FAFC',
  Unknown:           'F8FAFC',
}

// ── Sheet 1: Items ────────────────────────────────────────────────────────────

function buildItemsSheet(items: SitecoreItem[]): XLSX.WorkSheet {
  const headers = [
    'S.No', 'Name', 'Display Name', 'Language', 'Version',
    'ID', 'Template Name', 'Template ID', 'Parent ID',
    'Database', 'Deploy Mode', 'Item Type', 'Path',
  ]

  const ws: XLSX.WorkSheet = {}
  const colWidths = headers.map((h) => h.length)

  // Header row
  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c })
    ws[ref] = hCell(h)
  })

  // Data rows — sort by database priority, then path
  const dbOrder = ['master', 'core', 'web']
  const sorted = [...items].sort((a, b) => {
    const da = dbOrder.indexOf(a.database), db = dbOrder.indexOf(b.database)
    if (da !== db) return (da === -1 ? 99 : da) - (db === -1 ? 99 : db)
    return a.path.localeCompare(b.path)
  })

  sorted.forEach((item, i) => {
    const r = i + 1
    const deployColor = DEPLOY_COLORS[item.deployMode] ?? 'F8FAFC'
    const typeColor   = TYPE_COLORS[item.itemType]    ?? 'F8FAFC'
    const rowBg = r % 2 === 0 ? 'FFFFFF' : 'F8FAFC'

    const row: Array<string | number> = [
      i + 1,
      item.name,
      getDisplayName(item),
      item.language,
      item.version,
      item.id,
      item.templateName,
      item.templateId,
      item.parentId,
      item.database,
      item.deployMode,
      item.itemType,
      item.path,
    ]

    row.forEach((v, c) => {
      const ref = XLSX.utils.encode_cell({ r, c })
      // Highlight deploy mode and item type columns
      if (c === 10) {
        ws[ref] = cell(v, r, { fill: { fgColor: { rgb: deployColor }, patternType: 'solid' } })
      } else if (c === 11) {
        ws[ref] = cell(v, r, { fill: { fgColor: { rgb: typeColor }, patternType: 'solid' } })
      } else {
        ws[ref] = cell(v, r, { fill: { fgColor: { rgb: rowBg }, patternType: 'solid' } })
      }

      const str = String(v)
      if (str.length > colWidths[c]) colWidths[c] = str.length
    })
  })

  ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: sorted.length, c: headers.length - 1 })
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w + 2, 60) }))
  ws['!rows'] = [{ hpt: 24 }] // taller header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } // freeze header row

  return ws
}

// ── Sheet 2: Fields ───────────────────────────────────────────────────────────

function buildFieldsSheet(items: SitecoreItem[]): XLSX.WorkSheet {
  const headers = ['Item Name', 'Item Path', 'Field Key', 'Field Type', 'Template Field ID', 'Value']
  const ws: XLSX.WorkSheet = {}
  const colWidths = headers.map((h) => h.length)

  headers.forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = hCell(h)
  })

  let r = 1
  for (const item of items) {
    for (const f of item.fields) {
      const row = [item.name, item.path, f.key, f.type, f.tfid, f.value]
      row.forEach((v, c) => {
        const ref = XLSX.utils.encode_cell({ r, c })
        ws[ref] = cell(v, r)
        const len = String(v).length
        if (len > colWidths[c]) colWidths[c] = len
      })
      r++
    }
  }

  ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r, c: headers.length - 1 })
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w + 2, 80) }))
  ws['!rows'] = [{ hpt: 24 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  return ws
}

// ── Sheet 3: Summary ──────────────────────────────────────────────────────────

function buildSummarySheet(pkg: ParsedPackage): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}

  const sectionHeader = (r: number, label: string) => {
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = {
      v: label, t: 's',
      s: {
        font: { bold: true, name: 'Arial', sz: 11, color: { rgb: '1E293B' } },
        fill: { fgColor: { rgb: 'E2E8F0' }, patternType: 'solid' },
        alignment: { horizontal: 'left', vertical: 'center' },
      },
    }
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = { v: '', t: 's', s: { fill: { fgColor: { rgb: 'E2E8F0' }, patternType: 'solid' } } }
  }

  const row = (r: number, label: string, value: string | number, valueBold = false) => {
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(label, r)
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = cell(value, r, valueBold ? { font: { bold: true, name: 'Arial', sz: 9 } } : undefined)
  }

  let r = 0

  // Package info
  sectionHeader(r++, 'Package Information')
  row(r++, 'Name',      pkg.metadata.name      || '—')
  row(r++, 'Version',   pkg.metadata.version   || '—')
  row(r++, 'Author',    pkg.metadata.author    || '—')
  row(r++, 'Publisher', pkg.metadata.publisher || '—')
  row(r++, 'Total Items', pkg.items.length, true)
  row(r++, 'Physical Files', pkg.files.length, true)
  r++

  // By database
  sectionHeader(r++, 'Items by Database')
  const dbCount = new Map<string, number>()
  for (const item of pkg.items) dbCount.set(item.database, (dbCount.get(item.database) ?? 0) + 1)
  for (const [db, count] of dbCount) row(r++, db, count, true)
  r++

  // By item type
  sectionHeader(r++, 'Items by Type')
  const typeCount = new Map<string, number>()
  for (const item of pkg.items) typeCount.set(item.itemType, (typeCount.get(item.itemType) ?? 0) + 1)
  const sortedTypes = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1])
  for (const [type, count] of sortedTypes) row(r++, type, count, true)
  r++

  // By deploy mode
  sectionHeader(r++, 'Items by Deploy Mode')
  const modeCount = new Map<string, number>()
  for (const item of pkg.items) modeCount.set(item.deployMode, (modeCount.get(item.deployMode) ?? 0) + 1)
  for (const [mode, count] of modeCount) row(r++, mode, count, true)

  ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r, c: 1 })
  ws['!cols'] = [{ wch: 28 }, { wch: 40 }]
  ws['!merges'] = [] // section headers span 2 cols
  return ws
}

// ── Main export ───────────────────────────────────────────────────────────────

export function exportToExcel(pkg: ParsedPackage): void {
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(pkg), 'Summary')
  XLSX.utils.book_append_sheet(wb, buildItemsSheet(pkg.items), 'Items')

  const hasFields = pkg.items.some((i) => i.fields.length > 0)
  if (hasFields) {
    XLSX.utils.book_append_sheet(wb, buildFieldsSheet(pkg.items), 'Fields')
  }

  const safeName = (pkg.metadata.name || 'package').replace(/[^a-zA-Z0-9._-]/g, '_')
  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${safeName}_${date}.xlsx`)
}
