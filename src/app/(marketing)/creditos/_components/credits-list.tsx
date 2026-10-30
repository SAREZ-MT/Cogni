import { Images, Shapes, Type } from "lucide-react";
import type { ReactNode } from "react";
import { PendingMark } from "../../_components/pending-mark";

type Credit = {
  name: string;
  author: ReactNode;
  license: ReactNode;
};

type CreditGroup = {
  title: string;
  icon: typeof Images;
  items: readonly Credit[];
};

// Fonts per src/app/(marketing)/layout.tsx and the root layout (JetBrains
// Mono); icons per package.json (lucide-react, @phosphor-icons/react).
// The Magnific link and which illustrations are theirs are still open
// (docs/landing/propuesta-contenido.md §8.1), so they show as pending.
export const CREDIT_GROUPS: readonly CreditGroup[] = [
  {
    title: "Ilustraciones",
    icon: Images,
    items: [
      {
        name: "Ilustraciones de la app",
        author: (
          <>
            Designed by Magnific ·{" "}
            <PendingMark>
              PENDIENTE: confirmar qué ilustraciones son de Magnific
            </PendingMark>
          </>
        ),
        license: <PendingMark>PENDIENTE: enlace a Magnific</PendingMark>,
      },
    ],
  },
  {
    title: "Tipografías",
    icon: Type,
    items: [
      {
        name: "Inter · Instrument Serif · Manrope · JetBrains Mono · Caveat",
        author: "Google Fonts",
        license: "SIL Open Font License 1.1",
      },
    ],
  },
  {
    title: "Íconos",
    icon: Shapes,
    items: [
      {
        name: "Lucide",
        author: "Lucide Contributors",
        license: "Licencia ISC",
      },
      {
        name: "Phosphor Icons",
        author: "Phosphor Icons",
        license: "Licencia MIT",
      },
    ],
  },
];

// The three credit groups as white cards on the paper: the group name with
// its icon tile on the left, one row per resource on the right.
export function CreditsList() {
  return (
    <div
      data-nav-theme="light"
      className="lp-on-paper bg-(--lp-paper) px-5 py-16 md:px-10 md:py-[72px] xl:px-20"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        {CREDIT_GROUPS.map((group) => {
          const Icon = group.icon;
          const titleId = `creditos-${group.title}`;
          return (
            <section
              key={group.title}
              aria-labelledby={titleId}
              className="grid gap-6 rounded-[24px] bg-white p-6 md:grid-cols-[280px_1fr] md:gap-10 md:p-8"
            >
              <div className="flex items-center gap-3.5 self-start">
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-xl bg-(--lp-violet-100) text-(--lp-violet-deep)"
                >
                  <Icon className="size-5" />
                </span>
                <h2
                  id={titleId}
                  className="font-(family-name:--lp-font-display) text-(--lp-ink) text-[32px] leading-none"
                >
                  {group.title}
                </h2>
              </div>
              <ul className="flex flex-col">
                {group.items.map((item) => (
                  <li
                    key={item.name}
                    className="lp-credit flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="text-(--lp-ink) text-[17px]">
                        {item.name}
                      </span>
                      <span className="text-(--lp-ink-3) text-[15px]">
                        {item.author}
                      </span>
                    </span>
                    <span className="w-fit shrink-0 rounded-lg bg-(--lp-sidebar) px-3 py-1.5 font-(family-name:--lp-font-mono) text-(--lp-ink-2) text-[12px]">
                      {item.license}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
