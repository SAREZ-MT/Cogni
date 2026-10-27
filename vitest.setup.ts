import "@testing-library/jest-dom/vitest";

// Files that opt into `// @vitest-environment node` (e.g. the PDF adapter
// tests, which need officeparser's Node path) have no DOM to stub.
if (typeof document !== "undefined") {
  // jsdom does not implement layout/hit-testing APIs that ProseMirror (used
  // by the Tiptap-backed editor, src/modules/editor/ui/tiptap) relies on for
  // cursor positioning and scroll-into-view. These are safe no-op stubs: they
  // let ProseMirror's view code run without throwing in jsdom, and have no
  // effect on tests that don't render a Tiptap editor.
  if (typeof document.elementFromPoint !== "function") {
    document.elementFromPoint = () => null;
  }
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
  if (typeof Range.prototype.getClientRects !== "function") {
    Range.prototype.getClientRects = () =>
      ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      }) as unknown as DOMRectList;
  }
  // jsdom does not implement ResizeObserver either, which cmdk (shadcn's
  // `command` primitive, used by editor/ui/command-menu.tsx) relies on to
  // measure its list. A no-op stub is enough for tests: layout math itself
  // is not under test.
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver =
      ResizeObserverStub as unknown as typeof ResizeObserver;
  }

  if (typeof Range.prototype.getBoundingClientRect !== "function") {
    Range.prototype.getBoundingClientRect = () =>
      ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => "",
      }) as DOMRect;
  }
}
