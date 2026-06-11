import type { SitecoreItem, ItemField } from './types'

// Field types whose values contain Sitecore item IDs
const SINGLE_ID_TYPES = new Set([
  'droplink', 'droptree', 'reference', 'grouped droplink',
  'lookup', 'valuelookup',
])

const MULTI_ID_TYPES = new Set([
  'multilist', 'multilistwithsearch', 'treelist', 'treelistex',
  'checklist', 'nameval list',
])

// General Link XML: <link linktype="internal" id="{...}" />
const GENERAL_LINK_TYPES = new Set(['general link', 'link'])

// Field keys to always skip — Sitecore system fields, not user references
const SKIP_FIELD_KEYS = new Set([
  '__source', '__help link', '__lock', '__owner', '__created by',
  '__updated by', '__workflow', '__workflow state', '__default workflow',
  '__insert rules', '__masters', '__standard values', '__renderings',
  '__final renderings', '__tracking', '__publishing groups',
])

function normaliseId(raw: string): string {
  return raw.replace(/[{}\-]/g, '').toLowerCase().trim()
}

interface ExtractedRef {
  raw:        string  // original value as it appears in the field
  normalised: string  // braces/dashes stripped, lowercased — for comparison only
}

function extractRefs(field: ItemField): ExtractedRef[] {
  const type  = field.type.toLowerCase()
  const value = field.value?.trim()
  if (!value) return []

  if (SINGLE_ID_TYPES.has(type)) {
    const n = normaliseId(value)
    return n.length === 32 ? [{ raw: value, normalised: n }] : []
  }

  if (MULTI_ID_TYPES.has(type)) {
    return value
      .split('|')
      .map(part => ({ raw: part.trim(), normalised: normaliseId(part) }))
      .filter(r => r.normalised.length === 32)
  }

  if (GENERAL_LINK_TYPES.has(type)) {
    const match =
      value.match(/linktype\s*=\s*["']internal["'][^>]*\bid\s*=\s*["'](\{?[0-9A-Fa-f-]{32,36}\}?)["']/i) ??
      value.match(/\bid\s*=\s*["'](\{?[0-9A-Fa-f-]{32,36}\}?)["'][^>]*linktype\s*=\s*["']internal["']/i)
    if (match) {
      const n = normaliseId(match[1])
      return n.length === 32 ? [{ raw: match[1], normalised: n }] : []
    }
  }

  return []
}

export interface MissingReference {
  sourceItemId:    string
  sourceItemName:  string
  sourceItemPath:  string
  fieldKey:        string
  fieldType:       string
  referencedId:    string  // normalised — for internal comparison only, never display
  referencedIdRaw: string  // exactly as it appears in the field value — always use for display
}

export interface ReferenceCheckResult {
  missing: MissingReference[]
  checked: number
}

const TEMPLATE_TYPES = new Set(['Template', 'Template Field', 'Template Section'])

export function checkReferences(items: SitecoreItem[]): ReferenceCheckResult {
  const packageIds = new Set(items.map(i => normaliseId(i.id)))

  const missing: MissingReference[] = []
  let checked = 0

  for (const item of items) {
    if (TEMPLATE_TYPES.has(item.itemType)) continue

    for (const field of item.fields) {
      if (SKIP_FIELD_KEYS.has(field.key.toLowerCase())) continue

      const type = field.type.toLowerCase()
      const isRefType =
        SINGLE_ID_TYPES.has(type) ||
        MULTI_ID_TYPES.has(type)  ||
        GENERAL_LINK_TYPES.has(type)

      if (!isRefType) continue

      const refs = extractRefs(field)
      if (refs.length === 0) continue

      checked++

      for (const ref of refs) {
        if (!packageIds.has(ref.normalised)) {
          missing.push({
            sourceItemId:    item.id,
            sourceItemName:  item.name,
            sourceItemPath:  item.path,
            fieldKey:        field.key,
            fieldType:       field.type,
            referencedId:    ref.normalised,
            referencedIdRaw: ref.raw,
          })
        }
      }
    }
  }

  return { missing, checked }
}
