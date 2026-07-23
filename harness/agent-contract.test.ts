import { describe, expect, it } from "vitest";
import { isAgentRun, isAgentStreamEvent } from "@/lib/agent/contracts";
import type { AgentRun } from "@/lib/types";

const validRun: AgentRun = {
  id: "run-1",
  traceId: "trace-run-1",
  scenario: "shopping",
  state: "completed",
  title: "Shopping agent",
  summary: "3件の候補を選びました。",
  userPrompt: "電子レンジを探して",
  statusLabel: "完了",
  startedAt: "10:00:00",
  plan: [],
  tools: [],
  recommendations: [],
  approvals: [],
  memoryProposals: [],
  trace: {
    traceId: "trace-run-1",
    runId: "run-1",
    state: "completed",
    modelProfile: "test",
    startedAt: "10:00:00",
    completedAt: "10:00:01",
    spans: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      estimatedCostYen: null
    }
  }
};

describe("agent response contract", () => {
  it("accepts the UI contract", () => {
    expect(isAgentRun(validRun)).toBe(true);
    expect(
      isAgentStreamEvent({
        type: "run.started",
        seq: 0,
        traceId: validRun.traceId,
        runId: validRun.id,
        payload: validRun
      })
    ).toBe(true);
  });

  it("rejects incomplete stream events before they reach the UI", () => {
    expect(
      isAgentStreamEvent({
        type: "run.started",
        seq: 0,
        traceId: "trace-broken",
        runId: "broken",
        payload: { id: "broken" }
      })
    ).toBe(false);
    expect(isAgentStreamEvent({ type: "message", payload: validRun })).toBe(false);
  });
});
