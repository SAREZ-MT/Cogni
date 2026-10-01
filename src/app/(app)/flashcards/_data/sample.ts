import type { NotebookColor } from "@/modules/notebooks";

// Fixed sample data for the Flashcards design preview (user decision
// 2026-09-24: "solo vamos a construir esas pantallas para validar el
// diseño" — no backend exists yet). Route-local on purpose: this is
// presentation fixture data, not a domain module, so it stays under this
// route's own `_data` folder instead of `src/modules`.
//
// Product rule (user, 2026-09-24): ONE flashcard deck per page. A page owns
// at most one deck; the deck has no name of its own — it's identified by
// the page and titled with the page title. "Generar" adds cards to that
// same deck, and manual cards are created inside the page's deck, so there
// is no notebook-level card creation. A deck exists only when it has cards
// (no empty decks, rule from earlier the same day), so `SamplePage` below
// doubles as "the page's deck" — there is no separate deck entity.

export interface SampleNotebook {
  id: string;
  title: string;
  color: NotebookColor;
}

export interface SamplePage {
  id: string;
  notebookId: string;
  title: string;
  cardCount: number;
  dueCount: number;
}

export interface SampleCard {
  id: string;
  pageId: string;
  front: string;
  back: string;
}

export const SAMPLE_NOTEBOOKS: readonly SampleNotebook[] = [
  { id: "biologia-celular", title: "Biología Celular", color: "purple" },
  { id: "calculo-iii", title: "Cálculo III", color: "blue" },
  { id: "historia-del-arte", title: "Historia del Arte", color: "orange" },
];

export const SAMPLE_PAGES: readonly SamplePage[] = [
  {
    id: "mitocondria",
    notebookId: "biologia-celular",
    title: "Mitocondria",
    cardCount: 8,
    dueCount: 5,
  },
  {
    id: "membrana-celular",
    notebookId: "biologia-celular",
    title: "Membrana celular",
    cardCount: 12,
    dueCount: 0,
  },
  {
    id: "derivadas-parciales",
    notebookId: "calculo-iii",
    title: "Derivadas parciales",
    cardCount: 10,
    dueCount: 3,
  },
  {
    id: "renacimiento",
    notebookId: "historia-del-arte",
    title: "Renacimiento",
    cardCount: 6,
    dueCount: 6,
  },
];

