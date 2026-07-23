import { z } from "zod";

export const uiLanguageSchema = z.enum(["ja", "en", "zh"]);
export type UiLanguageValue = z.infer<typeof uiLanguageSchema>;

export const scenarioSchema = z.enum(["shopping", "outing"]);
export type ScenarioId = z.infer<typeof scenarioSchema>;

export const agentStatusSchema = z.enum([
  "received",
  "needs_clarification",
  "planned",
  "retrieving",
  "ranking",
  "validating",
  "completed",
  "degraded",
  "failed",
  "aborted"
]);
export type AgentStatus = z.infer<typeof agentStatusSchema>;

export const intentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("shopping"),
    query: z.string().nullable(),
    budgetMaxYen: z.number().positive().nullable(),
    priorities: z.array(z.string()).max(5),
    missingCriticalFields: z.array(z.string()).max(3),
    confidence: z.number().min(0).max(1),
    decisionSummary: z.string()
  }),
  z.object({
    kind: z.literal("outing"),
    place: z.string().nullable(),
    requestedAt: z.string().nullable(),
    activityPreference: z.string().nullable(),
    indoorPreference: z.boolean().nullable(),
    priorities: z.array(z.string()).max(5),
    missingCriticalFields: z.array(z.string()).max(3),
    confidence: z.number().min(0).max(1),
    decisionSummary: z.string()
  }),
  z.object({
    kind: z.literal("needs_clarification"),
    scenarioHint: scenarioSchema.nullable(),
    missingField: z.string(),
    question: z.string(),
    reasonCode: z.string(),
    confidence: z.number().min(0).max(1)
  }),
  z.object({
    kind: z.literal("unsupported"),
    scenarioHint: scenarioSchema.nullable(),
    reasonCode: z.string(),
    userMessage: z.string(),
    confidence: z.number().min(0).max(1)
  })
]);
export type AgentIntent = z.infer<typeof intentSchema>;

export const evidenceSourceSchema = z.enum([
  "yahoo_shopping",
  "yahoo_geocoder",
  "yahoo_weather",
  "yahoo_local_search"
]);

export const evidenceRefSchema = z.object({
  id: z.string(),
  sourceType: evidenceSourceSchema,
  toolCallId: z.string(),
  fieldPath: z.string(),
  fetchedAt: z.string(),
  sourceUrl: z.string().url().optional()
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const toolErrorCodeSchema = z.enum([
  "AUTH_ERROR",
  "RATE_LIMITED",
  "TIMEOUT",
  "UPSTREAM_4XX",
  "UPSTREAM_5XX",
  "INVALID_SCHEMA",
  "NO_RESULTS",
  "ABORTED",
  "UNKNOWN"
]);
export type ToolErrorCode = z.infer<typeof toolErrorCodeSchema>;

export const toolCallSchema = z.object({
  id: z.string(),
  tool: z.string(),
  input: z.string(),
  status: z.enum(["success", "waiting", "error"]),
  latencyMs: z.number().nonnegative().nullable(),
  retryCount: z.number().int().nonnegative(),
  cacheStatus: z.enum(["hit", "miss", "disabled"]),
  evidenceCount: z.number().int().nonnegative(),
  errorCode: toolErrorCodeSchema.optional()
});
export type ToolCall = z.infer<typeof toolCallSchema>;

export type ToolResult<T> =
  | {
      ok: true;
      data: T;
      evidence: EvidenceRef[];
      meta: {
        toolCallId: string;
        fetchedAt: string;
        latencyMs: number;
        retryCount: number;
        cacheStatus: "hit" | "miss" | "disabled";
      };
    }
  | {
      ok: false;
      error: {
        code: ToolErrorCode;
        retryable: boolean;
        safeMessage: string;
      };
      meta: {
        toolCallId: string;
        latencyMs: number;
        retryCount: number;
      };
    };

export const constraintCheckSchema = z.object({
  name: z.string(),
  status: z.enum(["matched", "not_matched", "unverified"]),
  explanation: z.string(),
  evidenceIds: z.array(z.string())
});
export type ConstraintCheck = z.infer<typeof constraintCheckSchema>;

export const scoreContributionSchema = z.object({
  factor: z.string(),
  score: z.number().min(0).max(1),
  weight: z.number().min(0).max(1),
  explanation: z.string()
});
export type ScoreContribution = z.infer<typeof scoreContributionSchema>;

export const fieldEvidenceSchema = z.object({
  title: z.array(z.string()),
  meta: z.array(z.string()),
  imageUrl: z.array(z.string()),
  price: z.array(z.string()),
  score: z.array(z.string()),
  actionUrl: z.array(z.string())
});

export const recommendationSchema = z.object({
  id: z.string(),
  rank: z.number().int().positive(),
  title: z.string(),
  meta: z.string(),
  imageUrl: z.string().url().optional(),
  priceYen: z.number().nonnegative().optional(),
  score: z.number().min(0).max(100),
  scoreLabel: z.string(),
  reason: z.string(),
  constraints: z.array(constraintCheckSchema),
  scoreBreakdown: z.array(scoreContributionSchema),
  confidence: z.enum(["high", "medium", "low"]),
  limitations: z.array(z.string()),
  action: z.object({
    label: z.string(),
    url: z.string().url().optional()
  }),
  evidence: z.array(evidenceRefSchema),
  fieldEvidence: fieldEvidenceSchema
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const planStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["done", "running", "waiting", "error"]),
  time: z.string(),
  latencyMs: z.number().nonnegative().nullable()
});
export type PlanStep = z.infer<typeof planStepSchema>;

export const memoryItemSchema = z.object({
  id: z.string(),
  namespace: z.enum([
    "profile",
    "shopping_preference",
    "outing_preference",
    "constraint",
    "response_preference"
  ]),
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  sourceRunId: z.string(),
  sourceQuote: z.string().optional(),
  confidence: z.number().min(0).max(1),
  status: z.enum(["proposed", "approved", "rejected"]),
  sensitivity: z.enum(["normal", "sensitive"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().optional()
});
export type MemoryItem = z.infer<typeof memoryItemSchema>;

export const approvalEventSchema = z.object({
  id: z.string(),
  memoryId: z.string(),
  label: z.string(),
  status: z.enum(["pending", "approved", "declined"]),
  time: z.string()
});
export type ApprovalEvent = z.infer<typeof approvalEventSchema>;

export const traceSpanSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["ok", "error", "skipped"]),
  startedAt: z.string(),
  durationMs: z.number().nonnegative(),
  detail: z.string(),
  errorCode: toolErrorCodeSchema.optional()
});
export type TraceSpan = z.infer<typeof traceSpanSchema>;

