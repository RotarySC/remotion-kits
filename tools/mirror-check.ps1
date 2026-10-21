<#
  母本 ↔ 镜像 逐文件哈希比对。

  为什么需要它：AGENTS §7 的硬规则是「镜像与母本不一致时不要提交」——
  而一条**没有复测命令**的规则不算规则（AGENTS 开头判据 1）。

  退出码：0 = 全等；1 = 有差异（逐条列出）。
  用法：pwsh -NoProfile -File tools\mirror-check.ps1
#>
[CmdletBinding()]
param(
  [string]$Mother = (Join-Path $env:USERPROFILE '.dsh\skills\remotion-kits'),
  [string]$Mirror = (Join-Path $PSScriptRoot '..\remotion-kits-v2')
)

if (-not (Test-Path $Mother)) { throw "找不到母本技能目录：$Mother" }
if (-not (Test-Path $Mirror)) { throw "找不到镜像目录：$Mirror" }
$Mother = (Resolve-Path $Mother).Path
$Mirror = (Resolve-Path $Mirror).Path

# dist 是生成物（每次跑生成器都覆盖），不参与比对 —— 它的真相是「跑一次生成器」。
function Get-FileMap([string]$root) {
  $map = @{}
  $files = Get-ChildItem $root -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\dist\\' -and $_.FullName -notmatch '\\\.git\\' }
  foreach ($f in $files) {
    $map[$f.FullName.Substring($root.Length)] = (Get-FileHash $f.FullName -Algorithm MD5).Hash
  }
  return $map
}

$m = Get-FileMap $Mother
$v = Get-FileMap $Mirror

$onlyMother = @(); $onlyMirror = @(); $differs = @()
foreach ($k in $m.Keys) {
  if (-not $v.ContainsKey($k)) { $onlyMother += $k }
  elseif ($v[$k] -ne $m[$k]) { $differs += $k }
}
foreach ($k in $v.Keys) { if (-not $m.ContainsKey($k)) { $onlyMirror += $k } }

"母本 $($m.Count) 文件 · 镜像 $($v.Count) 文件（均不含 dist）"
foreach ($k in ($onlyMother | Sort-Object)) { "  只在母本 : $k" }
foreach ($k in ($onlyMirror | Sort-Object)) { "  只在镜像 : $k" }
foreach ($k in ($differs   | Sort-Object)) { "  内容不同 : $k" }

$bad = $onlyMother.Count + $onlyMirror.Count + $differs.Count
if ($bad -eq 0) {
  Write-Host '✅ 全等 —— 可以提交' -ForegroundColor Green
  exit 0
}
Write-Host "❌ $bad 处不一致 —— 先同步（Copy-Item 母本 → 镜像）再提交" -ForegroundColor Red
exit 1