// Product rule (user, 2026-09-24): a page's deck can never be empty — every
// page listed above always holds flashcards. Every page in SAMPLE_PAGES
// therefore has cards below, and `cardCount` is derived from them (see
// `withCardCount`) so the two can never drift apart.
export const SAMPLE_CARDS: readonly SampleCard[] = [
  {
    id: "mitocondria-1",
    pageId: "mitocondria",
    front: "¿Cuál es la función principal de la mitocondria en la célula?",
    back: 'Producir ATP (energía) a través de la respiración celular aeróbica. Es la "central energética" de la célula eucariota.',
  },
  {
    id: "mitocondria-2",
    pageId: "mitocondria",
    front: "¿Qué es la matriz mitocondrial?",
    back: "El espacio interno delimitado por la membrana interna, donde ocurre el ciclo de Krebs y se almacenan enzimas, ADN mitocondrial y ribosomas propios.",
  },
  {
    id: "mitocondria-3",
    pageId: "mitocondria",
    front: "¿Por qué se dice que la mitocondria tiene origen endosimbiótico?",
    back: "Porque desciende de una bacteria aeróbica que fue englobada por una célula ancestral y evolucionó en una relación simbiótica permanente; conserva su propio ADN circular.",
  },
  {
    id: "mitocondria-4",
    pageId: "mitocondria",
    front:
      "¿Qué diferencia a la membrana externa de la membrana interna mitocondrial?",
    back: "La externa es lisa y permeable; la interna está muy plegada (crestas), es poco permeable y contiene la cadena de transporte de electrones.",
  },
  {
    id: "mitocondria-5",
    pageId: "mitocondria",
    front: "¿Qué son las crestas mitocondriales?",
    back: "Pliegues de la membrana interna que aumentan la superficie disponible para las proteínas de la cadena respiratoria, incrementando la producción de ATP.",
  },
  {
    id: "mitocondria-6",
    pageId: "mitocondria",
    front: "¿Qué es la fosforilación oxidativa?",
    back: "El proceso final de la respiración celular donde la energía del gradiente de protones impulsa la ATP sintasa para producir ATP a partir de ADP y fosfato.",
  },
  {
    id: "mitocondria-7",
    pageId: "mitocondria",
    front:
      "¿Qué relación existe entre el número de mitocondrias y la actividad celular?",
    back: "Las células con mayor demanda energética (musculares, hepáticas, neuronas) contienen más mitocondrias para satisfacer su consumo de ATP.",
  },
  {
    id: "mitocondria-8",
    pageId: "mitocondria",
    front: "¿Qué ocurre con el ADN mitocondrial en la herencia?",
    back: "Se hereda casi exclusivamente por vía materna, ya que el óvulo aporta el citoplasma (y con él las mitocondrias) durante la fecundación.",
  },
  {
    id: "membrana-1",
    pageId: "membrana-celular",
    front: "¿Qué modelo describe la estructura de la membrana plasmática?",
    back: "El modelo del mosaico fluido (Singer y Nicolson, 1972): una bicapa lipídica fluida con proteínas incrustadas que se desplazan lateralmente.",
  },
  {
    id: "membrana-2",
    pageId: "membrana-celular",
    front: "¿Cuál es el componente principal de la bicapa de la membrana?",
    back: "Los fosfolípidos, con una cabeza polar hidrofílica orientada hacia el agua y dos colas hidrofóbicas orientadas hacia el interior.",
  },
  {
    id: "membrana-3",
    pageId: "membrana-celular",
    front: "¿Qué función cumple el colesterol en la membrana animal?",
    back: "Regula la fluidez: evita que la membrana se vuelva demasiado rígida a bajas temperaturas o demasiado fluida a altas temperaturas.",
  },
  {
    id: "membrana-4",
    pageId: "membrana-celular",
    front: "¿Qué diferencia hay entre proteínas integrales y periféricas?",
    back: "Las integrales atraviesan o se insertan en la bicapa; las periféricas se unen a la superficie de la membrana o a otras proteínas.",
  },
  {
    id: "membrana-5",
    pageId: "membrana-celular",
    front: "¿Qué es la difusión simple?",
    back: "El paso de moléculas pequeñas y no polares (O₂, CO₂) a través de la bicapa a favor de su gradiente, sin gasto de energía ni proteínas.",
  },
  {
    id: "membrana-6",
    pageId: "membrana-celular",
    front: "¿Qué es la difusión facilitada?",
    back: "Transporte pasivo a favor del gradiente mediante proteínas canal o transportadoras, usado por moléculas polares como la glucosa.",
  },
  {
    id: "membrana-7",
    pageId: "membrana-celular",
    front: "¿Qué caracteriza al transporte activo?",
    back: "Mueve sustancias en contra de su gradiente de concentración y requiere energía, normalmente aportada por la hidrólisis de ATP.",
  },
  {
    id: "membrana-8",
    pageId: "membrana-celular",
    front: "¿Qué hace la bomba de sodio-potasio?",
    back: "Expulsa 3 Na⁺ e introduce 2 K⁺ por cada ATP consumido, manteniendo el potencial de membrana y el volumen celular.",
  },
  {
    id: "membrana-9",
    pageId: "membrana-celular",
    front: "¿Qué es la ósmosis?",
    back: "La difusión de agua a través de una membrana semipermeable desde la zona de menor concentración de solutos hacia la de mayor concentración.",
  },
  {
    id: "membrana-10",
    pageId: "membrana-celular",
    front: "¿Qué le ocurre a una célula animal en un medio hipotónico?",
    back: "Entra agua por ósmosis, la célula se hincha y puede llegar a lisarse (romperse) al no tener pared celular.",
  },
  {
    id: "membrana-11",
    pageId: "membrana-celular",
    front: "¿En qué se diferencian endocitosis y exocitosis?",
    back: "La endocitosis incorpora material externo formando vesículas desde la membrana; la exocitosis expulsa el contenido de vesículas al fusionarlas con la membrana.",
  },
  {
    id: "membrana-12",
    pageId: "membrana-celular",
    front: "¿Qué papel tiene el glucocálix?",
    back: "La capa de glúcidos unidos a lípidos y proteínas de la cara externa participa en el reconocimiento celular, la adhesión y la protección.",
  },
  {
    id: "derivadas-1",
    pageId: "derivadas-parciales",
    front: "¿Qué es la derivada parcial de f(x, y) respecto a x?",
    back: "El límite del cociente incremental al variar solo x, manteniendo y constante: ∂f/∂x = lim (f(x+h, y) − f(x, y)) / h cuando h → 0.",
  },
  {
    id: "derivadas-2",
    pageId: "derivadas-parciales",
    front: "Calcula ∂f/∂x y ∂f/∂y para f(x, y) = x²y + 3y.",
    back: "∂f/∂x = 2xy y ∂f/∂y = x² + 3.",
  },
  {
    id: "derivadas-3",
    pageId: "derivadas-parciales",
    front: "¿Qué representa geométricamente ∂f/∂x en un punto?",
    back: "La pendiente de la recta tangente a la curva que resulta de cortar la superficie z = f(x, y) con el plano y = constante.",
  },
  {
    id: "derivadas-4",
    pageId: "derivadas-parciales",
    front: "¿Qué es el gradiente de una función escalar?",
    back: "El vector de sus derivadas parciales, ∇f = (∂f/∂x, ∂f/∂y); apunta en la dirección de máximo crecimiento de f.",
  },
  {
    id: "derivadas-5",
    pageId: "derivadas-parciales",
    front: "¿Qué afirma el teorema de Schwarz (Clairaut)?",
    back: "Si las derivadas parciales segundas cruzadas son continuas, entonces son iguales: ∂²f/∂x∂y = ∂²f/∂y∂x.",
  },
  {
    id: "derivadas-6",
    pageId: "derivadas-parciales",
    front:
      "¿Cómo se calcula la derivada direccional de f en la dirección del vector unitario u?",
    back: "D_u f = ∇f · u, el producto escalar del gradiente por el vector unitario de dirección.",
  },
  {
    id: "derivadas-7",
    pageId: "derivadas-parciales",
    front: "¿Qué es la regla de la cadena para z = f(x(t), y(t))?",
    back: "dz/dt = (∂f/∂x)(dx/dt) + (∂f/∂y)(dy/dt).",
  },
  {
    id: "derivadas-8",
    pageId: "derivadas-parciales",
    front: "¿Cuándo un punto (a, b) es un punto crítico de f(x, y)?",
    back: "Cuando ambas derivadas parciales se anulan en él (∇f(a, b) = 0) o alguna no existe.",
  },
  {
    id: "derivadas-9",
    pageId: "derivadas-parciales",
    front: "¿Qué indica el determinante hessiano D en un punto crítico?",
    back: "D > 0 y f_xx > 0: mínimo local; D > 0 y f_xx < 0: máximo local; D < 0: punto de silla; D = 0: el criterio no decide.",
  },
  {
    id: "derivadas-10",
    pageId: "derivadas-parciales",
    front: "¿Qué es el plano tangente a z = f(x, y) en (a, b)?",
    back: "z = f(a, b) + f_x(a, b)(x − a) + f_y(a, b)(y − b); es la aproximación lineal de la superficie cerca del punto.",
  },
  {
    id: "renacimiento-1",
    pageId: "renacimiento",
    front: "¿En qué ciudad y siglo surge el Renacimiento?",
    back: "En Florencia, durante el siglo XV (Quattrocento), impulsado por el mecenazgo de familias como los Médici.",
  },
  {
    id: "renacimiento-2",
    pageId: "renacimiento",
    front:
      "¿Quién formuló la perspectiva lineal y en qué obra se aplicó por primera vez?",
    back: "Filippo Brunelleschi la sistematizó; Masaccio la aplicó en el fresco de la Trinidad (Santa Maria Novella, c. 1427).",
  },
  {
    id: "renacimiento-3",
    pageId: "renacimiento",
    front: "¿Qué es el sfumato?",
    back: "La técnica de Leonardo da Vinci que difumina los contornos con transiciones suaves de luz y sombra, como en la Gioconda.",
  },
  {
    id: "renacimiento-4",
    pageId: "renacimiento",
    front: "¿Qué obra de Miguel Ángel decora la bóveda de la Capilla Sixtina?",
    back: "Los frescos del Génesis (1508–1512), con la Creación de Adán como escena más célebre.",
  },
  {
    id: "renacimiento-5",
    pageId: "renacimiento",
    front: "¿Qué representa La escuela de Atenas de Rafael?",
    back: "Una reunión idealizada de los filósofos de la Antigüedad, con Platón y Aristóteles al centro, símbolo del humanismo renacentista.",
  },
  {
    id: "renacimiento-6",
    pageId: "renacimiento",
    front: "¿Qué es el humanismo renacentista?",
    back: "La corriente que sitúa al ser humano y la razón en el centro, recuperando los textos clásicos griegos y latinos como modelo.",
  },
];

