<#
.SYNOPSIS
  套件源码副本更新器 —— 更新计划器 ＋ 受控应用器。

.DESCRIPTION
  套件是**复制进项目**的（版本化源码分发），所以母本后来改了，工程副本**不会自己跟着变**。
  这个脚本就是那条「重新复制一次」的路，但它比 `Copy-Item` 多做四件事：

  1. **知道哪个文件是谁改的**（靠基线，见下）；
  2. **先出一份固定的计划**，应用时不再临时读母本 —— 否则「预览看到的」和「写进去的」
     可能不是同一个东西；
  3. **只在没有未解决项时才默认写入**（`-Partial` 才写无歧义的那一部分）；
  4. **写失败能恢复**（事务日志 ＋ `before/` 备份），进程被杀也不会把半更新当成新基线。

  ## 三个状态

  | 名称 | 含义 |
  | --- | --- |
  | **B 基线** | 工程**最近接受或明确确认过**的上游文件状态（住 `<工程>\.kit-origin\<套件>\`） |
  | **M 目标母本** | 本轮计划**固定**下来的母本状态；不是应用时临时读的最新内容 |
  | **P 工程副本** | 扫描时工程中的实际文件状态 |

  文件状态 = 「存在 ＋ 内容哈希」，或「不存在」。零字节文件与不存在是两件事。

  **基线不是项目当前内容的备份，也不是最新母本的全量镜像。** 它逐文件推进，所以它
  **可以同时装着来自不同轮次的文件** —— 如实记录，而不是把整份清单的版本号直接改成最新。

  ## 为什么必须有基线

  副本里的文件和母本不一样，有两种来源：**落后**（母本改了、工程没跟上）与**改过**
  （工程为这一支片子动了它）。哈希只能证明「不同」，所以这两种**长得一模一样**，
  而它们该被如何对待**正好相反**：落后可以安全重刷，改过绝不能覆盖。
  区分它们唯一的办法是记下「当初接受上游时它长什么样」。

  ## 四条承重规则

  1. **基线记录接受的上游状态，工程记录实际使用的结果。**
     旧基线 A、目标 M=C、项目 P=D，人工合并得到 R → 结果应是 **P=R、B=C**，不是 B=R。
     把 B 设成 R，下一轮就会把 C 判成「母本改了而工程没改」，**反而覆盖掉合并成果**。
  2. **默认保留 ≠ 冲突已解决。** 「文件没被覆盖」只证明保护行为成立；修改冲突与待处理的母本删除
     仍是未解决项，不能因此把整次升级标成成功。
  3. **来源状态无效时不自动重建。** 清单丢失或基线损坏 → 报出来。用当前项目或最新母本自动重建
     会**吞掉真实差异**（那正是第 1 条要防的东西）。
  4. **不做自动文本合并、不做语义冲突判断、不做重命名识别。** 重命名按「删除 ＋ 新增」报告。

.PARAMETER Project
  Remotion 工程根目录（含 `src\kits\<套件>\`）。脚本只认这一个布局。

.PARAMETER Kit
  只处理指定套件。省略 = 全部。

.PARAMETER Scan
  只比较并出计划与报告，**不写工程**。（这也是默认动作。）

.PARAMETER Apply
  应用。**不指定 `-Plan` 时先扫一遍再应用**（计划在同一次运行内固定）。
  有未解决项时默认**拒绝写入**；`-Partial` 才只写无歧义的那一部分。

.PARAMETER Plan
  应用指定 `planId` 的计划（先前 `-Scan` 出来的）。

.PARAMETER Partial
  允许只应用无歧义部分。结果会标成**部分更新**。

.PARAMETER Resolve
  解决选择器（`all` 或 `<套件>/<相对路径>`），配合 `-Decision`。**只改计划，不写工程源码。**

.PARAMETER Decision
  `accept-upstream`（接受上游，含明确接受的删除）／`keep-local`（保留本地并确认本轮上游已审查）／`defer`（暂缓）。

.PARAMETER Rollback
  恢复一次未完成（或被中断）的事务：`-Rollback <事务 ID>` 或 `-Rollback latest`。

.PARAMETER Install
  首次安装：母本 → 工程，并建立基线。目标目录已存在且非空时拒绝，除非 `-Force`。

.PARAMETER Adopt
  给已有的副本补基线。**只在「副本 ∩ 母本逐字节全等」时允许** —— 那一刻「落后」与「改过」
  是同一件事，重建**可证明无损**。不等时拒绝；确实要一个起点就再给 `-AttestMaster`。

.PARAMETER AttestMaster
  显式承认「把此刻母本当作已接受状态」。它吞掉的那些差异会**永久变成「工程改过」而不再被更新**，
  这次承认会写进清单（`attested` ＋ 时间 ＋ 方式）。后果打在脸上，所以必须显式。

.PARAMETER Verify
  `auto`（默认）＝ 写入工程源码时跑 `<工程>\node_modules\.bin\tsc.cmd --noEmit`，**写前写后各一次**；
  写前就失败 → 标记「本来就失败」，不因它回滚；写前通过而写后失败 → 回滚。
  不改工程源码时不跑（只查哈希与来源记录）。`none` ＝ 不跑。

.PARAMETER List
  列出每个套件的基线代次、计划、事务。恢复现场时用。

.PARAMETER MasterRoot
  母本 `kits\` 目录。默认 `<技能目录>\kits`。给夹具测试用，也可用于一个不在当前技能里的母本。

.PARAMETER SourceOk
  母本目录与清单里记录的不一致时，`-Apply` 会拒绝；给这个开关表示「我知道，继续」（防从错误的来源更新）。

.PARAMETER Pinned
  计划是**扫描那一刻**的母本快照。母本之后又变了时，`-Apply` 默认拒绝 —— 沉默地用旧快照
  干等是最坏的一种结果（它看起来像成功）。给这个开关＝「我知道，就用计划里那个快照」。

.PARAMETER Json
  只往 stdout 打一个 JSON 对象（人读的说明走 stderr）。

.EXAMPLE
  pwsh -File update-kits.ps1 -Project C:\path\to\lab
.EXAMPLE
  pwsh -File update-kits.ps1 -Project C:\path\to\lab -Apply -Partial
.EXAMPLE
  pwsh -File update-kits.ps1 -Project C:\path\to\lab -Resolve all -Decision keep-local -Apply -Partial

.NOTES
  退出码：0 完成 / 1 有可更新 / 2 用法或 IO 错误 / 3 需要解决 / 4 计划过期或来源状态无效 /
          5 验证失败并已回滚 / 6 需要人工恢复
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Project,
  [string[]]$Kit = @(),
  [switch]$Scan,
  [switch]$Apply,
  [string]$Plan = '',
  [switch]$Partial,
  [string[]]$Resolve = @(),
  [ValidateSet('accept-upstream', 'keep-local', 'defer')][string]$Decision = '',
  [string]$Rollback = '',
  [switch]$Install,
  [switch]$Adopt,
  [switch]$AttestMaster,
  [ValidateSet('auto', 'none')][string]$Verify = 'auto',
  [switch]$List,
  [switch]$Force,
  [string]$MasterRoot = '',
  [switch]$SourceOk,
  [switch]$Pinned,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'

$E_OK         = 0
$E_UPDATABLE  = 1
$E_USAGE      = 2
$E_UNRESOLVED = 3
$E_STALE      = 4
$E_VALIDFAIL  = 5
$E_RECOVERY   = 6

# ─────────────────────────────────────────────────────────────────────────────
# 0 · 路径、输出、退出
# ─────────────────────────────────────────────────────────────────────────────

$SkillDir = Split-Path -Parent $PSScriptRoot
if (-not $MasterRoot) { $MasterRoot = Join-Path $SkillDir 'kits' }
if (-not (Test-Path -LiteralPath $Project)) { [Console]::Error.WriteLine("找不到工程目录：$Project"); exit $E_USAGE }
$Project = (Resolve-Path -LiteralPath $Project).Path
if (-not (Test-Path -LiteralPath $MasterRoot)) { [Console]::Error.WriteLine("找不到母本目录：$MasterRoot"); exit $E_USAGE }
$MasterRoot = (Resolve-Path -LiteralPath $MasterRoot).Path

$KitsRoot   = Join-Path $Project 'src\kits'
$OriginRoot = Join-Path $Project '.kit-origin'

$MANIFEST = '.origin.json'

function Write-Human([string]$text, [string]$color = '') {
  # `-Json` 模式下 stdout 只允许有那一个 JSON 对象，人读的话一律走 stderr。
  if ($Json) { if ($text -ne '') { [Console]::Error.WriteLine($text) }; return }
  if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Stop-Usage([string]$m) { [Console]::Error.WriteLine($m); exit $E_USAGE }

# ─────────────────────────────────────────────────────────────────────────────
# 1 · 通用小工具（PowerShell 的坑集中在这里）
# ─────────────────────────────────────────────────────────────────────────────

function Get-RelSorted([string]$Root) {
  # 相对路径，`/` 分隔、**序数排序**（输出确定，不受区域设置影响）。
  # 用 List[string] + ToArray()：`@()` 套在 List[object] 上必定抛。
  if (-not (Test-Path -LiteralPath $Root)) { return ,([string[]]@()) }
  $resolved = (Resolve-Path -LiteralPath $Root).Path
  if ($resolved.EndsWith('\')) { $resolved = $resolved.TrimEnd('\') }
  $acc = New-Object System.Collections.Generic.List[string]
  foreach ($f in (Get-ChildItem -LiteralPath $resolved -Recurse -File -Force)) {
    $acc.Add($f.FullName.Substring($resolved.Length + 1).Replace('\', '/'))
  }
  $arr = $acc.ToArray()
  [Array]::Sort($arr, [System.StringComparer]::Ordinal)
  return ,([string[]]$arr)
}

function Get-Hash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
function Join-Under([string]$Root, [string]$Rel) { return (Join-Path $Root ($Rel.Replace('/', '\'))) }

function Ensure-Parent([string]$Path) {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { $null = New-Item -ItemType Directory -Force -Path $dir }
}

function Copy-OneFile([string]$Src, [string]$Dst) {
  # 绝不 `Copy-Item "<源>\*" "<目标>" -Recurse`：目标不存在时它会把目录树**摊平**且几乎不报错。
  Ensure-Parent $Dst
  Copy-Item -LiteralPath $Src -Destination $Dst -Force
}

function Copy-Tree([string]$Src, [string]$Dst) {
  foreach ($rel in (Get-RelSorted $Src)) { Copy-OneFile (Join-Under $Src $rel) (Join-Under $Dst $rel) }
}

function Remove-FileAndPrune([string]$Root, [string]$Rel) {
  $p = Join-Under $Root $Rel
  if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force }
  $dir = Split-Path -Parent $p
  while ($dir -and $dir.Length -gt $Root.Length -and (Test-Path -LiteralPath $dir)) {
    if (Get-ChildItem -LiteralPath $dir -Force) { break }
    Remove-Item -LiteralPath $dir -Force
    $dir = Split-Path -Parent $dir
  }
}

function Remove-Tree([string]$Root) {
  # 只用于我们自己建的临时目录；`Remove-Item -Recurse` 会**顺着 junction 删掉目标目录的内容**，
  # 所以先确认这里没有链接。
  if (-not (Test-Path -LiteralPath $Root)) { return }
  foreach ($d in (Get-ChildItem -LiteralPath $Root -Recurse -Directory -Force)) {
    if ($d.LinkType) { Stop-Usage "拒绝删除含链接的目录：$($d.FullName)" }
  }
  Remove-Item -LiteralPath $Root -Recurse -Force
}

function Read-Json([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Write-JsonAtomic([string]$Path, $Obj) {
  # 单个元数据文件：先写临时文件再替换。**不把「先改版本号」当成提交。**
  Ensure-Parent $Path
  $tmp = "$Path.tmp"
  ($Obj | ConvertTo-Json -Depth 16) | Set-Content -LiteralPath $tmp -Encoding utf8NoBOM
  Move-Item -LiteralPath $tmp -Destination $Path -Force
}

function Get-FileState([string]$Path) {
  # 恢复判定用的最小状态：「存在 ＋ 哈希」或「不存在」。零字节文件与不存在是两件事，
  # 所以**不能**用「有没有哈希」当存在性。
  if (-not (Test-Path -LiteralPath $Path)) { return @{ exists = $false; sha256 = '' } }
  return @{ exists = $true; sha256 = (Get-Hash $Path) }
}

function Test-SameState($a, $b) {
  return ([bool]$a.exists -eq [bool]$b.exists -and (([bool]$a.exists) -eq $false -or ([string]$a.sha256 -eq [string]$b.sha256)))
}

function Get-Prop($obj, [string]$name, $default = $null) {
  # 同一份日志在本工具里有**两种形状**：进程内是 `[ordered]`（字典），从磁盘读回来是
  # PSCustomObject。两者的取值方式**不通用** —— `$dict.PSObject.Properties['x']` 恒为 $null
  # （见 `Read-Manifest` 里那条注释，同一类坑已经踩过一次）。所以新字段一律走这里。
  if ($null -eq $obj) { return $default }
  if ($obj -is [System.Collections.IDictionary]) {
    if ($obj.Contains($name)) { return $obj[$name] }
    return $default
  }
  $p = $obj.PSObject.Properties[$name]
  if ($null -eq $p) { return $default }
  return $p.Value
}

function Set-Prop($obj, [string]$name, $value) {
  if ($obj -is [System.Collections.IDictionary]) { $obj[$name] = $value; return }
  if ($null -ne $obj.PSObject.Properties[$name]) { $obj.PSObject.Properties[$name].Value = $value; return }
  $null = $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value
}

function Get-RelUnder([string]$Root, [string]$Rel) {
  # 日志里的相对路径是**不可信输入**（磁盘上的文件）：先过 Test-SafeRel，再确认落在 $Root 里。
  # 返回 $null = 拒绝（调用方据此报「越界」而不是静默跳过）。
  if (-not (Test-SafeRel $Rel)) { return $null }
  $p = Join-Under $Root $Rel
  if (-not (Test-Contained $Root $p)) { return $null }
  return $p
}

function Copy-OneFileAtomic([string]$Src, [string]$Dst) {
  # 单个元数据文件（清单 / 运行记录）也要「先写临时文件再替换」：就地覆盖会让
  # 「换清单」这一步本身留下半截内容，而清单是 JSON —— 半截就是一个坏掉的来源记录。
  Ensure-Parent $Dst
  $tmp = "$Dst.tmp"
  Copy-Item -LiteralPath $Src -Destination $tmp -Force
  Move-Item -LiteralPath $tmp -Destination $Dst -Force
}

function Invoke-CrashPoint([string]$Name) {
  # **故障注入**：只在显式设了 `KITUPD_CRASH_AT` 时才生效，正常使用是空操作。
  # 用它而不是「把工具改坏一份」：验收要求走**真实执行路径**，改坏一份改变的是被测对象。
  #
  # 用 `[System.Environment]::Exit` 而不是 `exit`：实测 `exit` **会**展开 finally
  # （锁因此被释放），那就不像「进程被杀」了；`[Environment]::Exit` 当场结束进程、不展开栈。
  if ($env:KITUPD_CRASH_AT -eq $Name) {
    Write-Human "  ⚠ 故障注入：在 $Name 处强制终止进程（KITUPD_CRASH_AT=$Name）" 'Yellow'
    [System.Environment]::Exit(97)
  }
}

function Get-NormalizedHash([string]$Path) {
  # 行尾归一后的哈希 —— 只用于 autocrlf 诊断，**不参与判定**。
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $acc = New-Object System.Collections.Generic.List[byte]
  for ($i = 0; $i -lt $bytes.Length; $i++) {
    if ($bytes[$i] -eq 13 -and ($i + 1) -lt $bytes.Length -and $bytes[$i + 1] -eq 10) { continue }
    $acc.Add($bytes[$i])
  }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($acc.ToArray()))).Replace('-', '') }
  finally { $sha.Dispose() }
}

function New-PlanId() { return (Get-Date).ToString('yyyyMMdd-HHmmss-fff') + '-' + (Get-Random -Minimum 1000 -Maximum 9999) }
function Now-Stamp()  { return (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz') }

function Test-SafeRel([string]$Rel) {
  # 清单 / 计划 / 日志里的路径都来自**磁盘上的文件**，而它们会被拼成写入与删除的目标。
  # 所以它们是**不可信输入**：一个 `../..` 就能让工具删到工程外面去。
  # （判据：不靠「找不到文件」静默忽略，而是在动手之前就拒绝。）
  if (-not $Rel) { return $false }
  if ($Rel.Contains('..')) { return $false }              # 不许上跳
  if ($Rel.StartsWith('/') -or $Rel.StartsWith('\')) { return $false }   # 不许绝对
  if ($Rel -match '^[A-Za-z]:') { return $false }          # 不许盘符
  if ($Rel.Contains(':')) { return $false }                # 也不许 NTFS 数据流
  return $true
}

function Test-Contained([string]$Root, [string]$Path) {
  $full = [System.IO.Path]::GetFullPath($Path)
  $root = [System.IO.Path]::GetFullPath($Root)
  if (-not $root.EndsWith('\')) { $root += '\' }
  return $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-NotLink([string]$Path) {
  # 「不跟随链接跳转」：目标是链接就拒绝 —— `Remove-Item -Recurse` 顺着 junction 删掉**目标**目录
  # 的内容，这条已经付出过一次代价。
  if (-not (Test-Path -LiteralPath $Path)) { return $true }
  $it = Get-Item -LiteralPath $Path -Force
  return (-not $it.LinkType)
}

function Get-TreeDigest($map) {
  # 一轮目标内容的摘要：固定「这一轮计划针对的是哪个 M」，而不是记一个不存在的版本号。
  $sb = New-Object System.Text.StringBuilder
  foreach ($k in ($map.Keys | Sort-Object)) { $null = $sb.Append($k).Append("`t").Append($map[$k].sha256).Append("`n") }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($sb.ToString())))).Replace('-', '') }
  finally { $sha.Dispose() }
}

# ─────────────────────────────────────────────────────────────────────────────
# 2 · 判定表
# ─────────────────────────────────────────────────────────────────────────────

$VDEF = [ordered]@{
  same                      = @{ text = '无变化';                   group = 'same' }
  update                    = @{ text = '仅母本修改';               group = 'apply' }
  converged                 = @{ text = '两边已一致';               group = 'apply' }
  new_upstream              = @{ text = '首次母本新增';             group = 'apply' }
  both_deleted              = @{ text = '两边已删除';               group = 'apply' }
  local                     = @{ text = '仅本地修改';               group = 'local' }
  local_only                = @{ text = '本地独有文件';             group = 'local' }
  local_deleted             = @{ text = '仅本地删除';               group = 'local' }
  conflict_mm               = @{ text = '修改／修改冲突';           group = 'unresolved' }
  conflict_deleted_modified = @{ text = '母本删除／本地修改';       group = 'unresolved' }
  conflict_modified_deleted = @{ text = '母本修改／本地删除';       group = 'unresolved' }
  conflict_same_name        = @{ text = '同名不同内容';             group = 'unresolved' }
  upstream_deleted          = @{ text = '仅母本删除（待处理）';     group = 'unresolved' }
  reintroduced              = @{ text = '上游重新引入';             group = 'unresolved' }
  unclaimed_same            = @{ text = '同名同内容（待确认接管）'; group = 'unresolved' }
}

# 「计划阶段要把 M 内容暂存下来」的判定集合 —— 这些是**可能被写入或推进**的路径。
# 少了任何一个都会让新基线代次缺内容（症状：下一轮把已接受的文件判成「本地独有」）。
$WRITEABLE = @('update', 'converged', 'new_upstream', 'conflict_mm', 'conflict_modified_deleted',
               'conflict_same_name', 'reintroduced', 'unclaimed_same')

function Decide([bool]$inB, [bool]$bEx, [bool]$inM, [bool]$inP, [string]$mH, [string]$pH, [string]$bH) {
  if ($inB -and $bEx) {
    if ($inM -and $inP) {
      if ($mH -eq $bH -and $pH -eq $bH) { return 'same' }
      if ($mH -ne $bH -and $pH -eq $bH) { return 'update' }
      if ($mH -eq $bH -and $pH -ne $bH) { return 'local' }
      if ($mH -eq $pH) { return 'converged' }
      return 'conflict_mm'
    }
    if ($inM -and -not $inP) { if ($mH -eq $bH) { return 'local_deleted' } else { return 'conflict_modified_deleted' } }
    if (-not $inM -and $inP) { if ($pH -eq $bH) { return 'upstream_deleted' } else { return 'conflict_deleted_modified' } }
    return 'both_deleted'
  }
  if ($inB -and -not $bEx) {
    # 有过删除记录，M 又出现 = 上游重新引入。默认**不按首次新增自动写回** ——
    # 那会抹掉有意删除产生的历史（那段时间的项目状态没人再能重建）。
    if ($inM -and -not $inP) { return 'reintroduced' }
  }
  if ($inM -and $inP) { if ($mH -eq $pH) { return 'unclaimed_same' } else { return 'conflict_same_name' } }
  if ($inM -and -not $inP) { return 'new_upstream' }
  if (-not $inM -and $inP) { return 'local_only' }
  return 'same'
}

# (判定, 解决选择) → 动作。动作只有四种：write（P←M）/ delete（P 删除）/ baseline（只推进 B）/ none。
function Get-Action([string]$code, [string]$resolution) {
  switch ($code) {
    'update'                    { return 'write' }
    'new_upstream'              { return 'write' }
    'converged'                 { return 'baseline' }
    'both_deleted'              { return 'baseline' }
    'same'                      { return 'none' }
    'local'                     { return 'none' }
    'local_only'                { return 'none' }
    'local_deleted'             { return 'none' }
  }
  if ($resolution -eq 'accept-upstream') {
    switch ($code) {
      'conflict_mm'               { return 'write' }
      'conflict_modified_deleted' { return 'write' }
      'conflict_same_name'        { return 'write' }
      'reintroduced'              { return 'write' }
      'conflict_deleted_modified' { return 'delete' }
      'upstream_deleted'          { return 'delete' }
      'unclaimed_same'            { return 'baseline' }   # 接管：字节一致，只建立来源记录
    }
  }
  if ($resolution -eq 'keep-local') { return 'baseline' }  # P 保留当前；B←M（含 M 不存在）
  return 'none'
}

# ─────────────────────────────────────────────────────────────────────────────
# 3 · 清单（.origin.json）
# ─────────────────────────────────────────────────────────────────────────────

function Read-Manifest([string]$OriginDir) {
  $raw = Read-Json (Join-Path $OriginDir $MANIFEST)
  if ($null -eq $raw) { return $null }
  if (-not $raw.PSObject.Properties['schemaVersion'] -or [int]$raw.schemaVersion -ne 1) {
    Stop-Usage "清单格式不认识（schemaVersion=$($raw.schemaVersion)）：$(Join-Path $OriginDir $MANIFEST)"
  }
  # 统一成哈希表：JSON 反序列化出来的是 PSCustomObject，`$o.PSObject.Properties['x']` 对哈希表恒为 null；
  # 两种混着用会让「删除记录」这类可选字段静默失效。
  $files = @{}
  foreach ($p in $raw.files.PSObject.Properties) {
    $v = $p.Value
    $base = @{ exists = [bool]$v.base.exists }
    if ($base.exists) { $base['sha256'] = [string]$v.base.sha256; $base['bytes'] = [int]$v.base.bytes }
    $e = @{ base = $base }
    if ($v.PSObject.Properties['acceptedFrom'] -and $v.acceptedFrom) { $e['acceptedFrom'] = [string]$v.acceptedFrom }
    if ($v.PSObject.Properties['history'] -and $v.history) {
      $hist = New-Object System.Collections.Generic.List[object]
      foreach ($h in $v.history) { $hist.Add(@{ at = [string]$h.at; event = [string]$h.event }) }
      $e['history'] = $hist
    }
    $files[$p.Name] = $e
  }
  return @{
    dir              = $OriginDir
    schemaVersion    = 1
    packageId        = [string]$raw.packageId
    sourceId         = [string]$raw.sourceId
    sourceRoot       = [string]$raw.sourceRoot
    managedRoot      = [string]$raw.managedRoot
    activeGeneration = [string]$raw.activeGeneration
    attested         = $(if ($raw.PSObject.Properties['attested'] -and $raw.attested) { [string]$raw.attested } else { '' })
    lastPlanId       = $(if ($raw.PSObject.Properties['lastPlanId'] -and $raw.lastPlanId) { [string]$raw.lastPlanId } else { '' })
    files            = $files
  }
}

function Get-ManifestDoc($mf) {
  # 内存模型 → 清单文档（键序固定 ⇒ 同一份模型序列化出的字节是确定的）。
  # ⚠️ 写盘与「提交后应当长什么样」**共用这一份实现**：两处各写一遍，就有机会让
  # 「我预告的字节」和「我真写的字节」不同，而恢复判定正是靠这两个哈希比的。
  $files = [ordered]@{}
  foreach ($k in ($mf.files.Keys | Sort-Object)) {
    $e = $mf.files[$k]
    $entry = [ordered]@{ base = [ordered]@{ exists = [bool]$e.base.exists } }
    if ($e.base.exists) { $entry.base['sha256'] = $e.base.sha256; $entry.base['bytes'] = [int]$e.base.bytes }
    if ($e.ContainsKey('acceptedFrom') -and $e.acceptedFrom) { $entry['acceptedFrom'] = $e.acceptedFrom }
    if ($e.ContainsKey('history') -and $e.history -and $e.history.Count -gt 0) {
      # 只留最近 8 条：历史说明「这个路径发生过什么」，不是审计流水；无限长会把清单变成垃圾场。
      # 注意：`$h` 是 List[object]，**不能**用 `@()` 套它。
      $h = $e.history
      if ($h.Count -gt 8) { $h = $h[($h.Count - 8)..($h.Count - 1)] }
      $entry['history'] = @(foreach ($x in $h) { [ordered]@{ at = $x.at; event = $x.event } })
    }
    $files[$k] = $entry
  }
  $doc = [ordered]@{
    schemaVersion    = 1
    packageId        = $mf.packageId
    # 来源身份：母本里的哪一层 ＋ 这台机器上的哪个目录。**不记一个整体版本号** ——
    # 逐文件的基线本来就不属于同一个版本，造一个出来就是说谎。
    sourceId         = $mf.sourceId
    sourceRoot       = $mf.sourceRoot
    managedRoot      = $mf.managedRoot
    activeGeneration = $mf.activeGeneration
    files            = $files
  }
  if ($mf.attested)   { $doc['attested']   = $mf.attested }
  if ($mf.lastPlanId) { $doc['lastPlanId'] = $mf.lastPlanId }
  return $doc
}

function Write-Manifest($mf) {
  Write-JsonAtomic (Join-Path $mf.dir $MANIFEST) (Get-ManifestDoc $mf)
}

function Copy-ManifestModel($mf) {
  # 模型的深拷贝。提交预告要在**不动原件**的前提下算出来 —— 原件是
  # 「当前这份清单」，恢复与复核都还要用它。
  $files = @{}
  foreach ($k in $mf.files.Keys) {
    $src = $mf.files[$k]
    $base = @{ exists = [bool]$src.base.exists }
    if ($base.exists) { $base['sha256'] = [string]$src.base.sha256; $base['bytes'] = [int]$src.base.bytes }
    $e = @{ base = $base }
    if ($src.ContainsKey('acceptedFrom') -and $src.acceptedFrom) { $e['acceptedFrom'] = [string]$src.acceptedFrom }
    if ($src.ContainsKey('history') -and $src.history -and $src.history.Count -gt 0) {
      $hist = New-Object System.Collections.Generic.List[object]
      foreach ($h in $src.history) { $hist.Add(@{ at = [string]$h.at; event = [string]$h.event }) }
      $e['history'] = $hist
    }
    $files[$k] = $e
  }
  return @{
    dir              = $mf.dir
    schemaVersion    = 1
    packageId        = $mf.packageId
    sourceId         = $mf.sourceId
    sourceRoot       = $mf.sourceRoot
    managedRoot      = $mf.managedRoot
    activeGeneration = $mf.activeGeneration
    attested         = $mf.attested
    lastPlanId       = $mf.lastPlanId
    files            = $files
  }
}

function New-ManifestAfterDoc($mf, $plan, $resolutions, [string]$newGen, [string]$stagedRoot, [string]$planId) {
  # 算出**提交之后**那份清单会是什么，返回可直接序列化的模型。
  #
  # 为什么必须在写入之前算出来：恢复要认「文件已写、完成标记还没落盘」这个窗口，
  # 而认它靠的是「当前内容 == 本事务预期写后内容」。预期写后的哈希只有**事先**记下来才有用 ——
  # 事后才知道的东西救不了那一刻（那一刻进程已经没了）。
  #
  # ⚠️ 新代次目录在这一步**还不存在**（它在提交阶段才建）⇒ 基线条目的 bytes 从**暂存内容**取。
  # 暂存内容与将来落进代次目录的是同一份字节（同一份母本拷贝），所以字节数相同。
  $clone = Copy-ManifestModel $mf
  $at = Now-Stamp
  foreach ($pe in $plan.entries) {
    $code = [string]$pe.code
    $grp = $VDEF[$code].group
    if ($grp -eq 'same' -or $grp -eq 'local') { continue }
    $res = ''; if ($resolutions.ContainsKey($pe.path)) { $res = $resolutions[$pe.path] }
    $action = Get-Action $code $res
    if ($action -eq 'none') { continue }
    $entry = $null
    if ($clone.files.ContainsKey($pe.path)) { $entry = $clone.files[$pe.path] }
    if (-not $entry) { $entry = @{ base = @{ exists = $false } }; $clone.files[$pe.path] = $entry }
    $entry.base = @{ exists = [bool]$pe.m.exists }
    if ($pe.m.exists) {
      $stagedFile = Join-Under $stagedRoot $pe.path
      if (-not (Test-Path -LiteralPath $stagedFile)) {
        throw "计划的暂存内容不见了（清单预告算不出来，一个字节都还没写）：$stagedFile"
      }
      $entry.base['sha256'] = [string]$pe.m.sha256
      $entry.base['bytes']  = [int](Get-Item -LiteralPath $stagedFile).Length
    }
    $entry['acceptedFrom'] = $planId
    $evt = switch ($action) { 'write' { 'accepted-upstream' } 'delete' { 'accepted-upstream-delete' } default { 'baseline-advanced' } }
    if ($res -eq 'keep-local') { $evt = 'kept-local-reviewed' }
    Add-History $entry $evt $at
  }
  $clone.activeGeneration = $newGen
  $clone.lastPlanId = $planId
  return $clone
}

function Add-History($entry, [string]$evt, [string]$at) {
  if (-not $entry.ContainsKey('history') -or -not $entry.history) {
    $entry['history'] = New-Object System.Collections.Generic.List[object]
  }
  $entry.history.Add(@{ at = $at; event = $evt })
}

# ─────────────────────────────────────────────────────────────────────────────
# 4 · 基线代次
# ─────────────────────────────────────────────────────────────────────────────

function Get-GenerationDirs([string]$OriginDir) {
  $root = Join-Path $OriginDir 'baselines'
  if (-not (Test-Path -LiteralPath $root)) { return ,([string[]]@()) }
  $names = New-Object System.Collections.Generic.List[string]
  foreach ($d in (Get-ChildItem -LiteralPath $root -Directory -Force)) { $names.Add($d.Name) }
  $arr = $names.ToArray()
  [Array]::Sort($arr, [System.StringComparer]::Ordinal)
  return ,([string[]]$arr)
}

function Get-NextGeneration([string]$OriginDir) {
  $max = 0
  foreach ($g in (Get-GenerationDirs $OriginDir)) { if ($g -match '^g(\d+)$') { $n = [int]$Matches[1]; if ($n -gt $max) { $max = $n } } }
  return ('g{0:d4}' -f ($max + 1))
}

function Get-GenDir($mf) { return (Join-Path (Join-Path $mf.dir 'baselines') $mf.activeGeneration) }

function Test-BaselineIntact($mf) {
  # 清单与基线内容必须一致；不一致 = 来源状态无效。**不自动重建**（那会吞掉真实差异）。
  $problems = New-Object System.Collections.Generic.List[string]
  if ($null -eq $mf) { $problems.Add('没有清单'); return ,([string[]]$problems.ToArray()) }
  foreach ($rel in ($mf.files.Keys | Sort-Object)) {
    # 清单是磁盘上的文件 —— 路径当**不可信输入**处理（见 Test-SafeRel）
    if (-not (Test-SafeRel $rel)) { $problems.Add("清单里有越界路径：$rel") }
  }
  if ($problems.Count -gt 0) { return ,([string[]]$problems.ToArray()) }
  $genDir = Get-GenDir $mf
  if (-not (Test-Path -LiteralPath $genDir)) {
    $problems.Add("基线代次目录不存在：$genDir")
    return ,([string[]]$problems.ToArray())
  }
  $onDisk = Get-RelSorted $genDir
  foreach ($rel in ($mf.files.Keys | Sort-Object)) {
    $e = $mf.files[$rel]
    if ($e.base.exists) {
      if ($onDisk -notcontains $rel) { $problems.Add("清单说 $rel 存在，基线内容里没有") }
      elseif ((Get-Hash (Join-Under $genDir $rel)) -ne $e.base.sha256) { $problems.Add("基线内容与清单哈希不符：$rel") }
    }
  }
  foreach ($rel in $onDisk) {
    if (-not $mf.files.ContainsKey($rel)) { $problems.Add("基线内容里有清单不认识的：$rel") }
    elseif (-not $mf.files[$rel].base.exists) { $problems.Add("清单说 $rel 不存在，基线内容里却有它") }
  }
  return ,([string[]]$problems.ToArray())
}

function New-Generation($mf, $stagedRoot, $changes) {
  # $changes: rel → @{ exists; content = <文件路径 或 $null> }
  # 新代次**从旧代次复制生成**，再只替换已接受的 —— 不是「复制一份最新母本」。
  $newGen = Get-NextGeneration $mf.dir
  $newDir = Join-Path (Join-Path $mf.dir 'baselines') $newGen
  $oldDir = Get-GenDir $mf
  if ($mf.activeGeneration -and (Test-Path -LiteralPath $oldDir)) { Copy-Tree $oldDir $newDir }
  else { $null = New-Item -ItemType Directory -Force -Path $newDir }
  foreach ($rel in $changes.Keys) {
    $ch = $changes[$rel]
    if ($ch.exists) { Copy-OneFile $ch.content (Join-Under $newDir $rel) }
    else { Remove-FileAndPrune $newDir $rel }
  }
  return $newGen
}

# ─────────────────────────────────────────────────────────────────────────────
# 5 · 扫描：状态 → 判定 → 计划
# ─────────────────────────────────────────────────────────────────────────────

function Get-TreeMap([string]$Root) {
  $map = @{}
  foreach ($rel in (Get-RelSorted $Root)) {
    $p = Join-Under $Root $rel
    $map[$rel] = @{ sha256 = (Get-Hash $p); bytes = [int](Get-Item -LiteralPath $p).Length }
  }
  return $map
}

function Get-KitState([string]$KitName) {
  return @{
    kit       = $KitName
    masterDir = Join-Path $MasterRoot $KitName
    projDir   = Join-Path $KitsRoot   $KitName
    originDir = Join-Path $OriginRoot $KitName
    managed   = 'src/kits/' + $KitName
    master    = Get-TreeMap (Join-Path $MasterRoot $KitName)
    proj      = Get-TreeMap (Join-Path $KitsRoot   $KitName)
  }
}

function Get-Verdicts($st, $mf) {
  $keys = New-Object System.Collections.Generic.List[string]
  foreach ($k in $st.master.Keys) { $keys.Add($k) }
  foreach ($k in $st.proj.Keys)   { if (-not $keys.Contains($k)) { $keys.Add($k) } }
  if ($null -ne $mf) { foreach ($k in $mf.files.Keys) { if (-not $keys.Contains($k)) { $keys.Add($k) } } }
  $arr = $keys.ToArray(); [Array]::Sort($arr, [System.StringComparer]::Ordinal)

  $genDir = ''
  if ($null -ne $mf) { $genDir = Get-GenDir $mf }

  $entries = New-Object System.Collections.Generic.List[object]
  foreach ($rel in $arr) {
    $inM = $st.master.ContainsKey($rel)
    $inP = $st.proj.ContainsKey($rel)
    $inB = ($null -ne $mf) -and $mf.files.ContainsKey($rel)
    $bEx = $false; $bH = ''
    if ($inB) { $bEx = $mf.files[$rel].base.exists; if ($bEx) { $bH = $mf.files[$rel].base.sha256 } }
    $mH = ''; $pH = ''
    if ($inM) { $mH = $st.master[$rel].sha256 }
    if ($inP) { $pH = $st.proj[$rel].sha256 }

    $code = Decide $inB $bEx $inM $inP $mH $pH $bH
    $note = ''
    if ($inB -and -not $bEx -and $inM) { $note = '该路径有过删除记录' }
    if ($code -eq 'local' -and $bEx -and $genDir -ne '' -and (Test-Path -LiteralPath $genDir)) {
      # autocrlf 诊断：整仓被行尾归化时，每个文件都会「看起来被改过」。
      # 这是**诊断**，不改判定（判定仍按逐字节哈希）。
      if ((Get-NormalizedHash (Join-Under $st.projDir $rel)) -eq (Get-NormalizedHash (Join-Under $genDir $rel))) {
        $note = '仅行尾不同（疑似 autocrlf）'
      }
    }

    $entries.Add([pscustomobject]@{
      path = $rel; code = $code; text = $VDEF[$code].text; group = $VDEF[$code].group
      inB = $inB; bExists = $bEx; bHash = $bH
      inM = $inM; mHash = $mH
      inP = $inP; pHash = $pH
      note = $note; resolution = ''; action = ''
    })
  }

  $counts = @{}
  foreach ($e in $entries) { $counts[$e.code] = 1 + [int]($counts[$e.code]) }
  return [pscustomobject]@{ entries = $entries; counts = $counts }
}

function New-Plan($st, $mf, $verdicts, [string]$planId) {
  $planDir = Join-Path (Join-Path $st.originDir 'plans') $planId
  $staged  = Join-Path $planDir 'staged'
  $out = New-Object System.Collections.Generic.List[object]
  foreach ($e in $verdicts.entries) {
    # 计划阶段就把**可能被写入或推进**的 M 内容固定下来 —— 应用时不再临时读母本。
    # 推进（baseline）也要内容：`converged` / `接管` / `保留本地` 的 B 都要变成 M 那一版。
    if ($WRITEABLE -contains $e.code -and $e.inM) {
      $src = Join-Under $st.masterDir $e.path
      if (-not (Test-Path -LiteralPath $src)) { Stop-Usage "母本文件不见了：$src" }
      Copy-OneFile $src (Join-Under $staged $e.path)
    }
    $out.Add([ordered]@{
      path       = $e.path
      code       = $e.code
      b          = [ordered]@{ exists = $e.bExists; sha256 = $e.bHash }
      m          = [ordered]@{ exists = $e.inM;    sha256 = $e.mHash }
      p          = [ordered]@{ exists = $e.inP;    sha256 = $e.pHash }
      note       = $e.note
      resolution = ''
      action     = ''
    })
  }
  $plan = [ordered]@{
    planFormatVersion = 1
    planId            = $planId
    createdAt         = Now-Stamp
    kit               = $st.kit
    source            = [ordered]@{
      id           = 'kits/' + $st.kit
      root         = $MasterRoot
      targetDigest = (Get-TreeDigest $st.master)
    }
    scope             = [ordered]@{
      project          = $Project
      managedRoot      = $st.managed
      activeGeneration = $(if ($null -ne $mf) { $mf.activeGeneration } else { '' })
    }
    entries           = $out
  }
  Write-JsonAtomic (Join-Path $planDir 'plan.json') $plan
  Set-CurrentPlan $st.originDir $planId
  return $plan
}

function Read-Plan([string]$originDir, [string]$planId) {
  $p = Join-Path (Join-Path (Join-Path $originDir 'plans') $planId) 'plan.json'
  return (Read-Json $p)
}

function Test-PlanActionable($plan) {
  # 「这份计划里可能有活要干」—— 只看判定集合，**不看裁决**（裁决可能在下一次 `-Resolve` 才落）。
  # 用途只有一个：决定要不要为这一轮建运行记录。全都无事可做时不建（那就没有事务可言，
  # 建了反而会在退出前留下一条永远没人处理的运行记录）。
  foreach ($pe in $plan.entries) {
    $grp = $VDEF[[string]$pe.code].group
    if ($grp -eq 'apply' -or $grp -eq 'unresolved') { return $true }
  }
  return $false
}

function Get-PlanDirs([string]$originDir) {
  # **按最后修改时间排，不是按名字。** 名字里那段是「时间戳 ＋ 随机数」，同一秒内建的两份计划
  # 按序数排序时顺序是**随机的** —— 那会让 `-Apply` 挑到上一份计划（症状：莫名其妙报「计划过期」）。
  # 实测踩过：scan → apply 连着跑，第二次就时好时坏。
  $root = Join-Path $originDir 'plans'
  if (-not (Test-Path -LiteralPath $root)) { return ,([string[]]@()) }
  $names = New-Object System.Collections.Generic.List[string]
  foreach ($d in (Get-ChildItem -LiteralPath $root -Directory -Force | Sort-Object LastWriteTimeUtc, Name)) { $names.Add($d.Name) }
  return ,([string[]]$names.ToArray())
}

function Get-Journal([string]$originDir, [string]$planId) {
  return (Read-Json (Join-Path (Join-Path (Join-Path $originDir 'plans') $planId) 'journal.json'))
}

function Get-ActivePlanId([string]$originDir) {
  # 「**当前**那份还没应用过的计划」。
  #
  # 为什么不是「最新的一份没日志的计划目录」：那只手会去捡**早就过期的旧计划** —— 每跑一次
  # `-Scan` 就留下一份没日志的计划，跑几次之后 `-Apply` 可能挑中几天前那一份，
  # 然后报「计划过期」；而真正的原因是「这里躺着一份旧计划」，报错在说另一件事。
  # 实测踩过：scan → apply 之后，第二次 apply 报 stale，逐条说「P 内容变了」。
  #
  # 所以用一支指针：`-Scan` 建计划时把它指过去。指针不在、或它指的那份已经应用过 → 没有当前计划。
  # 已应用过的计划不再复用：那会让「重复应用」撞上 B 已推进 → 计划过期，幂等性就没了。
  $plansRoot = Join-Path $originDir 'plans'
  $cur = Read-Json (Join-Path $plansRoot '.current')
  if ($null -eq $cur -or -not $cur.planId) { return '' }
  $id = [string]$cur.planId
  $planFile = Join-Path (Join-Path $plansRoot $id) 'plan.json'
  if (-not (Test-Path -LiteralPath $planFile)) { return '' }
  $j = Get-Journal $originDir $id
  if ($null -ne $j -and $j.state -ne 'COMMITTED') { return '' }
  # 提交过的计划**仍然算当前**：部分更新之后，那份计划上还挂着没裁决的条目，
  # 必须能继续 `-Resolve`（实测踩过：apply -Partial 之后 resolve 说「没有可用的计划」，
  # 而那条未解决项本来就还在那儿）。已经应用过的条目由日志里的 done 集合跳过，不会重复写。
  return $id
}

function Get-DonePaths([string]$originDir, [string]$planId) {
  # 这份计划里**已经写进工程**的条目。部分更新之后还要能接着裁决与应用，
  # 所以复核与应用都必须跳过它们（否则会想重新写一遍已经写好的文件）。
  $h = @{}
  $j = Get-Journal $originDir $planId
  if ($null -ne $j -and $j.state -eq 'COMMITTED' -and $j.steps) {
    foreach ($s in $j.steps) { if ($s.done) { $h[[string]$s.path] = $true } }
  }
  return $h
}

function Set-CurrentPlan([string]$originDir, [string]$planId) {
  $plansRoot = Join-Path $originDir 'plans'
  $null = New-Item -ItemType Directory -Force -Path $plansRoot
  Write-JsonAtomic (Join-Path $plansRoot '.current') ([ordered]@{ planId = $planId; at = Now-Stamp })
}

# ─────────────────────────────────────────────────────────────────────────────
# 5.5 · 运行级事务记录（跨套件）—— 住 `<工程>\.kit-origin\runs\<runId>\run.json`
# ─────────────────────────────────────────────────────────────────────────────
#
# 为什么套件级不够：提交是**逐个套件**做的（建新代次 → 原子换清单），而「这次更新」是一个整体。
# 进程死在「第一个套件已提交、第二个还没提交」之间时，两份套件日志各自都没说错话，
# 组合却是没人解释得了的：一部分工程副本已经换成新母本，另一部分还停在旧版，
# 而来源记录一半新一半旧，下一轮扫描会把这种状态当成「正常工程」继续往下走。
#
# ⚠️ 判据的地基：**运行记录是权威，套件日志是记账。**
# 运行没写到 COMMITTED，它的参与者即使套件日志写着 COMMITTED 也要退回去；
# 运行写了 COMMITTED，套件日志没跟上只是**记账没同步**（补齐即可，不退内容）。

$script:RunTerminal    = @('COMMITTED', 'ROLLED_BACK', 'NO_COMMIT')
$script:RunCommitPhase = @('VALIDATING', 'COMMITTING', 'ROLLING_BACK', 'RECOVERY_REQUIRED')
# 恢复时用来判「清单在不在事务范围内」：**提交阶段的入口是 `COMMITTING`**
# （换清单发生在它之后）⇒ 停在这五个状态的事务**不可能**动过清单。
$script:RestoreCommitPhase = @('COMMITTING', 'ROLLING_BACK', 'RECOVERY_REQUIRED')

function New-RunId() {
  return 'run-' + (Get-Date).ToString('yyyyMMdd-HHmmss-fff') + '-' + (Get-Random -Minimum 1000 -Maximum 9999)
}
function Get-RunsRoot() { return (Join-Path $OriginRoot 'runs') }
function Get-RunRecordPath([string]$runId) { return (Join-Path (Join-Path (Get-RunsRoot) $runId) 'run.json') }

function Get-RunRecords() {
  # 目录名带时间戳前缀 ⇒ 按名字排序就是时间序（同一毫秒再撞就退化成随机序，可接受）。
  # ⚠️ 返回 `[object[]]`，**不是** List[object]：调用方一用 `@()` 套 List 就必定抛。
  $list = New-Object System.Collections.Generic.List[object]
  $root = Get-RunsRoot
  if (Test-Path -LiteralPath $root) {
    foreach ($d in (Get-ChildItem -LiteralPath $root -Directory -Force | Sort-Object Name)) {
      $f = Join-Path $d.FullName 'run.json'
      $j = Read-Json $f
      if ($null -eq $j) {
        $list.Add([pscustomobject]@{ id = $d.Name; state = 'BROKEN'; record = $null; path = $f })
        continue
      }
      $list.Add([pscustomobject]@{ id = [string]$j.runId; state = [string]$j.state; record = $j; path = $f })
    }
  }
  return ,([object[]]$list.ToArray())
}

function Get-UnfinishedRuns() {
  $out = New-Object System.Collections.Generic.List[object]
  foreach ($r in (Get-RunRecords)) { if ($script:RunTerminal -notcontains $r.state) { $out.Add($r) } }
  return ,([object[]]$out.ToArray())
}

function New-RunRecord([string]$runId, $participants) {
  # participants: @( @{ kit; planId } )，由调用方排序 ⇒ 输出确定。
  # 「旧状态」在这里就落盘：参与者清单 ＋ 各自清单的**事务前**哈希与生效代次。
  # 它有两个用途：恢复时说出「这次运行涉及谁」，以及运行记录丢了日志时还有一份可核对的读数。
  $items = New-Object System.Collections.Generic.List[object]
  foreach ($p in $participants) {
    $originDir = Join-Path $OriginRoot $p.kit
    $st = Get-FileState (Join-Path $originDir $MANIFEST)
    $mf = Read-Manifest $originDir
    $items.Add([ordered]@{
      kit                    = $p.kit
      planId                 = $p.planId
      manifestBeforeExists   = [bool]$st.exists
      manifestBeforeSha      = [string]$st.sha256
      activeGenerationBefore = $(if ($null -ne $mf) { [string]$mf.activeGeneration } else { '' })
      manifestAfterSha       = ''
      journalState           = ''
    })
  }
  return [ordered]@{
    runFormatVersion = 1
    runId            = $runId
    project          = $Project
    state            = 'RUNNING'
    startedAt        = Now-Stamp
    finishedAt       = ''
    participants     = $items
    note             = ''
  }
}

function Save-RunRecord($rec) {
  Write-JsonAtomic (Get-RunRecordPath ([string]$rec.runId)) $rec
}

function Sync-RunParticipants($rec) {
  # 把参与者的**套件日志状态**回填进运行记录：出报告时「谁停在哪一步」才是查得出来的。
  foreach ($p in $rec.participants) {
    $planDir = Join-Path (Join-Path (Join-Path $OriginRoot $p.kit) 'plans') $p.planId
    $j = Read-Json (Join-Path $planDir 'journal.json')
    $p.journalState = $(if ($null -eq $j) { 'no-journal' } else { [string]$j.state })
    $blk = Get-Prop $j 'manifest' $null
    if ($null -ne $blk) { $p.manifestAfterSha = [string](Get-Prop $blk 'afterSha' '') }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# 6 · 应用：锁 → 复核 → 备份 → 写入 → 验证 → 提交
# ─────────────────────────────────────────────────────────────────────────────

function Enter-Lock([string]$originDir, [string]$kit) {
  $lockPath = Join-Path $originDir '.lock'
  if (Test-Path -LiteralPath $lockPath) {
    $info = Read-Json $lockPath
    $alive = $false
    if ($info -and $info.pid) { $alive = ($null -ne (Get-Process -Id ([int]$info.pid) -ErrorAction SilentlyContinue)) }
    if ($alive) { Stop-Usage "另一个更新器正在写 $kit（pid $($info.pid)，锁：$lockPath）。等它结束，或确认是残留后删掉那个文件。" }
    Write-Human "  （清掉一个残留的锁：$lockPath）" 'DarkGray'
  }
  $null = New-Item -ItemType Directory -Force -Path $originDir
  Write-JsonAtomic $lockPath ([ordered]@{ pid = $PID; kit = $kit; at = Now-Stamp })
  return $lockPath
}

function Exit-Lock([string]$lockPath) { if (Test-Path -LiteralPath $lockPath) { Remove-Item -LiteralPath $lockPath -Force } }

function Get-PlanMismatch($plan, $st, $mf, $donePaths) {
  # 应用前复核 B/M/P 与计划一致 —— 任何相关状态变化都让计划失效。
  # **已经应用过的条目跳过**：那份计划可能只应用了一部分（还有未解决项等着裁决），
  # 而那些写完的文件本来就该和计划不一样了。
  # M 变化**不算失效**：计划里已经固定了目标内容（staged），continue-with-snapshot 是设计的一部分。
  $bad = New-Object System.Collections.Generic.List[string]
  foreach ($pe in $plan.entries) {
    $rel = $pe.path
    if ($donePaths.ContainsKey($rel)) { continue }
    $nowP = $st.proj.ContainsKey($rel)
    if ($nowP -ne [bool]$pe.p.exists) { $bad.Add("P 存在性变了：$rel"); continue }
    if ($nowP -and $st.proj[$rel].sha256 -ne [string]$pe.p.sha256) { $bad.Add("P 内容变了：$rel"); continue }
    $nowBEx = $false
    if (($null -ne $mf) -and $mf.files.ContainsKey($rel)) { $nowBEx = $mf.files[$rel].base.exists }
    if ($nowBEx -ne [bool]$pe.b.exists) { $bad.Add("B 记录变了：$rel"); continue }
    if ($nowBEx -and $mf.files[$rel].base.sha256 -ne [string]$pe.b.sha256) { $bad.Add("B 内容变了：$rel"); continue }
  }
  return ,([string[]]$bad.ToArray())
}

function Invoke-Verify([string]$ProjectRoot, [string]$Tag) {
  $tsc = Join-Path $ProjectRoot 'node_modules\.bin\tsc.cmd'
  if (-not (Test-Path -LiteralPath $tsc)) { return @{ ran = $false; ok = $true; reason = '工程里没有 node_modules\.bin\tsc.cmd'; tag = $Tag } }
  $prev = Get-Location
  try {
    Set-Location -LiteralPath $ProjectRoot
    $raw = & $tsc --noEmit 2>&1 | Out-String
    $code = $LASTEXITCODE
  }
  finally { Set-Location $prev }
  return @{ ran = $true; ok = ($code -eq 0); command = "$tsc --noEmit"; exitCode = $code; output = $raw.Trim(); tag = $Tag }
}

# ── 写前验证：**整个 run 只跑一次**
#
# 为什么不是「每个套件各跑一次」（缺陷 10 的另一面）：`tsc` 看的是**整个工程**。
# 第二个套件开始写之前，第一个套件已经写过了 —— 那时再取「写前」，量到的是
# 「工程被改了一半」的样子，而 `preOk` 的用途恰恰是「分清本来就坏 vs 本工具搞坏」。
# 所以这次采样必须发生在**本轮第一次写入之前**，之后只复用不再重取。
$script:SharedPreDone = $false
$script:SharedPre = $null
function Get-SharedPreCheck([bool]$touchesProject, [string]$verifyMode) {
  if (-not $touchesProject -or $verifyMode -eq 'none') { return $null }
  if (-not $script:SharedPreDone) {
    $script:SharedPre = Invoke-Verify $Project 'pre'
    $script:SharedPreDone = $true
  }
  return $script:SharedPre
}

function Invoke-ApplyKit($st, [string]$planId, [bool]$allowPartial, [string]$verifyMode, [bool]$sourceOk, [bool]$pinned, [string]$runId = '') {
  # ⚠️ `context` 必须**在构造时就声明**：`[pscustomobject]` 事后 `$o.新属性 = …` 会抛
  # 「在此对象上找不到属性」（实测），而那个异常会掉进 catch 变成一句 exit 5 ——
  # 现场看着像「验证失败回滚」，其实是工具自己炸了。
  $result = [pscustomobject][ordered]@{ kit = $st.kit; state = 'noop'; written = @(); deleted = @(); advanced = @(); problems = @(); validation = $null; context = $null }

  $mf = Read-Manifest $st.originDir
  if ($null -eq $mf) { $result.problems = @('没有基线 —— 先跑 -Install（新装）或 -Adopt（已有副本补基线）'); $result.state = 'no-baseline'; return $result }
  $intact = Test-BaselineIntact $mf
  if ($intact.Count -gt 0) { $result.problems = @($intact); $result.state = 'invalid-origin'; return $result }
  if ($mf.sourceRoot -and $mf.sourceRoot -ne $MasterRoot -and -not $sourceOk) {
    $result.problems = @("母本目录与清单里记录的不一致：记录 $($mf.sourceRoot) / 现在 $MasterRoot —— 确认要从这个来源更新的话加 -SourceOk")
    $result.state = 'source-changed'; return $result
  }

  $plan = Read-Plan $st.originDir $planId
  if ($null -eq $plan) { $result.problems = @("找不到计划 $planId"); $result.state = 'no-plan'; return $result }

  # 计划也是磁盘上的文件：**在动任何东西之前**先把它里面的路径过一遍。
  $unsafe = @($plan.entries | Where-Object { -not (Test-SafeRel ([string]$_.path)) })
  if ($unsafe.Count -gt 0) {
    $result.state = 'unsafe-plan'
    $result.problems = @("计划里有越界的条目路径（拒绝执行，一个字节都没写）：$((@($unsafe | ForEach-Object { $_.path }) | Select-Object -First 5) -join ', ')")
    return $result
  }

  # 计划固定的是**扫描那一刻**的母本。母本后来又变了，只有两种正当处理：重新出计划，或者
  # **明确**说「就用计划里那个快照」。默默拿旧快照什么都不做是最坏的一种 —— 它看起来像成功。
  $nowDigest = Get-TreeDigest $st.master
  if ([string]$plan.source.targetDigest -ne $nowDigest -and -not $pinned) {
    $result.state = 'source-moved'
    $result.problems = @(
      "母本在计划之后变过（计划 $(($plan.source.targetDigest).Substring(0, 8))… / 现在 $($nowDigest.Substring(0, 8))…）",
      '重新跑一次 -Scan（或直接 -Apply，它会现扫一份），或者加 -Pinned 明确表示「就用计划里那个快照」。')
    return $result
  }

  # 已经应用过的条目跳过：部分更新之后那份计划上还挂着没裁决的条目，
  # 再次应用时不该去复核（也不该重写）那些已经写好的文件。
  $donePaths = Get-DonePaths $st.originDir $planId
  $bad = Get-PlanMismatch $plan $st $mf $donePaths
  if ($bad.Count -gt 0) { $result.problems = @($bad); $result.state = 'stale'; return $result }

  # 这一轮实际的解决选择以**计划里记的**为准（`-Resolve` 写进去的）。
  $resolutions = @{}
  foreach ($pe in $plan.entries) { if ($pe.resolution) { $resolutions[$pe.path] = [string]$pe.resolution } }

  $todo = New-Object System.Collections.Generic.List[object]
  $blocked = New-Object System.Collections.Generic.List[string]
  foreach ($pe in $plan.entries) {
    if ($donePaths.ContainsKey([string]$pe.path)) { continue }
    $code = [string]$pe.code
    $grp = $VDEF[$code].group
    if ($grp -eq 'same' -or $grp -eq 'local') { continue }
    $res = ''
    if ($resolutions.ContainsKey($pe.path)) { $res = $resolutions[$pe.path] }
    $action = Get-Action $code $res
    if ($action -eq 'none') {
      if ($grp -eq 'unresolved') { $blocked.Add("$($pe.path)  ($($VDEF[$code].text))") }
      continue
    }
    $todo.Add([pscustomobject]@{ path = $pe.path; code = $code; action = $action; res = $res })
  }

  if ($blocked.Count -gt 0 -and -not $allowPartial) {
    $result.state = 'unresolved'
    $result.problems = @($blocked)
    return $result
  }
  if ($todo.Count -eq 0) {
    $result.state = if ($blocked.Count -gt 0) { 'unresolved' } else { 'up-to-date' }
    $result.problems = @($blocked)
    return $result
  }

  $touchesProject = $false
  foreach ($t in $todo) { if ($t.action -eq 'write' -or $t.action -eq 'delete') { $touchesProject = $true } }

  $lockPath = Enter-Lock $st.originDir $st.kit
  $planDir  = Join-Path (Join-Path $st.originDir 'plans') $planId
  $journalPath = Join-Path $planDir 'journal.json'
  $stagedRoot = Join-Path $planDir 'staged'
  $beforeMetaDir = Join-Path $planDir 'before-meta'
  $stagedMetaDir = Join-Path $planDir 'staged-meta'
  $manifestPath = Join-Path $st.originDir $MANIFEST
  $journal = [ordered]@{
    journalFormatVersion = 2
    planId   = $planId
    kit      = $st.kit
    runId    = $runId
    state    = 'PLANNED'
    startedAt = Now-Stamp
    validation = $null
    manifest = $null      # 提交预告（换清单这一步的事务前状态与预期写后状态）
    recovery = @()
    steps    = @()
  }
  Write-JsonAtomic $journalPath $journal

  try {
    # ── PREPARED：记下**事务前状态**与**预期写后状态**（两个都要，缺一个恢复就残一半）
    #
    #   · 事务前状态 —— 恢复拿它认「现在是不是已经回到原样了」（重复执行安全靠它）；
    #   · 预期写后状态 —— 恢复拿它认「现在是不是本事务写的那个」。
    #
    # ⚠️ 预期写后状态必须**在写入之前**落盘。只在写成功之后才记是不行的：进程若死在
    # 「文件已写、完成标记还没落盘」那一刻，日志里就只剩「这一步我还没做」，
    # 而盘上的文件其实已经换掉了 —— 那是一份会骗人的恢复依据，比没有依据更坏。
    $beforeDir = Join-Path $planDir 'before'
    $pre = New-Object System.Collections.Generic.List[object]
    $seq = 0
    foreach ($t in $todo) {
      # **所有**动作都记一步（含只推进基线、不碰文件的那两种）。漏了它们，日志的 done 集合
      # 就不完整，重新应用同一份计划时会去复核那些**已经推进过**的条目并报「B 变了」。
      $seq++
      $isFileOp = ($t.action -eq 'write' -or $t.action -eq 'delete')
      $exists = $false; $sha = ''
      $afterExists = $false; $afterSha = ''
      if ($isFileOp) {
        $cur = Join-Under $st.projDir $t.path
        $exists = Test-Path -LiteralPath $cur
        if ($exists) { $sha = Get-Hash $cur; Copy-OneFile $cur (Join-Under $beforeDir $t.path) }
        if ($t.action -eq 'write') {
          $src = Join-Under $stagedRoot $t.path
          if (-not (Test-Path -LiteralPath $src)) { throw "计划的暂存内容不见了，拒绝写入：$src" }
          # 写入就是「暂存内容 → 目标」的一次拷贝 ⇒ 现在就等于将来的写后哈希。
          $afterExists = $true; $afterSha = (Get-Hash $src)
        }
      }
      $pre.Add([ordered]@{
        seq = $seq; path = $t.path; action = $t.action
        beforeExists = $exists; beforeSha = $sha
        afterExists = $afterExists; afterSha = $afterSha
        done = $false; at = ''
      })
    }

    # 提交预告：新代次名 ＋ **换完清单之后它应当是什么**（连同一份可核对的字节）。
    # 换清单是这次事务的最后一步写动作，所以它也要有事务前状态与预期写后状态，
    # 否则「清单已经换过、日志还没提交」那个窗口同样没有恢复依据。
    $newGen = Get-NextGeneration $mf.dir
    $mfBefore = Get-FileState $manifestPath
    Copy-OneFile $manifestPath (Join-Under $beforeMetaDir $MANIFEST)
    $mfAfterDoc = Get-ManifestDoc (New-ManifestAfterDoc $mf $plan $resolutions $newGen $stagedRoot $planId)
    $mfAfterPath = Join-Under $stagedMetaDir $MANIFEST
    Write-JsonAtomic $mfAfterPath $mfAfterDoc
    $journal.manifest = [ordered]@{
      path                   = $MANIFEST
      beforeExists           = [bool]$mfBefore.exists
      beforeSha              = [string]$mfBefore.sha256
      beforeCopy             = 'before-meta/' + $MANIFEST
      afterExists            = $true
      afterSource            = 'staged-meta/' + $MANIFEST
      afterSha               = (Get-Hash $mfAfterPath)
      activeGenerationBefore = [string]$mf.activeGeneration
      activeGenerationAfter  = $newGen
      switched               = $false
    }

    $journal.state = 'PREPARED'
    $journal.steps = $pre
    Write-JsonAtomic $journalPath $journal
    Invoke-CrashPoint 'AFTER_PREPARED'

    # ── VALIDATING（写前一次，**整个 run 只跑一次**）：只为了把「本来就失败」与「本工具搞坏的」分开。
    # ⚠️ 它在下面那次 `Get-SharedPreCheck` 里**只在本轮第一次写入之前**取一次 ——
    # 每个套件各取一次的话，第二个套件的「写前」是在第一个套件写过之后测的，归因就错了。
    $preCheck = Get-SharedPreCheck $touchesProject $verifyMode

    # ── WRITING
    $journal.state = 'WRITING'
    Write-JsonAtomic $journalPath $journal
    foreach ($step in $journal.steps) {
      if ($step.action -notin @('write', 'delete')) {
        # 只推进基线的条目：工程里没有文件动作，但**这一条已经处理完了**。
        $step.done = $true; $step.at = Now-Stamp
        Write-JsonAtomic $journalPath $journal
        continue
      }
      $dst = Join-Under $st.projDir $step.path
      if (-not (Test-Contained $st.projDir $dst)) { throw "目标路径越出了套件目录，拒绝写入：$($step.path)" }
      if (-not (Test-NotLink $dst)) { throw "目标是链接（不跟随跳转），拒绝写入：$($step.path)" }
      $curExists = Test-Path -LiteralPath $dst
      $curSha = ''
      if ($curExists) { $curSha = Get-Hash $dst }
      if ($curExists -ne [bool]$step.beforeExists -or ($curExists -and $curSha -ne [string]$step.beforeSha)) {
        throw "写入前复核失败：$($step.path) 在计划之后被改过。"
      }
      if ($step.action -eq 'write') {
        Copy-OneFile (Join-Under $stagedRoot $step.path) $dst
        # 写后就是**预告的那个字节**吗？不是就当场退回去 —— 预告与实际一旦分叉，
        # 后面的恢复判定会拿预告去比，于是把一个正常的现场判成「第三方改过」。
        $actual = Get-Hash $dst
        if ($actual -ne [string]$step.afterSha) {
          throw "写入结果与预告不符（暂存内容 → 目标 应当逐字节相同）：$($step.path)"
        }
      }
      else {
        Remove-FileAndPrune $st.projDir $step.path
        $step.afterExists = $false; $step.afterSha = ''
      }
      # ⚠️ 注入点就放在**文件已经改了、这一步的完成标记还没落盘**之间。
      Invoke-CrashPoint 'AFTER_FILE_WRITE'
      $step.done = $true; $step.at = Now-Stamp
      Write-JsonAtomic $journalPath $journal
      if ($step.action -eq 'write') { $result.written = @($result.written) + @($step.path) } else { $result.deleted = @($result.deleted) + @($step.path) }
    }
    Invoke-CrashPoint 'AFTER_WRITES'

    # ── 交棒：**验证与提交都不在这里做**（缺陷 10 的修法）
    #
    # 现场已经写好了（journal 落 `WRITTEN`），但先不验证、也不提交 —— 因为
    # **验证的粒度是整个工程，而这里的粒度是一个套件**。逐套件验证必然误判：
    # 类型包 import 内核**新增的文件**时，第一个套件（按名字排序在前）写完就立刻跑 `tsc`，
    # 那一刻那个新文件还没写 → 「写前通过 · 写后失败」→ 回滚已写的一半、退出码 5，
    # 而再跑一次就好了（第二次内核已经在了）。实测在 `remotion-kit-lab` 与 `hotspot-zcode`
    # 两个真实工程上都复现过。
    #
    # 所以：**先把所有套件都写完，再验证一次，最后逐个落定**（回滚或提交）。
    # 被否掉的那条路是「按 `compose.ts` 声明的来源排套件顺序」—— 它要工具认识依赖图，
    # 而 T02 明确要求**工具不认识「kernel」这个名字**（顺序法还会让「谁依赖谁」变成第二份真相）。
    #
    # ⚠️ 锁**在这里不释放**，交给 `Invoke-FinalizeKit`。中途进程死掉的话，锁是残留的
    # （`Enter-Lock` 认死 pid 会清掉），而 journal 停在 `WRITTEN` —— 那是「未完成事务」，
    # `-Rollback` 认它（见 `Invoke-RollbackKit` 与那道未完成事务的拦截）。
    $journal.state = 'WRITTEN'
    $journal.validation = $null
    Write-JsonAtomic $journalPath $journal
    $result.state = 'written'
    $result.context = [pscustomobject][ordered]@{
      kit = $st.kit; st = $st; mf = $mf; plan = $plan; planId = $planId; planDir = $planDir
      journalPath = $journalPath; journal = $journal; stagedRoot = $stagedRoot
      resolutions = $resolutions; blocked = $blocked; result = $result
      lockPath = $lockPath; touchesProject = $touchesProject; verifyMode = $verifyMode
      preCheck = $preCheck; runId = $runId
    }
    $handoff = $true
    return $result
  }
  catch {
    $err = $_.Exception.Message
    $phase = [string]$journal.state
    $journal.state = 'ROLLING_BACK'
    try { Write-JsonAtomic $journalPath $journal } catch { }
    $recovery = @()
    try { $recovery = Restore-FromJournal $st $planDir $journal $phase } catch { $recovery = @("回滚本身失败：$($_.Exception.Message)") }
    $journal.state = $(if ($recovery.Count -gt 0) { 'RECOVERY_REQUIRED' } else { 'RESTORED' })
    try { Write-JsonAtomic $journalPath $journal } catch { }
    $result.state = $(if ($recovery.Count -gt 0) { 'recovery-required' } else { 'failed-rolled-back' })
    $result.problems = @($err) + @($recovery)
    return $result
  }
  # ⚠️ `finally` 里**不能**无条件释放锁：交棒成功时锁要跟着现场一起交给
  # `Invoke-FinalizeKit`（它负责回滚或提交，然后才放锁）。提前放锁会让另一个更新器
  # 在「文件已写、还没提交」的窗口里进来。
  finally { if (-not $handoff) { Exit-Lock $lockPath } }
}

# ── 落定一个已经写完的套件：验证结果 → 回滚 或 提交
#
# 它与 `Invoke-ApplyKit` 的分工就是缺陷 10 的修法：**写入按套件做，验证按整个工程做**。
# 验证结果由调用方在**所有套件都写完之后**统一取一次，再喂进来。
function Invoke-FinalizeKit($ctx, $postCheck) {
  $st = $ctx.st
  $plan = $ctx.plan
  $planId = $ctx.planId
  $planDir = $ctx.planDir
  $journalPath = $ctx.journalPath
  $journal = $ctx.journal
  $stagedRoot = $ctx.stagedRoot
  $resolutions = $ctx.resolutions
  $blocked = $ctx.blocked
  $mf = $ctx.mf
  $result = $ctx.result
  $preCheck = $ctx.preCheck

  try {
    $journal.state = 'VALIDATING'
    $journal.validation = [ordered]@{
      ran = ($null -ne $postCheck -and $postCheck.ran)
      preOk  = $(if ($null -eq $preCheck)  { $null } else { $preCheck.ok })
      postOk = $(if ($null -eq $postCheck) { $null } else { $postCheck.ok })
      preOutput  = $(if ($null -ne $preCheck  -and $preCheck.ran  -and -not $preCheck.ok)  { $preCheck.output }  else { '' })
      postOutput = $(if ($null -ne $postCheck -and $postCheck.ran -and -not $postCheck.ok) { $postCheck.output } else { '' })
    }
    $result.validation = $journal.validation
    Write-JsonAtomic $journalPath $journal

    if ($null -ne $postCheck -and $postCheck.ran -and -not $postCheck.ok -and ($null -eq $preCheck -or -not $preCheck.ran -or $preCheck.ok)) {
      # 写前通过、写后失败 —— 这次更新是嫌疑人。回滚。
      # ⚠️ 这里回滚的是**本套件**的写入；别的套件各自回滚各自的（调用方按顺序都叫一遍）。
      $journal.state = 'ROLLING_BACK'
      Write-JsonAtomic $journalPath $journal
      $recovery = Restore-FromJournal $st $planDir $journal 'VALIDATING'
      $journal.state = $(if ($recovery.Count -gt 0) { 'RECOVERY_REQUIRED' } else { 'RESTORED' })
      Write-JsonAtomic $journalPath $journal
      $result.state = $(if ($recovery.Count -gt 0) { 'recovery-required' } else { 'validation-failed-rolled-back' })
      $result.problems = @($recovery)
      return $result
    }

    # ── 提交：先建好新代次，再原子替换清单（崩在中间时旧清单＋旧代次仍然完整）
    #
    # 清单**换完之后长什么样**在 PREPARED 就预告好并落成字节了（`staged-meta/`）——
    # 这里只做两件事：把新代次建出来、把预告的那份字节原子换上去。
    # 顺序也照抄预告：**先落 `COMMITTING`（含清单的事务前状态与预期写后状态），再换清单**。
    # 反过来（先换清单再记）会让「清单已经换了、日志还说没换」这个窗口没有恢复依据。
    $blk = Get-Prop $journal 'manifest' $null
    if ($null -eq $blk) { throw '提交预告不见了（日志里没有 manifest 段）：拒绝提交 —— 写出去会得到一个恢复不了的状态' }
    $plannedGen = [string](Get-Prop $blk 'activeGenerationAfter' '')
    $changes = @{}
    foreach ($pe in $plan.entries) {
      $code = [string]$pe.code
      $grp = $VDEF[$code].group
      if ($grp -eq 'same' -or $grp -eq 'local') { continue }
      $res = ''; if ($resolutions.ContainsKey($pe.path)) { $res = $resolutions[$pe.path] }
      $action = Get-Action $code $res
      if ($action -eq 'none') { continue }
      if ($action -eq 'write') {
        $changes[$pe.path] = @{ exists = $true; content = (Join-Under $stagedRoot $pe.path) }
      }
      elseif ($action -eq 'delete') {
        $changes[$pe.path] = @{ exists = $false; content = $null }
      }
      else {
        # baseline：B 要变成 **M 那一版** —— M 存在就得有内容（少了这一步，下一轮会把
        # 刚接受的文件判成「本地独有」，因为基线里没有它的内容），不存在才是「删除记录」。
        if ([bool]$pe.m.exists) { $changes[$pe.path] = @{ exists = $true; content = (Join-Under $stagedRoot $pe.path) } }
        else { $changes[$pe.path] = @{ exists = $false; content = $null } }
      }
      $result.advanced = @($result.advanced) + @($pe.path)
    }
    $newGen = New-Generation $mf $stagedRoot $changes
    if ($newGen -ne $plannedGen) {
      # 代次名是清单预告的一部分（`activeGeneration`）。名字对不上 ⇒ 预告那份字节写下去就是错的。
      throw "新建的代次（$newGen）与提交预告（$plannedGen）不一致：拒绝换清单"
    }
    Invoke-CrashPoint 'AFTER_NEWGEN'

    Set-Prop $journal 'state' 'COMMITTING'
    $blk['switched'] = $false
    Set-Prop $journal 'manifest' $blk
    Write-JsonAtomic $journalPath $journal

    $mfAfterPath = Get-RelUnder $planDir ([string](Get-Prop $blk 'afterSource' 'staged-meta/.origin.json'))
    if ($null -eq $mfAfterPath -or -not (Test-Path -LiteralPath $mfAfterPath)) {
      throw '清单预告字节不见了：拒绝换清单（换成一个恢复不了的状态比不更新更坏）'
    }
    Copy-OneFileAtomic $mfAfterPath (Join-Path $st.originDir $MANIFEST)
    $mfNow = Get-FileState (Join-Path $st.originDir $MANIFEST)
    if (-not (Test-SameState $mfNow @{ exists = $true; sha256 = [string](Get-Prop $blk 'afterSha' '') })) {
      throw "换上去的清单哈希与预告不符（拒绝继续）"
    }
    $blk['switched'] = $true
    Set-Prop $journal 'manifest' $blk
    Write-JsonAtomic $journalPath $journal
    Invoke-CrashPoint 'AFTER_MANIFEST_SWITCH'

    # ⚠️ 这里**不写** `COMMITTED`：提交的完成标记归**运行级**（见 main 里的 ③/④ 两趟）。
    # 套件日志停在 `COMMITTING` 是如实记账 —— 「本套件的内容已经换好了，整次运行还没落定」。
    $journal.finishedAt = Now-Stamp
    Write-JsonAtomic $journalPath $journal

    $result.state = if ($blocked.Count -gt 0) { 'partial' } else { 'committed' }
    $result.problems = @($blocked)
    return $result
  }
  catch {
    $err = $_.Exception.Message
    $phase = [string]$journal.state
    $journal.state = 'ROLLING_BACK'
    try { Write-JsonAtomic $journalPath $journal } catch { }
    $recovery = @()
    try { $recovery = Restore-FromJournal $st $planDir $journal $phase } catch { $recovery = @("回滚本身失败：$($_.Exception.Message)") }
    $journal.state = $(if ($recovery.Count -gt 0) { 'RECOVERY_REQUIRED' } else { 'RESTORED' })
    try { Write-JsonAtomic $journalPath $journal } catch { }
    $result.state = $(if ($recovery.Count -gt 0) { 'recovery-required' } else { 'failed-rolled-back' })
    $result.problems = @($err) + @($recovery)
    return $result
  }
  finally { Exit-Lock $ctx.lockPath }
}

function Get-StepAfterState($journal, $step, [string]$stagedRoot, [bool]$hasPreRecordedAfter) {
  # 「本事务**预期写后**的状态」。它是恢复判定的另一半 —— 只有事务前状态是不够的：
  # 那样只能回答「现在是不是事务前」，答不了「现在是不是我写的那个」。
  #
  # v2 日志在**写入之前**就把两个哈希都记下来了（write 取暂存内容、delete 记「不存在」）。
  # v1 日志没记，但**暂存内容还在**，而写入就是「暂存内容 → 目标」的一次拷贝
  # ⇒ 暂存内容的哈希仍然是有证据的预期写后哈希（不是事后推算，也不是猜）。
  # 拿不到证据就返回 $null —— 调用方据此**只做有证据支持的恢复动作**。
  $action = [string]$step.action
  # v1 日志**已经完成**的那一步也带着证据：老代码是「写完文件 → 记哈希 → 连同 done 一起落盘」，
  # 所以 `done=true` 时那两个字段是**当时**写下来的，不是事后推算。缺的只是 `done=false` 那一格。
  $hasEvidence = $hasPreRecordedAfter -or [bool](Get-Prop $step 'done' $false)
  if ($hasEvidence) {
    $ex = [bool](Get-Prop $step 'afterExists' $false)
    $sha = [string](Get-Prop $step 'afterSha' '')
    if ($action -eq 'delete') { return @{ exists = $false; sha256 = '' } }
    if ($ex -and $sha) { return @{ exists = $true; sha256 = $sha } }
    # 记了「写」却没哈希：退回暂存内容（下面那一支）
  }
  if ($action -eq 'delete') { return $null }   # 「不存在」没有哈希能证明：旧日志里认不出这是我们删的
  $stagedFile = Join-Under $stagedRoot ([string]$step.path)
  if (-not (Test-Path -LiteralPath $stagedFile)) { return $null }
  return @{ exists = $true; sha256 = (Get-Hash $stagedFile) }
}

# 逐对象恢复进度。函数把它**重填**一遍，调用方读它出报告 ——
# 「重跑一次能不能继续」这件事只有逐项记下来才说得清。
$script:RestoreLog = @()
# 本次恢复**实际动过几个对象**（用于注入「恢复期间再次中断」）
$script:RestoreOps = 0

function Restore-FromJournal($st, [string]$planDir, $journal, [string]$phaseState = '') {
  # 恢复的目标：**这个事务之前的项目文件状态与来源记录状态**。
  #
  # 逐对象三态判定（不是「一律写回」）：
  #   ① 当前 == 事务前状态 → 已经恢复过了 ⇒ 记一笔，不动它（这就是重复执行安全）
  #   ② 当前 == 本事务预期写后状态 → 恢复事务前状态
  #   ③ 都不是 → 保留当前内容，列为冲突（外部改动**不能**被当成「没有冲突」）
  #
  # 两个要害：
  #   · **存在性也参加判定** —— 外部删除、重新新增、改写都不是「没冲突」。
  #   · **清单也在事务范围内** —— 提交就是「换清单」，只回滚工程文件会让 B 记录着新内容、
  #     P 却是旧内容，下一轮扫描会把它读成「工程自己改过」，于是**安静地错下去**。
  $problems = New-Object System.Collections.Generic.List[string]
  $log = New-Object System.Collections.Generic.List[object]
  $script:RestoreLog = @()
  $script:RestoreOps = 0
  $beforeDir = Join-Path $planDir 'before'
  $stagedRoot = Join-Path $planDir 'staged'
  $hasPre = ([int](Get-Prop $journal 'journalFormatVersion' 1)) -ge 2
  # 不写 `@($journal.steps)`：它可能是 List[object]，`@()` 套上去必定抛。
  $steps = $journal.steps
  for ($i = $steps.Count - 1; $i -ge 0; $i--) {
    $step = $steps[$i]
    $action = [string]$step.action
    if ($action -notin @('write', 'delete')) { continue }   # 基线推进没有文件可回滚
    $rel = [string]$step.path
    if (-not (Test-SafeRel $rel)) { $problems.Add("日志里有越界路径，已跳过：$rel"); continue }
    $dst = Join-Under $st.projDir $rel
    if (-not (Test-Contained $st.projDir $dst)) { $problems.Add("日志里的路径越界，已跳过：$rel"); continue }
    if (-not (Test-NotLink $dst)) { $problems.Add("目标是链接，已跳过：$rel"); continue }

    $before = @{ exists = [bool]$step.beforeExists; sha256 = [string]$step.beforeSha }
    $cur = Get-FileState $dst
    if (Test-SameState $cur $before) {
      $log.Add([ordered]@{ kind = 'file'; path = $rel; status = 'already-before'; note = '' })
      continue
    }
    $after = Get-StepAfterState $journal $step $stagedRoot $hasPre
    if ($null -eq $after) {
      $problems.Add("无法确认这一步是否被本事务写过（旧格式日志且没有暂存内容），已跳过：$rel")
      $log.Add([ordered]@{ kind = 'file'; path = $rel; status = 'unverifiable'; note = '没有预期写后状态的证据' })
      continue
    }
    if (-not (Test-SameState $cur $after)) {
      $problems.Add("回滚时发现第三方编辑，已跳过：$rel")
      $log.Add([ordered]@{ kind = 'file'; path = $rel; status = 'conflict'; note = '当前内容既不是事务前、也不是本事务写后的' })
      continue
    }
    if ($before.exists) {
      $src = Join-Under $beforeDir $rel
      if (-not (Test-Path -LiteralPath $src)) {
        $problems.Add("事务前的备份不见了，无法恢复：$rel")
        $log.Add([ordered]@{ kind = 'file'; path = $rel; status = 'missing-backup'; note = $src })
        continue
      }
      Copy-OneFile $src $dst
      if ((Get-Hash $dst) -ne [string]$before.sha256) {
        $problems.Add("回滚后哈希不符：$rel")
        $log.Add([ordered]@{ kind = 'file'; path = $rel; status = 'hash-mismatch'; note = '' })
      }
      else {
        $log.Add([ordered]@{ kind = 'file'; path = $rel; status = 'restored'; note = '' })
        $script:RestoreOps++
        Invoke-CrashPoint 'DURING_RESTORE'
      }
    }
    else {
      if (Test-Path -LiteralPath $dst) { Remove-FileAndPrune $st.projDir $rel }
      $log.Add([ordered]@{ kind = 'file'; path = $rel; status = 'removed'; note = '事务前它不存在' })
      $script:RestoreOps++
      Invoke-CrashPoint 'DURING_RESTORE'
    }
  }

  # ── 来源清单：提交的**最后一步**就是换它，所以它必须一起恢复。
  $mfBlock = Get-Prop $journal 'manifest' $null
  $state = $(if ($phaseState) { $phaseState } else { [string](Get-Prop $journal 'state' '') })
  $mfPath = Join-Path $st.originDir $MANIFEST
  if ($null -ne $mfBlock) {
    $before = @{ exists = [bool](Get-Prop $mfBlock 'beforeExists' $true); sha256 = [string](Get-Prop $mfBlock 'beforeSha' '') }
    $afterSha = [string](Get-Prop $mfBlock 'afterSha' '')
    $afterExists = [bool](Get-Prop $mfBlock 'afterExists' $true)
    $cur = Get-FileState $mfPath
    if (Test-SameState $cur $before) {
      $log.Add([ordered]@{ kind = 'manifest'; path = $MANIFEST; status = 'already-before'; note = '生效代次仍在事务前那一代' })
    }
    elseif (-not $afterSha) {
      $problems.Add('日志没有记录清单的预期写后哈希 —— 无法判断来源记录是否已被本事务换过（保留当前清单，需要人工确认）')
      $log.Add([ordered]@{ kind = 'manifest'; path = $MANIFEST; status = 'unverifiable'; note = '' })
    }
    elseif (Test-SameState $cur @{ exists = $afterExists; sha256 = $afterSha }) {
      $beforeRel = [string](Get-Prop $mfBlock 'beforeCopy' 'before-meta/.origin.json')
      $src = Get-RelUnder $planDir $beforeRel
      if ($null -eq $src -or -not (Test-Path -LiteralPath $src)) {
        $problems.Add("清单的事务前备份不见了，来源记录无法恢复（当前清单已保留）：$beforeRel")
        $log.Add([ordered]@{ kind = 'manifest'; path = $MANIFEST; status = 'missing-backup'; note = $beforeRel })
      }
      elseif (-not (Test-NotLink $mfPath)) {
        $problems.Add("来源清单是链接，拒绝覆盖：$mfPath")
        $log.Add([ordered]@{ kind = 'manifest'; path = $MANIFEST; status = 'refused-link'; note = '' })
      }
      else {
        Copy-OneFileAtomic $src $mfPath
        if ((Get-Hash $mfPath) -ne [string]$before.sha256) {
          $problems.Add('清单回滚后哈希不符')
          $log.Add([ordered]@{ kind = 'manifest'; path = $MANIFEST; status = 'hash-mismatch'; note = '' })
        }
        else {
          $log.Add([ordered]@{ kind = 'manifest'; path = $MANIFEST; status = 'restored'; note = "生效代次回到 $(Get-Prop $mfBlock 'activeGenerationBefore' '')" })
        }
      }
    }
    else {
      $problems.Add('来源清单在这次事务之外被改过，已保留当前内容（不是「没有冲突」）')
      $log.Add([ordered]@{ kind = 'manifest'; path = $MANIFEST; status = 'conflict'; note = '' })
    }
  }
  elseif ($script:RestoreCommitPhase -contains $state) {
    # 旧格式日志（v1）＋ 停在提交阶段：**清单可能已经被本事务换过**，而这份日志没留备份。
    # 不许拿当前母本去猜旧基线（那会吞掉真实差异），也不许假装没这回事。
    #
    # 但也不能一口咬定「不知道」：`plan.json` 里记着**扫描那一刻**的生效代次，
    # 而本事务的提交一定会换成新代次（`New-Generation` 总是 g(N+1)）⇒ 两值相同
    # 就是「清单没被动过」的**证据**，不同才是真的说不清。
    $planDoc = Read-Json (Join-Path $planDir 'plan.json')
    $scope = Get-Prop $planDoc 'scope' $null
    $planGen = [string](Get-Prop $scope 'activeGeneration' '')
    $mfDoc = Read-Json $mfPath
    $curGen = [string](Get-Prop $mfDoc 'activeGeneration' '')
    if ($planGen -and $curGen -eq $planGen) {
      $log.Add([ordered]@{ kind = 'manifest'; path = $MANIFEST; status = 'already-before'
                           note = "旧格式日志：生效代次仍是扫描那一刻的 $curGen —— 清单没被动过" })
    }
    else {
      $problems.Add("旧格式日志（state=$state）没有来源清单的备份，而生效代次已经不是扫描那一刻那一代（计划记 '$planGen' / 现在 '$curGen'）：来源记录还原不了，需要人工确认")
      $log.Add([ordered]@{ kind = 'manifest'; path = $MANIFEST; status = 'unverifiable'; note = '旧格式日志且代次已变' })
    }
  }
  $script:RestoreLog = $log.ToArray()
  return ,([string[]]$problems.ToArray())
}

# ─────────────────────────────────────────────────────────────────────────────
# 6.5 · 恢复一个事务（唯一入口）
# ─────────────────────────────────────────────────────────────────────────────
#
# 恢复的语义**取决于运行记录，不取决于套件日志自己**：
#   · 运行没写到 COMMITTED（或没有运行记录）⇒ 退回事务前状态（文件 ＋ 来源清单）。
#   · 运行已经 COMMITTED、只有套件日志没跟上 ⇒ **只补齐记账**，一个字节的内容都不退。
# 后一条正是「已提交的更新不撤销」那条规矩的落点：它拒绝的不是恢复动作，而是「退掉一次
# 已经整轮完成、只是记账慢了半拍」的更新。
function Repair-Transaction([string]$kit, [string]$planId, [string]$runState, [bool]$bookkeepingOnly) {
  $res = [pscustomobject][ordered]@{
    kit = $kit; planId = $planId; state = 'noop'; problems = @(); notes = @(); runState = $runState; recovery = @()
  }
  $originDir = Join-Path $OriginRoot $kit
  $planDir = Join-Path (Join-Path $originDir 'plans') $planId
  $journalPath = Join-Path $planDir 'journal.json'
  if (-not (Test-Path -LiteralPath $journalPath)) {
    $res.state = 'no-journal'
    $res.notes = @('没有事务日志：这一支在这轮里没有开始写（不是缺陷）')
    return $res
  }
  $lockPath = Enter-Lock $originDir $kit
  try {
    $journal = Read-Json $journalPath
    if ($null -eq $journal) {
      $res.state = 'broken-journal'
      $res.problems = @("事务日志读不出来：$journalPath")
      return $res
    }
    $state = [string](Get-Prop $journal 'state' '')
    $switched = [bool](Get-Prop (Get-Prop $journal 'manifest' $null) 'switched' $false)
    if ($state -eq 'COMMITTED') { $res.state = 'committed'; $res.notes = @('套件日志已经是 COMMITTED'); return $res }
    if ($state -eq 'RESTORED')  { $res.state = 'already-restored'; return $res }

    if (($state -eq 'COMMITTING') -or $switched) {
      if ($bookkeepingOnly -or $runState -eq 'COMMITTED') {
        # 运行已整轮提交 ⇒ 这次「未完成」只是记账没同步。补齐，**不退内容**。
        Set-Prop $journal 'state' 'COMMITTED'
        if (-not (Get-Prop $journal 'finishedAt' '')) { Set-Prop $journal 'finishedAt' (Now-Stamp) }
        Write-JsonAtomic $journalPath $journal
        $res.state = 'bookkeeping-synced'
        $res.notes = @('运行已完成提交：套件日志补齐为 COMMITTED（内容未回退）')
        return $res
      }
    }
    Set-Prop $journal 'state' 'ROLLING_BACK'
    Write-JsonAtomic $journalPath $journal
    $st = Get-KitState $kit
    # ⚠️ 清单的“在不在事务范围内”要用**改写之前**那个状态判：`ROLLING_BACK` 本身也在提交阶段集合里，
    # 拿它去判会把「一个从没走到提交的事务」误报成「清单可能已经被换过」。
    $problems = Restore-FromJournal $st $planDir $journal $state
    $log = $script:RestoreLog
    Set-Prop $journal 'state' $(if ($problems.Count -gt 0) { 'RECOVERY_REQUIRED' } else { 'RESTORED' })
    Set-Prop $journal 'finishedAt' (Now-Stamp)
    Set-Prop $journal 'recovery' $log
    Write-JsonAtomic $journalPath $journal
    $res.state = $(if ($problems.Count -gt 0) { 'recovery-required' } else { 'restored' })
    $res.problems = @($problems)
    $res.recovery = @($log)
    return $res
  }
  finally { Exit-Lock $lockPath }
}

function Invoke-RunRecovery($run) {
  # 按**整次运行**的范围恢复：参与者一起退回，不留下一半新的组合。
  # ⚠️ 两个状态**分词表**：`state` 走「结果」那一套（小写，与别的结果同一个词表，
  # 退出码映射认它），`recordState` 才是**落盘的运行记录**状态（大写）。
  # 混用会让「恢复失败」静默变成退出码 0 —— 实测踩过（⑦ 两条用例因此假绿）。
  $out = [pscustomobject][ordered]@{
    runId = [string]$run.id; priorState = [string]$run.state; state = ''; recordState = ''; participants = @(); problems = @(); notes = @()
  }
  $problems = New-Object System.Collections.Generic.List[string]
  $notes = New-Object System.Collections.Generic.List[string]
  $parts = New-Object System.Collections.Generic.List[object]
  $runState = [string]$run.state
  $recs = $run.record.participants
  if ($null -eq $recs) {
    $problems.Add('运行记录里没有参与者清单 —— 无法确定这次运行改了哪些套件')
  }
  else {
    foreach ($p in $recs) {
      $kit = [string]$p.kit
      if (-not (Test-Path -LiteralPath (Join-Path $KitsRoot $kit))) {
        $notes.Add("$kit：这个工程里没有这个套件 —— 跳过")
        continue
      }
      $r = Repair-Transaction $kit ([string]$p.planId) $runState $false
      $parts.Add($r)
      foreach ($x in $r.problems) { $problems.Add("$kit：$x") }
      foreach ($x in $r.notes)    { $notes.Add("$kit：$x") }
    }
  }
  $out.participants = @($parts.ToArray())
  $out.problems = @($problems.ToArray())
  $out.notes = @($notes.ToArray())
  # 运行记录自己也要落到一个终态，否则它会**永远拦着**后面每一次 scan/apply。
  # 已经 COMMITTED 的运行**不改状态**（它本来就是完成的，只是记账慢了）—— 那条路只读运行记录。
  if ($runState -ne 'COMMITTED') {
    $rec = $run.record
    $rec.state = $(if ($problems.Count -gt 0) { 'RECOVERY_REQUIRED' } else { 'ROLLED_BACK' })
    $rec.finishedAt = Now-Stamp
    $rec.note = $(if ($problems.Count -gt 0) { '恢复过程有未解决项' } else { '整次运行已退回到事务前状态' })
    Sync-RunParticipants $rec
    Save-RunRecord $rec
    $out.recordState = [string]$rec.state
    $out.state = $(if ($problems.Count -gt 0) { 'recovery-required' } else { 'rolled-back' })
  }
  else {
    Sync-RunParticipants $run.record
    $out.recordState = 'COMMITTED'
    $out.state = 'bookkeeping-synced'
  }
  return $out
}

# ─────────────────────────────────────────────────────────────────────────────
# 7 · 模式：install / adopt / resolve / rollback / list
# ─────────────────────────────────────────────────────────────────────────────

function Invoke-InstallKit([string]$kit, [bool]$force) {
  $res = [pscustomobject][ordered]@{ kit = $kit; state = 'noop'; files = 0; problems = @() }
  $masterDir = Join-Path $MasterRoot $kit
  $projDir   = Join-Path $KitsRoot $kit
  $originDir = Join-Path $OriginRoot $kit
  if (Test-Path -LiteralPath $projDir) {
    $existing = Get-RelSorted $projDir
    if ($existing.Count -gt 0 -and -not $force) {
      $res.state = 'refused'; $res.problems = @("$projDir 已存在且非空（$($existing.Count) 个文件）。要覆盖请加 -Force，或改用 -Apply 做增量更新。")
      return $res
    }
  }
  Copy-Tree $masterDir $projDir
  $planId = 'install-' + (New-PlanId)
  $mf = @{
    dir = $originDir; packageId = $kit; sourceId = 'kits/' + $kit; sourceRoot = $MasterRoot
    managedRoot = 'src/kits/' + $kit; activeGeneration = ''; attested = ''; lastPlanId = $planId; files = @{}
  }
  $staged = Join-Path (Join-Path $originDir 'tmp-install') 'staged'
  Copy-Tree $masterDir $staged
  $changes = @{}
  $at = Now-Stamp
  foreach ($rel in (Get-RelSorted $masterDir)) {
    $mf.files[$rel] = @{ base = @{ exists = $true; sha256 = (Get-Hash (Join-Under $masterDir $rel)); bytes = [int](Get-Item -LiteralPath (Join-Under $masterDir $rel)).Length } }
    Add-History $mf.files[$rel] 'installed' $at
    $changes[$rel] = @{ exists = $true; content = (Join-Under $staged $rel) }
  }
  $mf.activeGeneration = New-Generation $mf $staged $changes
  Write-Manifest $mf
  Remove-Tree (Join-Path $originDir 'tmp-install')
  $res.state = 'installed'; $res.files = $mf.files.Count
  return $res
}

function Invoke-AdoptKit([string]$kit, [bool]$attest) {
  $res = [pscustomobject][ordered]@{ kit = $kit; state = 'noop'; files = 0; problems = @(); attested = $false }
  $masterDir = Join-Path $MasterRoot $kit
  $projDir   = Join-Path $KitsRoot $kit
  $originDir = Join-Path $OriginRoot $kit
  if (Test-Path -LiteralPath (Join-Path $originDir $MANIFEST)) {
    $res.state = 'refused'; $res.problems = @("$kit 已经有基线了。要重建请先手工删掉 $originDir（脚本不替你删 —— 它删掉的是记录）。")
    return $res
  }
  $master = Get-TreeMap $masterDir
  $proj   = Get-TreeMap $projDir
  $diff = New-Object System.Collections.Generic.List[string]
  foreach ($rel in $proj.Keys) {
    if (-not $master.ContainsKey($rel)) { continue }
    if ($master[$rel].sha256 -ne $proj[$rel].sha256) { $diff.Add($rel) }
  }
  if ($diff.Count -gt 0 -and -not $attest) {
    $res.state = 'refused'
    $res.problems = @("副本与母本有 $($diff.Count) 个文件不同 —— 此刻无法区分「落后」与「改过」，所以不建立基线。",
                      '先手工把这些文件对齐母本，或者确认「就把此刻母本当作已接受状态」后用 -AttestMaster。前几个：') +
                    @($diff | Select-Object -First 8)
    return $res
  }
  $mf = @{
    dir = $originDir; packageId = $kit; sourceId = 'kits/' + $kit; sourceRoot = $MasterRoot
    managedRoot = 'src/kits/' + $kit; activeGeneration = ''; lastPlanId = ''; files = @{}
  }
  if ($diff.Count -gt 0) { $mf.attested = "adopted-with-attest at $(Now-Stamp) ($($diff.Count) 个文件与母本不同，被记为「工程改过」)"; $res.attested = $true }
  $staged = Join-Path (Join-Path $originDir 'tmp-adopt') 'staged'
  $changes = @{}
  $at = Now-Stamp
  foreach ($rel in $proj.Keys) {
    if (-not $master.ContainsKey($rel)) { continue }   # 副本独有的：不入基线（它是本地独有文件）
    Copy-OneFile (Join-Under $masterDir $rel) (Join-Under $staged $rel)
    $mf.files[$rel] = @{ base = @{ exists = $true; sha256 = $master[$rel].sha256; bytes = $master[$rel].bytes } }
    Add-History $mf.files[$rel] 'adopted' $at
    $changes[$rel] = @{ exists = $true; content = (Join-Under $staged $rel) }
  }
  $mf.activeGeneration = New-Generation $mf $staged $changes
  Write-Manifest $mf
  Remove-Tree (Join-Path $originDir 'tmp-adopt')
  $res.state = 'adopted'; $res.files = $mf.files.Count
  return $res
}

function Invoke-ResolveKit($st, [string]$planId, [string[]]$selectors, [string]$decision) {
  $res = [pscustomobject][ordered]@{ kit = $st.kit; state = 'noop'; resolved = @(); problems = @() }
  $plan = Read-Plan $st.originDir $planId
  if ($null -eq $plan) { $res.state = 'no-plan'; $res.problems = @("找不到计划 $planId"); return $res }
  $unsafe = @($plan.entries | Where-Object { -not (Test-SafeRel ([string]$_.path)) })
  if ($unsafe.Count -gt 0) {
    $res.state = 'unsafe-plan'
    $res.problems = @("计划里有越界的条目路径，拒绝处理：$((@($unsafe | ForEach-Object { $_.path }) | Select-Object -First 5) -join ', ')")
    return $res
  }
  $useAll = ($selectors -contains 'all')
  $norm = @($selectors | ForEach-Object { $_.Replace('\', '/') })
  # **只认点名本套件的选择器。** `kernel/FORKS.md` 不该让 hotspot 报「没有对应的未解决条目」——
  # 那会让一次本来成功的裁决返回失败（实测踩过：退出码 2，而东西已经写进计划了）。
  $mine = @($norm | Where-Object { $_ -like "$($st.kit)/*" })
  # 复核一遍，拒绝只存在于计划里的条目 —— 状态变了就当计划过期。
  # 已经应用过的条目跳过：部分更新之后那份计划上的其它条目本来就该和现状不一样了。
  $mf = Read-Manifest $st.originDir
  $bad = Get-PlanMismatch $plan $st $mf (Get-DonePaths $st.originDir $planId)
  if ($bad.Count -gt 0) { $res.state = 'stale'; $res.problems = @($bad); return $res }

  $hits = @{}
  foreach ($pe in $plan.entries) {
    if ($VDEF[[string]$pe.code].group -ne 'unresolved') { continue }
    $full = "$($st.kit)/$($pe.path)"
    if ($useAll -or ($mine -contains $full)) { $pe.resolution = $decision; $res.resolved = @($res.resolved) + @($full) }
  }
  if (-not $useAll) {
    $missed = New-Object System.Collections.Generic.List[string]
    foreach ($s in $mine) { if ($res.resolved -notcontains $s) { $missed.Add($s) } }
    if ($missed.Count -gt 0) {
      $res.state = 'refused'
      $res.problems = @("这些选择器没有对应的未解决条目：$($missed -join ', ')") +
                      @('（只存在于计划里、或压根不需要裁决的路径不会静默通过。）')
      return $res
    }
  }
  $planDir = Join-Path (Join-Path $st.originDir 'plans') $planId
  Write-JsonAtomic (Join-Path $planDir 'plan.json') $plan
  $res.state = $(if ($res.resolved.Count -gt 0) { 'resolved' } else { 'nothing' })
  return $res
}

function Invoke-RollbackKit([string]$kit, [string]$which) {
  # ⚠️ 所有字段**在构造时就声明**：`[pscustomobject]` 事后 `$o.新属性 = …` 会抛，
  # 而那个异常发生在写盘之后 ⇒ 现场已经改好了，回报却是「脚本炸了」（实测踩过）。
  $res = [pscustomobject][ordered]@{ kit = $kit; state = 'noop'; problems = @(); notes = @(); recovery = @(); runId = '' }
  $originDir = Join-Path $OriginRoot $kit
  $ids = Get-PlanDirs $originDir
  $target = ''
  $unfinished = New-Object System.Collections.Generic.List[string]
  foreach ($id in $ids) {
    $j = Get-Journal $originDir $id
    if ($null -ne $j -and $j.state -notin @('COMMITTED', 'RESTORED')) { $unfinished.Add($id) }
  }
  if ($which -eq 'latest') { if ($unfinished.Count -gt 0) { $target = $unfinished[$unfinished.Count - 1] } }
  else { $target = $which }
  if (-not $target) { $res.state = 'nothing'; $res.problems = @('没有未完成的事务'); return $res }
  if ($ids -notcontains $target) { $res.state = 'no-plan'; $res.problems = @("找不到事务 $target"); return $res }
  $j = Get-Journal $originDir $target
  if ($null -eq $j) { $res.state = 'no-plan'; $res.problems = @("$target 没有日志"); return $res }
  # 事务跟着哪次运行？**运行没提交 ⇒ 它的 COMMITTED 不算数**（那正是「整次运行断在半路」的形状）。
  $rid = [string](Get-Prop $j 'runId' '')
  $runState = ''
  if ($rid) {
    $rr = Read-Json (Get-RunRecordPath $rid)
    $runState = $(if ($null -eq $rr) { 'MISSING' } else { [string]$rr.state })
  }
  $runInFlight = ($runState -in @('RUNNING', 'COMMITTING', 'RECOVERY_REQUIRED'))
  if ($j.state -eq 'COMMITTED' -and -not $runInFlight) {
    $res.state = 'refused'
    $res.problems = @("$target 已经提交过 —— 要退回请用基线代次手工处理，本工具不做「撤销已提交的更新」。")
    return $res
  }
  $r = Repair-Transaction $kit $target $runState $false
  $res.state = $r.state
  $res.problems = @($r.problems)
  $res.notes = @($r.notes)
  $res.recovery = @($r.recovery)
  $res.runId = $rid
  return $res
}

function Get-KitListReport([string]$kit) {
  $originDir = Join-Path $OriginRoot $kit
  $gens = Get-GenerationDirs $originDir
  $mf = Read-Manifest $originDir
  $plans = @()
  foreach ($id in (Get-PlanDirs $originDir)) {
    $j = Get-Journal $originDir $id
    $plans = @($plans) + @([ordered]@{ planId = $id; state = $(if ($null -eq $j) { 'planned' } else { [string]$j.state }) })
  }
  # `-List` 的用途是「恢复现场时看一眼」，所以**这次运行**涉及本套件的部分也要列出来 ——
  # 少了它，现场是「一半新一半旧」时只能看到各套件各自的状态，看不出它们属于同一次运行。
  $myRuns = @()
  foreach ($r in (Get-RunRecords)) {
    $rec = $r.record
    $mine = @()
    if ($null -ne $rec) {
      foreach ($p in $rec.participants) { if ([string]$p.kit -eq $kit) { $mine = @($mine) + @([ordered]@{ planId = [string]$p.planId }) } }
    }
    if ($mine.Count -gt 0) {
      $myRuns = @($myRuns) + @([ordered]@{
        runId = $r.id; state = $r.state
        startedAt = $(if ($null -ne $rec) { [string]$rec.startedAt } else { '' })
        participants = $mine
      })
    }
  }
  return [pscustomobject][ordered]@{
    kit = $kit
    activeGeneration = $(if ($null -ne $mf) { $mf.activeGeneration } else { '' })
    generations = @($gens)
    attested = $(if ($null -ne $mf) { $mf.attested } else { '' })
    plans = @($plans)
    runs = @($myRuns)
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# 8 · 主流程
# ─────────────────────────────────────────────────────────────────────────────

if ($Resolve.Count -gt 0 -and -not $Decision) { Stop-Usage '-Resolve 需要 -Decision（accept-upstream / keep-local / defer）' }
if ($Resolve.Count -gt 0 -and $Apply -and -not $Plan) { }
if ($Install -and $Apply) { Stop-Usage '-Install 与 -Apply 不能同时用' }
if ($Install -and $Adopt)  { Stop-Usage '-Install 与 -Adopt 不能同时用' }

$mode = 'scan'
if ($List) { $mode = 'list' }
elseif ($Install) { $mode = 'install' }
elseif ($Adopt) { $mode = 'adopt' }
elseif ($Rollback) { $mode = 'rollback' }
elseif ($Resolve.Count -gt 0) { $mode = 'resolve' }
elseif ($Apply) { $mode = 'apply' }

if ($mode -eq 'install') {
  if (-not (Test-Path -LiteralPath $KitsRoot)) { $null = New-Item -ItemType Directory -Force -Path $KitsRoot }
}
$kitsAvailable = @()
if (Test-Path -LiteralPath $MasterRoot) { $kitsAvailable = @(Get-ChildItem -LiteralPath $MasterRoot -Directory -Force | Select-Object -ExpandProperty Name) }
$kitsInProj = @()
if (Test-Path -LiteralPath $KitsRoot) { $kitsInProj = @(Get-ChildItem -LiteralPath $KitsRoot -Directory -Force | Select-Object -ExpandProperty Name) }

$wanted = @()
if ($Kit.Count -gt 0) {
  $wanted = @($Kit | Sort-Object -Unique)
  foreach ($k in $wanted) {
    if ($mode -in @('install', 'adopt')) { if ($kitsAvailable -notcontains $k) { Stop-Usage "母本里没有这个套件：$k（母本有的：$($kitsAvailable -join ', ')）" } }
    elseif ($kitsInProj -notcontains $k) { Stop-Usage "这个工程里没有 $k（工程里有的：$($kitsInProj -join ', ')）" }
  }
}
else {
  if ($mode -in @('install', 'adopt')) { $wanted = @($kitsAvailable | Sort-Object -Unique) }
  else { $wanted = @((@($kitsAvailable) + @($kitsInProj)) | Sort-Object -Unique) }
}

$kitResults = New-Object System.Collections.Generic.List[object]
$planId = ''
$runId = ''

# ── list
if ($mode -eq 'list') {
  foreach ($k in $wanted) { $kitResults.Add((Get-KitListReport $k)) }
}

# ── install / adopt
elseif ($mode -eq 'install' -or $mode -eq 'adopt') {
  foreach ($k in $wanted) {
    if ($mode -eq 'install') { $kitResults.Add((Invoke-InstallKit $k ([bool]$Force))) }
    else { $kitResults.Add((Invoke-AdoptKit $k ([bool]$AttestMaster))) }
  }
}

# ── 未完成事务的拦截：不把半更新状态当成新安装基线。
# 只拦 scan / apply / resolve —— `-Rollback` 的任务**就是**处理未完成事务，拦它等于把出口焊死。
if ($mode -in @('scan', 'apply', 'resolve')) {
  # ① **整次运行**没写完完成标记：它的范围比单个套件大，要先说它。
  #    套件日志各自都没说错话，组合却可能是「一半新一半旧」—— 那正是这一层要拦的东西。
  $blockedRuns = Get-UnfinishedRuns
  if ($blockedRuns.Count -gt 0) {
    $last = $blockedRuns[$blockedRuns.Count - 1]
    Write-Human '⚠ 有一次未完成的运行 —— 先恢复现场，再谈更新：' 'Yellow'
    Write-Human "    运行 $($last.id)  (state=$($last.state)，开始于 $($last.record.startedAt))"
    foreach ($p in $last.record.participants) {
      Write-Human "      · $($p.kit)  计划 $($p.planId)  日志 $($p.journalState)"
    }
    for ($i = 0; $i -lt ($blockedRuns.Count - 1); $i++) {
      Write-Human "    （还有更早的未完成运行：$($blockedRuns[$i].id)  state=$($blockedRuns[$i].state)）"
    }
    Write-Human '    用 -Rollback latest（或 -Rollback <运行 ID>）按**整次运行**的范围恢复 ——'
    Write-Human '    只退其中一个套件会留下一个没人解释得了的组合。'
    if ($Json) {
      # 机器可读的那一份也要说清「涉及谁」——只给一个运行 ID，读者还得自己去翻目录。
      ([ordered]@{
        mode = 'blocked'
        unfinishedRuns = @($blockedRuns | ForEach-Object { $_.id })
        run = [ordered]@{
          id = $last.id; state = $last.state; startedAt = [string]$last.record.startedAt
          participants = @(foreach ($p in $last.record.participants) {
            # 日志状态**现场读**：运行记录里那两列只在保存时才回填，被中断的那次运行里它们是空的 ——
            # 而读者最想知道的恰恰是「谁停在哪一步」。
            $jd = Join-Path (Join-Path (Join-Path $OriginRoot $p.kit) 'plans') $p.planId
            $jj = Read-Json (Join-Path $jd 'journal.json')
            [ordered]@{ kit = $p.kit; planId = $p.planId
                        journalState = $(if ($null -eq $jj) { 'no-journal' } else { [string]$jj.state }) }
          })
        }
        unfinished = @(); project = $Project; masterRoot = $MasterRoot; kits = @(); exitCode = $E_RECOVERY
      } | ConvertTo-Json -Depth 12)
    }
    exit $E_RECOVERY
  }

  # ② 套件级：没有未完成的运行时，才轮到「单独一个未完成事务」。
  # 只拦 scan / apply / resolve —— `-Rollback` 的任务**就是**处理未完成事务，拦它等于把出口焊死。
  $blockedTx = New-Object System.Collections.Generic.List[string]
  foreach ($k in $wanted) {
    $oDir = Join-Path $OriginRoot $k
    foreach ($id in (Get-PlanDirs $oDir)) {
      $j = Get-Journal $oDir $id
      # `WRITTEN` = 文件已写、还没验证/提交（跨套件那一趟的中间态）—— 它同样是**未完成事务**：
      # 放它过去就等于在一个半更新状态上再更新一次。`COMMITTING` = 清单已经换了、整次运行还没落定。
      # `-Rollback` 认它们（它只排除 COMMITTED/RESTORED）。
      if ($null -eq $j -or $j.state -notin @('PREPARED', 'WRITING', 'WRITTEN', 'VALIDATING', 'COMMITTING', 'ROLLING_BACK')) { continue }
      # 事务属于哪次运行？**运行已提交而套件日志没跟上**的，只是记账没同步 ——
      # 拦还是要拦（进程不再半路改东西），但要说清「补救动作不会退掉已提交的内容」。
      $rid = [string](Get-Prop $j 'runId' '')
      $rstate = ''
      if ($rid) {
        $rr = Read-Json (Get-RunRecordPath $rid)
        if ($null -ne $rr) { $rstate = [string]$rr.state }
      }
      if ($rstate -eq 'COMMITTED') {
        $blockedTx.Add("$k/$id  (state=$($j.state) · 运行 $rid 已提交 —— 只是记账没同步：用 -Rollback latest 补齐，不会退回内容)")
      }
      else {
        $blockedTx.Add("$k/$id  (state=$($j.state))")
      }
    }
  }
  if ($blockedTx.Count -gt 0) {
    Write-Human '⚠ 有未完成的事务 —— 先恢复现场，再谈更新：' 'Yellow'
    foreach ($t in $blockedTx) { Write-Human "    $t" }
    Write-Human '    用 -Rollback <事务 ID>（或 -Rollback latest）恢复。'
    if ($Json) {
      ([ordered]@{ mode = 'blocked'; unfinished = @($blockedTx); project = $Project
                   masterRoot = $MasterRoot; kits = @(); exitCode = $E_RECOVERY } | ConvertTo-Json -Depth 12)
    }
    exit $E_RECOVERY
  }
}

if ($mode -eq 'scan' -or $mode -eq 'apply') {
  if (-not $planId) { $planId = (New-PlanId) }
  $scanResults = New-Object System.Collections.Generic.List[object]
  foreach ($k in $wanted) {
    $target = Join-Path $KitsRoot $k
    if (-not (Test-Path -LiteralPath $target)) {
      $scanResults.Add([pscustomobject][ordered]@{ kit = $k; state = 'not-installed'; note = '母本有、这个工程没装（按需分发是正常的 —— 要装请用 -Install）'; entries = @(); counts = @{} })
      continue
    }
    $st = Get-KitState $k
    $mf = Read-Manifest $st.originDir
    if ($null -eq $mf) {
      $scanResults.Add([pscustomobject][ordered]@{ kit = $k; state = 'no-baseline'; note = '没有基线 —— 先 -Install（新装）或 -Adopt（已有副本补基线）。**不自动重建**：那会吞掉真实差异。'; entries = @(); counts = @{} })
      continue
    }
    $intact = Test-BaselineIntact $mf
    if ($intact.Count -gt 0) {
      $scanResults.Add([pscustomobject][ordered]@{ kit = $k; state = 'invalid-origin'; note = '来源状态无效'; problems = @($intact); entries = @(); counts = @{} })
      continue
    }
    $v = Get-Verdicts $st $mf
    $r = [pscustomobject][ordered]@{ kit = $k; state = 'scanned'; manifest = $mf; stateObj = $st; verdicts = $v; entries = $v.entries; counts = $v.counts; sourceRoot = $mf.sourceRoot; plan = $null; planNote = '' }
    if ($mode -eq 'scan') {
      $r.plan = New-Plan $st $mf $v $planId
    }
    else {
      # 应用：优先消费**已经存在、还没应用过**的计划（那里可能有 `-Resolve` 写进去的裁决）。
      $usePlan = $Plan
      if (-not $usePlan) { $usePlan = Get-ActivePlanId $st.originDir }
      if ($usePlan) { $r.plan = Read-Plan $st.originDir $usePlan }
      else { $r.plan = New-Plan $st $mf $v $planId }
    }
    if ($null -eq $r.plan) {
      $r.state = 'no-plan'
      $r.planNote = "找不到计划 $(if ($Plan) { $Plan } else { '（目录里没有）' })"
      $scanResults.Add($r); continue
    }
    # 计划里固定的是**扫描那一刻**的母本。母本后来又变了不是错（这正是「固定快照」的意义），
    # 但必须说出来 —— 否则「我明明改了母本怎么没生效」会变成一个查不出的疑问。
    if ($r.plan.source.targetDigest -ne (Get-TreeDigest $st.master)) {
      $r.planNote = '母本在计划之后变过：本次写入的是**计划里固定的那一版**'
    }
    $scanResults.Add($r)
  }
  if ($mode -eq 'scan') { $kitResults = $scanResults }
  else {
    # ── 应用：**四趟**（① 写 ② 验证 ③ 提交 ④ 记账）
    #
    #   ① 每个套件各自「备份 + 写文件」，只留一个 `WRITTEN` 的现场，**不验证、不提交**；
    #   ② **整个 run 只跑一次写后验证**（`tsc` 看的是整个工程，不是某个套件）；
    #   ③ 每个套件按同一个验证结果落定：失败就回滚、通过就**换自己的清单**（停在 COMMITTING）；
    #   ④ 整次运行写 `COMMITTED` 之后，才把各套件日志补成完成。
    #
    # 逐套件验证为什么不行，见 `Invoke-ApplyKit` 交棒那段的长注释。
    # ③/④ 为什么拆开：完成标记归**运行级**。套件日志先写完成，进程死在两个套件之间时
    # 就只剩「一半已提交」，而事后没人分得清那是一次正常的部分更新还是本次运行断在半路。
    #
    # ⚠️ 写前验证（`Get-SharedPreCheck`）在①里**懒取一次**：它必须发生在
    # 本轮第一次写入之前，之后复用 —— 所以在这里清掉上一轮（理论上不会有）的缓存。
    $script:SharedPreDone = $false
    $script:SharedPre = $null

    # 运行记录：**在第一次修改之前**就落盘「这次运行涉及谁、各自的旧状态是什么」。
    # 只算真正有活要干的那些套件 —— 全都无事可做时不建运行（那就没有任何事务可言）。
    $runParticipants = New-Object System.Collections.Generic.List[object]
    foreach ($r in ($scanResults | Sort-Object kit)) {
      if ($r.state -ne 'scanned' -or $null -eq $r.plan) { continue }
      if (-not (Test-PlanActionable $r.plan)) { continue }
      $runParticipants.Add(@{ kit = $r.kit; planId = [string]$r.plan.planId })
    }
    $runRec = $null
    if ($runParticipants.Count -gt 0) {
      $runId = New-RunId
      $runRec = New-RunRecord $runId $runParticipants
      Save-RunRecord $runRec
    }

    $entries = New-Object System.Collections.Generic.List[object]
    $pending = New-Object System.Collections.Generic.List[object]
    foreach ($r in $scanResults) {
      if ($r.state -ne 'scanned') { $entries.Add([pscustomobject][ordered]@{ r = $r; res = $null; ctx = $null }); continue }
      $res = Invoke-ApplyKit $r.stateObj $r.plan.planId ([bool]$Partial) $Verify ([bool]$SourceOk) ([bool]$Pinned) $runId
      $e = [pscustomobject][ordered]@{
        r = $r; res = $res
        ctx = $(if ($res.PSObject.Properties['context'] -and $null -ne $res.context) { $res.context } else { $null })
      }
      $entries.Add($e)
      if ($null -ne $e.ctx) { $pending.Add($e) }
    }

    # ② 写后验证：**一次**。没有套件真的动过工程文件就不跑（与原先的条件一致）。
    $anyTouches = @($pending | Where-Object { $_.ctx.touchesProject }).Count -gt 0
    $postCheck = $null
    if ($anyTouches -and $Verify -ne 'none') { $postCheck = Invoke-Verify $Project 'post' }

    # ③ 提交：**运行级 COMMITTING 先落盘，再逐个换清单**
    if ($null -ne $runRec) {
      $runRec.state = 'COMMITTING'
      Save-RunRecord $runRec
    }
    foreach ($e in $pending) { $e.res = Invoke-FinalizeKit $e.ctx $postCheck }

    # ③b 整次运行的落定：只要有一个参与者没提交成功，**它自己那条已经提交的兄弟也要退回去**。
    # 不退的话留下的正是一个「没人解释得了的组合」：一部分工程副本已经换成新母本、
    # 一部分还停在旧版，而来源记录一半新一半旧。
    $failed = @($pending | Where-Object { $_.res.state -notin @('committed', 'partial') })
    $runProblems = New-Object System.Collections.Generic.List[string]
    $runNotes = New-Object System.Collections.Generic.List[string]
    if ($null -ne $runRec) {
      if ($failed.Count -eq 0 -and $pending.Count -gt 0) {
        $runRec.state = 'COMMITTED'
        $runRec.finishedAt = Now-Stamp
        Sync-RunParticipants $runRec
        Save-RunRecord $runRec
        Invoke-CrashPoint 'BEFORE_KIT_SYNC'
        # ④ 记账：运行已提交 ⇒ 套件日志补齐（这一步只写日志，不动内容）
        foreach ($e in $pending) {
          $rb = Repair-Transaction $e.r.kit ([string]$e.ctx.planId) 'COMMITTED' $true
          if ($rb.state -ne 'bookkeeping-synced') { $runNotes.Add("$($e.r.kit)：套件日志同步结果为 $($rb.state)") }
        }
      }
      else {
        # 运行级回退：把所有**已经换过清单**的参与者一起退回到事务前状态。
        foreach ($e in $pending) {
          if ($e.res.state -in @('committed', 'partial')) {
            $rb = Repair-Transaction $e.r.kit ([string]$e.ctx.planId) 'COMMITTING' $false
            if ($rb.state -ne 'restored') { $runProblems.Add("$($e.r.kit)：退还已提交内容的结果是 $($rb.state)") }
            $e.res.state = 'run-rolled-back'
          }
          foreach ($x in @($e.res.problems)) { if ($x) { $runProblems.Add("$($e.r.kit)：$x") } }
        }
        $runRec.state = $(if ($runProblems.Count -gt 0) { 'RECOVERY_REQUIRED' } else { 'ROLLED_BACK' })
        $runRec.finishedAt = Now-Stamp
        $runRec.note = $(if ($runProblems.Count -gt 0) { '整次运行落定失败，退还时出现未解决项' } else { '整次运行落定失败：已提交的参与者一并退回到事务前状态' })
        Sync-RunParticipants $runRec
        Save-RunRecord $runRec
      }
    }


    # 汇总：应用之后的统计必须是**应用后**的状态 —— 不重算就会打印一排 0，而那看起来像「全都解决了」。
    foreach ($e in $entries) {
      $r = $e.r
      if ($null -eq $r.plan) { $kitResults.Add($r); continue }
      $res = $e.res
      $postCounts = $null; $postEntries = @()
      $st2 = Get-KitState $r.kit
      $mf2 = Read-Manifest $st2.originDir
      if ($null -ne $mf2) {
        $v2 = Get-Verdicts $st2 $mf2
        $postCounts = $v2.counts; $postEntries = $v2.entries
      }
      $kitResults.Add([pscustomobject][ordered]@{ kit = $r.kit; state = $res.state; result = $res; plan = $r.plan
                                                  planId = $r.plan.planId; planNote = $r.planNote
                                                  counts = $postCounts; entries = $postEntries; postState = $true
                                                  # ⚠️ 结果里的 problems **必须抬到这一层**：报告只打印这一层。
                                                  # 少了它，写入阶段的失败会变成「什么都没写、也什么都不说」——
                                                  # 正是上一轮修过的那一类「收尾语盖掉事实」（实测踩到）。
                                                  problems = @($res.problems) })
    }
  }
}

if ($mode -eq 'resolve') {
  # 选择器必须点名一个**存在的**套件：不然它会被每个套件当成「不是我的」而静默落空。
  $known = @((@($kitsAvailable) + @($kitsInProj)) | Sort-Object -Unique)
  foreach ($s in $Resolve) {
    $t = $s.Replace('\', '/')
    if ($t -eq 'all') { continue }
    $k = ($t -split '/')[0]
    if ($known -notcontains $k) { Stop-Usage "裁决选择器 '$s' 指向一个不存在的套件：$k（这个工程里已知：$($known -join ', ')）" }
  }
  foreach ($k in $wanted) {
    if (-not (Test-Path -LiteralPath (Join-Path $KitsRoot $k))) { continue }
    $st = Get-KitState $k
    $usePlan = $Plan
    if (-not $usePlan) { $usePlan = Get-ActivePlanId $st.originDir }
    if (-not $usePlan) { $kitResults.Add([pscustomobject][ordered]@{ kit = $k; state = 'no-plan'; problems = @('这个套件没有可用的计划 —— 先跑一次 -Scan。'); resolved = @() }); continue }
    $planId = $usePlan
    $kitResults.Add((Invoke-ResolveKit $st $usePlan $Resolve $Decision))
  }
}

if ($mode -eq 'rollback') {
  # 先看**运行级**：一次未完成的运行，它的参与者要一起退。
  # 只退其中一支会留下一个组合 ——「一部分已换成新母本、一部分还是旧的」——
  # 而那个组合看起来完全正常，下一轮扫描会照着它继续往下走。
  $targetRun = $null
  $runs = Get-RunRecords
  if ($Rollback -eq 'latest') {
    $u = Get-UnfinishedRuns
    if ($u.Count -gt 0) { $targetRun = $u[$u.Count - 1] }
  }
  else {
    foreach ($r in $runs) { if ($r.id -eq $Rollback) { $targetRun = $r; break } }
    if ($null -eq $targetRun) {
      # 给的是一个**套件事务 ID**：它若属于一次未完成的运行，就按运行范围恢复（并说出来）。
      foreach ($k in $wanted) {
        $j = Get-Journal (Join-Path $OriginRoot $k) $Rollback
        if ($null -eq $j) { continue }
        $rid = [string](Get-Prop $j 'runId' '')
        if (-not $rid) { continue }
        foreach ($r in $runs) {
          if ($r.id -eq $rid -and $script:RunTerminal -notcontains $r.state) { $targetRun = $r; break }
        }
        if ($null -ne $targetRun) {
          Write-Human "（$Rollback 属于未完成的运行 $($targetRun.id) —— 按**整次运行**的范围恢复）" 'Yellow'
          break
        }
      }
    }
  }
  if ($null -ne $targetRun) {
    $rr = Invoke-RunRecovery $targetRun
    $kitResults.Add($rr)
  }
  else {
    foreach ($k in $wanted) {
      if (-not (Test-Path -LiteralPath (Join-Path $OriginRoot $k))) { continue }
      $kitResults.Add((Invoke-RollbackKit $k $Rollback))
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# 9 · 报告与退出码
# ─────────────────────────────────────────────────────────────────────────────

function Sum-Counts($results) {
  $t = @{ apply = 0; unresolved = 0; local = 0; same = 0 }
  foreach ($r in $results) {
    if (-not $r.PSObject.Properties['counts'] -or $null -eq $r.counts) { continue }
    foreach ($code in $r.counts.Keys) { $t[$VDEF[$code].group] += [int]$r.counts[$code] }
  }
  return $t
}

$totals = Sum-Counts $kitResults

# 退出码：先把「需要恢复」和「来源无效」挑出来，它们比「有待办」更急。
$exitCode = $E_OK
$states = @($kitResults | ForEach-Object { $_.state })
if ($states -contains 'recovery-required') { $exitCode = $E_RECOVERY }
elseif ($states -contains 'invalid-origin' -or $states -contains 'stale' -or $states -contains 'source-changed' -or $states -contains 'source-moved' -or $states -contains 'unsafe-plan') { $exitCode = $E_STALE }
elseif ($states -contains 'no-plan' -or $states -contains 'no-baseline') { $exitCode = $E_STALE }
elseif ($states -contains 'refused') { $exitCode = $E_USAGE }
elseif ($states -contains 'unresolved') { $exitCode = $E_UNRESOLVED }
elseif ($states -contains 'validation-failed-rolled-back' -or $states -contains 'failed-rolled-back') { $exitCode = $E_VALIDFAIL }
elseif ($states -contains 'partial') { $exitCode = $E_UNRESOLVED }
# scan 也一样要区分「有得更新」和「有东西需要裁决」—— 它们对应完全不同的下一步。
elseif ($mode -eq 'scan' -and $totals['unresolved'] -gt 0) { $exitCode = $E_UNRESOLVED }
elseif ($totals['apply'] -gt 0 -and -not $Apply) { $exitCode = $E_UPDATABLE }

if ($Json) {
  $payload = [ordered]@{
    mode       = $mode
    project    = $Project
    masterRoot = $MasterRoot
    planId     = $planId
    kits = @(
      foreach ($r in $kitResults) {
        [ordered]@{
          kit    = $r.kit
          state  = $r.state
          note   = $(if ($r.PSObject.Properties['note']) { $r.note } else { $null })
          counts = $(if ($r.PSObject.Properties['counts'] -and $null -ne $r.counts) { $r.counts } else { $null })
          problems = @(
            # 应用模式下原因住在 result.problems 里 —— 报告**不能**把原因吞掉：
            # 一个「state=stale 而 problems 空」的机器可读结果，等于让人去猜。
            if ($r.PSObject.Properties['result'] -and $null -ne $r.result) { @($r.result.problems) }
            elseif ($r.PSObject.Properties['problems']) { @($r.problems) }
          )
          entries = @(
            if ($r.PSObject.Properties['entries']) {
              foreach ($e in $r.entries) {
                [ordered]@{ path = $e.path; code = $e.code; group = $VDEF[[string]$e.code].group; note = $e.note; resolution = $e.resolution }
              }
            }
          )
          resolved = $(if ($r.PSObject.Properties['resolved']) { @($r.resolved) } else { @() })
          planId   = $(if ($r.PSObject.Properties['planId']) { [string]$r.planId } else { '' })
          planNote = $(if ($r.PSObject.Properties['planNote']) { [string]$r.planNote } else { '' })
          # 运行级恢复的结果：范围比套件大，出报告时要能说出「涉及谁、各自停在哪」。
          runId    = $(if ($r.PSObject.Properties['runId'] -and $r.runId) { [string]$r.runId } else { '' })
          priorState = $(if ($r.PSObject.Properties['priorState']) { [string]$r.priorState } else { '' })
          recordState = $(if ($r.PSObject.Properties['recordState']) { [string]$r.recordState } else { '' })
          participants = @(
            if ($r.PSObject.Properties['participants'] -and $r.participants) {
              foreach ($p in $r.participants) {
                [ordered]@{ kit = $p.kit; planId = $p.planId; state = $p.state
                            problems = @($p.problems); notes = @($p.notes); recovery = @($p.recovery) }
              }
            }
          )
          recovery = @(if ($r.PSObject.Properties['recovery'] -and $r.recovery) { @($r.recovery) })
          # `-List` 那几个字段本来就只活在结果对象里（机器读者以前拿不到）—— 顺手穿透出来。
          generations = @(if ($r.PSObject.Properties['generations'] -and $r.generations) { @($r.generations) })
          activeGeneration = $(if ($r.PSObject.Properties['activeGeneration']) { [string]$r.activeGeneration } else { '' })
          plans = @(if ($r.PSObject.Properties['plans'] -and $r.plans) { foreach ($p in $r.plans) { [ordered]@{ planId = $p.planId; state = $p.state } } })
          runs = @(if ($r.PSObject.Properties['runs'] -and $r.runs) { foreach ($x in $r.runs) {
            [ordered]@{ runId = $x.runId; state = $x.state; startedAt = $x.startedAt
                        participants = @(foreach ($p in $x.participants) { [ordered]@{ planId = $p.planId } }) } } })
          applied  = $(if ($r.PSObject.Properties['result']) { @($r.result.written) + @($r.result.deleted) } else { @() })
          advanced = $(if ($r.PSObject.Properties['result']) { @($r.result.advanced) } else { @() })
        }
      }
    )
    totals  = [ordered]@{ apply = $totals['apply']; unresolved = $totals['unresolved']; local = $totals['local']; same = $totals['same'] }
    exitCode = $exitCode
  }
  $payload | ConvertTo-Json -Depth 12
  exit $exitCode
}

# ── 人读的报告
Write-Human ''
Write-Human "更新器 · $mode · 工程 $Project"
Write-Human "                    母本 $MasterRoot" 'DarkGray'
if ($planId -and $mode -eq 'scan') { Write-Human "                    计划 $planId" 'DarkGray' }
Write-Human ''

foreach ($r in $kitResults) {
  if ($r.PSObject.Properties['runId'] -and $r.runId) {
    Write-Human "运行 $($r.runId)   $($r.priorState) → $($r.state)"
  }
  else {
    Write-Human "套件 $($r.kit)"
  }
  if ($r.PSObject.Properties['participants'] -and $r.participants.Count -gt 0) {
    foreach ($p in $r.participants) {
      Write-Human "  · $($p.kit)  $($p.planId)  → $($p.state)"
      foreach ($x in @($p.problems)) { if ($x) { Write-Human "      $x" 'Yellow' } }
      foreach ($x in @($p.notes))    { if ($x) { Write-Human "      $x" 'DarkGray' } }
      foreach ($x in @($p.recovery)) { if ($x) { Write-Human "      $($x.kind) $($x.path)  $($x.status)$(if ($x.note) { ' · ' + $x.note })" 'DarkGray' } }
    }
  }
  if ($r.PSObject.Properties['notes'] -and $r.notes.Count -gt 0) {
    foreach ($n in $r.notes) { Write-Human "  $n" 'DarkGray' }
  }
  if ($r.PSObject.Properties['planId'] -and $r.planId) { Write-Human "  计划 $($r.planId)" 'DarkGray' }
  if ($r.PSObject.Properties['planNote'] -and $r.planNote) { Write-Human "  $($r.planNote)" 'Yellow' }
  if ($r.PSObject.Properties['note'] -and $r.note) { Write-Human "  $($r.note)" 'Yellow' }
  if ($r.PSObject.Properties['problems'] -and $r.problems.Count -gt 0) {
    foreach ($p in $r.problems) { Write-Human "  · $p" 'Yellow' }
  }
  if ($r.PSObject.Properties['resolved'] -and $r.resolved.Count -gt 0) {
    Write-Human "  已写入计划的裁决  $($r.resolved.Count)" 'Cyan'
    foreach ($x in $r.resolved) { Write-Human "    $x" }
  }
  if ($r.PSObject.Properties['result']) {
    $rr = $r.result
    if ($rr.written.Count -gt 0) { Write-Human "  写入  $($rr.written.Count)" 'Green'; foreach ($x in $rr.written) { Write-Human "    $x" } }
    if ($rr.deleted.Count -gt 0) { Write-Human "  删除  $($rr.deleted.Count)" 'Green'; foreach ($x in $rr.deleted) { Write-Human "    $x" } }
    if ($rr.advanced.Count -gt 0) { Write-Human "  基线推进  $($rr.advanced.Count)" 'DarkGray' }
    if ($null -ne $rr.validation -and $rr.validation.ran) {
      $v = $rr.validation
      $vt = "验证：写前 $(if ($v.preOk) { '通过' } else { '失败' }) · 写后 $(if ($v.postOk) { '通过' } else { '失败' })"
      Write-Human "  $vt" $(if ($v.postOk -eq $false -and $v.preOk -ne $false) { 'Red' } else { 'DarkGray' })
    }
  }
  if ($r.PSObject.Properties['counts'] -and $null -ne $r.counts) {
    $isPost = ($r.PSObject.Properties['postState'] -and $r.postState)
    foreach ($sec in @(@{ k = 'apply'; n = '可更新'; c = 'Green' }, @{ k = 'unresolved'; n = '未解决'; c = 'Red' }, @{ k = 'local'; n = '工程这一侧'; c = 'DarkGray' }, @{ k = 'same'; n = '无变化'; c = 'DarkGray' })) {
      $rows = @($r.entries | Where-Object { $VDEF[[string]$_.code].group -eq $sec.k })
      if ($rows.Count -eq 0) { continue }
      Write-Human "  $(if ($isPost) { '应用后 · ' })$($sec.n)  $($rows.Count)" $sec.c
      if ($sec.k -eq 'apply' -or $sec.k -eq 'unresolved') {
        foreach ($e in $rows) { Write-Human "    $($e.path)   ← $($VDEF[[string]$e.code].text)$(if ($e.note) { ' · ' + $e.note })" }
      }
    }
  }
  Write-Human ''
}

switch ($mode) {
  'scan' {
    Write-Human "可更新 $($totals['apply']) · 未解决 $($totals['unresolved']) · 工程这一侧 $($totals['local']) · 无变化 $($totals['same'])"
    if ($totals['unresolved'] -gt 0) {
      Write-Human '下一步：-Resolve <选择器|all> -Decision accept-upstream|keep-local|defer 写入裁决，再 -Apply' 'Cyan'
    }
    elseif ($totals['apply'] -gt 0) {
      Write-Human "下一步：-Apply（这次的计划是 $planId；也可以先看，之后再 -Apply -Plan $planId）" 'Cyan'
    }
    else { Write-Human '没有待办。' 'Green' }
  }
  'apply' {
    Write-Human "可更新 $($totals['apply']) · 未解决 $($totals['unresolved']) · 工程这一侧 $($totals['local'])"
    # 三种「没写完」是不同的状态，不能共用一句话 —— 拒绝写入（一个字节没动）与
    # 部分更新（写了无歧义的那半）是完全不同的后果。混着说就是让收尾语盖掉事实。
    #
    # ⚠️ 变量名**不能**叫 `$refused` / `$partial` 之外的近似参数名：`$partial` 会**覆盖 `-Partial`
    # 这个 switch 参数**（变量不区分大小写），报「无法将 Int32 转换为
    # SwitchParameter」，整段收尾语静默不打 —— 实测踩过。函数内部的同名局部是安全的
    # （函数有自己的作用域），**脚本作用域顶格**才出事。
    $kitsRefused = @($kitResults | Where-Object { $_.state -eq 'unresolved' }).Count
    $kitsPartial = @($kitResults | Where-Object { $_.state -eq 'partial' }).Count
    if ($kitsRefused -gt 0 -and $kitsPartial -eq 0) {
      Write-Human '⚠ **没有写入任何东西** —— 有未解决项时默认拒绝写入（不是「部分更新」）。' 'Yellow'
      Write-Human '  → 先 -Resolve <选择器|all> -Decision accept-upstream|keep-local|defer，再 -Apply；' 'Cyan'
      Write-Human '     或者 -Apply -Partial 明确表示「只写无歧义的那一部分」。' 'Cyan'
    }
    elseif ($kitsPartial -gt 0) {
      Write-Human '⚠ 这是**部分更新**：无歧义的那部分写了，未解决项原样留着 —— 不能当成已完整接受上游。' 'Yellow'
    }
  }
  'resolve' {
    $okCount = @($kitResults | Where-Object { $_.state -eq 'resolved' }).Count
    if ($okCount -gt 0) { Write-Human "裁决已写进计划（$okCount 个套件）。下一步：-Apply（它会消费这份已固定的计划）。" 'Cyan' }
    else { Write-Human '没有任何裁决被写进计划 —— 原因见上。' 'Yellow' }
  }
  'install' {
    $ok = @($kitResults | Where-Object { $_.state -eq 'installed' })
    if ($ok.Count -gt 0) { Write-Human "已安装：$((@($ok | ForEach-Object { "$($_.kit)=$($_.files)" })) -join ' ') 个文件，并建立基线。" 'Green' }
    else { Write-Human '没有安装任何东西 —— 原因见上。' 'Yellow' }
  }
  'adopt'   {
    # 拒绝的时候**不能说「已建立基线」** —— 那句总结会盖掉上面那条拒绝理由（实测踩过）。
    $ok = @($kitResults | Where-Object { $_.state -eq 'adopted' })
    if ($ok.Count -gt 0) { Write-Human "已建立基线：$((@($ok | ForEach-Object { "$($_.kit)=$($_.files)" })) -join ' ')" 'Green' }
    else { Write-Human '没有建立任何基线 —— 原因见上。' 'Yellow' }
  }
  'rollback' { Write-Human '现场已按事务日志恢复。' 'Green' }
  'list' {
    foreach ($r in $kitResults) {
      Write-Human "  $($r.kit)：基线 $(if ($r.activeGeneration) { $r.activeGeneration } else { '（无）' }) · 代次 $($r.generations.Count) · 计划 $($r.plans.Count) · 运行 $($r.runs.Count)"
      foreach ($x in $r.runs) {
        $done = $script:RunTerminal -contains [string]$x.state
        Write-Human "      运行 $($x.runId)  $($x.state)$(if (-not $done) { ' ← 未完成：先 -Rollback latest 恢复现场' })" $(if ($done) { 'DarkGray' } else { 'Yellow' })
      }
    }
  }
}
Write-Human ''
exit $exitCode
