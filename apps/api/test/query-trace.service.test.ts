import { describe, expect, it, vi } from "vitest";
import type { AppConfigService, QueryMode } from "../src/app.config";
import type { PgPool } from "../src/database.module";
import { QueryTraceService } from "../src/query-trace.service";

describe("QueryTraceService", () => {
  it("returns null without touching PostgreSQL when the API runs in sample mode", async () => {
    const pgPool = createPgPool();
    const service = new QueryTraceService(createConfig("sample"), pgPool);

    await expect(service.readLatest()).resolves.toBeNull();
    expect(pgPool.query).not.toHaveBeenCalled();
  });

  it("reads the latest sanitized trace from PostgreSQL in postgres mode", async () => {
    const pgPool = createPgPool([
      {
        id: "pg-trace-001",
        query: "Why not rely only on semantic vectors?",
        normalized_query: "why not rely only on semantic vectors?",
        selected_chunk_ids: ["hybrid-retrieval-note#chunk-001"],
        rejected: [],
        candidates: [],
        generation: {
          status: "answered",
          claims: []
        },
        sanitized: true,
        created_at: "2026-06-14T00:00:00.000Z"
      }
    ]);
    const service = new QueryTraceService(createConfig("postgres"), pgPool);

    await expect(service.readLatest()).resolves.toEqual({
      id: "pg-trace-001",
      query: "Why not rely only on semantic vectors?",
      normalizedQuery: "why not rely only on semantic vectors?",
      selectedChunkIds: ["hybrid-retrieval-note#chunk-001"],
      rejected: [],
      candidates: [],
      generation: {
        status: "answered",
        claims: []
      },
      sanitized: true,
      createdAt: "2026-06-14T00:00:00.000Z"
    });
    expect(pgPool.query).toHaveBeenCalledWith(expect.stringContaining("FROM query_traces"), []);
  });
});

function createConfig(queryMode: QueryMode): AppConfigService {
  return {
    queryMode
  } as AppConfigService;
}

function createPgPool(rows: unknown[] = []): PgPool {
  return {
    query: vi.fn(async () => ({ rows })),
    end: vi.fn()
  } as unknown as PgPool;
}
