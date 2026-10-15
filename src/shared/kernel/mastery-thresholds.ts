// Page mastery band thresholds (documento-maestro §7.3): a score below
// CONSOLIDATING_THRESHOLD is "Aprendiendo", below MASTERED_THRESHOLD is
// "Consolidando", otherwise "Dominado". Single source shared by
// study-engine/domain (computeMastery) and shared/ui (masteryLevelFromScore)
// so the domain and the dashboard charts can never drift apart. Adjusted
// only by ADR with real data.
export const CONSOLIDATING_THRESHOLD = 0.35;
export const MASTERED_THRESHOLD = 0.7;
