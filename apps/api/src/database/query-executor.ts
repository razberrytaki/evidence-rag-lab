export interface QueryExecutor {
  query(text: string, values: unknown[]): Promise<{
    rows: unknown[];
  }>;
}
