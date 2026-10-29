// What deleting a page removes (Phase 8 H19), read just before the
// confirmation: its active study material and its images.
export interface PageDeletionPreview {
  flashcards: number;
  recallQuestions: number;
  examQuestions: number;
  images: number;
}

// What deleting a notebook removes (Phase 8 H19): its active pages and how
// many of them hold a deck, a recall set or an exam set.
export interface NotebookDeletionPreview {
  pages: number;
  decks: number;
  recallSets: number;
  examSets: number;
}

// The Storage objects a committed delete leaves behind: the pages' images
// (SUPABASE_STORAGE_BUCKET) and their imported source documents
// (SUPABASE_PDF_BUCKET). Supabase rejects SQL deletes on storage objects,
// so the caller removes them through the Storage API after the commit.
export interface DeletedFiles {
  assetPaths: string[];
  importPaths: string[];
}

// Port over the hard delete of a page or a notebook with everything below
// it (Phase 8 H19): pages, images, every technique's items, sessions and
// answers, study items, review logs, mastery and the sessions' AI
// feedback. Every method answers null when the target is not the owner's.
export interface ContentDeletion {
  previewPage(
    pageId: string,
    ownerId: string,
  ): Promise<PageDeletionPreview | null>;
  previewNotebook(
    notebookId: string,
    ownerId: string,
  ): Promise<NotebookDeletionPreview | null>;
  deletePage(pageId: string, ownerId: string): Promise<DeletedFiles | null>;
  deleteNotebook(
    notebookId: string,
    ownerId: string,
  ): Promise<DeletedFiles | null>;
}

// The imported documents' bucket, written by ingestion; notebooks only
// removes a deleted page's sources from it (Phase 8 H19).
export interface ImportSourceStorage {
  remove(paths: string[]): Promise<void>;
}
