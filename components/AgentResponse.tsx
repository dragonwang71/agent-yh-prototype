"use client";

import {
  Activity,
  Bot,
  Check,
  ExternalLink,
  Sparkles,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import type { UiCopy } from "@/lib/i18n";
import { getRecommendationTitle } from "@/lib/i18n";
import type { AgentFeedback, AgentRun, Recommendation } from "@/lib/types";

type AgentResponseProps = {
  copy: UiCopy;
  onFeedback: (feedback: AgentFeedback) => void;
  run: AgentRun;
  time: string;
};

export function AgentResponse({ copy, onFeedback, run, time }: AgentResponseProps) {
  const isRunning = run.plan.some((step) => step.status === "running");
  const isComplete = run.recommendations.length > 0 && !isRunning;

  return (
    <section aria-label={copy.agentTitle[run.scenario]} className="flex items-start gap-3">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ff0033] text-white shadow-sm">
        <Bot aria-hidden="true" size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-semibold text-[#111827]">Agent yh</span>
          <span className="text-sm text-[#6b7280]">{time}</span>
        </div>

        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.04)] sm:p-5">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-[#ff0033]">
            {!isRunning ? (
              <Sparkles aria-hidden="true" size={14} />
            ) : (
              <Activity aria-hidden="true" className="animate-pulse motion-reduce:animate-none" size={14} />
            )}
            <span>{isRunning ? copy.assistantRunning : copy.conclusionLabel}</span>
          </div>
          <p className="mt-2 text-base font-medium leading-7 text-[#1f2937]">{run.summary}</p>

          {run.recommendations.length ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#e5e7eb] pb-3">
                <h2 className="text-base font-semibold text-[#111827]">
                  {getRecommendationTitle(copy, run.scenario)}
                </h2>
                <span className="text-xs text-[#6b7280]">{copy.sourceLabel}</span>
              </div>

              <div className="mt-3 grid gap-3">
                {run.recommendations.map((item) => (
                  <RecommendationCard item={item} key={item.id} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {isComplete ? (
          <FeedbackControls copy={copy} feedback={run.feedback} onFeedback={onFeedback} />
        ) : null}
      </div>
    </section>
  );
}

function RecommendationCard({ item }: { item: Recommendation }) {
  return (
    <article
      className="rounded-xl border border-[#e5e7eb] bg-[#fcfcfd] p-4 transition hover:border-[#d1d5db] hover:bg-white"
      data-testid={`recommendation-${item.rank}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111827] text-xs font-bold text-white">
          {item.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h3 className="line-clamp-3 text-sm font-semibold leading-6 text-[#111827]" title={item.title}>
              {item.title}
            </h3>
            {item.price ? (
              <span className="shrink-0 text-lg font-bold tracking-tight text-[#ff0033]">
                {item.price}
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm leading-6 text-[#6b7280]">{item.meta}</p>

          <div className="mt-2 flex flex-wrap items-start gap-2">
            <span className="rounded-full bg-[#fff4d6] px-2.5 py-1 text-xs font-semibold text-[#7c5200]">
              {item.score}
            </span>
            {item.reason ? (
              <p className="min-w-[180px] flex-1 text-sm leading-6 text-[#4b5563]">{item.reason}</p>
            ) : null}
          </div>

          {item.actionUrl ? (
            <a
              className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm font-semibold text-[#111827] transition hover:border-[#ff0033] hover:text-[#d6002b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
              href={item.actionUrl}
              rel="noreferrer"
              target="_blank"
            >
              {item.actionLabel}
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FeedbackControls({
  copy,
  feedback,
  onFeedback
}: {
  copy: UiCopy;
  feedback?: AgentFeedback;
  onFeedback: (feedback: AgentFeedback) => void;
}) {
  if (feedback) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-[#6b7280]" role="status">
        <Check aria-hidden="true" className="text-[#16803c]" size={15} />
        {copy.feedbackThanks}
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#6b7280]">
      <span className="mr-1">{copy.feedbackQuestion}</span>
      <button
        aria-label={copy.helpful}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 transition hover:bg-[#f3f4f6] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
        onClick={() => onFeedback("helpful")}
        type="button"
      >
        <ThumbsUp aria-hidden="true" size={15} />
        {copy.helpful}
      </button>
      <button
        aria-label={copy.notHelpful}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 transition hover:bg-[#f3f4f6] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
        onClick={() => onFeedback("needs-improvement")}
        type="button"
      >
        <ThumbsDown aria-hidden="true" size={15} />
        {copy.notHelpful}
      </button>
    </div>
  );
}
