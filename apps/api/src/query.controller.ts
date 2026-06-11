import { Body, Controller, Inject, Optional, Post } from "@nestjs/common";
import { findSampleDocsDir, runSampleRagPipeline } from "./sample-rag.pipeline";
import { runPostgresRagPipelineFromEnv } from "./postgres-rag.pipeline";

interface QueryRequest {
  question: string;
}

type QueryRunner = (question: string) => Promise<unknown>;

interface QueryControllerDependencies {
  env?: Record<string, string | undefined>;
  sampleRunner?: QueryRunner;
  postgresRunner?: QueryRunner;
}

export const QUERY_CONTROLLER_DEPENDENCIES = "QUERY_CONTROLLER_DEPENDENCIES";

@Controller("query")
export class QueryController {
  constructor(
    @Optional()
    @Inject(QUERY_CONTROLLER_DEPENDENCIES)
    private readonly dependencies: QueryControllerDependencies = {}
  ) {}

  @Post()
  async query(@Body() body: QueryRequest) {
    if (resolveQueryMode(this.dependencies.env ?? process.env) === "postgres") {
      const postgresRunner = this.dependencies.postgresRunner ?? runPostgresRagPipelineFromEnv;
      return postgresRunner(body.question);
    }

    const sampleRunner =
      this.dependencies.sampleRunner ??
      ((question: string) =>
        runSampleRagPipeline({
          question,
          sampleDocsDir: findSampleDocsDir()
        }));
    return sampleRunner(body.question);
  }
}

export function resolveQueryMode(env: Record<string, string | undefined>): "sample" | "postgres" {
  const mode = (env.RAG_QUERY_MODE ?? "sample").trim().toLowerCase();
  if (mode === "sample" || mode === "postgres") {
    return mode;
  }
  throw new Error(`unsupported RAG_QUERY_MODE: ${env.RAG_QUERY_MODE}`);
}
