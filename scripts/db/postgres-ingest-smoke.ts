import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import {
  buildPostgresIngestPlan,
  executePostgresIngestPlan,
  loadMarkdownDocumentSet
} from "@evidencerag/ingest";
import { buildPostgresHybridRetrievalSql, mapPostgresRetrievalRow } from "@evidencerag/retrieval";

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
  });

  await client.connect();

  try {
    const schema = await readFile(join(repoRoot, "infra/postgres/init/001_schema.sql"), "utf8");
    await client.query(schema);

    const documents = await loadMarkdownDocumentSet(join(repoRoot, "sample-docs"));
    const plan = buildPostgresIngestPlan({ documents });
    const ingestSummary = await executePostgresIngestPlan(client, plan);
    const documentIds = documents.map((document) => document.source.id);
    const chunkIds = documents.flatMap((document) => document.chunks.map((chunk) => chunk.chunk.id));

    const documentCount = await countRows(client, "source_documents", documentIds);
    const chunkCount = await countRows(client, "document_chunks", chunkIds);
    const retrievalSql = buildPostgresHybridRetrievalSql({
      query: "semantic vectors",
      embedding: Array.from({ length: 1536 }, () => 0),
      topK: 3
    });
    const retrievalRows = await client.query(retrievalSql.text, retrievalSql.values);
    const retrievalResults = retrievalRows.rows.map(mapPostgresRetrievalRow);

    if (documentCount !== documents.length) {
      throw new Error(`expected ${documents.length} sample documents, found ${documentCount}`);
    }
    if (chunkCount !== chunkIds.length) {
      throw new Error(`expected ${chunkIds.length} sample chunks, found ${chunkCount}`);
    }
    if (!retrievalResults.some((result) => result.chunk.documentId === "hybrid-retrieval-note")) {
      throw new Error("hybrid-retrieval-note was not retrieved for semantic vectors smoke query");
    }

    console.log(
      JSON.stringify(
        {
          status: "ok",
          statementCount: ingestSummary.statementCount,
          documentCount,
          chunkCount,
          topChunkIds: retrievalResults.map((result) => result.chunk.id)
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
