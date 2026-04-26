#!/usr/bin/env pwsh
# BLACK LEDGER -- WAVE 3 FIX RUNNER
# Run from site/ directory:
#   powershell -ExecutionPolicy Bypass -File scripts/run-wave3.ps1

$ErrorActionPreference = "Stop"

$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO_ROOT   = Split-Path -Parent $SCRIPT_DIR
$PROMPT_FILE = Join-Path $SCRIPT_DIR "WAVE3_FIXES.md"

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  BLACK LEDGER -- WAVE 3 FIX LAUNCHER" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

if (-not (Test-Path $PROMPT_FILE)) {
    Write-Host "  [!!] WAVE3_FIXES.md not found at: $PROMPT_FILE" -ForegroundColor Red
    exit 1
}

$claudeCmd = Get-Command "claude" -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Host "  [!!] Claude Code not found. Run: npm install -g @anthropic/claude-code" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] Claude Code found" -ForegroundColor Green
Write-Host "  [OK] Wave 3 prompt found" -ForegroundColor Green
Write-Host ""
Write-Host "  Fixes to apply:" -ForegroundColor White
Write-Host "    BUG-03  Stripe orphan-drop: throw instead of silent return" -ForegroundColor White
Write-Host "    BUG-05  Order email tracking: emailSentAt + emailLastError" -ForegroundColor White
Write-Host "    SEC-09  Middleware redirects include callbackUrl" -ForegroundColor White
Write-Host "    A1      Theory route: early exit when case is SOLVED" -ForegroundColor White
Write-Host ""
Write-Host "  NOTE: BUG-05 will attempt a Prisma migration (safe nullable" -ForegroundColor DarkGray
Write-Host "  columns). Requires DIRECT_URL in .env.local pointing to Neon." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Report will be saved to: docs/WAVE3-FIXES-REPORT.md" -ForegroundColor DarkGray
Write-Host ""

Set-Location $REPO_ROOT

$BOOTSTRAP = "Read the file scripts/WAVE3_FIXES.md and execute every instruction in it exactly as written. Start with FIX 1 immediately."

Write-Host "  Launching Claude Code..." -ForegroundColor Cyan
Write-Host ""

claude --allowedTools "Read,Write,Edit,Bash,Glob,Grep" --add-dir $REPO_ROOT -p $BOOTSTRAP

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  SESSION ENDED" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

$reportPath = Join-Path $REPO_ROOT "docs\WAVE3-FIXES-REPORT.md"
if (Test-Path $reportPath) {
    $kb = [Math]::Round((Get-Item $reportPath).Length / 1KB, 1)
    Write-Host "  [OK] Report saved: docs/WAVE3-FIXES-REPORT.md ($kb KB)" -ForegroundColor Green
} else {
    Write-Host "  [!!] Report not found. Check docs/ manually." -ForegroundColor Red
}
