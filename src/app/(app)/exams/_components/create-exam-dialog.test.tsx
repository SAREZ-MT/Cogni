import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
const { generateExamQuestionsAction } = vi.hoisted(() => ({
  generateExamQuestionsAction: vi.fn(),
}));
vi.mock("@/modules/exams", () => ({
  EXAM_DEFAULT_QUESTIONS: 10,
  EXAM_MAX_QUESTIONS: 30,
  EXAM_MIN_QUESTIONS: 10,
  generateExamQuestionsAction,
}));

import { chooseOption } from "@/shared/ui/select.testing";
import {
  CreateExamDialog,
  type CreateExamNotebook,
} from "./create-exam-dialog";

const NOTEBOOKS: CreateExamNotebook[] = [
  {
    id: "nb-bio",
    title: "Biología",
    pages: [
      { id: "p-mito", title: "Mitocondria" },
      { id: "p-ribo", title: "Ribosomas" },
    ],
  },
  {
    id: "nb-calc",
    title: "Cálculo",
    pages: [{ id: "p-der", title: "Derivadas" }],
  },
  { id: "nb-empty", title: "Vacío", pages: [] },
];

function generated(created = 10) {
  return {
    ok: true,
    value: {
      questions: [],
      created,
      skipped: 0,
      remainingToday: 4,
      truncated: false,
      wordsUsed: 10,
      wordsTotal: 10,
    },
  };
}

async function open(
  props: Partial<React.ComponentProps<typeof CreateExamDialog>> = {},
) {
  const user = userEvent.setup();
  render(<CreateExamDialog notebooks={NOTEBOOKS} {...props} />);
  await user.click(screen.getByRole("button", { name: "Crear examen" }));
  return {
    user,
    dialog: screen.getByRole("dialog", { name: "Crear examen" }),
  };
}

