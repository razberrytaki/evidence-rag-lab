import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanPublicReadiness } from "./public-readiness-scan.mjs";

describe("public readiness scanner", () => {
  it("requires a root license file when package metadata declares MIT", () => {
    const root = makeTempRepo();
    writeMinimalReadinessFiles(root, { includeLicense: false, ciCommand: "pnpm security:public" });

    const result = scanPublicReadiness(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [{ path: "LICENSE", reason: "missing-required-file" }]);

    rmSync(root, { recursive: true, force: true });
  });

  it("requires CI to run the same public security gate documented for publication", () => {
    const root = makeTempRepo();
    writeMinimalReadinessFiles(root, { includeLicense: true, ciCommand: "pnpm security:fixtures" });

    const result = scanPublicReadiness(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [
      { path: ".github/workflows/ci.yml", reason: "missing-ci-command: pnpm security:public" }
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it("requires CI commands to be executable run steps, not echoed text", () => {
    const root = makeTempRepo();
    writeMinimalReadinessFiles(root, { includeLicense: true, ciCommand: "echo pnpm security:public" });

    const result = scanPublicReadiness(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [
      { path: ".github/workflows/ci.yml", reason: "missing-ci-command: pnpm security:public" }
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it("requires the local publication script to run security after report generation", () => {
    const root = makeTempRepo();
    writeMinimalReadinessFiles(root, {
      includeLicense: true,
      ciCommand: "pnpm security:public",
      publicCheckScript:
        "pnpm build && pnpm test && pnpm typecheck && pnpm security:public && pnpm eval:report && pnpm provider:report && pnpm scale:report && pnpm index:report"
    });

    const result = scanPublicReadiness(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [
      { path: "package.json", reason: "public-check-security-must-run-after-report-generation" }
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it("requires public check commands to be executable segments, not echoed text", () => {
    const root = makeTempRepo();
    writeMinimalReadinessFiles(root, {
      includeLicense: true,
      ciCommand: "pnpm security:public",
      publicCheckScript:
        "pnpm build && pnpm test && pnpm typecheck && echo pnpm eval:report && echo pnpm provider:report && echo pnpm scale:report && echo pnpm index:report && echo pnpm security:public"
    });

    const result = scanPublicReadiness(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [
      { path: "package.json", reason: "missing-public-check-command: pnpm eval:report" },
      { path: "package.json", reason: "missing-public-check-command: pnpm index:report" },
      { path: "package.json", reason: "missing-public-check-command: pnpm provider:report" },
      { path: "package.json", reason: "missing-public-check-command: pnpm scale:report" },
      { path: "package.json", reason: "missing-public-check-command: pnpm security:public" },
      { path: "package.json", reason: "public-check-security-must-run-after-report-generation" }
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it("requires publish-critical files to stay unignored by gitignore rules", () => {
    const root = makeTempRepo();
    writeMinimalReadinessFiles(root, {
      includeLicense: true,
      ciCommand: "pnpm security:public",
      gitignoreText: "*.sql\n"
    });

    const result = scanPublicReadiness(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [
      { path: "infra/postgres/init/001_schema.sql", reason: "required-file-is-gitignored" }
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it("passes when public metadata, CI gate, and local publication script are present", () => {
    const root = makeTempRepo();
    writeMinimalReadinessFiles(root, {
      includeLicense: true,
      ciCommand: "pnpm security:public",
      publicCheckScript:
        "pnpm build && pnpm test && pnpm typecheck && pnpm eval:report && pnpm provider:report && pnpm scale:report && pnpm index:report && pnpm security:public"
    });

    const result = scanPublicReadiness(root);

    assert.deepEqual(result, {
      ok: true,
      failures: []
    });

    rmSync(root, { recursive: true, force: true });
  });
});

function makeTempRepo() {
  const root = mkdtempSync(join(tmpdir(), "evidence-rag-public-readiness-"));
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  mkdirSync(join(root, "docs", "security"), { recursive: true });
  mkdirSync(join(root, "infra", "postgres", "init"), { recursive: true });
  return root;
}

function writeMinimalReadinessFiles(root, input) {
  const openAiApiKey = "OPENAI" + "_API_KEY";
  writeFileSync(join(root, "README.md"), "# EvidenceRAG Lab\n");
  writeFileSync(join(root, ".env.example"), `${openAiApiKey}=\n`);
  writeFileSync(join(root, ".gitignore"), input.gitignoreText ?? ".env\n");
  writeFileSync(join(root, ".gitleaks.toml"), "title = \"EvidenceRAG Lab\"\n");
  writeFileSync(join(root, "infra", "postgres", "init", "001_schema.sql"), "CREATE EXTENSION IF NOT EXISTS vector;\n");
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  writeFileSync(join(root, "docs", "security", "public-repo-hygiene.md"), "# Public Repo Hygiene\n");
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        license: "MIT",
        scripts: {
          "public:check":
            input.publicCheckScript ??
            "pnpm build && pnpm test && pnpm typecheck && pnpm eval:report && pnpm provider:report && pnpm scale:report && pnpm index:report && pnpm security:public"
        }
      },
      null,
      2
    )
  );
  writeFileSync(
    join(root, ".github", "workflows", "ci.yml"),
    `name: CI\njobs:\n  test:\n    steps:\n      - run: pnpm build\n      - run: pnpm test\n      - run: pnpm typecheck\n      - run: ${input.ciCommand}\n`
  );
  if (input.includeLicense) {
    writeFileSync(
      join(root, "LICENSE"),
      "MIT License\n\nCopyright (c) 2026 Taki\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\n"
    );
  }
}
