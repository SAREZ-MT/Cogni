import type { HomeNotebookSummary } from "@/modules/notebooks";
import { CreateNotebookTrigger } from "@/modules/notebooks";
import { NotebookCard } from "../notebook-card";

interface NotebookGridProps {
  notebooks: HomeNotebookSummary[];
  now?: Date;
}

// ui_kits/app/Home Page.html .workspaces-grid: 3-column grid of notebook
// cards with a dashed "Nuevo cuaderno" tile always last. Design pass 2: the
// card itself moved to the shared notebook-card.tsx (also used by the
// /notebooks grid view) so both screens render byte-identical cards.
export function NotebookGrid({
  notebooks,
  now = new Date(),
}: NotebookGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3.5">
      {notebooks.map((notebook) => (
        <NotebookCard key={notebook.id} notebook={notebook} now={now} />
      ))}
      <CreateNotebookTrigger variant="tile" />
    </div>
  );
}
