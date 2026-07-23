import type { AgentEvent, AgentRun } from "@/lib/agent/schemas";

export function reduceAgentEvent(current: AgentRun | undefined, event: AgentEvent): AgentRun {
  if (event.type === "run.started") {
    return event.payload;
  }

  if (!current || current.id !== event.runId || current.traceId !== event.traceId) {
    throw new Error("Received an agent event before run.started");
  }

  switch (event.type) {
    case "intent.resolved":
      return {
        ...current,
        scenario: event.payload.scenario,
        title: event.payload.title,
        state: "planned",
        plan: event.payload.plan,
        tools: event.payload.tools,
        trace: event.payload.trace
      };
    case "clarification.required":
      return {
        ...current,
        state: "needs_clarification",
        summary: event.payload.summary,
        statusLabel: event.payload.statusLabel,
        clarification: event.payload.clarification,
        plan: event.payload.plan,
        tools: event.payload.tools,
        trace: event.payload.trace
      };
    case "retrieval.started":
      return {
        ...current,
        state: "retrieving",
        summary: event.payload.summary,
        statusLabel: event.payload.statusLabel,
        plan: event.payload.plan
      };
    case "recommendations.ready":
      return {
        ...current,
        state: event.payload.state,
        summary: event.payload.summary,
        recommendations: event.payload.recommendations,
        tools: event.payload.tools,
        plan: event.payload.plan,
        memoryProposals: event.payload.memoryProposals,
        trace: event.payload.trace
      };
    case "run.completed":
      return {
        ...current,
        state: event.payload.state,
        summary: event.payload.summary,
        statusLabel: event.payload.statusLabel,
        trace: event.payload.trace
      };
    case "run.failed":
      return {
        ...current,
        state: event.payload.state,
        summary: event.payload.summary,
        statusLabel: event.payload.statusLabel,
        tools: event.payload.tools,
        trace: event.payload.trace
      };
  }
}
