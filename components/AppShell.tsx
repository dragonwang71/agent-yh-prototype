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
import { isAgentStreamEvent } from "@/lib/agent/contracts";
import { createId, defaultMemory, formatClock, inferScenario, taskOptions } from "@/lib/demoData";
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
import type { AgentFeedback, AgentRun, ChatMessage, Conversation, ScenarioId, UserMemory } from "@/lib/types";

type ViewMode = "chat" | "memory";
type UtilityPanel = "help" | "language" | null;

function createMemoryContext(memoryDocument: string, source: ScenarioId): UserMemory[] {
  const text = memoryDocument.trim();

  if (!text) {
    return [];
  }

  return [
    {
      id: "memory-document",
      text,
      source,
      createdAt: "Memory"
    }
  ];
}

function conversationMessagesForMemory(conversation: Conversation) {
  return conversation.messages
    .map((message) => {
      if (message.role === "user") {
        return {
          role: "user" as const,
          content: message.content
        };
      }

      const run = conversation.runs[message.runId];

      if (!run) {
        return null;
      }

      const recommendationText = run.recommendations
        .map((item) => `${item.rank}. ${item.title} - ${item.reason}`)
        .join("\n");

      return {
        role: "assistant" as const,
        content: [run.summary, recommendationText].filter(Boolean).join("\n")
      };
    })
    .filter((message): message is { role: "user" | "assistant"; content: string } =>
      Boolean(message?.content.trim())
    );
}

