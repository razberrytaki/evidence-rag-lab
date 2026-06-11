import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvFile, parseEnvFile } from "../src/env-file";

const openAiApiKey = "OPENAI" + "_API_KEY";

describe("env file parser", () => {
  it("parses simple dotenv values without exposing comments or surrounding quotes", () => {
    expect(
      parseEnvFile(`
# comment
${openAiApiKey}="secret value"
OPENAI_BASE_URL='https://api.openai.test/v1'
EMBEDDING_DIMENSIONS=1536
EMPTY=
      `)
    ).toEqual({
      OPENAI_API_KEY: "secret value",
      OPENAI_BASE_URL: "https://api.openai.test/v1",
      EMBEDDING_DIMENSIONS: "1536",
      EMPTY: ""
    });
  });

  it("rejects malformed keys so accidental shell fragments are not loaded", () => {
    expect(() => parseEnvFile(`export ${openAiApiKey}=secret`)).toThrow("invalid env key");
    expect(() => parseEnvFile("OPENAI-API-KEY=secret")).toThrow("invalid env key");
  });

  it("loads env files into a target object without overriding existing values by default", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evidence-rag-env-"));
    try {
      const envPath = join(directory, ".env");
      await writeFile(envPath, `${openAiApiKey}=file-secret\nDATABASE_URL=file-db\n`, "utf8");
      const target: Record<string, string | undefined> = {
        OPENAI_API_KEY: "existing-secret"
      };

      const loaded = await loadEnvFile(envPath, target);

      expect(loaded).toEqual({
        OPENAI_API_KEY: "file-secret",
        DATABASE_URL: "file-db"
      });
      expect(target).toEqual({
        OPENAI_API_KEY: "existing-secret",
        DATABASE_URL: "file-db"
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
