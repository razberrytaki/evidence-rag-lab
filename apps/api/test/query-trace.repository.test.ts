import { describe, expect, it } from "vitest";
import { readLatestQueryTrace } from "../src/query-trace.repository";

describe("query trace repository", () => {
  it("reads and maps the latest sanitized query trace", async () => {
    const executed: Array<{ text: string; values: unknown[] }> = [];

    const trace = await readLatestQueryTrace({
      async query(text, values) {
        executed.push({ text, values });
        return {
          rows: [
            {
              id: "pg-trace-001",
              query: "Why not rely only on semantic vectors?",
              normalized_query: "why not rely only on semantic vectors?",
              selected_chunk_ids: ["hybrid-retrieval-note#chunk-001"],
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
              created_at: "2026-06-11T08:00:00.000Z"
            }
          ]
        };
      }
    });

    expect(executed).toHaveLength(1);
    expect(executed[0]?.text).toContain("WHERE sanitized = true");
    expect(executed[0]?.values).toEqual([]);
    expect(trace?.id).toBe("pg-trace-001");
    expect(trace?.candidates[0]?.chunkId).toBe("hybrid-retrieval-note#chunk-001");
  });

  it("returns null when no trace has been persisted yet", async () => {
    const trace = await readLatestQueryTrace({
      async query() {
        return { rows: [] };
      }
    });

    expect(trace).toBeNull();
  });
});
