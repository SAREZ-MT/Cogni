// Public API of the "analytics" module: the dashboard's progress,
// per-technique metrics and metacognitive calibration (documento-maestro
// §3.6). No cross-module import may reach past this file (§5.3.5).
export {
  type CalibrationView,
  getCalibrationAction,
  getProgressAction,
  getTechniqueMetricsAction,
  type ProgressView,
  type TechniqueMetricsView,
} from "./actions";
export type {
  AccuracySummary,
  TechniqueMetrics,
  TechniqueMetricsReport,
} from "./application";
export {
  type DashboardRangeInput,
  getDashboardCalibration,
  getDashboardProgress,
  getDashboardTechniqueMetrics,
  MAX_RANGE_DAYS,
  MAX_TREND_WEEKS,
  type ProgressInput,
} from "./dashboard-reads";
export * from "./domain";
export {
  type AnalyticsRange,
  type AnalyticsServerApi,
  createAnalyticsServerApi,
} from "./server-api";
