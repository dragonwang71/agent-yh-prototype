import type { LucideIcon } from "lucide-react";

export type ScenarioId = "shopping" | "outing";

export type StepStatus = "done" | "running" | "waiting";

export type ToolStatus = "success" | "waiting" | "error";

export type TaskOption = {
  id: ScenarioId;
  title: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
};

export type PlanStep = {
  id: string;
  label: string;
  status: StepStatus;
  time: string;
  latency?: string;
};

export type ToolCall = {
  id: string;
  tool: string;
  input: string;
  status: ToolStatus;
  latency: string;
};

export type UserMemory = {
  id: string;
  text: string;
  source: ScenarioId;
  createdAt: string;
};

export type Recommendation = {
  id: string;
  rank: number;
  title: string;
  meta: string;
  price?: string;
  score: string;
  reason: string;
  actionLabel: string;
  actionUrl?: string;
};

export type ApprovalEvent = {
  id: string;
  label: string;
  status: "pending" | "approved" | "declined";
  time: string;
};

export type MemoryUpdate = {
  id: string;
  time: string;
  kind: "add" | "update";
  text: string;
};

export type AgentRun = {
  id: string;
  scenario: ScenarioId;
  title: string;
  summary: string;
  userPrompt: string;
  statusLabel: string;
  startedAt: string;
  plan: PlanStep[];
  tools: ToolCall[];
  recommendations: Recommendation[];
  approvals: ApprovalEvent[];
  memoryUpdates: MemoryUpdate[];
};

export type ChatMessage =
  | {
      id: string;
      role: "user";
      content: string;
      time: string;
    }
  | {
      id: string;
      role: "assistant";
      runId: string;
      time: string;
    };

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  runs: Record<string, AgentRun>;
  activeRunId: string;
  updatedAt: string;
};
