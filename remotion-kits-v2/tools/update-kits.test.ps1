<#
.SYNOPSIS
  更新器的验收套件 —— 判定表的每种状态各一个用例，另加安全性质与恢复路径。

.DESCRIPTION
  它在一个**临时夹具**里跑，不碰任何真实工程：造一个假母本 ＋ 假工程，把每种状态摆出来，
  用 `-Json` 读回结果逐条断言。

  为什么要有它，而不是「手工试一下就行」：更新器**唯一的价值是安全**——
  「不该动的文件没被动过」这件事**没有症状**。它不会报错，只会安静地把你改过的东西冲掉。
  所以保护性质必须逐文件哈希断言，而不是靠看一眼。

  ## 红证（证明这些断言不是永远绿的）

  ```powershell
  # 把工具拷一份，改坏一处，用 -ToolPath 指过去 —— 测试必须红
  Copy-Item update-kits.ps1 $env:TEMP\broken.ps1
  # 例：让「仅本地修改」也被当成可更新（把 decide 里 local 那一支改掉）
  pwsh -File update-kits.test.ps1 -ToolPath $env:TEMP\broken.ps1
  ```

.PARAMETER ToolPath
  被测的更新器。默认同目录的 `update-kits.ps1`。**红证就靠它**：指到一个改坏的副本上。

.PARAMETER Keep
  留着夹具供人工查看（默认跑完删掉）。

.PARAMETER Filter
  只跑名字里含这个串的用例（调试用）。
#>
[CmdletBinding()]
param(
  [string]$ToolPath = '',
  [switch]$Keep,
  [string]$Filter = ''
)

$ErrorActionPreference = 'Stop'
if (-not $ToolPath) { $ToolPath = Join-Path $PSScriptRoot 'update-kits.ps1' }
if (-not (Test-Path -LiteralPath $ToolPath)) { throw "找不到被测的更新器：$ToolPath" }
$ToolPath = (Resolve-Path -LiteralPath $ToolPath).Path

$Fx = Join-Path $env:TEMP ("kitupd-test-" + (Get-Random -Minimum 100000 -Maximum 999999))
$MasterKits = Join-Path $Fx 'master\kits'
$Proj       = Join-Path $Fx 'proj'
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$script:Passed = 0
$script:Failed = 0
$script:Failures = New-Object System.Collections.Generic.List[string]

function Check([string]$name, $expected, $actual) {
  $e = if ($null -eq $expected) { '<null>' } else { "$expected" }
  $a = if ($null -eq $actual)   { '<null>' } else { "$actual" }
  if ($e -eq $a) { $script:Passed++; Write-Host "  ok    $name" -ForegroundColor DarkGreen }
  else {
    $script:Failed++
    $script:Failures.Add("$name`n        期望 $e`n        实际 $a")
    Write-Host "  FAIL  $name   期望 $e 实际 $a" -ForegroundColor Red
  }
}

function Section([string]$t) { Write-Host ""; Write-Host "── $t" -ForegroundColor Cyan }

