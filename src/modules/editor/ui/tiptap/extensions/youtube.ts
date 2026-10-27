// document-import T3: YouTube embeds (content catalogue `youtube`).
// Rendering only: no slash item, toolbar or paste handler yet.
//
// node_modules/@tiptap/extension-youtube (3.31.3) attrs: src (default
// null), start (seconds, default 0), width (640) and height (480). Its
// renderHTML builds a youtube-nocookie embed URL from a watch URL when
// `nocookie: true`, but returns any `/embed/` URL untouched, which would
// load www.youtube.com (outside the CSP `frame-src`) and drop `start`. So
// an embed src is turned back into its watch URL before rendering, and the
// iframe always comes from https://www.youtube-nocookie.com.
import Youtube, {
  getAttributesFromYoutubeEmbedUrl,
} from "@tiptap/extension-youtube";

function toWatchUrl(src: unknown): unknown {
  if (typeof src !== "string" || !src.includes("/embed/")) return src;
  return getAttributesFromYoutubeEmbedUrl(src)?.src ?? null;
}

export const CogniYoutube = Youtube.extend({
  renderHTML(props) {
    const HTMLAttributes = {
      ...props.HTMLAttributes,
      src: toWatchUrl(props.HTMLAttributes.src),
    };
    return this.parent?.({ ...props, HTMLAttributes }) ?? ["div"];
  },
}).configure({
  nocookie: true,
  autoplay: false,
  // No UI inserts videos yet; pasting a link must not create an embed.
  addPasteHandler: false,
});
