import { Controller, Get, Inject, Optional } from "@nestjs/common";
import type { StoredQueryTrace } from "@evidencerag/retrieval";
import { readLatestQueryTraceFromEnv, type QueryTraceRuntimeEnv } from "./query-trace.repository";

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
    private readonly dependencies: QueryTraceControllerDependencies = {}
  ) {}

  @Get("latest")
  async getLatestTrace(): Promise<StoredQueryTrace | null> {
    const traceReader =
      this.dependencies.traceReader ?? (() => readLatestQueryTraceFromEnv(this.dependencies.env ?? process.env));
    return traceReader();
  }
}
