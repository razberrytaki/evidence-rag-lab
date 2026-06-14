import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { GeneratedAnswer, GenerationResult } from "@evidencerag/domain";
import {
  buildPostgresIngestPlan,
  executePostgresIngestPlan,
  loadEmbeddedMarkdownDocumentSet,
  loadEnvFile,
  loadOpenAIEmbeddingConfigFromEnv,
  OpenAIEmbeddingClient
} from "@evidencerag/ingest";
import {
  resolveProviderConfig
} from "@evidencerag/generation";
import { Client } from "pg";
import { createLiveLLMProvider, runPostgresRagPipeline } from "../../apps/api/src/postgres-rag.pipeline";

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";
const DEFAULT_QUERY = "Why not rely only on semantic vectors?";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  await loadEnvFile(join(repoRoot, ".env"));

  const providerConfig = resolveProviderConfig(process.env, "live");

  const embeddingConfig = loadOpenAIEmbeddingConfigFromEnv(process.env);
  const embeddingProvider = new OpenAIEmbeddingClient(embeddingConfig);
  const llmProvider = createLiveLLMProvider(providerConfig, process.env);
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
  });

  await client.connect();

  try {
    const schema = await readFile(join(repoRoot, "infra/postgres/init/001_schema.sql"), "utf8");
    await client.query(schema);

    const documents = await loadEmbeddedMarkdownDocumentSet(join(repoRoot, "sample-docs"), embeddingProvider);
    const plan = buildPostgresIngestPlan({ documents });
    const ingestSummary = await executePostgresIngestPlan(client, plan);
    const queryResult = await runPostgresRagPipeline({
      question: process.env.LIVE_GENERATION_SMOKE_QUERY ?? DEFAULT_QUERY,
      embeddingProvider,
      llmProvider,
      modelConfig: {
        provider: providerConfig.llmProvider,
        model: providerConfig.chatModel
      },
      queryExecutor: client,
      persistTrace: true,
      topK: 3
    });
    const tracePersisted = await queryTraceExists(client, queryResult.trace.id);
    const generation = requireAnsweredGeneration(queryResult.generation);
    const selectedChunkIds = new Set(queryResult.selectedContext.map((result) => result.chunk.id));
    const citationCount = generation.claims.reduce((sum, claim) => sum + claim.citations.length, 0);

    if (!generation.claims.every((claim) => claim.citations.length > 0)) {
      throw new Error("live generation smoke returned a claim without citations");
    }
    for (const claim of generation.claims) {
      for (const citation of claim.citations) {
        if (!selectedChunkIds.has(citation.chunkId)) {
          throw new Error(`live generation smoke cited a non-selected chunk: ${citation.chunkId}`);
        }
      }
    }
    if (!tracePersisted) {
      throw new Error("live generation smoke did not persist the sanitized query trace");
    }

    console.log(
      JSON.stringify(
        {
          status: "ok",
          embeddingModel: embeddingConfig.model,
          embeddingDimensions: embeddingConfig.dimensions,
          generationProvider: providerConfig.llmProvider,
          chatModel: providerConfig.chatModel,
          statementCount: ingestSummary.statementCount,
          tracePersisted,
          selectedChunkIds: queryResult.selectedContext.map((result) => result.chunk.id),
          generationStatus: generation.status,
          claimCount: generation.claims.length,
          citationCount
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

function requireAnsweredGeneration(generation: GenerationResult): GeneratedAnswer {
  if (generation.status === "rejected") {
    throw new Error(`live generation smoke rejected answer: ${generation.reason}`);
  }
  return generation;
}

async function queryTraceExists(client: Client, id: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM query_traces WHERE id = $1 AND sanitized = true) AS exists",
    [id]
  );
  return result.rows[0]?.exists === true;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
