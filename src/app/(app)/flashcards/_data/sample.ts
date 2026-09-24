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

// Product rule (user, 2026-09-24): a deck can never be empty — every deck
// always holds flashcards. Every deck in SAMPLE_DECKS therefore has cards
// below, and `cardCount` is derived from them (see `withCardCount`) so the
// two can never drift apart.
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
  {
    id: "membrana-1",
    deckId: "membrana-celular",
    front: "¿Qué modelo describe la estructura de la membrana plasmática?",
    back: "El modelo del mosaico fluido (Singer y Nicolson, 1972): una bicapa lipídica fluida con proteínas incrustadas que se desplazan lateralmente.",
  },
  {
    id: "membrana-2",
    deckId: "membrana-celular",
    front: "¿Cuál es el componente principal de la bicapa de la membrana?",
    back: "Los fosfolípidos, con una cabeza polar hidrofílica orientada hacia el agua y dos colas hidrofóbicas orientadas hacia el interior.",
  },
  {
    id: "membrana-3",
    deckId: "membrana-celular",
    front: "¿Qué función cumple el colesterol en la membrana animal?",
    back: "Regula la fluidez: evita que la membrana se vuelva demasiado rígida a bajas temperaturas o demasiado fluida a altas temperaturas.",
  },
  {
    id: "membrana-4",
    deckId: "membrana-celular",
    front: "¿Qué diferencia hay entre proteínas integrales y periféricas?",
    back: "Las integrales atraviesan o se insertan en la bicapa; las periféricas se unen a la superficie de la membrana o a otras proteínas.",
  },
  {
    id: "membrana-5",
    deckId: "membrana-celular",
    front: "¿Qué es la difusión simple?",
    back: "El paso de moléculas pequeñas y no polares (O₂, CO₂) a través de la bicapa a favor de su gradiente, sin gasto de energía ni proteínas.",
  },
  {
    id: "membrana-6",
    deckId: "membrana-celular",
    front: "¿Qué es la difusión facilitada?",
    back: "Transporte pasivo a favor del gradiente mediante proteínas canal o transportadoras, usado por moléculas polares como la glucosa.",
  },
  {
    id: "membrana-7",
    deckId: "membrana-celular",
    front: "¿Qué caracteriza al transporte activo?",
    back: "Mueve sustancias en contra de su gradiente de concentración y requiere energía, normalmente aportada por la hidrólisis de ATP.",
  },
  {
    id: "membrana-8",
    deckId: "membrana-celular",
    front: "¿Qué hace la bomba de sodio-potasio?",
    back: "Expulsa 3 Na⁺ e introduce 2 K⁺ por cada ATP consumido, manteniendo el potencial de membrana y el volumen celular.",
  },
  {
    id: "membrana-9",
    deckId: "membrana-celular",
    front: "¿Qué es la ósmosis?",
    back: "La difusión de agua a través de una membrana semipermeable desde la zona de menor concentración de solutos hacia la de mayor concentración.",
  },
  {
    id: "membrana-10",
    deckId: "membrana-celular",
    front: "¿Qué le ocurre a una célula animal en un medio hipotónico?",
    back: "Entra agua por ósmosis, la célula se hincha y puede llegar a lisarse (romperse) al no tener pared celular.",
  },
  {
    id: "membrana-11",
    deckId: "membrana-celular",
    front: "¿En qué se diferencian endocitosis y exocitosis?",
    back: "La endocitosis incorpora material externo formando vesículas desde la membrana; la exocitosis expulsa el contenido de vesículas al fusionarlas con la membrana.",
  },
  {
    id: "membrana-12",
    deckId: "membrana-celular",
    front: "¿Qué papel tiene el glucocálix?",
    back: "La capa de glúcidos unidos a lípidos y proteínas de la cara externa participa en el reconocimiento celular, la adhesión y la protección.",
  },
  {
    id: "derivadas-1",
    deckId: "derivadas-parciales",
    front: "¿Qué es la derivada parcial de f(x, y) respecto a x?",
    back: "El límite del cociente incremental al variar solo x, manteniendo y constante: ∂f/∂x = lim (f(x+h, y) − f(x, y)) / h cuando h → 0.",
  },
  {
    id: "derivadas-2",
    deckId: "derivadas-parciales",
    front: "Calcula ∂f/∂x y ∂f/∂y para f(x, y) = x²y + 3y.",
    back: "∂f/∂x = 2xy y ∂f/∂y = x² + 3.",
  },
  {
    id: "derivadas-3",
    deckId: "derivadas-parciales",
    front: "¿Qué representa geométricamente ∂f/∂x en un punto?",
    back: "La pendiente de la recta tangente a la curva que resulta de cortar la superficie z = f(x, y) con el plano y = constante.",
  },
  {
    id: "derivadas-4",
    deckId: "derivadas-parciales",
    front: "¿Qué es el gradiente de una función escalar?",
    back: "El vector de sus derivadas parciales, ∇f = (∂f/∂x, ∂f/∂y); apunta en la dirección de máximo crecimiento de f.",
  },
  {
    id: "derivadas-5",
    deckId: "derivadas-parciales",
    front: "¿Qué afirma el teorema de Schwarz (Clairaut)?",
    back: "Si las derivadas parciales segundas cruzadas son continuas, entonces son iguales: ∂²f/∂x∂y = ∂²f/∂y∂x.",
  },
  {
    id: "derivadas-6",
    deckId: "derivadas-parciales",
    front:
      "¿Cómo se calcula la derivada direccional de f en la dirección del vector unitario u?",
    back: "D_u f = ∇f · u, el producto escalar del gradiente por el vector unitario de dirección.",
  },
  {
    id: "derivadas-7",
    deckId: "derivadas-parciales",
    front: "¿Qué es la regla de la cadena para z = f(x(t), y(t))?",
    back: "dz/dt = (∂f/∂x)(dx/dt) + (∂f/∂y)(dy/dt).",
  },
  {
    id: "derivadas-8",
    deckId: "derivadas-parciales",
    front: "¿Cuándo un punto (a, b) es un punto crítico de f(x, y)?",
    back: "Cuando ambas derivadas parciales se anulan en él (∇f(a, b) = 0) o alguna no existe.",
  },
  {
    id: "derivadas-9",
    deckId: "derivadas-parciales",
    front: "¿Qué indica el determinante hessiano D en un punto crítico?",
    back: "D > 0 y f_xx > 0: mínimo local; D > 0 y f_xx < 0: máximo local; D < 0: punto de silla; D = 0: el criterio no decide.",
  },
  {
    id: "derivadas-10",
    deckId: "derivadas-parciales",
    front: "¿Qué es el plano tangente a z = f(x, y) en (a, b)?",
    back: "z = f(a, b) + f_x(a, b)(x − a) + f_y(a, b)(y − b); es la aproximación lineal de la superficie cerca del punto.",
  },
  {
    id: "renacimiento-1",
    deckId: "renacimiento",
    front: "¿En qué ciudad y siglo surge el Renacimiento?",
    back: "En Florencia, durante el siglo XV (Quattrocento), impulsado por el mecenazgo de familias como los Médici.",
  },
  {
    id: "renacimiento-2",
    deckId: "renacimiento",
    front:
      "¿Quién formuló la perspectiva lineal y en qué obra se aplicó por primera vez?",
    back: "Filippo Brunelleschi la sistematizó; Masaccio la aplicó en el fresco de la Trinidad (Santa Maria Novella, c. 1427).",
  },
  {
    id: "renacimiento-3",
    deckId: "renacimiento",
    front: "¿Qué es el sfumato?",
    back: "La técnica de Leonardo da Vinci que difumina los contornos con transiciones suaves de luz y sombra, como en la Gioconda.",
  },
  {
    id: "renacimiento-4",
    deckId: "renacimiento",
    front: "¿Qué obra de Miguel Ángel decora la bóveda de la Capilla Sixtina?",
    back: "Los frescos del Génesis (1508–1512), con la Creación de Adán como escena más célebre.",
  },
  {
    id: "renacimiento-5",
    deckId: "renacimiento",
    front: "¿Qué representa La escuela de Atenas de Rafael?",
    back: "Una reunión idealizada de los filósofos de la Antigüedad, con Platón y Aristóteles al centro, símbolo del humanismo renacentista.",
  },
  {
    id: "renacimiento-6",
    deckId: "renacimiento",
    front: "¿Qué es el humanismo renacentista?",
    back: "La corriente que sitúa al ser humano y la razón en el centro, recuperando los textos clásicos griegos y latinos como modelo.",
  },
];

export function getSampleNotebook(id: string): SampleNotebook | undefined {
  return SAMPLE_NOTEBOOKS.find((notebook) => notebook.id === id);
}

// Rule: no deck is ever empty. The deck's `cardCount` is the real number of
// cards it holds, never a hand-typed figure.
function withCardCount(deck: SampleDeck): SampleDeck {
  return { ...deck, cardCount: getSampleCards(deck.id).length };
}

export function getSampleDecks(notebookId: string): SampleDeck[] {
  return SAMPLE_DECKS.filter((deck) => deck.notebookId === notebookId).map(
    withCardCount,
  );
}

export function getSampleCards(deckId: string): SampleCard[] {
  return SAMPLE_CARDS.filter((card) => card.deckId === deckId);
}
