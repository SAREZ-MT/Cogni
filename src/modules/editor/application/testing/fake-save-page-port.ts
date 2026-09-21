import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  PAGE_VERSION_CONFLICT_CODE,
  type SavePagePort,
  type TiptapDoc,
} from "../../domain/save-page-port";

export interface FakeSaveCall {
  pageId: string;
  content: TiptapDoc;
  expectedVersion: number;
}

type SaveResult = Result<{ version: number }, DomainError>;
type GetCurrentResult = Result<
  { content: TiptapDoc; version: number },
  DomainError
>;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// In-memory double of SavePagePort for use-autosave.test.ts: no network, no
// Server Action. Latency, failure and conflict are all scriptable so every
// autosave scenario of specs/editor/spec.md can be exercised deterministically
// (design.md, "Autosave con debounce de cliente y reconciliación en la UI").
export class FakeSavePagePort implements SavePagePort {
  readonly saveCalls: FakeSaveCall[] = [];
  readonly getCurrentCalls: string[] = [];
  latencyMs = 0;

  private content: TiptapDoc;
  private version: number;
  private readonly scriptedSaveResults: SaveResult[] = [];
  private readonly heldSaves: Array<(result: SaveResult) => void> = [];
  private holdSaves = false;

  constructor(initial: { content: TiptapDoc; version: number }) {
    this.content = initial.content;
    this.version = initial.version;
  }

  // Queues one scripted result for the next save() call (FIFO). When the
  // queue is empty, save() behaves like a real conditional write: it
  // succeeds and increments the version, or reports a version conflict.
  scriptNextSave(result: SaveResult): void {
    this.scriptedSaveResults.push(result);
  }

  // The server-side content/version a reconciling getCurrent() resolves to.
  setServerState(state: { content: TiptapDoc; version: number }): void {
    this.content = state.content;
    this.version = state.version;
  }

  // While enabled, save() never settles on its own: Scenario "Escritura
  // durante el guardado" needs to control exactly when an in-flight save
  // finishes, which a fixed latency cannot express deterministically.
  holdNextSaves(enabled: boolean): void {
    this.holdSaves = enabled;
  }

  resolveNextSave(result: SaveResult): void {
    const resolve = this.heldSaves.shift();
    if (!resolve) throw new Error("FakeSavePagePort: no held save to resolve");
    resolve(result);
  }

  async save(input: {
    pageId: string;
    content: TiptapDoc;
    expectedVersion: number;
  }): Promise<SaveResult> {
    this.saveCalls.push(input);
    if (this.latencyMs > 0) await delay(this.latencyMs);

    if (this.holdSaves) {
      return new Promise((resolve) => {
        this.heldSaves.push(resolve);
      });
    }

    const scripted = this.scriptedSaveResults.shift();
    if (scripted) return scripted;

    if (input.expectedVersion !== this.version) {
      return err(
        new DomainError(
          PAGE_VERSION_CONFLICT_CODE,
          `current version is ${this.version}`,
        ),
      );
    }
    this.content = input.content;
    this.version += 1;
    return ok({ version: this.version });
  }

  async getCurrent(pageId: string): Promise<GetCurrentResult> {
    this.getCurrentCalls.push(pageId);
    return ok({ content: this.content, version: this.version });
  }
}
