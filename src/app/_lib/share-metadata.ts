import type { Metadata } from "next";

// Link previews (WhatsApp, iMessage, LinkedIn, X, Slack). Next.js merges
// metadata shallowly, so a page that sets its own `openGraph` or `twitter`
// replaces the root ones whole: pages spread these base objects and only
// change the title and description. The image is declared here instead of
// through the `opengraph-image` file convention, because a page-level
// `openGraph` drops the image a parent segment's file provides. It lives in
// public/ (the proxy matcher skips .jpg) at 1200x630 and under 300 KB, so
// WhatsApp shows the large card.

export const SITE_NAME = "Cogni";

const SHARE_IMAGE = {
  url: "/og/cogni-share.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: 'Logo de Cogni sobre una red de conceptos violeta con el lema "Lo que estudias, se queda."',
};

export function shareMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  /** Canonical path; omit at the root so child routes do not inherit it. */
  path?: string;
}): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
  return {
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "es_CO",
      ...(path ? { url: path } : {}),
      title,
      description,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SHARE_IMAGE],
    },
  };
}
