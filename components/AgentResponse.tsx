"use client";

import {
  Activity,
  Bot,
  Check,
  ExternalLink,
  Sparkles,
  Star,
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

        <div className="py-1">
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
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-[#111827]">
                  {getRecommendationTitle(copy, run.scenario)}
                </h2>
                <span className="text-xs text-[#6b7280]">{copy.sourceLabel}</span>
              </div>

              <div className="mt-5 grid gap-6">
                {run.recommendations.map((item) => (
                  <RecommendationResult item={item} key={item.id} scenario={run.scenario} />
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

function RecommendationResult({
  item,
  scenario
}: {
  item: Recommendation;
  scenario: AgentRun["scenario"];
}) {
  const linkedImage = item.imageUrl && item.actionUrl;

  return (
    <article
      className={`grid min-w-0 gap-3 sm:gap-4 ${item.imageUrl ? "grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[128px_minmax(0,1fr)]" : "grid-cols-1"}`}
      data-testid={`recommendation-${item.rank}`}
    >
      {linkedImage ? (
        <a
          aria-label={`${item.actionLabel}: ${item.title}`}
          className="group relative aspect-square self-start overflow-hidden rounded-xl bg-[#f5f6f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
          href={item.actionUrl}
          rel="noreferrer"
          target="_blank"
        >
          <img
            alt=""
            className={`absolute inset-0 h-full w-full transition duration-200 group-hover:scale-[1.02] group-focus-visible:scale-[1.02] ${scenario === "shopping" ? "object-contain p-2" : "object-cover"}`}
            decoding="async"
            loading="lazy"
            referrerPolicy="no-referrer"
            src={item.imageUrl}
          />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 px-2 text-center text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <ExternalLink aria-hidden="true" size={18} />
            <span className="text-xs font-semibold leading-4">{item.actionLabel}</span>
          </span>
        </a>
      ) : item.imageUrl ? (
        <div className="relative aspect-square self-start overflow-hidden rounded-xl bg-[#f5f6f7]">
          <img
            alt={item.title}
            className={`absolute inset-0 h-full w-full ${scenario === "shopping" ? "object-contain p-2" : "object-cover"}`}
            decoding="async"
            loading="lazy"
            referrerPolicy="no-referrer"
            src={item.imageUrl}
          />
        </div>
      ) : null}

      <div className="min-w-0 py-0.5">
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

        <p className="mt-1 text-sm leading-5 text-[#6b7280]">{item.meta}</p>

        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#8a5a00]">
          <Star aria-hidden="true" className="fill-current" size={13} />
          <span>{item.score}</span>
        </div>

        {item.reason ? (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#4b5563]">{item.reason}</p>
        ) : null}

        {item.actionUrl && !linkedImage ? (
          <a
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#d6002b] transition hover:text-[#a80022] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
            href={item.actionUrl}
            rel="noreferrer"
            target="_blank"
          >
            {item.actionLabel}
            <ExternalLink aria-hidden="true" size={13} />
          </a>
        ) : null}
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
