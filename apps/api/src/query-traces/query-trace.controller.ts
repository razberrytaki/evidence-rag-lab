import { Controller, Get, Inject } from "@nestjs/common";
import type { StoredQueryTrace } from "@evidencerag/retrieval";
import { QueryTraceService } from "./query-trace.service";

@Controller("query-traces")
export class QueryTraceController {
  constructor(@Inject(QueryTraceService) private readonly queryTraceService: QueryTraceService) {}

  @Get("latest")
  async getLatestTrace(): Promise<StoredQueryTrace | null> {
    return this.queryTraceService.readLatest();
  }
}
