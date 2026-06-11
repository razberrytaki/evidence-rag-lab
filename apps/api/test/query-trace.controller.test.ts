import { describe, expect, it } from "vitest";
import { QueryTraceController } from "../src/query-trace.controller";

describe("QueryTraceController", () => {
  it("returns the latest persisted sanitized trace through an injected reader", async () => {
    const controller = new QueryTraceController({
      traceReader: async () => ({
        id: "pg-trace-001",
        query: "Why not rely only on semantic vectors?",
        normalizedQuery: "why not rely only on semantic vectors?",
        selectedChunkIds: ["hybrid-retrieval-note#chunk-001"],
        rejected: [],
        candidates: [
          {
            chunkId: "hybrid-retrieval-note#chunk-001",
            documentId: "hybrid-retrieval-note",
            headingPath: ["Hybrid Retrieval Note"],
            score: {
              lexicalRank: 1,
              vectorRank: 2,
              fusedRank: 1,
              retrievalScore: 0.99,
              trustScore: 0.8,
              freshnessScore: 1,
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
      })
    });

    await expect(controller.getLatestTrace()).resolves.toMatchObject({
      id: "pg-trace-001",
      sanitized: true,
      selectedChunkIds: ["hybrid-retrieval-note#chunk-001"]
    });
  });
});
