#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# BLACK LEDGER — GOD MODE AUDIT RUNNER (bash version)
# Launches Claude Code with the full 6-expert audit protocol
#
# Usage (from the site/ directory):
#   bash scripts/godmode-audit.sh
#
# Requirements:
#   - Claude Code CLI installed: npm install -g @anthropic/claude-code
#   - Authenticated: claude auth
#   - Run from: black-ledger/site/
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
RED='\033[0;31m';  WHITE='\033[1;37m';  GRAY='\033[0;37m'; RESET='\033[0m'

header()  { echo -e "\n${CYAN}$(printf '═%.0s' {1..72})\n  $1\n$(printf '═%.0s' {1..72})${RESET}"; }
step()    { echo -e "  ${YELLOW}► $1${RESET}"; }
success() { echo -e "  ${GREEN}✓ $1${RESET}"; }
warn()    { echo -e "  ${RED}⚠ $1${RESET}"; }

# ── Detect repo root ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"      # site/
PROMPT_FILE="$SCRIPT_DIR/GODMODE_AUDIT.md"
AUDIT_DATE="$(date +%Y-%m-%d)"
REPORT_DIR="$REPO_ROOT/docs"
TEMP_PROMPT="/tmp/bl-godmode-$AUDIT_DATE.md"

header "BLACK LEDGER — GOD MODE AUDIT LAUNCHER"

# ── Pre-flight checks ────────────────────────────────────────────────────────
step "Running pre-flight checks..."

# 1. Verify we're in the right directory
if [[ ! -f "$REPO_ROOT/package.json" ]]; then
    warn "package.json not found. Are you running from site/ directory?"
    warn "Expected path: $REPO_ROOT"
    exit 1
fi

# 2. Verify Claude Code is installed
if ! command -v claude &>/dev/null; then
    warn "Claude Code CLI not found."
    echo -e "\n  Install it with:"
    echo -e "    npm install -g @anthropic/claude-code"
    echo -e "    claude auth\n"
    exit 1
fi
success "Claude Code found at: $(which claude)"

# 3. Verify the audit prompt exists
if [[ ! -f "$PROMPT_FILE" ]]; then
    warn "Audit prompt not found at: $PROMPT_FILE"
    exit 1
fi
success "Audit prompt loaded: $PROMPT_FILE"

# 4. Verify git repo
cd "$REPO_ROOT"
if ! git status --short &>/dev/null; then
    warn "Not a git repository or git not available."
    exit 1
fi
success "Git repo verified"

# ── Gather pre-audit metrics ─────────────────────────────────────────────────
step "Gathering pre-audit metrics..."

FILE_COUNT=$(git ls-files | wc -l | tr -d ' ')
COMMIT_COUNT=$(git log --oneline | wc -l | tr -d ' ')
LOC_TOTAL=$(git ls-files | grep -v 'package-lock\|migration\.sql' | xargs cat 2>/dev/null | wc -l | tr -d ' ')

success "Tracked files: $FILE_COUNT"
success "Total commits: $COMMIT_COUNT"
success "Approx LOC:    $LOC_TOTAL"

# ── Ensure docs directory exists ─────────────────────────────────────────────
mkdir -p "$REPORT_DIR"

# ── Build the launch prompt ───────────────────────────────────────────────────
step "Building launch prompt..."

META_BLOCK="---
## LIVE AUDIT CONTEXT (injected at launch time)
- **Audit date**: $AUDIT_DATE
- **Repo root**: $REPO_ROOT
- **Tracked files**: $FILE_COUNT
- **Total commits**: $COMMIT_COUNT
- **Expected report path**: docs/GODMODE-AUDIT-$AUDIT_DATE.md
---

"

echo "$META_BLOCK" > "$TEMP_PROMPT"
cat "$PROMPT_FILE" >> "$TEMP_PROMPT"

PROMPT_SIZE=$(du -sh "$TEMP_PROMPT" | cut -f1)
success "Launch prompt ready ($PROMPT_SIZE)"

# ── Display launch summary ────────────────────────────────────────────────────
header "AUDIT CONFIGURATION"
echo -e "  Target repo  :  $REPO_ROOT"
echo -e "  Files to read:  $FILE_COUNT tracked files"
echo -e "  Protocol     :  6-Expert God Mode (Security / Architecture / Data /"
echo -e "                  Debugger / ML / DevOps)"
echo -e "  Output       :  docs/GODMODE-AUDIT-$AUDIT_DATE.md"
echo -e "  Claude tools :  Read, Bash, Write, Glob, Grep, Edit"
echo ""
echo -e "  ${GRAY}Estimated runtime: 20–40 minutes for a complete $FILE_COUNT-file pass"
echo -e "  Do not interrupt mid-session. Let it read everything first.${RESET}\n"

# ── Confirm launch ────────────────────────────────────────────────────────────
echo -e "  ${YELLOW}Press ENTER to launch God Mode, or CTRL+C to cancel...${RESET}"
read -r

# ── Launch Claude Code ────────────────────────────────────────────────────────
header "LAUNCHING CLAUDE CODE — GOD MODE"
echo -e "  ${CYAN}Claude Code is now loading the audit protocol.${RESET}"
echo -e "  ${GRAY}Expected sequence:"
echo -e "    Phase 0: Shell commands (git, tsc, tests, npm audit)"
echo -e "    Phase 1: Read all $FILE_COUNT files tier by tier"
echo -e "    Phase 2: Architecture reconstruction from memory"
echo -e "    Phase 3: Six expert analyses (parallel reasoning)"
echo -e "    Phase 4: Cross-expert synthesis + risk table"
echo -e "    Phase 5: Write final report to docs/${RESET}"
echo ""

cd "$REPO_ROOT"

# Launch with full tool access and the god mode prompt
claude \
    --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --add-dir "$REPO_ROOT" \
    -p "$(cat "$TEMP_PROMPT")"

# ── Post-audit ────────────────────────────────────────────────────────────────
header "AUDIT SESSION ENDED"

REPORT_PATH="$REPORT_DIR/GODMODE-AUDIT-$AUDIT_DATE.md"
if [[ -f "$REPORT_PATH" ]]; then
    REPORT_SIZE=$(du -sh "$REPORT_PATH" | cut -f1)
    success "Report found: $REPORT_PATH ($REPORT_SIZE)"
    echo -e "\n  ${GRAY}Open with: code docs/GODMODE-AUDIT-$AUDIT_DATE.md${RESET}\n"
else
    warn "Report file not found at expected path: $REPORT_PATH"
    echo -e "  ${GRAY}Check docs/ directory manually.${RESET}\n"
fi

# Cleanup
rm -f "$TEMP_PROMPT"
