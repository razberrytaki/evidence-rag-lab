import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildExpiredQueryTraceDeleteSql } from "@evidencerag/retrieval";
import { loadEnvFile } from "@evidencerag/ingest";
import { Client } from "pg";

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";
const NOW = new Date("2026-06-11T00:00:00.000Z");
const OLD_TRACE_ID = "retention-smoke-old";
const FRESH_TRACE_ID = "retention-smoke-fresh";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  await loadEnvFile(join(repoRoot, ".env"));

  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
  });

  await client.connect();

  try {
    const schema = await readFile(join(repoRoot, "infra/postgres/init/001_schema.sql"), "utf8");
    await client.query(schema);
    await deleteSmokeRows(client);
    await insertSmokeTrace(client, OLD_TRACE_ID, "2026-06-01T00:00:00.000Z");
    await insertSmokeTrace(client, FRESH_TRACE_ID, "2026-06-10T00:00:00.000Z");

    const retentionSql = buildExpiredQueryTraceDeleteSql({
      now: NOW,
      retainForDays: 7
    });
    const deleted = await client.query<{ id: string }>(retentionSql.text, retentionSql.values);
    const remainingIds = await readSmokeTraceIds(client);

    if (!deleted.rows.some((row) => row.id === OLD_TRACE_ID)) {
      throw new Error("trace retention smoke did not delete the expired trace");
    }
    if (remainingIds.includes(OLD_TRACE_ID)) {
      throw new Error("trace retention smoke left the expired trace in place");
    }
    if (!remainingIds.includes(FRESH_TRACE_ID)) {
      throw new Error("trace retention smoke deleted the fresh trace");
    }

    console.log(
      JSON.stringify(
        {
          status: "ok",
          retentionDays: 7,
          cutoff: retentionSql.values[0],
          deletedTraceIds: deleted.rows.map((row) => row.id),
          remainingTraceIds: remainingIds
        },
        null,
        2
      )
    );
  } finally {
    await deleteSmokeRows(client);
    await client.end();
  }
}

async function insertSmokeTrace(client: Client, id: string, createdAt: string): Promise<void> {
  await client.query(
    `
INSERT INTO query_traces (
  id,
  query,
  normalized_query,
  selected_chunk_ids,
  rejected,
  candidates,
  generation,
  sanitized,
  created_at
) VALUES (
  $1,
  $2,
  $2,
  ARRAY[]::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '{"status":"rejected","reason":"insufficient_evidence","message":"retention smoke"}'::jsonb,
  true,
  $3::timestamptz
)
`,
    [id, "retention smoke", createdAt]
  );
}

async function readSmokeTraceIds(client: Client): Promise<string[]> {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM query_traces WHERE id = ANY($1::text[]) ORDER BY id ASC",
    [[OLD_TRACE_ID, FRESH_TRACE_ID]]
  );
  return result.rows.map((row) => row.id);
}

async function deleteSmokeRows(client: Client): Promise<void> {
  await client.query("DELETE FROM query_traces WHERE id = ANY($1::text[])", [
    [OLD_TRACE_ID, FRESH_TRACE_ID]
  ]);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
