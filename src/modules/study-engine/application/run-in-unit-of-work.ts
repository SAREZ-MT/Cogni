import type { Result } from "@/shared/kernel/result";
import type { StudyRepositories, StudyUnitOfWork } from "./study-unit-of-work";

// Carries an err Result out of StudyUnitOfWork.run as a throw, so the unit
// of work rolls back; runInUnitOfWork turns it back into the Result.
class RollbackSignal<E> extends Error {
  constructor(readonly result: Result<never, E>) {
    super("unit of work rolled back by an err result");
    this.name = "RollbackSignal";
  }
}

// Runs a Result-returning work in one unit of work. A unit of work only
// rolls back on a throw, so returning err from inside `run` would commit
// whatever was written before the refusal; here an err rolls everything
// back and is returned as is. Thrown errors still propagate.
export async function runInUnitOfWork<T, E>(
  uow: StudyUnitOfWork,
  work: (repositories: StudyRepositories) => Promise<Result<T, E>>,
): Promise<Result<T, E>> {
  try {
    return await uow.run(async (repositories) => {
      const result = await work(repositories);
      if (!result.ok) throw new RollbackSignal<E>(result);
      return result;
    });
  } catch (error) {
    if (error instanceof RollbackSignal) return error.result as Result<T, E>;
    throw error;
  }
}
