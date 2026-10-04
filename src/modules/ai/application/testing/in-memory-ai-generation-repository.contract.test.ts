import { randomUUID } from "node:crypto";
import { runAiGenerationRepositoryContract } from "./ai-generation-repository.contract";
import { InMemoryAiGenerationRepository } from "./in-memory-ai-generation-repository";

runAiGenerationRepositoryContract({
  createRepository: () => new InMemoryAiGenerationRepository(),
  context: () => ({
    ownerId: "owner-1",
    otherOwnerId: "owner-2",
    pageId: randomUUID(),
    newId: () => randomUUID(),
  }),
});
