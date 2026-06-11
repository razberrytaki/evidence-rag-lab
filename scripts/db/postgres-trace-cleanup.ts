import { join } from "node:path";
import { DEFAULT_TRACE_RETENTION_DAYS, MAX_TRACE_RETENTION_DAYS, runExpiredQueryTraceCleanup } from "@evidencerag/retrieval";
import { loadEnvFile } from "@evidencerag/ingest";
import { Client } from "pg";

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  await loadEnvFile(join(repoRoot, ".env"));

  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
  });

  await client.connect();
  try {
    const summary = await runExpiredQueryTraceCleanup({
      queryExecutor: client,
      retainForDays: parseRetentionDays(process.env.TRACE_RETENTION_DAYS)
    });

    console.log(
      JSON.stringify(
        {
          status: "ok",
          ...summary
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

function parseRetentionDays(value: string | undefined): number {
  if (!value) {
    return DEFAULT_TRACE_RETENTION_DAYS;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TRACE_RETENTION_DAYS) {
    throw new Error(`TRACE_RETENTION_DAYS must be between 1 and ${MAX_TRACE_RETENTION_DAYS}`);
  }
  return parsed;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