export function getSampleNotebook(id: string): SampleNotebook | undefined {
  return SAMPLE_NOTEBOOKS.find((notebook) => notebook.id === id);
}

// Rule: a page's deck is never empty. `cardCount` is the real number of
// cards the page holds, never a hand-typed figure.
function withCardCount(page: SamplePage): SamplePage {
  return { ...page, cardCount: getSampleCards(page.id).length };
}

// Only pages that actually have cards are a deck — a page without cards has
// no deck to show (no empty decks).
export function getSamplePagesWithCards(notebookId: string): SamplePage[] {
  return SAMPLE_PAGES.filter((page) => page.notebookId === notebookId)
    .map(withCardCount)
    .filter((page) => page.cardCount > 0);
}

export function getSampleCards(pageId: string): SampleCard[] {
  return SAMPLE_CARDS.filter((card) => card.pageId === pageId);
}

export function getSamplePage(
  notebookId: string,
  pageId: string,
): SamplePage | undefined {
  const page = SAMPLE_PAGES.find(
    (candidate) =>
      candidate.notebookId === notebookId && candidate.id === pageId,
  );
  return page ? withCardCount(page) : undefined;
}

export interface SampleStudyItem {
  href: string;
  label: string;
  detail: string;
  tone: "primary" | "green" | "pink";
}

