import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadMarkdownDocumentSet } from "../src/sample-docs";

const repoRoot = join(__dirname, "..", "..", "..");
const sampleDocsDir = join(repoRoot, "sample-docs");

describe("sample docs loader", () => {
  it("loads public and synthetic markdown docs as one chunk per source document", async () => {
    const documents = await loadMarkdownDocumentSet(sampleDocsDir);

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
    expect(documents).toHaveLength(20);
    expect(documents[0]?.chunks).toHaveLength(1);
    expect(documents[0]?.chunks[0]?.chunk.id).toBe("hybrid-retrieval-note#chunk-001");
    expect(documents[0]?.chunks[0]?.embedding).toBeNull();
    expect(documents[0]?.source.sourceUrl).toBe(
      "https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking"
    );
  });

  it("keeps the hybrid retrieval sample aligned with the live vector-only question", async () => {
    const documents = await loadMarkdownDocumentSet(sampleDocsDir);
    const hybridRetrieval = documents.find((document) => document.source.id === "hybrid-retrieval-note");
    const text = hybridRetrieval?.chunks[0]?.chunk.text.toLowerCase() ?? "";

    expect(text).toMatch(/not\s+rely only on semantic vectors/);
  });
});
