import { InMemoryAnalyticsStore } from "./in-memory-analytics-store";

// A store with one owner, one notebook ("Biología") and two pages.
export function seededStore(): InMemoryAnalyticsStore {
  const store = new InMemoryAnalyticsStore();
  store.addNotebook({
    id: "nb-1",
    ownerId: "owner-1",
    title: "Biología",
    color: "green",
    position: 1,
  });
  store.addPage({
    id: "p-1",
    ownerId: "owner-1",
    notebookId: "nb-1",
    title: "Mitocondria",
    position: 1,
  });
  store.addPage({
    id: "p-2",
    ownerId: "owner-1",
    notebookId: "nb-1",
    title: "Ribosomas",
    position: 2,
  });
  return store;
}
