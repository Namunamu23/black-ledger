#!/usr/bin/env pwsh
# BLACK LEDGER -- WAVE 2 FIX RUNNER
# Launches Claude Code with the Wave 2 fix protocol.
# Run from site/ directory:
#   powershell -ExecutionPolicy Bypass -File scripts/run-wave2.ps1

$ErrorActionPreference = "Stop"

$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO_ROOT   = Split-Path -Parent $SCRIPT_DIR
$PROMPT_FILE = Join-Path $SCRIPT_DIR "WAVE2_FIXES.md"

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  BLACK LEDGER -- WAVE 2 FIX LAUNCHER" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

if (-not (Test-Path $PROMPT_FILE)) {
    Write-Host "  [!!] WAVE2_FIXES.md not found at: $PROMPT_FILE" -ForegroundColor Red
    exit 1
}

$claudeCmd = Get-Command "claude" -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Host "  [!!] Claude Code not found. Run: npm install -g @anthropic/claude-code" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] Claude Code found" -ForegroundColor Green
Write-Host "  [OK] Wave 2 prompt found" -ForegroundColor Green
Write-Host ""
Write-Host "  Fixes to apply:" -ForegroundColor White
Write-Host "    ARCH-01  Atomic checkpoint advance (race condition fix)" -ForegroundColor White
Write-Host "    SEC-06   CSRF origin comparison via URL parsing" -ForegroundColor White
Write-Host "    OPS-04   Add R2 origin to CSP img-src" -ForegroundColor White
Write-Host "    ARCH-02  Promise.allSettled on bureau case page" -ForegroundColor White
Write-Host ""
Write-Host "  Report will be saved to: docs/WAVE2-FIXES-REPORT.md" -ForegroundColor DarkGray
Write-Host ""

Set-Location $REPO_ROOT

# Pass a short bootstrap string -- no backticks, no special chars.
# Claude Code will read the full prompt file itself.
$BOOTSTRAP = "Read the file scripts/WAVE2_FIXES.md and execute every instruction in it exactly as written. Start with FIX 1 immediately."

Write-Host "  Launching Claude Code..." -ForegroundColor Cyan
Write-Host ""

claude --allowedTools "Read,Write,Edit,Bash,Glob,Grep" --add-dir $REPO_ROOT -p $BOOTSTRAP

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  SESSION ENDED" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

$reportPath = Join-Path $REPO_ROOT "docs\WAVE2-FIXES-REPORT.md"
if (Test-Path $reportPath) {
    $kb = [Math]::Round((Get-Item $reportPath).Length / 1KB, 1)
    Write-Host "  [OK] Report saved: docs/WAVE2-FIXES-REPORT.md ($kb KB)" -ForegroundColor Green
} else {
    Write-Host "  [!!] Report not found. Check docs/ manually." -ForegroundColor Red
}
