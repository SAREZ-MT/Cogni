import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const { generateFlashcardsAction } = vi.hoisted(() => ({
  generateFlashcardsAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({ generateFlashcardsAction }));
const { generateRecallQuestionsAction } = vi.hoisted(() => ({
  generateRecallQuestionsAction: vi.fn(),
}));
vi.mock("@/modules/active-recall", () => ({ generateRecallQuestionsAction }));

import type { PagePickerNotebook } from "@/shared/ui/page-picker";
import { chooseOption } from "@/shared/ui/select.testing";
import { CreateFromPageDialog } from "./create-from-page-dialog";

const NOTEBOOKS: PagePickerNotebook[] = [
  {
    id: "nb-bio",
    title: "Biología",
    pages: [
      { id: "p-1", title: "Tema 1" },
      { id: "p-2", title: "Tema 2" },
    ],
  },
  { id: "nb-empty", title: "Vacío", pages: [] },
];

type Props = React.ComponentProps<typeof CreateFromPageDialog>;

async function open(props: Partial<Props> = {}) {
  const user = userEvent.setup();
  const all: Props = {
    technique: "flashcards",
    notebooks: NOTEBOOKS,
    remaining: 5,
    trigger: "cta",
    ...props,
  } as Props;
  render(<CreateFromPageDialog {...all} />);
  const name =
    all.technique === "flashcards"
      ? all.trigger === "cta"
        ? "Crear mis primeras flashcards"
        : "Crear flashcards"
      : all.trigger === "cta"
        ? "Generar mis primeras preguntas"
        : "Generar preguntas";
  await user.click(screen.getByRole("button", { name }));
  const dialog = screen.getByRole("dialog");
  return { user, dialog };
}

async function pickPage(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  pageTitle = "Tema 2",
) {
  await chooseOption(
    user,
    within(dialog).getByRole("combobox", { name: "Página" }),
    pageTitle,
  );
}

// Phase 8 H11 (user-approved flow, 2026-10-29): every flashcard and recall
// question belongs to a page, so the hubs create them through a "pick a
// page" dialog that reuses the techniques panel's Server Actions.
describe("CreateFromPageDialog — flashcards", () => {
  beforeEach(() => {
    push.mockReset();
    generateFlashcardsAction.mockReset();
    generateRecallQuestionsAction.mockReset();
  });

  it("opens from the empty-state CTA and only offers to generate with AI once a page is chosen", async () => {
    const { user, dialog } = await open();

    expect(
      within(dialog).getByRole("heading", { name: "Crear flashcards" }),
    ).toBeInTheDocument();
    const submit = within(dialog).getByTestId("create-flashcards-submit");
    expect(submit).toBeDisabled();
    expect(
      within(dialog).getByText("Te quedan 5 generaciones hoy"),
    ).toBeInTheDocument();

    await pickPage(user, dialog);
    expect(submit).toBeEnabled();
    expect(submit).toHaveTextContent("Generar");
  });

  // Phase 8 H12: the technique's theme, pixel tile and primary colour.
  it("wears the flashcards theme: pixel tile, amber Generar, outline Cancelar", async () => {
    const { dialog } = await open();

    expect(dialog).toHaveAttribute("data-technique-theme", "flashcards");
    expect(
      dialog.querySelector(
        '[data-slot="dialog-header-icon"] [data-slot="pixel-tile"]',
      ),
    ).toHaveAttribute("data-tone", "yellow");
    expect(
      within(dialog).getByTestId("create-flashcards-submit"),
    ).toHaveAttribute("data-variant", "technique");
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    ).toHaveAttribute("data-variant", "outline");
  });

  // Phase 8 H12 (user 2026-10-29): the hub dialogs are AI only; "Nueva
  // tarjeta" on an existing deck stays the manual path.
  it("never offers to create the cards by hand", async () => {
    const { user, dialog } = await open({ trigger: "tile" });
    await pickPage(user, dialog, "Tema 1");

    expect(within(dialog).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Crear a mano/)).not.toBeInTheDocument();
    expect(
      within(dialog).getByTestId("create-flashcards-submit"),
    ).toHaveTextContent("Generar");
  });

  it("generates with AI for the chosen page and opens its deck", async () => {
    generateFlashcardsAction.mockResolvedValue({
      ok: true,
      value: { cards: [], remainingToday: 4, truncated: false, wordsUsed: 1 },
    });
    const { user, dialog } = await open();
    await pickPage(user, dialog);

    await user.click(within(dialog).getByTestId("create-flashcards-submit"));

    expect(generateFlashcardsAction).toHaveBeenCalledWith({ pageId: "p-2" });
    expect(push).toHaveBeenCalledWith("/flashcards/nb-bio/p-2");
  });

  it("explains an empty page and offers to open it", async () => {
    generateFlashcardsAction.mockResolvedValue({
      ok: false,
      error: { code: "AI_PAGE_EMPTY", message: "x" },
    });
    const { user, dialog } = await open();
    await pickPage(user, dialog);

    await user.click(within(dialog).getByTestId("create-flashcards-submit"));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "La página está vacía: escribe algo antes de generar.",
    );
    expect(
      within(dialog).getByRole("link", { name: "Abrir la página" }),
    ).toHaveAttribute("href", "/notebooks/nb-bio/pages/p-2");
    expect(push).not.toHaveBeenCalled();
  });

  it("says there is nothing new to generate as a notice", async () => {
    generateFlashcardsAction.mockResolvedValue({
      ok: false,
      error: { code: "FLASHCARDS_NO_NEW_CONTENT", message: "x" },
    });
    const { user, dialog } = await open();
    await pickPage(user, dialog);

    await user.click(within(dialog).getByTestId("create-flashcards-submit"));

    expect(
      await within(dialog).findByTestId("create-flashcards-notice"),
    ).toHaveTextContent("No hay contenido nuevo para generar");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("blocks generation once the daily limit is reached", async () => {
    const { user, dialog } = await open({ remaining: 0 });
    await pickPage(user, dialog);

    expect(
      within(dialog).getByText("Llegaste al límite de hoy. Vuelve mañana."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByTestId("create-flashcards-submit"),
    ).toBeDisabled();
  });

  it("drops to zero remaining when the action reports the limit", async () => {
    generateFlashcardsAction.mockResolvedValue({
      ok: false,
      error: { code: "AI_DAILY_LIMIT_REACHED", message: "x" },
    });
    const { user, dialog } = await open();
    await pickPage(user, dialog);

    await user.click(within(dialog).getByTestId("create-flashcards-submit"));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Llegaste al límite de hoy. Vuelve mañana.",
    );
    expect(
      within(dialog).getByTestId("create-flashcards-submit"),
    ).toBeDisabled();
  });

  it("offers to create a notebook when there are none", async () => {
    const { dialog } = await open({ notebooks: [] });

    expect(
      within(dialog).getByRole("link", { name: "Crear un cuaderno" }),
    ).toHaveAttribute("href", "/notebooks");
    expect(
      within(dialog).getByTestId("create-flashcards-submit"),
    ).toBeDisabled();
  });

  it("offers to create a page in a notebook without pages", async () => {
    const { user, dialog } = await open();

    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Cuaderno" }),
      "Vacío",
    );

    expect(
      within(dialog).getByRole("link", { name: "Crear una página" }),
    ).toHaveAttribute("href", "/notebooks/nb-empty");
    expect(
      within(dialog).getByTestId("create-flashcards-submit"),
    ).toBeDisabled();
  });
});

