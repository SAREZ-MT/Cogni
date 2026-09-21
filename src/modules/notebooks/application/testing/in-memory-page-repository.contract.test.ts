import { InMemoryPageRepository } from "./in-memory-page-repository";
import { runPageRepositoryContract } from "./page-repository.contract";

runPageRepositoryContract(() => new InMemoryPageRepository());
