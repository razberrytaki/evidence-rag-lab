import { describe, expect, it } from "vitest";
import { sampleRetrievalQualityCases } from "../src/sample-retrieval-quality-cases";

describe("sample retrieval quality cases", () => {
  it("defines 20 ranked retrieval cases for the public sample docs set", () => {
    expect(sampleRetrievalQualityCases).toHaveLength(20);
    expect(new Set(sampleRetrievalQualityCases.map((testCase) => testCase.id)).size).toBe(20);
    expect(new Set(sampleRetrievalQualityCases.flatMap((testCase) => testCase.expectedRelevantDocIds)).size).toBe(20);
  });

  it("keeps case queries anchored to their expected document theme", () => {
    expect(sampleRetrievalQualityCases.map((testCase) => testCase.id)).toEqual([
      "hybrid-retrieval",
      "pgvector-hnsw",
      "deployment-policy-current",
      "prompt-injection-document-text",
      "deployment-policy-stale",
      "chunking-boundary",
      "parent-child-retrieval",
      "reranker-latency-budget",
      "source-trust-score",
      "citation-validation",
      "insufficient-evidence-rejection",
      "trace-observability",
      "retrieval-cache-invalidation",
      "version-history",
      "duplicate-detection",
      "rag-query-mode-config-key",
      "unknown-chunk-error-code",
      "selected-chunk-ids-field",
      "rrf-acronym-collision",
      "runbook-id-rollback"
    ]);
  });

  it("marks exact-token stress cases so mode comparisons can be interpreted by category", () => {
    const exactTokenCases = sampleRetrievalQualityCases.filter((testCase) => testCase.category === "exact-token");

    expect(exactTokenCases.map((testCase) => testCase.id)).toEqual([
      "rag-query-mode-config-key",
      "unknown-chunk-error-code",
      "selected-chunk-ids-field",
      "rrf-acronym-collision",
      "runbook-id-rollback"
    ]);
    expect(exactTokenCases.map((testCase) => testCase.query)).toEqual([
      "Which note names the exact config key RAG_QUERY_MODE=postgres?",
      "Which note explains the exact error code RAG-0427?",
      "Which note defines the exact trace field selectedChunkIds?",
      "Which note distinguishes the acronym RRF from RAG?",
      "Which note names rollback runbook RB-17A?"
    ]);
  });
});
