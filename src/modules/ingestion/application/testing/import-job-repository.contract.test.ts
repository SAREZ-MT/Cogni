// Runs the shared ImportJobRepository contract (import-job-repository.
// contract.ts) against InMemoryImportJobRepository. T7 adds a companion
// file under tests/db that runs the same `runImportJobRepositoryContract`
// against DrizzleImportJobRepository (pnpm test:db).
import { runImportJobRepositoryContract } from "./import-job-repository.contract";
import { InMemoryImportJobRepository } from "./in-memory-import-job-repository";

runImportJobRepositoryContract({
  createRepository: () => new InMemoryImportJobRepository(),
});
