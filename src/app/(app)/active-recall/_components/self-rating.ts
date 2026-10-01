// Self-rating (0-5) → bucket (design/shell-look fix, 2026-09-24): the
// in-session StatDots and the end-of-session stats grid both bucket the
// STUDENT's self-rating — never the AI score — into three tones: "Difícil"
// (0-1, error), "Regular" (2-3, warning), "Fácil" (4-5, success). This is a
// distinct metric from "dominio"/mastery (documento-maestro §7.4 combined
// quality), which buckets the AI score instead (see RecallPageCard).
export type SelfRatingBucket = "dificil" | "regular" | "facil";

export function selfRatingBucketFor(rating: number): SelfRatingBucket {
  if (rating <= 1) return "dificil";
  if (rating <= 3) return "regular";
  return "facil";
}

export const SELF_RATING_BUCKET_META: Record<
  SelfRatingBucket,
  {
    label: string;
    dotClassName: string;
    toneClassName: string;
    pillTone: "error" | "warning" | "success";
  }
> = {
  dificil: {
    label: "Difícil",
    dotClassName: "bg-error-500",
    toneClassName: "text-error-600",
    pillTone: "error",
  },
  regular: {
    label: "Regular",
    dotClassName: "bg-warning-500",
    toneClassName: "text-warning-600",
    pillTone: "warning",
  },
  facil: {
    label: "Fácil",
    dotClassName: "bg-success-500",
    toneClassName: "text-success-600",
    pillTone: "success",
  },
};

export const SELF_RATING_BUCKET_ORDER: SelfRatingBucket[] = [
  "dificil",
  "regular",
  "facil",
];

// One completed (or skipped) question, kept for the end-of-session results
// view — documento-maestro §8.5: answers save first, so every record below
// exists independently of whether the AI evaluation for it has finished.
export interface QuestionRecord {
  id: string;
  prompt: string;
  answer: string;
  selfRating: number;
}
