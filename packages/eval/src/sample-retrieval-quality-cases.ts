import type { RankedRetrievalCase } from "./index";

export const sampleRetrievalQualityCases: RankedRetrievalCase[] = [
  {
    id: "hybrid-retrieval",
    query: "Why not rely only on semantic vectors?",
    expectedRelevantDocIds: ["hybrid-retrieval-note"],
    category: "semantic"
  },
  {
    id: "pgvector-hnsw",
    query: "Which PostgreSQL extension supports HNSW vector search?",
    expectedRelevantDocIds: ["pgvector-indexing-note"],
    category: "semantic"
  },
  {
    id: "deployment-policy-current",
    query: "Which deployment policy requires citation coverage and weak evidence rejection?",
    expectedRelevantDocIds: ["deployment-policy-v2"],
    category: "version-conflict"
  },
  {
    id: "prompt-injection-document-text",
    query: "How should a document instruction that says ignore previous rules be treated?",
    expectedRelevantDocIds: ["prompt-injection-note"],
    category: "answer-guard"
  },
  {
    id: "deployment-policy-stale",
    query: "Which stale deployment policy said approval can be completed without citation coverage?",
    expectedRelevantDocIds: ["deployment-policy-v1"],
    category: "version-conflict"
  },
  {
    id: "chunking-boundary",
    query: "Which note explains heading-aware recursive chunking and stable chunk boundaries?",
    expectedRelevantDocIds: ["chunking-strategy-note"],
    category: "retrieval-design"
  },
  {
    id: "parent-child-retrieval",
    query: "Which retrieval pattern uses child chunks for search and parent context for grounding?",
    expectedRelevantDocIds: ["parent-child-retrieval-note"],
    category: "retrieval-design"
  },
  {
    id: "reranker-latency-budget",
    query: "Which note describes keeping reranker latency within a fixed budget?",
    expectedRelevantDocIds: ["reranker-latency-note"],
    category: "retrieval-design"
  },
  {
    id: "source-trust-score",
    query: "Which note combines source type, freshness, duplicate penalty, and retrieval agreement?",
    expectedRelevantDocIds: ["source-trust-note"],
    category: "trust-observability"
  },
  {
    id: "citation-validation",
    query: "Which note says unknown cited chunk ids must cause citation validation failure?",
    expectedRelevantDocIds: ["citation-validation-note"],
    category: "answer-guard"
  },
  {
    id: "insufficient-evidence-rejection",
    query: "Which note says low confidence or missing citation coverage should reject the answer?",
    expectedRelevantDocIds: ["insufficient-evidence-note"],
    category: "answer-guard"
  },
  {
    id: "trace-observability",
    query: "Which note records candidate ranks, selected chunk ids, rejected reasons, and generation status?",
    expectedRelevantDocIds: ["trace-observability-note"],
    category: "trust-observability"
  },
  {
    id: "retrieval-cache-invalidation",
    query: "Which note keys retrieval cache entries by normalized query, index version, and retrieval configuration?",
    expectedRelevantDocIds: ["retrieval-cache-note"],
    category: "retrieval-design"
  },
  {
    id: "version-history",
    query: "Which note keeps document version and chunk version separate for audit?",
    expectedRelevantDocIds: ["version-history-note"],
    category: "version-conflict"
  },
  {
    id: "duplicate-detection",
    query: "Which note uses content hashes to prevent duplicate chunks from crowding out distinct evidence?",
    expectedRelevantDocIds: ["duplicate-detection-note"],
    category: "trust-observability"
  },
  {
    id: "rag-query-mode-config-key",
    query: "Which note names the exact config key RAG_QUERY_MODE=postgres?",
    expectedRelevantDocIds: ["config-key-routing-note"],
    category: "exact-token"
  },
  {
    id: "unknown-chunk-error-code",
    query: "Which note explains the exact error code RAG-0427?",
    expectedRelevantDocIds: ["error-code-runbook-note"],
    category: "exact-token"
  },
  {
    id: "selected-chunk-ids-field",
    query: "Which note defines the exact trace field selectedChunkIds?",
    expectedRelevantDocIds: ["api-field-contract-note"],
    category: "exact-token"
  },
  {
    id: "rrf-acronym-collision",
    query: "Which note distinguishes the acronym RRF from RAG?",
    expectedRelevantDocIds: ["acronym-collision-note"],
    category: "exact-token"
  },
  {
    id: "runbook-id-rollback",
    query: "Which note names rollback runbook RB-17A?",
    expectedRelevantDocIds: ["runbook-id-rollback-note"],
    category: "exact-token"
  }
];
