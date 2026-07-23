import type {
  AgentStatus,
  AgentTrace,
  ToolErrorCode,
  TraceSpan
} from "@/lib/agent/schemas";
import type { ModelUsage } from "@/lib/agent/model/client";

export class TraceCollector {
  private readonly traceId: string;
  private readonly runId: string;
  private readonly startedAt: string;
  private state: AgentStatus = "received";
  private spans: TraceSpan[] = [];
  private usage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    estimatedCostYen: null as number | null
  };
  private responseId?: string;
  private model?: string;
  private fallbackReason?: string;
  private errorCode?: ToolErrorCode;
  private completedAt?: string;

  constructor({
    runId,
    startedAt,
    traceId
  }: {
    runId: string;
    startedAt: string;
    traceId: string;
  }) {
    this.runId = runId;
    this.startedAt = startedAt;
    this.traceId = traceId;
  }

  setState(state: AgentStatus) {
    this.state = state;
  }

  addSpan({
    detail,
    durationMs,
    errorCode,
    name,
    status = "ok"
  }: {
    detail: string;
    durationMs: number;
    errorCode?: ToolErrorCode;
    name: string;
    status?: TraceSpan["status"];
  }) {
    this.spans.push({
      id: `${this.traceId}:${this.spans.length + 1}`,
      name,
      status,
      startedAt: new Date().toISOString(),
      durationMs,
      detail,
      ...(errorCode ? { errorCode } : {})
    });
  }

  addModelUsage(usage: ModelUsage) {
    this.responseId = usage.responseId;
    this.model = usage.model;
    this.usage.inputTokens += usage.inputTokens;
    this.usage.outputTokens += usage.outputTokens;
    this.usage.cachedTokens += usage.cachedTokens;
  }

  setFallback(reason: string) {
    this.fallbackReason = reason.slice(0, 240);
  }

  setError(code: ToolErrorCode) {
    this.errorCode = code;
  }

  complete(state: Extract<AgentStatus, "completed" | "degraded" | "failed" | "aborted">) {
    this.state = state;
    this.completedAt = new Date().toISOString();
  }

  snapshot(): AgentTrace {
    return {
      traceId: this.traceId,
      runId: this.runId,
      state: this.state,
      modelProfile: process.env.OPENAI_MODEL ? "environment override" : "balanced default",
      ...(this.responseId ? { responseId: this.responseId } : {}),
      ...(this.model ? { model: this.model } : {}),
      startedAt: this.startedAt,
      ...(this.completedAt ? { completedAt: this.completedAt } : {}),
      spans: [...this.spans],
      usage: { ...this.usage },
      ...(this.fallbackReason ? { fallbackReason: this.fallbackReason } : {}),
      ...(this.errorCode ? { errorCode: this.errorCode } : {})
    };
  }
}
