import { getGenerationStatusAction } from "@/modules/flashcards";

// Generations left today for a hub's create dialog (Phase 8 H11): the AI
// daily limit is shared by the three techniques, and the flashcards module
// already answers it for the techniques panel. A failed or unauthorised
// read is unknown (null), never 0, so the dialog does not block a working
// generation; the action itself still enforces the limit.
export async function readRemainingGenerations(): Promise<number | null> {
  try {
    const status = await getGenerationStatusAction();
    return status.ok ? status.value.remainingToday : null;
  } catch {
    return null;
  }
}
