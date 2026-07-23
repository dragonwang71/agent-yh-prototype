"use client";

import { ArrowLeft, CheckCircle2, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { loadConversations } from "@/lib/storage";
import type { AgentRun } from "@/lib/types";

export function TraceDebugger({ traceId }: { traceId: string }) {
  const [run, setRun] = useState<AgentRun | null | undefined>(undefined);

  useEffect(() => {
    const found = loadConversations()
      .flatMap((conversation) => Object.values(conversation.runs))
      .find((item) => item.traceId === traceId);
    setRun(found ?? null);
  }, [traceId]);

  if (run === undefined) {
    return <main className="p-8 text-sm text-[#6b7280]">Loading trace…</main>;
  }

  if (!run) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <a className="inline-flex items-center gap-2 text-sm text-[#d6002b]" href="/">
          <ArrowLeft size={15} />
          Agent yh
        </a>
        <h1 className="mt-8 text-xl font-semibold">Trace not found</h1>
        <p className="mt-2 text-sm leading-6 text-[#6b7280]">
          This development view reads sanitized runs stored in the current browser.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8] px-5 py-8 text-[#111827]">
      <div className="mx-auto max-w-4xl">
        <a className="inline-flex items-center gap-2 text-sm font-medium text-[#d6002b]" href="/">
          <ArrowLeft size={15} />
          Agent yh
        </a>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">
            Development trace
          </p>
          <h1 className="mt-2 break-all text-2xl font-semibold">{run.traceId}</h1>
          <p className="mt-2 text-sm leading-6 text-[#6b7280]">
            Observable decisions, sanitized tool summaries, evidence references, and usage. Hidden
            reasoning and raw API payloads are intentionally excluded.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Summary label="State" value={run.state} />
          <Summary label="Model" value={run.trace.model ?? run.trace.modelProfile} />
          <Summary label="Input tokens" value={String(run.trace.usage.inputTokens)} />
          <Summary label="Output tokens" value={String(run.trace.usage.outputTokens)} />
        </div>

        <section className="mt-10">
          <h2 className="text-base font-semibold">Spans</h2>
          <div className="mt-3 space-y-2">
            {run.trace.spans.map((span) => (
              <div className="rounded-xl bg-white px-4 py-3" key={span.id}>
                <div className="flex items-start justify-between gap-4">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {span.status === "ok" ? (
                      <CheckCircle2 className="text-[#16803c]" size={15} />
                    ) : (
                      <CircleAlert className="text-[#b42318]" size={15} />
                    )}
                    {span.name}
                  </span>
                  <span className="text-xs tabular-nums text-[#9ca3af]">
                    {span.durationMs}ms
                  </span>
                </div>
                <p className="mt-2 break-words text-xs leading-5 text-[#6b7280]">{span.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold">Tools</h2>
          <div className="mt-3 overflow-hidden rounded-xl bg-white">
            {run.tools.map((tool, index) => (
              <div className={`px-4 py-3 ${index ? "border-t border-[#f3f4f6]" : ""}`} key={tool.id}>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-sm font-semibold">{tool.tool}</span>
                  <span className="text-xs text-[#9ca3af]">
                    {tool.latencyMs === null ? "-" : `${tool.latencyMs}ms`}
                  </span>
                </div>
                <p className="mt-1 break-words text-xs leading-5 text-[#6b7280]">{tool.input}</p>
                <p className="mt-1 text-xs text-[#6b7280]">
                  {tool.evidenceCount} evidence · {tool.retryCount} retries
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold">Evidence coverage</h2>
          <div className="mt-3 space-y-2">
            {run.recommendations.map((recommendation) => (
              <details className="rounded-xl bg-white px-4 py-3" key={recommendation.id}>
                <summary className="cursor-pointer text-sm font-semibold">
                  {recommendation.rank}. {recommendation.title} · {recommendation.evidence.length}
                </summary>
                <div className="mt-3 grid gap-2 text-xs leading-5 text-[#6b7280]">
                  {recommendation.evidence.map((evidence) => (
                    <div className="grid grid-cols-[150px_1fr] gap-3" key={evidence.id}>
                      <span>{evidence.sourceType}</span>
                      <span className="break-all">{evidence.fieldPath}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3">
      <span className="text-xs text-[#9ca3af]">{label}</span>
      <strong className="mt-1 block break-all text-sm">{value}</strong>
    </div>
  );
}
