import {
  type AiGeneration,
  buildGenerateExamVariantsPrompt,
  examVariantsOutput,
  type FailedExamRoot,
  GENERATE_EXAM_VARIANTS_PROMPT_VERSION,
  type GenerateStructuredInput,
  type GenerationRateLimiter,
  truncateToTokenCap,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import type { DueCutoff } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { composeRetake } from "../domain/composition";
import { EXAM_ERROR } from "../domain/errors";
import {
  type ExamQuestion,
  type NewVariantInput,
  newVariant,
} from "../domain/exam-question";
import {
  type ExamSession,
  invalidCount,
  isValidQuestionCount,
  newExamSession,
} from "../domain/exam-session";
import {
  type ExamSessionRepositories,
  type ExamSessionUnitOfWork,
  listExamCandidates,
} from "./exam-session-work";
import { runExamWork } from "./exam-unit-of-work";
import {
  EXAM_GENERATION_BATCH_SIZE,
  ExamDailyLimitReachedError,
  splitIntoBatches,
} from "./request-exam-generation";

export interface StartExamRetakeDeps {
  pages: PageTextReader;
  limiter: GenerationRateLimiter;
  ai: {
    generateStructured(
      input: GenerateStructuredInput,
      ownerId: string,
    ): Promise<
      Result<{ object: unknown; generation: AiGeneration }, DomainError>
    >;
  };
  uow: ExamSessionUnitOfWork;
  clock: Clock;
  // The owner's per-day "due" bound (start of their next local day), for
  // the order of the page's other questions (composeRetake).
  dueCutoff: DueCutoff;
  ids: { next(): string };
  tokenCap: number;
}

export interface StartedExamRetake {
  kind: "started";
  session: ExamSession;
  // True when the page's open retake was returned instead of a new one.
  resumed: boolean;
  // Daily generations left after this start; null when no AI call was made
  // (a resumed retake, or variants that already existed).
  remainingToday: number | null;
}

// Every failed concept of the page left it (the student retired all of
// its questions after failing): the pending retake was cleared and the
// page holds a normal exam again (user decision 2026-10-05).
export interface ClearedExamRetake {
  kind: "cleared";
}

// A failed root of the last failed exam and how the retake covers it.
interface RetakeRoot {
  rootId: string;
  // The question of this root shown in the failed exam: the wording the
  // variant replaces (variant_of) and retires.
  previous: ExamQuestion;
  // Every question of the root, retired ones included (newVariant).
  lineage: ExamQuestion[];
  // An active question of the root never shown in the failed exam (a
  // variant stored earlier): reused as is, without an AI call.
  fresh: ExamQuestion | null;
}

interface RetakePlan {
  failedSessionId: string;
  shownQuestionIds: readonly string[];
  roots: RetakeRoot[];
}

type PlanOutcome =
  | { kind: "resume"; session: ExamSession }
  | { kind: "plan"; plan: RetakePlan };

type CheckedOutcome = PlanOutcome | { kind: "cleared" };

type StoredOutcome =
  | { kind: "resume"; session: ExamSession }
  | { kind: "created"; session: ExamSession };

function variantMissing(message: string) {
  return err(new DomainError(EXAM_ERROR.RETAKE_VARIANT_MISSING, message));
}

function noRetakePending(pageId: string) {
  return err(
    new DomainError(
      EXAM_ERROR.NO_RETAKE_PENDING,
      `page ${pageId} has no pending retake`,
    ),
  );
}

// Starts the retake of a page that failed its last exam (documento-maestro
// §7.5, user decision 2026-10-05): every failed root comes back
// REFORMULATED (same concept, a wording never used before by its lineage),
// first in the session, then the rest of the page's questions up to N.
//
// - No pending retake: EXAMS_NO_RETAKE_PENDING. N outside [10, 30] or below
//   the number of failed roots: EXAMS_INVALID_QUESTION_COUNT. Both before
//   any AI call.
// - The page's open retake is resumed as it is (no AI call).
// - Failed roots whose lineage has no active question left (retired by the
//   student after failing) are dropped. When none is left the pending
//   retake is cleared (retakePending false, no failed roots, the last
//   passing session kept) under the page lock and { kind: "cleared" } is
//   returned: the page holds a normal exam again. No AI call.
// - Before any AI call the retake is composed with the current candidates
//   and one placeholder variant per failed root: a page that cannot hold it
//   (fewer than 10 roots: EXAMS_NOT_ENOUGH_QUESTIONS) is refused without
//   calling the model or consuming a unit.
// - A failed root that already has an active, unshown variant (stored by
//   an earlier attempt) reuses it; only the other roots are sent to the
//   model, so a retake whose variants all exist makes no AI call.
// - Otherwise the daily limit is PEEKED (an exhausted limit refuses with
//   AI_DAILY_LIMIT_REACHED and calls nothing), the variants are generated
//   in calls of at most 15 roots, and each one is checked with newVariant
//   against the root's whole lineage. A provider failure, an unusable
//   answer, a missing root or a repeated wording blocks the retake with
//   EXAMS_RETAKE_VARIANT_MISSING: nothing is stored and no unit is
//   consumed (the original wording is never reused, §7.5.5).
// - One transaction then locks each failed lineage (id order), stores the
//   variants (origin ai_variant, variant_of = the question shown in the
//   failed exam, same root), retires the replaced wordings (§7.5.2),
//   composes the retake (composeRetake) and creates the session with its
//   question list. Everything is re-checked under the locks.
// - One unit of the daily limit is consumed (limiter.check) only after
//   that transaction commits, and only when the AI was called: a failed or
//   rolled-back start costs nothing. If the limit ran out between the peek
//   and the commit (a concurrent generation), the retake stands and
//   remainingToday is 0.
export async function startExamRetake(
  input: { pageId: string; requestedCount: number },
  deps: StartExamRetakeDeps,
  ownerId: string,
): Promise<Result<StartedExamRetake | ClearedExamRetake, DomainError>> {
  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;
  if (!isValidQuestionCount(input.requestedCount)) {
    return err(invalidCount(input.requestedCount));
  }

  const now = deps.clock.now();
  const outcome = await runExamWork(deps.uow, (repos) =>
    checkRetake(input, ownerId, repos, now, deps.dueCutoff(now)),
  );
  if (!outcome.ok) return outcome;
  if (outcome.value.kind === "cleared") return ok({ kind: "cleared" });
  if (outcome.value.kind === "resume") {
    return ok({
      kind: "started",
      session: outcome.value.session,
      resumed: true,
      remainingToday: null,
    });
  }
  const { plan } = outcome.value;

  const missing = plan.roots.filter((root) => root.fresh === null);
  let generated = new Map<string, NewVariantInput>();
  if (missing.length > 0) {
    const limit = await deps.limiter.peek(ownerId);
    if (!limit.allowed) {
      return err(new ExamDailyLimitReachedError(limit.resetAt));
    }
    const variants = await generateVariants(
      missing,
      { title: page.value.title, plainText: page.value.plainText },
      input.pageId,
      ownerId,
      deps,
      now,
    );
    if (!variants.ok) return variants;
    generated = variants.value;
  }

  const id = deps.ids.next();
  const stored = await runExamWork(
    deps.uow,
    async (repos): Promise<Result<StoredOutcome, DomainError>> => {
      await repos.sessions.lockPageForStart(input.pageId, ownerId);
      // A concurrent start may have created the retake meanwhile.
      const current = await planRetake(input.pageId, ownerId, repos);
      if (!current.ok) return current;
      if (current.value.kind === "resume") {
        return ok({ kind: "resume", session: current.value.session });
      }
      if (!samePlan(current.value.plan, plan)) {
        return variantMissing(
          `the failed roots of page ${input.pageId} changed during the retake start`,
        );
      }
      const roots = [...plan.roots].sort((a, b) =>
        a.rootId < b.rootId ? -1 : a.rootId > b.rootId ? 1 : 0,
      );
      for (const root of roots) {
        await repos.questions.lockLineage(root.rootId, ownerId);
      }

      const variantsByRoot = new Map<string, string>();
      for (const root of plan.roots) {
        const chosen = await storeRootVariant(
          root,
          generated.get(root.rootId),
          ownerId,
          repos,
          now,
        );
        if (!chosen.ok) return chosen;
        variantsByRoot.set(root.rootId, chosen.value);
      }

      const composed = composeRetake({
        requestedCount: input.requestedCount,
        failedRootIds: plan.roots.map((root) => root.rootId),
        variantsByRoot,
        shownQuestionIds: plan.shownQuestionIds,
        otherCandidates: await listExamCandidates(
          { pageId: input.pageId, now },
          ownerId,
          repos,
        ),
        dueBefore: deps.dueCutoff(now),
      });
      if (!composed.ok) return composed;
      const session = newExamSession(
        {
          id,
          ownerId,
          pageId: input.pageId,
          requestedCount: input.requestedCount,
          retakeOfSessionId: plan.failedSessionId,
          questionIds: composed.value.map(({ questionId }) => questionId),
        },
        now,
      );
      if (!session.ok) return session;
      await repos.sessions.create(session.value);
      return ok({ kind: "created", session: session.value });
    },
  );
  if (!stored.ok) return stored;
  if (stored.value.kind === "resume") {
    return ok({
      kind: "started",
      session: stored.value.session,
      resumed: true,
      remainingToday: null,
    });
  }

  let remainingToday: number | null = null;
  if (generated.size > 0) {
    const consumed = await deps.limiter.check(ownerId);
    remainingToday = consumed.allowed ? consumed.remaining : 0;
  }
  return ok({
    kind: "started",
    session: stored.value.session,
    resumed: false,
    remainingToday,
  });
}

// Stands for a variant not generated yet in the dry-run composition; never
// stored and never a real question id.
const PLACEHOLDER_VARIANT = "retake-variant-pending:";

// Plans the retake before any AI call: resumes the open retake, clears a
// retake with no failed root left (under the page lock, re-planned there),
// and dry-runs composeRetake with the page's current candidates and one
// placeholder per failed root, so a retake that cannot be composed is
// refused before the model is called. The composition is checked again
// with the real variants inside the storing transaction.
async function checkRetake(
  input: { pageId: string; requestedCount: number },
  ownerId: string,
  repos: ExamSessionRepositories,
  now: Date,
  dueBefore: Date,
): Promise<Result<CheckedOutcome, DomainError>> {
  let outcome = await planRetake(input.pageId, ownerId, repos);
  if (!outcome.ok || outcome.value.kind === "resume") return outcome;
  if (outcome.value.plan.roots.length === 0) {
    await repos.sessions.lockPageForStart(input.pageId, ownerId);
    outcome = await planRetake(input.pageId, ownerId, repos);
    if (!outcome.ok || outcome.value.kind === "resume") return outcome;
    if (outcome.value.plan.roots.length === 0) {
      await clearRetake(input.pageId, ownerId, repos);
      return ok({ kind: "cleared" });
    }
  }
  const { plan } = outcome.value;
  const composed = composeRetake({
    requestedCount: input.requestedCount,
    failedRootIds: plan.roots.map((root) => root.rootId),
    variantsByRoot: new Map(
      plan.roots.map((root) => [
        root.rootId,
        root.fresh?.id ?? `${PLACEHOLDER_VARIANT}${root.rootId}`,
      ]),
    ),
    shownQuestionIds: plan.shownQuestionIds,
    otherCandidates: await listExamCandidates(
      { pageId: input.pageId, now },
      ownerId,
      repos,
    ),
    dueBefore,
  });
  if (!composed.ok) return composed;
  return outcome;
}

// The page leaves the retake: no pending retake, no failed roots; the last
// passing session is kept.
async function clearRetake(
  pageId: string,
  ownerId: string,
  repos: ExamSessionRepositories,
): Promise<void> {
  const state = await repos.pageStates.get(pageId, ownerId);
  if (!state) return;
  await repos.pageStates.upsert({
    ...state,
    retakePending: false,
    failedRootIds: [],
  });
}

// Reads what a retake start needs: the open retake to resume, or the
// failed roots of the page's last exam with their lineages.
async function planRetake(
  pageId: string,
  ownerId: string,
  repos: ExamSessionRepositories,
): Promise<Result<PlanOutcome, DomainError>> {
  const state = await repos.pageStates.get(pageId, ownerId);
  if (!state?.retakePending) return noRetakePending(pageId);
  const open = await repos.sessions.findOpenRetakeByPage(pageId, ownerId);
  if (open) return ok({ kind: "resume", session: open });

  // retakePending was set by the page's last finished exam (scoreExam).
  const failedSession = (
    await repos.sessions.listFinishedByPage(pageId, ownerId)
  ).at(-1);
  if (!failedSession || failedSession.passed !== false) {
    return noRetakePending(pageId);
  }
  const shownIds = new Set(failedSession.questionIds);
  const shown = await repos.questions.listByIds(
    failedSession.questionIds,
    ownerId,
  );
  const shownByRoot = new Map(shown.map((q) => [q.rootId, q]));

  const roots: RetakeRoot[] = [];
  for (const rootId of new Set(state.failedRootIds)) {
    const previous = shownByRoot.get(rootId);
    const lineage = await repos.questions.listLineage(rootId, ownerId);
    const active = lineage.filter((q) => q.retiredAt === null);
    // The student retired every question of this root since the exam: the
    // concept left the page and is not retaken.
    if (!previous || active.length === 0) continue;
    roots.push({
      rootId,
      previous,
      lineage,
      fresh: active.find((q) => !shownIds.has(q.id)) ?? null,
    });
  }
  return ok({
    kind: "plan",
    plan: {
      failedSessionId: failedSession.id,
      shownQuestionIds: failedSession.questionIds,
      roots,
    },
  });
}

// The plan re-read under the page lock still names the same failed exam,
// roots and replaced questions as the one the variants were made for.
function samePlan(a: RetakePlan, b: RetakePlan): boolean {
  const key = (plan: RetakePlan) =>
    JSON.stringify([
      plan.failedSessionId,
      plan.roots.map((r) => [r.rootId, r.previous.id, r.fresh?.id ?? null]),
    ]);
  return key(a) === key(b);
}

// Stores the generated variant of one root and retires the wording it
// replaces, or confirms the reused one; returns the question id the retake
// shows for the root. Re-checked against the lineage read under its lock.
async function storeRootVariant(
  root: RetakeRoot,
  generated: NewVariantInput | undefined,
  ownerId: string,
  repos: ExamSessionRepositories,
  now: Date,
): Promise<Result<string, DomainError>> {
  if (root.fresh !== null) {
    const fresh = await repos.questions.findById(root.fresh.id, ownerId);
    if (!fresh || fresh.retiredAt !== null) {
      return variantMissing(`the variant of root ${root.rootId} is gone`);
    }
    return ok(fresh.id);
  }
  const previous = await repos.questions.findById(root.previous.id, ownerId);
  if (!previous || generated === undefined) {
    return variantMissing(`root ${root.rootId} has no variant`);
  }
  const lineage = await repos.questions.listLineage(root.rootId, ownerId);
  const variant = newVariant(previous, lineage, generated, now);
  if (!variant.ok) {
    return variantMissing(
      `the variant of root ${root.rootId} was refused: ${variant.error.message}`,
    );
  }
  await repos.questions.save(variant.value);
  await repos.questions.retire(previous.id, ownerId, now);
  return ok(variant.value.id);
}

// Calls the model for the roots without a variant, at most 15 roots per
// call, and keeps the first valid variant of each root (checked with
// newVariant against the whole lineage). Any root left without one blocks
// the retake.
async function generateVariants(
  roots: readonly RetakeRoot[],
  page: { title: string; plainText: string },
  pageId: string,
  ownerId: string,
  deps: StartExamRetakeDeps,
  now: Date,
): Promise<Result<Map<string, NewVariantInput>, DomainError>> {
  const truncation = truncateToTokenCap(page.plainText, deps.tokenCap);
  const accepted = new Map<string, NewVariantInput>();
  let offset = 0;
  for (const size of splitIntoBatches(
    roots.length,
    EXAM_GENERATION_BATCH_SIZE,
  )) {
    const batch = roots.slice(offset, offset + size);
    offset += size;
    const prompt = buildGenerateExamVariantsPrompt({
      pageTitle: page.title,
      pageText: truncation.text,
      failed: batch.map(toFailedRoot),
    });
    const generated = await deps.ai.generateStructured(
      {
        purpose: "generate_exam_variants",
        pageId,
        promptVersion: GENERATE_EXAM_VARIANTS_PROMPT_VERSION,
        system: prompt.system,
        prompt: prompt.prompt,
        temperature: prompt.temperature,
      },
      ownerId,
    );
    if (!generated.ok) {
      return variantMissing(
        `the variants could not be generated: ${generated.error.message}`,
      );
    }
    const parsed = examVariantsOutput.safeParse(generated.value.object);
    if (!parsed.success) continue;
    const byRoot = new Map(batch.map((root) => [root.rootId, root]));
    for (const raw of parsed.data.variants) {
      const root = byRoot.get(raw.forRootId);
      if (!root || accepted.has(root.rootId)) continue;
      const input: NewVariantInput = {
        id: deps.ids.next(),
        stem: raw.stem,
        options: raw.options,
        correctIndex: raw.correctIndex,
        explanation: raw.explanation,
        generationId: generated.value.generation.id,
      };
      const variant = newVariant(root.previous, root.lineage, input, now);
      if (variant.ok) accepted.set(root.rootId, input);
    }
  }
  const lacking = roots.filter((root) => !accepted.has(root.rootId));
  if (lacking.length > 0) {
    return variantMissing(
      `no valid variant for roots ${lacking.map((r) => r.rootId).join(", ")}`,
    );
  }
  return ok(accepted);
}

function toFailedRoot(root: RetakeRoot): FailedExamRoot {
  const { previous } = root;
  return {
    rootId: root.rootId,
    concept: previous.concept,
    previousStems: root.lineage.map((q) => q.stem),
    correctAnswer: previous.options[previous.correctIndex] ?? "",
    explanation: previous.explanation,
  };
}
