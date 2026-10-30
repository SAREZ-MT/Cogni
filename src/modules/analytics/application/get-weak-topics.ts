import type { Clock } from "@/shared/kernel/clock";
import type {
  AnswerOutcomeReader,
  PageProgressReader,
} from "../domain/readers";
import { rankWeakTopics, type WeakTopic } from "../domain/weak-topics";

// Rolling window, in 24-hour days ending at the clock's instant: a weak
// topic is about recent answers, not the whole history.
export const WEAK_TOPICS_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GetWeakTopicsDeps {
  answers: AnswerOutcomeReader;
  pages: PageProgressReader;
  clock: Clock;
}

export interface GetWeakTopicsInput {
  ownerId: string;
}

// "Temas débiles" on Home (Phase 8 H2-T5a): the owner's live pages with
// the lowest accuracy across finished-exam answers and evaluated recall
// answers of the last 30 days (domain/weak-topics.ts has the thresholds).
export async function getWeakTopics(
  input: GetWeakTopicsInput,
  deps: GetWeakTopicsDeps,
): Promise<WeakTopic[]> {
  const now = deps.clock.now();
  const from = new Date(now.getTime() - WEAK_TOPICS_WINDOW_DAYS * DAY_MS);
  // [from, to): include an answer saved at exactly `now`.
  const to = new Date(now.getTime() + 1);
  const [pages, examAnswers, recallAnswers] = await Promise.all([
    // Only the page details are used here, not the due counts.
    deps.pages.listPageProgress(input.ownerId, now),
    deps.answers.listExamAnswers(input.ownerId, from, to),
    deps.answers.listRecallAnswers(input.ownerId, from, to),
  ]);
  return rankWeakTopics({ pages, examAnswers, recallAnswers });
}
