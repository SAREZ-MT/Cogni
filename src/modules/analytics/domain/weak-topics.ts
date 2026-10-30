// "Temas débiles" (Home, Phase 8 H2-T5a, user decision 2026-10-18): the
// live pages whose active-recall and exam answers were most often wrong
// lately. Same correctness rules as the dashboard's "Tasa de acierto".
import { examAccuracy, recallAccuracy } from "./accuracy";
import type { PageProgressRow } from "./progress";

// A page needs this many rated answers before it can be called weak, so a
// single bad answer does not flag it.
export const WEAK_TOPIC_MIN_ATTEMPTS = 3;
// Strictly below this share of correct answers.
export const WEAK_TOPIC_MAX_ACCURACY = 0.7;
export const WEAK_TOPICS_LIMIT = 5;

export interface WeakTopic {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  notebookColor: string | null;
  // correct / attempts, 0..1.
  accuracy: number;
  attempts: number;
}

export interface RankWeakTopicsInput {
  // The live pages: answers of any other page are skipped.
  pages: readonly PageProgressRow[];
  examAnswers: readonly { pageId: string; isCorrect: boolean }[];
  recallAnswers: readonly { pageId: string; aiScore: number }[];
}

function groupByPage<T extends { pageId: string }>(
  facts: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const fact of facts) {
    const group = groups.get(fact.pageId);
    if (group) group.push(fact);
    else groups.set(fact.pageId, [fact]);
  }
  return groups;
}

// Worst accuracy first; more attempts first on a tie (stronger evidence),
// then page id in code-unit order so the list is stable.
function compareWeakTopics(a: WeakTopic, b: WeakTopic): number {
  if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
  if (a.attempts !== b.attempts) return b.attempts - a.attempts;
  return a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0;
}

export function rankWeakTopics(input: RankWeakTopicsInput): WeakTopic[] {
  const exams = groupByPage(input.examAnswers);
  const recalls = groupByPage(input.recallAnswers);
  const topics: WeakTopic[] = [];
  for (const page of input.pages) {
    const examTally = examAccuracy(exams.get(page.pageId) ?? []);
    const recallTally = recallAccuracy(recalls.get(page.pageId) ?? []);
    const attempts = examTally.total + recallTally.total;
    if (attempts < WEAK_TOPIC_MIN_ATTEMPTS) continue;
    const accuracy = (examTally.correct + recallTally.correct) / attempts;
    if (accuracy >= WEAK_TOPIC_MAX_ACCURACY) continue;
    topics.push({
      pageId: page.pageId,
      pageTitle: page.pageTitle,
      notebookId: page.notebookId,
      notebookTitle: page.notebookTitle,
      notebookColor: page.notebookColor,
      accuracy,
      attempts,
    });
  }
  return topics.sort(compareWeakTopics).slice(0, WEAK_TOPICS_LIMIT);
}
