/**
 * Bureau case serial — the canonical identifier displayed across all
 * player-facing surfaces (workspace, dashboard, debrief, public marketing
 * page, admin tabs).
 *
 * Derivation: zero-padded primary key. `caseFile.id` is the only stable,
 * immutable identifier in the schema — slug can rename (CaseSlugHistory
 * tracks aliases), title is editable, list index changes per query.
 *
 * Format: `BL-XXX` where XXX is the zero-padded id (3-digit minimum).
 * Cases with id ≥ 1000 produce `BL-1000` etc. — the pad floor is 3, not a cap.
 *
 * Usage: pass the case file (or any object with a numeric `id` field).
 *
 *   caseSerial(caseFile)           // "BL-001"
 *   caseSerial({ id: 14 })         // "BL-014"
 *   caseSerial({ id: 1037 })       // "BL-1037"
 */
export function caseSerial(input: { id: number }): string {
  return `BL-${String(input.id).padStart(3, "0")}`;
}
