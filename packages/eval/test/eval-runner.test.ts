import { describe, expect, it } from "vitest";
import {
  estimateScaleBudget,
  estimateVectorIndexBudget,
  evaluateFixtures,
  evaluateRankedRetrieval,
  nearestRankPercentile,
  renderEvalReportMarkdown,
  renderRankedRetrievalReportMarkdown,
  renderProviderComparisonReportMarkdown,
  renderRetrievalConcurrencyReportMarkdown,
  renderRetrievalLatencyReportMarkdown,
  renderRetrievalModeComparisonReportMarkdown,
  renderScaleBudgetReportMarkdown,
  renderVectorIndexBudgetReportMarkdown,
  roundMilliseconds,
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

  it("renders a markdown report that can replace docs/reports/eval-report.md", () => {
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

    const markdown = renderEvalReportMarkdown(report);

    expect(markdown).toContain("# 평가 리포트");
    expect(markdown).toContain("## 읽는 법");
    expect(markdown).toContain("통과 수보다 어떤 보호 장치가 샘플 실행 관측으로 확인됐는지 먼저 본다.");
    expect(markdown).toContain("요약: 1/1 평가 사례 통과. 샘플 실행 관측 0건, 정적 평가 사례 1건.");
    expect(markdown).toContain("| 지원되지 않는 주장 거절 | 1/1 | 100% |");
  });

  it("surfaces observation sources so runtime pipeline observations are visible in the report", () => {
    const fixtures: EvalFixture[] = [
      {
        id: "insufficient-evidence",
        query: "What is missing?",
        expectedBehavior: "reject",
        expectedRelevantDocs: [],
        expectedRejectedDocs: [],
        requiredCitations: []
      },
      {
        id: "citation-per-claim",
        query: "What makes the answer evidence-bound?",
        expectedBehavior: "cite",
        expectedRelevantDocs: ["answer-guard-policy"],
        expectedRejectedDocs: [],
        requiredCitations: ["answer-guard-policy#chunk-002"]
      }
    ];

    const observations: EvalObservation[] = [
      {
        fixtureId: "insufficient-evidence",
        retrievedDocIds: [],
        rejectedDocIds: [],
        citationChunkIds: [],
        finalStatus: "rejected",
        unsupportedClaimRejected: true,
        traceComplete: true,
        observationSource: "sample-runtime"
      },
      {
        fixtureId: "citation-per-claim",
        retrievedDocIds: ["answer-guard-policy"],
        rejectedDocIds: [],
        citationChunkIds: ["answer-guard-policy#chunk-002"],
        finalStatus: "answered",
        unsupportedClaimRejected: false,
        traceComplete: true,
        observationSource: "static-fixture"
      }
    ];

    const report = evaluateFixtures(fixtures, observations);
    const markdown = renderEvalReportMarkdown(report);

    expect(report.observationSources).toEqual([
      { source: "sample-runtime", count: 1 },
      { source: "static-fixture", count: 1 }
    ]);
    expect(markdown).toContain("| sample-runtime | 1 |");
    expect(markdown).toContain("| static-fixture | 1 |");
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
        notes: ["첫 관련 문서 순위 1"]
      },
      {
        id: "pgvector-index",
        passed: true,
        reciprocalRank: 0.5,
        matchedDocId: "pgvector-indexing-note",
        notes: ["첫 관련 문서 순위 2"]
      },
      {
        id: "deployment-policy",
        passed: true,
        reciprocalRank: 0.5,
        matchedDocId: "deployment-policy-v2",
        notes: ["첫 관련 문서 순위 2"]
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

    const markdown = renderRankedRetrievalReportMarkdown(report);

    expect(markdown).toContain("## 읽는 법");
    expect(markdown).toContain("절대 점수보다 기대 문서가 top 3 안에 들어왔는지와 순위 위치를 본다.");
    expect(markdown).toContain("| recall@3 | 1/1 | 100% |");
    expect(markdown).toContain("| MRR | 1.000 |");
    expect(markdown).toContain(
      "| hybrid-retrieval | 통과 | hybrid-retrieval-note | 1.000 | 첫 관련 문서 순위 1 |"
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
        "키워드 검색은 정확한 용어를 보호한다.",
        "벡터 검색은 의미적 바꿔 쓰기를 처리한다."
      ]
    });

    expect(markdown).toContain("# 검색 모드 비교 리포트");
    expect(markdown).toContain("## 읽는 법");
    expect(markdown).toContain("모드별 승패보다 키워드, 벡터, hybrid가 어느 범주에서 차이 나는지 본다.");
    expect(markdown).toContain("| lexical | 1/1 | 100% | 1.000 |");
    expect(markdown).toContain("| vector | 1/1 | 100% | 0.500 |");
    expect(markdown).toContain("| exact-token | lexical | 1/1 | 100% | 1.000 |");
    expect(markdown).toContain("| exact-term | lexical | exact-token | 통과 | pgvector-indexing-note | 1.000 |");
    expect(markdown).toContain("- 키워드 검색은 정확한 용어를 보호한다.");
  });

  it("renders a provider comparison report without presenting deterministic rows as live validation", () => {
    const markdown = renderProviderComparisonReportMarkdown({
      generatedAt: "2026-06-11",
      providers: [
        {
          provider: "openai-compatible",
          role: "default-live",
          requestSurface: "POST /chat/completions",
          setup: "OPENAI_API_KEY",
          liveVerification: {
            command: "pnpm db:live-generation-smoke",
            status: "separate-command"
          },
          deterministicChecks: [
            "request-shape",
            "citation-validation",
            "empty-context-rejection",
            "malformed-json-redaction"
          ],
          tradeOffs: ["OpenAI 호환 LLM 제공자 전반에 옮겨 쓰기 쉬움", "Responses API보다 OpenAI 전용 성격은 약함"]
        },
        {
          provider: "anthropic",
          role: "comparison-adapter",
          requestSurface: "POST /messages",
          setup: "ANTHROPIC_API_KEY",
          liveVerification: {
            command: "pnpm db:live-generation-smoke",
            status: "not-run",
            reason: "ANTHROPIC_API_KEY가 설정되지 않음"
          },
          deterministicChecks: [
            "request-shape",
            "citation-validation",
            "empty-context-rejection",
            "malformed-json-redaction"
          ],
          tradeOffs: ["명시적 LLM 제공자 선택", "자동 대체 없음"]
        },
        {
          provider: "fake",
          role: "test-double",
          requestSurface: "in-process",
          setup: "none",
          liveVerification: {
            command: "none",
            status: "not-applicable",
            reason: "FakeLLMProvider는 결정적 CI/test 전용"
          },
          deterministicChecks: ["citation-shape", "empty-context-rejection"],
          tradeOffs: ["안정적인 평가 출력", "모델 품질 신호 아님"]
        }
      ],
      notes: [
        "임베딩에는 OpenAI가 계속 필요하다.",
        "LLM 제공자 비교는 명시적이므로 설정 오류가 자동 대체 뒤에 숨지 않는다."
      ]
    });

    expect(markdown).toContain("# LLM 제공자 비교 리포트");
    expect(markdown).toContain(
      "검증 범위: 결정적 어댑터 계약. 실제 생성 확인은 별도 명령 결과로 추적한다."
    );
    expect(markdown).toContain("- 어댑터 계약과 실제 검증 경계를 분리해서 본다.");
    expect(markdown).toContain(
      "| LLM 제공자 | 역할 | 요청 경로 | 생성 환경값 | 실제 검증 | 명령 | 이유 |"
    );
    expect(markdown).toContain(
      "| openai-compatible | default-live | POST /chat/completions | OPENAI_API_KEY | 별도 실행 필요 | pnpm db:live-generation-smoke | - |"
    );
    expect(markdown).toContain(
      "| anthropic | comparison-adapter | POST /messages | ANTHROPIC_API_KEY | 미실행 | pnpm db:live-generation-smoke | ANTHROPIC_API_KEY가 설정되지 않음 |"
    );
    expect(markdown).toContain(
      "| fake | test-double | in-process | none | 해당 없음 | none | FakeLLMProvider는 결정적 CI/test 전용 |"
    );
    expect(markdown).toContain(
      "| anthropic | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction | 명시적 LLM 제공자 선택; 자동 대체 없음 |"
    );
    expect(markdown).toContain("- LLM 제공자 비교는 명시적이므로 설정 오류가 자동 대체 뒤에 숨지 않는다.");
    expect(markdown).not.toContain("| 통과 | gpt-5.4-mini | 3 | 3 | 예 |");
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
      notes: ["현재 실행 환경의 지연 시간 변화 비교에 사용한다."]
    });

    expect(markdown).toContain("# 검색 지연 시간 리포트");
    expect(markdown).toContain("## 읽는 법");
    expect(markdown).toContain("임베딩 비용과 데이터베이스 검색 비용이 분리되어 보이는지 본다.");
    expect(markdown).toContain("생성일: 2026-06-11.");
    expect(markdown).toContain("검색 평가 사례 20개, top 3.");
    expect(markdown).toContain("임베딩 모델: `text-embedding-3-small` (1536차원).");
    expect(markdown).toContain("| embedding | 20 | 41.21 | 58.78 | 104.49 | 120.90 | 1190.40 |");
    expect(markdown).toContain("| hybrid | 20 | 3.11 | 7.24 | 12.89 | 15.20 | 144.80 |");
    expect(markdown).toContain("- 현재 실행 환경의 지연 시간 변화 비교에 사용한다.");
    expect(markdown).not.toContain("Why not rely only on semantic vectors?");
    expect(markdown).not.toContain("Authorization");
  });

  it("shares nearest-rank percentile and millisecond rounding for retrieval smoke summaries", () => {
    expect(nearestRankPercentile([2.111, 7.244, 14.899, 17.751], 0.5)).toBe(7.244);
    expect(nearestRankPercentile([2.111, 7.244, 14.899, 17.751], 0.95)).toBe(17.751);
    expect(nearestRankPercentile([], 0.95)).toBe(0);
    expect(roundMilliseconds(17.751)).toBe(17.75);
    expect(roundMilliseconds(17.755)).toBe(17.76);
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
      notes: ["임베딩은 미리 계산되어 PostgreSQL 검색 동시성만 분리한다."]
    });

    expect(markdown).toContain("# 검색 동시성 리포트");
    expect(markdown).toContain("## 읽는 법");
    expect(markdown).toContain("미리 계산한 임베딩 이후 데이터베이스 검색 경로의 압력을 본다.");
    expect(markdown).toContain("생성일: 2026-06-11.");
    expect(markdown).toContain("검색 평가 사례 20개, top 3.");
    expect(markdown).toContain("| 모드 | 동시성 | 질의 수 | Min ms | P50 ms | P95 ms | P99 ms | Max ms | Total ms | 오류 수 |");
    expect(markdown).toContain("| hybrid | 4 | 20 | 2.11 | 7.24 | 14.89 | 17.75 | 18.20 | 62.80 | 0 |");
    expect(markdown).toContain("- 임베딩은 미리 계산되어 PostgreSQL 검색 동시성만 분리한다.");
    expect(markdown).not.toContain("Why not rely only on semantic vectors?");
    expect(markdown).not.toContain("Authorization");
  });

  it("estimates scale scenario budgets from explicit assumptions", () => {
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
      notes: ["문서 수, 평균 청크 수, 임베딩 차원 가정에서 저장 공간 압력을 계산한다."]
    });

    expect(markdown).toContain("# 확장성 예산 리포트");
    expect(markdown).toContain("생성일: 2026-06-11.");
    expect(markdown).toContain("확장성 검토 기준을 명시한 가정으로 계산한 용량 추정이다.");
    expect(markdown).toContain("| 문서 수 | 10,000,000 |");
    expect(markdown).toContain("| 청크 수 | 80,000,000 |");
    expect(markdown).toContain("| 벡터 저장량 | 491.52 GB |");
    expect(markdown).toContain("| 벡터 + 청크 메타데이터 | 573.44 GB |");
    expect(markdown).toContain("| 보관되는 정리 추적 기록 | 1.43 GB |");
    expect(markdown).toContain("- 문서 수, 평균 청크 수, 임베딩 차원 가정에서 저장 공간 압력을 계산한다.");
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
      notes: ["HNSW 그래프 계산은 명시적 가정이며 pgvector 색인을 실측한 크기가 아니다."]
    });

    expect(markdown).toContain("# 벡터 색인 예산 리포트");
    expect(markdown).toContain("생성일: 2026-06-11.");
    expect(markdown).toContain(
      "요약: 문서 10,000,000개 / 청크 80,000,000개 기준 제공 세트 584.70 GB, 빌드 작업 메모리 1169.41 GB 추정."
    );
    expect(markdown).toContain("범위: 용량 추정이다. PostgreSQL 또는 pgvector 색인을 실측한 크기가 아니며 큰 색인 빌드는 실행하지 않았다.");
    expect(markdown).toContain("| HNSW m | 16 |");
    expect(markdown).toContain("| HNSW 그래프 추정치 | 11.26 GB |");
    expect(markdown).toContain("| 벡터 + 메타데이터 + HNSW 그래프 | 584.70 GB |");
    expect(markdown).toContain("| HNSW 빌드 작업 메모리 추정치 | 1169.41 GB |");
    expect(markdown).toContain("| 벡터 용량 대비 그래프 부가 비용 | 2.3% |");
    expect(markdown).toContain("- HNSW 그래프 계산은 명시적 가정이며 pgvector 색인을 실측한 크기가 아니다.");
  });
});