function Write-Text([string]$Path, [string]$Text) {
  $d = Split-Path -Parent $Path
  if ($d -and -not (Test-Path -LiteralPath $d)) { $null = New-Item -ItemType Directory -Force -Path $d }
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function P([string]$rel) { return (Join-Path $Proj ("src\kits\" + $rel.Replace('/', '\'))) }
function MM([string]$rel) { return (Join-Path $MasterKits ($rel.Replace('/', '\'))) }

function Get-FileMap([string]$Root) {
  $h = @{}
  if (-not (Test-Path -LiteralPath $Root)) { return $h }
  foreach ($f in (Get-ChildItem -LiteralPath $Root -Recurse -File -Force)) {
    $h[$f.FullName.Substring($Root.Length + 1).Replace('\', '/')] = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
  }
  return $h
}

function Run-Tool {
  param([string]$ProjDir = '', [string[]]$Extra = @(), [string]$Crash = '')
  # `-Crash` 走的是工具自己的 `Invoke-CrashPoint`：没设环境变量时它是空操作，
  # 设了就 `[Environment]::Exit(97)`（**不展开 finally**）—— 那是「进程被杀」的真实形状。
  # 用注入点而不是「把工具改坏一份」，是因为后者改的是**被测对象本身**。
  if ($Crash) { $env:KITUPD_CRASH_AT = $Crash } else { Remove-Item Env:\KITUPD_CRASH_AT -ErrorAction SilentlyContinue }
  if (-not $ProjDir) { $ProjDir = $Proj }
  $argv = @('-NoProfile', '-File', $ToolPath, '-Project', $ProjDir, '-MasterRoot', $MasterKits, '-Json') + $Extra
  $raw = & pwsh @argv 2>$null
  $code = $LASTEXITCODE
  $j = $null
  if ($raw) {
    $txt = ($raw | Out-String).Trim()
    if ($txt) { try { $j = $txt | ConvertFrom-Json } catch { $j = $null } }
  }
  return [pscustomobject]@{ json = $j; code = $code; raw = ($raw | Out-String) }
}

function Get-Codes($j) {
  $h = @{}
  if ($null -eq $j) { return $h }
  foreach ($k in $j.kits) {
    if (-not $k.entries) { continue }
    foreach ($e in $k.entries) { $h["$($k.kit)/$($e.path)"] = [string]$e.code }
  }
  return $h
}

function Get-Note($j, [string]$key) {
  foreach ($k in $j.kits) {
    if (-not $k.entries) { continue }
    foreach ($e in $k.entries) { if ("$($k.kit)/$($e.path)" -eq $key) { return [string]$e.note } }
  }
  return ''
}

function Get-Total($j, [string]$field) {
  if ($null -eq $j -or -not $j.totals) { return -1 }
  if ($null -eq $j.totals.$field) { return 0 }
  return [int]$j.totals.$field
}

# ─────────────────────────────────────────────────────────────────────────────
# 夹具
# ─────────────────────────────────────────────────────────────────────────────

$T0 = [ordered]@{
  'same.txt'        = "same`n"
  'sub/nested.txt'  = "nested`n"
  'upd.txt'         = "v1`n"
  'loc.txt'         = "v1`n"
  'conf.txt'        = "v1`n"
  'conv.txt'        = "v1`n"
  'delmaster.txt'   = "v1`n"
  'dellocal.txt'    = "v1`n"
  'cdm.txt'         = "v1`n"     # 母本删除／本地修改
  'cmd.txt'         = "v1`n"     # 母本修改／本地删除
  'both.txt'        = "v1`n"     # 两边都删除
  'eol.txt'         = "eol`n"
}

function New-Fixture {
  if (Test-Path -LiteralPath $Fx) { Remove-Item -LiteralPath $Fx -Recurse -Force }
  $null = New-Item -ItemType Directory -Force -Path $MasterKits
  $null = New-Item -ItemType Directory -Force -Path (Join-Path $MasterKits 'alpha')
  # 第二个套件：它整轮都不变，用来证明「一个套件的选择器不会让另一个套件报失败」，
  # 以及两个套件各自独立结算。
  $null = New-Item -ItemType Directory -Force -Path (Join-Path $MasterKits 'beta')
  $null = New-Item -ItemType Directory -Force -Path $Proj
  foreach ($rel in $T0.Keys) { Write-Text (MM "alpha/$rel") $T0[$rel] }
  Write-Text (MM 'beta/only.txt') "beta only`n"
  Write-Text (MM 'beta/sub/deep.txt') "deep`n"
  $null = Run-Tool -Extra @('-Install', '-Force')
}

New-Fixture
$install = Run-Tool -Extra @()
Check '夹具：-Install 后应当无待办（exit 0）' 0 $install.code
Check '夹具：安装后全部一致' '14' (Get-Total $install.json 'same')

# ─────────────────────────────────────────────────────────────────────────────
Section '判定表：每种状态各一条'
# ─────────────────────────────────────────────────────────────────────────────

# 母本那一侧
Write-Text (MM 'alpha/upd.txt')    "v2`n"
Write-Text (MM 'alpha/conf.txt')   "m2`n"
Write-Text (MM 'alpha/conv.txt')   "x2`n"
Remove-Item -LiteralPath (MM 'alpha/delmaster.txt') -Force
Remove-Item -LiteralPath (MM 'alpha/cdm.txt') -Force
Write-Text (MM 'alpha/cmd.txt')    "v2`n"
Remove-Item -LiteralPath (MM 'alpha/both.txt') -Force
Write-Text (MM 'alpha/newmaster.txt') "brand new`n"
Write-Text (MM 'alpha/unclaimed.txt') "same both sides`n"
Write-Text (MM 'alpha/conflictname.txt') "master version`n"

# 工程那一侧
Write-Text (P 'alpha/loc.txt')     "p2`n"
Write-Text (P 'alpha/conf.txt')    "p2`n"
Write-Text (P 'alpha/conv.txt')    "x2`n"
Write-Text (P 'alpha/cdm.txt')     "p2`n"
Remove-Item -LiteralPath (P 'alpha/cmd.txt') -Force
Remove-Item -LiteralPath (P 'alpha/dellocal.txt') -Force
Remove-Item -LiteralPath (P 'alpha/both.txt') -Force
Write-Text (P 'alpha/eol.txt')     "eol`r`n"          # 只差行尾
Write-Text (P 'alpha/locnew.txt')  "only local`n"
Write-Text (P 'alpha/unclaimed.txt') "same both sides`n"
Write-Text (P 'alpha/conflictname.txt') "local version`n"

$scan = Run-Tool
$codes = Get-Codes $scan.json
$expect = [ordered]@{
  'alpha/same.txt'          = 'same'
  'alpha/sub/nested.txt'    = 'same'
  'alpha/upd.txt'           = 'update'
  'alpha/loc.txt'           = 'local'
  'alpha/conf.txt'          = 'conflict_mm'
  'alpha/conv.txt'          = 'converged'
  'alpha/delmaster.txt'     = 'upstream_deleted'
  'alpha/dellocal.txt'      = 'local_deleted'
  'alpha/cdm.txt'           = 'conflict_deleted_modified'
  'alpha/cmd.txt'           = 'conflict_modified_deleted'
  'alpha/both.txt'          = 'both_deleted'
  'alpha/eol.txt'           = 'local'
  'alpha/newmaster.txt'     = 'new_upstream'
  'alpha/locnew.txt'        = 'local_only'
  'alpha/unclaimed.txt'     = 'unclaimed_same'
  'alpha/conflictname.txt'  = 'conflict_same_name'
}
foreach ($k in $expect.Keys) { Check "判定 $k" $expect[$k] $codes[$k] }
Check '嵌套路径也被发现' 'same' $codes['alpha/sub/nested.txt']
Check 'autocrlf 诊断写在 note 里' '仅行尾不同（疑似 autocrlf）' (Get-Note $scan.json 'alpha/eol.txt')
Check '有未解决项时 scan 退出码 = 3' 3 $scan.code
Check '可更新 4（upd / conv / newmaster / both）' 4 (Get-Total $scan.json 'apply')
Check '未解决 6' 6 (Get-Total $scan.json 'unresolved')
Check '工程这一侧 4' 4 (Get-Total $scan.json 'local')

# ─────────────────────────────────────────────────────────────────────────────
Section '安全性质：-Apply 只写它该写的，其余逐字节不变'
# ─────────────────────────────────────────────────────────────────────────────

$before = Get-FileMap (Join-Path $Proj 'src\kits')
# 这一次要**人读的收尾语**，所以不走 `-Json`（`-Json` 时人读的走 stderr、JSON 走 stdout）。
$appliedTxt = & pwsh -NoProfile -File $ToolPath -Project $Proj -MasterRoot $MasterKits -Apply -Partial -Verify none 2>&1 | Out-String
$appliedCode = $LASTEXITCODE
$after = Get-FileMap (Join-Path $Proj 'src\kits')

Check '部分更新退出码 = 3（还有未解决项）' 3 $appliedCode
Check '真的写了东西的那一次，收尾语说「这是部分更新」' $true $appliedTxt.Contains('这是**部分更新**')
$shouldChange = @('alpha/upd.txt', 'alpha/newmaster.txt', 'alpha/both.txt', 'alpha/cmd.txt')
foreach ($rel in $before.Keys) {
  if ($shouldChange -contains $rel) { continue }
  if (-not $after.ContainsKey($rel)) { Check "保护 $rel（不该被删）" '存在' '不见了'; continue }
  Check "保护 $rel（字节不变）" $before[$rel] $after[$rel]
}
Check 'upd.txt 刷成了母本那一版' "v2`n" ([System.IO.File]::ReadAllText((P 'alpha/upd.txt')))
Check 'newmaster.txt 被拷进来了' "brand new`n" ([System.IO.File]::ReadAllText((P 'alpha/newmaster.txt')))
Check 'loc.txt 没被动（本地改动）' "p2`n" ([System.IO.File]::ReadAllText((P 'alpha/loc.txt')))
Check 'conf.txt 没被动（冲突）' "p2`n" ([System.IO.File]::ReadAllText((P 'alpha/conf.txt')))
Check 'cdm.txt 没被动（母本删除／本地修改）' "p2`n" ([System.IO.File]::ReadAllText((P 'alpha/cdm.txt')))
Check 'cmd.txt 没被复活（母本修改／本地删除）' $false (Test-Path -LiteralPath (P 'alpha/cmd.txt'))
Check 'dellocal.txt 没被复活（本地删除）'          $false (Test-Path -LiteralPath (P 'alpha/dellocal.txt'))

# 重复应用：不应产生额外变化（幂等）
$again = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none')
$after2 = Get-FileMap (Join-Path $Proj 'src\kits')
$sameCount = 0
foreach ($rel in $after.Keys) { if ($after2[$rel] -eq $after[$rel]) { $sameCount++ } }
Check '再次应用：一个文件都没再变' $after.Count $sameCount

# ─────────────────────────────────────────────────────────────────────────────
Section '未解决项没被静默吞掉，而且没有 -Partial 就拒绝写入'
# ─────────────────────────────────────────────────────────────────────────────

$refuse = Run-Tool -Extra @('-Apply', '-Verify', 'none')
Check '有未解决项且没给 -Partial：退出码 = 3' 3 $refuse.code
# 收尾语必须区分「拒绝写入」与「部分更新」—— 混着说就是让一句总结盖掉事实。
# ⚠️ 判据不能只看「有没有『部分更新』这四个字」：新文案在否定句里也用它。
$refuseTxt = & pwsh -NoProfile -File $ToolPath -Project $Proj -MasterRoot $MasterKits -Apply -Verify none 2>&1 | Out-String
Check '被拒绝的那一次说清了「没有写入任何东西」' $true $refuseTxt.Contains('没有写入任何东西')
Check '被拒绝的那一次不说「这是部分更新」' $false $refuseTxt.Contains('这是**部分更新**')
$after3 = Get-FileMap (Join-Path $Proj 'src\kits')
$unchanged = 0
foreach ($rel in $after2.Keys) { if ($after3[$rel] -eq $after2[$rel]) { $unchanged++ } }
Check '被拒绝的那一次：一个字节都没写' $after2.Count $unchanged

# ─────────────────────────────────────────────────────────────────────────────
Section '裁决：接受上游 / 保留本地并确认'
# ─────────────────────────────────────────────────────────────────────────────

$r1 = Run-Tool -Extra @('-Resolve', 'all', '-Decision', 'keep-local')
Check '写入裁决本身不写工程源码' 0 $r1.code
$after4 = Get-FileMap (Join-Path $Proj 'src\kits')
$same4 = 0
foreach ($rel in $after3.Keys) { if ($after4[$rel] -eq $after3[$rel]) { $same4++ } }
Check '-Resolve 之后工程逐字节未变' $after3.Count $same4

$r2 = Run-Tool -Extra @('-Apply', '-Verify', 'none')
Check '裁决后应用：退出码 3→0（上游接受进度完整）' 0 $r2.code
Check '应用后没有未解决项' 0 (Get-Total $r2.json 'unresolved')
Check 'upd.txt 仍在（已接受）' $true (Test-Path -LiteralPath (P 'alpha/upd.txt'))
Check 'conf.txt 保留本地那一版' "p2`n" ([System.IO.File]::ReadAllText((P 'alpha/conf.txt')))
Check 'unclaimed.txt 被接管（内容相同，只建立来源记录）' $true (Test-Path -LiteralPath (P 'alpha/unclaimed.txt'))

$r3 = Run-Tool
Check '裁决之后：再扫一遍应当无待办' 0 $r3.code
$c3 = Get-Codes $r3.json
Check 'conf.txt 现在的判定是「仅本地修改」' 'local' $c3['alpha/conf.txt']
Check 'cmd.txt 现在的判定是「仅本地删除」' 'local_deleted' $c3['alpha/cmd.txt']

# ─────────────────────────────────────────────────────────────────────────────
Section '删除记录与「上游重新引入」'
# ─────────────────────────────────────────────────────────────────────────────

Remove-Item -LiteralPath (P 'alpha/delmaster.txt') -Force
$r4 = Run-Tool
$c4 = Get-Codes $r4.json
# 此时基线里那条已经是「不存在」（上一步保留了本地、B 记成了删除），所以两边都删之后
# 它与基线的说法**已经一致** —— 判定是 same，不是「又发现一次两边都删」。
Check '两边都删且基线已记「不存在」→ 判定一致' 'same' $c4['alpha/delmaster.txt']
Check '两边都删了不算未解决项' 0 (Get-Total $r4.json 'unresolved')
$r4a = Run-Tool -Extra @('-Apply', '-Verify', 'none')
Check '自动推进之后无待办' 0 $r4a.code
# 这一步之后，清单里应当留着这条路径的**删除记录** —— 下一节的「重新引入」靠它。
$r4b = Run-Tool
Check '删除记录留下之后，它安静了（不再是待办）' 0 $r4b.code

Write-Text (MM 'alpha/delmaster.txt') "back`n"
$r5 = Run-Tool
$c5 = Get-Codes $r5.json
Check '母本重新引入该路径 → 报「上游重新引入」，不自动写回' 'reintroduced' $c5['alpha/delmaster.txt']
Check '上游重新引入属于未解决项（退出码 3）' 3 $r5.code
Check '母本重新引入时，工程里还没被写进来' $false (Test-Path -LiteralPath (P 'alpha/delmaster.txt'))
Check 'note 里带上了删除记录' '该路径有过删除记录' (Get-Note $r5.json 'alpha/delmaster.txt')

$r6 = Run-Tool -Extra @('-Resolve', 'alpha/delmaster.txt', '-Decision', 'accept-upstream')
Check '明确接受重新引入：写入计划成功' 0 $r6.code
$r7 = Run-Tool -Extra @('-Apply', '-Verify', 'none')
Check '应用重新引入' 0 $r7.code
Check '文件真的回来了' "back`n" ([System.IO.File]::ReadAllText((P 'alpha/delmaster.txt')))

$r8 = Run-Tool -Extra @('-Scan')
$r8b = Run-Tool -Extra @('-Resolve', 'alpha/nosuchfile.txt', '-Decision', 'keep-local')
Check '裁决选择器写错 → 拒绝（不静默通过）' 2 $r8b.code

# ─────────────────────────────────────────────────────────────────────────────
Section '多套件：选择器只作用于它点名的那个套件'
# ─────────────────────────────────────────────────────────────────────────────

Write-Text (MM 'alpha/same.txt') "m2`n"
Write-Text (P  'alpha/same.txt') "p2`n"
$mkscan = Run-Tool
Check '造出一个新的冲突（alpha）' 1 (Get-Total $mkscan.json 'unresolved')

$mk1 = Run-Tool -Extra @('-Resolve', 'alpha/same.txt', '-Decision', 'keep-local')
Check '点名 alpha 的裁决：不因 beta 而失败（退出码 0）' 0 $mk1.code
Check '裁决确实落到 alpha 那一条上' 1 (@($mk1.json.kits | Where-Object { $_.kit -eq 'alpha' }).resolved.Count)

$mk2 = Run-Tool -Extra @('-Resolve', 'beta/nothing.txt', '-Decision', 'keep-local')
Check '点名一个没有未解决条目的路径 → 拒绝' 2 $mk2.code
$mk3 = Run-Tool -Extra @('-Resolve', 'nosuchkit/x.txt', '-Decision', 'keep-local')
Check '点名一个不存在的套件 → 拒绝（不被当成「不是我的」静默落空）' 2 $mk3.code

$mk4 = Run-Tool -Extra @('-Apply', '-Verify', 'none')
Check '应用之后 alpha 归零' 0 $mk4.code

# ─────────────────────────────────────────────────────────────────────────────
Section '-Adopt：只在逐字节全等时建立基线'
# ─────────────────────────────────────────────────────────────────────────────

$p2 = Join-Path $Fx 'proj-adopt-equal'
$null = New-Item -ItemType Directory -Force -Path $p2
Copy-Item (Join-Path $MasterKits 'alpha') (Join-Path $p2 'src\kits\alpha') -Recurse -Force
$a1 = & pwsh -NoProfile -File $ToolPath -Project $p2 -MasterRoot $MasterKits -Json -Adopt 2>$null
$j1 = (($a1 | Out-String).Trim() | ConvertFrom-Json)
Check '全等的副本：-Adopt 成功' 'adopted' ([string]$j1.kits[0].state)

$p3 = Join-Path $Fx 'proj-adopt-uneven'
$null = New-Item -ItemType Directory -Force -Path $p3
Copy-Item (Join-Path $MasterKits 'alpha') (Join-Path $p3 'src\kits\alpha') -Recurse -Force
Write-Text (Join-Path $p3 'src\kits\alpha\upd.txt') "locally tweaked`n"
$a2 = & pwsh -NoProfile -File $ToolPath -Project $p3 -MasterRoot $MasterKits -Json -Adopt 2>$null
$j2 = (($a2 | Out-String).Trim() | ConvertFrom-Json)
Check '有差异的副本：-Adopt 拒绝（不猜「落后还是改过」）' 'refused' ([string]$j2.kits[0].state)
# 拒绝时那句总结**不能**说「已建立基线」—— 它会盖掉上面那条拒绝理由。
$a2txt = & pwsh -NoProfile -File $ToolPath -Project $p3 -MasterRoot $MasterKits -Adopt 2>&1 | Out-String
Check '被拒绝时不打印「已建立基线」' $false $a2txt.Contains('已建立基线')
Check '被拒绝时基线确实没有建立' $false (Test-Path (Join-Path $p3 '.kit-origin\alpha\.origin.json'))

$a3 = & pwsh -NoProfile -File $ToolPath -Project $p3 -MasterRoot $MasterKits -Json -Adopt -AttestMaster 2>$null
$j3 = (($a3 | Out-String).Trim() | ConvertFrom-Json)
Check '显式承认之后才建立基线' 'adopted' ([string]$j3.kits[0].state)
$a4 = & pwsh -NoProfile -File $ToolPath -Project $p3 -MasterRoot $MasterKits -Json 2>$null
$j4 = (($a4 | Out-String).Trim() | ConvertFrom-Json)
$c4 = Get-Codes $j4
Check '承认的后果：那个文件变成「仅本地修改」而不再被更新' 'local' $c4['alpha/upd.txt']

# ─────────────────────────────────────────────────────────────────────────────
Section '恢复：验证失败 → 回滚；未完成事务 → 拦下来'
# ─────────────────────────────────────────────────────────────────────────────

# 造一个会「写后才失败」的 tsc：写前工程里是 v1（不含 BROKEN），写后是 v2（含 BROKEN）。
$binDir = Join-Path $Proj 'node_modules\.bin'
$null = New-Item -ItemType Directory -Force -Path $binDir
$stub = @'
@echo off
findstr /C:"BROKEN" "%~dp0..\..\src\kits\alpha\upd.txt" >nul 2>&1
if %ERRORLEVEL%==0 (
  echo 注入的失败：upd.txt 里出现了 BROKEN
  exit /b 1
)
exit /b 0
'@
[System.IO.File]::WriteAllText((Join-Path $binDir 'tsc.cmd'), $stub.Replace("`n", "`r`n"))

# 计划是「扫描那一刻」的母本快照：母本之后变了就必须重出计划，或者明确说「就用旧快照」。
Write-Text (MM 'alpha/upd.txt') "v2-BROKEN`n"
$moved = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none')
Check '母本在计划之后变过 → 拒绝（不混用两种来源）' 4 $moved.code
$movedPinned = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none', '-Pinned')
Check '-Pinned：明确表示就用计划里那个快照' $true ($movedPinned.code -ne 4)

$null = Run-Tool -Extra @('-Scan')      # 重新出一份针对**现在这份**母本的计划
$pre = Get-FileMap (Join-Path $Proj 'src\kits')
$preText = [System.IO.File]::ReadAllText((P 'alpha/upd.txt'))
$v1 = Run-Tool -Extra @('-Apply', '-Partial')
Check '写后验证失败 → 已回滚（退出码 5）' 5 $v1.code
$post = Get-FileMap (Join-Path $Proj 'src\kits')
$restored = 0
foreach ($rel in $pre.Keys) { if ($post[$rel] -eq $pre[$rel]) { $restored++ } }
Check '回滚之后：工程逐字节回到写之前' $pre.Count $restored
Check 'upd.txt 回到写之前那一版' $preText ([System.IO.File]::ReadAllText((P 'alpha/upd.txt')))

# 未完成事务：手工造一个「写到一半」的现场，验证它会被拦下来、并且能恢复
$panId = 'interrupted-test'
$panDir = Join-Path (Join-Path $Proj '.kit-origin\alpha\plans') $panId
$null = New-Item -ItemType Directory -Force -Path (Join-Path $panDir 'before')
$origText = [System.IO.File]::ReadAllText((P 'alpha/upd.txt'))
$origSha = (Get-FileHash -LiteralPath (P 'alpha/upd.txt') -Algorithm SHA256).Hash
[System.IO.File]::WriteAllText((Join-Path $panDir 'before\upd.txt'), $origText, (New-Object System.Text.UTF8Encoding($false)))
Write-Text (P 'alpha/upd.txt') "half-written`n"
$newSha = (Get-FileHash -LiteralPath (P 'alpha/upd.txt') -Algorithm SHA256).Hash
$jn = [ordered]@{
  journalFormatVersion = 1; planId = $panId; kit = 'alpha'; state = 'WRITING'; startedAt = (Get-Date).ToString('o')
  validation = $null
  steps = @([ordered]@{ seq = 1; path = 'upd.txt'; action = 'write'; beforeExists = $true; beforeSha = $origSha
                        afterExists = $true; afterSha = $newSha; done = $true; at = (Get-Date).ToString('o') })
}
($jn | ConvertTo-Json -Depth 8) | Set-Content -LiteralPath (Join-Path $panDir 'journal.json') -Encoding utf8NoBOM

$blocked = Run-Tool
Check '有未完成事务：scan 被拦下（退出码 6）' 6 $blocked.code
Check '拦下来时工程没被动' "half-written`n" ([System.IO.File]::ReadAllText((P 'alpha/upd.txt')))

$rb = Run-Tool -Extra @('-Rollback', 'latest')
Check '恢复未完成事务' 0 $rb.code
Check '恢复之后内容回到事务之前' $origText ([System.IO.File]::ReadAllText((P 'alpha/upd.txt')))
$afterRb = Run-Tool
Check '恢复之后不再被拦（不再是 6）' $true ($afterRb.code -ne 6)

# ─────────────────────────────────────────────────────────────────────────────
Section '跨套件：**写入按套件做，验证按整个工程做**（缺陷 10）'
# ─────────────────────────────────────────────────────────────────────────────

# 现场：**先写的套件依赖后写的套件**带来的新文件 —— 类型包 import 内核新增文件，
# 正是 T01/T02 拆分之后的正常形状。
# 逐套件「写 → 验证 → 失败就回滚」时：alpha（按名字排序在前）写完就立刻跑 tsc，
# 那一刻 beta 的新文件还没写 → 判成「写前通过 · 写后失败」→ 回滚已写的一半、退出码 5，
# 而**再跑一次就好了**（第二次 beta 已经在了）。实测在 lab 与 zcode 上都复现过。
# 判据：**一次** `-Apply` 就要成功 —— 而不是「跑两次也能得到正确结果」。
# ⚠️ 桩的写法有讲究：**不要用嵌套括号 ＋ `%ERRORLEVEL%`** ——
# `%ERRORLEVEL%` 在复合语句里是**解析时**展开的，实测会得到与预期相反的结果
# （红证第一版就是这么假绿的）。用 `if errorlevel` ＋ 标签，不踩那个坑。
$stubCross = @'
@echo off
findstr /C:"v3" "%~dp0..\..\src\kits\alpha\upd.txt" >nul 2>&1
if errorlevel 1 goto :ok
if exist "%~dp0..\..\src\kits\beta\newdep.txt" goto :ok
echo 注入的失败：alpha 已更新，而 beta/newdep.txt 还没写
exit /b 1
:ok
exit /b 0
'@
[System.IO.File]::WriteAllText((Join-Path $binDir 'tsc.cmd'), $stubCross.Replace("`n", "`r`n"))

Write-Text (MM 'beta/newdep.txt') "dep`n"      # beta：首次母本新增（后写）
Write-Text (MM 'alpha/upd.txt') "v3`n"         # alpha：仅母本修改（先写）
$null = Run-Tool                               # 出一份针对现在这份母本的计划

$cross = Run-Tool -Extra @('-Apply', '-Partial')
Check '跨套件新增文件：一次 -Apply 就成功（不是退出码 5）' $true ($cross.code -ne 5)
Check '先写的那个套件：新版本真的写进去了' "v3`n" ([System.IO.File]::ReadAllText((P 'alpha/upd.txt')))
Check '后写的那个套件：新文件也真的写进去了' $true (Test-Path -LiteralPath (P 'beta/newdep.txt'))

# 提交真的发生了（不是靠「回滚之后恰好看起来对」）—— 判据取**应用后的判定表**：
# 这两条都不该再是「可更新」。拿状态而不是拿「文件在不在」，才分得清「提交」与「还没跑」。
$crossAfter = Run-Tool
$crossCodes = Get-Codes $crossAfter.json
Check '提交发生了：alpha/upd.txt 不再是「可更新」' $true ($crossCodes['alpha/upd.txt'] -ne 'update')
Check '提交发生了：beta/newdep.txt 不再是「首次母本新增」' $true ($crossCodes['beta/newdep.txt'] -ne 'new_upstream')

# ─────────────────────────────────────────────────────────────────────────────
Section '越界路径：计划与日志是**不可信输入**，动手之前就要拒绝'
# ─────────────────────────────────────────────────────────────────────────────

$null = Run-Tool
$pdirs = Get-ChildItem (Join-Path $Proj '.kit-origin\alpha\plans') -Directory | Sort-Object LastWriteTimeUtc
$curPlanDir = ($pdirs | Select-Object -Last 1).FullName

# 往计划里塞一条 `../` 条目：不加防护的话，它会写到套件目录外面去。
$pj = Get-Content (Join-Path $curPlanDir 'plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$pj.entries = @($pj.entries) + @([pscustomobject]@{
  path = '../escaped.txt'; code = 'update'
  b = [pscustomobject]@{ exists = $false; sha256 = '' }
  m = [pscustomobject]@{ exists = $true;  sha256 = 'deadbeef' }
  p = [pscustomobject]@{ exists = $false; sha256 = '' }
  note = ''; resolution = ''; action = ''
})
($pj | ConvertTo-Json -Depth 14) | Set-Content -LiteralPath (Join-Path $curPlanDir 'plan.json') -Encoding utf8NoBOM
# 连**暂存内容**也放好：这样一旦少了防护，它会真的写到套件目录外面去 ——
# 红证才有意义（否则写入会因为「找不到暂存文件」而失败，红得不明不白）。
Write-Text (Join-Path $curPlanDir 'escaped.txt') "escaped!"

$esc = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none')
Check '计划里有越界路径 → 拒绝，退出码 4' 4 $esc.code
Check '越界路径没有被写出去（套件目录外）' $false (Test-Path -LiteralPath (Join-Path $Proj 'src\kits\escaped.txt'))
Check '越界路径没有被写出去（工程根）' $false (Test-Path -LiteralPath (Join-Path $Proj 'escaped.txt'))

# 日志同理：回滚会按日志删文件，一条 `../` 就能删到套件目录外面。
$outFile = Join-Path $Proj 'src\kits\escaped2.txt'
Write-Text $outFile "should survive"
$outSha = (Get-FileHash -LiteralPath $outFile -Algorithm SHA256).Hash
$txId = 'unsafe-path-test'
$txDir = Join-Path (Join-Path $Proj '.kit-origin\alpha\plans') $txId
$null = New-Item -ItemType Directory -Force -Path $txDir
$jnUnsafe = [ordered]@{
  journalFormatVersion = 1; planId = $txId; kit = 'alpha'; state = 'WRITING'; startedAt = (Get-Date).ToString('o')
  validation = $null
  steps = @([ordered]@{ seq = 1; path = '../escaped2.txt'; action = 'delete'; beforeExists = $true; beforeSha = $outSha
                        afterExists = $true; afterSha = $outSha; done = $true; at = (Get-Date).ToString('o') })
}
($jnUnsafe | ConvertTo-Json -Depth 8) | Set-Content -LiteralPath (Join-Path $txDir 'journal.json') -Encoding utf8NoBOM
$rbUnsafe = Run-Tool -Extra @('-Rollback', $txId)
Check '日志里的越界条目被拒绝执行（需要人工恢复，退出码 6）' 6 $rbUnsafe.code
Check '套件目录外的文件没有被删' $true (Test-Path -LiteralPath $outFile)
Remove-Item -LiteralPath $outFile -Force
Remove-Item -LiteralPath $txDir -Recurse -Force

# ─────────────────────────────────────────────────────────────────────────────
Section '来源状态无效：基线坏了就报，不自动重建'
# ─────────────────────────────────────────────────────────────────────────────

$genDir = Join-Path $Proj '.kit-origin\alpha\baselines'
$gen = (Get-ChildItem -LiteralPath $genDir -Directory | Sort-Object Name | Select-Object -Last 1).Name
Add-Content -LiteralPath (Join-Path $genDir "$gen\same.txt") -Value 'tampered'
$bad = Run-Tool
Check '基线内容与清单不符 → 退出码 4' 4 $bad.code
Check '状态标成 invalid-origin' 'invalid-origin' ([string]$bad.json.kits[0].state)
$badApply = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none')
Check '来源状态无效时拒绝应用' 4 $badApply.code

# ─────────────────────────────────────────────────────────────────────────────
Section 'U4：完整恢复事务（**真实断点注入** —— 跑的是真路径，不是重写过的一份）'
# ─────────────────────────────────────────────────────────────────────────────
#
# 这一节测的是「进程在半路被杀之后，盘上留下了什么、下一次能不能接着走」。
# 每条用例都检查五样：**文件哈希 · 来源清单 · 基线代次 · 事务与运行记录 · 恢复后的下一次扫描判定**。
# 只查退出码或文件个数不够 —— 那些东西在一次「看起来像成功」的半更新里全都正常。

function Get-PlanIds([string]$kit) {
  $root = Join-Path $Proj ".kit-origin\$kit\plans"
  if (-not (Test-Path -LiteralPath $root)) { return @() }
  return @(Get-ChildItem -LiteralPath $root -Directory | Sort-Object LastWriteTimeUtc, Name | Select-Object -ExpandProperty Name)
}
function Get-LatestPlanId([string]$kit) {
  $ids = @(Get-PlanIds $kit)
  if ($ids.Count -eq 0) { return '' }
  return $ids[$ids.Count - 1]
}
function Get-JN([string]$kit, [string]$planId) {
  $p = Join-Path $Proj ".kit-origin\$kit\plans\$planId\journal.json"
  if (-not (Test-Path -LiteralPath $p)) { return $null }
  return (Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json)
}
function Get-LatestJN([string]$kit) { return (Get-JN $kit (Get-LatestPlanId $kit)) }
function Get-StepN($jn, [int]$i) {
  # ConvertFrom-Json 对**单元素**数组的行为在不同版本里不一样 ⇒ 显式判类型，别拿 `[0]` 赌。
  # 空数组也要挡住：`@()[0]` 在某些情形下是**终止错误**，会把整轮断言打断（实测踩过）。
  $s = $jn.steps
  if ($s -is [System.Collections.IList]) { if ($s.Count -le $i) { return $null } return $s[$i] }
  return $s
}
function Get-MfPath([string]$kit) { return (Join-Path $Proj ".kit-origin\$kit\.origin.json") }
function Get-MfGen([string]$kit) {
  $p = Get-MfPath $kit
  if (-not (Test-Path -LiteralPath $p)) { return '<无清单>' }
  return [string]((Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json).activeGeneration)
}
function Get-MfSha([string]$kit) {
  $p = Get-MfPath $kit
  if (-not (Test-Path -LiteralPath $p)) { return '<无清单>' }
  return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash
}
function PK([string]$kit, [string]$rel) { return (Join-Path $Proj ("src\kits\" + $kit + "\" + $rel.Replace('/', '\'))) }
function Sha([string]$path) {
  # ⚠️ 名字不要用一个字母：`h` 是 `Get-History` 的**别名**，而别名比函数的优先级高 ——
  # 实测 `H <路径>` 会被当成 `Get-History -Id <路径>`，报「无法绑定参数 'Id'」。
  if (-not (Test-Path -LiteralPath $path)) { return '<不存在>' }
  return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
}
function Txt([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return '<不存在>' }
  return [System.IO.File]::ReadAllText($path)
}
function Get-LatestRun {
  $root = Join-Path $Proj '.kit-origin\runs'
  if (-not (Test-Path -LiteralPath $root)) { return $null }
  $d = @(Get-ChildItem -LiteralPath $root -Directory | Sort-Object Name)
  if ($d.Count -eq 0) { return $null }
  return (Get-Content -LiteralPath (Join-Path $d[$d.Count - 1].FullName 'run.json') -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Get-RunParticipants($j) {
  # 结构化字段也要**防着取**：形状不对时返回空数组，让断言**报红**，
  # 而不是让 `[0]` 抛异常把整轮断言打断（实测踩过：R3 红证就断在这儿）。
  if ($null -eq $j -or $null -eq $j.run) { return @() }
  return @($j.run.participants)
}

# ── ① 项目文件写入后、完成标记落盘前 ───────────────────────────────────────────
New-Fixture
$oldUpd = Txt (PK 'alpha' 'upd.txt')
Write-Text (MM 'alpha/upd.txt') "v2`n"
$cr1 = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'AFTER_FILE_WRITE'
Check '① 注入断点：进程被强制终止（退出码 97）' 97 $cr1.code
$jn = Get-LatestJN 'alpha'
Check '① 现场：日志停在 WRITING' 'WRITING' ([string]$jn.state)
Check '① 现场：那一步的完成标记**没**落盘' 'False' ([string](Get-StepN $jn 0).done)
Check '① 现场：文件其实已经写了（新内容）' (Sha (MM 'alpha/upd.txt')) (Sha (PK 'alpha' 'upd.txt'))
Check '① 现场：预期写后哈希事先就在日志里 —— 这就是恢复依据' ([string](Get-StepN $jn 0).afterSha) (Sha (PK 'alpha' 'upd.txt'))
Check '① 现场：运行记录还没完成' 'RUNNING' ([string](Get-LatestRun).state)
$rb1 = Run-Tool -Extra @('-Rollback', 'latest')
Check '① 恢复：退出码 0' 0 $rb1.code
Check '① 恢复：文件回到事务之前那一版' $oldUpd (Txt (PK 'alpha' 'upd.txt'))
Check '① 恢复：日志落 RESTORED' 'RESTORED' ([string]((Get-LatestJN 'alpha').state))
Check '① 恢复：运行记录落 ROLLED_BACK' 'ROLLED_BACK' ([string](Get-LatestRun).state)
$sc1 = Run-Tool
Check '① 恢复后：扫描不再被拦（不是 6）' $true ($sc1.code -ne 6)
Check '① 恢复后：仍报「可更新」（基线没被推进）' 'update' ([string](Get-Codes $sc1.json)['alpha/upd.txt'])

# ── ② 新代次建好、清单切换前 ──────────────────────────────────────────────────
New-Fixture
$oldUpd = Txt (PK 'alpha' 'upd.txt'); $oldGen = Get-MfGen 'alpha'; $oldMf = Get-MfSha 'alpha'
Write-Text (MM 'alpha/upd.txt') "v2`n"
$cr2 = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'AFTER_NEWGEN'
Check '② 注入断点：进程被强制终止' 97 $cr2.code
$jn = Get-LatestJN 'alpha'
# 断点落在「新代次建好」之后、「记 COMMITTING」之前 ⇒ 此刻日志停在 VALIDATING。
# 顺序照抄方案 §3.4：**建代次 → 记 COMMITTING → 再换清单**。
Check '② 现场：日志停在 VALIDATING（提交阶段还没开始记账）' 'VALIDATING' ([string]$jn.state)
Check '② 现场：清单还没换（switched=false）' 'False' ([string]$jn.manifest.switched)
Check '② 现场：清单文件逐字节仍是事务前那一份' $oldMf (Get-MfSha 'alpha')
Check '② 现场：生效代次还是原来那一代' $oldGen (Get-MfGen 'alpha')
Check '② 现场：工程文件已经换成新的（回退要做的事是真的）' (Sha (MM 'alpha/upd.txt')) (Sha (PK 'alpha' 'upd.txt'))
Check '② 现场：新代次目录已建好（它是恢复依据，不该被清掉）' $true `
      (Test-Path -LiteralPath (Join-Path $Proj ".kit-origin\alpha\baselines\$($jn.manifest.activeGenerationAfter)"))
$rb2 = Run-Tool -Extra @('-Rollback', 'latest')
Check '② 恢复：退出码 0' 0 $rb2.code
Check '② 恢复：文件回到事务前' $oldUpd (Txt (PK 'alpha' 'upd.txt'))
Check '② 恢复：生效代次回到原来那一代' $oldGen (Get-MfGen 'alpha')
Check '② 恢复：清单逐字节回到事务前' $oldMf (Get-MfSha 'alpha')
$sc2 = Run-Tool
Check '② 恢复后：不再被拦' $true ($sc2.code -ne 6)
Check '② 恢复后：仍报「可更新」' 'update' ([string](Get-Codes $sc2.json)['alpha/upd.txt'])

# ── ③ 清单切换后、提交日志完成前（**这是本轮修的那个窗口**）────────────────────
New-Fixture
$oldUpd = Txt (PK 'alpha' 'upd.txt'); $oldGen = Get-MfGen 'alpha'; $oldMf = Get-MfSha 'alpha'
Write-Text (MM 'alpha/upd.txt') "v2`n"
$cr3 = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'AFTER_MANIFEST_SWITCH'
Check '③ 注入断点：进程被强制终止' 97 $cr3.code
$jn = Get-LatestJN 'alpha'
Check '③ 现场：日志停在 COMMITTING' 'COMMITTING' ([string]$jn.state)
Check '③ 现场：清单已经换过（switched=true）' 'True' ([string]$jn.manifest.switched)
Check '③ 现场：盘上的清单 == 日志里预告的那份字节' ([string]$jn.manifest.afterSha) (Get-MfSha 'alpha')
Check '③ 现场：生效代次已经是新代次' ([string]$jn.manifest.activeGenerationAfter) (Get-MfGen 'alpha')
Check '③ 现场：运行记录还没完成（半更新就是靠它认出来的）' $true ((Get-LatestRun).state -ne 'COMMITTED')
$sc3 = Run-Tool
Check '③ 半更新：扫描被**运行级**拦截（退出码 6）' 6 $sc3.code
Check '③ 半更新：拦下来时工程没被动' (Sha (MM 'alpha/upd.txt')) (Sha (PK 'alpha' 'upd.txt'))
$rb3 = Run-Tool -Extra @('-Rollback', 'latest')
Check '③ 恢复：退出码 0' 0 $rb3.code
Check '③ 恢复：工程文件回到事务前' $oldUpd (Txt (PK 'alpha' 'upd.txt'))
Check '③ 恢复：**来源清单也回到事务前**（只退文件是最坏的那种假恢复）' $oldMf (Get-MfSha 'alpha')
Check '③ 恢复：生效代次回到原来那一代' $oldGen (Get-MfGen 'alpha')
$sc3b = Run-Tool
Check '③ 恢复后：不再被拦' $true ($sc3b.code -ne 6)
Check '③ 恢复后：判定回到「可更新」—— 说明基线也没被推进' 'update' ([string](Get-Codes $sc3b.json)['alpha/upd.txt'])

# ── ④ 跨套件：只切换了一部分清单 ──────────────────────────────────────────────
New-Fixture
$oldA = Txt (PK 'alpha' 'upd.txt'); $oldB = Txt (PK 'beta' 'only.txt')
$genA = Get-MfGen 'alpha'; $genB = Get-MfGen 'beta'
$mfA = Get-MfSha 'alpha'; $mfB = Get-MfSha 'beta'
Write-Text (MM 'alpha/upd.txt') "vA`n"
Write-Text (MM 'beta/only.txt') "vB`n"
$cr4 = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'AFTER_MANIFEST_SWITCH'
Check '④ 注入断点：进程被强制终止' 97 $cr4.code
$jnA = Get-LatestJN 'alpha'; $jnB = Get-LatestJN 'beta'
Check '④ 现场：先提交的那个套件清单已经换了' ([string]$jnA.manifest.afterSha) (Get-MfSha 'alpha')
Check '④ 现场：后一个套件还停在 WRITTEN（只写没提交）' 'WRITTEN' ([string]$jnB.state)
Check '④ 现场：后一个套件的清单没动' $mfB (Get-MfSha 'beta')
Check '④ 现场：这就是「一半新一半旧」的组合' $true ((Get-MfSha 'alpha') -ne $mfA)
$sc4 = Run-Tool
Check '④ 半组合：扫描被拦（退出码 6）' 6 $sc4.code
# ⚠️ 人读的那句话走 stderr（`-Json` 模式下 stdout 只许有一个 JSON），所以判据要落在**结构化**字段上。
$runParts4 = Get-RunParticipants $sc4.json
$part0 = $(if ($runParts4.Count -gt 0) { [string]$runParts4[0].journalState } else { '<没有参与者>' })
Check '④ 半组合：拦下来的**范围**是整次运行（不是单个套件）' 1 ([int]@($sc4.json.unfinishedRuns).Count)
Check '④ 半组合：运行记录点名了两个参与者' 2 $runParts4.Count
Check '④ 半组合：其中一支的日志已经写着 COMMITTING（就是那个先提交的）' 'COMMITTING' $part0
# `-List` 是「恢复现场时看一眼」的入口 ⇒ 它必须能在**不用 -Json 猜**的情况下说出
# 「有一次未完成的运行、涉及谁」。这条同时钉住「结构化字段真的穿透到 payload」。
$list4 = Run-Tool -Extra @('-List')
# ⚠️ 这里**不许**出现「可能为空的数组下标」：`@()[0]` 会抛终止错误、把整轮断言打断，
# 而那一刻的现场恰恰是「工具坏了」——最该继续把话说完的时候。一律先取数组、再问 Count。
$listKits = @()
if ($null -ne $list4.json -and $null -ne $list4.json.kits) { $listKits = @($list4.json.kits) }
$listK0 = $null; if ($listKits.Count -gt 0) { $listK0 = $listKits[0] }
$listRuns = @()
if ($null -ne $listK0 -and $null -ne $listK0.runs) { $listRuns = @($listK0.runs) }
$listR0 = $null; if ($listRuns.Count -gt 0) { $listR0 = $listRuns[0] }
$listParts = @()
if ($null -ne $listR0 -and $null -ne $listR0.participants) { $listParts = @($listR0.participants) }
Check '④ -List：报出这次未完成的运行' 1 $listRuns.Count
Check '④ -List：运行状态是未完成的 COMMITTING' 'COMMITTING' ([string]$listR0.state)
Check '④ -List：看得出它属于哪个事务' $jnA.planId ([string]$(if ($listParts.Count -gt 0) { $listParts[0].planId } else { '<没有参与者>' }))
Check '④ -List：也报得出生效代次（恢复现场要靠它）' ([string]$jnA.manifest.activeGenerationAfter) ([string]$(if ($null -ne $listK0) { $listK0.activeGeneration } else { '<没有这个套件>' }))
$rb4 = Run-Tool -Extra @('-Rollback', 'latest')
Check '④ 整次恢复：退出码 0' 0 $rb4.code
Check '④ 整次恢复：先提交那个套件的文件也退回去了' $oldA (Txt (PK 'alpha' 'upd.txt'))
Check '④ 整次恢复：它的清单也退回去了' $mfA (Get-MfSha 'alpha')
Check '④ 整次恢复：生效代次回到原来那一代' $genA (Get-MfGen 'alpha')
Check '④ 整次恢复：后一个套件的文件退回去了' $oldB (Txt (PK 'beta' 'only.txt'))
Check '④ 整次恢复：后一个套件的清单没被动过' $mfB (Get-MfSha 'beta')
Check '④ 整次恢复：生效代次仍是原来那一代' $genB (Get-MfGen 'beta')
$sc4b = Run-Tool
Check '④ 恢复后：不再被拦' $true ($sc4b.code -ne 6)
$codes4 = Get-Codes $sc4b.json
Check '④ 恢复后：两个套件都回到「可更新」' 'update·update' "$($codes4['alpha/upd.txt'])·$($codes4['beta/only.txt'])"

# ── ⑤ 运行已提交、套件日志还没同步 ───────────────────────────────────────────
New-Fixture
Write-Text (MM 'alpha/upd.txt') "v2`n"
$cr5 = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'BEFORE_KIT_SYNC'
Check '⑤ 注入断点：进程被强制终止' 97 $cr5.code
$run5 = Get-LatestRun
Check '⑤ 现场：运行记录已经是 COMMITTED' 'COMMITTED' ([string]$run5.state)
Check '⑤ 现场：套件日志还停在 COMMITTING' 'COMMITTING' ([string]((Get-LatestJN 'alpha').state))
Check '⑤ 现场：内容确实是新的（不该被退回去）' (Sha (MM 'alpha/upd.txt')) (Sha (PK 'alpha' 'upd.txt'))
$sc5 = Run-Tool
Check '⑤ 记账没同步：扫描仍被拦（退出码 6）' 6 $sc5.code
Check '⑤ 记账没同步：拦下来的说法是「只是记账」，不是「要退回」' $true (([string]$sc5.raw) -match '记账没同步')
$rb5 = Run-Tool -Extra @('-Rollback', 'latest')
Check '⑤ 补救：退出码 0' 0 $rb5.code
Check '⑤ 补救：**不退内容** —— 工程文件仍是新的' (Sha (MM 'alpha/upd.txt')) (Sha (PK 'alpha' 'upd.txt'))
Check '⑤ 补救：套件日志被补齐成 COMMITTED' 'COMMITTED' ([string]((Get-LatestJN 'alpha').state))
Check '⑤ 补救：运行记录仍是 COMMITTED' 'COMMITTED' ([string](Get-LatestRun).state)
$sc5b = Run-Tool
Check '⑤ 补救后：不再被拦' $true ($sc5b.code -ne 6)
Check '⑤ 补救后：这条更新确实生效了（不再是「可更新」）' $true ((Get-Codes $sc5b.json)['alpha/upd.txt'] -ne 'update')

# ── ⑥ 恢复期间再次中断 ───────────────────────────────────────────────────────
New-Fixture
$oldUpd = Txt (PK 'alpha' 'upd.txt'); $oldSame = Txt (PK 'alpha' 'same.txt')
Write-Text (MM 'alpha/upd.txt') "v2`n"
Write-Text (MM 'alpha/same.txt') "s2`n"
$cr6 = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'AFTER_WRITES'
Check '⑥ 注入断点：两处都写完了才断（退出码 97）' 97 $cr6.code
Check '⑥ 现场：两个文件都是新内容' 'v2·s2' "$((Txt (PK 'alpha' 'upd.txt')).Trim())·$((Txt (PK 'alpha' 'same.txt')).Trim())"
$rb6a = Run-Tool -Extra @('-Rollback', 'latest') -Crash 'DURING_RESTORE'
Check '⑥ 恢复时再次被杀：退出码 97' 97 $rb6a.code
$half = @(@((Txt (PK 'alpha' 'upd.txt'))), @((Txt (PK 'alpha' 'same.txt')))) | Where-Object { $_ -eq $oldUpd -or $_ -eq $oldSame }
Check '⑥ 现场：只退回去一个（另一个还是新的）' 1 $half.Count
$rb6b = Run-Tool -Extra @('-Rollback', 'latest')
Check '⑥ 重试：退出码 0（已恢复的那一项**没有**被误报成第三方改动）' 0 $rb6b.code
Check '⑥ 重试：两个文件都回到事务前' "$($oldUpd.Trim())·$($oldSame.Trim())" "$((Txt (PK 'alpha' 'upd.txt')).Trim())·$((Txt (PK 'alpha' 'same.txt')).Trim())"
Check '⑥ 重试：日志落 RESTORED' 'RESTORED' ([string]((Get-LatestJN 'alpha').state))
$sc6 = Run-Tool
Check '⑥ 重试后：不再被拦' $true ($sc6.code -ne 6)

# ── ⑦ 第三方改过（文件 / 清单）───────────────────────────────────────────────
New-Fixture
Write-Text (MM 'alpha/upd.txt') "v2`n"
$null = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'AFTER_FILE_WRITE'
Write-Text (PK 'alpha' 'upd.txt') "third-party`n"
$rb7a = Run-Tool -Extra @('-Rollback', 'latest')
Check '⑦ 文件被第三方改过：需要人工恢复（退出码 6）' 6 $rb7a.code
Check '⑦ 文件被第三方改过：**保留**第三方内容（没有覆盖掉）' "third-party`n" (Txt (PK 'alpha' 'upd.txt'))

New-Fixture
$mfBefore = Get-MfSha 'alpha'
Write-Text (MM 'alpha/upd.txt') "v2`n"
$null = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'AFTER_MANIFEST_SWITCH'
$mfDoc = Get-Content -LiteralPath (Get-MfPath 'alpha') -Raw -Encoding UTF8 | ConvertFrom-Json
$mfDoc.lastPlanId = 'third-party-touched'
([ordered]@{ schemaVersion = 1; packageId = $mfDoc.packageId; sourceId = $mfDoc.sourceId; sourceRoot = $mfDoc.sourceRoot
             managedRoot = $mfDoc.managedRoot; activeGeneration = $mfDoc.activeGeneration; lastPlanId = $mfDoc.lastPlanId
             files = $mfDoc.files } | ConvertTo-Json -Depth 16) | Set-Content -LiteralPath (Get-MfPath 'alpha') -Encoding utf8NoBOM
$mfTampered = Get-MfSha 'alpha'
Check '⑦ 清单被第三方改过：现场确实变了' $true ($mfTampered -ne $mfBefore)
$rb7b = Run-Tool -Extra @('-Rollback', 'latest')
Check '⑦ 清单被第三方改过：需要人工恢复（退出码 6）' 6 $rb7b.code
Check '⑦ 清单被第三方改过：**保留**当前清单（没有覆盖回事务前）' $mfTampered (Get-MfSha 'alpha')

# ── ⑧ 只推进基线、没改项目源码 ───────────────────────────────────────────────
New-Fixture
Write-Text (MM 'alpha/upd.txt') "conv`n"     # 母本与工程改成同一份 ⇒ 「两边已一致」
Write-Text (PK 'alpha' 'upd.txt') "conv`n"   # 判定 = converged：只推进 B，工程文件一个字节都不该动
$convGen = Get-MfGen 'alpha'; $convMf = Get-MfSha 'alpha'
$cr8 = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'AFTER_MANIFEST_SWITCH'
Check '⑧ 注入断点：进程被强制终止' 97 $cr8.code
$jn = Get-LatestJN 'alpha'
Check '⑧ 现场：这类事务也有完整预告（清单前后状态都在）' 'True' ([string]($null -ne $jn.manifest -and $jn.manifest.afterSha))
Check '⑧ 现场：工程文件从头到尾没被改过' "conv`n" (Txt (PK 'alpha' 'upd.txt'))
Check '⑧ 现场：清单已经换了' ([string]$jn.manifest.afterSha) (Get-MfSha 'alpha')
$rb8 = Run-Tool -Extra @('-Rollback', 'latest')
Check '⑧ 恢复：退出码 0' 0 $rb8.code
Check '⑧ 恢复：来源记录回到事务前（只推进基线的事务也要能退）' $convMf (Get-MfSha 'alpha')
Check '⑧ 恢复：生效代次回到原来那一代' $convGen (Get-MfGen 'alpha')
Check '⑧ 恢复：工程文件仍然没被动过' "conv`n" (Txt (PK 'alpha' 'upd.txt'))
$sc8 = Run-Tool
Check '⑧ 恢复后：判定回到「两边已一致」' 'converged' ([string](Get-Codes $sc8.json)['alpha/upd.txt'])

# ── ⑨ 更新前已有本地改动（keep-local）────────────────────────────────────────
New-Fixture
Write-Text (MM 'alpha/upd.txt') "v2`n"       # 母本改
Write-Text (PK 'alpha' 'upd.txt') "LOCAL`n"  # 工程也改 ⇒ 修改／修改冲突
$localGen = Get-MfGen 'alpha'; $localMf = Get-MfSha 'alpha'
$null = Run-Tool -Extra @('-Scan')
$null = Run-Tool -Extra @('-Resolve', 'all', '-Decision', 'keep-local')
$cr9 = Run-Tool -Extra @('-Apply', '-Partial', '-Verify', 'none') -Crash 'AFTER_MANIFEST_SWITCH'
Check '⑨ 注入断点：进程被强制终止' 97 $cr9.code
Check '⑨ 现场：本地创作内容原样保留（没被母本覆盖）' "LOCAL`n" (Txt (PK 'alpha' 'upd.txt'))
$rb9 = Run-Tool -Extra @('-Rollback', 'latest')
Check '⑨ 恢复：退出码 0' 0 $rb9.code
Check '⑨ 恢复：本地内容仍在' "LOCAL`n" (Txt (PK 'alpha' 'upd.txt'))
Check '⑨ 恢复：来源记录回到事务前' $localMf (Get-MfSha 'alpha')
Check '⑨ 恢复：生效代次回到原来那一代' $localGen (Get-MfGen 'alpha')
$sc9 = Run-Tool
Check '⑨ 恢复后：判定仍是「修改／修改冲突」—— 基线没被偷偷推进' 'conflict_mm' ([string](Get-Codes $sc9.json)['alpha/upd.txt'])

# ─────────────────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host "通过 $script:Passed · 失败 $script:Failed" -ForegroundColor $(if ($script:Failed -eq 0) { 'Green' } else { 'Red' })
foreach ($f in $script:Failures) { Write-Host "  $f" -ForegroundColor Red }
Write-Host "夹具 $Fx"
if (-not $Keep) { Remove-Item -LiteralPath $Fx -Recurse -Force }
exit $(if ($script:Failed -eq 0) { 0 } else { 1 })
