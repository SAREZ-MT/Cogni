"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { createNotebook as createNotebookAction } from "../actions";
import { CreateNotebookDialog } from "./create-notebook-dialog";
import { SIDEBAR_TREE_QUERY_KEY } from "./sidebar-tree-query-key";

// Compact trigger for the collapsed sidebar column (S1, app/(app)/
// _components/sidebar.tsx): opens the same "Crear cuaderno" dialog and
// mutation SidebarTreeClient's expanded button uses, behind an icon-only
// button whose tooltip carries the visible label. Exported through
// notebooks/index.ts so the app shell can compose it into the collapsed
// sidebar without a new cross-module import path — SIDEBAR_TREE_QUERY_KEY
// itself stays private to `notebooks` either way.
export function CreateNotebookIconButton() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const createNotebook = useMutation({
    mutationFn: (title: string) => createNotebookAction({ title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: SIDEBAR_TREE_QUERY_KEY,
      });
      // S4 review follow-up: Home's stats/grid are server-rendered, so a
      // notebook created from the collapsed column needs its own refresh.
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <CreateNotebookDialog
                onCreate={(title) => createNotebook.mutate(title)}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label="Crear cuaderno"
                  >
                    <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
                  </Button>
                }
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">Crear cuaderno</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* R3-icon-create-no-error-path: this mutation used to have no error
          path at all, failing silently in the collapsed sidebar column. */}
      {createNotebook.isError && (
        <p
          role="alert"
          className="max-w-16 text-center text-[10px] text-destructive"
        >
          No se pudo crear el cuaderno. Intenta de nuevo.
        </p>
      )}
    </div>
  );
}
