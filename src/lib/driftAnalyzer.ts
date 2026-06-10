import type { SnapshotItem } from './snapshot'

export type DriftStatus = 'source-only' | 'target-only' | 'modified' | 'identical'

export type DriftMode = 'env' | 'master-web'

export interface FieldDiff {
  field: string
  sourceValue: string
  targetValue: string
}

export interface DriftItem {
  status: DriftStatus
  id: string
  name: string
  path: string
  templateName: string
  sourceItem: SnapshotItem | null
  targetItem: SnapshotItem | null
  fieldDiffs: FieldDiff[]
}

export interface DriftResult {
  mode: DriftMode
  sourceLabel: string
  targetLabel: string
  items: DriftItem[]
  stats: Record<DriftStatus, number>
  totalCompared: number
}

function normaliseId(id: string): string {
  return id.replace(/[{}]/g, '').toLowerCase()
}

function diffFields(a: SnapshotItem, b: SnapshotItem): FieldDiff[] {
  const diffs: FieldDiff[] = []
  const allKeys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])
  for (const key of allKeys) {
    const av = a.fields[key] ?? ''
    const bv = b.fields[key] ?? ''
    if (av !== bv) diffs.push({ field: key, sourceValue: av, targetValue: bv })
  }
  // Also check structural fields
  const structural: (keyof SnapshotItem)[] = ['templateId', 'parentId', 'name']
  for (const key of structural) {
    const av = String(a[key] ?? '')
    const bv = String(b[key] ?? '')
    if (av !== bv) diffs.push({ field: `[${key}]`, sourceValue: av, targetValue: bv })
  }
  return diffs
}

export function analyzeDrift(
  sourceItems: SnapshotItem[],
  targetItems: SnapshotItem[],
  sourceLabel: string,
  targetLabel: string,
  mode: DriftMode
): DriftResult {
  const sourceMap = new Map<string, SnapshotItem>()
  const targetMap = new Map<string, SnapshotItem>()

  for (const item of sourceItems) sourceMap.set(normaliseId(item.id), item)
  for (const item of targetItems) targetMap.set(normaliseId(item.id), item)

  const items: DriftItem[] = []
  const stats: Record<DriftStatus, number> = {
    'source-only': 0,
    'target-only': 0,
    'modified': 0,
    'identical': 0,
  }

  // Items in source
  for (const [id, src] of sourceMap) {
    const tgt = targetMap.get(id) ?? null
    if (!tgt) {
      items.push({
        status: 'source-only', id, name: src.name, path: src.path,
        templateName: src.templateName, sourceItem: src, targetItem: null, fieldDiffs: [],
      })
      stats['source-only']++
    } else {
      const fieldDiffs = diffFields(src, tgt)
      const status: DriftStatus = fieldDiffs.length > 0 ? 'modified' : 'identical'
      items.push({
        status, id, name: src.name, path: src.path,
        templateName: src.templateName, sourceItem: src, targetItem: tgt, fieldDiffs,
      })
      stats[status]++
    }
  }

  // Items only in target
  for (const [id, tgt] of targetMap) {
    if (!sourceMap.has(id)) {
      items.push({
        status: 'target-only', id, name: tgt.name, path: tgt.path,
        templateName: tgt.templateName, sourceItem: null, targetItem: tgt, fieldDiffs: [],
      })
      stats['target-only']++
    }
  }

  // Sort by path for tree grouping
  items.sort((a, b) => a.path.localeCompare(b.path))

  return {
    mode, sourceLabel, targetLabel, items, stats,
    totalCompared: sourceMap.size + targetMap.size,
  }
}

// ── Tree builder ──────────────────────────────────────────────────────────────

export interface DriftTreeNode {
  segment: string
  fullPath: string
  driftItem: DriftItem | null     // null = virtual folder node
  children: DriftTreeNode[]
  worstStatus: DriftStatus | null // rolled up from children
  counts: Record<DriftStatus, number>
}

const STATUS_RANK: Record<DriftStatus, number> = {
  'source-only': 3,
  'target-only': 3,
  'modified': 2,
  'identical': 0,
}

function worstOf(a: DriftStatus | null, b: DriftStatus): DriftStatus {
  if (!a) return b
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b
}

export function buildDriftTree(items: DriftItem[]): DriftTreeNode[] {
  const roots: DriftTreeNode[] = []

  for (const driftItem of items) {
    const segments = driftItem.path.split('/').filter(Boolean)
    let currentChildren = roots
    let pathSoFar = ''

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      pathSoFar += '/' + seg
      const isLeaf = i === segments.length - 1

      let node = currentChildren.find(n => n.segment === seg)
      if (!node) {
        node = {
          segment: seg,
          fullPath: pathSoFar,
          driftItem: isLeaf ? driftItem : null,
          children: [],
          worstStatus: isLeaf ? driftItem.status : null,
          counts: { 'source-only': 0, 'target-only': 0, 'modified': 0, 'identical': 0 },
        }
        currentChildren.push(node)
      } else if (isLeaf) {
        node.driftItem = driftItem
        node.worstStatus = worstOf(node.worstStatus, driftItem.status)
      }

      if (isLeaf) {
        node.counts[driftItem.status]++
      }

      currentChildren = node.children
    }
  }

  // Roll up counts and worst status bottom-up
  function rollUp(node: DriftTreeNode): void {
    for (const child of node.children) {
      rollUp(child)
      for (const s of Object.keys(node.counts) as DriftStatus[]) {
        node.counts[s] += child.counts[s]
      }
      if (child.worstStatus) {
        node.worstStatus = worstOf(node.worstStatus, child.worstStatus)
      }
    }
  }

  const fakeRoot: DriftTreeNode = {
    segment: '', fullPath: '', driftItem: null, children: roots,
    worstStatus: null, counts: { 'source-only': 0, 'target-only': 0, 'modified': 0, 'identical': 0 },
  }
  rollUp(fakeRoot)

  return roots
}
