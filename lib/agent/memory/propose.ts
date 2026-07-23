import type {
  AgentIntent,
  ApprovalEvent,
  MemoryItem
} from "@/lib/agent/schemas";
import type { UiLanguage } from "@/lib/i18n";

export function proposeMemory({
  intent,
  language,
  prompt,
  runId
}: {
  intent: AgentIntent;
  language: UiLanguage;
  prompt: string;
  runId: string;
}): { proposals: MemoryItem[]; approvals: ApprovalEvent[] } {
  const now = new Date().toISOString();
  const proposals: MemoryItem[] = [];

  if (intent.kind === "shopping") {
    if (intent.budgetMaxYen) {
      proposals.push(
        memoryItem({
          key: "budget_max_yen",
          namespace: "shopping_preference",
          value: intent.budgetMaxYen,
          runId,
          now,
          sourceQuote: prompt
        })
      );
    }

    const durablePriorities = intent.priorities.filter((priority) =>
      /レビュー|评价|review|省スペース|省空间|compact/i.test(priority)
    );

    if (durablePriorities.length) {
      proposals.push(
        memoryItem({
          key: "shopping_priorities",
          namespace: "shopping_preference",
          value: durablePriorities,
          runId,
          now,
          sourceQuote: prompt
        })
      );
    }
  }

  if (intent.kind === "outing" && intent.indoorPreference !== null) {
    proposals.push(
      memoryItem({
        key: "prefer_indoor_when_raining",
        namespace: "outing_preference",
        value: intent.indoorPreference,
        runId,
        now,
        sourceQuote: prompt
      })
    );
  }

  const limited = proposals.slice(0, 2);

  return {
    proposals: limited,
    approvals: limited.map((proposal) => ({
      id: `approval-${proposal.id}`,
      memoryId: proposal.id,
      label: approvalLabel(proposal, language),
      status: "pending",
      time: now
    }))
  };
}
function memoryItem({
  key,
  namespace,
  now,
  runId,
  sourceQuote,
  value
}: {
  key: string;
  namespace: MemoryItem["namespace"];
  now: string;
  runId: string;
  sourceQuote: string;
  value: MemoryItem["value"];
}): MemoryItem {
  return {
    id: `memory-${runId}-${key}`,
    namespace,
    key,
    value,
    sourceRunId: runId,
    sourceQuote: sourceQuote.slice(0, 240),
    confidence: 0.9,
    status: "proposed",
    sensitivity: "normal",
    createdAt: now,
    updatedAt: now
  };
}

function approvalLabel(memory: MemoryItem, language: UiLanguage) {
  const value = Array.isArray(memory.value) ? memory.value.join(", ") : String(memory.value);

  if (language === "en") {
    return `Save ${memory.key}: ${value}`;
  }

  if (language === "zh") {
    return `保存偏好：${memory.key} = ${value}`;
  }

  return `この好みを保存: ${memory.key} = ${value}`;
}
