import type { Clock } from "@/shared/kernel/clock";
import {
  composeRecallQuestions,
  type RecallSessionRepositories,
} from "./recall-session-work";
import type { RecallSessionQuestion } from "./start-recall-session";

export interface PlanRecallSessionDeps
  extends Pick<RecallSessionRepositories, "questions" | "studyItems"> {
  clock: Clock;
}

export interface RecallSessionPlan {
  // What a session started now would show, in order; empty when the page
  // has no question to practise (another owner's page reads as empty).
  questions: RecallSessionQuestion[];
}

// The read model of the session route: the questions the player shows
// before anything is saved. Writes nothing, so opening or reloading the
// route never leaves an empty session behind; the player starts the
// session (startRecallSession) when the first answer is saved.
export async function planRecallSession(
  input: { pageId: string },
  deps: PlanRecallSessionDeps,
  ownerId: string,
): Promise<RecallSessionPlan> {
  const questions = await composeRecallQuestions(
    { pageId: input.pageId, now: deps.clock.now() },
    ownerId,
    deps,
  );
  return { questions: questions.map(({ id, prompt }) => ({ id, prompt })) };
}
