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
});

function createConfig(queryMode: QueryMode): AppConfigService {
  return {
    queryMode
  } as AppConfigService;
}

function createPgPool(): PgPool {
  return {
    query: vi.fn(),
    end: vi.fn()
  } as unknown as PgPool;
}
