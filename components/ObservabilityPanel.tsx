import { Activity, CheckCircle2, ChevronDown, Circle } from "lucide-react";
import type { ReactNode } from "react";
import type { UiCopy } from "@/lib/i18n";
import type { AgentRun, StepStatus, ToolStatus } from "@/lib/types";

type ObservabilityPanelProps = {
  copy: UiCopy;
  memory: string;
  run?: AgentRun;
};

export function ObservabilityPanel({ copy, memory, run }: ObservabilityPanelProps) {
  const approvals = run?.approvals ?? [];
  const memoryUpdates = run?.memoryUpdates ?? [];
  const memorySnippets = memoryPreviewLines(memory);

  return (
    <aside className="hidden min-h-0 border-l border-[#e5e7eb] bg-[#fafafa] xl:flex xl:h-dvh xl:flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <div className="shrink-0 border-b border-[#e5e7eb] pb-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
            <Activity aria-hidden="true" size={18} />
            {copy.logTitle}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">{copy.logSubtitle}</p>
          <div className="mt-4 flex items-start justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-medium text-[#16803c]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#16803c]" />
              <span>{run?.statusLabel ?? copy.noActiveRun}</span>
            </span>
            <span className="shrink-0 text-xs text-[#6b7280]">
              {copy.startedAt}: {run?.startedAt ?? "-"}
            </span>
          </div>
        </div>

        <div className="grid gap-1 py-3">
          <LogSection defaultOpen title={copy.planSteps}>
            <div className="grid gap-3">
              {(run?.plan ?? []).map((step) => (
                <div className="grid grid-cols-[18px_1fr_auto] items-start gap-2 text-sm" key={step.id}>
                  <StatusIcon status={step.status} />
                  <span className="min-w-0 leading-5 text-[#4b5563]">{step.label}</span>
                  <span className="pt-0.5 text-xs tabular-nums text-[#6b7280]">
                    {step.latency ?? "-"}
                  </span>
                </div>
              ))}
            </div>
          </LogSection>

          <LogSection title={copy.toolCalls}>
            <div className="grid gap-2">
              {(run?.tools ?? []).map((tool) => (
                <div className="rounded-lg bg-white p-3 text-xs" key={tool.id} title={tool.input}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-all font-medium leading-5 text-[#374151]">
                      {tool.tool}
                    </span>
                    <span className="shrink-0 tabular-nums text-[#6b7280]">{tool.latency}</span>
                  </div>
                  <span
                    className={`mt-1 inline-block font-semibold ${
                      tool.status === "success"
                        ? "text-[#16803c]"
                        : tool.status === "error"
                          ? "text-[#b42318]"
                          : "text-[#6b7280]"
                    }`}
                  >
                    {copy.toolStatus[tool.status]}
                  </span>
                </div>
              ))}
            </div>
          </LogSection>

          {approvals.length ? (
            <LogSection title={copy.approvalHistory}>
              <div>
                {approvals.map((approval) => (
                  <div className="border-b border-[#e5e7eb] py-3 text-sm last:border-b-0" key={approval.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`font-medium ${
                          approval.status === "approved"
                            ? "text-[#16803c]"
                            : approval.status === "declined"
                              ? "text-[#b42318]"
                              : "text-[#8a5a00]"
                        }`}
                      >
                        {copy.approvalStatus[approval.status]}
                      </span>
                      <span className="text-xs text-[#6b7280]">{approval.time}</span>
                    </div>
                    <p className="mt-1 leading-5 text-[#4b5563]">{approval.label}</p>
                  </div>
                ))}
              </div>
            </LogSection>
          ) : null}

          {memoryUpdates.length || memorySnippets.length ? (
            <LogSection title={copy.memoryUpdates}>
              <div>
                {memoryUpdates.map((item) => (
                  <div className="grid grid-cols-[48px_1fr] gap-2 border-b border-[#e5e7eb] py-3 text-xs last:border-b-0" key={item.id}>
                    <span className="text-[#6b7280]">{item.time.slice(0, 5)}</span>
                    <span className="leading-5 text-[#4b5563]">
                      <strong className="mr-2 text-[#16803c]">{copy.memoryKind[item.kind]}</strong>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
              {memorySnippets.length ? (
                <div className="mt-3 space-y-2 border-t border-[#e5e7eb] pt-3">
                  {memorySnippets.map((item) => (
                    <p className="text-xs leading-5 text-[#4b5563]" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              ) : null}
            </LogSection>
          ) : null}
        </div>
      </div>
    </aside>
  );
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
  if (defaultOpen) {
    return (
      <section className="border-b border-[#e5e7eb] py-3">
        <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
        <div className="mt-3">{children}</div>
      </section>
    );
  }

  return (
    <details className="group border-b border-[#e5e7eb] py-3">
      <summary className="cursor-pointer list-none text-sm font-semibold text-[#111827] marker:hidden">
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

function StatusIcon({ status }: { status: StepStatus | ToolStatus }) {
  if (status === "done" || status === "success") {
    return <CheckCircle2 aria-hidden="true" className="mt-0.5 text-[#16803c]" size={16} />;
  }

  if (status === "error") {
    return <Circle aria-hidden="true" className="mt-0.5 text-[#b42318]" size={16} />;
  }

  if (status === "running") {
    return <Activity aria-hidden="true" className="mt-0.5 text-[#ff0033]" size={16} />;
  }

  return <Circle aria-hidden="true" className="mt-0.5 text-[#9ca3af]" size={16} />;
}

function memoryPreviewLines(memoryDocument: string) {
  return memoryDocument
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2))
    .slice(0, 3);
}
