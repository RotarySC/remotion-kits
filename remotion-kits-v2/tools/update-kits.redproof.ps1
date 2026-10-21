<#
.SYNOPSIS
  U4（完整恢复事务）新断言的**红证** —— 把新机制逐条摘掉，看断言真的会红。

.DESCRIPTION
  为什么必须有这一步：一条**永远绿**的断言等于没有，而且更坏 —— 它会被人当成
  「这里测过了」。所以每条新守则都要**当场证明它拦得住**。

  做法：把 `update-kits.ps1` 拷一份、**定点**改坏一处，用 `update-kits.test.ps1 -ToolPath`
  指过去跑全套断言，看**该红的那几条**是否真的红了。

  ⚠️ 两条纪律：
    1. **替换必须命中且只命中一次** —— 没命中就报错退出。否则「红证」量的是别的东西
       （脚本没改到，测试当然全绿，而看起来像「断言不灵」）。
    2. **改的是被测对象本身**（拷出来的那一份），不是重写一份「等价的」实现。

.PARAMETER Which
  只跑某一条红证（`R1`…`R5`）。省略 = 全跑。

.PARAMETER Keep
  留着拷出来的那一份工具，供人工核对改了什么。
#>
[CmdletBinding()]
param(
  [string]$Which = '',
  [switch]$Keep
)

$ErrorActionPreference = 'Stop'
$ToolsDir = $PSScriptRoot
$ToolSrc = Join-Path $ToolsDir 'update-kits.ps1'
$Test = Join-Path $ToolsDir 'update-kits.test.ps1'
$Work = Join-Path $env:TEMP ("kitupd-redproof-" + (Get-Random -Minimum 100000 -Maximum 999999))
$null = New-Item -ItemType Directory -Force -Path $Work

# 每一条：改哪一行 → **必须变红的那几条断言**（按断言名的关键字匹配）
$Variants = @(
  @{
    id = 'R1'
    what = '摘掉「来源清单也一起恢复」'
    find = '        Copy-OneFileAtomic $src $mfPath'
    repl = '        Write-Host "（红证 R1：这里本该恢复清单，被摘掉了）"'
    expect = @('来源清单也回到事务前', '它的清单也退回去了', '来源记录回到事务前')
  }
  @{
    id = 'R2'
    what = '整次运行恢复时只处理**第一个**参与者（不再按运行范围一起退）'
    find = '  $recs = $run.record.participants'
    repl = '  $recs = @($run.record.participants)[0..0]'
    expect = @('后一个套件的文件退回去了')
  }
  @{
    id = 'R3'
    what = '不再预先记录「预期写后状态」（把两处证据通路一起摘掉：PREPARED 时的记录 ＋ 暂存内容这条退路）'
    find = @(
      '        afterExists = $afterExists; afterSha = $afterSha'
      @'
  $stagedFile = Join-Under $stagedRoot ([string]$step.path)
  if (-not (Test-Path -LiteralPath $stagedFile)) { return $null }
  return @{ exists = $true; sha256 = (Get-Hash $stagedFile) }
'@
    )
    repl = @(
      "        afterExists = `$false; afterSha = ''"
      '  return $null'
    )
    expect = @('预期写后哈希事先就在日志里', '① 恢复：文件回到事务之前那一版')
  }
  @{
    id = 'R4'
    what = '运行已提交之后**仍然按内容回退**（把「只补齐记账」那一支收紧成只在显式记账时成立）'
    find = "      if (`$bookkeepingOnly -or `$runState -eq 'COMMITTED') {"
    repl = '      if ($bookkeepingOnly) {'
    expect = @('补救：**不退内容**', '补救：套件日志被补齐成 COMMITTED', '补救后：这条更新确实生效了')
  }
  @{
    id = 'R5'
    what = '拿掉「当前既不是事务前、也不是本事务写后」这条冲突判定'
    find = '    if (-not (Test-SameState $cur $after)) {'
    repl = '    if ($false) {'
    expect = @('文件被第三方改过：需要人工恢复', '文件被第三方改过：**保留**第三方内容')
  }
  @{
    id = 'R6'
    what = '`-List` 不再列出运行记录（恢复现场时看不出「有一次未完成的运行」）'
    find = '    runs = @($myRuns)'
    repl = '    runs = @()'
    expect = @('④ -List：报出这次未完成的运行', '④ -List：运行状态是未完成的 COMMITTING')
  }
)

