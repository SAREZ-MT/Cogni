"use client";

import { useEffect, useState } from "react";

// The page's current word count, from the editor to the techniques panel
// (Phase 8 H14): PageEditor publishes it when it mounts and after each
// save, and the panel follows. A window event keeps the two client
// components, rendered apart by the page route, decoupled (no shared
// provider around a portal); the last count per page is also kept here, so
// a panel that subscribes after the editor published still reads it.
const EVENT = "cogni:page-words";

interface PageWordsDetail {
  pageId: string;
  words: number;
}

const latest = new Map<string, number>();

export function publishPageWords(pageId: string, words: number): void {
  latest.set(pageId, words);
  window.dispatchEvent(
    new CustomEvent<PageWordsDetail>(EVENT, { detail: { pageId, words } }),
  );
}

// Drops every kept count (tests: each one starts from a fresh page).
export function forgetPageWords(): void {
  latest.clear();
}

// `initial` is a count known up front; undefined while unknown.
export function usePageWords(
  pageId: string,
  initial: number | undefined,
): number | undefined {
  const [words, setWords] = useState(() => latest.get(pageId) ?? initial);
  useEffect(() => {
    const known = latest.get(pageId);
    if (known !== undefined) setWords(known);
    function onWords(event: Event) {
      const detail = (event as CustomEvent<PageWordsDetail>).detail;
      if (detail?.pageId === pageId) setWords(detail.words);
    }
    window.addEventListener(EVENT, onWords);
    return () => window.removeEventListener(EVENT, onWords);
  }, [pageId]);
  return words;
}
