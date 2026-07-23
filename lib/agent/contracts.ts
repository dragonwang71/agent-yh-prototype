import {
  agentEventSchema,
  agentRunSchema,
  type AgentEvent,
  type AgentRun
} from "@/lib/agent/schemas";

export function isAgentRun(value: unknown): value is AgentRun {
  return agentRunSchema.safeParse(value).success;
}

export function isAgentStreamEvent(value: unknown): value is AgentEvent {
  return agentEventSchema.safeParse(value).success;
}

export function parseAgentStreamEvent(value: unknown): AgentEvent | null {
  const result = agentEventSchema.safeParse(value);
  return result.success ? result.data : null;
}
