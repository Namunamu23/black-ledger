#!/usr/bin/env pwsh
# ==============================================================================
# BLACK LEDGER -- GOD MODE AUDIT RUNNER
# Launches Claude Code interactively with the full 6-expert audit protocol.
#
# Usage (from the site/ directory):
#   powershell -ExecutionPolicy Bypass -File scripts/godmode-audit.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

function Write-Header { param($msg)
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
}
function Write-Step    { param($msg) Write-Host "  --> $msg" -ForegroundColor Yellow }
function Write-Ok      { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "  [!!] $msg" -ForegroundColor Red }
function Write-Info    { param($msg) Write-Host "  $msg" -ForegroundColor DarkGray }

# -- Paths --------------------------------------------------------------------
$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO_ROOT   = Split-Path -Parent $SCRIPT_DIR
$PROMPT_FILE = Join-Path $SCRIPT_DIR "GODMODE_AUDIT.md"
$AUDIT_DATE  = Get-Date -Format "yyyy-MM-dd"
$REPORT_DIR  = Join-Path $REPO_ROOT "docs"

Write-Header "BLACK LEDGER -- GOD MODE AUDIT LAUNCHER"

# -- Pre-flight ---------------------------------------------------------------
Write-Step "Pre-flight checks..."

if (-not (Test-Path (Join-Path $REPO_ROOT "package.json"))) {
    Write-Warn "package.json not found. Run from the site/ directory."
    exit 1
}

$claudeCmd = Get-Command "claude" -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Warn "Claude Code not found. Install: npm install -g @anthropic/claude-code"
    exit 1
}
Write-Ok "Claude Code found"

if (-not (Test-Path $PROMPT_FILE)) {
    Write-Warn "GODMODE_AUDIT.md not found at: $PROMPT_FILE"
    exit 1
}
Write-Ok "Audit prompt found"

Push-Location $REPO_ROOT
$null = git status 2>&1
if ($LASTEXITCODE -ne 0) { Write-Warn "Not a git repo." ; Pop-Location ; exit 1 }
Write-Ok "Git repo confirmed"

# -- Metrics ------------------------------------------------------------------
Write-Step "Repo metrics..."
$fileCount   = (git ls-files 2>$null | Measure-Object -Line).Lines
$commitCount = (git log --oneline 2>$null | Measure-Object -Line).Lines
Write-Ok "Tracked files : $fileCount"
Write-Ok "Commits       : $commitCount"

# -- Ensure docs dir ----------------------------------------------------------
if (-not (Test-Path $REPORT_DIR)) {
    New-Item -ItemType Directory -Path $REPORT_DIR | Out-Null
}

# -- Write live prompt file ---------------------------------------------------
Write-Step "Writing live prompt file..."

$META = "---`n## LIVE AUDIT CONTEXT`n- Date    : $AUDIT_DATE`n- Repo    : $REPO_ROOT`n- Files   : $fileCount`n- Commits : $commitCount`n- Report  : docs/GODMODE-AUDIT-$AUDIT_DATE.md`n---`n`n"
$BODY = [System.IO.File]::ReadAllText($PROMPT_FILE, [System.Text.Encoding]::UTF8)
$LIVE = $META + $BODY

$LIVE_PATH = Join-Path $SCRIPT_DIR "GODMODE_AUDIT_LIVE.md"
[System.IO.File]::WriteAllText($LIVE_PATH, $LIVE, [System.Text.Encoding]::UTF8)
$liveSizeKB = [Math]::Round((Get-Item $LIVE_PATH).Length / 1KB, 1)
Write-Ok "Live prompt: $LIVE_PATH ($liveSizeKB KB)"

# -- Build the single-line bootstrap message ----------------------------------
$BOOTSTRAP = "GOD MODE: Read the file scripts/GODMODE_AUDIT_LIVE.md and execute the audit protocol inside it exactly as written. Start with Phase 0 immediately."

# Copy to clipboard so user can paste it as the first message in Claude Code
$BOOTSTRAP | Set-Clipboard
Write-Ok "Bootstrap prompt copied to clipboard"

# -- Summary ------------------------------------------------------------------
Write-Header "READY TO LAUNCH"
Write-Host "  Files     : $fileCount tracked files" -ForegroundColor White
Write-Host "  Lenses    : Security / Architecture / Data / Debugger / ML / DevOps" -ForegroundColor White
Write-Host "  Report    : docs/GODMODE-AUDIT-$AUDIT_DATE.md" -ForegroundColor White
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Yellow
Write-Host "  WHAT TO DO WHEN CLAUDE CODE OPENS:" -ForegroundColor Yellow
Write-Host ("=" * 70) -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Claude Code will open interactively below." -ForegroundColor White
Write-Host "  2. You will see the > prompt." -ForegroundColor White
Write-Host "  3. Press CTRL+V to paste your first message (already in clipboard)." -ForegroundColor White
Write-Host "  4. Press ENTER." -ForegroundColor White
Write-Host "  5. Watch it read all 170 files and write the report." -ForegroundColor White
Write-Host ""
Write-Host "  Expected runtime: 20-40 min. You will see live tool calls." -ForegroundColor DarkGray
Write-Host "  Report will be saved to: docs/GODMODE-AUDIT-$AUDIT_DATE.md" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Clipboard message:" -ForegroundColor DarkGray
Write-Host "  $BOOTSTRAP" -ForegroundColor DarkGray
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Yellow

Write-Host ""
Write-Host "  Press ENTER to open Claude Code, then paste (CTRL+V) your first message..." -ForegroundColor Cyan
$null = Read-Host

# -- Launch Claude Code interactively ----------------------------------------
# No -p flag. Interactive mode shows streaming tool calls in real time.
Write-Host ""
Write-Host "  [Claude Code is starting. When you see the prompt, press CTRL+V then ENTER]" -ForegroundColor Cyan
Write-Host ""

Set-Location $REPO_ROOT

claude --allowedTools "Read,Write,Edit,Bash,Glob,Grep" --add-dir $REPO_ROOT

# -- Post-session cleanup -----------------------------------------------------
Write-Header "SESSION ENDED"

$reportPath = Join-Path $REPORT_DIR "GODMODE-AUDIT-$AUDIT_DATE.md"
if (Test-Path $reportPath) {
    $reportKB = [Math]::Round((Get-Item $reportPath).Length / 1KB, 1)
    Write-Ok "Report saved: $reportPath ($reportKB KB)"
    Write-Host ""
    Write-Host "  Open it: code docs/GODMODE-AUDIT-$AUDIT_DATE.md" -ForegroundColor Gray
} else {
    Write-Info "Report not found at expected path."
    Write-Info "Check docs/ manually -- Claude may have named it differently."
}

Remove-Item $LIVE_PATH -ErrorAction SilentlyContinue
Write-Info "Cleaned up temp files."
Pop-Location
