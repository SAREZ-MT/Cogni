import { SAMPLE_NOTEBOOKS } from "../../flashcards/_data/sample";

// Fixed sample data for the Exams design preview (design/shell-look, user
// decision 2026-09-24: mirror the Flashcards/Active recall previews, sample
// data only, no backend). Route-local on purpose, same reasoning as
// flashcards/_data/sample.ts and active-recall/_data/sample.ts.
//
// Product rules (documento-maestro §3.3 "Exámenes", §7.5, and the
// `ExamQuestion`/`ExamPageState`/`ExamSession` entities): multiple choice, 4
// options, one correct, N per session (default 10, deterministic
// correction); a score below 70 % marks the page `retake_pending` and
// reschedules the failed questions (due tomorrow); a retake never repeats
// the same question with the same wording — it's one AI-generated variant
// per failed concept, topped up with new questions to at least 5. Unlike
// Active recall/Flashcards, a page shows up here once it has **generated**
// questions, independent of whether it has been attempted yet — so
// "Derivadas parciales" below (0 attempts) still appears.

export { SAMPLE_NOTEBOOKS };

export interface ExamQuestion {
  id: string;
  pageId: string;
  stem: string;
  options: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  // Short label of the concept this question evaluates (documento-maestro
  // §7.5's `ExamQuestion.concept`) — shown on the results review row and
  // used to group the retake's variants.
  concept: string;
}

export interface ExamPage {
  id: string;
  notebookId: string;
  title: string;
  // Derived from SAMPLE_EXAM_QUESTIONS, never hand-typed (same
  // never-drifts rule as flashcards' `cardCount`).
  questionCount: number;
  attempts: number;
  lastScore: number | null;
  passed: boolean;
  retakePending: boolean;
  // Preformatted (e.g. "22 sept"); empty when never attempted.
  lastDate: string;
}

type ExamPageSeed = Omit<ExamPage, "questionCount">;

const SAMPLE_EXAM_PAGES: readonly ExamPageSeed[] = [
  {
    id: "mitocondria",
    notebookId: "biologia-celular",
    title: "Mitocondria",
    attempts: 2,
    lastScore: 60,
    passed: false,
    retakePending: true,
    lastDate: "22 sept",
  },
  {
    id: "membrana-celular",
    notebookId: "biologia-celular",
    title: "Membrana celular",
    attempts: 1,
    lastScore: 83,
    passed: true,
    retakePending: false,
    lastDate: "18 sept",
  },
  {
    id: "derivadas-parciales",
    notebookId: "calculo-iii",
    title: "Derivadas parciales",
    attempts: 0,
    lastScore: null,
    passed: false,
    retakePending: false,
    lastDate: "",
  },
  {
    id: "renacimiento",
    notebookId: "historia-del-arte",
    title: "Renacimiento",
    attempts: 1,
    lastScore: 100,
    passed: true,
    retakePending: false,
    lastDate: "16 sept",
  },
];

