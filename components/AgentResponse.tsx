"use client";

import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import type { UiCopy } from "@/lib/i18n";
import { getRecommendationTitle } from "@/lib/i18n";
import type {
  AgentFeedback,
  AgentRun,
  MemoryItem,
  Recommendation
} from "@/lib/types";

type AgentResponseProps = {
  copy: UiCopy;
  onFeedback: (feedback: AgentFeedback) => void;
  onMemoryDecision: (memory: MemoryItem, decision: "approved" | "rejected") => void;
  onRecommendationClick: (recommendationId: string) => void;
  run: AgentRun;
  time: string;
};

export function AgentResponse({
  copy,
  onFeedback,
  onMemoryDecision,
  onRecommendationClick,
  run,
  time
}: AgentResponseProps) {
  const isRunning = ["received", "planned", "retrieving", "ranking", "validating"].includes(
    run.state
  );
  const isComplete = ["completed", "degraded"].includes(run.state);

  return (
    <section aria-label={copy.agentTitle[run.scenario]} className="flex items-start gap-3">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ff0033] text-white">
        <Bot aria-hidden="true" size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="font-semibold text-[#111827]">Agent yh</span>
          <span className="text-xs text-[#9ca3af]">{time}</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-[#ff0033]">
          {isRunning ? (
            <Activity
              aria-hidden="true"
              className="animate-pulse motion-reduce:animate-none"
              size={14}
            />
          ) : (
            <Sparkles aria-hidden="true" size={14} />
          )}
          <span>{isRunning ? copy.assistantRunning : copy.conclusionLabel}</span>
        </div>

        <p className="mt-2 text-base font-medium leading-7 text-[#1f2937]">{run.summary}</p>

        {run.clarification ? (
          <p className="mt-3 rounded-xl bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-[#9a3412]">
            {run.clarification.question}
          </p>
        ) : null}

        {run.recommendations.length ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#111827]">
                {getRecommendationTitle(copy, run.scenario)}
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs text-[#6b7280]">
                <ShieldCheck aria-hidden="true" size={14} />
                {copy.sourceLabel}
              </span>
            </div>

            <div className="mt-4 space-y-7">
              {run.recommendations.map((item) => (
                <RecommendationResult
                  copy={copy}
                  item={item}
                  key={item.id}
                  onClick={() => onRecommendationClick(item.id)}
                  scenario={run.scenario}
                />
              ))}
            </div>
          </div>
        ) : null}

        {run.memoryProposals.length ? (
          <div className="mt-6 space-y-2">
            {run.memoryProposals.map((proposal) => {
              const approval = run.approvals.find((item) => item.memoryId === proposal.id);
              const decided = approval?.status === "approved" || approval?.status === "declined";

              return (
                <div
                  className="rounded-xl bg-[#f7f7f8] px-4 py-3 text-sm"
                  key={proposal.id}
                >
                  <p className="font-medium text-[#374151]">{copy.memoryProposal}</p>
                  <p className="mt-1 break-words leading-5 text-[#6b7280]">
                    {proposal.key.replaceAll("_", " ")}: {formatMemoryValue(proposal.value)}
                  </p>
                  {decided ? (
                    <p className="mt-2 flex items-center gap-2 text-[#16803c]" role="status">
                      <Check aria-hidden="true" size={14} />
                      {approval?.status === "approved" ? copy.memorySaved : copy.rejectMemory}
                    </p>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#374151] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
                        onClick={() => onMemoryDecision(proposal, "approved")}
                        type="button"
                      >
                        {copy.approveMemory}
                      </button>
                      <button
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#6b7280] transition hover:bg-white hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
                        onClick={() => onMemoryDecision(proposal, "rejected")}
                        type="button"
                      >
                        {copy.rejectMemory}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {isComplete ? (
          <FeedbackControls copy={copy} feedback={run.feedback} onFeedback={onFeedback} />
        ) : null}
      </div>
    </section>
  );
}

function RecommendationResult({
  copy,
  item,
  onClick,
  scenario
}: {
  copy: UiCopy;
  item: Recommendation;
  onClick: () => void;
  scenario: AgentRun["scenario"];
}) {
  return (
    <article
      className={`grid min-w-0 gap-3 sm:gap-4 ${
        item.imageUrl
          ? "grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)]"
          : "grid-cols-1"
      }`}
      data-testid={`recommendation-${item.rank}`}
    >
      {item.imageUrl ? (
        item.action.url ? (
          <a
            aria-label={`${item.action.label}: ${item.title}`}
            className="group relative aspect-square self-start overflow-hidden rounded-xl bg-[#f5f6f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
            href={item.action.url}
            onClick={onClick}
            rel="noreferrer"
            target="_blank"
          >
            <RecommendationImage item={item} scenario={scenario} />
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <ExternalLink aria-hidden="true" size={18} />
            </span>
          </a>
        ) : (
          <div className="relative aspect-square self-start overflow-hidden rounded-xl bg-[#f5f6f7]">
            <RecommendationImage item={item} scenario={scenario} />
          </div>
        )
      ) : null}

      <div className="min-w-0">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h3 className="line-clamp-3 text-sm font-semibold leading-6 text-[#111827]" title={item.title}>
            {item.title}
          </h3>
          {item.priceYen !== undefined ? (
            <span className="shrink-0 text-lg font-bold tracking-tight text-[#ff0033]">
              ¥{item.priceYen.toLocaleString("ja-JP")}
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-sm leading-5 text-[#6b7280]">{item.meta}</p>
        <p className="mt-2 text-xs font-semibold text-[#8a5a00]">{item.scoreLabel}</p>
        <p className="mt-2 text-sm leading-5 text-[#4b5563]">{item.reason}</p>

        {item.action.url ? (
          <a
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#d6002b] transition hover:text-[#a80022] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
            href={item.action.url}
            onClick={onClick}
            rel="noreferrer"
            target="_blank"
          >
            {item.action.label}
            <ExternalLink aria-hidden="true" size={13} />
          </a>
        ) : null}

        <details className="group mt-3 rounded-xl bg-[#f7f7f8] px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-[#4b5563] marker:hidden">
            <span>
              {copy.matchDetails} · {item.evidence.length} {copy.evidenceLabel}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="shrink-0 transition group-open:rotate-180"
              size={14}
            />
          </summary>
          <div className="mt-3 space-y-4 text-xs leading-5 text-[#4b5563]">
            <div>
              <p className="font-semibold text-[#111827]">{copy.constraintsLabel}</p>
              <div className="mt-2 space-y-2">
                {item.constraints.map((constraint) => (
                  <div className="flex items-start gap-2" key={constraint.name}>
                    <span
                      className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        constraint.status === "matched"
                          ? "bg-[#e8f7ed] text-[#16803c]"
                          : constraint.status === "not_matched"
                            ? "bg-[#feecec] text-[#b42318]"
                            : "bg-[#fff4d6] text-[#8a5a00]"
                      }`}
                    >
                      {constraint.status === "matched"
                        ? copy.matched
                        : constraint.status === "not_matched"
                          ? copy.notMatched
                          : copy.unverified}
                    </span>
                    <span>
                      <strong>{constraint.name}:</strong> {constraint.explanation}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-semibold text-[#111827]">{copy.scoreBreakdown}</p>
              <div className="mt-2 grid gap-1.5">
                {item.scoreBreakdown.map((contribution) => (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"
                    key={contribution.factor}
                  >
                    <span>{contribution.factor}</span>
                    <span className="tabular-nums text-[#6b7280]">
                      {Math.round(contribution.score * contribution.weight * 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {item.limitations.length ? (
              <div>
                <p className="font-semibold text-[#111827]">{copy.limitationsLabel}</p>
                <ul className="mt-2 space-y-1">
                  {[...new Set(item.limitations)].map((limitation) => (
                    <li key={limitation}>· {limitation}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </article>
  );
}

function RecommendationImage({
  item,
  scenario
}: {
  item: Recommendation;
  scenario: AgentRun["scenario"];
}) {
  return (
    <img
      alt=""
      className={`absolute inset-0 h-full w-full ${
        scenario === "shopping" ? "object-contain p-2" : "object-cover"
      }`}
      decoding="async"
      loading="lazy"
      referrerPolicy="no-referrer"
      src={item.imageUrl}
    />
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
      <p className="mt-4 flex items-center gap-2 text-sm text-[#6b7280]" role="status">
        <Check aria-hidden="true" className="text-[#16803c]" size={15} />
        {copy.feedbackThanks}
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#6b7280]">
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

function formatMemoryValue(value: MemoryItem["value"]) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}
