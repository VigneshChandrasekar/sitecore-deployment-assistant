import type { ParsedPackage, SitecoreItem, DeployMode } from './types'

export type RepackageMode = 'exact' | 'expand-roots'

export interface RepackageClassification {
  /** Root items with NO children in the package — listed individually */
  singles: SitecoreItem[]
  /** Root items that DO have children in the package */
  roots: SitecoreItem[]
  /** All descendants of each root (keyed by root.id) */
  rootChildren: Map<string, SitecoreItem[]>
  /** Media Library items (separate SPE source block) */
  media: SitecoreItem[]
}

// Maps DeployMode to SPE InstallMode name.
const INSTALL_MODE: Partial<Record<DeployMode, string>> = {
  Overwrite: 'Overwrite',
  Merge:     'Merge',
  Skip:      'Skip',
  Delete:    'Delete',
}

const UNDEFINED_GROUP = 'Undefined'

function dbPrefix(db: string): string {
  return db === 'core' ? 'core:' : 'master:'
}

function itemPath(item: SitecoreItem): string {
  return `"${dbPrefix(item.database)}${item.path}"`
}

/** Deduplicate items by path — same item in multiple languages has the same path. */
function dedupeByPath(arr: SitecoreItem[]): SitecoreItem[] {
  const seen = new Set<string>()
  return arr.filter(i => {
    if (seen.has(i.path)) return false
    seen.add(i.path)
    return true
  })
}

export function classifyItems(items: SitecoreItem[]): RepackageClassification {
  const isMedia = (i: SitecoreItem) =>
    i.path.toLowerCase().startsWith('/sitecore/media library') || i.itemType === 'Media'

  const nonMedia = dedupeByPath(items.filter(i => !isMedia(i)))
  const media    = dedupeByPath(items.filter(i => isMedia(i)))

  const itemPathSet = new Set(nonMedia.map(i => i.path))

  const hasParentInPackage = (item: SitecoreItem): boolean => {
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/'))
    return !!parentPath && itemPathSet.has(parentPath)
  }

  const hasChildrenInPackage = (item: SitecoreItem): boolean =>
    nonMedia.some(i => i.path !== item.path && i.path.startsWith(item.path + '/'))

  const roots:   SitecoreItem[] = []
  const singles: SitecoreItem[] = []

  for (const item of nonMedia) {
    if (hasParentInPackage(item)) continue
    if (hasChildrenInPackage(item)) {
      roots.push(item)
    } else {
      singles.push(item)
    }
  }

  const rootChildren = new Map<string, SitecoreItem[]>()
  for (const root of roots) {
    rootChildren.set(
      root.id,
      nonMedia.filter(i => i.path !== root.path && i.path.startsWith(root.path + '/'))
    )
  }

  return { singles, roots, rootChildren, media }
}

/** Group items by deploy mode.
 *  Items with a known mode use it directly.
 *  Items with Undefined mode are grouped under UNDEFINED_GROUP — the generated
 *  script will use a $defaultInstallMode variable the user sets explicitly. */
function groupByMode(items: SitecoreItem[]): Map<string, SitecoreItem[]> {
  const groups = new Map<string, SitecoreItem[]>()
  for (const item of items) {
    const mode = INSTALL_MODE[item.deployMode] ?? UNDEFINED_GROUP
    const bucket = groups.get(mode) ?? []
    bucket.push(item)
    groups.set(mode, bucket)
  }
  return groups
}

