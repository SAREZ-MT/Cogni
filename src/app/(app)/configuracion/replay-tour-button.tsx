"use client";

import { Compass } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useProductTour } from "../_components/product-tour/product-tour";

// "Ver tutorial de Cogni" row (inicio-tour-y-empty-state.md §1.3): replays
// the product tour regardless of the stored cogni.tour.v1 key.
export function ReplayTourButton() {
  const { start } = useProductTour();
  return (
    <Button type="button" variant="outline" onClick={start}>
      <Compass aria-hidden="true" size={16} strokeWidth={1.75} />
      Ver tutorial de Cogni
    </Button>
  );
}
