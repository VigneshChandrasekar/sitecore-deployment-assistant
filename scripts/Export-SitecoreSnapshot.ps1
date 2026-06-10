# =============================================================================
#  Export-SitecoreSnapshot.ps1
#  Run inside Sitecore PowerShell Extensions (SPE) — Script Runner or Console
#
#  Captures a raw item snapshot of core website content for:
#    - Pre-deploy risk analysis  (snapshot + package → find conflicts)
#    - Post-deploy verification  (before vs after → what changed)
#    - Cross-environment diff    (DEV vs UAT vs PROD)
# =============================================================================

# ── CONFIGURE BEFORE RUNNING ──────────────────────────────────────────────────

$Environment = "DEV"     # DEV | UAT | PROD | DR

$OutputPath = "C:\inetpub\wwwroot\snapshots"   # folder where the JSON file will be saved

$SnapshotPaths = @(
    "/sitecore/templates"
    "/sitecore/layout/Renderings"
    "/sitecore/layout/Placeholder Settings"
    "/sitecore/Forms"
)

$Options = @{
    Database              = "master"
    DefaultLanguage       = "en"        # primary language to capture
    AllLanguages          = $false      # true = all languages (much larger output)
    LatestVersionOnly     = $true       # false = capture all versions
    IncludeFieldValues    = $true       # false = metadata only (faster, smaller)
    ExcludeSystemFields   = $true       # skip __field names
    MaxFieldValueLength   = 1000        # truncate field values beyond this
}

# =============================================================================
#  UTILITIES
# =============================================================================

function Write-Log {
    param([string]$Message, [ValidateSet("INFO","WARN","ERROR","SUCCESS","DEBUG")][string]$Level = "INFO")
    $color = switch ($Level) {
        "INFO"    { "Cyan"   }
        "WARN"    { "Yellow" }
        "ERROR"   { "Red"    }
        "SUCCESS" { "Green"  }
        "DEBUG"   { "Gray"   }
    }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')][$Level] $Message" -ForegroundColor $color
}

function Get-ItemFields {
    param([Sitecore.Data.Items.Item]$Item)
    $fields = [ordered]@{}
    if (-not $Options.IncludeFieldValues) { return $fields }

    $Item.Fields.ReadAll()
    foreach ($f in $Item.Fields) {
        if ($Options.ExcludeSystemFields -and $f.Name.StartsWith("__")) { continue }
        if ([string]::IsNullOrWhiteSpace($f.Value)) { continue }
        $val = $f.Value
        if ($val.Length -gt $Options.MaxFieldValueLength) {
            $val = $val.Substring(0, $Options.MaxFieldValueLength) + " ...[truncated]"
        }
        $fields[$f.Name] = $val
    }
    return $fields
}

# =============================================================================
#  SNAPSHOT EXPORT
# =============================================================================

