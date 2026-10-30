"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/utils";
import { createNotebook as createNotebookAction } from "../actions";
import { CreateNotebookDialog } from "./create-notebook-dialog";
import { SIDEBAR_TREE_QUERY_KEY } from "./sidebar-tree-query-key";

interface CreateNotebookTriggerProps {
  // "tile": the notebooks hub's dashed "Nuevo cuaderno" grid tile
  // (.workspace-card.new), shaped like the grid's notebook covers since
  // Phase 8 H4-T5 (book proportion and radius). Phase 8 H4-T4 removed the hub header's "pill",
  // its last user, so there is no default. "hero": the large
  // rounded primary button of Home's empty state. "cta": the notebooks hub
  // empty state's large violet pill with a soft violet shadow and no plus
  // icon (Phase 8 H4-T1, user mockup 2026-10-20).
  variant: "tile" | "hero" | "cta";
  // Button copy (and accessible name) for the hero/cta variants.
  label?: string;
  // Product tour anchor (`data-tour`), e.g. "crear-cuaderno".
  tourId?: string;
  // Open the new notebook instead of refreshing the current page. Home's
  // empty state sets it: after the first notebook, the next step is its
  // first page.
  openAfterCreate?: boolean;
}

// The create-notebook entry points (grid tile and empty-state CTAs) share this
// one trigger instead of duplicating the dialog/mutation wiring
// CreateNotebookIconButton and SidebarTreeClient already have. Unlike
// those two (which only need to refresh the sidebar tree's own React
// Query cache), this one also calls router.refresh() so Home's
// server-rendered stats/grid/recent-pages update without a manual reload
// (S4 review follow-up).
export function CreateNotebookTrigger({
  variant,
  label = "Nuevo cuaderno",
  tourId,
  openAfterCreate = false,
}: CreateNotebookTriggerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const createNotebook = useMutation({
    mutationFn: (title: string) => createNotebookAction({ title }),
    onSuccess: (notebook) => {
      void queryClient.invalidateQueries({
        queryKey: SIDEBAR_TREE_QUERY_KEY,
      });
      if (openAfterCreate) router.push(`/notebooks/${notebook.id}`);
      else router.refresh();
    },
  });

  const trigger =
    variant === "tile" ? (
      <button
        type="button"
        aria-label="Nuevo cuaderno"
        data-tour={tourId}
        className="group/new @container/new relative block aspect-[4/5] w-full flex-1 rounded-[8px_16px_16px_8px] outline-none focus-visible:[&>[data-part=face]]:ring-3 focus-visible:[&>[data-part=face]]:ring-ring/50"
      >
        {/* Phase 8 H4-T5 (user 2026-10-28): a violet-tinted cover the size of
            the grid's notebook faces (the cell minus their 8px page edge),
            with a soft lilac dashed border, a violet plus disc and a hint;
            it lifts and deepens its tint on hover like the covers, and never
            moves under reduced motion. */}
        <span
          data-part="face"
          className="absolute top-0 left-0 flex size-[calc(100%-8px)] flex-col items-center justify-center gap-2 rounded-[8px_16px_16px_8px] border-2 border-primary-300 border-dashed bg-primary-50 px-1.5 text-center @[150px]/new:gap-3 @[150px]/new:px-4 @[280px]/new:gap-4 @[280px]/new:px-6 transition-[translate,scale,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/new:-translate-y-1 group-hover/new:border-primary-400 group-hover/new:bg-primary-100 group-active/new:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
        >
          <span
            data-part="plus"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600 @[150px]/new:size-12 @[280px]/new:size-14 text-white shadow-[0_8px_18px_-8px_rgb(109_40_217/0.55)]"
          >
            <Plus aria-hidden="true" size={22} strokeWidth={2} />
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-semibold text-[11px] text-primary-700 @[150px]/new:text-sm @[280px]/new:text-lg">
              Nuevo cuaderno
            </span>
            <span className="hidden text-balance text-[11.5px] text-primary-600/80 leading-snug @[150px]/new:block @[280px]/new:text-[13px]">
              Crea un cuaderno para una materia
            </span>
          </span>
        </span>
      </button>
    ) : variant === "cta" ? (
      <Button
        type="button"
        size="lg"
        data-tour={tourId}
        className="rounded-pill bg-primary-600 px-6 font-semibold text-[15px] text-white shadow-[0_6px_18px_-6px_rgb(124_58_237/0.55)] hover:bg-primary-700"
      >
        {label}
      </Button>
    ) : (
      <Button
        type="button"
        size="lg"
        data-tour={tourId}
        className="rounded-pill px-6 text-[15px]"
      >
        <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
        {label}
      </Button>
    );

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        // The tile fills its grid cell like the notebook cards beside it
        // (it shrank to its content under the pill's `items-start`).
        variant === "tile" ? "items-stretch" : "items-center",
      )}
    >
      <CreateNotebookDialog
        onCreate={(title) => createNotebook.mutate(title)}
        trigger={trigger}
      />
      {createNotebook.isError && (
        <p role="alert" className="text-destructive text-xs">
          No se pudo crear el cuaderno. Intenta de nuevo.
        </p>
      )}
    </div>
  );
}
