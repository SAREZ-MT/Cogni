// Copy for the terms gate (/terminos) and the sign-up consent notice
// (neutral Spanish, "tú"). The clauses below are a short summary; the
// binding texts are the public legal pages (src/content/legal, served under
// /legal). Changing those documents means bumping TERMS_VERSION in
// ../domain/terms.ts so every account accepts again.
export const TERMS_COPY = {
  title: "Términos de uso",
  versionLabel: (version: string) => `Versión ${version}`,
  intro:
    "Cogni es una plataforma de estudio. Antes de usarla necesitamos que conozcas estas condiciones.",
  fullDocuments: {
    lead: "Este es un resumen. Los documentos que aceptas son los",
    connector: "y la",
  },
  sections: [
    {
      id: "edad",
      title: "Edad mínima",
      body: "Debes tener 18 años o más para usar Cogni. El servicio no está dirigido a menores de edad.",
    },
    {
      id: "regiones",
      title: "Regiones no disponibles",
      body: "Cogni no está disponible para residentes del Espacio Económico Europeo, el Reino Unido y Suiza.",
    },
    {
      id: "ia",
      title: "Procesamiento con proveedores de IA",
      body: "El contenido que envías (tus notas y los PDF que importas) se procesa con proveedores de inteligencia artificial en su nivel gratuito: Google Gemini, Cloudflare Workers AI, OpenRouter y Groq. Estos proveedores pueden usarlo para operar y mejorar sus servicios.",
    },
    {
      id: "datos",
      title: "Datos sensibles y de terceros",
      body: "Por lo anterior, no incluyas datos personales sensibles ni datos de otras personas en tus notas o archivos.",
    },
    {
      id: "academico",
      title: "Servicio académico en desarrollo",
      body: "Cogni es un proyecto académico (trabajo de grado) que sigue en desarrollo. No garantizamos su disponibilidad.",
    },
    {
      id: "eliminacion",
      title: "Eliminación de la cuenta",
      body: "Puedes pedir que eliminemos tu cuenta y tus datos en cualquier momento.",
    },
    {
      id: "contacto",
      title: "Contacto",
      body: "Para eliminar tu cuenta o resolver dudas sobre estos términos, escríbenos al correo del proyecto.",
    },
  ],
  anonymous: {
    prompt: "Para usar Cogni debes aceptar estos términos al iniciar sesión.",
    login: "Iniciar sesión",
    register: "Crear cuenta",
  },
  accept: {
    checkbox:
      "Confirmo que tengo 18 años o más, acepto los Términos y condiciones y autorizo el tratamiento de mis datos según la Política de privacidad",
    submit: "Aceptar y continuar",
  },
  accepted: {
    state: (version: string, date: string) =>
      `Aceptaste la versión ${version} el ${date}.`,
    stateWithoutDate: (version: string) => `Aceptaste la versión ${version}.`,
    back: "Volver a Cogni",
  },
  links: {
    menu: "Términos de uso",
    terms: { label: "Términos y condiciones", href: "/legal/terminos" },
    privacy: { label: "Política de privacidad", href: "/legal/privacidad" },
  },
  // Sign-in-wrap notice next to every account-creating button (feature
  // legal-consent, user decision 2026-10-28: no checkbox). Pressing the
  // button is the acceptance; the server stores the proof.
  signUpConsent: {
    register: "Al crear tu cuenta o continuar con Google, aceptas los",
    login: "Si continúas con Google y aún no tienes cuenta, aceptas los",
    afterTerms: ", autorizas el tratamiento de tus datos según la",
    end: " y confirmas que eres mayor de 18 años.",
  },
} as const;
