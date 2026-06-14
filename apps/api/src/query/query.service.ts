import { Inject, Injectable } from "@nestjs/common";
import { AppConfigService } from "../config/app.config";
import { PG_POOL, type PgPool } from "../database/database.module";
import {
  runPostgresRagPipelineWithExecutorFromEnv,
  type PostgresRagRuntimeEnv,
  type PostgresRagPipelineResult
} from "../rag/postgres/postgres-rag.pipeline";
import type { SampleRagPipelineResult } from "../rag/sample/sample-rag.pipeline";
import { findSampleDocsDir, runSampleRagPipeline } from "../rag/sample/sample-rag.pipeline";

export const QUERY_PIPELINE_RUNNER = Symbol("QUERY_PIPELINE_RUNNER");

export interface QueryPipelineRunner {
  runSample(question: string): Promise<SampleRagPipelineResult>;
  runPostgres(
    question: string,
    queryExecutor: PgPool,
    env: PostgresRagRuntimeEnv
  ): Promise<PostgresRagPipelineResult>;
}

export const defaultQueryPipelineRunner: QueryPipelineRunner = {
  runSample: (question: string) =>
    runSampleRagPipeline({
      question,
      sampleDocsDir: findSampleDocsDir()
    }),
  runPostgres: runPostgresRagPipelineWithExecutorFromEnv
};

@Injectable()
export class QueryService {
  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(PG_POOL) private readonly queryExecutor: PgPool,
    @Inject(QUERY_PIPELINE_RUNNER)
    private readonly runner: QueryPipelineRunner
  ) {}

  async query(question: string): Promise<SampleRagPipelineResult | PostgresRagPipelineResult> {
    if (this.config.queryMode === "postgres") {
      return this.runner.runPostgres(question, this.queryExecutor, this.config.providerEnv);
    }

    return this.runner.runSample(question);
  }
}