const MITOCONDRIA_QUESTIONS: readonly ExamQuestion[] = [
  {
    id: "mitocondria-q1",
    pageId: "mitocondria",
    stem: "¿Cuál es la función principal de la mitocondria en la célula eucariota?",
    options: [
      "Producir ATP mediante la respiración celular aeróbica",
      "Sintetizar proteínas para la secreción celular",
      "Almacenar y degradar desechos celulares",
      "Duplicar el ADN nuclear antes de la mitosis",
    ],
    correctIndex: 0,
    concept: "Función de la mitocondria",
  },
  {
    id: "mitocondria-q2",
    pageId: "mitocondria",
    stem: "¿Por qué la membrana interna de la mitocondria está plegada en crestas?",
    options: [
      "Para separar el núcleo del citoplasma",
      "Para aumentar la superficie disponible para la cadena de transporte de electrones",
      "Para facilitar la división mitocondrial",
      "Para almacenar calcio en el espacio intermembrana",
    ],
    correctIndex: 1,
    concept: "Crestas mitocondriales",
  },
  {
    id: "mitocondria-q3",
    pageId: "mitocondria",
    stem: "¿Qué describe mejor la fosforilación oxidativa?",
    options: [
      "La glucólisis que ocurre en el citoplasma",
      "El transporte de piruvato hacia la matriz",
      "La síntesis de ATP impulsada por el gradiente de protones generado en la cadena de transporte de electrones",
      "La duplicación del ADN mitocondrial",
    ],
    correctIndex: 2,
    concept: "Fosforilación oxidativa",
  },
  {
    id: "mitocondria-q4",
    pageId: "mitocondria",
    stem: "¿Qué evidencia respalda la teoría endosimbiótica sobre el origen de la mitocondria?",
    options: [
      "Su membrana única y su ausencia de ADN propio",
      "Su ubicación exclusiva en células vegetales",
      "Su capacidad de sintetizar celulosa",
      "Su ADN circular propio y su tamaño similar al de una bacteria",
    ],
    correctIndex: 3,
    concept: "Teoría endosimbiótica",
  },
  {
    id: "mitocondria-q5",
    pageId: "mitocondria",
    stem: "¿Por qué el ADN mitocondrial se hereda casi exclusivamente por vía materna?",
    options: [
      "Porque el óvulo aporta el citoplasma, y con él las mitocondrias, durante la fecundación",
      "Porque el espermatozoide no contiene mitocondrias en absoluto",
      "Porque el ADN mitocondrial se degrada en el padre antes de la fecundación",
      "Porque solo las células femeninas producen mitocondrias",
    ],
    correctIndex: 0,
    concept: "Herencia del ADN mitocondrial",
  },
  {
    id: "mitocondria-q6",
    pageId: "mitocondria",
    stem: "¿Qué diferencia a la matriz mitocondrial del espacio intermembrana?",
    options: [
      "La matriz está fuera de la membrana externa; el espacio intermembrana, dentro de la interna",
      "La matriz contiene las enzimas del ciclo de Krebs; el espacio intermembrana está entre las dos membranas",
      "La matriz es rica en oxígeno; el espacio intermembrana, en dióxido de carbono",
      "No existe diferencia funcional entre ambos",
    ],
    correctIndex: 1,
    concept: "Matriz mitocondrial",
  },
  {
    id: "mitocondria-q7",
    pageId: "mitocondria",
    stem: "¿Por qué las células con mayor demanda energética tienden a tener más mitocondrias?",
    options: [
      "Porque las mitocondrias regulan la división celular",
      "Porque almacenan más agua que otras células",
      "Porque necesitan producir más ATP para sostener su actividad",
      "Porque su núcleo es de mayor tamaño",
    ],
    correctIndex: 2,
    concept: "Demanda energética",
  },
  {
    id: "mitocondria-q8",
    pageId: "mitocondria",
    stem: "¿Dónde ocurre el ciclo de Krebs dentro de la mitocondria?",
    options: [
      "En la membrana externa",
      "En el espacio intermembrana",
      "En el citoplasma adyacente",
      "En la matriz mitocondrial",
    ],
    correctIndex: 3,
    concept: "Ciclo de Krebs",
  },
  {
    id: "mitocondria-q9",
    pageId: "mitocondria",
    stem: "¿Qué función cumplen las porinas de la membrana externa mitocondrial?",
    options: [
      "Formar canales que permiten el paso de iones y moléculas pequeñas",
      "Sintetizar ATP directamente",
      "Replicar el ADN mitocondrial",
      "Producir NADH para la cadena respiratoria",
    ],
    correctIndex: 0,
    concept: "Porinas mitocondriales",
  },
  {
    id: "mitocondria-q10",
    pageId: "mitocondria",
    stem: "¿Por qué se describe a la mitocondria como un organelo semiautónomo?",
    options: [
      "Porque puede sobrevivir fuera de la célula indefinidamente",
      "Porque tiene su propio ADN y ribosomas, pero depende de proteínas codificadas en el núcleo",
      "Porque se origina espontáneamente sin división previa",
      "Porque no depende de ningún gen nuclear",
    ],
    correctIndex: 1,
    concept: "Organelo semiautónomo",
  },
];

