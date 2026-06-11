import { Controller, Get, Inject, Optional } from "@nestjs/common";
import type { StoredQueryTrace } from "@evidencerag/retrieval";
import { readLatestQueryTraceFromEnv, type QueryTraceRuntimeEnv } from "./query-trace.repository";
import { QueryTraceService } from "./query-trace.service";

type QueryTraceReader = () => Promise<StoredQueryTrace | null>;

interface QueryTraceControllerDependencies {
  env?: QueryTraceRuntimeEnv;
  traceReader?: QueryTraceReader;
}

export const QUERY_TRACE_CONTROLLER_DEPENDENCIES = "QUERY_TRACE_CONTROLLER_DEPENDENCIES";

@Controller("query-traces")
export class QueryTraceController {
  constructor(
    @Optional()
    @Inject(QUERY_TRACE_CONTROLLER_DEPENDENCIES)
    private readonly dependencies: QueryTraceControllerDependencies = {},
    @Optional()
    private readonly queryTraceService?: QueryTraceService
  ) {}

  @Get("latest")
  async getLatestTrace(): Promise<StoredQueryTrace | null> {
    if (this.queryTraceService && !hasInjectedTraceReader(this.dependencies)) {
      return this.queryTraceService.readLatest();
    }

    const traceReader =
      this.dependencies.traceReader ?? (() => readLatestQueryTraceFromEnv(this.dependencies.env ?? process.env));
    return traceReader();
  }
}

function hasInjectedTraceReader(dependencies: QueryTraceControllerDependencies): boolean {
  return Boolean(dependencies.traceReader || dependencies.env);
}
