# 一句话，一座城 —— 一键：装依赖 → 构建 → 提交 → 推送 GitHub
#
# 用法（在 Windows PowerShell 里，于本项目文件夹执行）：
#   .\setup-and-push.ps1 -Remote https://github.com/你的账号/one-sentence-one-city.git
#
# 只装依赖和构建、先不推送：
#   .\setup-and-push.ps1 -SkipPush
#
# 说明：node_modules/ 与 dist/ 已在 .gitignore 里，不会被提交。

param(
    [string]$Remote = '',
    [string]$Branch = 'main',
    [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Step($n, $text) {
    Write-Host ''
    Write-Host "===== $n  $text =====" -ForegroundColor Cyan
}

function MustRun($label, [scriptblock]$block) {
    & $block
    if ($LASTEXITCODE -ne 0) {
        throw "$label 失败，退出码 $LASTEXITCODE"
    }
}

# ---------- 1. 环境 ----------
Step '1/4' 'node / npm 版本'
MustRun 'node -v' { node -v }
MustRun 'npm -v' { npm -v }

# ---------- 2. 依赖 ----------
Step '2/4' 'npm install'
MustRun 'npm install' { npm install --no-audit --no-fund }

# ---------- 3. 构建 ----------
Step '3/4' 'npm run build'
MustRun 'npm run build' { npm run build }

if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'dist')) {
    $files = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'dist') -Recurse -File
    $bytes = ($files | Measure-Object -Property Length -Sum).Sum
    Write-Host ("dist/ 已生成：{0} 个文件，共 {1:N0} 字节" -f $files.Count, $bytes) -ForegroundColor Green
} else {
    throw '构建结束但没有 dist/ 目录'
}

# ---------- 4. Git ----------
Step '4/4' 'git 提交与推送'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.git'))) {
    MustRun 'git init' { git init -b $Branch }
} else {
    MustRun 'git checkout -B' { git checkout -B $Branch }
}

if (-not (git config user.name)) { MustRun 'git config user.name' { git config user.name 'one-sentence-one-city' } }
if (-not (git config user.email)) { MustRun 'git config user.email' { git config user.email 'noreply@example.com' } }

MustRun 'git add' { git add -A }
$staged = @(git diff --cached --name-only)
if ($staged.Count -eq 0) {
    Write-Host '没有新的改动需要提交。' -ForegroundColor Yellow
} else {
    Write-Host ("待提交文件 {0} 个" -f $staged.Count)
    MustRun 'git commit' { git commit -m '第一轮：分词、词表、R1–R8、plan/build 分离、InstancedMesh 城市' }
}

if ($SkipPush) {
    Write-Host '已按 -SkipPush 跳过推送。' -ForegroundColor Yellow
    return
}
if (-not $Remote) {
    throw '缺少 -Remote 参数：请给出 GitHub 仓库地址，例如 -Remote https://github.com/you/one-sentence-one-city.git'
}

$existing = (git remote get-url origin) 2>$null
if ($existing) {
    MustRun 'git remote set-url' { git remote set-url origin $Remote }
} else {
    MustRun 'git remote add' { git remote add origin $Remote }
}
MustRun 'git push' { git push -u origin $Branch }

Write-Host ''
Write-Host '全部完成。构建产物在 dist/，仓库已推送到 origin。' -ForegroundColor Green
Write-Host '接着跑 npm run dev，浏览器打开提示的地址；按 D 看第 5.3 节自检结果。' -ForegroundColor Green
