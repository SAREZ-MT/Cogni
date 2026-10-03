import type { IdGenerator } from "../ports";

export class SequentialIds implements IdGenerator {
  private n = 0;

  next(): string {
    this.n += 1;
    return `gen-${this.n}`;
  }
}
