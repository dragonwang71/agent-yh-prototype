import { describe, expect, it } from "vitest";
import { isAgentRun, isAgentStreamEvent } from "@/lib/agent/contracts";
import type { AgentRun } from "@/lib/types";

const validRun: AgentRun = {
  id: "run-1",
  scenario: "shopping",
  title: "Shopping agent",
  summary: "3件の候補を選びました。",
  userPrompt: "電子レンジを探して",
  statusLabel: "完了",
  startedAt: "10:00:00",
  plan: [],
  tools: [],
  recommendations: [],
  approvals: [],
  memoryUpdates: []
};

describe("agent response contract", () => {
  it("accepts the UI contract", () => {
    expect(isAgentRun(validRun)).toBe(true);
    expect(isAgentStreamEvent({ type: "run", run: validRun })).toBe(true);
  });

  it("rejects incomplete stream events before they reach the UI", () => {
    expect(isAgentStreamEvent({ type: "run", run: { id: "broken" } })).toBe(false);
    expect(isAgentStreamEvent({ type: "message", run: validRun })).toBe(false);
  });
});
