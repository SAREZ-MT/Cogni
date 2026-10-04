import { describe, expect, it } from "vitest";
import { AI_GENERATION_PURPOSES } from "@/shared/db/schema";
import { AI_PURPOSES } from "../domain";

// schema.ts imports no module, so it keeps its own copy of the purposes; this
// keeps the CHECK constraint in step with the domain.
describe("ai_generations purposes", () => {
  it("match the domain's AI_PURPOSES", () => {
    expect([...AI_GENERATION_PURPOSES]).toEqual([...AI_PURPOSES]);
  });
});
