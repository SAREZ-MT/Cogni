"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { IconTile } from "@/shared/ui/icon-tile";
import { createNotebook as createNotebookAction } from "../actions";
import { CreateNotebookDialog } from "./create-notebook-dialog";
import { SIDEBAR_TREE_QUERY_KEY } from "./sidebar-tree-query-key";

interface CreateNotebookTriggerProps {
  // "pill" (default): Home's "+ Nuevo cuaderno" primary button
  // (ui_kits/app/Home Page.html .btn-primary). "tile": the dashed
  // "Nuevo cuaderno" grid tile (.workspace-card.new).
  variant?: "pill" | "tile";
}

// Home's create-notebook entry points (header CTA and grid tile) share this
// one trigger instead of duplicating the dialog/mutation wiring
// CreateNotebookIconButton and SidebarTreeClient already have. Unlike
// those two (which only need to refresh the sidebar tree's own React
// Query cache), this one also calls router.refresh() so Home's
// server-rendered stats/grid/recent-pages update without a manual reload
// (S4 review follow-up).
export function CreateNotebookTrigger({
  variant = "pill",
}: CreateNotebookTriggerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const createNotebook = useMutation({
    mutationFn: (title: string) => createNotebookAction({ title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: SIDEBAR_TREE_QUERY_KEY,
      });
      router.refresh();
    },
  });

  const trigger =
    variant === "tile" ? (
      <button
        type="button"
        aria-label="Nuevo cuaderno"
        className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-border-default border-dashed bg-white/40 text-fg-muted transition-colors hover:bg-white/70 hover:text-fg-secondary"
      >
        <IconTile size="36" radius="md" className="bg-neutral-150">
          <Plus aria-hidden="true" size={18} strokeWidth={1.75} />
        </IconTile>
        <span className="font-medium text-sm">Nuevo cuaderno</span>
      </button>
    ) : (
      <Button type="button" aria-label="Nuevo cuaderno">
        <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
        Nuevo cuaderno
      </Button>
    );

  return (
    <div className="flex flex-col items-start gap-1">
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
