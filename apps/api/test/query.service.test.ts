import { describe, expect, it, vi } from "vitest";
import type { AppConfigService, QueryMode } from "../src/app.config";
import type { PgPool } from "../src/database.module";
import { QueryService, type QueryPipelineRunner } from "../src/query.service";

describe("QueryService", () => {
  it("routes sample-mode questions through the sample pipeline runner", async () => {
    const runner = createRunner();
    const service = new QueryService(createConfig("sample"), createPgPool(), runner);

    await expect(service.query("How does hybrid retrieval work?")).resolves.toEqual({
      mode: "sample",
      question: "How does hybrid retrieval work?"
    });
    expect(runner.runSample).toHaveBeenCalledWith("How does hybrid retrieval work?");
    expect(runner.runPostgres).not.toHaveBeenCalled();
  });

  it("routes postgres-mode questions through the PostgreSQL pipeline runner", async () => {
    const runner = createRunner();
    const pgPool = createPgPool();
    const config = createConfig("postgres");
    const service = new QueryService(config, pgPool, runner);

    await expect(service.query("Why not rely only on semantic vectors?")).resolves.toEqual({
      mode: "postgres",
      question: "Why not rely only on semantic vectors?"
    });
    expect(runner.runPostgres).toHaveBeenCalledWith(
      "Why not rely only on semantic vectors?",
      pgPool,
      config.providerEnv
    );
    expect(runner.runSample).not.toHaveBeenCalled();
  });
});

function createRunner(): QueryPipelineRunner {
  return {
    runSample: vi.fn(async (question: string) => ({
      mode: "sample",
      question
    })),
    runPostgres: vi.fn(async (question: string) => ({
      mode: "postgres",
      question
    }))
  } as QueryPipelineRunner;
}

function createConfig(queryMode: QueryMode): AppConfigService {
  return {
    queryMode,
    providerEnv: {
      OPENAI_API_KEY: "test-openai-key",
      LLM_PROVIDER: "openai-compatible"
    }
  } as AppConfigService;
}

function createPgPool(): PgPool {
  return {
    query: vi.fn(),
    end: vi.fn()
  } as unknown as PgPool;
}
