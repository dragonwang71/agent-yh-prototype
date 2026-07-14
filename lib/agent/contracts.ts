import type { AgentRun } from "@/lib/types";

export type AgentStreamEvent = {
  type: "run";
  run: AgentRun;
};

export function isAgentRun(value: unknown): value is AgentRun {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AgentRun>;

  return (
    typeof candidate.id === "string" &&
    (candidate.scenario === "shopping" || candidate.scenario === "outing") &&
    typeof candidate.title === "string" &&
    typeof candidate.summary === "string" &&
    typeof candidate.userPrompt === "string" &&
    typeof candidate.statusLabel === "string" &&
    typeof candidate.startedAt === "string" &&
    Array.isArray(candidate.plan) &&
    Array.isArray(candidate.tools) &&
    Array.isArray(candidate.recommendations) &&
    Array.isArray(candidate.approvals) &&
    Array.isArray(candidate.memoryUpdates)
  );
}

export function isAgentStreamEvent(value: unknown): value is AgentStreamEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AgentStreamEvent>;
  return candidate.type === "run" && isAgentRun(candidate.run);
}
