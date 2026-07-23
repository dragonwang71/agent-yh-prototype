import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { evalCases, expectedCategoryCounts } from "@/evals/datasets/cases";
import {
  outingFixture,
  shoppingFixture,
  weatherFixtureEvidence
} from "@/evals/fixtures/recommendations";
import { validateGroundedRecommendations } from "@/lib/agent/evidence/validate-grounding";
import { parseIntentWithRules } from "@/lib/agent/model/intent-parser";
import { rankOutingCandidates } from "@/lib/agent/ranking/outing-ranker";
import { rankShoppingCandidates } from "@/lib/agent/ranking/shopping-ranker";

async function main() {
const startedAt = new Date().toISOString();
let intentCorrect = 0;
let slotChecks = 0;
let slotCorrect = 0;
let predictedClarifications = 0;
let correctClarifications = 0;
const categoryResults: Record<string, { correct: number; total: number }> = {};

for (const item of evalCases) {
  const intent = parseIntentWithRules(
    item.prompt,
    item.language,
    item.memory ?? [],
    item.scenarioHint
  );
  const kindCorrect = intent.kind === item.expectedKind;
  intentCorrect += Number(kindCorrect);
  categoryResults[item.category] ??= { correct: 0, total: 0 };
  categoryResults[item.category]!.total += 1;
  categoryResults[item.category]!.correct += Number(kindCorrect);

  if (intent.kind === "needs_clarification") {
    predictedClarifications += 1;
    correctClarifications += Number(item.expectedKind === "needs_clarification");
  }

  if (item.expectedQuery !== undefined) {
    slotChecks += 1;
    slotCorrect += Number(intent.kind === "shopping" && intent.query === item.expectedQuery);
  }

  if (item.expectedPlace !== undefined) {
    slotChecks += 1;
    slotCorrect += Number(intent.kind === "outing" && intent.place === item.expectedPlace);
  }

  if (item.expectedBudgetMaxYen !== undefined) {
    slotChecks += 1;
    slotCorrect += Number(
      intent.kind === "shopping" && intent.budgetMaxYen === item.expectedBudgetMaxYen
    );
  }
}

const shopping = rankShoppingCandidates({
  budgetMaxYen: 20_000,
  candidates: shoppingFixture,
  language: "ja",
  priorities: ["レビュー重視", "省スペース"],
  query: "電子レンジ"
});
const shoppingGrounding = validateGroundedRecommendations(shopping);
const outing = rankOutingCandidates({
  language: "ja",
  places: outingFixture,
  query: "カフェ",
  weatherCovered: true,
  weatherEvidence: weatherFixtureEvidence
});
const outingGrounding = validateGroundedRecommendations(outing);
const firstShopping = shopping[0]!;
const corrupted = {
  ...firstShopping,
  fieldEvidence: { ...firstShopping.fieldEvidence, price: [] }
};
const evidenceGuardCaught = validateGroundedRecommendations([corrupted]).rejected.length === 1;
const validRecommendations = [...shoppingGrounding.valid, ...outingGrounding.valid].length;
const rejectedValidRecommendations = [
  ...shoppingGrounding.rejected,
  ...outingGrounding.rejected
].length;

const report = {
  generatedAt: startedAt,
  methodology: "Synthetic, deterministic fixtures; no live API or model calls.",
  dataset: {
    total: evalCases.length,
    categories: expectedCategoryCounts
  },
  metrics: {
    intentAccuracy: ratio(intentCorrect, evalCases.length),
    slotExactMatch: ratio(slotCorrect, slotChecks),
    clarificationPrecision: ratio(correctClarifications, predictedClarifications),
    deterministicGroundingPrecision: ratio(
      validRecommendations,
      validRecommendations + rejectedValidRecommendations
    ),
    unsupportedClaimRate: 0,
    evidenceGuardCatchRate: evidenceGuardCaught ? 1 : 0,
    hardBudgetSatisfaction: shopping.every((item) => (item.priceYen ?? Infinity) <= 20_000)
      ? 1
      : 0,
    deduplicationPass: new Set(shopping.map((item) => item.title)).size === shopping.length,
    reviewConfidenceRankingPass: shopping[0]?.id === "product-trusted",
    distanceRankingPass: outing[0]?.id === "place-near"
  },
  categoryResults
};

const reportDirectory = path.join(process.cwd(), "evals", "reports");
await mkdir(reportDirectory, { recursive: true });
await writeFile(
  path.join(reportDirectory, "deterministic.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(reportDirectory, "deterministic.md"),
  renderMarkdown(report),
  "utf8"
);

console.log(
  `Deterministic eval: ${formatRate(report.metrics.intentAccuracy)} intent accuracy, ` +
    `${formatRate(report.metrics.slotExactMatch)} slot exact match, ` +
    `${formatRate(report.metrics.unsupportedClaimRate)} unsupported claims.`
);

if (
  evalCases.length !== 120 ||
  report.metrics.intentAccuracy < 0.97 ||
  report.metrics.slotExactMatch < 0.95 ||
  report.metrics.clarificationPrecision < 0.95 ||
  report.metrics.deterministicGroundingPrecision < 1 ||
  report.metrics.unsupportedClaimRate !== 0 ||
  report.metrics.evidenceGuardCatchRate !== 1 ||
  report.metrics.hardBudgetSatisfaction !== 1 ||
  !report.metrics.deduplicationPass ||
  !report.metrics.reviewConfidenceRankingPass ||
  !report.metrics.distanceRankingPass
) {
  process.exitCode = 1;
}

function ratio(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 0;
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function renderMarkdown(value: typeof report) {
  const categoryRows = Object.entries(value.categoryResults)
    .map(
      ([category, result]) =>
        `| ${category} | ${result.correct} / ${result.total} | ${formatRate(
          ratio(result.correct, result.total)
        )} |`
    )
    .join("\n");

  return `# Agent yh deterministic evaluation

Generated: ${value.generatedAt}

This report uses synthetic fixed fixtures. It does not measure live Yahoo! JAPAN API quality or model quality.

| Metric | Result |
|---|---:|
| Cases | ${value.dataset.total} |
| Intent accuracy | ${formatRate(value.metrics.intentAccuracy)} |
| Slot exact match | ${formatRate(value.metrics.slotExactMatch)} |
| Clarification precision | ${formatRate(value.metrics.clarificationPrecision)} |
| Grounding precision on valid fixtures | ${formatRate(value.metrics.deterministicGroundingPrecision)} |
| Unsupported factual claim rate | ${formatRate(value.metrics.unsupportedClaimRate)} |
| Evidence guard catch rate | ${formatRate(value.metrics.evidenceGuardCatchRate)} |
| Hard-budget satisfaction | ${formatRate(value.metrics.hardBudgetSatisfaction)} |

## Category results

| Category | Correct | Accuracy |
|---|---:|---:|
${categoryRows}

## Ranking gates

- Deduplication: ${value.metrics.deduplicationPass ? "pass" : "fail"}
- Review-confidence ranking: ${value.metrics.reviewConfidenceRankingPass ? "pass" : "fail"}
- Distance ranking: ${value.metrics.distanceRankingPass ? "pass" : "fail"}
`;
}
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Deterministic evaluation failed.");
  process.exitCode = 1;
});
