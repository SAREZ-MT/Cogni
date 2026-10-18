// Shared table for the "start of tomorrow" cutoff (Phase 8 H2-T6). Analytics
// (domain/local-day.ts) and scheduling (domain/calendar.ts) each implement
// startOfTomorrowIn, because one domain may not import another. Both test
// suites assert against this one table, so the two implementations cannot
// drift apart. Each case: the zone, an instant, and the first instant of the
// next local day in that zone. Hand-checked against the tz database,
// including DST jumps at local midnight (Santiago, Havana), at 02:00/03:00
// (Madrid) and Samoa's skipped 30 Dec 2011 (Apia).
export interface LocalDayCutoffCase {
  timeZone: string;
  now: string;
  startOfTomorrow: string;
}

export const LOCAL_DAY_CUTOFFS: readonly LocalDayCutoffCase[] = [
  {
    timeZone: "UTC",
    now: "2026-10-18T00:00:00.000Z",
    startOfTomorrow: "2026-10-19T00:00:00.000Z",
  },
  {
    timeZone: "UTC",
    now: "2026-10-18T23:59:59.999Z",
    startOfTomorrow: "2026-10-19T00:00:00.000Z",
  },
  {
    timeZone: "America/Bogota",
    now: "2026-10-18T20:00:00.000Z",
    startOfTomorrow: "2026-10-19T05:00:00.000Z",
  },
  {
    timeZone: "America/Bogota",
    now: "2026-10-19T04:59:59.999Z",
    startOfTomorrow: "2026-10-19T05:00:00.000Z",
  },
  {
    timeZone: "America/Bogota",
    now: "2026-10-19T05:00:00.000Z",
    startOfTomorrow: "2026-10-20T05:00:00.000Z",
  },
  // Santiago: 6 Sep 2026 starts at 01:00 (-03); 5 Apr 2026 repeats 23:00.
  {
    timeZone: "America/Santiago",
    now: "2026-09-05T15:00:00.000Z",
    startOfTomorrow: "2026-09-06T04:00:00.000Z",
  },
  {
    timeZone: "America/Santiago",
    now: "2026-09-06T04:30:00.000Z",
    startOfTomorrow: "2026-09-07T03:00:00.000Z",
  },
  {
    timeZone: "America/Santiago",
    now: "2026-04-04T15:00:00.000Z",
    startOfTomorrow: "2026-04-05T04:00:00.000Z",
  },
  {
    timeZone: "America/Santiago",
    now: "2026-04-05T03:30:00.000Z",
    startOfTomorrow: "2026-04-05T04:00:00.000Z",
  },
  // Havana: 8 Mar 2026 starts at 01:00 (-04); 1 Nov 2026 01:00 -> 00:00.
  {
    timeZone: "America/Havana",
    now: "2026-03-07T20:00:00.000Z",
    startOfTomorrow: "2026-03-08T05:00:00.000Z",
  },
  {
    timeZone: "America/Havana",
    now: "2026-03-08T06:00:00.000Z",
    startOfTomorrow: "2026-03-09T04:00:00.000Z",
  },
  {
    timeZone: "America/Havana",
    now: "2026-10-31T20:00:00.000Z",
    startOfTomorrow: "2026-11-01T04:00:00.000Z",
  },
  {
    timeZone: "America/Havana",
    now: "2026-11-01T04:30:00.000Z",
    startOfTomorrow: "2026-11-02T05:00:00.000Z",
  },
  // Madrid: 29 Mar 2026 02:00 -> 03:00; 25 Oct 2026 03:00 -> 02:00.
  {
    timeZone: "Europe/Madrid",
    now: "2026-03-28T20:00:00.000Z",
    startOfTomorrow: "2026-03-28T23:00:00.000Z",
  },
  {
    timeZone: "Europe/Madrid",
    now: "2026-03-29T01:30:00.000Z",
    startOfTomorrow: "2026-03-29T22:00:00.000Z",
  },
  {
    timeZone: "Europe/Madrid",
    now: "2026-10-24T21:30:00.000Z",
    startOfTomorrow: "2026-10-24T22:00:00.000Z",
  },
  {
    timeZone: "Europe/Madrid",
    now: "2026-10-25T01:30:00.000Z",
    startOfTomorrow: "2026-10-25T23:00:00.000Z",
  },
  // Apia: +13 today; 30 Dec 2011 was skipped (-10 -> +14).
  {
    timeZone: "Pacific/Apia",
    now: "2026-10-18T12:00:00.000Z",
    startOfTomorrow: "2026-10-19T11:00:00.000Z",
  },
  {
    timeZone: "Pacific/Apia",
    now: "2011-12-29T12:00:00.000Z",
    startOfTomorrow: "2011-12-30T10:00:00.000Z",
  },
  {
    timeZone: "Pacific/Apia",
    now: "2011-12-30T10:00:00.000Z",
    startOfTomorrow: "2011-12-31T10:00:00.000Z",
  },
];
