import type { SitecoreItem } from './types'
import type { SnapshotItem } from './snapshot'

export type RiskLevel = 'critical' | 'warning' | 'info' | 'ok'

export type RiskCategory =
  | 'parent-missing'
  | 'template-missing'
  | 'delete-risk'
  | 'overwrite-exists'
  | 'skip-exists'
  | 'new-item'
  | 'safe'

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  'parent-missing':  'Parent Missing',
  'template-missing':'Template Missing',
  'delete-risk':     'Delete Risk',
  'overwrite-exists':'Overwrite Existing',
  'skip-exists':     'Skip (exists)',
  'new-item':        'New Item',
  'safe':            'Safe',
}

export interface Finding {
  level: RiskLevel
  category: RiskCategory
  packageItem: SitecoreItem
  snapshotItem: SnapshotItem | null
  packageName: string
  message: string
  detail: string
}

export interface AnalysisResult {
  findings: Finding[]
  stats: Record<RiskLevel, number>
  categoryStats: Record<RiskCategory, number>
  totalPackageItems: number
  totalSnapshotItems: number
}

function normaliseId(id: string): string {
  return id.replace(/[{}]/g, '').toLowerCase()
}

export function analyzeDeployment(
  packageItems: (SitecoreItem & { _packageName?: string })[],
  snapshotItems: SnapshotItem[]
): AnalysisResult {
  const byId = new Map<string, SnapshotItem>()
  for (const s of snapshotItems) byId.set(normaliseId(s.id), s)

  // Parent/template checks include items being deployed in the same run
  const packageIds = new Set(packageItems.map(i => normaliseId(i.id)))

  const findings: Finding[] = []
  const stats: Record<RiskLevel, number> = { critical: 0, warning: 0, info: 0, ok: 0 }
  const categoryStats: Record<RiskCategory, number> = {
    'parent-missing': 0, 'template-missing': 0, 'delete-risk': 0,
    'overwrite-exists': 0, 'skip-exists': 0, 'new-item': 0, 'safe': 0,
  }

  for (const item of packageItems) {
    const pkgName        = item._packageName ?? ''
    const normId         = normaliseId(item.id)
    const normParent     = normaliseId(item.parentId)
    const normTpl        = normaliseId(item.templateId)
    const existing       = byId.get(normId) ?? null
    const parentExists   = byId.has(normParent) || packageIds.has(normParent)
    const templateExists = byId.has(normTpl)    || packageIds.has(normTpl)

    if (item.deployMode === 'Delete') {
      if (existing) {
        add('critical', 'delete-risk', item, existing, pkgName,
          'Item will be deleted',
          `Exists in snapshot at version ${existing.version}. Deploy mode Delete will remove it.`)
      } else {
        add('info', 'safe', item, null, pkgName,
          'Delete — item not in snapshot',
          'Flagged for deletion but not found in snapshot. No action expected.')
      }
      continue
    }

    if (!existing) {
      if (!parentExists) {
        add('critical', 'parent-missing', item, null, pkgName,
          'Parent item missing',
          `Parent ID ${item.parentId} was not found in the snapshot or this package. Item cannot be created without its parent.`)
      } else if (!templateExists) {
        add('warning', 'template-missing', item, null, pkgName,
          'Template not in snapshot',
          `Template ${item.templateName} (${item.templateId}) was not found in the snapshot or this package.`)
      } else if (item.deployMode === 'Overwrite') {
        // Overwrite on a new item: will forcibly write — treat as warning
        const parentSrc   = !byId.has(normParent) ? 'also in this package' : 'in snapshot'
        const templateSrc = !byId.has(normTpl)    ? 'also in this package' : 'in snapshot'
        add('warning', 'overwrite-exists', item, null, pkgName,
          'Overwrite — will be created (force mode)',
          `New to snapshot but deploy mode is Overwrite. Parent ${parentSrc}, template ${templateSrc}.`)
      } else {
        const parentSrc   = !byId.has(normParent) ? 'also in this package' : 'in snapshot'
        const templateSrc = !byId.has(normTpl)    ? 'also in this package' : 'in snapshot'
        add('info', 'new-item', item, null, pkgName,
          'New item — will be created',
          `Not found in snapshot. Parent ${parentSrc}, template ${templateSrc}.`)
      }
      continue
    }

    if (item.deployMode === 'Overwrite') {
      add('warning', 'overwrite-exists', item, existing, pkgName,
        'Overwrite — existing item will be replaced',
        `Snapshot v${existing.version}, updated ${existing.updated} by ${existing.updatedBy || 'unknown'}.`)
    } else if (item.deployMode === 'Skip') {
      add('info', 'skip-exists', item, existing, pkgName,
        'Skip — already exists, will not be touched',
        `Snapshot v${existing.version}.`)
    } else {
      add('ok', 'safe', item, existing, pkgName,
        `${item.deployMode} — exists, will be merged`,
        `Snapshot v${existing.version}.`)
    }
  }

  return { findings, stats, categoryStats, totalPackageItems: packageItems.length, totalSnapshotItems: snapshotItems.length }

  function add(
    level: RiskLevel, category: RiskCategory,
    packageItem: SitecoreItem, snapshotItem: SnapshotItem | null, packageName: string,
    message: string, detail: string
  ) {
    findings.push({ level, category, packageItem, snapshotItem, packageName, message, detail })
    stats[level]++
    categoryStats[category]++
  }
}
