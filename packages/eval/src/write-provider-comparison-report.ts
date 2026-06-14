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
      tradeOffs: ["OpenAI 호환 LLM 제공자 전반에 옮겨 쓰기 쉬움", "Responses API보다 OpenAI 전용 성격은 약함"]
    },
    {
      provider: "anthropic",
      role: "comparison-adapter",
      requestSurface: "POST /messages",
      setup: "ANTHROPIC_API_KEY",
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
      tradeOffs: ["명시적 LLM 제공자 선택", "자동 대체 없음"]
    },
    {
      provider: "fake",
      role: "test-double",
      requestSurface: "in-process",
      setup: "none",
      liveVerification: {
        status: "not-applicable",
        command: "none",
        reason: "FakeLLMProvider는 결정적 CI/test 전용"
      },
      deterministicChecks: ["citation-shape", "empty-context-rejection"],
      tradeOffs: ["안정적인 평가 출력", "모델 품질 신호 아님"]
    }
  ],
  notes: [
    "생성 환경값과 임베딩 환경값은 분리해서 읽는다. 검색 질의 임베딩이 text-embedding-3-small을 사용하므로 DB 기반 동작 확인에는 OPENAI_API_KEY가 계속 필요하다.",
    "LLM 제공자 비교는 명시적이므로 설정 오류가 자동 대체 뒤에 숨지 않는다.",
    "실제 생성은 pnpm db:live-generation-smoke로 별도 확인한다."
  ]
};

const targetPath = join(repoRoot, "docs", "provider-comparison-report.md");
writeFileSync(targetPath, renderProviderComparisonReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
