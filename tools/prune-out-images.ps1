#!/usr/bin/env pwsh
# 把「逐帧序列」从**已入库**的图里移出 HEAD（默认只报告，`-Apply` 才 `git rm`）。
#
# 为什么：`**/out/` 有意进版本库当物证（.gitignore 里写着），但**逐帧序列**是其中最重、
# 判据含量最低的一类 —— 判据住在文本报告（哈希清单 ＋ 复跑命令）里，图只是当时"看过"的痕迹。
# 实测 2026-10-06：已入库图 1566 张 / 252.5 MB。
#
# 判据（三条都要满足才删）：
#   ① **目录**里的已入库图 ≥ `-MinRun` 张（默认 20）—— 读数板住小目录（通常 2–7 张），不受影响；
#   ② 该目录**没有被任何文档 / 脚本按路径引用**（`docs/**`、`tools/**`、技能目录）—— 引用过就保留并报出来；
#   ③ 不在 `-Keep` 列出的目录前缀里。
# ⚠️ 第一版按「去掉结尾数字后同名 ≥20 张」判，结果只抓到 8 组 / 26 MB：`out/g07/before` 那 42 张
#    其实混着多个不同前缀（每组 <20），而它**整个目录**显然是一次抽帧 dump ⇒ 判据落在**目录**上才对。
# 保留：所有文本（.txt/.md/.json）· 读数板（小目录）· `.mp4`（交付/渲染产物）· 被引用过的目录。
param(
  [switch]$Apply,
  [int]$MinRun = 20,
  # ⚠️ 收**逗号分隔字符串**再自己拆：`pwsh -File x.ps1 -Keep a,b,c` 在 `-File` 模式下
  #    **不会**把 `a,b,c` 拆成数组（整串当成一个值）⇒ 声明成 `[string[]]` 时它匹配不上任何目录，
  #    参数看着生效、其实没生效（实测踩过：加了三项 Keep，待删数一个字没变）。
  [string]$Keep = ''
)
$ErrorActionPreference = 'Stop'
$ws = "C:\Users\Rotary\Documents\Comprehensive\Files\Video"
$skill = Join-Path $env:USERPROFILE '.dsh\skills\remotion-kits'
$keepList = @($Keep -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
Set-Location $ws

# ── 已入库的图 ────────────────────────────────────────────────────────────────
$imgs = @(git ls-files | Where-Object { $_ -match '\.(png|jpe?g|webp)$' -and (Test-Path $_) })

# ── 按**目录**分组 ────────────────────────────────────────────────────────────
$byDir = @{}
foreach ($f in $imgs) {
  $dir = Split-Path $f -Parent
  if (-not $byDir.ContainsKey($dir)) { $byDir[$dir] = New-Object System.Collections.Generic.List[string] }
  $byDir[$dir].Add($f)
}
# 旁证：这个目录里最大的「同前缀组」有多大（序列的特征），只进报告、不进判据
function Get-MaxPrefixRun([object]$files) {
  $g = @{}
  foreach ($f in $files) {
    $stem = [IO.Path]::GetFileNameWithoutExtension($f) -replace '[-_ ]*\d+$', ''
    if (-not $g.ContainsKey($stem)) { $g[$stem] = 0 }
    $g[$stem]++
  }
  if ($g.Count -eq 0) { return 0 }
  return ($g.Values | Measure-Object -Maximum).Maximum
}

# ── 引用面：文档 / 脚本 / 技能目录里出现过这个目录名的，一律保留 ────────────────
$refText = ''
foreach ($pat in @('docs', 'tools', 'remotion-kit-lab\tools', 'remotion-kit-lab\README.md')) {
  $p = Join-Path $ws $pat
  if (-not (Test-Path $p)) { continue }
  if ((Get-Item $p).PSIsContainer) {
    foreach ($f in (Get-ChildItem $p -Recurse -File -Include *.md, *.ps1, *.cjs, *.mjs, *.txt -ErrorAction SilentlyContinue)) {
      $refText += (Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue)
    }
  } else { $refText += (Get-Content -LiteralPath $p -Raw -ErrorAction SilentlyContinue) }
}
if (Test-Path $skill) {
  foreach ($f in (Get-ChildItem $skill -Recurse -File -Include *.md, *.ps1 -ErrorAction SilentlyContinue)) {
    $refText += (Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue)
  }
}

$remove = New-Object System.Collections.Generic.List[string]
$keptBecauseRef = New-Object System.Collections.Generic.List[string]
$dropped = New-Object System.Collections.Generic.List[object]
foreach ($dir in $byDir.Keys) {
  $files = $byDir[$dir]
  $n = $files.Count
  if ($n -lt $MinRun) { continue }
  $skip = $false
  foreach ($pfx in $keepList) { if ($dir -like "*$pfx*") { $skip = $true } }
  if ($skip) { continue }
  # 引用判据：只认**相对路径**（`out/skin/base-a1` / `remotion-kit-lab/out/skin/base-a1`）。
  # ⚠️ 别拿目录名的最后一段判 —— `run1` / `before` / `f` / `element` 这种名字**哪儿都出现**，
  #    第一版就是这么把全部 8 组真序列都"保留"下来、`待移出 0 张` 的（实测踩过）。
  $rel = ($dir -replace '\\', '/')
  $relTail = ($rel -replace '^.*?out/', 'out/')
  if ($refText.Contains($rel) -or $refText.Contains($relTail)) {
    $keptBecauseRef.Add("$dir（$n 张，最大同前缀组 $(Get-MaxPrefixRun $files)）")
    continue
  }
  $sz = 0; foreach ($f in $files) { $sz += (Get-Item $f).Length }
  $dropped.Add([pscustomobject]@{ Dir = $dir; N = $n; MB = [math]::Round($sz / 1MB, 2); Run = (Get-MaxPrefixRun $files) })
  foreach ($f in $files) { $remove.Add($f) }
}

Write-Host "已入库图 $($imgs.Count) 张 · 判为「整目录抽帧」的：$($dropped.Count) 个目录 / $($remove.Count) 张"
$dropped | Sort-Object MB -Descending | ForEach-Object { "   {0,4} 张  {1,7:N2} MB  {2}   (最大同前缀组 {3})" -f $_.N, $_.MB, $_.Dir, $_.Run }
Write-Host "`n因「被文档/脚本按路径引用」而**保留**的目录/组：$($keptBecauseRef.Count)"
$keptBecauseRef | Sort-Object | ForEach-Object { "   $_" }

$totMB = ($dropped | Measure-Object MB -Sum).Sum
if (-not $totMB) { $totMB = 0 }
Write-Host ("`n合计待移出 {0} 张 / {1:N1} MB（占已入库图 {2:N0}%）" -f $remove.Count, $totMB, (100 * $totMB / (($imgs | ForEach-Object { (Get-Item $_).Length } | Measure-Object -Sum).Sum * 1MB)))

if ($Apply -and $remove.Count -gt 0) {
  for ($i = 0; $i -lt $remove.Count; $i += 200) {
    $chunk = $remove[$i..([Math]::Min($i + 199, $remove.Count - 1))]
    & git rm --quiet --cached -- $chunk | Out-Null
  }
  Write-Host "`n已从索引移出 $($remove.Count) 个文件（工作树的文件也删掉）"
  foreach ($f in $remove) { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue }
} else {
  Write-Host "`n（只报告模式：**没有**调用 git rm）"
}
