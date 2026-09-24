import { SAMPLE_NOTEBOOKS } from "../../flashcards/_data/sample";

// Fixed sample data for the Active recall design preview (design/shell-look,
// user decision 2026-09-24: mirror the Flashcards preview, sample data
// only, no backend). Route-local on purpose, same reasoning as
// flashcards/_data/sample.ts.
//
// Product rule (documento-maestro §3.3 "Recordación activa"): one study
// unit per page — a session belongs to a page, there's no separate named
// deck/session entity. A page appears here only once it has generated
// questions, matching flashcards' "no empty decks" rule.

export { SAMPLE_NOTEBOOKS };

export interface RecallSession {
  // Preformatted (e.g. "24 sept") — this is fixture data for a design
  // preview, not a real timestamp to reformat client-side.
  date: string;
  questionCount: number;
  correct: number;
  partial: number;
  incorrect: number;
  accuracy: number;
}

export interface RecallPage {
  id: string;
  notebookId: string;
  title: string;
  // Newest first. A page only shows up in the technique screens once it has
  // at least one session (see getRecallPagesWithSessions/getRecallPage).
  sessions: RecallSession[];
}

export interface RecallQuestion {
  id: string;
  pageId: string;
  prompt: string;
}

const SAMPLE_RECALL_PAGES: readonly RecallPage[] = [
  {
    id: "mitocondria",
    notebookId: "biologia-celular",
    title: "Mitocondria",
    sessions: [
      {
        date: "24 sept",
        questionCount: 8,
        correct: 6,
        partial: 1,
        incorrect: 1,
        accuracy: 80,
      },
      {
        date: "20 sept",
        questionCount: 8,
        correct: 5,
        partial: 2,
        incorrect: 1,
        accuracy: 70,
      },
    ],
  },
  {
    id: "membrana-celular",
    notebookId: "biologia-celular",
    title: "Membrana celular",
    sessions: [
      {
        date: "18 sept",
        questionCount: 6,
        correct: 3,
        partial: 2,
        incorrect: 1,
        accuracy: 58,
      },
    ],
  },
  {
    id: "derivadas-parciales",
    notebookId: "calculo-iii",
    title: "Derivadas parciales",
    sessions: [
      {
        date: "22 sept",
        questionCount: 6,
        correct: 2,
        partial: 1,
        incorrect: 3,
        accuracy: 33,
      },
      {
        date: "15 sept",
        questionCount: 6,
        correct: 3,
        partial: 2,
        incorrect: 1,
        accuracy: 58,
      },
    ],
  },
  {
    id: "renacimiento",
    notebookId: "historia-del-arte",
    title: "Renacimiento",
    sessions: [
      {
        date: "23 sept",
        questionCount: 5,
        correct: 5,
        partial: 0,
        incorrect: 0,
        accuracy: 100,
      },
      {
        date: "16 sept",
        questionCount: 5,
        correct: 4,
        partial: 1,
        incorrect: 0,
        accuracy: 90,
      },
      {
        date: "10 sept",
        questionCount: 5,
        correct: 3,
        partial: 1,
        incorrect: 1,
        accuracy: 70,
      },
    ],
  },
];

