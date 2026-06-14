import { createHash } from "node:crypto";

export function makeDeterministicTraceId(prefix: string, query: string): string {
  return `${prefix}-${createHash("sha256").update(query).digest("hex").slice(0, 12)}`;
}
