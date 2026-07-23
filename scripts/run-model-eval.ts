import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { evalCases } from "@/evals/datasets/cases";
import { hasOpenAIKey } from "@/lib/agent/model/client";
import { parseIntent } from "@/lib/agent/model/intent-parser";

async function main() {
loadEnvConfig(process.cwd());
if (!hasOpenAIKey()) {
  throw new Error("OPENAI_API_KEY is required for npm run eval:model.");
}

const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = Math.max(1, Number(limitArgument?.split("=")[1] ?? 20));
const selected = selectStratifiedCases(limit);
const results = [];

for (const item of selected) {
  const result = await parseIntent({
    language: item.language,
    memory: item.memory ?? [],
    prompt: item.prompt,
    scenarioHint: item.scenarioHint,
    signal: AbortSignal.timeout(30_000)
  });
  results.push({
    id: item.id,
    expectedKind: item.expectedKind,
    actualKind: result.intent.kind,
    correct: result.intent.kind === item.expectedKind,
    usedModel: result.usedModel,
    correctedByRules: result.correctedByRules ?? false,
    fallbackReason: result.fallbackReason,
    usage: result.usage
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
  cases: results.length,
  taskOutcomeAccuracy: results.filter((result) => result.correct).length / results.length,
  modelUsageRate: results.filter((result) => result.usedModel).length / results.length,
  modelBackedOutcomeAccuracy:
    results.filter((result) => result.usedModel && result.correct).length /
    Math.max(1, results.filter((result) => result.usedModel).length),
  correctedByRules: results.filter((result) => result.correctedByRules).length,
  recoveredByFallback: results.filter((result) => !result.usedModel && result.correct).length,
  results
};
const reportDirectory = path.join(process.cwd(), "evals", "reports");
await mkdir(reportDirectory, { recursive: true });
await writeFile(
  path.join(reportDirectory, "model-latest.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
console.log(
  `Model eval: ${results.filter((result) => result.correct).length}/${results.length} correct; ` +
    `${results.filter((result) => result.usedModel).length}/${results.length} used the model.`
);

if (
  report.taskOutcomeAccuracy < 0.95 ||
  report.modelUsageRate < 0.9 ||
  report.modelBackedOutcomeAccuracy < 0.95
) {
  process.exitCode = 1;
}
}

function selectStratifiedCases(limit: number) {
  const categories = [...new Set(evalCases.map((item) => item.category))];
  const queues = categories.map((category) =>
    evalCases.filter((item) => item.category === category)
  );
  const selected: typeof evalCases = [];

  while (selected.length < limit && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const next = queue.shift();

      if (next) {
        selected.push(next);
      }

      if (selected.length === limit) {
        break;
      }
    }
  }

  return selected;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Model evaluation failed.");
  process.exitCode = 1;
});
