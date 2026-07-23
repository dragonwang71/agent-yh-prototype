import type { LucideIcon } from "lucide-react";
import type {
  AgentRun,
  ApprovalEvent,
  MemoryItem,
  PlanStep,
  Recommendation,
  ScenarioId,
  ToolCall
} from "@/lib/agent/schemas";

export type {
  AgentRun,
  AgentStatus,
  AgentTrace,
  ApprovalEvent,
  Clarification,
  ConstraintCheck,
  EvidenceRef,
  MemoryItem,
  PlanStep,
  Recommendation,
  ScenarioId,
  ScoreContribution,
  ToolCall,
  ToolErrorCode,
  ToolResult,
  TraceSpan
} from "@/lib/agent/schemas";

export type StepStatus = PlanStep["status"];

export type ToolStatus = ToolCall["status"];

export type AgentFeedback = "helpful" | "needs-improvement";

export type TaskOption = {
  id: ScenarioId;
  title: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
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

export type MemoryDecision = {
  approval: ApprovalEvent;
  memory: MemoryItem;
};