export const agentTraceSchema = z.object({
  traceId: z.string(),
  runId: z.string(),
  state: agentStatusSchema,
  modelProfile: z.string(),
  responseId: z.string().optional(),
  model: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  spans: z.array(traceSpanSchema),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cachedTokens: z.number().int().nonnegative(),
    estimatedCostYen: z.number().nonnegative().nullable()
  }),
  fallbackReason: z.string().optional(),
  errorCode: toolErrorCodeSchema.optional()
});
export type AgentTrace = z.infer<typeof agentTraceSchema>;

export const clarificationSchema = z.object({
  missingField: z.string(),
  question: z.string(),
  reasonCode: z.string()
});
export type Clarification = z.infer<typeof clarificationSchema>;

export const agentRunSchema = z.object({
  id: z.string(),
  traceId: z.string(),
  scenario: scenarioSchema,
  state: agentStatusSchema,
  title: z.string(),
  summary: z.string(),
  userPrompt: z.string(),
  statusLabel: z.string(),
  startedAt: z.string(),
  plan: z.array(planStepSchema),
  tools: z.array(toolCallSchema),
  recommendations: z.array(recommendationSchema),
  approvals: z.array(approvalEventSchema),
  memoryProposals: z.array(memoryItemSchema),
  trace: agentTraceSchema,
  clarification: clarificationSchema.optional(),
  feedback: z.enum(["helpful", "needs-improvement"]).optional()
});
export type AgentRun = z.infer<typeof agentRunSchema>;

const eventBase = {
  seq: z.number().int().nonnegative(),
  traceId: z.string(),
  runId: z.string()
};

export const agentEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...eventBase,
    type: z.literal("run.started"),
    payload: agentRunSchema
  }),
  z.object({
    ...eventBase,
    type: z.literal("intent.resolved"),
    payload: z.object({
      scenario: scenarioSchema,
      title: z.string(),
      plan: z.array(planStepSchema),
      tools: z.array(toolCallSchema),
      trace: agentTraceSchema
    })
  }),
  z.object({
    ...eventBase,
    type: z.literal("clarification.required"),
    payload: z.object({
      clarification: clarificationSchema,
      summary: z.string(),
      statusLabel: z.string(),
      plan: z.array(planStepSchema),
      tools: z.array(toolCallSchema),
      trace: agentTraceSchema
    })
  }),
  z.object({
    ...eventBase,
    type: z.literal("retrieval.started"),
    payload: z.object({
      summary: z.string(),
      statusLabel: z.string(),
      plan: z.array(planStepSchema)
    })
  }),
  z.object({
    ...eventBase,
    type: z.literal("recommendations.ready"),
    payload: z.object({
      summary: z.string(),
      recommendations: z.array(recommendationSchema),
      tools: z.array(toolCallSchema),
      plan: z.array(planStepSchema),
      memoryProposals: z.array(memoryItemSchema),
      trace: agentTraceSchema,
      state: z.enum(["completed", "degraded"])
    })
  }),
  z.object({
    ...eventBase,
    type: z.literal("run.completed"),
    payload: z.object({
      summary: z.string(),
      statusLabel: z.string(),
      state: z.enum(["completed", "degraded"]),
      trace: agentTraceSchema
    })
  }),
  z.object({
    ...eventBase,
    type: z.literal("run.failed"),
    payload: z.object({
      summary: z.string(),
      statusLabel: z.string(),
      state: z.enum(["failed", "aborted"]),
      tools: z.array(toolCallSchema),
      trace: agentTraceSchema
    })
  })
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;

export const agentRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  scenario: scenarioSchema.optional(),
  runId: z.string().min(1).max(120),
  startedAt: z.string().max(40),
  memory: z.array(memoryItemSchema).max(50).default([]),
  language: uiLanguageSchema.default("ja")
});
export type AgentRequest = z.infer<typeof agentRequestSchema>;

export const runBudgetSchema = z.object({
  maxModelCalls: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  maxRetriesPerTool: z.number().int().nonnegative(),
  deadlineMs: z.number().int().positive()
});
export type RunBudget = z.infer<typeof runBudgetSchema>;