// One AI-generated variant per failed concept from Mitocondria's last exam
// (documento-maestro §7.5: "el estudiante nunca vuelve a ver la misma
// pregunta con la misma redacción"), topped up with one new question to
// reach 5 (fewer than 5 failed concepts would otherwise make a trivial
// retake).
const MITOCONDRIA_VARIANT_QUESTIONS: readonly ExamQuestion[] = [
  {
    id: "mitocondria-variant-1",
    pageId: "mitocondria",
    stem: "La síntesis de ATP que depende del gradiente de protones generado por la cadena respiratoria se llama…",
    options: [
      "Fosforilación a nivel de sustrato",
      "Fosforilación oxidativa",
      "Glucólisis anaeróbica",
      "Fermentación láctica",
    ],
    correctIndex: 1,
    concept: "Fosforilación oxidativa",
  },
  {
    id: "mitocondria-variant-2",
    pageId: "mitocondria",
    stem: "¿Qué observación sobre la mitocondria apoya la hipótesis de que descendió de una bacteria englobada por una célula ancestral?",
    options: [
      "Que carece de membrana propia",
      "Que se forma únicamente por fusión de peroxisomas",
      "Que posee doble membrana y ADN circular propio",
      "Que solo existe en organismos unicelulares",
    ],
    correctIndex: 2,
    concept: "Teoría endosimbiótica",
  },
  {
    id: "mitocondria-variant-3",
    pageId: "mitocondria",
    stem: "Las proteínas de canal que hacen permeable la membrana externa de la mitocondria a iones y moléculas pequeñas se conocen como…",
    options: [
      "ATP sintasas",
      "Citocromos",
      "Translocasas de la membrana interna",
      "Porinas",
    ],
    correctIndex: 3,
    concept: "Porinas mitocondriales",
  },
  {
    id: "mitocondria-variant-4",
    pageId: "mitocondria",
    stem: "¿Por qué la mitocondria no puede considerarse completamente independiente del núcleo celular?",
    options: [
      "Porque la mayoría de sus proteínas están codificadas por genes nucleares",
      "Porque no tiene ribosomas propios",
      "Porque su membrana depende del retículo endoplasmático",
      "Porque no participa en la producción de energía",
    ],
    correctIndex: 0,
    concept: "Organelo semiautónomo",
  },
  {
    id: "mitocondria-variant-5",
    pageId: "mitocondria",
    stem: "¿Dónde se localiza la cadena de transporte de electrones dentro de la mitocondria?",
    options: [
      "En la membrana externa",
      "En la membrana interna",
      "En la matriz mitocondrial",
      "En el espacio intermembrana, libre de proteínas",
    ],
    correctIndex: 1,
    concept: "Cadena de transporte de electrones",
  },
];

// The 4 concepts Mitocondria's last (failed) attempt got wrong — used by
// the retake session's StatusBanner copy.
export const MITOCONDRIA_RETAKE_CONCEPTS: readonly string[] = [
  "Fosforilación oxidativa",
  "Teoría endosimbiótica",
  "Porinas mitocondriales",
  "Organelo semiautónomo",
];

const MEMBRANA_QUESTIONS: readonly ExamQuestion[] = [
  {
    id: "membrana-q1",
    pageId: "membrana-celular",
    stem: "¿Qué modelo describe mejor la estructura de la membrana plasmática?",
    options: [
      "El modelo del mosaico fluido",
      "El modelo de la doble hélice",
      "El modelo de la matriz extracelular rígida",
      "El modelo de canal único",
    ],
    correctIndex: 0,
    concept: "Mosaico fluido",
  },
  {
    id: "membrana-q2",
    pageId: "membrana-celular",
    stem: "¿Qué caracteriza a la difusión facilitada frente a la difusión simple?",
    options: [
      "Requiere gasto directo de ATP",
      "Usa proteínas canal o transportadoras para moléculas polares",
      "Ocurre en contra del gradiente de concentración",
      "Solo transporta agua",
    ],
    correctIndex: 1,
    concept: "Difusión facilitada",
  },
  {
    id: "membrana-q3",
    pageId: "membrana-celular",
    stem: "¿Cómo mantiene la bomba de sodio-potasio el potencial de membrana?",
    options: [
      "Dejando entrar Na⁺ y K⁺ libremente",
      "Bombeando solo K⁺ hacia el exterior",
      "Expulsando 3 Na⁺ e introduciendo 2 K⁺ por cada ATP consumido",
      "Inactivando los canales de calcio",
    ],
    correctIndex: 2,
    concept: "Bomba sodio-potasio",
  },
  {
    id: "membrana-q4",
    pageId: "membrana-celular",
    stem: "¿Qué le ocurre a una célula animal colocada en un medio hipotónico?",
    options: [
      "Sale agua y la célula se deshidrata",
      "No hay movimiento neto de agua",
      "La célula sintetiza una pared celular protectora",
      "Entra agua por ósmosis y la célula puede lisarse",
    ],
    correctIndex: 3,
    concept: "Medio hipotónico",
  },
  {
    id: "membrana-q5",
    pageId: "membrana-celular",
    stem: "¿Qué diferencia a las proteínas integrales de las periféricas en la membrana?",
    options: [
      "Las integrales atraviesan la bicapa; las periféricas se unen a la superficie",
      "Las integrales solo están en la cara externa",
      "Las periféricas forman canales iónicos",
      "No hay diferencia estructural entre ambas",
    ],
    correctIndex: 0,
    concept: "Proteínas de membrana",
  },
  {
    id: "membrana-q6",
    pageId: "membrana-celular",
    stem: "¿Qué papel cumple el colesterol en la membrana de células animales?",
    options: [
      "Transporta glucosa activamente",
      "Regula la fluidez de la membrana ante cambios de temperatura",
      "Forma parte del glucocálix",
      "Cataliza la síntesis de fosfolípidos",
    ],
    correctIndex: 1,
    concept: "Colesterol y fluidez",
  },
];

