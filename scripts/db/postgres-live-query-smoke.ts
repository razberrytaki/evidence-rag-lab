import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import {
  buildPostgresIngestPlan,
  executePostgresIngestPlan,
  loadEmbeddedMarkdownDocumentSet,
  loadEnvFile,
  loadOpenAIEmbeddingConfigFromEnv,
  OpenAIEmbeddingClient
} from "@evidencerag/ingest";
import { runPostgresRagPipeline } from "../../apps/api/src/postgres-rag.pipeline";

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";
const DEFAULT_QUERY = "Why not rely only on semantic vectors?";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  await loadEnvFile(join(repoRoot, ".env"));

  const embeddingConfig = loadOpenAIEmbeddingConfigFromEnv(process.env);
  const embeddingProvider = new OpenAIEmbeddingClient(embeddingConfig);
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
  });

  await client.connect();

  try {
    const schema = await readFile(join(repoRoot, "infra/postgres/init/001_schema.sql"), "utf8");
    await client.query(schema);

    const documents = await loadEmbeddedMarkdownDocumentSet(
      join(repoRoot, "sample-docs"),
      embeddingProvider
    );
    const plan = buildPostgresIngestPlan({ documents });
    const ingestSummary = await executePostgresIngestPlan(client, plan);
    const documentIds = documents.map((document) => document.source.id);
    const chunkIds = documents.flatMap((document) => document.chunks.map((chunk) => chunk.chunk.id));
    const documentCount = await countRows(client, "source_documents", documentIds);
    const chunkCount = await countRows(client, "document_chunks", chunkIds);
    const embeddedChunkCount = await countEmbeddedChunks(client, chunkIds);
    const queryResult = await runPostgresRagPipeline({
      question: process.env.LIVE_SMOKE_QUERY ?? DEFAULT_QUERY,
      embeddingProvider,
      queryExecutor: client,
      persistTrace: true,
      topK: 3
    });
    const tracePersisted = await queryTraceExists(client, queryResult.trace.id);

    if (documentCount !== documents.length) {
      throw new Error(`expected ${documents.length} sample documents, found ${documentCount}`);
    }
    if (chunkCount !== chunkIds.length) {
      throw new Error(`expected ${chunkIds.length} sample chunks, found ${chunkCount}`);
    }
    if (embeddedChunkCount !== chunkIds.length) {
      throw new Error(`expected ${chunkIds.length} embedded chunks, found ${embeddedChunkCount}`);
    }
    if (!queryResult.selectedContext.some((result) => result.chunk.documentId === "hybrid-retrieval-note")) {
      throw new Error("hybrid-retrieval-note was not selected by live PostgreSQL query smoke");
    }
    if (!queryResult.trace.sanitized) {
      throw new Error("live PostgreSQL query smoke returned an unsanitized trace");
    }
    if (!tracePersisted) {
      throw new Error("live PostgreSQL query smoke did not persist the sanitized query trace");
    }

    console.log(
      JSON.stringify(
        {
          status: "ok",
          embeddingModel: embeddingConfig.model,
          embeddingDimensions: embeddingConfig.dimensions,
          statementCount: ingestSummary.statementCount,
          documentCount,
          chunkCount,
          embeddedChunkCount,
          tracePersisted,
          selectedChunkIds: queryResult.selectedContext.map((result) => result.chunk.id),
          generationStatus: queryResult.generation.status
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

async function countRows(client: Client, tableName: "source_documents" | "document_chunks", ids: string[]): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT count(*) AS count FROM ${tableName} WHERE id = ANY($1::text[])`,
    [ids]
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function countEmbeddedChunks(client: Client, ids: string[]): Promise<number> {
  const result = await client.query<{ count: string }>(
    "SELECT count(*) AS count FROM document_chunks WHERE id = ANY($1::text[]) AND embedding IS NOT NULL",
    [ids]
  );
  return Number(result.rows[0]?.count ?? 0);
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
