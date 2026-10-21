# alias-probe.ps1 —— 阶段 1 / T01：内核作为共享依赖引用的**可行性探针**
#
# 问的问题：技能母本（仓库外）的 TSX 源码，能不能被工程直接消费？
# 三种形态，逐个真跑，记录 tsc 与 remotion still 的退出码：
#   ① junction + preserveSymlinks: true
#   ② junction，不给 preserveSymlinks
#   ③ 只有 tsconfig paths（不建 junction）
#
# 产出：out\probe\alias-probe-引入母本源码.png（物证；形态①的出图）
# 收尾：无论成败都恢复工程原状（删 junction / 删探针 / 还原 tsconfig）
#
# 用法: pwsh -NoProfile -File tools\alias-probe.ps1 [-Lab <lab 工程根>] [-KeepArtifacts]
[CmdletBinding()]
param(
  [string]$Lab,
  [switch]$KeepArtifacts
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
if (-not $Lab) { $Lab = Join-Path $repo 'remotion-kit-lab' }
$Lab = (Resolve-Path -LiteralPath $Lab).Path

$skillKits = Join-Path $env:USERPROFILE '.dsh\skills\remotion-kits\kits'
$kernel    = Join-Path $skillKits 'kernel'
if (-not (Test-Path -LiteralPath $kernel)) { throw "找不到母本内核: $kernel" }

$tsconfig   = Join-Path $Lab 'tsconfig.json'
$probeDir   = Join-Path $Lab 'src\_probe'
$probeEntry = Join-Path $probeDir 'alias-entry.tsx'
$kitsScope  = Join-Path $Lab 'node_modules\@kits'
$link       = Join-Path $kitsScope 'kernel'
$outDir     = Join-Path $Lab 'out\probe'
$finalPng   = Join-Path $outDir 'alias-probe-引入母本源码.png'

$tsc    = Join-Path $Lab 'node_modules\.bin\tsc.cmd'
$remo   = Join-Path $Lab 'node_modules\.bin\remotion.cmd'
foreach ($p in @($tsc, $remo, $tsconfig)) {
  if (-not (Test-Path -LiteralPath $p)) { throw "缺少必需文件: $p" }
}

# 相对路径：从 lab 回到 C:\Users\Rotary，再进 .dsh（形态③要用）
$relUp = '..\..\..\..\..'
$pathsTarget = "$relUp\.dsh\skills\remotion-kits\kits\kernel\*"

$probeSource = @'
/** 【临时探针 —— 由 tools\alias-probe.ps1 生成，跑完即删】 */
import React from 'react';
import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import {Panel} from '@kits/kernel/components/Panel';

const Probe: React.FC = () => (
  <AbsoluteFill style={{background: '#101014'}}>
    <Panel>
      <div style={{color: '#fff', fontFamily: 'sans-serif'}}>alias probe</div>
    </Panel>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition id="AliasProbe" component={Probe} durationInFrames={30} fps={30} width={640} height={360} />
);

registerRoot(RemotionRoot);
'@

$tsconfigOriginal = Get-Content -LiteralPath $tsconfig -Raw

function Set-Tsconfig([string]$mode) {
  $t = $tsconfigOriginal
  switch ($mode) {
    'symlink' {
      $t = $t -replace '("forceConsistentCasingInFileNames": true,)', "`$1`n    `"preserveSymlinks`": true,"
    }
    'paths' {
      $t = $t -replace '("forceConsistentCasingInFileNames": true,)', "`$1`n    `"baseUrl`": `".`",`n    `"paths`": {`"@kits/kernel/*`": [`"$($pathsTarget -replace '\\','/')`"]},"
    }
    'plain' { }
    default { throw "未知模式: $mode" }
  }
  Set-Content -LiteralPath $tsconfig -Value $t -NoNewline -Encoding utf8
}

function Remove-Junction {
  if (Test-Path -LiteralPath $kitsScope) { Remove-Item -LiteralPath $kitsScope -Recurse -Force }
}

function Invoke-Stage([string]$label, [string]$tsMode, [bool]$withJunction) {
  Remove-Junction
  if ($withJunction) {
    New-Item -ItemType Directory -Force -Path $kitsScope | Out-Null
    New-Item -ItemType Junction -Path $link -Target $kernel | Out-Null
  }
  Set-Tsconfig $tsMode

  Push-Location $Lab
  $tscRaw = & $tsc --noEmit 2>&1 | Out-String -Width 200
  $tscExit = $LASTEXITCODE
  Remove-Item -LiteralPath $finalPng -Force -ErrorAction SilentlyContinue
  $stillRaw = & $remo still 'src\_probe\alias-entry.tsx' AliasProbe 'out\probe\alias-probe-引入母本源码.png' --frame=10 --log=error 2>&1 | Out-String -Width 200
  $stillExit = $LASTEXITCODE
  Pop-Location

  Start-Sleep -Milliseconds 300
  $pngOk = Test-Path -LiteralPath $finalPng
  $errCount = (($tscRaw -split "`n") | Where-Object { $_ -match 'error TS' }).Count

  [pscustomobject]@{
    形态                = $label
    'tsc 退出码'        = $tscExit
    'tsc 错误数'        = $errCount
    'still 退出码'      = $stillExit
    出图                = $pngOk
    '仍不合格的样例错误' = (($tscRaw -split "`n") | Where-Object { $_ -match 'error TS' } | Select-Object -First 1) -replace '^.*?error', 'error'
  }
}

$results = @()
try {
  New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
  Set-Content -LiteralPath $probeEntry -Value $probeSource -Encoding utf8

  $results += Invoke-Stage '① junction + preserveSymlinks' 'symlink' $true
  # 形态② / ③ 不重出图（会覆盖形态① 的物证），只记退出码 —— 先把物证挪开
  if (Test-Path -LiteralPath $finalPng) {
    Copy-Item -LiteralPath $finalPng -Destination (Join-Path $outDir '_keep.png') -Force
  }
  $results += Invoke-Stage '② junction，无 preserveSymlinks' 'plain' $true
  $results += Invoke-Stage '③ 只有 tsconfig paths（无 junction）' 'paths' $false

  if (Test-Path -LiteralPath (Join-Path $outDir '_keep.png')) {
    Move-Item -LiteralPath (Join-Path $outDir '_keep.png') -Destination $finalPng -Force
  }

  Write-Host ''
  Write-Host '==== 探针结果 ===='
  $results | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
  Write-Host ("物证: " + $(if (Test-Path -LiteralPath $finalPng) { $finalPng } else { '（缺 —— 形态① 没出图，探针本身失败了）' }))
}
finally {
  Set-Content -LiteralPath $tsconfig -Value $tsconfigOriginal -NoNewline -Encoding utf8
  Remove-Junction
  if (-not $KeepArtifacts) { Remove-Item -LiteralPath $probeDir -Recurse -Force -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath (Join-Path $outDir '_keep.png') -Force -ErrorAction SilentlyContinue
  Write-Host ''
  Write-Host '工程已恢复原状（junction / 探针 / tsconfig 均已还原）。'
}
