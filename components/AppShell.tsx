"use client";

import {
  BookOpen,
  Bot,
  Info,
  Languages,
  MessageSquare,
  SendHorizontal,
  SquarePen,
  Trash2
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { AgentResponse } from "@/components/AgentResponse";
import { MemoryPanel } from "@/components/MemoryPanel";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { isAgentRun, parseAgentStreamEvent } from "@/lib/agent/contracts";
import { reduceAgentEvent } from "@/lib/agent/events";
import {
  exportProductEvents,
  loadProductEvents,
  recordProductEvent,
  summarizeProductEvents
} from "@/lib/analytics";
import { createId, formatClock, inferScenario, taskOptions } from "@/lib/demoData";
import { htmlLang, languageOptions, uiCopy } from "@/lib/i18n";
import type { UiCopy, UiLanguage } from "@/lib/i18n";
import {
  loadConversations,
  loadLanguage,
  loadMemory,
  saveConversations,
  saveLanguage,
  saveMemory
} from "@/lib/storage";
import type {
  AgentFeedback,
  AgentRun,
  ChatMessage,
  Conversation,
  MemoryItem,
  ScenarioId
} from "@/lib/types";

type ViewMode = "chat" | "memory";
type UtilityPanel = "help" | "language" | null;

export function AppShell() {
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [draft, setDraft] = useState("");
  const [draftScenario, setDraftScenario] = useState<ScenarioId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [runs, setRuns] = useState<Record<string, AgentRun>>({});
  const [activeRunId, setActiveRunId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel>(null);
  const [language, setLanguage] = useState<UiLanguage>("ja");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const recordedSignalsRef = useRef(new Set<string>());
  const runStartedAtRef = useRef(new Map<string, number>());
  const [productMetrics, setProductMetrics] = useState(() => summarizeProductEvents([]));

  const activeRun = activeRunId ? runs[activeRunId] : undefined;
  const copy = uiCopy[language];

  useEffect(() => {
    const storedConversations = loadConversations();
    const firstConversation = storedConversations[0];

    setConversations(storedConversations);
    setMemory(loadMemory());
    setLanguage(loadLanguage());
    setProductMetrics(summarizeProductEvents(loadProductEvents()));

    if (firstConversation) {
      setActiveConversationId(firstConversation.id);
      setMessages(firstConversation.messages);
      setRuns(firstConversation.runs);
      setActiveRunId(firstConversation.activeRunId);
    }

    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const saveTimer = window.setTimeout(() => saveConversations(conversations), 120);
    return () => window.clearTimeout(saveTimer);
  }, [conversations, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    saveMemory(memory);
  }, [isReady, memory]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    if (isReady) {
      saveLanguage(language);
    }
  }, [isReady, language]);

  useEffect(() => {
    document.documentElement.lang = htmlLang[language];
  }, [language]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;

    if (!scrollArea || viewMode !== "chat") {
      return;
    }

    scrollArea.scrollTop = scrollArea.scrollHeight;
  }, [activeRun?.state, activeRunId, messages.length, viewMode]);

  function upsertConversation(nextConversation: Conversation) {
    setConversations((current) => [
      nextConversation,
      ...current.filter((conversation) => conversation.id !== nextConversation.id)
    ]);
  }

  function createConversationTitle(text: string) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length > 22 ? `${cleaned.slice(0, 22)}...` : cleaned || "New chat";
  }

  function cancelActiveRequest() {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setIsRunning(false);
  }

  function startNewChat() {
    cancelActiveRequest();
    setViewMode("chat");
    setDraft("");
    setDraftScenario(null);
    setMessages([]);
    setRuns({});
    setActiveRunId("");
    setActiveConversationId("");
    setDeleteTargetId("");
    setUtilityPanel(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function selectConversation(conversation: Conversation) {
    cancelActiveRequest();
    setViewMode("chat");
    setDraft("");
    setDraftScenario(null);
    setMessages(conversation.messages);
    setRuns(conversation.runs);
    setActiveRunId(conversation.activeRunId);
    setActiveConversationId(conversation.id);
    setDeleteTargetId("");
    setUtilityPanel(null);
  }

  function deleteConversation(conversationId: string) {
    setConversations((current) =>
      current.filter((conversation) => conversation.id !== conversationId)
    );
    setDeleteTargetId("");

    if (conversationId === activeConversationId) {
      startNewChat();
    }
  }

  function openMemory() {
    cancelActiveRequest();
    setViewMode("memory");
    setUtilityPanel(null);
    setDeleteTargetId("");
  }

  function handleMemoryChange(nextMemory: MemoryItem[]) {
    setMemory(nextMemory);
  }

  function selectTask(scenario: ScenarioId) {
    setViewMode("chat");
    setDraft(uiCopy[language].tasks[scenario].prompt);
    setDraftScenario(scenario);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    setDraftScenario(null);
  }

  function applyConversationSnapshot({
    activeId,
    conversationId,
    conversationTitle,
    nextMessages,
    nextRuns
  }: {
    activeId: string;
    conversationId: string;
    conversationTitle: string;
    nextMessages: ChatMessage[];
    nextRuns: Record<string, AgentRun>;
  }) {
    upsertConversation({
      id: conversationId,
      title: conversationTitle,
      messages: nextMessages,
      runs: nextRuns,
      activeRunId: activeId,
      updatedAt: new Date().toISOString()
    });
  }

  function updateRun(runId: string, updater: (run: AgentRun) => AgentRun) {
    setRuns((current) => {
      const currentRun = current[runId];

      if (!currentRun) {
        return current;
      }

      const nextRun = updater(currentRun);
      const nextRuns = { ...current, [runId]: nextRun };

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.runs[runId]
            ? {
                ...conversation,
                runs: { ...conversation.runs, [runId]: nextRun },
                activeRunId: runId,
                updatedAt: new Date().toISOString()
              }
            : conversation
        )
      );

      return nextRuns;
    });
  }

  function addProductEvent(
    event: Parameters<typeof recordProductEvent>[0],
    dedupeKey?: string
  ) {
    if (dedupeKey && recordedSignalsRef.current.has(dedupeKey)) {
      return;
    }

    if (dedupeKey) {
      recordedSignalsRef.current.add(dedupeKey);
    }

    recordProductEvent(event);
    setProductMetrics(summarizeProductEvents(loadProductEvents()));
  }

  function captureRunSignals(run: AgentRun) {
    if (run.state === "needs_clarification") {
      addProductEvent(
        {
          type: "clarification_shown",
          runId: run.id,
          scenario: run.scenario,
          language
        },
        `${run.id}:clarification`
      );
    }

    for (const tool of run.tools) {
      if (tool.status === "success" || tool.status === "error") {
        addProductEvent(
          {
            type: tool.status === "success" ? "tool_succeeded" : "tool_failed",
            runId: run.id,
            scenario: run.scenario,
            language,
            value: tool.tool
          },
          `${run.id}:tool:${tool.id}:${tool.status}`
        );
      }
    }

    for (const recommendation of run.recommendations) {
      addProductEvent(
        {
          type: "recommendation_impression",
          runId: run.id,
          scenario: run.scenario,
          language,
          value: recommendation.id
        },
        `${run.id}:impression:${recommendation.id}`
      );
    }

    for (const proposal of run.memoryProposals) {
      addProductEvent(
        {
          type: "memory_proposed",
          runId: run.id,
          scenario: run.scenario,
          language,
          value: proposal.namespace
        },
        `${run.id}:memory-proposed:${proposal.id}`
      );
    }

    if (["completed", "degraded"].includes(run.state)) {
      const durationMs = Math.max(
        0,
        Date.now() - (runStartedAtRef.current.get(run.id) ?? Date.now())
      );
      addProductEvent(
        {
          type: "task_completed",
          runId: run.id,
          scenario: run.scenario,
          language,
          value: run.state,
          durationMs
        },
        `${run.id}:completed`
      );
    }
  }

  function recordFeedback(runId: string, feedback: AgentFeedback) {
    updateRun(runId, (run) => ({ ...run, feedback }));
    const run = runs[runId];

    if (run) {
      addProductEvent({
        type: "feedback_submitted",
        runId,
        scenario: run.scenario,
        language,
        value: feedback
      });
    }
  }

  function decideMemory(
    runId: string,
    proposal: MemoryItem,
    decision: "approved" | "rejected"
  ) {
    const now = new Date().toISOString();
    const status = decision === "approved" ? "approved" : "rejected";

    updateRun(runId, (run) => ({
      ...run,
      memoryProposals: run.memoryProposals.map((item) =>
        item.id === proposal.id ? { ...item, status, updatedAt: now } : item
      ),
      approvals: [
        ...run.approvals.filter((item) => item.memoryId !== proposal.id),
        {
          id: `approval-${proposal.id}`,
          memoryId: proposal.id,
          label: `${proposal.key}: ${formatMemoryValue(proposal.value)}`,
          status: decision === "approved" ? "approved" : "declined",
          time: now
        }
      ]
    }));

    if (decision === "approved") {
      setMemory((current) => [
        ...current.filter(
          (item) =>
            item.id !== proposal.id &&
            !(item.namespace === proposal.namespace && item.key === proposal.key)
        ),
        { ...proposal, status: "approved", updatedAt: now }
      ]);
    }

    const run = runs[runId];

    if (run) {
      addProductEvent({
        type: decision === "approved" ? "memory_approved" : "memory_rejected",
        runId,
        scenario: run.scenario,
        language,
        value: proposal.namespace
      });
    }
  }

  function recordRecommendationClick(run: AgentRun, recommendationId: string) {
    addProductEvent({
      type: "recommendation_clicked",
      runId: run.id,
      scenario: run.scenario,
      language,
      value: recommendationId
    });
  }

  async function readAgentStream(
    response: Response,
    onRun: (run: AgentRun) => void
  ) {
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.body || !contentType.includes("application/x-ndjson")) {
      const result = (await response.json()) as { run?: AgentRun };

      if (!result.run || !isAgentRun(result.run)) {
        throw new Error("Agent response did not match the runtime contract.");
      }

      onRun(result.run);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamRun: AgentRun | undefined;

    const applyLine = (line: string) => {
      const raw: unknown = JSON.parse(line);
      const event = parseAgentStreamEvent(raw);

      if (!event) {
        return;
      }

      streamRun = reduceAgentEvent(streamRun, event);
      onRun(streamRun);
    };

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes("\n")) {
        const newlineIndex = buffer.indexOf("\n");
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          applyLine(line);
        }
      }
    }

    const finalLine = buffer.trim();

    if (finalLine) {
      applyLine(finalLine);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    if (!text || isRunning) {
      return;
    }

    const scenario = draftScenario ?? inferScenario(text);
    const controller = new AbortController();
    const runId = createId("run");
    const conversationId = activeConversationId || createId("chat");
    const startedAt = formatClock();
    const shortTime = startedAt.slice(0, 5);
    const conversationTitle =
      conversations.find((conversation) => conversation.id === conversationId)?.title ??
      createConversationTitle(text);
    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        id: createId("msg"),
        role: "user",
        content: text,
        time: shortTime
      },
      {
        id: createId("msg"),
        role: "assistant",
        runId,
        time: shortTime
      }
    ];
    let nextRuns = { ...runs };

    runStartedAtRef.current.set(runId, Date.now());
    addProductEvent({
      type: "prompt_submitted",
      runId,
      scenario,
      language
    });
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    setViewMode("chat");
    setActiveConversationId(conversationId);
    setActiveRunId(runId);
    setMessages(nextMessages);
    setDraft("");
    setIsRunning(true);
    setDeleteTargetId("");
    applyConversationSnapshot({
      activeId: runId,
      conversationId,
      conversationTitle,
      nextMessages,
      nextRuns
    });

    try {
      const response = await fetch("/api/agent?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          scenario,
          runId,
          startedAt,
          memory: memory.filter((item) => item.status === "approved"),
          language
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("Agent API request failed.");
      }

      await readAgentStream(response, (run) => {
        captureRunSignals(run);
        nextRuns = { ...nextRuns, [run.id]: run };
        setRuns(nextRuns);
        applyConversationSnapshot({
          activeId: run.id,
          conversationId,
          conversationTitle,
          nextMessages,
          nextRuns
        });
      });
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      const errorRun = createClientErrorRun({
        copy,
        runId,
        scenario,
        startedAt,
        text
      });
      nextRuns = { ...nextRuns, [runId]: errorRun };
      setRuns(nextRuns);
      applyConversationSnapshot({
        activeId: runId,
        conversationId,
        conversationTitle,
        nextMessages,
        nextRuns
      });
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setIsRunning(false);
      }
    }
  }

  return (
    <div className="grid h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-white text-[#111827] lg:grid-cols-[232px_minmax(0,1fr)] lg:grid-rows-1 xl:grid-cols-[232px_minmax(0,1fr)_300px]">
      <Sidebar
        activeConversationId={activeConversationId}
        activePanel={utilityPanel}
        conversations={conversations}
        copy={copy}
        deleteTargetId={deleteTargetId}
        language={language}
        onDeleteConversation={deleteConversation}
        onLanguageChange={setLanguage}
        onNewChat={startNewChat}
        onOpenMemory={openMemory}
        onSelectConversation={selectConversation}
        onSetDeleteTarget={setDeleteTargetId}
        onTogglePanel={(panel) =>
          setUtilityPanel((current) => (current === panel ? null : panel))
        }
        viewMode={viewMode}
      />

      <main className="flex min-h-0 flex-col overflow-hidden bg-white">
        {viewMode === "memory" ? (
          <MemoryPanel memory={memory} onChange={handleMemoryChange} text={copy} />
        ) : (
          <>
            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7"
              ref={scrollAreaRef}
            >
              <div
                aria-live="polite"
                className="mx-auto flex w-full max-w-[840px] flex-col gap-7"
                role="log"
              >
                {messages.length === 0 ? (
                  <StarterConversations copy={copy} onSelectTask={selectTask} />
                ) : (
                  messages.map((message) => {
                    if (message.role === "user") {
                      return <UserMessage key={message.id} message={message} />;
                    }

                    const run = runs[message.runId];

                    if (!run) {
                      return <AssistantPending copy={copy} key={message.id} />;
                    }

                    return (
                      <AgentResponse
                        copy={copy}
                        key={message.id}
                        onFeedback={(feedback) => recordFeedback(run.id, feedback)}
                        onMemoryDecision={(proposal, decision) =>
                          decideMemory(run.id, proposal, decision)
                        }
                        onRecommendationClick={(recommendationId) =>
                          recordRecommendationClick(run, recommendationId)
                        }
                        run={run}
                        time={message.time}
                      />
                    );
                  })
                )}
              </div>
            </div>

            <Composer
              composerRef={composerRef}
              copy={copy}
              draft={draft}
              isRunning={isRunning}
              onChange={handleDraftChange}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </main>

      <ObservabilityPanel
        copy={copy}
        memory={memory}
        metrics={productMetrics}
        onExportMetrics={exportProductEvents}
        run={activeRun}
      />
    </div>
  );
}

function Sidebar({
  activeConversationId,
  activePanel,
  conversations,
  copy,
  deleteTargetId,
  language,
  onDeleteConversation,
  onLanguageChange,
  onNewChat,
  onOpenMemory,
  onSelectConversation,
  onSetDeleteTarget,
  onTogglePanel,
  viewMode
}: {
  activeConversationId: string;
  activePanel: UtilityPanel;
  conversations: Conversation[];
  copy: UiCopy;
  deleteTargetId: string;
  language: UiLanguage;
  onDeleteConversation: (conversationId: string) => void;
  onLanguageChange: (language: UiLanguage) => void;
  onNewChat: () => void;
  onOpenMemory: () => void;
  onSelectConversation: (conversation: Conversation) => void;
  onSetDeleteTarget: (conversationId: string) => void;
  onTogglePanel: (panel: Exclude<UtilityPanel, null>) => void;
  viewMode: ViewMode;
}) {
  return (
    <aside className="shrink-0 bg-[#f7f7f8] lg:h-dvh">
      <div className="flex items-center gap-2 px-3 py-2.5 lg:hidden">
        <Brand />
        <div className="ml-auto flex items-center gap-1">
          <IconNavButton icon={<SquarePen size={18} />} label={copy.newChat} onClick={onNewChat} />
          <IconNavButton icon={<BookOpen size={18} />} label={copy.memory} onClick={onOpenMemory} />
          <select
            aria-label={copy.languageLabel}
            className="h-9 rounded-lg bg-transparent px-2 text-sm text-[#4b5563] outline-none focus:ring-2 focus:ring-[#ff99ad]"
            onChange={(event) => onLanguageChange(event.target.value as UiLanguage)}
            value={language}
          >
            {languageOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden h-full min-h-0 flex-col gap-4 p-4 lg:flex">
        <Brand />

        <div className="grid gap-1">
          <NavButton icon={<SquarePen size={19} />} onClick={onNewChat}>
            {copy.newChat}
          </NavButton>
          <NavButton
            active={viewMode === "memory"}
            icon={<BookOpen size={19} />}
            onClick={onOpenMemory}
            testId="nav-memory"
          >
            {copy.memory}
          </NavButton>
        </div>

        <div className="flex min-h-0 flex-1 flex-col pt-2">
          <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">
            <MessageSquare size={13} />
            {copy.chatHistory}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {conversations.length ? (
              conversations.map((conversation) => (
                <div className="relative" key={conversation.id}>
                  <button
                    className={`w-full rounded-lg px-2.5 py-2 pr-12 text-left text-sm transition ${
                      conversation.id === activeConversationId && viewMode === "chat"
                        ? "bg-white font-medium text-[#111827]"
                        : "text-[#4b5563] hover:bg-white/70 hover:text-[#111827]"
                    }`}
                    onClick={() => onSelectConversation(conversation)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      onSetDeleteTarget(conversation.id);
                    }}
                    type="button"
                  >
                    <span className="block truncate">{conversation.title}</span>
                  </button>

                  {deleteTargetId === conversation.id ? (
                    <button
                      aria-label={copy.delete}
                      className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-[#fff0f3] text-[#b42318]"
                      onClick={() => onDeleteConversation(conversation.id)}
                      title={copy.delete}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="px-2 text-sm leading-6 text-[#9ca3af]">{copy.emptyHistory}</p>
            )}
          </div>
        </div>

        <div className="relative mt-auto shrink-0">
          {activePanel ? (
            <UtilityPopover
              copy={copy}
              language={language}
              onLanguageChange={onLanguageChange}
              panel={activePanel}
            />
          ) : null}

          <div className="flex justify-start gap-1">
            <UtilityButton
              active={activePanel === "help"}
              icon={<Info size={17} />}
              label={copy.helpLabel}
              onClick={() => onTogglePanel("help")}
              testId="utility-help"
            />
            <UtilityButton
              active={activePanel === "language"}
              icon={<Languages size={17} />}
              label={copy.languageLabel}
              onClick={() => onTogglePanel("language")}
              testId="utility-language"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

function Brand() {
  return (
    <h1 className="flex shrink-0 items-center gap-2 truncate px-1 text-base font-bold tracking-tight text-[#111827]">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#ff0033]" />
      Agent yh
    </h1>
  );
}

function IconNavButton({
  icon,
  label,
  onClick
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#4b5563] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}

function NavButton({
  active,
  children,
  icon,
  onClick,
  testId = "nav-new-chat"
}: {
  active?: boolean;
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      className={`flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#ff99ad] ${
        active ? "bg-white text-[#111827]" : "bg-transparent text-[#374151] hover:bg-white/70"
      }`}
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

function UtilityButton({
  active,
  icon,
  label,
  onClick,
  testId
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-[#ff99ad] ${
        active ? "bg-white text-[#111827]" : "text-[#4b5563] hover:bg-white/70"
      }`}
      data-testid={testId}
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}

function UtilityPopover({
  copy,
  language,
  onLanguageChange,
  panel
}: {
  copy: UiCopy;
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
  panel: Exclude<UtilityPanel, null>;
}) {
  return (
    <div className="absolute bottom-11 left-0 right-0 z-10 max-h-[320px] overflow-y-auto rounded-xl bg-white p-3 shadow-lg">
      {panel === "help" ? (
        <>
          <p className="text-sm font-medium text-[#374151]">{copy.helpIntro}</p>
          <div className="mt-2 space-y-1 text-xs leading-5 text-[#6b7280]">
            {copy.helpItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </>
      ) : null}

      {panel === "language" ? (
        <>
          <h2 className="text-sm font-semibold">{copy.languageTitle}</h2>
          <div className="mt-2 grid gap-1">
            {languageOptions.map((option) => (
              <button
                className={`flex min-h-9 items-center justify-between rounded-lg px-2 text-sm transition ${
                  language === option.id
                    ? "bg-[#fff0f3] text-[#b00024]"
                    : "text-[#4b5563] hover:bg-[#f3f4f6]"
                }`}
                key={option.id}
                onClick={() => onLanguageChange(option.id)}
                type="button"
              >
                <span>{option.label}</span>
                <span>{language === option.id ? copy.selected : ""}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StarterConversations({
  copy,
  onSelectTask
}: {
  copy: UiCopy;
  onSelectTask: (scenario: ScenarioId) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 pt-4 sm:pt-8">
      {taskOptions.map((option) => {
        const Icon = option.icon;
        const task = copy.tasks[option.id];

        return (
          <button
            className="group rounded-2xl bg-[#f7f7f8] px-4 py-4 text-left outline-none transition hover:bg-[#f1f1f2] focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
            data-testid={`starter-${option.id}`}
            key={option.id}
            onClick={() => onSelectTask(option.id)}
            type="button"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#d6002b]">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#111827]">{task.title}</h2>
                  <span className="text-xs font-medium text-[#d6002b]">{copy.clickToFill}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4b5563]">
                  {task.prompt}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function UserMessage({ message }: { message: Extract<ChatMessage, { role: "user" }> }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-[#f3f4f6] px-4 py-2.5 text-base leading-7 text-[#1f2937]">
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

function AssistantPending({ copy }: { copy: UiCopy }) {
  return (
    <section aria-live="polite" className="flex items-start gap-3 text-[#6b7280]">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ff0033] text-white">
        <Bot aria-hidden="true" size={18} />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="font-semibold text-[#111827]">Agent yh</span>
          <span className="text-sm">{copy.assistantRunning}</span>
        </div>
        <p className="text-base leading-7">{copy.assistantPending}</p>
      </div>
    </section>
  );
}

function Composer({
  composerRef,
  copy,
  draft,
  isRunning,
  onChange,
  onSubmit
}: {
  composerRef: RefObject<HTMLTextAreaElement | null>;
  copy: UiCopy;
  draft: string;
  isRunning: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="shrink-0 bg-white px-4 py-3 sm:px-7 sm:py-4">
      <form
        className="mx-auto flex w-full max-w-[840px] items-end gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-[0_4px_22px_rgba(17,24,39,0.10)] ring-1 ring-[#dfe1e5] transition focus-within:ring-2 focus-within:ring-[#ff99ad]"
        onSubmit={onSubmit}
      >
        <textarea
          aria-label={copy.composerPlaceholder}
          className="max-h-36 min-h-10 flex-1 overflow-y-auto bg-transparent px-1 py-2 text-base leading-7 text-[#111827] outline-none placeholder:text-[#9ca3af]"
          data-testid="composer-textarea"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={copy.composerPlaceholder}
          ref={composerRef}
          rows={1}
          value={draft}
        />
        <button
          aria-label={copy.send}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff0033] text-white transition hover:bg-[#d6002b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad] disabled:bg-[#d1d5db]"
          disabled={!draft.trim() || isRunning}
          title={copy.send}
          type="submit"
        >
          <SendHorizontal aria-hidden="true" size={17} />
        </button>
      </form>
    </div>
  );
}

function createClientErrorRun({
  copy,
  runId,
  scenario,
  startedAt,
  text
}: {
  copy: UiCopy;
  runId: string;
  scenario: ScenarioId;
  startedAt: string;
  text: string;
}): AgentRun {
  const traceId = `trace-${runId}`;

  return {
    id: runId,
    traceId,
    scenario,
    state: "failed",
    title: copy.apiErrorStatus,
    summary: copy.apiErrorSummary,
    userPrompt: text,
    statusLabel: copy.apiErrorStatus,
    startedAt,
    plan: [],
    recommendations: [],
    approvals: [],
    memoryProposals: [],
    tools: [
      {
        id: "client-api-error",
        tool: "agent_api_request",
        input: "POST /api/agent",
        status: "error",
        latencyMs: null,
        retryCount: 0,
        cacheStatus: "disabled",
        evidenceCount: 0,
        errorCode: "UNKNOWN"
      }
    ],
    trace: {
      traceId,
      runId,
      state: "failed",
      modelProfile: "unknown",
      startedAt,
      completedAt: new Date().toISOString(),
      spans: [],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        estimatedCostYen: null
      },
      errorCode: "UNKNOWN"
    }
  };
}

function formatMemoryValue(value: MemoryItem["value"]) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}
