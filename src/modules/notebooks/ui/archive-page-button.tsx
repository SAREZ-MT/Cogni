"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/shared/ui/button";
import { archivePage as archivePageAction } from "../actions";
import { ArchiveConfirmDialog } from "./archive-confirm-dialog";

interface ArchivePageButtonProps {
  pageId: string;
  title: string;
  className?: string;
}

// Notebook detail page's page-card grid (design pass 2, studyplatform-
// style-report.md §8 "DeletePageButton"): a hover-revealed archive button
// per card, reusing archivePageAction and ArchiveConfirmDialog directly
// (no new mutation logic) — the button sits next to the page card's Link
// (not inside it), so it needs no click interception: a preventDefault
// here would also stop Radix's DialogTrigger from opening the dialog. The
// detail route is a Server Component, so this just calls router.refresh()
// after archiving, same pattern as notebook-card-actions.tsx.
export function ArchivePageButton({
  pageId,
  title,
  className,
}: ArchivePageButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ArchiveConfirmDialog
      itemLabel={`la página "${title}"`}
      onConfirm={() => {
        startTransition(async () => {
          await archivePageAction({ pageId });
          router.refresh();
        });
      }}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={pending}
          aria-label={`Archivar página ${title}`}
          className={className}
        >
          <Trash2 aria-hidden="true" size={14} />
        </Button>
      }
    />
  );
}
