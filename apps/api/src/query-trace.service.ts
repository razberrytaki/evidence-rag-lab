import { Inject, Injectable } from "@nestjs/common";
import type { StoredQueryTrace } from "@evidencerag/retrieval";
import { PG_POOL, type PgPool } from "./database.module";
import { readLatestQueryTrace } from "./query-trace.repository";

@Injectable()
export class QueryTraceService {
  constructor(@Inject(PG_POOL) private readonly queryExecutor: PgPool) {}

  readLatest(): Promise<StoredQueryTrace | null> {
    return readLatestQueryTrace(this.queryExecutor);
  }
}
