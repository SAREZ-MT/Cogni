import {
  type Calibration,
  calibrationOf,
} from "@/modules/active-recall/calibration";
import {
  type CalibratedAnswer,
  type CalibrationRollup,
  type CalibrationSignal,
  rollupCalibration,
} from "../domain/calibration";
import { type DayKey, paddedWindow } from "../domain/local-day";
import { splitPeriods } from "../domain/periods";
import type { AnswerOutcomeReader } from "../domain/readers";

// Compile-time guard: CalibrationSignal mirrors active-recall's
// Calibration, whose calibrationOf classifies every answer below.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const signalsMatch: Same<CalibrationSignal, Calibration> = true;
void signalsMatch;

export interface GetCalibrationDeps {
  answers: AnswerOutcomeReader;
}

export interface GetCalibrationInput {
  ownerId: string;
  // Local days [fromDay, toDay) in `timeZone` (the profile's zone).
  fromDay: DayKey;
  toDay: DayKey;
  timeZone: string;
}

// "Calibración metacognitiva" (documento-maestro §3.6, §7.4, ADR 0007):
// the evaluated recall answers of the range, each classified by
// active-recall's calibrationOf (self ≥ 4 with AI ≤ 2 is overconfidence,
// self ≤ 1 with AI ≥ 4 is underconfidence), rolled up per page. Derived on
// every read, never stored. Recall only: no other technique has a
// self-assessment.
export async function getCalibration(
  input: GetCalibrationInput,
  deps: GetCalibrationDeps,
): Promise<CalibrationRollup> {
  const { from, to } = paddedWindow(input.fromDay, input.toDay);
  const answers = await deps.answers.listRecallAnswers(input.ownerId, from, to);
  const { current } = splitPeriods(answers, (answer) => answer.answeredAt, {
    previousFromDay: input.fromDay,
    fromDay: input.fromDay,
    toDay: input.toDay,
    timeZone: input.timeZone,
  });
  const calibrated: CalibratedAnswer[] = [];
  for (const answer of current) {
    // The database keeps both ratings within 0–5, so the rule only rejects
    // rows that could never be stored.
    const signal = calibrationOf(answer.selfRating, answer.aiScore);
    if (!signal.ok) continue;
    calibrated.push({
      pageId: answer.pageId,
      pageTitle: answer.pageTitle,
      notebookId: answer.notebookId,
      notebookTitle: answer.notebookTitle,
      selfRating: answer.selfRating,
      aiScore: answer.aiScore,
      signal: signal.value,
    });
  }
  return rollupCalibration(calibrated);
}
