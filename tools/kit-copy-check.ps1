#!/usr/bin/env pwsh
# 四个副本是不是**同一份源码** —— 逐文件 SHA256 两两比对。
#
# 为什么值得一个脚本：架构里「内核只留一份、类型包只放差异」这句话，判据就是这四个位置
# 的内容相等。以前它靠记账（更新器自报 + 独立复核），每次都要现写一遍比对代码；
# 这里把它固定成一条可复跑的命令，**退出码就是判据**。
#
#   0 = 四个位置逐文件哈希全等（含文件集合相等）
#   1 = 有差异（逐条列出）
#   2 = 用法/环境错误（某个位置不存在）
#
# 用法：pwsh -NoProfile -File tools\kit-copy-check.ps1 [-Quiet] [-Override "位置名=路径"]
#      -Override 把某一处指向另一份目录（红证用）：把它指向一份**故意改坏**的临时副本，
#      它必须退出 1 并列出那处差异 —— 不这样做，就无法区分「真的全等」与「脚本根本没在比」。
#      ⚠️ 只有一处能覆盖（`-File` 传进来的参数是字符串，哈希表会被当成字符串而报转换错）。
[CmdletBinding()]
param([switch]$Quiet, [string]$Override)

$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..')

$roots = [ordered]@{
  '母本(技能目录)' = (Join-Path $env:USERPROFILE '.dsh\skills\remotion-kits\kits')
  '仓库镜像'       = (Join-Path $repo 'remotion-kits-v2\kits')
  'lab 副本'       = (Join-Path $repo 'remotion-kit-lab\src\kits')
  'zcode 工程副本' = (Join-Path $repo 'hotspot-zcode\production\src\kits')
}
if ($Override) {
  $parts = $Override.Split('=', 2)
  if ($parts.Count -ne 2 -or -not $roots.Contains($parts[0])) {
    Write-Host "用法：-Override `"位置名=路径`"，位置名取：$($roots.Keys -join ' · ')"
    exit 2
  }
  $roots[$parts[0]] = $parts[1]
}

foreach ($name in $roots.Keys) {
  if (-not (Test-Path $roots[$name])) {
    Write-Host "缺少位置（$name）：$($roots[$name])" -ForegroundColor Red
    exit 2
  }
}

# 相对路径 → SHA256。用相对路径当键，才能同时发现「只在一边有」的文件。
$maps = [ordered]@{}
foreach ($name in $roots.Keys) {
  $base = (Resolve-Path $roots[$name]).Path
  $h = @{}
  foreach ($f in Get-ChildItem $base -Recurse -File) {
    $rel = $f.FullName.Substring($base.Length + 1)
    $h[$rel] = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
  }
  $maps[$name] = $h
  if (-not $Quiet) { "{0,-16} {1,3} 文件" -f $name, $h.Count }
}

$names = @($roots.Keys)
$bad = 0
for ($i = 0; $i -lt $names.Count; $i++) {
  for ($j = $i + 1; $j -lt $names.Count; $j++) {
    $a = $maps[$names[$i]]; $b = $maps[$names[$j]]
    $onlyA = @($a.Keys | Where-Object { -not $b.ContainsKey($_) })
    $onlyB = @($b.Keys | Where-Object { -not $a.ContainsKey($_) })
    $diff  = @($a.Keys | Where-Object { $b.ContainsKey($_) -and $a[$_] -ne $b[$_] })
    $bad += $onlyA.Count + $onlyB.Count + $diff.Count
    if (-not $Quiet) {
      "  {0,-16} vs {1,-16} 只在一侧 {2,2} + {3,2} · 内容不同 {4,2}" -f `
        $names[$i], $names[$j], $onlyA.Count, $onlyB.Count, $diff.Count
    }
    foreach ($p in $onlyA) { Write-Host "     只在 $($names[$i])：$p" -ForegroundColor Yellow }
    foreach ($p in $onlyB) { Write-Host "     只在 $($names[$j])：$p" -ForegroundColor Yellow }
    foreach ($p in $diff)  { Write-Host "     内容不同：$p" -ForegroundColor Yellow }
  }
}

if ($bad -eq 0) {
  if (-not $Quiet) { "全等：四个位置逐文件 SHA256 一致（$($maps[$names[0]].Count) 文件）" }
  exit 0
}
Write-Host "有差异：共 $bad 处" -ForegroundColor Red
exit 1
