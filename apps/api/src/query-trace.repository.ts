import {
  buildLatestQueryTraceSql,
  mapPostgresQueryTraceRow,
  type PostgresQueryTraceRow,
  type StoredQueryTrace
} from "@evidencerag/retrieval";

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";

export interface QueryTraceExecutor {
  query(text: string, values: unknown[]): Promise<{
    rows: unknown[];
  }>;
}

export interface ConnectableQueryTraceExecutor extends QueryTraceExecutor {
  connect(): Promise<void>;
  end(): Promise<void>;
}

export interface QueryTraceRuntimeEnv {
  DATABASE_URL?: string;
}

export async function readLatestQueryTrace(queryExecutor: QueryTraceExecutor): Promise<StoredQueryTrace | null> {
  const sql = buildLatestQueryTraceSql();
  const result = await queryExecutor.query(sql.text, sql.values);
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return mapPostgresQueryTraceRow(row as PostgresQueryTraceRow);
}

export async function readLatestQueryTraceFromEnv(
  env: QueryTraceRuntimeEnv = process.env
): Promise<StoredQueryTrace | null> {
  const client = createPgClient(env.DATABASE_URL ?? DEFAULT_DATABASE_URL);

  await client.connect();
  try {
    return await readLatestQueryTrace(client);
  } finally {
    await client.end();
  }
}

function createPgClient(connectionString: string): ConnectableQueryTraceExecutor {
  const pg = require("pg") as {
    Client: new (config: { connectionString: string }) => ConnectableQueryTraceExecutor;
  };
  return new pg.Client({ connectionString });
}