const DERIVADAS_QUESTIONS: readonly ExamQuestion[] = [
  {
    id: "derivadas-q1",
    pageId: "derivadas-parciales",
    stem: "¿Qué mide la derivada parcial ∂f/∂x de una función f(x, y)?",
    options: [
      "La tasa de cambio de f respecto a x, manteniendo y constante",
      "La tasa de cambio total de f respecto al tiempo",
      "El área bajo la curva de f",
      "El valor máximo absoluto de f",
    ],
    correctIndex: 0,
    concept: "Derivada parcial",
  },
  {
    id: "derivadas-q2",
    pageId: "derivadas-parciales",
    stem: "¿Qué representa geométricamente el gradiente ∇f de una función escalar?",
    options: [
      "Un escalar que mide la curvatura de f",
      "Un vector que apunta en la dirección de máximo crecimiento de f",
      "La pendiente promedio de f en todo su dominio",
      "El punto donde f se anula",
    ],
    correctIndex: 1,
    concept: "Gradiente",
  },
  {
    id: "derivadas-q3",
    pageId: "derivadas-parciales",
    stem: "¿Qué condición exige el teorema de Schwarz (Clairaut) para igualar las derivadas cruzadas?",
    options: [
      "Que la función sea lineal",
      "Que el dominio sea acotado",
      "Que las derivadas parciales segundas cruzadas sean continuas",
      "Que f sea siempre positiva",
    ],
    correctIndex: 2,
    concept: "Teorema de Schwarz",
  },
  {
    id: "derivadas-q4",
    pageId: "derivadas-parciales",
    stem: "¿Cómo se usa el determinante hessiano para clasificar un punto crítico?",
    options: [
      "D siempre indica un máximo si es positivo",
      "El hessiano solo sirve para funciones de una variable",
      "D = 0 siempre indica un mínimo",
      "D > 0 y f_xx > 0 indica un mínimo local; D < 0 indica un punto de silla",
    ],
    correctIndex: 3,
    concept: "Determinante hessiano",
  },
  {
    id: "derivadas-q5",
    pageId: "derivadas-parciales",
    stem: "¿Cuál es la regla de la cadena para z = f(x(t), y(t))?",
    options: [
      "dz/dt = (∂f/∂x)(dx/dt) + (∂f/∂y)(dy/dt)",
      "dz/dt = ∂f/∂x + ∂f/∂y",
      "dz/dt = (∂f/∂x)(∂f/∂y)",
      "dz/dt = f(x(t), y(t)) · t",
    ],
    correctIndex: 0,
    concept: "Regla de la cadena",
  },
  {
    id: "derivadas-q6",
    pageId: "derivadas-parciales",
    stem: "¿Qué representa el plano tangente a z = f(x, y) en el punto (a, b)?",
    options: [
      "La recta perpendicular a la superficie en ese punto",
      "La mejor aproximación lineal de la superficie cerca de ese punto",
      "El área bajo la superficie en ese punto",
      "El punto crítico más cercano a (a, b)",
    ],
    correctIndex: 1,
    concept: "Plano tangente",
  },
];