export interface SampleStudyItemsForPage {
  flashcards: SampleStudyItem[];
  activeRecall: SampleStudyItem[];
  exam: SampleStudyItem[];
}

// Preview data for the "Técnicas" panel's "Generado en esta página" section
// (design/shell-look, user decision 2026-09-24: no backend yet, so every
// page shows the same fixed sample instead of filtering by the real
// notebook/page). One page owns at most one deck, so the flashcards group
// always has exactly one item — the deck of "this page" (fixed to the
// biologia-celular sample notebook's "Mitocondria" page for the preview).
// Active recall/Examen each get one representative sample item so all
// three techniques appear in the preview.
export function getSampleStudyItemsForPage(): SampleStudyItemsForPage {
  const page = getSamplePage("biologia-celular", "mitocondria");

  return {
    flashcards: page
      ? [
          {
            href: `/flashcards/biologia-celular/${page.id}`,
            label: page.title,
            detail:
              page.dueCount > 0
                ? `${page.cardCount} tarjetas · ${page.dueCount} pendientes`
                : `${page.cardCount} tarjetas · al día`,
            tone: "primary",
          },
        ]
      : [],
    activeRecall: [
      {
        href: "#",
        label: "Sesión · 24 sept",
        detail: "10 preguntas · 80 %",
        tone: "green",
      },
    ],
    exam: [
      {
        href: "#",
        label: "Examen de práctica",
        detail: "10 preguntas · 70 %",
        tone: "pink",
      },
    ],
  };
}
