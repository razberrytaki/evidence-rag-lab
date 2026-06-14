import { describe, expect, it } from "vitest";
import { makeDeterministicTraceId } from "../src/trace-id";

describe("trace id helpers", () => {
  it("builds deterministic trace ids with caller-owned prefixes", () => {
    const query = "Why not rely only on semantic vectors?";

    expect(makeDeterministicTraceId("trace", query)).toBe("trace-a2736fb5d005");
    expect(makeDeterministicTraceId("pg-trace", query)).toBe("pg-trace-a2736fb5d005");
  });
});
