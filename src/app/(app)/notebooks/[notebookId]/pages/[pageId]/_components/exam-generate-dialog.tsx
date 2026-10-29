"use client";

import { Button } from "@/shared/ui/button";
import { CountStepper } from "@/shared/ui/count-stepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { PixelTile } from "@/shared/ui/pixel-tile";
import { TECHNIQUE_THEME } from "@/shared/ui/technique-theme";

export interface ExamGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onCountChange: (count: number) => void;
  min: number;
  max: number;
  step: number;
  // Called with the chosen count; the dialog closes itself first.
  onConfirm: (count: number) => void;
}

// Examen's "Generar" (Phase 6 T5b v2, user decision 2026-10-06): the
// question count moved out of the card into this dialog so the three
// technique cards look the same. Composes the Dialog, CountStepper and
// Button atoms like the app's other dialogs (NewFlashcardDialog).
export function ExamGenerateDialog({
  open,
  onOpenChange,
  count,
  onCountChange,
  min,
  max,
  step,
  onConfirm,
}: ExamGenerateDialogProps) {
  function confirm() {
    onOpenChange(false);
    onConfirm(count);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="exam-generate-dialog"
        data-technique-theme="exams"
      >
        <DialogHeader
          icon={
            <PixelTile
              tone={TECHNIQUE_THEME.exams.tone}
              icon={TECHNIQUE_THEME.exams.icon}
              size={48}
            />
          }
        >
          <DialogTitle>Generar preguntas de examen</DialogTitle>
          <DialogDescription>
            Elige cuántas preguntas de opción múltiple quieres crear desde esta
            página.
          </DialogDescription>
        </DialogHeader>
        <CountStepper
          label="Preguntas a generar"
          value={count}
          min={min}
          max={max}
          step={step}
          onChange={onCountChange}
          testId="exam-count"
          size="field"
          hint={`Entre ${min} y ${max}, de ${step} en ${step}`}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="technique"
            onClick={confirm}
            data-testid="confirm-exam-generation"
          >
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
