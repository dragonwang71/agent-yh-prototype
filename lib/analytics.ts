"use client";

import { z } from "zod";

const productEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    "prompt_submitted",
    "clarification_shown",
    "tool_succeeded",
    "tool_failed",
    "recommendation_impression",
    "recommendation_clicked",
    "feedback_submitted",
    "memory_proposed",
    "memory_approved",
    "memory_rejected",
    "task_completed"
  ]),
  runId: z.string(),
  scenario: z.enum(["shopping", "outing"]),
  language: z.enum(["ja", "en", "zh"]),
  createdAt: z.string(),
  value: z.string().max(120).optional(),
  durationMs: z.number().nonnegative().optional()
});
export type ProductEvent = z.infer<typeof productEventSchema>;

export type ProductMetrics = {
  runs: number;
  completedRuns: number;
  helpfulRate: number | null;
  clickThroughRate: number | null;
  clarificationRate: number;
  fallbackRate: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
};

const storageKey = "agent-yh-product-events-v1";
const maxEvents = 500;

export function recordProductEvent(event: Omit<ProductEvent, "id" | "createdAt">) {
  const events = loadProductEvents();
  const next: ProductEvent = {
    ...event,
    id: `${event.runId}:${event.type}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString()
  };
  window.localStorage.setItem(storageKey, JSON.stringify([...events, next].slice(-maxEvents)));
}
export function loadProductEvents(): ProductEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((event) => productEventSchema.safeParse(event))
      .filter((result) => result.success)
      .map((result) => result.data)
      .slice(-maxEvents);
  } catch {
    return [];
  }
}

export function summarizeProductEvents(events: ProductEvent[]): ProductMetrics {
  const runIds = new Set(events.filter((event) => event.type === "prompt_submitted").map((event) => event.runId));
  const completedIds = new Set(events.filter((event) => event.type === "task_completed").map((event) => event.runId));
  const clarificationIds = new Set(
    events.filter((event) => event.type === "clarification_shown").map((event) => event.runId)
  );
  const fallbackIds = new Set(
    events
      .filter((event) => event.type === "task_completed" && event.value === "degraded")
      .map((event) => event.runId)
  );
  const feedback = events.filter((event) => event.type === "feedback_submitted");
  const impressions = events.filter((event) => event.type === "recommendation_impression").length;
  const clicks = events.filter((event) => event.type === "recommendation_clicked").length;
  const latencies = events
    .filter((event) => event.type === "task_completed" && event.durationMs !== undefined)
    .map((event) => event.durationMs as number)
    .sort((left, right) => left - right);
  const helpful = feedback.filter((event) => event.value === "helpful").length;

  return {
    runs: runIds.size,
    completedRuns: completedIds.size,
    helpfulRate: feedback.length ? helpful / feedback.length : null,
    clickThroughRate: impressions ? clicks / impressions : null,
    clarificationRate: runIds.size ? clarificationIds.size / runIds.size : 0,
    fallbackRate: completedIds.size ? fallbackIds.size / completedIds.size : 0,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95)
  };
}

export function exportProductEvents() {
  const events = loadProductEvents();
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "agent-yh-anonymous-events.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function percentile(values: number[], p: number) {
  if (!values.length) {
    return null;
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * p) - 1));
  return values[index] ?? null;
}
