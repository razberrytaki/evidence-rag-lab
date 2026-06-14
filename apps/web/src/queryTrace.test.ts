import { describe, expect, it } from "vitest";
import {
  buildTraceRows,
  fetchLatestTrace,
  fetchLatestTraceDeduped,
  runQuery,
  summarizeTrace,
  type PublicQueryTrace
} from "./queryTrace";

describe("query trace view model", () => {
  const trace = {
    id: "pg-trace-001",
    query: "Why not rely only on semantic vectors?",
    normalizedQuery: "why not rely only on semantic vectors?",
    selectedChunkIds: ["hybrid-retrieval-note#chunk-001"],
    rejected: [{ chunkId: "deployment-policy-v1#chunk-001", reason: "stale_source" }],
    candidates: [
      {
        chunkId: "hybrid-retrieval-note#chunk-001",
        documentId: "hybrid-retrieval-note",
        headingPath: ["Hybrid Retrieval Note"],
        score: {
          lexicalRank: 1,
          vectorRank: 2,
          fusedRank: 1,
          rerankRank: 1,
          rerankScore: 0.787,
          retrievalScore: 0.99,
          trustScore: 0.8,
          freshnessScore: 1,
          duplicatePenalty: 0
        }
      },
      {
        chunkId: "deployment-policy-v1#chunk-001",
        documentId: "deployment-policy-v1",
        headingPath: ["Deployment Policy v1"],
        score: {
          lexicalRank: 2,
          rerankRank: 2,
          rerankScore: 0.291,
          retrievalScore: 0.89,
          trustScore: 0.3,
          freshnessScore: 0.3,
          duplicatePenalty: 0
        }
      }
    ],
    generation: {
      status: "answered",
      claims: [
        {
          id: "claim-1",
          citations: [
            {
              documentId: "hybrid-retrieval-note",
              chunkId: "hybrid-retrieval-note#chunk-001"
            }
          ]
        }
      ]
    },
    sanitized: true,
    createdAt: "2026-06-11T08:00:00.000Z"
  } satisfies PublicQueryTrace;

  it("marks selected and rejected candidates from a persisted trace", () => {
    expect(buildTraceRows(trace)).toEqual([
      {
        stage: "Rerank 1",
        candidate: "hybrid-retrieval-note#chunk-001",
        score: "lex 1 / vec 2 / rerank 0.787 / trust 0.80",
        decision: "selected"
      },
      {
        stage: "Rerank 2",
        candidate: "deployment-policy-v1#chunk-001",
        score: "lex 2 / vec - / rerank 0.291 / trust 0.30",
        decision: "rejected"
      }
    ]);
  });

  it("summarizes citation coverage and sanitize state", () => {
    expect(summarizeTrace(trace)).toEqual({
      citationCoverage: "1/1 cited",
      unsupportedClaimPolicy: "reject",
      traceSanitize: "true"
    });
  });

  it("falls back to the bundled sample when the API has no persisted trace", async () => {
    const loaded = await fetchLatestTrace("http://127.0.0.1:3000", async () => ({
      ok: true,
      json: async () => null
    }));

    expect(loaded.source).toBe("sample");
    expect(loaded.trace.id).toBe("sample-trace");
  });

  it("falls back to the bundled sample when the API returns an invalid trace shape", async () => {
    const loaded = await fetchLatestTrace("http://127.0.0.1:3000", async () => ({
      ok: true,
      json: async () => ({
        id: "broken-trace",
        candidates: "not-an-array"
      })
    }));

    expect(loaded.source).toBe("sample");
    expect(loaded.trace.id).toBe("sample-trace");
  });

  it("posts a query and summarizes the generated answer without exposing raw context", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit) => {
      calls.push({ input, init });
      return {
        ok: true,
        json: async () => ({
          query: "Why not rely only on semantic vectors?",
          selectedContext: [
            {
              chunk: {
                id: "hybrid-retrieval-note#chunk-001",
                text: "raw chunk text must not be rendered"
              }
            }
          ],
          generation: {
            status: "answered",
            answer: "Hybrid retrieval keeps exact terms and semantic similarity visible.",
            claims: [
              {
                id: "claim-1",
                citations: [
                  {
                    documentId: "hybrid-retrieval-note",
                    chunkId: "hybrid-retrieval-note#chunk-001",
                    quote: "raw citation quote must not be rendered"
                  }
                ]
              }
            ]
          },
          trace: {
            selectedChunkIds: ["hybrid-retrieval-note#chunk-001"]
          }
        })
      };
    };

    const summary = await runQuery("http://127.0.0.1:3000/", "  Why not rely only on semantic vectors?  ", fetcher);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      input: "http://127.0.0.1:3000/query",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "Why not rely only on semantic vectors?" })
      }
    });
    expect(summary).toEqual({
      status: "answered",
      responseText: "Hybrid retrieval keeps exact terms and semantic similarity visible.",
      claimCount: 1,
      citationCount: 1,
      selectedChunkIds: ["hybrid-retrieval-note#chunk-001"]
    });
    expect(JSON.stringify(summary)).not.toContain("raw chunk text");
    expect(JSON.stringify(summary)).not.toContain("raw citation quote");
  });

  it("summarizes rejected query responses", async () => {
    const summary = await runQuery("http://127.0.0.1:3000", "Unknown internal incident", async () => ({
      ok: true,
      json: async () => ({
        generation: {
          status: "rejected",
          reason: "insufficient_evidence",
          message: "No selected context was available."
        },
        trace: {
          selectedChunkIds: []
        }
      })
    }));

    expect(summary).toEqual({
      status: "rejected",
      responseText: "No selected context was available.",
      rejectionReason: "insufficient_evidence",
      claimCount: 0,
      citationCount: 0,
      selectedChunkIds: []
    });
  });

  it("deduplicates concurrent latest trace requests for the same API base URL", async () => {
    let fetchCallCount = 0;
    let resolveTrace!: (trace: PublicQueryTrace) => void;
    const tracePayload = new Promise<PublicQueryTrace>((resolve) => {
      resolveTrace = resolve;
    });

    const fetcher = async () => {
      fetchCallCount += 1;
      return {
        ok: true,
        json: async () => tracePayload
      };
    };

    const firstLoad = fetchLatestTraceDeduped("http://127.0.0.1:3000/", fetcher);
    const secondLoad = fetchLatestTraceDeduped("http://127.0.0.1:3000", fetcher);

    expect(fetchCallCount).toBe(1);

    resolveTrace(trace);

    await expect(Promise.all([firstLoad, secondLoad])).resolves.toEqual([
      { source: "api", trace },
      { source: "api", trace }
    ]);
  });
});
