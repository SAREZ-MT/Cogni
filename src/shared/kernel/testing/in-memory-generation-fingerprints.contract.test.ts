import { runGenerationFingerprintsContract } from "./generation-fingerprints.contract";
import { InMemoryGenerationFingerprintStore } from "./in-memory-generation-fingerprints";

let store = new InMemoryGenerationFingerprintStore();
let page = 0;

runGenerationFingerprintsContract({
  createRepository: (technique) => store.forTechnique(technique),
  context: () => {
    store = new InMemoryGenerationFingerprintStore();
    return {
      ownerId: "owner-1",
      otherOwnerId: "owner-2",
      newPageId: async () => `page-${++page}`,
    };
  },
});