describe("CreateExamDialog", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    generateExamQuestionsAction.mockReset();
  });

  it("opens from the 'Crear examen' button with the first notebook and no page chosen", async () => {
    const { user, dialog } = await open();

    expect(
      within(dialog).getByRole("combobox", { name: "Cuaderno" }),
    ).toHaveTextContent("Biología");
    const page = within(dialog).getByRole("combobox", { name: "Página" });
    expect(page).toHaveTextContent("Elige una página");
    page.focus();
    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Mitocondria",
      "Ribosomas",
    ]);
    await user.keyboard("{Escape}");
    // A page is mandatory: the exam belongs to a page (SM-2).
    expect(within(dialog).getByTestId("create-exam-submit")).toBeDisabled();
  });

  // Phase 8 H12: the exams theme (rose) and its pixel tile.
  it("wears the exams theme: pixel tile and rose Generar", async () => {
    const { dialog } = await open();

    expect(dialog).toHaveAttribute("data-technique-theme", "exams");
    expect(dialog.querySelector('[data-slot="pixel-tile"]')).toHaveAttribute(
      "data-tone",
      "rose",
    );
    expect(within(dialog).getByTestId("create-exam-submit")).toHaveAttribute(
      "data-variant",
      "technique",
    );
    expect(
      within(dialog).getByRole("group", { name: "Preguntas a generar" }),
    ).toHaveAttribute("data-size", "field");
  });

  it("preselects the given notebook", async () => {
    const { user, dialog } = await open({ initialNotebookId: "nb-calc" });

    expect(
      within(dialog).getByRole("combobox", { name: "Cuaderno" }),
    ).toHaveTextContent("Cálculo");
    within(dialog).getByRole("combobox", { name: "Página" }).focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("option", { name: "Derivadas" }),
    ).toBeInTheDocument();
  });

  it("clears the page when the notebook changes", async () => {
    const { user, dialog } = await open();
    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Página" }),
      "Ribosomas",
    );

    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Cuaderno" }),
      "Cálculo",
    );

    expect(
      within(dialog).getByRole("combobox", { name: "Página" }),
    ).toHaveTextContent("Elige una página");
  });

  it("generates with AI: count 10–30 in steps of 5, then opens the notebook's exams", async () => {
    generateExamQuestionsAction.mockResolvedValue(generated(15));
    const { user, dialog } = await open();
    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Página" }),
      "Ribosomas",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Más preguntas a generar" }),
    );
    expect(within(dialog).getByTestId("exam-count-value")).toHaveTextContent(
      "15",
    );

    await user.click(within(dialog).getByTestId("create-exam-submit"));

    expect(generateExamQuestionsAction).toHaveBeenCalledWith({
      pageId: "p-ribo",
      count: 15,
    });
    expect(push).toHaveBeenCalledWith("/exams/nb-bio");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows 'Generando…' while the questions are generated", async () => {
    let resolve: (value: unknown) => void = () => {};
    generateExamQuestionsAction.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { user, dialog } = await open();
    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Página" }),
      "Mitocondria",
    );

    await user.click(within(dialog).getByTestId("create-exam-submit"));

    const submit = within(dialog).getByTestId("create-exam-submit");
    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent("Generando…");
    await act(async () => resolve(generated()));
  });

  it.each([
    ["AI_DAILY_LIMIT_REACHED", "Llegaste al límite de hoy. Vuelve mañana."],
    ["AI_PAGE_EMPTY", "La página está vacía: escribe algo antes de generar."],
    ["EXAMS_SESSION_REQUIRED", "Tu sesión expiró. Inicia sesión de nuevo."],
    [
      "AI_GENERATION_FAILED",
      "No pudimos generar las preguntas. Intenta de nuevo.",
    ],
  ])("keeps the dialog open and explains %s", async (code, message) => {
    generateExamQuestionsAction.mockResolvedValue({
      ok: false,
      error: { code, message: "x" },
    });
    const { user, dialog } = await open();
    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Página" }),
      "Mitocondria",
    );

    await user.click(within(dialog).getByTestId("create-exam-submit"));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
    expect(push).not.toHaveBeenCalled();
  });

  it("reports a rejected generation instead of throwing", async () => {
    generateExamQuestionsAction.mockRejectedValue(new Error("offline"));
    const { user, dialog } = await open();
    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Página" }),
      "Mitocondria",
    );

    await user.click(within(dialog).getByTestId("create-exam-submit"));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "No pudimos generar las preguntas. Intenta de nuevo.",
    );
  });

  // Phase 8 H12 (user 2026-10-29): the create dialog is AI only; "Nueva
  // pregunta" on the page's questions screen stays the manual path.
  it("never offers to write the questions by hand", async () => {
    const { user, dialog } = await open();
    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Página" }),
      "Mitocondria",
    );

    expect(within(dialog).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(/Crear mis preguntas/),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("group", { name: "Preguntas a generar" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("create-exam-submit")).toHaveTextContent(
      "Generar",
    );
  });

  it("explains a notebook without pages and keeps the submit disabled", async () => {
    const { dialog } = await open({ initialNotebookId: "nb-empty" });

    expect(
      within(dialog).getByText("Este cuaderno aún no tiene páginas."),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("combobox", { name: "Página" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByTestId("create-exam-submit")).toBeDisabled();
  });

  it("explains that there are no notebooks yet", async () => {
    const { dialog } = await open({ notebooks: [] });

    expect(
      within(dialog).getByText(
        "Aún no tienes cuadernos. Crea uno para empezar.",
      ),
    ).toBeInTheDocument();
    // Phase 8 H11: no longer a dead end.
    expect(
      within(dialog).getByRole("link", { name: "Crear un cuaderno" }),
    ).toHaveAttribute("href", "/notebooks");
    expect(within(dialog).getByTestId("create-exam-submit")).toBeDisabled();
  });

  // Phase 8 H11: the exams hub's empty-state CTA and first grid tile open
  // the same dialog.
  it.each([
    ["cta", "Crear mi primer examen"],
    ["tile", "Crear examen"],
  ] as const)("opens from the %s trigger", async (trigger, name) => {
    const user = userEvent.setup();
    render(<CreateExamDialog notebooks={NOTEBOOKS} trigger={trigger} />);
    const button = screen.getByRole("button", { name });
    if (trigger === "tile") {
      expect(button).toHaveClass("border-dashed");
    } else {
      expect(button).toHaveClass("technique-cta");
    }
    expect(button).toHaveAttribute("data-testid", `create-exam-${trigger}`);

    await user.click(button);

    expect(
      screen.getByRole("dialog", { name: "Crear examen" }),
    ).toBeInTheDocument();
  });

  it("says there is nothing new to generate as a notice, keeping the dialog open", async () => {
    generateExamQuestionsAction.mockResolvedValue({
      ok: false,
      error: { code: "EXAMS_NO_NEW_CONTENT", message: "x" },
    });
    const { user, dialog } = await open();
    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Página" }),
      "Mitocondria",
    );

    await user.click(within(dialog).getByTestId("create-exam-submit"));

    expect(
      await within(dialog).findByTestId("create-exam-notice"),
    ).toHaveTextContent("No hay contenido nuevo para generar");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("clears the notice when the page changes", async () => {
    generateExamQuestionsAction.mockResolvedValue({
      ok: false,
      error: { code: "EXAMS_NO_NEW_CONTENT", message: "x" },
    });
    const { user, dialog } = await open();
    const page = within(dialog).getByRole("combobox", { name: "Página" });
    await chooseOption(user, page, "Mitocondria");
    await user.click(within(dialog).getByTestId("create-exam-submit"));
    await within(dialog).findByTestId("create-exam-notice");

    await chooseOption(user, page, "Ribosomas");

    expect(
      within(dialog).queryByTestId("create-exam-notice"),
    ).not.toBeInTheDocument();
  });

  // T5b review follow-up: a failed notebook read is not "no notebooks".
  it("shows a load error instead of the empty state when the notebooks could not be read", async () => {
    const { dialog } = await open({ notebooks: null });

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "No pudimos cargar tus cuadernos. Intenta de nuevo.",
    );
    expect(
      within(dialog).queryByText(
        "Aún no tienes cuadernos. Crea uno para empezar.",
      ),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByTestId("create-exam-submit")).toBeDisabled();
  });

  it("closes on Cancelar without creating anything", async () => {
    const { user, dialog } = await open();

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

// Phase 8 H14 (user 2026-10-29): about 15 words per question, 150 for the
// smallest exam; the stepper only offers what the chosen page supports.
describe("CreateExamDialog — page content thresholds", () => {
  const WITH_WORDS: CreateExamNotebook[] = [
    {
      id: "nb-bio",
      title: "Biología",
      pages: [
        { id: "p-short", title: "Corta", words: 120 },
        { id: "p-mid", title: "Media", words: 240 },
        { id: "p-long", title: "Larga", words: 900 },
      ],
    },
  ];

  beforeEach(() => {
    generateExamQuestionsAction.mockReset();
  });

  it("disables a page under 150 words", async () => {
    const { user, dialog } = await open({ notebooks: WITH_WORDS });
    within(dialog).getByRole("combobox", { name: "Página" }).focus();
    await user.keyboard("{Enter}");

    const option = screen.getByRole("option", { name: /Corta/ });
    expect(option).toHaveAttribute("aria-disabled", "true");
    expect(option).toHaveTextContent(
      "Muy poco contenido (120 palabras): escribe al menos 150",
    );
  });

  it("offers only the counts the chosen page supports, with a hint", async () => {
    const { user, dialog } = await open({ notebooks: WITH_WORDS });
    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Página" }),
      "Media",
    );
    const more = within(dialog).getByRole("button", {
      name: "Más preguntas a generar",
    });

    await user.click(more);
    expect(within(dialog).getByTestId("exam-count-value")).toHaveTextContent(
      "15",
    );
    expect(more).toBeDisabled();
    expect(
      within(dialog).getByText("Esta página admite hasta 15 preguntas"),
    ).toBeInTheDocument();
  });

  it("lowers the count when a shorter page is chosen", async () => {
    const { user, dialog } = await open({ notebooks: WITH_WORDS });
    const page = within(dialog).getByRole("combobox", { name: "Página" });
    await chooseOption(user, page, "Larga");
    const more = within(dialog).getByRole("button", {
      name: "Más preguntas a generar",
    });
    await user.click(more);
    await user.click(more);
    expect(within(dialog).getByTestId("exam-count-value")).toHaveTextContent(
      "20",
    );

    await chooseOption(user, page, "Media");

    expect(within(dialog).getByTestId("exam-count-value")).toHaveTextContent(
      "15",
    );
  });

  it("explains AI_PAGE_TOO_SHORT with the words the server asks for", async () => {
    generateExamQuestionsAction.mockResolvedValue({
      ok: false,
      error: {
        code: "AI_PAGE_TOO_SHORT",
        message: "x",
        words: 160,
        minWords: 300,
        maxItems: 10,
      },
    });
    const { user, dialog } = await open();
    await chooseOption(
      user,
      within(dialog).getByRole("combobox", { name: "Página" }),
      "Ribosomas",
    );

    await user.click(within(dialog).getByTestId("create-exam-submit"));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Esta página tiene poco contenido para generar. Agrega más texto (mínimo 300 palabras).",
    );
  });
});
