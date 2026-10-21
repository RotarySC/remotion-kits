#!/usr/bin/env pwsh
# .kit-origin 代次清理：**默认只报告，不删**（`-Apply` 才真删）。
#
# 为什么需要它：`-Apply` 每次都留一代基线且**不自动清理** ⇒ 按轮数线性长（AGENTS §1.9）。
# 实测 2026-10-06：lab 38 代 / 20 MB · zcode 27 代 / 15 MB。
#
# 判据（保守到「宁可少删」）——**下面这些一律保留**：
#   ① `activeGeneration` 指的那一代（`.origin.json`）—— 它是当前生效的来源记录；
#   ② 最新 `-Keep N` 代（默认 3）；
#   ③ **未完成**的 `plans/**/journal.json` / `runs/**/run.json` 里出现过的代次名 —— 那是**还可能要用的**恢复依据。
# ⚠️ **终态**的计划（`COMMITTED` / `ROLLED_BACK` / `RESTORED` / `COMPLETED`）**不算保留依据** ——
#    第一版把「出现在任何计划 JSON 里」都当依据，结果实测**待删 0**（每一代都被当初那条计划记着名字）。
#    终态计划里的代次名只是**审计线索**；代次目录本身不是它们要用的东西。
# 代价如实记：被删的那几代对应的**旧计划**再 `-Rollback latest` 就没有恢复依据了
# （已 `COMMITTED` 的事务本来也不许退；这一步只让「很久以前那些」彻底不可恢复）。
#
# 用法：
#   pwsh -NoProfile -File tools\prune-kit-origin.ps1                      # 只报告（一个字节都不删）
#   pwsh -NoProfile -File tools\prune-kit-origin.ps1 -Apply               # 真删
#   pwsh -NoProfile -File tools\prune-kit-origin.ps1 -Keep 5 -Apply       # 多留几代
param(
  [switch]$Apply,
  [int]$Keep = 3
)
$ErrorActionPreference = 'Stop'
$ws = "C:\Users\Rotary\Documents\Comprehensive\Files\Video"
$roots = @(
  (Join-Path $ws 'remotion-kit-lab\.kit-origin'),
  (Join-Path $ws 'hotspot-zcode\production\.kit-origin')
)

function Test-Terminal([string]$state) {
  # 终态 = 这件事已经说完话了；非终态才需要代次目录作为恢复依据
  return ($state -match 'COMMITTED|ROLLED_BACK|RESTORED|COMPLETED')
}

function Get-Refs([string]$kitDir) {
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  $terminal = 0
  $live = 0
  foreach ($planDir in (Get-ChildItem (Join-Path $kitDir 'plans') -Directory -ErrorAction SilentlyContinue)) {
    $journal = Join-Path $planDir.FullName 'journal.json'
    # ⚠️ **没有 journal.json 就当终态**：实测（2026-10-06）成功完成的计划只留 `plan.json`，
    #    journal 被清掉了 —— 59 个计划目录里只有 7 个有 journal。第一版把「没有 journal」当成
    #    「状态未知 ⇒ 未完成」，于是把 52 个早已完成的计划当成未完成、`待删` 一路缩到 0（差点白清）。
    $isTerminal = $true
    $state = '(无 journal ⇒ 终态)'
    if (Test-Path $journal) {
      try { $state = (Get-Content -LiteralPath $journal -Raw | ConvertFrom-Json).state } catch { $state = '' }
      $isTerminal = Test-Terminal $state
    }
    if ($isTerminal) { $terminal++ } else { $live++ }
    if ($isTerminal) { continue }   # 终态计划的名字不进保留集
    foreach ($f in (Get-ChildItem $planDir.FullName -Recurse -File -Filter *.json -ErrorAction SilentlyContinue)) {
      $txt = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
      if (-not $txt) { continue }
      foreach ($m in [regex]::Matches($txt, 'g\d{4}')) { $null = $set.Add($m.Value) }
    }
  }
  return [pscustomobject]@{ Refs = $set; Terminal = $terminal; Live = $live }
}

