// A page that holds at least one study item, with the single owner of its
// items and when its PageMastery was last computed (null: never).
export interface StudiedPage {
  readonly pageId: string;
  readonly ownerId: string;
  // Millisecond precision, so it round-trips as a keyset cursor.
  readonly masteryComputedAt: Date | null;
}

export interface StalePagesQuery {
  // Only pages whose mastery is missing or was computed strictly before
  // this instant (the job's run start): a page the run already rewrote
  // never comes back in the same run.
  readonly staleBefore: Date;
  // The last page of the previous batch; null for the first batch.
  readonly after: StudiedPage | null;
  readonly limit: number;
}

// Cross-owner listing for the daily mastery job (/api/recompute-mastery),
// which runs without a user session. It is the only port that is not
// owner-scoped: it returns ids only, never item or page content, and no
// user-facing path may use it.
export interface StudiedPageReader {
  // Stale pages with at least one study item (suspended ones included),
  // each once, oldest mastery first: pages without mastery, then by
  // masteryComputedAt, ties by pageId. Keyset pagination on that unique
  // (masteryComputedAt, pageId) key, strictly after `after`, at most
  // `limit` pages. A page has a single owner; a page whose items disagree
  // on the owner breaks that invariant and is never listed.
  listStalePages(query: StalePagesQuery): Promise<StudiedPage[]>;
}
