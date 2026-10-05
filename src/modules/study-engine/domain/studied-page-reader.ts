// A page that holds at least one study item, with the owner of its items.
export interface StudiedPage {
  readonly pageId: string;
  readonly ownerId: string;
}

// Cross-owner listing for the daily mastery job (/api/recompute-mastery),
// which runs without a user session. It is the only port that is not
// owner-scoped: it returns ids only, never item or page content, and no
// user-facing path may use it.
export interface StudiedPageReader {
  // Pages with at least one study item (suspended ones included), each
  // once, ordered by pageId and strictly after `afterPageId` when given, at
  // most `limit` of them. Keyset pagination: pass the last pageId of a
  // batch to read the next one.
  listStudiedPages(
    afterPageId: string | null,
    limit: number,
  ): Promise<StudiedPage[]>;
}