$bad = 0
foreach ($v in $Variants) {
  if ($Which -and $Which -ne $v.id) { continue }
  Write-Host ''
  Write-Host "════ $($v.id)：$($v.what)" -ForegroundColor Cyan

  $broken = Join-Path $Work "update-kits.$($v.id).ps1"
  Copy-Item -LiteralPath $ToolSrc -Destination $broken -Force
  $patched = [System.IO.File]::ReadAllText($ToolSrc)
  $finds = @($v.find); $repls = @($v.repl)
  $ok = $true
  for ($i = 0; $i -lt $finds.Count; $i++) {
    $hits = ([regex]::Matches($patched, [regex]::Escape($finds[$i]))).Count
    if ($hits -ne 1) {
      Write-Host "  ✗ 红证无效：第 $($i + 1) 个锚点命中 $hits 次（必须恰好 1 次）—— 断言没被真的破坏" -ForegroundColor Red
      $bad++; $ok = $false
      break
    }
    $patched = $patched.Replace($finds[$i], $repls[$i])
  }
  if (-not $ok) { continue }
  [System.IO.File]::WriteAllText($broken, $patched, (New-Object System.Text.UTF8Encoding($false)))
  if ($Keep) { Write-Host "  改坏的那一份：$broken" -ForegroundColor DarkGray }

  $out = & pwsh -NoProfile -File $Test -ToolPath $broken 2>&1 | Out-String
  $code = $LASTEXITCODE
  $lines = @($out -split "`n" | ForEach-Object { $_.TrimEnd("`r") })
  $summary = @($lines | Where-Object { $_ -match '^通过 \d+ · 失败 \d+$' })
  if ($code -ne 1 -or $summary.Count -eq 0) {
    # 套件自己崩了（或缺了收尾统计）⇒ 这一轮**不能**算「红证失败」，它什么都没证明。
    $hadSummary = $(if ($summary.Count -gt 0) { '有' } else { '缺失' })
    Write-Host "  ✗ 红证无效：套件没有跑到收尾（退出码 $code · 收尾统计 $hadSummary）" -ForegroundColor Red
    Write-Host "    最后几行：" -ForegroundColor DarkGray
    foreach ($l in ($lines | Where-Object { $_.Trim() } | Select-Object -Last 4)) { Write-Host "      $l" -ForegroundColor DarkGray }
    $bad++
    continue
  }
  $fails = @($lines | Where-Object { $_ -match '^\s+FAIL\s+' } | ForEach-Object { ($_ -replace '^\s+FAIL\s+', '').Trim() })
  Write-Host "  变红的断言 $($fails.Count) 条"
  foreach ($f in $fails) { Write-Host "    · $f" -ForegroundColor Yellow }

  foreach ($want in $v.expect) {
    $hit = @($fails | Where-Object { $_ -like "*$want*" }).Count -gt 0
    if ($hit) { Write-Host "  ✓ 该红的红了：$want" }
    else { Write-Host "  ✗ **该红却没有红**：$want" -ForegroundColor Red; $bad++ }
  }
}

Write-Host ''
if ($bad -eq 0) { Write-Host '红证通过：每条新守则都当场证明它拦得住' -ForegroundColor Green }
else { Write-Host "红证有 $bad 处不符（要么断言是绿的假货，要么脚本没改到）" -ForegroundColor Red }
if (-not $Keep) { Remove-Item -LiteralPath $Work -Recurse -Force }
else { Write-Host "临时目录：$Work" }
exit $(if ($bad -eq 0) { 0 } else { 1 })
