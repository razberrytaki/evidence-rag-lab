import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderProviderComparisonReportMarkdown, type ProviderComparisonReportInput } from ".";

const repoRoot = join(__dirname, "..", "..", "..");

const report: ProviderComparisonReportInput = {
  generatedAt: "2026-06-14",
  providers: [
    {
      provider: "openai-compatible",
      role: "default-live",
      requestSurface: "POST /chat/completions",
      setup: "OPENAI_API_KEY",
      liveVerification: {
        status: "separate-command",
        command: "pnpm db:live-generation-smoke"
      },
      deterministicChecks: [
        "request-shape",
        "citation-validation",
        "empty-context-rejection",
        "malformed-json-redaction"
      ],
      tradeOffs: ["OpenAI-compatible provider 전반에 portable", "Responses API보다 OpenAI-native 성격은 약함"]
    },
    {
      provider: "anthropic",
      role: "comparison-adapter",
      requestSurface: "POST /messages",
      setup: "OPENAI_API_KEY + ANTHROPIC_API_KEY",
      liveVerification: {
        status: "not-run",
        command: "pnpm db:live-generation-smoke",
        reason: "ANTHROPIC_API_KEY가 설정되지 않음"
      },
      deterministicChecks: [
        "request-shape",
        "citation-validation",
        "empty-context-rejection",
        "malformed-json-redaction",
        "env-config-loading"
      ],
      tradeOffs: ["명시적 provider selection", "automatic fallback 없음"]
    },
    {
      provider: "fake",
      role: "test-double",
      requestSurface: "in-process",
      setup: "none",
      liveVerification: {
        status: "not-applicable",
        command: "none",
        reason: "FakeLLMProvider는 deterministic CI/test 전용"
      },
      deterministicChecks: ["citation-shape", "empty-context-rejection"],
      tradeOffs: ["stable eval output", "model-quality signal 아님"]
    }
  ],
  notes: [
    "retrieval query embedding이 text-embedding-3-small을 사용하므로 embedding에는 OpenAI가 계속 필요하다.",
    "Provider comparison은 explicit하므로 setup error가 fallback 뒤에 숨지 않는다.",
    "이 report는 live model call을 실행하지 않는다. live generation은 pnpm db:live-generation-smoke로 별도 확인한다."
  ]
};

const targetPath = join(repoRoot, "docs", "provider-comparison-report.md");
writeFileSync(targetPath, renderProviderComparisonReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