$totalFreed = 0
$totalDeleted = 0
foreach ($root in $roots) {
  if (-not (Test-Path $root)) { Write-Host "（没有 $root）"; continue }
  Write-Host "######## $root"
  # runs/ 是**项目级**的（不属于某个套件）⇒ 也一起算进「引用过就保留」
  $runRefs = New-Object 'System.Collections.Generic.HashSet[string]'
  $runLive = 0; $runTerminal = 0
  foreach ($rj in (Get-ChildItem (Join-Path $root 'runs') -Recurse -File -Filter run.json -ErrorAction SilentlyContinue)) {
    $txt = Get-Content -LiteralPath $rj.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $txt) { continue }
    $st = ''
    try { $st = ($txt | ConvertFrom-Json).state } catch { $st = '' }
    if (Test-Terminal $st) { $runTerminal++ } else { $runLive++ }
    if (Test-Terminal $st) { continue }
    foreach ($m in [regex]::Matches($txt, 'g\d{4}')) { $null = $runRefs.Add($m.Value) }
  }  foreach ($kit in (Get-ChildItem $root -Directory | Where-Object { $_.Name -notin @('runs') })) {
    $og = Join-Path $kit.FullName '.origin.json'
    if (-not (Test-Path $og)) { Write-Host "  [$($kit.Name)] 没有 .origin.json，跳过"; continue }
    $active = (Get-Content -LiteralPath $og -Raw | ConvertFrom-Json).activeGeneration
    $genRoot = Join-Path $kit.FullName 'baselines'
    $gens = Get-ChildItem $genRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name
    if (-not $gens) { Write-Host "  [$($kit.Name)] 没有代次目录"; continue }

    $keepSet = New-Object 'System.Collections.Generic.HashSet[string]'
    $newest = $gens | Select-Object -Last $Keep
    foreach ($g in $newest) { $null = $keepSet.Add($g.Name) }
    if ($active) { $null = $keepSet.Add($active) }
    $refs = Get-Refs $kit.FullName
    foreach ($r in $refs.Refs) { $null = $keepSet.Add($r) }
    foreach ($r in $runRefs) { $null = $keepSet.Add($r) }
    # 只对**真实存在的代次目录**做保留判断（引用过的名字可能早已不存在）
    $existNames = $gens | Select-Object -ExpandProperty Name
    $keepHere = $keepSet | Where-Object { $existNames -contains $_ }

    $del = $gens | Where-Object { $keepHere -notcontains $_.Name }
    $sz = ($del | ForEach-Object { (Get-ChildItem $_.FullName -Recurse -File | Measure-Object Length -Sum).Sum } | Measure-Object -Sum).Sum
    if (-not $sz) { $sz = 0 }
    Write-Host ("  [{0}] 代次 {1} · active={2} · 计划 {3} 条（终态 {4} / 未完成 {5}）· 运行 终态 {6} / 未完成 {7}" -f `
      $kit.Name, $gens.Count, $active, ($refs.Terminal + $refs.Live), $refs.Terminal, $refs.Live, $runTerminal, $runLive)
    Write-Host ("      保留 {0} 代（最新 {1} 代 + active + 未完成事务引用 {2} 个名字）· 待删 {3}（{4:N1} MB）" -f `
      $keepHere.Count, $Keep, ($keepSet.Count - $keepHere.Count), $del.Count, ($sz / 1MB))
    Write-Host ("      保留：{0}" -f (($keepHere | Sort-Object) -join ', '))
    if ($del.Count -gt 0) {
      Write-Host ("      待删：{0}{1}" -f (($del | Select-Object -First 6).Name -join ', '), $(if ($del.Count -gt 6) { ' …' } else { '' }))
    }
    if ($Apply -and $del.Count -gt 0) {
      foreach ($d in $del) { Remove-Item -LiteralPath $d.FullName -Recurse -Force }
      Write-Host "      ⇒ 已删 $($del.Count) 代"
      $totalDeleted += $del.Count
      $totalFreed += $sz
    }
  }
}
if ($Apply) {
  Write-Host ("`n合计删除 {0} 代 · 释放 {1:N1} MB" -f $totalDeleted, ($totalFreed / 1MB))
} else {
  Write-Host "`n（这是**只报告**模式，一个字节都没删 —— 要真删加 -Apply）"
}
