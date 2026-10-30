import { Bell } from "@phosphor-icons/react/dist/ssr/Bell";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { FileBadge, type FileKind } from "./file-badge";

// Generic loose files of the usual way: only the formats Cogni imports.
export const PILE_FILES: readonly {
  name: string;
  kind: FileKind;
  spot: string;
}[] = [
  {
    name: "apuntes_final_v3.pdf",
    kind: "pdf",
    spot: "left-[3%] top-[33%] -rotate-[5deg] z-20",
  },
  {
    name: "clase (2).docx",
    kind: "docx",
    spot: "left-[34%] top-[45%] rotate-[4deg] z-10",
  },
  {
    name: "tema_nuevo.pptx",
    kind: "pptx",
    spot: "left-0 top-[57%] rotate-[2deg] z-20",
  },
  {
    name: "resumen_copia.pdf",
    kind: "pdf",
    spot: "left-[30%] top-[67%] -rotate-[3deg] z-30",
  },
  {
    name: "apuntes_FINAL_final.docx",
    kind: "docx",
    spot: "left-[5%] top-[83%] -rotate-[1deg] z-10",
  },
  {
    name: "presentación (1).pptx",
    kind: "pptx",
    spot: "max-sm:hidden right-[30%] top-[84%] rotate-[5deg] z-0",
  },
];

const TABS = ["apuntes.pdf", "Sin título", "clase (2).docx"] as const;

const TODOS = [
  { text: "Subrayar el tema 1", done: true },
  { text: "Pasar a limpio", done: true },
  { text: "Hacer las tarjetas", done: true },
  { text: "¿Repasar?", done: false },
] as const;

// "El camino de siempre" as noise: a browser window with too many tabs,
// loose files on top of each other, sticky notes, a notification nobody
// reads, a crossed-out to-do list and scribbled arrows. Decorative: the
// four pains under it carry the meaning.
export function UsualPile() {
  return (
    <div
      aria-hidden="true"
      className="relative mt-8 h-[400px] w-full select-none md:h-[440px]"
    >
      {/* A browser window with scattered tabs, behind everything. */}
      <div className="lp-pile-window absolute top-[3%] left-0 z-0 w-[78%] -rotate-[2deg] overflow-hidden rounded-xl bg-white sm:w-[68%]">
        <div className="flex items-end gap-1 bg-(--lp-soft) px-2 pt-2">
          {TABS.map((tab, index) => (
            <span
              key={tab}
              className={`flex min-w-0 max-w-[96px] items-center gap-1 rounded-t-md px-2 py-1 text-[10px] text-(--lp-ink-3) ${
                index === 1 ? "bg-white" : "bg-(--lp-line)"
              }`}
            >
              <span className="truncate">{tab}</span>
              <X weight="bold" className="size-2.5 shrink-0" />
            </span>
          ))}
          <Plus weight="bold" className="mb-1 ml-1 size-3 text-(--lp-muted)" />
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-3">
          <span className="h-1.5 w-[86%] rounded-full bg-(--lp-editor-line)" />
          <span className="h-1.5 w-[70%] rounded-full bg-(--lp-yellow-200)" />
          <span className="h-1.5 w-[78%] rounded-full bg-(--lp-yellow-200)" />
          <span className="h-1.5 w-[64%] rounded-full bg-(--lp-editor-line)" />
          <span className="h-1.5 w-[74%] rounded-full bg-(--lp-yellow-200)" />
        </div>
      </div>

      {/* A notification that never stops. */}
      <div className="lp-pile-float absolute top-0 right-0 z-30 flex w-[196px] rotate-[3deg] items-center gap-2.5 rounded-xl bg-white px-3 py-2.5">
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--lp-soft) text-(--lp-ink-2)">
          <Bell weight="fill" className="size-4" />
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-(--lp-red-700) font-bold text-[9px] text-white">
            9+
          </span>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-bold text-(--lp-ink) text-[12px]">
            8 archivos nuevos
          </span>
          <span className="truncate text-(--lp-ink-3) text-[11px]">
            en la carpeta compartida
          </span>
        </span>
      </div>

      {/* A to-do list, everything crossed out but the one that matters. */}
      <div className="lp-pile-float absolute top-[27%] right-[1%] z-20 w-[136px] rotate-[5deg] rounded-lg bg-white px-3 py-2.5 font-(family-name:--lp-font-hand) text-(--lp-ink-2) text-[17px] sm:text-[19px] leading-[1.15] sm:w-[164px]">
        {TODOS.map((todo) => (
          <span
            key={todo.text}
            className={`flex items-center gap-1.5 ${
              todo.done
                ? "text-(--lp-muted) line-through decoration-(--lp-rose-700) decoration-2"
                : "text-(--lp-rose-700)"
            }`}
          >
            <span
              className={`size-3 shrink-0 rounded-[3px] border-[1.5px] ${
                todo.done
                  ? "border-(--lp-muted) bg-(--lp-muted)"
                  : "border-(--lp-rose-700)"
              }`}
            />
            {todo.text}
          </span>
        ))}
      </div>

      {PILE_FILES.map((file) => (
        <span
          key={file.name}
          className={`lp-pile-file absolute flex items-center gap-2 rounded-xl bg-white py-2 pr-3.5 pl-2 font-(family-name:--lp-font-mono) text-(--lp-ink-3) text-[12px] ${file.spot}`}
        >
          <FileBadge kind={file.kind} size="sm" />
          {file.name}
        </span>
      ))}

      <span className="lp-pile-note lp-pile-note-rose absolute top-[17%] left-[44%] z-30 w-[112px] -rotate-[7deg] p-3 font-(family-name:--lp-font-hand) text-[20px] leading-none max-sm:hidden">
        ¿Qué repaso primero?
      </span>
      <span className="lp-pile-note absolute right-0 bottom-0 z-40 w-[150px] rotate-3 p-4 font-(family-name:--lp-font-hand) text-[24px] leading-[1.05] md:w-[176px] md:text-[26px]">
        Releer todo la noche antes
      </span>

      {/* Scribbled arrows between the pieces, going nowhere. */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-40 size-full overflow-visible text-(--lp-rose-700)"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M71 27 C 64 36, 56 36, 50 44"
            vectorEffect="non-scaling-stroke"
          />
          <path d="M49 39 L 50 44 L 55 43" vectorEffect="non-scaling-stroke" />
          <path
            d="M86 58 C 90 66, 88 74, 82 79"
            vectorEffect="non-scaling-stroke"
          />
          <path d="M84 74 L 82 79 L 87 80" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  );
}
