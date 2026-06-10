import type { SitecoreItem, ItemField } from './types'

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export interface FieldChange {
  key: string
  type: string
  oldValue: string
  newValue: string
}

export interface DiffItem {
  status: DiffStatus
  id: string
  itemA: SitecoreItem | null  // null when added
  itemB: SitecoreItem | null  // null when removed
  changes: FieldChange[]      // populated when modified
}

export interface PackageDiff {
  items: DiffItem[]
  stats: { added: number; removed: number; modified: number; unchanged: number }
}

function normaliseId(id: string): string {
  return id.replace(/[{}]/g, '').toLowerCase()
}

function diffFields(fieldsA: ItemField[], fieldsB: ItemField[]): FieldChange[] {
  const changes: FieldChange[] = []
  const mapA = new Map(fieldsA.map((f) => [f.key.toLowerCase(), f]))
  const mapB = new Map(fieldsB.map((f) => [f.key.toLowerCase(), f]))

  for (const [key, fA] of mapA) {
    const fB = mapB.get(key)
    if (!fB) {
      changes.push({ key: fA.key, type: fA.type, oldValue: fA.value, newValue: '' })
    } else if (fA.value !== fB.value) {
      changes.push({ key: fA.key, type: fA.type, oldValue: fA.value, newValue: fB.value })
    }
  }
  for (const [key, fB] of mapB) {
    if (!mapA.has(key)) {
      changes.push({ key: fB.key, type: fB.type, oldValue: '', newValue: fB.value })
    }
  }
  return changes
}

export function diffPackages(
  itemsA: SitecoreItem[],
  itemsB: SitecoreItem[]
): PackageDiff {
  const mapA = new Map(itemsA.map((i) => [normaliseId(i.id), i]))
  const mapB = new Map(itemsB.map((i) => [normaliseId(i.id), i]))

  const result: DiffItem[] = []
  const stats = { added: 0, removed: 0, modified: 0, unchanged: 0 }

  for (const [id, itemA] of mapA) {
    const itemB = mapB.get(id)
    if (!itemB) {
      result.push({ status: 'removed', id, itemA, itemB: null, changes: [] })
      stats.removed++
    } else {
      const changes = diffFields(itemA.fields, itemB.fields)
      if (itemA.path !== itemB.path)
        changes.unshift({ key: 'path (moved)', type: 'System', oldValue: itemA.path, newValue: itemB.path })
      if (itemA.templateName !== itemB.templateName)
        changes.unshift({ key: 'template', type: 'System', oldValue: itemA.templateName, newValue: itemB.templateName })

      if (changes.length > 0) {
        result.push({ status: 'modified', id, itemA, itemB, changes })
        stats.modified++
      } else {
        result.push({ status: 'unchanged', id, itemA, itemB: null, changes: [] })
        stats.unchanged++
      }
    }
  }

  for (const [id, itemB] of mapB) {
    if (!mapA.has(id)) {
      result.push({ status: 'added', id, itemA: null, itemB, changes: [] })
      stats.added++
    }
  }

  return { items: result, stats }
}
