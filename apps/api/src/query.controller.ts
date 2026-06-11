import { Body, Controller, Inject, Optional, Post, ValidationPipe } from "@nestjs/common";
import { findSampleDocsDir, runSampleRagPipeline } from "./sample-rag.pipeline";
import { runPostgresRagPipelineFromEnv } from "./postgres-rag.pipeline";
import { parseQueryMode } from "./app.config";
import { QueryRequestDto } from "./query-request.dto";
import { QueryService } from "./query.service";

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
    private readonly dependencies: QueryControllerDependencies = {},
    @Optional()
    private readonly queryService?: QueryService
  ) {}

  @Post()
  async query(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: QueryRequestDto
      })
    )
    body: QueryRequestDto
  ) {
    if (this.queryService && !hasInjectedRunners(this.dependencies)) {
      return this.queryService.query(body.question);
    }

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
  return parseQueryMode(env.RAG_QUERY_MODE);
}

function hasInjectedRunners(dependencies: QueryControllerDependencies): boolean {
  return Boolean(dependencies.sampleRunner || dependencies.postgresRunner || dependencies.env);
}