export function AppShell() {
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [draft, setDraft] = useState("");
  const [draftScenario, setDraftScenario] = useState<ScenarioId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [runs, setRuns] = useState<Record<string, AgentRun>>({});
  const [activeRunId, setActiveRunId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [memory, setMemory] = useState(defaultMemory);
  const [isReady, setIsReady] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel>(null);
  const [language, setLanguage] = useState<UiLanguage>("ja");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const activeRun = activeRunId ? runs[activeRunId] : undefined;
  const copy = uiCopy[language];

  useEffect(() => {
    const storedConversations = loadConversations();
    const firstConversation = storedConversations[0];

    setConversations(storedConversations);
    setMemory(loadMemory());
    setLanguage(loadLanguage());

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
  }, [activeRunId, messages.length, viewMode]);

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

  function handleMemorySave(nextMemory: string) {
    setMemory(nextMemory);
    saveMemory(nextMemory);
  }

  async function refreshMemory(nextMemory: string) {
    const recentMessages = conversations
      .flatMap((conversation) => conversationMessagesForMemory(conversation))
      .slice(-30);

    const response = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memory: nextMemory,
        messages: recentMessages
      })
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorBody?.error ?? "Memory update failed.");
    }

    const result = (await response.json()) as { memory?: string };
    const updatedMemory = result.memory?.trim();

    if (updatedMemory) {
      handleMemorySave(updatedMemory);
    }
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
    const updatedAt = new Date().toISOString();
    upsertConversation({
      id: conversationId,
      title: conversationTitle,
      messages: nextMessages,
      runs: nextRuns,
      activeRunId: activeId,
      updatedAt
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

      if (activeConversationId) {
        setConversations((currentConversations) =>
          currentConversations.map((conversation) =>
            conversation.id === activeConversationId
              ? { ...conversation, runs: nextRuns, activeRunId: runId, updatedAt: new Date().toISOString() }
              : conversation
          )
        );
      }

      return nextRuns;
    });
  }

  function recordFeedback(runId: string, feedback: AgentFeedback) {
    updateRun(runId, (run) => ({ ...run, feedback }));
  }

  async function readAgentStream(
    response: Response,
    onRun: (run: AgentRun) => void
  ) {
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.body || !contentType.includes("application/x-ndjson")) {
      const result = (await response.json()) as { run?: AgentRun };

      if (result.run) {
        onRun(result.run);
      }

      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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

        if (!line) {
          continue;
        }

        const event: unknown = JSON.parse(line);

        if (isAgentStreamEvent(event)) {
          onRun(event.run);
        }
      }
    }

    const finalLine = buffer.trim();

    if (finalLine) {
      const event: unknown = JSON.parse(finalLine);

      if (isAgentStreamEvent(event)) {
        onRun(event.run);
      }
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
          memory: createMemoryContext(memory, scenario),
          language
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("Agent API request failed.");
      }

      await readAgentStream(response, (run) => {
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

      const errorRun: AgentRun = {
        id: runId,
        scenario,
        title: "API error",
        summary: copy.apiErrorSummary,
        userPrompt: text,
        statusLabel: copy.apiErrorStatus,
        startedAt,
        plan: [],
        recommendations: [],
        approvals: [],
        memoryUpdates: [],
        tools: [
          {
            id: "client-api-error",
            tool: "agent_api_request",
            input: "POST /api/agent",
            status: "error",
            latency: "-"
          }
        ]
      };

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
    <div className="grid h-dvh grid-cols-1 overflow-hidden bg-white text-[#111827] lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_320px]">
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
        onTogglePanel={(panel) => setUtilityPanel((current) => (current === panel ? null : panel))}
        viewMode={viewMode}
      />

      <main className="flex min-h-0 flex-col overflow-hidden bg-white">
        {viewMode === "memory" ? (
          <MemoryPanel
            memory={memory}
            onRefresh={refreshMemory}
            onSave={handleMemorySave}
            text={copy}
          />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-7 sm:px-7" ref={scrollAreaRef}>
              <div aria-live="polite" className="mx-auto flex w-full max-w-[880px] flex-col gap-7" role="log">
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
                        key={message.id}
                        copy={copy}
                        onFeedback={(feedback) => recordFeedback(run.id, feedback)}
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
              draft={draft}
              isRunning={isRunning}
              onChange={handleDraftChange}
              onSubmit={handleSubmit}
              copy={copy}
            />
          </>
        )}
      </main>

      <ObservabilityPanel copy={copy} memory={memory} run={activeRun} />
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
    <aside className="flex min-h-0 border-b border-[#e5e7eb] bg-[#fafafa] lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 p-3 lg:p-4">
        <div className="shrink-0 px-1 pt-1">
          <h1 className="flex items-center gap-2 truncate text-lg font-bold leading-tight tracking-tight text-[#111827]">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#ff0033]" />
            Agent yh
          </h1>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-1 lg:grid-cols-1">
          <NavButton icon={<SquarePen size={20} />} onClick={onNewChat}>
            {copy.newChat}
          </NavButton>
          <NavButton
            active={viewMode === "memory"}
            icon={<BookOpen size={20} />}
            onClick={onOpenMemory}
            testId="nav-memory"
          >
            {copy.memory}
          </NavButton>
        </div>

        <div className="hidden min-h-0 flex-1 flex-col border-t border-[#e5e7eb] pt-4 lg:flex">
          <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">
            <MessageSquare size={13} />
            {copy.chatHistory}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {conversations.length ? (
              conversations.map((conversation) => (
                <div className="relative" key={conversation.id}>
                  <button
                    className={`w-full rounded-md px-2.5 py-2 pr-14 text-left text-base transition ${
                      conversation.id === activeConversationId && viewMode === "chat"
                        ? "bg-white text-[#111827] shadow-sm ring-1 ring-[#e5e7eb]"
                        : "text-[#4b5563] hover:bg-[#f3f4f6] hover:text-[#111827]"
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
                      className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-[#fbe7e7] text-[#b42318] transition hover:bg-[#f7d4d4]"
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
              <p className="px-2 text-sm leading-6 text-[#6b7280]">
                {copy.emptyHistory}
              </p>
            )}
          </div>
        </div>

        <div className="relative mt-auto hidden shrink-0 lg:block">
          {activePanel ? (
            <UtilityPopover
              language={language}
              copy={copy}
              onLanguageChange={onLanguageChange}
              panel={activePanel}
            />
          ) : null}

          <div className="flex justify-start gap-2">
            <UtilityButton
              active={activePanel === "help"}
              icon={<Info size={18} />}
              label={copy.helpLabel}
              testId="utility-help"
              onClick={() => onTogglePanel("help")}
            />
            <UtilityButton
              active={activePanel === "language"}
              icon={<Languages size={18} />}
              label={copy.languageLabel}
              testId="utility-language"
              onClick={() => onTogglePanel("language")}
            />
          </div>
        </div>
      </div>
    </aside>
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
      className={`flex min-h-11 items-center justify-center gap-3 rounded-lg px-2 text-base font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#ff99ad] lg:justify-start ${
        active ? "bg-white shadow-sm ring-1 ring-[#e5e7eb]" : "bg-transparent hover:bg-[#f3f4f6]"
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
      className={`flex h-10 w-10 items-center justify-center rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-[#ff99ad] ${
        active ? "bg-white text-[#111827] shadow-sm ring-1 ring-[#e5e7eb]" : "text-[#4b5563] hover:bg-[#f3f4f6]"
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
    <div className="absolute bottom-12 left-0 right-0 z-10 max-h-[320px] overflow-y-auto rounded-xl bg-white p-3 shadow-lg ring-1 ring-[#e5e7eb]">
      {panel === "help" ? (
        <>
          <p className="text-sm leading-6 text-[#4b5563]">
            {copy.helpIntro}
          </p>
          <div className="mt-3 space-y-1 text-sm leading-6 text-[#4b5563]">
            {copy.helpItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </>
      ) : null}

      {panel === "language" ? (
        <>
          <h2 className="text-base font-semibold">{copy.languageTitle}</h2>
          <div className="mt-3 grid gap-1">
            {languageOptions.map((option) => (
              <button
                className={`flex min-h-9 items-center justify-between rounded-md px-2 text-sm transition ${
                  language === option.id
                    ? "bg-[#fff0f3] text-[#b00024]"
                    : "text-[#4b5563] hover:bg-[#f3f4f6]"
                }`}
                key={option.id}
                onClick={() => onLanguageChange(option.id as UiLanguage)}
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
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-3 pt-8 sm:pt-12">
      {taskOptions.map((option) => {
        const Icon = option.icon;
        const task = copy.tasks[option.id];

        return (
          <button
            className="group rounded-2xl border border-[#e5e7eb] bg-white px-4 py-4 text-left shadow-[0_1px_2px_rgba(17,24,39,0.03)] outline-none transition hover:-translate-y-0.5 hover:border-[#d1d5db] hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#ff99ad] motion-reduce:hover:translate-y-0"
            data-testid={`starter-${option.id}`}
            key={option.id}
            onClick={() => onSelectTask(option.id)}
            type="button"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0f3] text-[#d6002b]">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-[#111827]">
                    {task.title}
                  </h2>
                  <span className="text-sm font-medium text-[#d6002b]">{copy.clickToFill}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-[#4b5563]">
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
      <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-[#f3f4f6] px-4 py-2.5 text-base leading-8 text-[#1f2937]">
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

function AssistantPending({ copy }: { copy: UiCopy }) {
  return (
    <section aria-live="polite" className="flex items-start gap-3 text-[#6b7280]">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ff0033] text-white shadow-sm">
        <Bot size={18} />
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
    <div className="shrink-0 border-t border-[#f3f4f6] bg-white px-4 py-4 sm:px-7">
      <form
        className="mx-auto flex w-full max-w-[880px] items-end gap-3 rounded-2xl border border-[#d1d5db] bg-white px-3 py-3 shadow-[0_6px_24px_rgba(17,24,39,0.08)] transition focus-within:border-[#ff6685] focus-within:ring-2 focus-within:ring-[#ffe0e6]"
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
          <SendHorizontal size={17} />
        </button>
      </form>
    </div>
  );
}
