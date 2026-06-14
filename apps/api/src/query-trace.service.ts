import { Inject, Injectable } from "@nestjs/common";
import type { StoredQueryTrace } from "@evidencerag/retrieval";
import { AppConfigService } from "./app.config";
import { PG_POOL, type PgPool } from "./database.module";
import { readLatestQueryTrace } from "./query-trace.repository";

@Injectable()
export class QueryTraceService {
  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(PG_POOL) private readonly queryExecutor: PgPool
  ) {}

  readLatest(): Promise<StoredQueryTrace | null> {
    if (this.config.queryMode === "sample") {
      return Promise.resolve(null);
    }

    return readLatestQueryTrace(this.queryExecutor);
  }
}
