import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { PAGE_ERROR } from "../../domain/errors";
import type { PageText, PageTextReader } from "../../domain/page-text-reader";

// Test double for the PageTextReader port: pages are seeded per owner and
// anything else is NOT_FOUND, like the real reader.
export class InMemoryPageTextReader implements PageTextReader {
  private readonly pages = new Map<string, PageText & { ownerId: string }>();

  seed(pageId: string, ownerId: string, text: PageText): void {
    this.pages.set(pageId, { ...text, ownerId });
  }

  async getPageText(
    pageId: string,
    ownerId: string,
  ): Promise<Result<PageText, DomainError>> {
    const page = this.pages.get(pageId);
    if (!page || page.ownerId !== ownerId) {
      return err(new DomainError(PAGE_ERROR.NOT_FOUND, pageId));
    }
    return ok({ title: page.title, plainText: page.plainText });
  }
}
