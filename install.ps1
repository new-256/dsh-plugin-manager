# dsh-plugin-manager 接线修复脚本（幂等）
#
# 用途：重建包解析所需的三处 junction，并检查家级补丁层是否有本插件的行。
# 何时跑：DSH Desktop 因后端启动失败把 profiles 目录隔离重建之后（junction 会丢），
#         或手工迁移 dsh-home 之后。
#
# 用法：pwsh -File install.ps1              # 用默认 DSH_HOME
#      pwsh -File install.ps1 -DshHome "C:\path\to\dsh-home"

[CmdletBinding()]
param(
	[string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { "C:\Users\$env:USERNAME\AppData\Roaming\DSH Desktop\dsh-home" })
)

$ErrorActionPreference = 'Stop'
$pkgDir = $PSScriptRoot
$pkgName = 'dsh-plugin-manager'

if (-not (Test-Path (Join-Path $pkgDir 'package.json'))) { throw "找不到 $pkgDir\package.json —— 请在插件目录内运行本脚本。" }
if (-not (Test-Path $DshHome)) { throw "DSH_HOME 不存在：$DshHome" }
Write-Host "包目录 : $pkgDir"
Write-Host "DSH_HOME: $DshHome`n"

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
if ((Test-Path $patch) -and ((Get-Content $patch -Raw) -match [regex]::Escape($pkgName))) {
	Write-Host "OK   家级补丁层已有 $pkgName 的行：$patch"
} else {
	Write-Warning "家级补丁层缺少 $pkgName 的行，请在 $patch 末尾追加（注意替换 ?v=N）："
	# file:// URL：正斜杠 + 空格转义 %20，指向本脚本所在包目录的 lib/index.mjs
	$mjsUrl = ('file:///' + ($pkgDir -replace '\\', '/') -replace ' ', '%20') + '/lib/index.mjs?v=1'
	Write-Host (@"
- insert:
    - id: plugin-manager
      name: $mjsUrl

    - id: plugin-manager-client
      name: dsh-plugin-manager
"@)
	Write-Warning "注意：不要写进 profiles/web/cordis.patch.yml —— profiles 目录被隔离重建时会丢。"
}

Write-Host "`n完成。刷新浏览器页面即可看到插件市场标签页（改 lib/client.js 无需重启后端）。"
