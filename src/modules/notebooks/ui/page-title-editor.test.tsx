import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageTitleEditor } from "./page-title-editor";

const { renamePage } = vi.hoisted(() => ({
  renamePage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../actions", () => ({ renamePage }));

function input() {
  return screen.getByRole("textbox", {
    name: "Título de la página",
  }) as HTMLTextAreaElement;
}

function type(value: string) {
  fireEvent.change(input(), { target: { value } });
}

// Lets the promise chain after `renamePage` settle under fake timers.
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("PageTitleEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renamePage.mockReset();
    renamePage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("shows the initial title with the muted placeholder as fallback", () => {
    render(<PageTitleEditor pageId="p1" initialTitle="Mitosis" />);
    expect(input().value).toBe("Mitosis");
    expect(input().placeholder).toBe("Sin título");
  });

  it("starts empty for a page that still has the default title, so typing does not append to it", () => {
    render(<PageTitleEditor pageId="p1" initialTitle="Sin título" />);
    expect(input().value).toBe("");
    expect(input().placeholder).toBe("Sin título");
  });

  it("does not save the default title back and saves a real one typed over it", async () => {
    render(<PageTitleEditor pageId="p1" initialTitle="Sin título" />);

    type("Sin título");
    fireEvent.blur(input());
    await settle();
    expect(renamePage).not.toHaveBeenCalled();

    type("Mitosis");
    fireEvent.blur(input());
    await settle();
    expect(renamePage).toHaveBeenCalledExactlyOnceWith({
      pageId: "p1",
      title: "Mitosis",
    });
  });

  it("saves the trimmed title once typing pauses for 600 ms", async () => {
    const onSaved = vi.fn();
    render(<PageTitleEditor pageId="p1" initialTitle="" onSaved={onSaved} />);

    type("  Meiosis ");
    act(() => vi.advanceTimersByTime(599));
    expect(renamePage).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    await settle();

    expect(renamePage).toHaveBeenCalledExactlyOnceWith({
      pageId: "p1",
      title: "Meiosis",
    });
    expect(onSaved).toHaveBeenCalledWith("Meiosis");
  });

  it("debounces rapid keystrokes into a single save of the last value", async () => {
    render(<PageTitleEditor pageId="p1" initialTitle="" />);

    type("M");
    act(() => vi.advanceTimersByTime(300));
    type("Mi");
    act(() => vi.advanceTimersByTime(300));
    type("Mit");
    act(() => vi.advanceTimersByTime(600));
    await settle();

    expect(renamePage).toHaveBeenCalledExactlyOnceWith({
      pageId: "p1",
      title: "Mit",
    });
  });

  it("flushes a pending save immediately on blur", async () => {
    render(<PageTitleEditor pageId="p1" initialTitle="" />);

    type("Nueva");
    fireEvent.blur(input());
    await settle();

    expect(renamePage).toHaveBeenCalledExactlyOnceWith({
      pageId: "p1",
      title: "Nueva",
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(renamePage).toHaveBeenCalledTimes(1);
  });

  it("never saves an empty title nor an unchanged one", async () => {
    render(<PageTitleEditor pageId="p1" initialTitle="Mitosis" />);

    type("   ");
    fireEvent.blur(input());
    type("  Mitosis  ");
    fireEvent.blur(input());
    await settle();

    expect(renamePage).not.toHaveBeenCalled();
  });

  it("skips a save when the text is edited back to the last saved title", async () => {
    render(<PageTitleEditor pageId="p1" initialTitle="" />);

    type("A");
    fireEvent.blur(input());
    await settle();
    expect(renamePage).toHaveBeenCalledTimes(1);

    type("B");
    type("A");
    fireEvent.blur(input());
    await settle();

    expect(renamePage).toHaveBeenCalledTimes(1);
  });

  it("strips newlines from a pasted title", () => {
    render(<PageTitleEditor pageId="p1" initialTitle="" />);
    type("Línea uno\nlínea dos");
    expect(input().value).toBe("Línea unolínea dos");
  });

  it("on Enter saves right away, keeps the title single-line and focuses the editor", async () => {
    const editorRoot = document.createElement("div");
    editorRoot.dataset.testid = "editor-content";
    const prose = document.createElement("div");
    prose.className = "ProseMirror";
    prose.tabIndex = 0;
    editorRoot.append(prose);
    document.body.append(editorRoot);

    render(<PageTitleEditor pageId="p1" initialTitle="" />);
    type("Título");

    const notPrevented = fireEvent.keyDown(input(), { key: "Enter" });
    await settle();

    expect(notPrevented).toBe(false);
    expect(renamePage).toHaveBeenCalledExactlyOnceWith({
      pageId: "p1",
      title: "Título",
    });
    expect(document.activeElement).toBe(prose);
  });

  it("ignores other keys", () => {
    render(<PageTitleEditor pageId="p1" initialTitle="" />);
    type("Algo");
    const notPrevented = fireEvent.keyDown(input(), { key: "a" });
    expect(notPrevented).toBe(true);
    expect(renamePage).not.toHaveBeenCalled();
  });

  it("does not report a failed save and saves again on the next edit", async () => {
    const onSaved = vi.fn();
    renamePage.mockRejectedValueOnce(new Error("boom"));
    render(<PageTitleEditor pageId="p1" initialTitle="" onSaved={onSaved} />);

    type("Reintento");
    fireEvent.blur(input());
    await settle();
    expect(onSaved).not.toHaveBeenCalled();

    type("Reintento 2");
    fireEvent.blur(input());
    await settle();

    expect(renamePage).toHaveBeenCalledTimes(2);
    expect(renamePage).toHaveBeenLastCalledWith({
      pageId: "p1",
      title: "Reintento 2",
    });
    expect(onSaved).toHaveBeenCalledExactlyOnceWith("Reintento 2");
  });

  it("flushes a pending save when it unmounts mid-debounce", async () => {
    const { unmount } = render(<PageTitleEditor pageId="p1" initialTitle="" />);

    type("Adiós");
    unmount();
    await settle();

    expect(renamePage).toHaveBeenCalledExactlyOnceWith({
      pageId: "p1",
      title: "Adiós",
    });
  });

  it("follows a new initialTitle from the server", () => {
    const { rerender } = render(
      <PageTitleEditor pageId="p1" initialTitle="Uno" />,
    );
    rerender(<PageTitleEditor pageId="p1" initialTitle="Dos" />);
    expect(input().value).toBe("Dos");
  });
});
