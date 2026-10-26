// Runs the shared ImportJobRepository contract (import-job-repository.
// contract.ts) against InMemoryImportJobRepository. T7 adds a companion
// file under tests/db that runs the same `runImportJobRepositoryContract`
// against DrizzleImportJobRepository (pnpm test:db).
import { describe } from "vitest";
import { runImportJobRepositoryContract } from "./import-job-repository.contract";
import { InMemoryImportJobRepository } from "./in-memory-import-job-repository";

describe("fresh repository per case", () => {
  runImportJobRepositoryContract({
    createRepository: () => new InMemoryImportJobRepository(),
  });
});

// document-import T11: the DB run (`pnpm test:db`) shares one table — and
// one owner — across every case, so rows an earlier case leaves behind are
// still there in the next one. One repository for the whole suite
// reproduces that here, so a case that only passes on an empty repository
// fails in `pnpm test` instead of only against cogni-dev.
describe("one repository shared by every case (like the DB run)", () => {
  const shared = new InMemoryImportJobRepository();
  runImportJobRepositoryContract({ createRepository: () => shared });
});
