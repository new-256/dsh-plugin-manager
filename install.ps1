# dsh-plugin-manager-plus — 标准安装接线脚本（幂等）
#
# 标准分发形态（npm）：dsh plugin --profile web add dsh-plugin-manager-plus
#   安装后包内 cordis.patch.yml（dsh.bundle.patch）自动挂载通用默认行，
#   一般无需本脚本。
#
# 本脚本用途（本地开发 / profiles 隔离重建后修复）：
#   ① 重建包解析所需的三处 junction（源码目录 → dsh-home 各 node_modules）；
#   ② 检查家级补丁层是否有本插件的裸包名行。
#   何时跑：DSH Desktop 因后端启动失败把 profiles 目录隔离重建之后（junction 会丢），
#           或手工迁移 dsh-home 之后，或从 git clone 做本地开发接线。
#
# 用法：pwsh -File install.ps1              # 用默认 DSH_HOME
#      pwsh -File install.ps1 -DshHome "C:\path\to\dsh-home"

[CmdletBinding()]
param(
	[string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { "C:\Users\$env:USERNAME\AppData\Roaming\DSH Desktop\dsh-home" })
)

$ErrorActionPreference = 'Stop'
$pkgDir = $PSScriptRoot
$pkgName = 'dsh-plugin-manager-plus'

if (-not (Test-Path (Join-Path $pkgDir 'package.json'))) { throw "找不到 $pkgDir\package.json —— 请在插件目录内运行本脚本。" }
if (-not (Test-Path $DshHome)) { throw "DSH_HOME 不存在：$DshHome" }
Write-Host "包目录 : $pkgDir"
Write-Host "DSH_HOME: $DshHome`n"

Write-Host "★ 标准安装（推荐）：dsh plugin --profile web add $pkgName"
Write-Host "  （本地开发接线则继续下面的 junction + 家级补丁行）`n"

# 三处 junction：家级补丁行必需第一处，其余两处为 profile 层兜底。
$targets = @(
	(Join-Path $DshHome "node_modules\$pkgName"),
	(Join-Path $DshHome "profiles\node_modules\$pkgName"),
	(Join-Path $DshHome "profiles\web\node_modules\$pkgName")
)
foreach ($link in $targets) {
	$parent = Split-Path $link -Parent
	if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
	if (Test-Path (Join-Path $link 'package.json')) {
		Write-Host "OK   已存在  $link"
		continue
	}
	if (Test-Path $link) { Remove-Item $link -Force -Recurse }   # 残留的坏链
	New-Item -ItemType Junction -Path $link -Target $pkgDir | Out-Null
	Write-Host "NEW  已创建  $link"
}

# 家级补丁行检查
$patch = Join-Path $DshHome 'cordis.patch.yml'
Write-Host ''
if ((Test-Path $patch) -and ((Get-Content $patch -Raw) -match '(?m)^\s+name:\s*' + [regex]::Escape($pkgName) + '\s*$')) {
	Write-Host "OK   家级补丁层已有 $pkgName 的裸包名行：$patch"
} else {
	Write-Warning "家级补丁层缺少 $pkgName 的裸包名行，请在 $patch 末尾追加："
	Write-Host (@"
- insert:
    - id: plugin-manager
      name: $pkgName
"@)
	Write-Warning "host 半用裸包名（package.json main → lib/index.mjs）；client 半靠 dsh.client 声明自动进浏览器花名册，无需单独一行。"
	Write-Warning "改 lib/index.mjs 后重启 DSH 生效（或临时把 name 改成 $pkgName`?v=N 触发热重载）。"
	Write-Warning "注意：不要写进 profiles/web/cordis.patch.yml —— profiles 目录被隔离重建时会丢。"
}

Write-Host "`n完成。刷新浏览器页面即可看到插件市场标签页（改 lib/client.js 无需重启后端）。"
