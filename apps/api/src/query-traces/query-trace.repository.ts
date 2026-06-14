import {
  buildLatestQueryTraceSql,
  mapPostgresQueryTraceRow,
  type PostgresQueryTraceRow,
  type StoredQueryTrace
} from "@evidencerag/retrieval";

export interface QueryTraceExecutor {
  query(text: string, values: unknown[]): Promise<{
    rows: unknown[];
  }>;
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