// Build the PowerShell script as an array of lines, then join — avoids template-literal
// escaping issues with PowerShell's $ variables and backtick line-continuation.
export function generateRepackageScript(
  pkg: ParsedPackage,
  mode: RepackageMode,
  excludedPaths: Set<string> = new Set(),
): string {
  const raw = classifyItems(pkg.items)

  // Apply exclusions — if a root is excluded, drop it and all its children
  const singles = raw.singles.filter(i => !excludedPaths.has(i.path))
  const roots   = raw.roots.filter(i => !excludedPaths.has(i.path))
  const media   = raw.media.filter(i => !excludedPaths.has(i.path))
  const rootChildren = new Map<string, SitecoreItem[]>()
  for (const root of roots) {
    rootChildren.set(
      root.id,
      (raw.rootChildren.get(root.id) ?? []).filter(c => !excludedPaths.has(c.path))
    )
  }

  const pkgName    = pkg.metadata.name      || 'my-sitecore-package'
  const pkgVersion = pkg.metadata.version   || '1.0'
  const pkgAuthor  = pkg.metadata.author    || 'Your Name'
  const pkgPub     = pkg.metadata.publisher || 'Your Organisation'
  const safeVar    = pkgName.replace(/[^a-zA-Z0-9_]/g, '_')
  const today      = new Date().toISOString().slice(0, 10)
  const modeLabel  = mode === 'exact'
    ? 'Exact — re-creates the same items as the original package'
    : 'Expand Roots — roots re-taken with Get-ChildItem -Recurse (picks up new children)'

  const totalRootDescendants = roots.reduce(
    (s, r) => s + (rootChildren.get(r.id)?.length ?? 0), 0
  )
  const uniquePaths = singles.length + roots.length + totalRootDescendants + media.length

  // ── Flatten all content items for mode grouping ────────────────────────────
  //    exact mode      → every item individually (singles + roots + all children)
  //    expand-roots    → singles individually; roots use -Recurse (children inherit root mode)
  const flatContent: SitecoreItem[] =
    mode === 'exact'
      ? [
          ...singles,
          ...roots.flatMap(r => [r, ...(rootChildren.get(r.id) ?? [])]),
        ]
      : singles   // roots handled separately below

  const contentByMode = groupByMode(flatContent)
  const mediaByMode   = groupByMode(media)

  // For expand-roots: also group roots by their deploy mode
  const rootsByMode = mode === 'expand-roots' ? groupByMode(roots) : new Map<string, SitecoreItem[]>()

  // All modes that appear across content + media + roots
  const allModes = new Set([
    ...contentByMode.keys(),
    ...rootsByMode.keys(),
    ...mediaByMode.keys(),
  ])

  const L: string[] = []

  // ── Header ────────────────────────────────────────────────────────────────
  L.push('# =============================================================================')
  L.push('#  RE-PACKAGE SCRIPT — generated by Sitecore Deployment Assistant')
  L.push('#  Source package : ' + pkgName + ' v' + pkgVersion)
  L.push('#  Generated      : ' + today)
  L.push('#  Mode           : ' + modeLabel)
  L.push('#')
  L.push('#  Item counts')
  L.push('#    Single items     : ' + singles.length)
  if (mode === 'exact') {
    L.push('#    Roots (exact)    : ' + roots.length + ' roots + ' + totalRootDescendants + ' children listed individually')
  } else {
    L.push('#    Roots (+recurse) : ' + roots.length + ' roots — SPE recurses all current children')
    L.push('#    NOTE: Children of a root inherit the root\'s install mode.')
  }
  L.push('#    Media items      : ' + media.length)
  L.push('#    Total in package : ' + pkg.items.length + ' records (' + uniquePaths + ' unique paths)')
  L.push('#')
  L.push('#  HOW TO RUN')
  L.push('#  1. Open Sitecore PowerShell Extensions (SPE) → Script Runner / Console')
  L.push('#  2. Paste this script and press Run')
  L.push('#  3. The .zip is exported to $SitecorePackageFolder and downloaded')
  L.push('# =============================================================================')
  L.push('')

  // ── Metadata ──────────────────────────────────────────────────────────────
  L.push('# ── PACKAGE METADATA ─────────────────────────────────────────────────────────')
  L.push('$package = New-Package "' + pkgName + '"')
  L.push('$package.Sources.Clear()')
  L.push('$package.Metadata.Author    = "' + pkgAuthor + '"')
  L.push('$package.Metadata.Publisher = "' + pkgPub + '"')
  L.push('$package.Metadata.Version   = "' + pkgVersion + '"')
  L.push('$package.Metadata.Readme    = "Re-packaged by Sitecore Deployment Assistant"')
  L.push('')

  // ── Config ────────────────────────────────────────────────────────────────
  const undefinedCount = (contentByMode.get(UNDEFINED_GROUP)?.length ?? 0)
    + (rootsByMode.get(UNDEFINED_GROUP)?.length ?? 0)
    + (mediaByMode.get(UNDEFINED_GROUP)?.length ?? 0)

  L.push('# ── CONFIGURATION ────────────────────────────────────────────────────────────')
  L.push('$packageName         = \'' + safeVar + '\'')
  L.push('$downloadAfterExport = $true')
  if (undefinedCount > 0) {
    L.push('')
    L.push('# ' + undefinedCount + ' item(s) have ItemMode=Undefined in the original package XML.')
    L.push('# Preserved as-is — matches <ItemMode>Undefined</ItemMode> in the package source.')
    L.push('$defaultInstallMode = \'Undefined\'')
  }
  L.push('')

  // ── Item path arrays — one per deploy mode ─────────────────────────────────
  L.push('# ── ITEM PATHS BY INSTALL MODE ───────────────────────────────────────────────')
  L.push('# Each group becomes its own package source with the matching InstallMode.')
  L.push('# This preserves the exact deploy behaviour from the original package.')
  L.push('')

  for (const installMode of allModes) {
    const contentItems = contentByMode.get(installMode) ?? []
    const rootItems    = rootsByMode.get(installMode) ?? []
    const mediaItems   = mediaByMode.get(installMode) ?? []

    if (contentItems.length === 0 && rootItems.length === 0 && mediaItems.length === 0) continue

    const varSuffix = installMode.toLowerCase()

    // Content paths (singles + exact children)
    if (contentItems.length > 0 || mode === 'exact') {
      L.push('# ' + installMode + ' — content items')
      L.push('$content' + installMode + ' = @(')
      if (contentItems.length === 0) {
        L.push('    # (none)')
      } else if (mode === 'exact') {
        // Group by root for readability
        const modeOf = (i: SitecoreItem) => INSTALL_MODE[i.deployMode] ?? UNDEFINED_GROUP
        const rootsInGroup   = roots.filter(r => modeOf(r) === installMode)
        const singlesInGroup = singles.filter(s => modeOf(s) === installMode)
        for (const item of singlesInGroup) {
          L.push('    ' + itemPath(item))
        }
        for (const root of rootsInGroup) {
          const children = rootChildren.get(root.id) ?? []
          L.push('')
          L.push('    # ── ' + root.name + ' (root + ' + children.length + ' children) ──')
          L.push('    ' + itemPath(root))
          for (const child of children) {
            L.push('    ' + itemPath(child))
          }
        }
      } else {
        for (const item of contentItems) {
          L.push('    ' + itemPath(item))
        }
      }
      L.push(')')
      L.push('')
    }

    // Root paths for expand-roots mode
    if (mode === 'expand-roots' && rootItems.length > 0) {
      L.push('# ' + installMode + ' — roots (fetched with Get-ChildItem -Recurse)')
      L.push('$roots' + installMode + ' = @(')
      for (const root of rootItems) {
        const count = rootChildren.get(root.id)?.length ?? 0
        L.push('    ' + itemPath(root) + '   # had ' + count + ' children in original package')
      }
      L.push(')')
      L.push('')
    }

    // Media paths
    if (mediaItems.length > 0) {
      L.push('# ' + installMode + ' — media items')
      L.push('$media' + varSuffix + ' = @(')
      for (const m of mediaItems) {
        L.push('    ' + itemPath(m))
      }
      L.push(')')
      L.push('')
    }
  }

  if (media.length === 0) {
    L.push('# Media Library items')
    L.push('# (none in this package)')
    L.push('')
  }

  // ── Step 1: Collect ───────────────────────────────────────────────────────
  L.push('# =============================================================================')
  L.push('#  STEP 1 – Collect items by install mode')
  L.push('# =============================================================================')
  L.push('Write-Host "`n=== Re-Package: ' + pkgName + ' ===" -ForegroundColor Cyan')
  L.push('')

  for (const installMode of allModes) {
    const contentItems = contentByMode.get(installMode) ?? []
    const rootItems    = rootsByMode.get(installMode) ?? []
    const mediaItems   = mediaByMode.get(installMode) ?? []
    const varSuffix    = installMode.toLowerCase()
    const hasContent   = contentItems.length > 0 || rootItems.length > 0

    // Always initialize the mode variable before any loops that += into it
    if (hasContent) {
      L.push('$items' + installMode + ' = @()')
      if (contentItems.length > 0) {
        L.push('foreach ($path in $content' + installMode + ') {')
        L.push('    $item = Get-Item -Path $path -ErrorAction SilentlyContinue')
        L.push('    if ($item) { Write-Host "  [' + installMode.toUpperCase() + '] $($item.Paths.FullPath)"; $items' + installMode + ' += $item }')
        L.push('    else       { Write-Warning "Not found: $path" }')
        L.push('}')
      }
      if (mode === 'expand-roots' && rootItems.length > 0) {
        L.push('foreach ($path in $roots' + installMode + ') {')
        L.push('    $root = Get-Item -Path $path -ErrorAction SilentlyContinue')
        L.push('    if ($root) {')
        L.push('        $desc = @($root) + @(Get-ChildItem -Path $root.Paths.FullPath -Recurse)')
        L.push('        Write-Host "  [' + installMode.toUpperCase() + '+RECURSE] $($root.Paths.FullPath) ($($desc.Count) items)"')
        L.push('        $items' + installMode + ' += $desc')
        L.push('    } else { Write-Warning "Not found: $path" }')
        L.push('}')
      }
      L.push('')
    }

    if (mediaItems.length > 0) {
      L.push('$mediaItems' + varSuffix + ' = @()')
      L.push('foreach ($path in $media' + varSuffix + ') {')
      L.push('    $item = Get-Item -Path $path -ErrorAction SilentlyContinue')
      L.push('    if ($item) { Write-Host "  [MEDIA-' + installMode.toUpperCase() + '] $($item.Paths.FullPath)"; $mediaItems' + varSuffix + ' += $item }')
      L.push('    else       { Write-Warning "Not found (media): $path" }')
      L.push('}')
      L.push('')
    }
  }

  // ── Step 2: Build sources ─────────────────────────────────────────────────
  L.push('# =============================================================================')
  L.push('#  STEP 2 – Build package sources (one per install mode)')
  L.push('# =============================================================================')

  for (const installMode of allModes) {
    const contentItems = contentByMode.get(installMode) ?? []
    const rootItems    = rootsByMode.get(installMode) ?? []
    const mediaItems   = mediaByMode.get(installMode) ?? []
    const varSuffix  = installMode.toLowerCase()
    const hasContent = contentItems.length > 0 || rootItems.length > 0

    const modeVar    = installMode === UNDEFINED_GROUP ? '$defaultInstallMode' : installMode
    const modeLabel  = installMode === UNDEFINED_GROUP ? 'Undefined (preserved from original package)' : installMode

    if (hasContent) {
      L.push('if ($items' + installMode + '.Count -gt 0) {')
      L.push('    $items' + installMode + ' = $items' + installMode + ' | Sort-Object -Property ID -Unique')
      L.push('    $package.Sources.Add(($items' + installMode + ' | New-ExplicitItemSource `')
      L.push('        -Name        "Content (' + modeLabel + ')" `')
      L.push('        -InstallMode ' + modeVar + '))')
      L.push('    Write-Host "  Source: Content (' + modeLabel + ') — $($items' + installMode + '.Count) items" -ForegroundColor Green')
      L.push('}')
      L.push('')
    }

    if (mediaItems.length > 0) {
      L.push('if ($mediaItems' + varSuffix + '.Count -gt 0) {')
      L.push('    $mediaItems' + varSuffix + ' = $mediaItems' + varSuffix + ' | Sort-Object -Property ID -Unique')
      L.push('    $package.Sources.Add(($mediaItems' + varSuffix + ' | New-ExplicitItemSource `')
      L.push('        -Name        "Media (' + modeLabel + ')" `')
      L.push('        -InstallMode ' + modeVar + '))')
      L.push('    Write-Host "  Source: Media (' + modeLabel + ') — $($mediaItems' + varSuffix + '.Count) items" -ForegroundColor Green')
      L.push('}')
      L.push('')
    }
  }

  // ── Step 3: Export ────────────────────────────────────────────────────────
  L.push('# =============================================================================')
  L.push('#  STEP 3 – Export')
  L.push('# =============================================================================')
  L.push('$zipFileName = "$($packageName)-$($package.Metadata.Version).zip"')
  L.push('$zipFullPath = "$SitecorePackageFolder\\$zipFileName"')
  L.push('')
  L.push('Write-Host "`n[Export] $zipFullPath" -ForegroundColor Yellow')
  L.push('')
  L.push('Export-Package `')
  L.push('    -Project        $package `')
  L.push('    -Path           $zipFileName `')
  L.push('    -Zip `')
  L.push('    -IncludeProject')
  L.push('')
  L.push('Write-Host "Export complete!" -ForegroundColor Green')
  L.push('')
  L.push('if ($downloadAfterExport) {')
  L.push('    Download-File $zipFullPath')
  L.push('}')
  L.push('')

  return L.join('\n')
}

export function downloadRepackageScript(
  pkg: ParsedPackage,
  mode: RepackageMode,
  excludedPaths: Set<string> = new Set(),
): void {
  const script   = generateRepackageScript(pkg, mode, excludedPaths)
  const safeName = (pkg.metadata.name || 'package').replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `${safeName}-repackage.ps1`

  const blob = new Blob([script], { type: 'text/plain;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