const RENACIMIENTO_QUESTIONS: readonly ExamQuestion[] = [
  {
    id: "renacimiento-q1",
    pageId: "renacimiento",
    stem: "¿En qué ciudad y siglo surge el Renacimiento?",
    options: [
      "En Florencia, durante el siglo XV",
      "En Roma, durante el siglo XII",
      "En París, durante el siglo XVIII",
      "En Atenas, durante el siglo V a. C.",
    ],
    correctIndex: 0,
    concept: "Origen del Renacimiento",
  },
  {
    id: "renacimiento-q2",
    pageId: "renacimiento",
    stem: "¿Quién sistematizó la perspectiva lineal en la pintura renacentista?",
    options: [
      "Miguel Ángel",
      "Filippo Brunelleschi",
      "Sandro Botticelli",
      "Donatello",
    ],
    correctIndex: 1,
    concept: "Perspectiva lineal",
  },
  {
    id: "renacimiento-q3",
    pageId: "renacimiento",
    stem: "¿Qué es el sfumato y quién lo desarrolló?",
    options: [
      "Una técnica de mosaico bizantino",
      "Un estilo arquitectónico gótico",
      "Una técnica de transiciones suaves de luz y sombra, desarrollada por Leonardo da Vinci",
      "Una técnica escultórica de Miguel Ángel",
    ],
    correctIndex: 2,
    concept: "Sfumato",
  },
  {
    id: "renacimiento-q4",
    pageId: "renacimiento",
    stem: "¿Qué representa La escuela de Atenas de Rafael?",
    options: [
      "La coronación de un papa renacentista",
      "Una escena bíblica del Génesis",
      "El nacimiento de Venus",
      "Una reunión idealizada de los grandes filósofos de la Antigüedad",
    ],
    correctIndex: 3,
    concept: "La escuela de Atenas",
  },
  {
    id: "renacimiento-q5",
    pageId: "renacimiento",
    stem: "¿Qué es el humanismo renacentista?",
    options: [
      "La corriente que sitúa al ser humano y la razón en el centro, recuperando la cultura clásica",
      "Una doctrina religiosa que rechaza el arte figurativo",
      "Un movimiento político centrado en las monarquías absolutas",
      "Una técnica de perspectiva aérea",
    ],
    correctIndex: 0,
    concept: "Humanismo renacentista",
  },
];

const SAMPLE_EXAM_QUESTIONS: readonly ExamQuestion[] = [
  ...MITOCONDRIA_QUESTIONS,
  ...MEMBRANA_QUESTIONS,
  ...DERIVADAS_QUESTIONS,
  ...RENACIMIENTO_QUESTIONS,
];

function withQuestionCount(page: ExamPageSeed): ExamPage {
  return {
    ...page,
    questionCount: SAMPLE_EXAM_QUESTIONS.filter((q) => q.pageId === page.id)
      .length,
  };
}

// Only pages that actually have generated questions count as "with
// material" for this preview (no empty exams) — independent of `attempts`,
// unlike Active recall/Flashcards' "at least one session/card" rule.
export function getExamPagesWithQuestions(notebookId: string): ExamPage[] {
  return SAMPLE_EXAM_PAGES.filter((page) => page.notebookId === notebookId)
    .map(withQuestionCount)
    .filter((page) => page.questionCount > 0);
}

export function getExamPage(
  notebookId: string,
  pageId: string,
): ExamPage | undefined {
  const page = SAMPLE_EXAM_PAGES.find(
    (candidate) =>
      candidate.notebookId === notebookId && candidate.id === pageId,
  );
  if (!page) return undefined;
  const withCount = withQuestionCount(page);
  return withCount.questionCount > 0 ? withCount : undefined;
}

// The retake's own variant set for a page (documento-maestro §7.5) — only
// Mitocondria has one in this preview, since it's the only sample page with
// `retakePending: true`.
export function getExamVariantQuestions(pageId: string): ExamQuestion[] {
  return pageId === "mitocondria" ? [...MITOCONDRIA_VARIANT_QUESTIONS] : [];
}

export function getExamQuestions(
  pageId: string,
  options?: { retake?: boolean },
): ExamQuestion[] {
  if (options?.retake) {
    const variants = getExamVariantQuestions(pageId);
    if (variants.length > 0) return variants;
  }
  return SAMPLE_EXAM_QUESTIONS.filter((question) => question.pageId === pageId);
}
