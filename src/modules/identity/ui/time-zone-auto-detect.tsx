"use client";

import { useEffect, useRef } from "react";
import { adoptBrowserTimeZoneAction } from "../actions";
import { browserTimeZone } from "./browser-time-zone";

// First-use detection (Phase 7 T2a): the (app) layout mounts this only
// while the profile has never chosen a time zone. It reports the browser's
// IANA zone once; the server saves it only if the profile is still unset,
// so nobody silently stays on UTC and an explicit choice always wins. It
// renders nothing and never refreshes the page: the zone applies from the
// next server render (first visits land on Home, whose dates do not depend
// on it).
export function TimeZoneAutoDetect() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const detected = browserTimeZone();
    if (!detected) return;
    adoptBrowserTimeZoneAction(detected).catch(() => {
      // Best effort: the next hard load retries while the zone is unset.
    });
  }, []);

  return null;
}
