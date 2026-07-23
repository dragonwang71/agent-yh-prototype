import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  ExternalLink,
  Gauge
} from "lucide-react";
import type { ReactNode } from "react";
import type { ProductMetrics } from "@/lib/analytics";
import type { UiCopy } from "@/lib/i18n";
import type { AgentRun, MemoryItem, StepStatus, ToolStatus } from "@/lib/types";

type ObservabilityPanelProps = {
  copy: UiCopy;
  memory: MemoryItem[];
  metrics: ProductMetrics;
  onExportMetrics: () => void;
  run?: AgentRun;
};

export function ObservabilityPanel({
  copy,
  memory,
  metrics,
  onExportMetrics,
  run
}: ObservabilityPanelProps) {
  const approvedMemory = memory.filter((item) => item.status === "approved");
  const usage = run?.trace.usage;

  return (
    <aside className="hidden min-h-0 bg-[#f7f7f8] xl:flex xl:h-dvh xl:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <Activity aria-hidden="true" size={17} />
            {copy.logTitle}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">{copy.logSubtitle}</p>
          <div className="mt-4 flex items-start justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 font-medium text-[#16803c]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#16803c]" />
              <span>{run?.statusLabel ?? copy.noActiveRun}</span>
            </span>
            <span className="shrink-0 tabular-nums text-[#9ca3af]">
              {run?.startedAt ?? "-"}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <LogSection defaultOpen title={copy.planSteps}>
            <div className="grid gap-3">
              {(run?.plan ?? []).map((item) => (
                <div className="grid grid-cols-[17px_1fr_auto] items-start gap-2 text-xs" key={item.id}>
                  <StatusIcon status={item.status} />
                  <span className="min-w-0 leading-5 text-[#4b5563]">{item.label}</span>
                  <span className="pt-0.5 tabular-nums text-[#9ca3af]">
                    {item.latencyMs === null ? "-" : `${item.latencyMs}ms`}
                  </span>
                </div>
              ))}
            </div>
          </LogSection>

          <LogSection title={copy.toolCalls}>
            <div className="grid gap-3">
              {(run?.tools ?? []).map((tool) => (
                <div className="text-xs" key={tool.id} title={tool.input}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-all font-medium leading-5 text-[#374151]">
                      {tool.tool}
                    </span>
                    <span className="shrink-0 tabular-nums text-[#9ca3af]">
                      {tool.latencyMs === null ? "-" : `${tool.latencyMs}ms`}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[#6b7280]">
                    <span>{copy.toolStatus[tool.status]}</span>
                    <span>{tool.evidenceCount} evidence</span>
                    {tool.retryCount ? <span>{tool.retryCount} retry</span> : null}
                    {tool.errorCode ? <span className="text-[#b42318]">{tool.errorCode}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </LogSection>

          <LogSection title={copy.traceSummary}>
            {run ? (
              <div className="space-y-3 text-xs leading-5 text-[#4b5563]">
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <span className="text-[#9ca3af]">trace</span>
                  <span className="break-all">{run.traceId}</span>
                  <span className="text-[#9ca3af]">state</span>
                  <span>{run.state}</span>
                  <span className="text-[#9ca3af]">model</span>
                  <span>{run.trace.model ?? run.trace.modelProfile}</span>
                  <span className="text-[#9ca3af]">fallback</span>
                  <span>{run.trace.fallbackReason ?? "-"}</span>
                </div>
                {process.env.NODE_ENV === "development" ? (
                  <a
                    className="inline-flex items-center gap-1.5 font-semibold text-[#d6002b]"
                    href={`/debug/runs/${run.traceId}`}
                  >
                    {copy.openTrace}
                    <ExternalLink aria-hidden="true" size={12} />
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-[#9ca3af]">{copy.noActiveRun}</p>
            )}
          </LogSection>

          <LogSection title={copy.modelUsage}>
            {usage && usage.inputTokens + usage.outputTokens > 0 ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-[#4b5563]">
                <Metric label="input" value={usage.inputTokens.toLocaleString()} />
                <Metric label="output" value={usage.outputTokens.toLocaleString()} />
                <Metric label="cached" value={usage.cachedTokens.toLocaleString()} />
                <Metric label="cost" value="not configured" />
              </div>
            ) : (
              <p className="text-xs text-[#9ca3af]">{copy.noModelUsage}</p>
            )}
          </LogSection>

          <LogSection title={copy.qualitySignals}>
            {metrics.runs ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-[#4b5563]">
                <Metric label={copy.helpfulRate} value={formatRate(metrics.helpfulRate)} />
                <Metric label={copy.clickRate} value={formatRate(metrics.clickThroughRate)} />
                <Metric label={copy.clarificationRate} value={formatRate(metrics.clarificationRate)} />
                <Metric label={copy.fallbackRate} value={formatRate(metrics.fallbackRate)} />
                <Metric
                  label="p50"
                  value={metrics.p50LatencyMs === null ? "–" : `${metrics.p50LatencyMs}ms`}
                />
                <Metric
                  label="p95"
                  value={metrics.p95LatencyMs === null ? "–" : `${metrics.p95LatencyMs}ms`}
                />
                <button
                  className="col-span-2 mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-semibold text-[#4b5563] transition hover:bg-[#f7f7f8] hover:text-[#111827]"
                  onClick={onExportMetrics}
                  type="button"
                >
                  <Download aria-hidden="true" size={13} />
                  {copy.exportEvents}
                </button>
              </div>
            ) : (
              <p className="text-xs leading-5 text-[#9ca3af]">{copy.noEventData}</p>
            )}
          </LogSection>

          {run?.approvals.length ? (
            <LogSection title={copy.approvalHistory}>
              <div className="space-y-3">
                {run.approvals.map((approval) => (
                  <div className="text-xs" key={approval.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={
                          approval.status === "approved"
                            ? "font-semibold text-[#16803c]"
                            : approval.status === "declined"
                              ? "font-semibold text-[#b42318]"
                              : "font-semibold text-[#8a5a00]"
                        }
                      >
                        {copy.approvalStatus[approval.status]}
                      </span>
                      <span className="text-[#9ca3af]">
                        {new Date(approval.time).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 leading-5 text-[#4b5563]">{approval.label}</p>
                  </div>
                ))}
              </div>
            </LogSection>
          ) : null}

          <LogSection title={copy.memoryUpdates}>
            {approvedMemory.length ? (
              <div className="space-y-2">
                {approvedMemory.slice(0, 5).map((item) => (
                  <p className="text-xs leading-5 text-[#4b5563]" key={item.id}>
                    <strong>{item.key.replaceAll("_", " ")}:</strong>{" "}
                    {Array.isArray(item.value) ? item.value.join(", ") : String(item.value)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#9ca3af]">{copy.noMemory}</p>
            )}
          </LogSection>
        </div>
      </div>
    </aside>
  );
}

function formatRate(value: number | null) {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

function LogSection({
  children,
  defaultOpen = false,
  title
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  return (
    <details className="group rounded-xl bg-white px-3 py-3" open={defaultOpen || undefined}>
      <summary className="cursor-pointer list-none text-xs font-semibold text-[#111827] marker:hidden">
        <span className="flex items-center justify-between gap-2">
          {title}
          <ChevronDown
            aria-hidden="true"
            className="text-[#9ca3af] transition group-open:rotate-180"
            size={14}
          />
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f7f7f8] p-2">
      <span className="flex items-center gap-1 text-[#9ca3af]">
        <Gauge aria-hidden="true" size={12} />
        {label}
      </span>
      <strong className="mt-1 block font-semibold text-[#374151]">{value}</strong>
    </div>
  );
}

function StatusIcon({ status }: { status: StepStatus | ToolStatus }) {
  if (status === "done" || status === "success") {
    return <CheckCircle2 aria-hidden="true" className="mt-0.5 text-[#16803c]" size={15} />;
  }

  if (status === "error") {
    return <Circle aria-hidden="true" className="mt-0.5 text-[#b42318]" size={15} />;
  }

  if (status === "running") {
    return <Activity aria-hidden="true" className="mt-0.5 text-[#ff0033]" size={15} />;
  }

  return <Circle aria-hidden="true" className="mt-0.5 text-[#9ca3af]" size={15} />;
}
