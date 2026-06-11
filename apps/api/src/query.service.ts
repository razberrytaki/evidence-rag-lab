import { Inject, Injectable } from "@nestjs/common";
import type { SampleRagPipelineResult } from "./sample-rag.pipeline";
import { findSampleDocsDir, runSampleRagPipeline } from "./sample-rag.pipeline";
import {
  runPostgresRagPipelineWithExecutorFromEnv,
  type PostgresRagPipelineResult
} from "./postgres-rag.pipeline";
import { AppConfigService } from "./app.config";
import { PG_POOL, type PgPool } from "./database.module";

@Injectable()
export class QueryService {
  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(PG_POOL) private readonly queryExecutor: PgPool
  ) {}

  async query(question: string): Promise<SampleRagPipelineResult | PostgresRagPipelineResult> {
    if (this.config.queryMode === "postgres") {
      return runPostgresRagPipelineWithExecutorFromEnv(question, this.queryExecutor, this.config.providerEnv);
    }

    return runSampleRagPipeline({
      question,
      sampleDocsDir: findSampleDocsDir()
    });
  }
}
