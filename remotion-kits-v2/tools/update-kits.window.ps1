<#
.SYNOPSIS
  U4 的「修前 / 修后」对照读数：**换清单之后、提交日志落盘之前**那个窗口，旧工具留下什么状态。

.DESCRIPTION
  这个窗口的现场是：工程文件已经写成新母本那一版、来源清单也已经换到新代次，
  而事务日志停在前一步（`VALIDATING`）—— 进程就是死在那儿的。

  旧 `Restore-FromJournal` 只退**工程文件**，于是恢复之后：
    · 工程副本 = 旧内容，而**来源记录 = 新内容** ⇒ 下一轮扫描把那些文件读成「工程改过」。
  这就是那个缺陷的形状：恢复「看起来成功了」（退出码 0），而状态是错的。

  ⚠️ 两边**摆现场的方式不同，盘上状态相同**：
  新工具有断点注入（`KITUPD_CRASH_AT`）⇒ 用**真注入**（`AFTER_MANIFEST_SWITCH`），
  它留下的正是「清单已换、运行还没落定」；
  旧工具没有注入点 ⇒ 把它跑到提交完成，再**手工把日志状态改回 `VALIDATING`**
  （旧版的提交序是 `VALIDATING → 换清单 → COMMITTED`，所以那一刻盘上就是 VALIDATING）。
  ⇒ 这个对照量的是**恢复行为**，不是注入机制。真注入那一条另有验收套件 §U4-③ 钉着。

.PARAMETER ToolPath
  被测的更新器。旧工具用 `git show main:remotion-kits-v2/tools/update-kits.ps1` 取出来。

.PARAMETER Label
  报告里那一段的标题（例如「修前」「修后」）。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ToolPath,
  [string]$Label = ''
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $ToolPath)) { throw "找不到更新器：$ToolPath" }
$ToolPath = (Resolve-Path -LiteralPath $ToolPath).Path

$Fx = Join-Path $env:TEMP ("kitupd-window-" + (Get-Random -Minimum 100000 -Maximum 999999))
$MasterKits = Join-Path $Fx 'master\kits'
$Proj = Join-Path $Fx 'proj'

function Write-Text([string]$Path, [string]$Text) {
  $d = Split-Path -Parent $Path
  if ($d -and -not (Test-Path -LiteralPath $d)) { $null = New-Item -ItemType Directory -Force -Path $d }
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}
function Run-Tool {
  param([string[]]$Extra = @())
  $argv = @('-NoProfile', '-File', $ToolPath, '-Project', $Proj, '-MasterRoot', $MasterKits, '-Json') + $Extra
  $raw = & pwsh @argv 2>$null
  $code = $LASTEXITCODE
  $txt = ($raw | Out-String)
  $j = $null
  if ($txt.Trim()) { try { $j = $txt | ConvertFrom-Json } catch { $j = $null } }
  return [pscustomobject]@{ raw = $txt; json = $j; code = $code }
}
function Sha([string]$p) { if (-not (Test-Path -LiteralPath $p)) { return '<不存在>' } return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }
function Gen([string]$kit) {
  $p = Join-Path $Proj ".kit-origin\$kit\.origin.json"
  if (-not (Test-Path -LiteralPath $p)) { return '<无清单>' }
  return [string]((Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json).activeGeneration)
}
function Text([string]$p) { if (-not (Test-Path -LiteralPath $p)) { return '<不存在>' } return [System.IO.File]::ReadAllText($p).Trim() }

$hasInjection = ([System.IO.File]::ReadAllText($ToolPath)).Contains('KITUPD_CRASH_AT')

$null = New-Item -ItemType Directory -Force -Path (Join-Path $MasterKits 'alpha')
$null = New-Item -ItemType Directory -Force -Path $Proj
Write-Text (Join-Path $MasterKits 'alpha\upd.txt') "v1`n"
$null = Run-Tool -Extra @('-Install', '-Force')

$projFile = Join-Path $Proj 'src\kits\alpha\upd.txt'
$before = @{ file = Sha $projFile; gen = Gen 'alpha'; text = Text $projFile }
Write-Text (Join-Path $MasterKits 'alpha\upd.txt') "v2`n"
$null = Run-Tool -Extra @('-Scan')

if ($hasInjection) {
  # 真注入：跑到「清单已换、运行还没落定」的现场
  $env:KITUPD_CRASH_AT = 'AFTER_MANIFEST_SWITCH'
  $ap = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none')
  Remove-Item Env:\KITUPD_CRASH_AT -ErrorAction SilentlyContinue
  $window = "真注入 AFTER_MANIFEST_SWITCH（退出码 $($ap.code)）"
}
else {
  # 旧工具：跑到提交完成，再把日志状态手工改回那一刻的样子
  $ap = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none')
  $planIds = @(Get-ChildItem (Join-Path $Proj '.kit-origin\alpha\plans') -Directory | Sort-Object LastWriteTimeUtc)
  $jPath = Join-Path $planIds[$planIds.Count - 1].FullName 'journal.json'
  $j = Get-Content -LiteralPath $jPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $j.state = 'VALIDATING'
  $j.finishedAt = ''
  ($j | ConvertTo-Json -Depth 16) | Set-Content -LiteralPath $jPath -Encoding utf8NoBOM
  $window = '手工摆到同一盘上状态（日志 = VALIDATING）'
}
$after = @{ file = Sha $projFile; gen = Gen 'alpha'; text = Text $projFile }

$rb = Run-Tool -Extra @('-Rollback', 'latest')
$mid = @{ file = Sha $projFile; gen = Gen 'alpha'; text = Text $projFile }
$sc = Run-Tool -Extra @('-Scan')
$codes = @{}
if ($sc.json) { foreach ($k in $sc.json.kits) { foreach ($e in @($k.entries)) { $codes["$($k.kit)/$($e.path)"] = [string]$e.code } } }

if ($Label) { Write-Host "──────── $Label（$([System.IO.Path]::GetFileName($ToolPath))）" -ForegroundColor Cyan }
Write-Host "窗口现场：$window"
Write-Host "         提交前 文件=$($before.text) 代次=$($before.gen)  →  提交后 文件=$($after.text) 代次=$($after.gen)"
Write-Host "恢复：退出码 = $($rb.code)"
Write-Host "恢复后：文件 = $(Text $projFile)   代次 = $(Gen 'alpha')"
$okFile = ((Text $projFile) -eq 'v1')
$okGen = ((Gen 'alpha') -eq $before.gen)
Write-Host "  文件回到事务前？ $okFile      来源记录回到事务前？ $okGen   （期望 True / True）" -ForegroundColor $(if ($okFile -and $okGen) { 'Green' } else { 'Red' })
$verdict = [string]$codes['alpha/upd.txt']
Write-Host "下一轮扫描的判定： '$verdict'  （期望 update = 仍可更新；local = 被读成「工程改过」而不再更新）" -ForegroundColor $(if ($verdict -eq 'update') { 'Green' } else { 'Red' })
if (-not $verdict) { Write-Host "  ⚠️ 判定读不到（scan 退出码 $($sc.code)）：$((@($sc.raw -split "`n" | Where-Object { $_.Trim() }) | Select-Object -First 6) -join ' | ')" -ForegroundColor Yellow }
Write-Host "夹具：$Fx"
