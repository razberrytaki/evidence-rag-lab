import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EmbeddingProvider } from "../src/openai-embeddings";
import { loadEmbeddedMarkdownDocumentSet } from "../src/sample-docs";

const repoRoot = join(__dirname, "..", "..", "..");
const sampleDocsDir = join(repoRoot, "sample-docs");

describe("sample docs embedding loader", () => {
  it("embeds each sample chunk in deterministic document order", async () => {
    const calls: string[][] = [];
    const provider: EmbeddingProvider = {
      embedTexts: async (texts) => {
        calls.push([...texts]);
        return texts.map((_, index) => [index + 0.1, index + 0.2, index + 0.3]);
      }
    };

    const documents = await loadEmbeddedMarkdownDocumentSet(sampleDocsDir, provider);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(20);
    expect(documents.map((document) => document.source.id)).toEqual([
      "hybrid-retrieval-note",
      "pgvector-indexing-note",
      "acronym-collision-note",
      "api-field-contract-note",
      "chunking-strategy-note",
      "citation-validation-note",
      "config-key-routing-note",
      "deployment-policy-v1",
      "deployment-policy-v2",
      "duplicate-detection-note",
      "error-code-runbook-note",
      "insufficient-evidence-note",
      "parent-child-retrieval-note",
      "prompt-injection-note",
      "reranker-latency-note",
      "retrieval-cache-note",
      "runbook-id-rollback-note",
      "source-trust-note",
      "trace-observability-note",
      "version-history-note"
    ]);
    expect(documents[0]?.chunks[0]?.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(documents[19]?.chunks[0]?.embedding).toEqual([19.1, 19.2, 19.3]);
  });
});
