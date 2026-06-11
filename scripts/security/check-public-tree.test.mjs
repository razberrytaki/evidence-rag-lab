import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanPublicTree } from "./public-tree-scan.mjs";

describe("public tree scanner", () => {
  it("finds secrets in publishable files without reading local .env", () => {
    const root = makeTempRepo();
    const openAiApiKey = "OPENAI" + "_API_KEY";
    const secretAssignment = `${openAiApiKey}=sk-public-leak`;
    writeFileSync(join(root, ".env"), `${openAiApiKey}=sk-local-secret\n`);
    writeFileSync(join(root, "README.md"), `${secretAssignment}\n`);

    const result = scanPublicTree(root);

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.failures.map((failure) => failure.path),
      ["README.md"]
    );

    rmSync(root, { recursive: true, force: true });
  });

  it("blocks public raw trace and provider response artifacts by path", () => {
    const root = makeTempRepo();
    mkdirSync(join(root, "docs", "query-traces"), { recursive: true });
    writeFileSync(join(root, "docs", "query-traces", "trace.raw.json"), "{}\n");
    writeFileSync(join(root, "docs", "query-traces", "provider-response.json"), "{}\n");

    const result = scanPublicTree(root);

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.failures.map((failure) => failure.path),
      ["docs/query-traces/provider-response.json", "docs/query-traces/trace.raw.json"]
    );

    rmSync(root, { recursive: true, force: true });
  });

  it("allows sanitized public files and env templates", () => {
    const root = makeTempRepo();
    const openAiApiKey = "OPENAI" + "_API_KEY";
    writeFileSync(join(root, ".env.example"), `${openAiApiKey}=\n`);
    writeFileSync(join(root, ".npmrc"), "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n");
    writeFileSync(join(root, "README.md"), `Set ${openAiApiKey}=... before running live smoke.\n`);
    writeFileSync(join(root, "packages", "domain", "src", "index.ts"), "export const ok = true;\n");

    const result = scanPublicTree(root);

    assert.deepEqual(result, {
      ok: true,
      failures: [],
      scannedFileCount: 4
    });

    rmSync(root, { recursive: true, force: true });
  });

  it("scans public npmrc files for auth tokens", () => {
    const root = makeTempRepo();
    writeFileSync(join(root, ".npmrc"), "//registry.npmjs.org/:_authToken=npm_live_secret_token_value\n");

    const result = scanPublicTree(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [{ path: ".npmrc", reason: "npm-auth-token-assignment" }]);

    rmSync(root, { recursive: true, force: true });
  });

  it("does not scan dependency build output under public roots", () => {
    const root = makeTempRepo();
    const dependencySecret = "sk-" + "ignored-dependency-secret";
    mkdirSync(join(root, "apps", "api", "node_modules", "leaky-package"), { recursive: true });
    writeFileSync(join(root, "apps", "api", "node_modules", "leaky-package", "index.js"), `const key = '${dependencySecret}';\n`);
    writeFileSync(join(root, "README.md"), "Public setup instructions only.\n");

    const result = scanPublicTree(root);

    assert.deepEqual(result, {
      ok: true,
      failures: [],
      scannedFileCount: 1
    });

    rmSync(root, { recursive: true, force: true });
  });

  it("allows explicit fake secret markers used by unit tests", () => {
    const root = makeTempRepo();
    const openAiApiKey = "OPENAI" + "_API_KEY";
    writeFileSync(
      join(root, "packages", "domain", "src", "redaction.test.ts"),
      `const query = "${openAiApiKey}=sk-live-secret";\nconst expected = "${openAiApiKey}=[redacted-secret]";\n`
    );

    const result = scanPublicTree(root);

    assert.deepEqual(result, {
      ok: true,
      failures: [],
      scannedFileCount: 1
    });

    rmSync(root, { recursive: true, force: true });
  });

  it("blocks unexpected root files that are not part of the public repo contract", () => {
    const root = makeTempRepo();
    writeFileSync(join(root, "private-notes.md"), "do not publish\n");

    const result = scanPublicTree(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [{ path: "private-notes.md", reason: "unexpected-root-entry" }]);

    rmSync(root, { recursive: true, force: true });
  });
});

function makeTempRepo() {
  const root = mkdtempSync(join(tmpdir(), "evidence-rag-public-tree-"));
  mkdirSync(join(root, "packages", "domain", "src"), { recursive: true });
  return root;
}
