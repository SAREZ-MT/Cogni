import {
  addDays,
  type DayKey,
  dayKeyFormatter,
  daysBetween,
} from "./local-day";

// The dashboard compares a range with the one right before it ("vs. la
// semana anterior"): same length, ending where the range starts.
export function previousRange(
  fromDay: DayKey,
  toDay: DayKey,
): { fromDay: DayKey; toDay: DayKey } {
  return {
    fromDay: addDays(fromDay, -daysBetween(fromDay, toDay).length),
    toDay: fromDay,
  };
}

export interface PeriodSplit<T> {
  current: T[];
  previous: T[];
}

// Keeps the facts whose local day (in `timeZone`) falls in
// [previousFromDay, fromDay) as `previous` and in [fromDay, toDay) as
// `current`; readers return a padded window, so the rest is dropped here.
export function splitPeriods<T>(
  facts: readonly T[],
  instantOf: (fact: T) => Date,
  options: {
    previousFromDay: DayKey;
    fromDay: DayKey;
    toDay: DayKey;
    timeZone: string;
  },
): PeriodSplit<T> {
  const dayOf = dayKeyFormatter(options.timeZone);
  const split: PeriodSplit<T> = { current: [], previous: [] };
  for (const fact of facts) {
    const day = dayOf(instantOf(fact));
    if (day >= options.fromDay && day < options.toDay) {
      split.current.push(fact);
    } else if (day >= options.previousFromDay && day < options.fromDay) {
      split.previous.push(fact);
    }
  }
  return split;
}