describe("CreateFromPageDialog — active recall", () => {
  beforeEach(() => {
    push.mockReset();
    generateFlashcardsAction.mockReset();
    generateRecallQuestionsAction.mockReset();
  });

  it("only generates with AI (recall questions are never written by hand)", async () => {
    const { dialog } = await open({ technique: "recall" });

    expect(
      within(dialog).getByRole("heading", { name: "Generar preguntas" }),
    ).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-technique-theme", "recall");
    expect(dialog.querySelector('[data-slot="pixel-tile"]')).toHaveAttribute(
      "data-tone",
      "green",
    );
    expect(within(dialog).getByTestId("create-recall-submit")).toHaveAttribute(
      "data-variant",
      "technique",
    );
    expect(within(dialog).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Crear a mano")).not.toBeInTheDocument();
    expect(
      within(dialog).getByText("Te quedan 5 generaciones hoy"),
    ).toBeInTheDocument();
  });

  it("generates the questions for the chosen page and opens its session", async () => {
    generateRecallQuestionsAction.mockResolvedValue({
      ok: true,
      value: { questions: [], created: 5, remainingToday: 4 },
    });
    const { user, dialog } = await open({
      technique: "recall",
      trigger: "tile",
    });
    await pickPage(user, dialog, "Tema 1");

    await user.click(within(dialog).getByTestId("create-recall-submit"));

    expect(generateRecallQuestionsAction).toHaveBeenCalledWith({
      pageId: "p-1",
    });
    expect(push).toHaveBeenCalledWith("/active-recall/nb-bio/p-1");
  });

  it("explains an empty page and offers to open it", async () => {
    generateRecallQuestionsAction.mockResolvedValue({
      ok: false,
      error: { code: "AI_PAGE_EMPTY", message: "x" },
    });
    const { user, dialog } = await open({ technique: "recall" });
    await pickPage(user, dialog);

    await user.click(within(dialog).getByTestId("create-recall-submit"));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "La página está vacía: escribe algo antes de generar.",
    );
    expect(
      within(dialog).getByRole("link", { name: "Abrir la página" }),
    ).toHaveAttribute("href", "/notebooks/nb-bio/pages/p-2");
  });
});
