#!/usr/bin/env pwsh
# BLACK LEDGER -- WAVE 4 FIX RUNNER
# Run from site/ directory:
#   powershell -ExecutionPolicy Bypass -File scripts/run-wave4.ps1

$ErrorActionPreference = "Stop"

$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO_ROOT   = Split-Path -Parent $SCRIPT_DIR
$PROMPT_FILE = Join-Path $SCRIPT_DIR "WAVE4_FIXES.md"

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  BLACK LEDGER -- WAVE 4 FIX LAUNCHER" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

if (-not (Test-Path $PROMPT_FILE)) {
    Write-Host "  [!!] WAVE4_FIXES.md not found at: $PROMPT_FILE" -ForegroundColor Red
    exit 1
}

$claudeCmd = Get-Command "claude" -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Host "  [!!] Claude Code not found. Run: npm install -g @anthropic/claude-code" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] Claude Code found" -ForegroundColor Green
Write-Host "  [OK] Wave 4 prompt found" -ForegroundColor Green
Write-Host ""
Write-Host "  Fixes to apply:" -ForegroundColor White
Write-Host "    A6      Duplicate purchase guard in checkout route" -ForegroundColor White
Write-Host "    S13     Support reply: wire Resend email transport" -ForegroundColor White
Write-Host "    A3      Hidden evidence branch in resolveContent + resolveEvidence" -ForegroundColor White
Write-Host "    P2-1    Add 3 missing enums to lib/enums.ts" -ForegroundColor White
Write-Host "    P2-13   Delete deprecated nextUserCaseStatus" -ForegroundColor White
Write-Host ""
Write-Host "  Report will be saved to: docs/WAVE4-FIXES-REPORT.md" -ForegroundColor DarkGray
Write-Host ""

Set-Location $REPO_ROOT

$BOOTSTRAP = "Read the file scripts/WAVE4_FIXES.md and execute every instruction in it exactly as written. Start with FIX 1 immediately."

Write-Host "  Launching Claude Code..." -ForegroundColor Cyan
Write-Host ""

claude --allowedTools "Read,Write,Edit,Bash,Glob,Grep" --add-dir $REPO_ROOT -p $BOOTSTRAP

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  SESSION ENDED" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

$reportPath = Join-Path $REPO_ROOT "docs\WAVE4-FIXES-REPORT.md"
if (Test-Path $reportPath) {
    $kb = [Math]::Round((Get-Item $reportPath).Length / 1KB, 1)
    Write-Host "  [OK] Report saved: docs/WAVE4-FIXES-REPORT.md ($kb KB)" -ForegroundColor Green
} else {
    Write-Host "  [!!] Report not found. Check docs/ manually." -ForegroundColor Red
}