function Export-SnapshotItems {
    param(
        [string[]]$Paths,
        [Sitecore.Data.Database]$Db
    )

    $items   = [System.Collections.Generic.List[object]]::new()
    $errors  = [System.Collections.Generic.List[object]]::new()
    $seenIds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $i       = 0

    foreach ($rootPath in $Paths) {
        $rootItem = $Db.GetItem($rootPath)
        if ($null -eq $rootItem) {
            Write-Log "Path not found (skip): $rootPath" "WARN"
            continue
        }
        Write-Log "Scanning: $rootPath" "INFO"

        $allItems = @($rootItem) + @($rootItem.Axes.GetDescendants())

        foreach ($item in $allItems) {
            $rawId = $item.ID.ToString()
            if (-not $seenIds.Add($rawId)) { continue }
            $i++

            Write-Progress -Activity "Exporting Snapshot" `
                -Status "[$i] $($item.Paths.FullPath)" `
                -PercentComplete -1

            try {
                $languages = if ($Options.AllLanguages) {
                    $item.Languages | ForEach-Object { $_.Name }
                } else {
                    @($Options.DefaultLanguage)
                }

                foreach ($langName in $languages) {
                    $lang     = [Sitecore.Globalization.Language]::Parse($langName)
                    $langItem = $Db.GetItem($item.ID, $lang)
                    if ($null -eq $langItem -or $langItem.Versions.Count -eq 0) { continue }

                    $versions = if ($Options.LatestVersionOnly) {
                        @($langItem.Versions.GetLatestVersion())
                    } else {
                        @($langItem.Versions.GetVersions())
                    }

                    foreach ($ver in $versions) {
                        if ($null -eq $ver) { continue }
                        $ver.Fields.ReadAll()

                        $items.Add([ordered]@{
                            id           = $ver.ID.ToString()
                            name         = $ver.Name
                            path         = $ver.Paths.FullPath
                            templateId   = $ver.TemplateID.ToString()
                            templateName = $ver.TemplateName
                            parentId     = $ver.ParentID.ToString()
                            language     = $langName
                            version      = $ver.Version.Number
                            created      = $ver.Fields["__Created"].Value
                            createdBy    = $ver.Fields["__Created by"].Value
                            updated      = $ver.Fields["__Updated"].Value
                            updatedBy    = $ver.Fields["__Updated by"].Value
                            revision     = $ver.Fields["__Revision"].Value
                            fields       = Get-ItemFields -Item $ver
                        })
                    }
                }
            } catch {
                Write-Log "FAILED: $($item.Paths.FullPath) — $_" "ERROR"
                $errors.Add([ordered]@{
                    itemPath = $item.Paths.FullPath
                    itemId   = $rawId
                    error    = $_.ToString()
                })
            }
        }
    }

    Write-Progress -Activity "Exporting Snapshot" -Completed
    return @{ items = $items.ToArray(); errors = $errors.ToArray() }
}

# =============================================================================
#  MAIN
# =============================================================================

$startTime = Get-Date
Write-Log "================================================" "INFO"
Write-Log "  Sitecore Snapshot Export"                        "INFO"
Write-Log "  Environment : $Environment"                      "INFO"
Write-Log "  Database    : $($Options.Database)"              "INFO"
Write-Log "  Started     : $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))" "INFO"
Write-Log "================================================" "INFO"

$db     = [Sitecore.Configuration.Factory]::GetDatabase($Options.Database)
$result = Export-SnapshotItems -Paths $SnapshotPaths -Db $db

$durationMs = [int]((Get-Date) - $startTime).TotalMilliseconds

$output = [ordered]@{
    "_schemaVersion" = "1.0"
    "_exportedAt"    = $startTime.ToString("o")
    "_environment"   = $Environment

    "exportConfig"   = [ordered]@{
        environment         = $Environment
        database            = $Options.Database
        snapshotPaths       = @($SnapshotPaths)
        allLanguages        = $Options.AllLanguages
        defaultLanguage     = $Options.DefaultLanguage
        latestVersionOnly   = $Options.LatestVersionOnly
        includeFieldValues  = $Options.IncludeFieldValues
        excludeSystemFields = $Options.ExcludeSystemFields
    }

    "summary"        = [ordered]@{
        environment  = $Environment
        totalItems   = $result.items.Count
        totalErrors  = $result.errors.Count
        durationMs   = $durationMs
    }

    "items"          = $result.items
    "errors"         = $result.errors
}

$json       = $output | ConvertTo-Json -Depth 20 -Compress
$fileSizeKb = [math]::Round([System.Text.Encoding]::UTF8.GetByteCount($json) / 1KB, 1)
$fileName   = "sitecore-snapshot.$Environment.$(Get-Date -Format 'yyyyMMdd-HHmm').json"
$filePath   = Join-Path $OutputPath $fileName

if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
}

[System.IO.File]::WriteAllText($filePath, $json, [System.Text.Encoding]::UTF8)
$json | Out-Download -Name $fileName

Write-Log "================================================" "SUCCESS"
Write-Log "  EXPORT COMPLETE"                                  "SUCCESS"
Write-Log "  File       : $filePath  ($fileSizeKb KB)"          "SUCCESS"
Write-Log "  Items      : $($result.items.Count)"             "SUCCESS"
Write-Log "  Errors     : $($result.errors.Count)"            "SUCCESS"
Write-Log "  Duration   : $durationMs ms"                      "SUCCESS"
Write-Log "================================================" "SUCCESS"
