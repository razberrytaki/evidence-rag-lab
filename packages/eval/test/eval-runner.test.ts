import { describe, expect, it } from "vitest";
import {
  estimateScaleBudget,
  estimateVectorIndexBudget,
  evaluateFixtures,
  evaluateRankedRetrieval,
  renderEvalReportMarkdown,
  renderRankedRetrievalReportMarkdown,
  renderProviderComparisonReportMarkdown,
  renderRetrievalConcurrencyReportMarkdown,
  renderRetrievalLatencyReportMarkdown,
  renderRetrievalModeComparisonReportMarkdown,
  renderScaleBudgetReportMarkdown,
  renderVectorIndexBudgetReportMarkdown,
  type EvalFixture,
  type EvalObservation
} from "../src";

describe("eval runner", () => {
  it("computes retrieval, citation, rejection, and trace metrics from fixture observations", () => {
    const fixtures: EvalFixture[] = [
      {
        id: "hybrid-rescue",
        query: "Why not rely only on semantic vectors?",
        expectedBehavior: "retrieve",
        expectedRelevantDocs: ["hybrid-retrieval-note"],
        expectedRejectedDocs: ["vector-only-note"],
        requiredCitations: ["hybrid-retrieval-note#chunk-003"]
      },
      {
        id: "insufficient-evidence",
        query: "What is missing?",
        expectedBehavior: "reject",
        expectedRelevantDocs: [],
        expectedRejectedDocs: [],
        requiredCitations: []
      },
      {
        id: "trace-completeness",
        query: "Show the trace.",
        expectedBehavior: "trace",
        expectedRelevantDocs: ["observability-note"],
        expectedRejectedDocs: ["low-trust-claim-note"],
        requiredCitations: ["observability-note#chunk-001"]
      }
    ];

    const observations: EvalObservation[] = [
      {
        fixtureId: "hybrid-rescue",
        retrievedDocIds: ["hybrid-retrieval-note"],
        rejectedDocIds: ["vector-only-note"],
        citationChunkIds: ["hybrid-retrieval-note#chunk-003"],
        finalStatus: "answered",
        unsupportedClaimRejected: false,
        traceComplete: true
      },
      {
        fixtureId: "insufficient-evidence",
        retrievedDocIds: [],
        rejectedDocIds: [],
        citationChunkIds: [],
        finalStatus: "rejected",
        unsupportedClaimRejected: true,
        traceComplete: true
      },
      {
        fixtureId: "trace-completeness",
        retrievedDocIds: ["observability-note"],
        rejectedDocIds: ["low-trust-claim-note"],
        citationChunkIds: ["observability-note#chunk-001"],
        finalStatus: "answered",
        unsupportedClaimRejected: false,
        traceComplete: true
      }
    ];

    const report = evaluateFixtures(fixtures, observations);

    expect(report.summary).toEqual({
      total: 3,
      passed: 3,
      failed: 0
    });
    expect(report.metrics.recallAtK).toEqual({ passed: 2, total: 2, rate: 1 });
    expect(report.metrics.citationCoverage).toEqual({ passed: 2, total: 2, rate: 1 });
    expect(report.metrics.unsupportedClaimRejection).toEqual({ passed: 1, total: 1, rate: 1 });
    expect(report.metrics.traceCompleteness).toEqual({ passed: 3, total: 3, rate: 1 });
    expect(report.items.map((item) => item.passed)).toEqual([true, true, true]);
  });

  it("renders a markdown report that can replace docs/eval-report.md", () => {
    const report = evaluateFixtures(
      [
        {
          id: "insufficient-evidence",
          query: "What is missing?",
          expectedBehavior: "reject",
          expectedRelevantDocs: [],
          expectedRejectedDocs: [],
          requiredCitations: []
        }
      ],
      [
        {
          fixtureId: "insufficient-evidence",
          retrievedDocIds: [],
          rejectedDocIds: [],
          citationChunkIds: [],
          finalStatus: "rejected",
          unsupportedClaimRejected: true,
          traceComplete: true
        }
      ]
    );

    expect(renderEvalReportMarkdown(report)).toContain("| unsupported-claim rejection | 1/1 | 100% |");
  });

  it("computes recall@k and mean reciprocal rank for ranked retrieval observations", () => {
    const report = evaluateRankedRetrieval({
      k: 3,
      cases: [
        {
          id: "hybrid-retrieval",
          query: "Why not rely only on semantic vectors?",
          expectedRelevantDocIds: ["hybrid-retrieval-note"]
        },
        {
          id: "pgvector-index",
          query: "Which index supports cosine vector search?",
          expectedRelevantDocIds: ["pgvector-indexing-note"]
        },
        {
          id: "deployment-policy",
          query: "Which deployment policy is current?",
          expectedRelevantDocIds: ["deployment-policy-v2"]
        }
      ],
      observations: [
        {
          caseId: "hybrid-retrieval",
          rankedDocIds: ["hybrid-retrieval-note", "pgvector-indexing-note", "prompt-injection-note"]
        },
        {
          caseId: "pgvector-index",
          rankedDocIds: ["hybrid-retrieval-note", "pgvector-indexing-note", "prompt-injection-note"]
        },
        {
          caseId: "deployment-policy",
          rankedDocIds: ["deployment-policy-v1", "deployment-policy-v2", "hybrid-retrieval-note"]
        }
      ]
    });

    expect(report.summary).toEqual({
      total: 3,
      passed: 3,
      failed: 0
    });
    expect(report.metrics.recallAtK).toEqual({ passed: 3, total: 3, rate: 1 });
    expect(report.metrics.meanReciprocalRank).toBe(0.667);
    expect(report.items).toEqual([
      {
        id: "hybrid-retrieval",
        passed: true,
        reciprocalRank: 1,
        matchedDocId: "hybrid-retrieval-note",
        notes: ["first relevant doc at rank 1"]
      },
      {
        id: "pgvector-index",
        passed: true,
        reciprocalRank: 0.5,
        matchedDocId: "pgvector-indexing-note",
        notes: ["first relevant doc at rank 2"]
      },
      {
        id: "deployment-policy",
        passed: true,
        reciprocalRank: 0.5,
        matchedDocId: "deployment-policy-v2",
        notes: ["first relevant doc at rank 2"]
      }
    ]);
  });

  it("renders a ranked retrieval quality report for live pgvector smoke output", () => {
    const report = evaluateRankedRetrieval({
      k: 3,
      cases: [
        {
          id: "hybrid-retrieval",
          query: "Why not rely only on semantic vectors?",
          expectedRelevantDocIds: ["hybrid-retrieval-note"]
        }
      ],
      observations: [
        {
          caseId: "hybrid-retrieval",
          rankedDocIds: ["hybrid-retrieval-note", "pgvector-indexing-note", "prompt-injection-note"]
        }
      ]
    });

    expect(renderRankedRetrievalReportMarkdown(report)).toContain("| recall@3 | 1/1 | 100% |");
    expect(renderRankedRetrievalReportMarkdown(report)).toContain("| mean reciprocal rank | 1.000 |");
    expect(renderRankedRetrievalReportMarkdown(report)).toContain(
      "| hybrid-retrieval | pass | hybrid-retrieval-note | 1.000 | first relevant doc at rank 1 |"
    );
  });

  it("renders a retrieval mode comparison report with trade-off notes", () => {
    const lexical = evaluateRankedRetrieval({
      k: 3,
      cases: [
        {
          id: "exact-term",
          query: "Which document mentions HNSW?",
          expectedRelevantDocIds: ["pgvector-indexing-note"],
          category: "exact-token"
        }
      ],
      observations: [
        {
          caseId: "exact-term",
          rankedDocIds: ["pgvector-indexing-note", "hybrid-retrieval-note"]
        }
      ]
    });
    const vector = evaluateRankedRetrieval({
      k: 3,
      cases: [
        {
          id: "exact-term",
          query: "Which document mentions HNSW?",
          expectedRelevantDocIds: ["pgvector-indexing-note"],
          category: "exact-token"
        }
      ],
      observations: [
        {
          caseId: "exact-term",
          rankedDocIds: ["hybrid-retrieval-note", "pgvector-indexing-note"]
        }
      ]
    });

    const markdown = renderRetrievalModeComparisonReportMarkdown({
      k: 3,
      modes: [
        { mode: "lexical", report: lexical },
        { mode: "vector", report: vector }
      ],
      notes: [
        "Lexical protects exact terminology.",
        "Vector retrieval covers semantic paraphrase."
      ]
    });

    expect(markdown).toContain("# Retrieval Mode Comparison Report");
    expect(markdown).toContain("| lexical | 1/1 | 100% | 1.000 |");
    expect(markdown).toContain("| vector | 1/1 | 100% | 0.500 |");
    expect(markdown).toContain("| exact-token | lexical | 1/1 | 100% | 1.000 |");
    expect(markdown).toContain("| exact-term | lexical | exact-token | pass | pgvector-indexing-note | 1.000 |");
    expect(markdown).toContain("- Lexical protects exact terminology.");
  });

  it("renders a provider comparison report that separates default live provider from comparison adapter", () => {
    const markdown = renderProviderComparisonReportMarkdown({
      generatedAt: "2026-06-11",
      providers: [
        {
          provider: "openai-compatible",
          role: "default-live",
          requestSurface: "POST /chat/completions",
          setup: "OPENAI_API_KEY",
          liveSmoke: {
            status: "pass",
            model: "gpt-5.4-mini",
            claimCount: 4,
            citationCount: 4,
            tracePersisted: true
          },
          deterministicChecks: [
            "request-shape",
            "citation-validation",
            "empty-context-rejection",
            "malformed-json-redaction"
          ],
          tradeOffs: ["portable across OpenAI-compatible providers", "less OpenAI-native than Responses API"]
        },
        {
          provider: "anthropic",
          role: "comparison-adapter",
          requestSurface: "POST /messages",
          setup: "OPENAI_API_KEY + ANTHROPIC_API_KEY",
          liveSmoke: {
            status: "not-run",
            reason: "ANTHROPIC_API_KEY is not configured"
          },
          deterministicChecks: [
            "request-shape",
            "citation-validation",
            "empty-context-rejection",
            "malformed-json-redaction"
          ],
          tradeOffs: ["explicit provider selection", "no automatic fallback"]
        }
      ],
      notes: [
        "OpenAI remains required for embeddings.",
        "Provider comparison is explicit so setup errors are not hidden by fallback."
      ]
    });

    expect(markdown).toContain("# Provider Comparison Report");
    expect(markdown).toContain(
      "| openai-compatible | default-live | POST /chat/completions | OPENAI_API_KEY | pass | gpt-5.4-mini | 4 | 4 | yes | - |"
    );
    expect(markdown).toContain(
      "| anthropic | comparison-adapter | POST /messages | OPENAI_API_KEY + ANTHROPIC_API_KEY | not-run | - | - | - | - | ANTHROPIC_API_KEY is not configured |"
    );
    expect(markdown).toContain(
      "| anthropic | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction | explicit provider selection; no automatic fallback |"
    );
    expect(markdown).toContain("- Provider comparison is explicit so setup errors are not hidden by fallback.");
  });

  it("renders a retrieval latency report without exposing queries or provider payloads", () => {
    const markdown = renderRetrievalLatencyReportMarkdown({
      generatedAt: "2026-06-11",
      caseCount: 20,
      topK: 3,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      observations: [
        {
          mode: "embedding",
          sampleCount: 20,
          minMs: 41.21,
          p50Ms: 58.78,
          p95Ms: 104.49,
          maxMs: 120.9,
          totalMs: 1190.4
        },
        {
          mode: "hybrid",
          sampleCount: 20,
          minMs: 3.11,
          p50Ms: 7.24,
          p95Ms: 12.89,
          maxMs: 15.2,
          totalMs: 144.8
        }
      ],
      notes: ["Small sample smoke. Not a scale benchmark."]
    });

    expect(markdown).toContain("# Retrieval Latency Report");
    expect(markdown).toContain("Generated on 2026-06-11.");
    expect(markdown).toContain("20 retrieval eval cases at top 3.");
    expect(markdown).toContain("Embedding model: `text-embedding-3-small` (1536 dimensions).");
    expect(markdown).toContain("| embedding | 20 | 41.21 | 58.78 | 104.49 | 120.90 | 1190.40 |");
    expect(markdown).toContain("| hybrid | 20 | 3.11 | 7.24 | 12.89 | 15.20 | 144.80 |");
    expect(markdown).toContain("- Small sample smoke. Not a scale benchmark.");
    expect(markdown).not.toContain("Why not rely only on semantic vectors?");
    expect(markdown).not.toContain("Authorization");
  });

  it("renders a retrieval concurrency report without exposing queries or provider payloads", () => {
    const markdown = renderRetrievalConcurrencyReportMarkdown({
      generatedAt: "2026-06-11",
      caseCount: 20,
      topK: 3,
      observations: [
        {
          mode: "hybrid",
          concurrency: 4,
          queryCount: 20,
          minMs: 2.11,
          p50Ms: 7.24,
          p95Ms: 14.89,
          p99Ms: 17.75,
          maxMs: 18.2,
          totalMs: 62.8,
          errorCount: 0
        }
      ],
      notes: ["Embedding is precomputed so this isolates PostgreSQL retrieval concurrency."]
    });

    expect(markdown).toContain("# Retrieval Concurrency Report");
    expect(markdown).toContain("Generated on 2026-06-11.");
    expect(markdown).toContain("20 retrieval eval cases at top 3.");
    expect(markdown).toContain("| Mode | Concurrency | Queries | Min ms | P50 ms | P95 ms | P99 ms | Max ms | Total ms | Errors |");
    expect(markdown).toContain("| hybrid | 4 | 20 | 2.11 | 7.24 | 14.89 | 17.75 | 18.20 | 62.80 | 0 |");
    expect(markdown).toContain("- Embedding is precomputed so this isolates PostgreSQL retrieval concurrency.");
    expect(markdown).not.toContain("Why not rely only on semantic vectors?");
    expect(markdown).not.toContain("Authorization");
  });

  it("estimates 10M-document scale budgets from explicit assumptions", () => {
    const estimate = estimateScaleBudget({
      documentCount: 10_000_000,
      averageChunksPerDocument: 8,
      embeddingDimensions: 1536,
      embeddingBytesPerDimension: 4,
      metadataBytesPerChunk: 1024,
      averageTraceBytes: 4096,
      dailyQueryCount: 50_000,
      traceRetentionDays: 7
    });

    expect(estimate).toEqual({
      documentCount: 10_000_000,
      chunkCount: 80_000_000,
      vectorBytes: 491_520_000_000,
      metadataBytes: 81_920_000_000,
      vectorAndMetadataBytes: 573_440_000_000,
      retainedTraceBytes: 1_433_600_000
    });
  });

  it("renders a scale budget report as an estimate instead of a production claim", () => {
    const markdown = renderScaleBudgetReportMarkdown({
      generatedAt: "2026-06-11",
      assumptions: {
        documentCount: 10_000_000,
        averageChunksPerDocument: 8,
        embeddingDimensions: 1536,
        embeddingBytesPerDimension: 4,
        metadataBytesPerChunk: 1024,
        averageTraceBytes: 4096,
        dailyQueryCount: 50_000,
        traceRetentionDays: 7
      },
      notes: ["Sizing math only. No 10M-document load was executed."]
    });

    expect(markdown).toContain("# Scale Budget Report");
    expect(markdown).toContain("Generated on 2026-06-11.");
    expect(markdown).toContain("This is sizing math, not a production benchmark.");
    expect(markdown).toContain("| documents | 10,000,000 |");
    expect(markdown).toContain("| chunks | 80,000,000 |");
    expect(markdown).toContain("| vector storage | 491.52 GB |");
    expect(markdown).toContain("| vector + chunk metadata | 573.44 GB |");
    expect(markdown).toContain("| retained sanitized traces | 1.43 GB |");
    expect(markdown).toContain("- Sizing math only. No 10M-document load was executed.");
  });

  it("estimates vector index budget from explicit HNSW assumptions", () => {
    const estimate = estimateVectorIndexBudget({
      documentCount: 10_000_000,
      averageChunksPerDocument: 8,
      embeddingDimensions: 1536,
      embeddingBytesPerDimension: 4,
      metadataBytesPerChunk: 1024,
      hnswM: 16,
      hnswLayerMultiplier: 1.1,
      hnswGraphBytesPerNeighbor: 8,
      hnswBuildMemoryMultiplier: 2
    });

    expect(estimate).toEqual({
      documentCount: 10_000_000,
      chunkCount: 80_000_000,
      vectorBytes: 491_520_000_000,
      metadataBytes: 81_920_000_000,
      hnswGraphBytes: 11_264_000_000,
      hnswServingBytes: 584_704_000_000,
      hnswBuildWorkingSetBytes: 1_169_408_000_000,
      graphOverVectorRate: 0.023
    });
  });

  it("renders a vector index budget report as assumptions, not measured index size", () => {
    const markdown = renderVectorIndexBudgetReportMarkdown({
      generatedAt: "2026-06-11",
      assumptions: {
        documentCount: 10_000_000,
        averageChunksPerDocument: 8,
        embeddingDimensions: 1536,
        embeddingBytesPerDimension: 4,
        metadataBytesPerChunk: 1024,
        hnswM: 16,
        hnswLayerMultiplier: 1.1,
        hnswGraphBytesPerNeighbor: 8,
        hnswBuildMemoryMultiplier: 2
      },
      notes: ["HNSW graph math is an explicit scenario, not measured pgvector index size."]
    });

    expect(markdown).toContain("# Vector Index Budget Report");
    expect(markdown).toContain("Generated on 2026-06-11.");
    expect(markdown).toContain("This is sizing math, not measured PostgreSQL or pgvector index size.");
    expect(markdown).toContain("| HNSW m | 16 |");
    expect(markdown).toContain("| HNSW graph estimate | 11.26 GB |");
    expect(markdown).toContain("| vector + metadata + HNSW graph | 584.70 GB |");
    expect(markdown).toContain("| HNSW build working set estimate | 1169.41 GB |");
    expect(markdown).toContain("| graph overhead vs vector payload | 2.3% |");
    expect(markdown).toContain("- HNSW graph math is an explicit scenario, not measured pgvector index size.");
  });
});
