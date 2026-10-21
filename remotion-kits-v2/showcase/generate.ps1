<#
.SYNOPSIS
  构建套件能力目录，或监听来源并提供本地预览。
.DESCRIPTION
  固定读取技能母版；Project 仅提供依赖，不读取视频工程副本。
  先校验和构建候选结果，成功后才替换离线入口。详情见 README.md。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Project,
  [string]$Suite='',
  [string]$Kernel='',
  [string]$Out='',
  [switch]$DiscoverOnly,
  [switch]$CheckFresh,
  [switch]$Watch,
  [int]$Port=18499,
  [switch]$WithImages,
  [double]$Scale=0.5
)
$ErrorActionPreference='Stop'
$Project=(Resolve-Path -LiteralPath $Project).Path
$nodeArgs=@((Join-Path $PSScriptRoot 'build.mjs'),'--project',$Project)
if($Suite){$nodeArgs+=@('--suite',$Suite)}
if($Kernel){$nodeArgs+=@('--kernel',$Kernel)}
if($Out){$nodeArgs+=@('--out',[IO.Path]::GetFullPath($Out))}
if($DiscoverOnly){$nodeArgs+='--discover'}
if($CheckFresh){$nodeArgs+='--check'}
if($Watch){$nodeArgs+=@('--watch','--port',[string]$Port)}
if($WithImages){$nodeArgs+='--images'}
$nodeArgs+=@('--scale',$Scale.ToString([Globalization.CultureInfo]::InvariantCulture))
& node @nodeArgs
exit $LASTEXITCODE
