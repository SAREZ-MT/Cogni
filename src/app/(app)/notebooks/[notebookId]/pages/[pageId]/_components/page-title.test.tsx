import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Breadcrumb,
  BreadcrumbProvider,
  SetBreadcrumb,
} from "../../../../../_components/breadcrumb";
import { PageTitle } from "./page-title";

// Spies on SetBreadcrumb while keeping its real behavior.
vi.mock("../../../../../_components/breadcrumb", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../../../_components/breadcrumb")
    >();
  return { ...actual, SetBreadcrumb: vi.fn(actual.SetBreadcrumb) };
});

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// The editor's own behaviour is covered by page-title-editor.test.tsx; here
// only the bridge (breadcrumb + refresh on save) is under test.
const { capture } = vi.hoisted(() => ({
  capture: { onSaved: undefined as ((title: string) => void) | undefined },
}));
vi.mock("@/modules/notebooks/ui/page-title-editor", () => ({
  PageTitleEditor: (props: {
    pageId: string;
    initialTitle: string;
    onSaved: (title: string) => void;
  }) => {
    capture.onSaved = props.onSaved;
    return <div data-testid="title-editor">{props.pageId}</div>;
  },
}));

function renderTitle(props: {
  initialTitle: string;
  notebookTitle: string | null;
}) {
  return render(
    <BreadcrumbProvider>
      <Breadcrumb />
      <PageTitle pageId="p1" {...props} />
    </BreadcrumbProvider>,
  );
}

function trail() {
  return screen
    .getAllByRole("listitem")
    .map((item) => item.textContent?.replace("›", "").trim());
}

describe("PageTitle", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it("publishes notebook › page as the breadcrumb and mounts the title editor for the page", () => {
    renderTitle({ initialTitle: "Mitosis", notebookTitle: "Biología" });

    expect(trail()).toEqual(["Cogni", "Biología", "Mitosis"]);
    expect(screen.getByTestId("title-editor")).toHaveTextContent("p1");
  });

  it("omits the notebook crumb when the notebook title is unknown", () => {
    renderTitle({ initialTitle: "Mitosis", notebookTitle: null });
    expect(trail()).toEqual(["Cogni", "Mitosis"]);
  });

  it("falls back to 'Sin título' for a blank title", () => {
    renderTitle({ initialTitle: "   ", notebookTitle: "Biología" });
    expect(trail()).toEqual(["Cogni", "Biología", "Sin título"]);
  });

  it("updates the crumb and refreshes the router after a successful save", () => {
    renderTitle({ initialTitle: "Mitosis", notebookTitle: "Biología" });

    act(() => capture.onSaved?.("Meiosis"));

    expect(trail()).toEqual(["Cogni", "Biología", "Meiosis"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // Regression ("Maximum update depth exceeded"): a new array literal on every
  // render re-ran SetBreadcrumb's publish effect forever.
  it("hands SetBreadcrumb the same array across renders that do not change the trail", () => {
    vi.mocked(SetBreadcrumb).mockClear();
    const view = renderTitle({
      initialTitle: "Mitosis",
      notebookTitle: "Biología",
    });

    view.rerender(
      <BreadcrumbProvider>
        <Breadcrumb />
        <PageTitle
          pageId="p1"
          initialTitle="Mitosis"
          notebookTitle="Biología"
        />
      </BreadcrumbProvider>,
    );

    const arrays = new Set(
      vi.mocked(SetBreadcrumb).mock.calls.map(([props]) => props.items),
    );
    expect(vi.mocked(SetBreadcrumb).mock.calls.length).toBeGreaterThan(1);
    expect(arrays.size).toBe(1);
  });
});
