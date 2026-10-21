# kit-inventory.ps1 — 套件间的文件重叠与内核复制盘点（阶段 1 / T01-T02 的事实底座）
# 用法: pwsh -NoProfile -File tools\kit-inventory.ps1 [-Root <母本 kits 目录>] [-Json <输出路径>]
# 判据: 输出的是逐文件哈希比对结果，不是手写清单。
[CmdletBinding()]
param(
  [string]$Root = "$env:USERPROFILE\.dsh\skills\remotion-kits\kits",
  [string]$Json
)

$ErrorActionPreference = 'Stop'

function Get-RelFiles([string]$Base) {
  Get-ChildItem -LiteralPath $Base -Recurse -File |
    ForEach-Object { $_.FullName.Substring($Base.Length).TrimStart('\','/').Replace('\','/') }
}

function Get-Hashes([string]$Base) {
  $h = [ordered]@{}
  foreach ($rel in (Get-RelFiles $Base | Sort-Object)) {
    $h[$rel] = (Get-FileHash -LiteralPath (Join-Path $Base $rel) -Algorithm SHA256).Hash
  }
  return $h
}

$core = Join-Path $Root 'kernel'
$hot  = Join-Path $Root 'hotspot'
if (-not (Test-Path $core)) { throw "找不到 kernel: $core" }
if (-not (Test-Path $hot))  { throw "找不到 hotspot: $hot" }

$hCore = Get-Hashes $core
$hHot  = Get-Hashes $hot

$onlyCore = @($hCore.Keys | Where-Object { -not $hHot.Contains($_) })
$onlyHot  = @($hHot.Keys  | Where-Object { -not $hCore.Contains($_) })
$both     = @($hCore.Keys | Where-Object { $hHot.Contains($_) })
$same     = @($both | Where-Object { $hCore[$_] -eq $hHot[$_] })
$diff     = @($both | Where-Object { $hCore[$_] -ne $hHot[$_] })

function Show([string]$Title, $Items) {
  Write-Host ""
  Write-Host "== $Title ($($Items.Count)) =="
  if ($Items.Count -eq 0) { Write-Host "  (无)" } else { $Items | Sort-Object | ForEach-Object { Write-Host "  $_" } }
}

function Top([string]$Rel) {
  $i = $Rel.IndexOf('/')
  if ($i -lt 0) { return '(根)' }
  return $Rel.Substring(0, $i)
}

function ByTop($Items) {
  $g = @{}
  foreach ($r in $Items) { $k = Top $r; if (-not $g.ContainsKey($k)) { $g[$k] = 0 }; $g[$k]++ }
  return $g
}

Write-Host "套件重叠盘点  母本根 = $Root"
Write-Host ("kernel {0} 文件 / hotspot {1} 文件" -f $hCore.Count, $hHot.Count)
Write-Host ("相对路径重叠 {0}  = 内容相同 {1} + 内容不同 {2}" -f $both.Count, $same.Count, $diff.Count)

Show "内容不同（同相对路径）" $diff
Show "只有 kernel 有" $onlyCore
Show "只有 hotspot 有" $onlyHot

Write-Host ""
Write-Host "== 分层计数（只 hotspot 有 / 内容不同 / 只有 kernel 有）=="
$c1 = ByTop $onlyHot; $c2 = ByTop $diff; $c3 = ByTop $onlyCore
$keys = @(($c1.Keys + $c2.Keys + $c3.Keys) | Sort-Object -Unique)
Write-Host ("{0,-22} {1,10} {2,10} {3,10}" -f '顶层目录', '只hotspot', '内容不同', '只core')
foreach ($k in $keys) {
  Write-Host ("{0,-22} {1,10} {2,10} {3,10}" -f $k, [int]$c1[$k], [int]$c2[$k], [int]$c3[$k])
}

Write-Host ""
Write-Host "== 内容相同的文件（= 真·内核复制，按顶层目录）=="
$g = ByTop $same
foreach ($k in ($g.Keys | Sort-Object)) { Write-Host ("  {0,-22} {1,4}" -f $k, $g[$k]) }

if ($Json) {
  $obj = [ordered]@{
    root        = $Root
    coreFiles   = $hCore.Count
    hotFiles    = $hHot.Count
    shared      = $both.Count
    identical   = $same
    different   = $diff
    onlyCore    = $onlyCore
    onlyHotspot = $onlyHot
    kernelDup   = $same
    hashes      = [ordered]@{ kitCore = $hCore; hotspot = $hHot }
  }
  $obj | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $Json -Encoding utf8
  Write-Host ""
  Write-Host "已写出 JSON: $Json"
}
