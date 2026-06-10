// Web Worker — runs analyzeDrift off the main thread

function normaliseId(id) {
  return id.replace(/[{}]/g, '').toLowerCase()
}

function diffFields(a, b) {
  const diffs = []
  const allKeys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])
  for (const key of allKeys) {
    const av = a.fields[key] ?? ''
    const bv = b.fields[key] ?? ''
    if (av !== bv) diffs.push({ field: key, sourceValue: av, targetValue: bv })
  }
  const structural = ['templateId', 'parentId', 'name']
  for (const key of structural) {
    const av = String(a[key] ?? '')
    const bv = String(b[key] ?? '')
    if (av !== bv) diffs.push({ field: `[${key}]`, sourceValue: av, targetValue: bv })
  }
  return diffs
}

self.onmessage = function (e) {
  const { sourceItems, targetItems, sourceLabel, targetLabel, mode } = e.data

  const sourceMap = new Map()
  const targetMap = new Map()

  for (const item of sourceItems) sourceMap.set(normaliseId(item.id), item)
  for (const item of targetItems) targetMap.set(normaliseId(item.id), item)

  const items = []
  const stats = { 'source-only': 0, 'target-only': 0, modified: 0, identical: 0 }

  for (const [id, src] of sourceMap) {
    const tgt = targetMap.get(id) ?? null
    if (!tgt) {
      items.push({ status: 'source-only', id, name: src.name, path: src.path, templateName: src.templateName, sourceItem: src, targetItem: null, fieldDiffs: [] })
      stats['source-only']++
    } else {
      const fieldDiffs = diffFields(src, tgt)
      const status = fieldDiffs.length > 0 ? 'modified' : 'identical'
      items.push({ status, id, name: src.name, path: src.path, templateName: src.templateName, sourceItem: src, targetItem: tgt, fieldDiffs })
      stats[status]++
    }
  }

  for (const [id, tgt] of targetMap) {
    if (!sourceMap.has(id)) {
      items.push({ status: 'target-only', id, name: tgt.name, path: tgt.path, templateName: tgt.templateName, sourceItem: null, targetItem: tgt, fieldDiffs: [] })
      stats['target-only']++
    }
  }

  items.sort((a, b) => a.path.localeCompare(b.path))

  self.postMessage({ items, stats, sourceLabel, targetLabel, mode, totalCompared: sourceMap.size + targetMap.size })
}
