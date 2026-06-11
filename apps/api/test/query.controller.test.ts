import { describe, expect, it } from "vitest";
import { QueryController } from "../src/query.controller";

describe("QueryController", () => {
  it("uses the sample pipeline by default", async () => {
    const controller = new QueryController({
      env: {},
      sampleRunner: async () => ({ mode: "sample" }),
      postgresRunner: async () => ({ mode: "postgres" })
    });

    await expect(controller.query({ question: "How does hybrid retrieval work?" })).resolves.toEqual({
      mode: "sample"
    });
  });

  it("uses the PostgreSQL-backed pipeline when RAG_QUERY_MODE is postgres", async () => {
    const controller = new QueryController({
      env: {
        RAG_QUERY_MODE: "postgres"
      },
      sampleRunner: async () => ({ mode: "sample" }),
      postgresRunner: async (question) => ({ mode: "postgres", question })
    });

    await expect(controller.query({ question: "Why not rely only on semantic vectors?" })).resolves.toEqual({
      mode: "postgres",
      question: "Why not rely only on semantic vectors?"
    });
  });
});