const SAMPLE_RECALL_QUESTIONS: readonly RecallQuestion[] = [
  {
    id: "mitocondria-1",
    pageId: "mitocondria",
    prompt:
      "Explica en tus propias palabras qué es la mitocondria y cuál es su función principal en la célula eucariota.",
  },
  {
    id: "mitocondria-2",
    pageId: "mitocondria",
    prompt:
      "¿Por qué la membrana interna está plegada en crestas y qué ventaja aporta?",
  },
  {
    id: "mitocondria-3",
    pageId: "mitocondria",
    prompt:
      "Describe el proceso de fosforilación oxidativa y su relación con la cadena de transporte de electrones.",
  },
  {
    id: "mitocondria-4",
    pageId: "mitocondria",
    prompt:
      "¿Qué evidencia respalda la teoría endosimbiótica sobre el origen de la mitocondria?",
  },
  {
    id: "mitocondria-5",
    pageId: "mitocondria",
    prompt:
      "Explica por qué el ADN mitocondrial se hereda casi exclusivamente por vía materna.",
  },
  {
    id: "mitocondria-6",
    pageId: "mitocondria",
    prompt:
      "¿Qué diferencias existen entre la matriz mitocondrial y el espacio intermembrana?",
  },
  {
    id: "mitocondria-7",
    pageId: "mitocondria",
    prompt:
      "¿Por qué las células con mayor demanda energética tienden a tener más mitocondrias?",
  },
  {
    id: "mitocondria-8",
    pageId: "mitocondria",
    prompt: "Resume el ciclo de Krebs y dónde ocurre dentro de la mitocondria.",
  },
  {
    id: "membrana-1",
    pageId: "membrana-celular",
    prompt:
      "Explica el modelo del mosaico fluido y por qué describe bien la membrana plasmática.",
  },
  {
    id: "membrana-2",
    pageId: "membrana-celular",
    prompt:
      "Compara la difusión simple, la difusión facilitada y el transporte activo.",
  },
  {
    id: "membrana-3",
    pageId: "membrana-celular",
    prompt:
      "¿Cómo mantiene la bomba de sodio-potasio el potencial de membrana?",
  },
  {
    id: "membrana-4",
    pageId: "membrana-celular",
    prompt:
      "Explica qué le ocurre a una célula animal en un medio hipotónico y por qué.",
  },
  {
    id: "membrana-5",
    pageId: "membrana-celular",
    prompt:
      "Describe la diferencia entre proteínas integrales y periféricas de la membrana.",
  },
  {
    id: "membrana-6",
    pageId: "membrana-celular",
    prompt: "¿Qué papel cumple el colesterol en la fluidez de la membrana?",
  },
  {
    id: "derivadas-1",
    pageId: "derivadas-parciales",
    prompt:
      "Explica qué mide la derivada parcial de una función de dos variables.",
  },
  {
    id: "derivadas-2",
    pageId: "derivadas-parciales",
    prompt:
      "Describe cómo se interpreta geométricamente el gradiente de una función.",
  },
  {
    id: "derivadas-3",
    pageId: "derivadas-parciales",
    prompt: "Enuncia el teorema de Schwarz (Clairaut) y qué condición exige.",
  },
  {
    id: "derivadas-4",
    pageId: "derivadas-parciales",
    prompt:
      "Explica cómo se usa el determinante hessiano para clasificar un punto crítico.",
  },
  {
    id: "derivadas-5",
    pageId: "derivadas-parciales",
    prompt:
      "Describe la regla de la cadena para una función compuesta de dos variables.",
  },
  {
    id: "derivadas-6",
    pageId: "derivadas-parciales",
    prompt:
      "Explica qué representa el plano tangente a una superficie en un punto.",
  },
  {
    id: "renacimiento-1",
    pageId: "renacimiento",
    prompt:
      "Explica el contexto histórico y geográfico en el que surge el Renacimiento.",
  },
  {
    id: "renacimiento-2",
    pageId: "renacimiento",
    prompt:
      "Describe cómo cambió la perspectiva lineal la pintura renacentista.",
  },
  {
    id: "renacimiento-3",
    pageId: "renacimiento",
    prompt: "Explica en qué consiste el sfumato y quién lo desarrolló.",
  },
  {
    id: "renacimiento-4",
    pageId: "renacimiento",
    prompt: "Describe el significado de La escuela de Atenas de Rafael.",
  },
  {
    id: "renacimiento-5",
    pageId: "renacimiento",
    prompt:
      "Explica qué es el humanismo renacentista y cómo influyó en el arte.",
  },
];

// Only pages that actually have at least one session count as "with
// questions" for this preview (no empty sessions, same rule as flashcards'
// no-empty-decks).
export function getRecallPagesWithSessions(notebookId: string): RecallPage[] {
  return SAMPLE_RECALL_PAGES.filter(
    (page) => page.notebookId === notebookId && page.sessions.length > 0,
  );
}

export function getRecallPage(
  notebookId: string,
  pageId: string,
): RecallPage | undefined {
  return SAMPLE_RECALL_PAGES.find(
    (page) =>
      page.notebookId === notebookId &&
      page.id === pageId &&
      page.sessions.length > 0,
  );
}

export function getRecallQuestions(pageId: string): RecallQuestion[] {
  return SAMPLE_RECALL_QUESTIONS.filter(
    (question) => question.pageId === pageId,
  );
}
