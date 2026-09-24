import type { NotebookColor } from "@/modules/notebooks";

// Fixed sample data for the Flashcards design preview (user decision
// 2026-09-24: "solo vamos a construir esas pantallas para validar el
// diseño" — no backend exists yet). Route-local on purpose: this is
// presentation fixture data, not a domain module, so it stays under this
// route's own `_data` folder instead of `src/modules`.

export interface SampleNotebook {
  id: string;
  title: string;
  color: NotebookColor;
}

export interface SampleDeck {
  id: string;
  notebookId: string;
  label: string;
  cardCount: number;
  dueCount: number;
}

export interface SampleCard {
  id: string;
  deckId: string;
  front: string;
  back: string;
}

export const SAMPLE_NOTEBOOKS: readonly SampleNotebook[] = [
  { id: "biologia-celular", title: "Biología Celular", color: "purple" },
  { id: "calculo-iii", title: "Cálculo III", color: "blue" },
  { id: "historia-del-arte", title: "Historia del Arte", color: "orange" },
];

export const SAMPLE_DECKS: readonly SampleDeck[] = [
  {
    id: "mitocondria-semana-3",
    notebookId: "biologia-celular",
    label: "Mitocondria · Semana 3",
    cardCount: 8,
    dueCount: 5,
  },
  {
    id: "membrana-celular",
    notebookId: "biologia-celular",
    label: "Membrana celular",
    cardCount: 12,
    dueCount: 0,
  },
  {
    id: "derivadas-parciales",
    notebookId: "calculo-iii",
    label: "Derivadas parciales",
    cardCount: 10,
    dueCount: 3,
  },
  {
    id: "renacimiento",
    notebookId: "historia-del-arte",
    label: "Renacimiento",
    cardCount: 6,
    dueCount: 6,
  },
];

// Only "Mitocondria · Semana 3" has real sample cards — the other decks
// exercise FlashcardPlayer's zero-cards state on purpose.
export const SAMPLE_CARDS: readonly SampleCard[] = [
  {
    id: "mitocondria-1",
    deckId: "mitocondria-semana-3",
    front: "¿Cuál es la función principal de la mitocondria en la célula?",
    back: 'Producir ATP (energía) a través de la respiración celular aeróbica. Es la "central energética" de la célula eucariota.',
  },
  {
    id: "mitocondria-2",
    deckId: "mitocondria-semana-3",
    front: "¿Qué es la matriz mitocondrial?",
    back: "El espacio interno delimitado por la membrana interna, donde ocurre el ciclo de Krebs y se almacenan enzimas, ADN mitocondrial y ribosomas propios.",
  },
  {
    id: "mitocondria-3",
    deckId: "mitocondria-semana-3",
    front: "¿Por qué se dice que la mitocondria tiene origen endosimbiótico?",
    back: "Porque desciende de una bacteria aeróbica que fue englobada por una célula ancestral y evolucionó en una relación simbiótica permanente; conserva su propio ADN circular.",
  },
  {
    id: "mitocondria-4",
    deckId: "mitocondria-semana-3",
    front:
      "¿Qué diferencia a la membrana externa de la membrana interna mitocondrial?",
    back: "La externa es lisa y permeable; la interna está muy plegada (crestas), es poco permeable y contiene la cadena de transporte de electrones.",
  },
  {
    id: "mitocondria-5",
    deckId: "mitocondria-semana-3",
    front: "¿Qué son las crestas mitocondriales?",
    back: "Pliegues de la membrana interna que aumentan la superficie disponible para las proteínas de la cadena respiratoria, incrementando la producción de ATP.",
  },
  {
    id: "mitocondria-6",
    deckId: "mitocondria-semana-3",
    front: "¿Qué es la fosforilación oxidativa?",
    back: "El proceso final de la respiración celular donde la energía del gradiente de protones impulsa la ATP sintasa para producir ATP a partir de ADP y fosfato.",
  },
  {
    id: "mitocondria-7",
    deckId: "mitocondria-semana-3",
    front:
      "¿Qué relación existe entre el número de mitocondrias y la actividad celular?",
    back: "Las células con mayor demanda energética (musculares, hepáticas, neuronas) contienen más mitocondrias para satisfacer su consumo de ATP.",
  },
  {
    id: "mitocondria-8",
    deckId: "mitocondria-semana-3",
    front: "¿Qué ocurre con el ADN mitocondrial en la herencia?",
    back: "Se hereda casi exclusivamente por vía materna, ya que el óvulo aporta el citoplasma (y con él las mitocondrias) durante la fecundación.",
  },
];

export function getSampleNotebook(id: string): SampleNotebook | undefined {
  return SAMPLE_NOTEBOOKS.find((notebook) => notebook.id === id);
}

export function getSampleDecks(notebookId: string): SampleDeck[] {
  return SAMPLE_DECKS.filter((deck) => deck.notebookId === notebookId);
}

export function getSampleCards(deckId: string): SampleCard[] {
  return SAMPLE_CARDS.filter((card) => card.deckId === deckId);
}
