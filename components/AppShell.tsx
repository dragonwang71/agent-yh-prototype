"use client";

import {
  Activity,
  BookOpen,
  Bot,
  Bookmark,
  CheckCircle2,
  Circle,
  ExternalLink,
  Info,
  Languages,
  MessageSquare,
  SendHorizontal,
  SquarePen,
  Trash2
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { MemoryPanel } from "@/components/MemoryPanel";
import { createId, defaultMemory, formatClock, inferScenario, taskOptions } from "@/lib/demoData";
import {
  loadConversations,
  loadLanguage,
  loadMemory,
  saveConversations,
  saveLanguage,
  saveMemory
} from "@/lib/storage";
import type { AgentRun, ChatMessage, Conversation, ScenarioId, StepStatus, ToolStatus, UserMemory } from "@/lib/types";

type ViewMode = "chat" | "memory";
type UtilityPanel = "help" | "language" | null;
type UiLanguage = "zh" | "ja" | "en";

type AgentStreamEvent = {
  type: "run";
  run: AgentRun;
};

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

function memoryPreviewLines(memoryDocument: string) {
  return memoryDocument
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2))
    .slice(0, 3);
}

const languageOptions: Array<{ id: UiLanguage; label: string }> = [
  { id: "ja", label: "日本語" },
  { id: "en", label: "English" },
  { id: "zh", label: "中文" }
];

const htmlLang: Record<UiLanguage, string> = {
  ja: "ja",
  en: "en",
  zh: "zh-CN"
};

const uiCopy = {
  ja: {
    newChat: "新規チャット",
    memory: "メモリー",
    chatHistory: "チャット履歴",
    delete: "削除",
    emptyHistory: "最初のメッセージを送ると、ここに会話が表示されます。",
    helpLabel: "説明",
    languageLabel: "言語",
    helpIntro: "使えること",
    helpItems: [
      "買い物：条件に合う商品を探し、価格・レビュー・商品ページを見られます。",
      "外出：場所と天気を見て、雨なら屋内、晴れなら歩きやすい候補を出します。",
      "地図：候補の場所をすぐ開けます。",
      "メモリー：あなたが残した好みを次の相談に反映します。"
    ],
    languageTitle: "言語",
    selected: "選択中",
    clickToFill: "クリックして入力欄へ",
    tasks: {
      shopping: {
        title: "Shopping agent",
        prompt:
          "来月から一人暮らしを始めるので、2万円以内で電子レンジを探して。レビューが良くて、省スペースなものがいい。"
      },
      outing: {
        title: "Weather agent",
        prompt:
          "土曜日に渋谷で友達と会う。雨なら屋内、晴れなら散歩できる場所を提案して。"
      }
    },
    memoryIntro:
      "あなたが残した好みを表示します。次の依頼を、より近い条件で考えるために使います。",
    memoryEmpty: "まだ保存された好みはありません。",
    update: "更新",
    updating: "更新中",
    updateFailed: "更新失敗",
    preview: "プレビュー",
    edit: "編集",
    assistantRunning: "実行中",
    assistantPending: "依頼内容を確認しています...",
    recommendationTitle: {
      shopping: "おすすめ商品（上位3件）",
      outing: "近くの候補"
    },
    stepStatus: {
      done: "完了",
      running: "実行中",
      waiting: "待機中"
    },
    composerPlaceholder: "Agent yh にメッセージを送る...",
    send: "送信",
    apiErrorSummary:
      "外部 API への接続に失敗しました。キー、ネットワーク、利用制限を確認してから再実行してください。",
    apiErrorStatus: "API接続失敗",
    logTitle: "実行ログ",
    noActiveRun: "実行なし",
    startedAt: "開始",
    planSteps: "実行トレース",
    toolCalls: "ツール呼び出し",
    approvalHistory: "承認履歴",
    memoryUpdates: "メモリー更新",
    memoryKind: {
      add: "追加",
      update: "更新"
    },
    noMemory: "まだ保存された好みはありません。",
    toolStatus: {
      success: "成功",
      waiting: "待機",
      error: "エラー"
    },
    approvalStatus: {
      pending: "承認待ち",
      approved: "承認済み",
      declined: "却下"
    },
    agentTitle: {
      shopping: "Shopping agent",
      outing: "Weather agent"
    }
  },
  en: {
    newChat: "New chat",
    memory: "Memory",
    chatHistory: "Chat History",
    delete: "Delete",
    emptyHistory: "Send a first message and the conversation will appear here.",
    helpLabel: "Help",
    languageLabel: "Language",
    helpIntro: "What this can do",
    helpItems: [
      "Shopping: find products that match your conditions, then open prices, reviews, and product pages.",
      "Outings: check place and weather context, then suggest indoor options for rain or walkable options for clear weather.",
      "Maps: open each suggested place directly.",
      "Memory: reuse preferences you choose to keep for the next request."
    ],
    languageTitle: "Language",
    selected: "Selected",
    clickToFill: "Click to fill the input",
    tasks: {
      shopping: {
        title: "Shopping agent",
        prompt:
          "I am moving into my first apartment next month. Find a compact microwave under 20,000 yen with good reviews."
      },
      outing: {
        title: "Weather agent",
        prompt:
          "I am meeting a friend in Shibuya on Saturday. If it rains, suggest indoor options; if it is sunny, suggest somewhere walkable."
      }
    },
    memoryIntro:
      "Shows preferences you chose to keep, so the next request can start closer to your needs.",
    memoryEmpty: "No saved preferences yet.",
    update: "Update",
    updating: "Updating",
    updateFailed: "Update failed",
    preview: "Preview",
    edit: "Edit",
    assistantRunning: "Running",
    assistantPending: "Reading your request...",
    recommendationTitle: {
      shopping: "Top product recommendations",
      outing: "Nearby options"
    },
    stepStatus: {
      done: "Done",
      running: "Running",
      waiting: "Waiting"
    },
    composerPlaceholder: "Message Agent yh...",
    send: "Send",
    apiErrorSummary:
      "Could not connect to the external API. Check the key, network, and usage limits, then try again.",
    apiErrorStatus: "API connection failed",
    logTitle: "Execution log",
    noActiveRun: "No active run",
    startedAt: "Started",
    planSteps: "Execution trace",
    toolCalls: "Tool calls",
    approvalHistory: "Approval history",
    memoryUpdates: "Memory updates",
    memoryKind: {
      add: "Add",
      update: "Update"
    },
    noMemory: "No saved preferences yet.",
    toolStatus: {
      success: "success",
      waiting: "waiting",
      error: "error"
    },
    approvalStatus: {
      pending: "pending",
      approved: "approved",
      declined: "declined"
    },
    agentTitle: {
      shopping: "Shopping agent",
      outing: "Weather agent"
    }
  },
  zh: {
    newChat: "新聊天",
    memory: "记忆",
    chatHistory: "聊天历史",
    delete: "删除",
    emptyHistory: "发送第一条消息后，对话会出现在这里。",
    helpLabel: "说明",
    languageLabel: "语言",
    helpIntro: "可以做这些事",
    helpItems: [
      "购物：按你的条件找商品，查看价格、评价，并打开商品页。",
      "外出：结合地点和天气，下雨时推荐室内，天气好时推荐适合走走的地方。",
      "地图：每个地点都可以直接打开。",
      "记忆：把你保留的偏好用于下一次请求。"
    ],
    languageTitle: "语言",
    selected: "已选择",
    clickToFill: "点击填入输入框",
    tasks: {
      shopping: {
        title: "Shopping agent",
        prompt:
          "我下个月开始一个人住，想找 2 万日元以内的电子微波炉。希望评价好、省空间。"
      },
      outing: {
        title: "Weather agent",
        prompt:
          "周六要在涩谷和朋友见面。如果下雨就推荐室内方案，如果晴天就推荐适合散步的地方。"
      }
    },
    memoryIntro:
      "这里显示你保留下来的偏好。下一次请求时，会用它来更接近你的条件。",
    memoryEmpty: "还没有保存偏好。",
    update: "更新",
    updating: "更新中",
    updateFailed: "更新失败",
    preview: "预览",
    edit: "编辑",
    assistantRunning: "运行中",
    assistantPending: "正在查看你的需求...",
    recommendationTitle: {
      shopping: "推荐商品（前 3 个）",
      outing: "附近候选"
    },
    stepStatus: {
      done: "完成",
      running: "运行中",
      waiting: "等待中"
    },
    composerPlaceholder: "给 Agent yh 发送消息...",
    send: "发送",
    apiErrorSummary:
      "连接外部 API 失败。请确认 key、网络和使用限制后再试。",
    apiErrorStatus: "API 连接失败",
    logTitle: "执行日志",
    noActiveRun: "暂无运行",
    startedAt: "开始",
    planSteps: "执行轨迹",
    toolCalls: "工具调用",
    approvalHistory: "确认记录",
    memoryUpdates: "记忆更新",
    memoryKind: {
      add: "添加",
      update: "更新"
    },
    noMemory: "还没有保存偏好。",
    toolStatus: {
      success: "成功",
      waiting: "等待",
      error: "错误"
    },
    approvalStatus: {
      pending: "待确认",
      approved: "已确认",
      declined: "已拒绝"
    },
    agentTitle: {
      shopping: "Shopping agent",
      outing: "Weather agent"
    }
  }
};

type UiCopy = (typeof uiCopy)[UiLanguage];

function getRecommendationTitle(copy: UiCopy, scenario: ScenarioId, language: UiLanguage) {
  if (scenario !== "outing") {
    return copy.recommendationTitle[scenario];
  }

  if (language === "en") {
    return "Nearby options";
  }

  if (language === "zh") {
    return "附近候选";
  }

  return "近くの候補";
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
    if (isReady) {
      saveConversations(conversations);
    }
  }, [conversations, isReady]);

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
  }, [activeRunId, messages.length, runs, viewMode]);

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

  function startNewChat() {
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

        const event = JSON.parse(line) as AgentStreamEvent;

        if (event.type === "run") {
          onRun(event.run);
        }
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
        })
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
      setIsRunning(false);
    }
  }

  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden bg-[#f7f4ee] text-[#24211c] lg:grid-cols-[280px_minmax(0,1fr)_280px]">
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

      <main className="flex min-h-0 flex-col overflow-hidden bg-[#f7f4ee]">
        {viewMode === "memory" ? (
          <MemoryPanel
            memory={memory}
            onRefresh={refreshMemory}
            onSave={handleMemorySave}
            text={copy}
          />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-7 sm:px-6" ref={scrollAreaRef}>
              <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
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
                      <AssistantRun
                        key={message.id}
                        copy={copy}
                        language={language}
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
    <aside className="flex min-h-0 border-b border-[#ded8cf] bg-[#f7f4ee] lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 p-3 lg:p-4">
        <div className="shrink-0 px-1 pt-1">
          <h1 className="truncate text-lg font-semibold leading-tight">Agent yh</h1>
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

        <div className="hidden min-h-0 flex-1 flex-col border-t border-[#ded8cf] pt-4 lg:flex">
          <div className="mb-2 flex items-center gap-2 px-2 text-sm font-medium text-[#82796c]">
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
                        ? "bg-[#ebe7df] text-[#24211c]"
                        : "text-[#5f574c] hover:bg-[#eeebe4] hover:text-[#24211c]"
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
              <p className="px-2 text-sm leading-6 text-[#6f675b]">
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
      className={`flex min-h-10 items-center justify-center gap-3 rounded-md px-2 text-base font-medium outline-none transition focus-visible:bg-[#eeebe4] lg:justify-start ${
        active ? "bg-[#ebe7df]" : "bg-transparent hover:bg-[#eeebe4]"
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
      className={`flex h-10 w-10 items-center justify-center rounded-md outline-none transition focus-visible:bg-[#eeebe4] ${
        active ? "bg-[#ebe7df] text-[#24211c]" : "text-[#5f574c] hover:bg-[#eeebe4]"
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
    <div className="absolute bottom-12 left-0 right-0 z-10 max-h-[320px] overflow-y-auto rounded-xl bg-[#fbfaf7] p-3 shadow-sm ring-1 ring-[#ded8cf]">
      {panel === "help" ? (
        <>
          <p className="text-sm leading-6 text-[#5f574c]">
            {copy.helpIntro}
          </p>
          <div className="mt-3 space-y-1 text-sm leading-6 text-[#5f574c]">
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
                    ? "bg-[#e4eadb] text-[#24211c]"
                    : "text-[#5f574c] hover:bg-[#eeebe4]"
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
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 pt-8">
      {taskOptions.map((option) => {
        const Icon = option.icon;
        const task = copy.tasks[option.id];

        return (
          <button
            className="group rounded-2xl border border-[#ded8cf] bg-[#fbfaf7] px-4 py-4 text-left outline-none transition hover:bg-[#eeebe4] focus-visible:ring-2 focus-visible:ring-[#bfcfba]"
            data-testid={`starter-${option.id}`}
            key={option.id}
            onClick={() => onSelectTask(option.id)}
            type="button"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1f7a4d] text-white">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-[#24211c]">
                    {task.title}
                  </h2>
                  <span className="text-sm text-[#7c7466]">{copy.clickToFill}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-[#4f483f]">
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
      <div className="max-w-[84%] rounded-2xl bg-[#e4eadb] px-4 py-2.5 text-base leading-8 text-[#24211c]">
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

function AssistantPending({ copy }: { copy: UiCopy }) {
  return (
    <section className="flex items-start gap-3 text-[#7c7466]">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1f7a4d] text-white">
        <Bot size={18} />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="font-semibold text-[#24211c]">Agent yh</span>
          <span className="text-sm">{copy.assistantRunning}</span>
        </div>
        <p className="text-base leading-7">{copy.assistantPending}</p>
      </div>
    </section>
  );
}

function AssistantRun({
  copy,
  language,
  run,
  time
}: {
  copy: UiCopy;
  language: UiLanguage;
  run: AgentRun;
  time: string;
}) {
  return (
    <section className="flex items-start gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1f7a4d] text-white">
        <Bot size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="font-semibold">Agent yh</span>
          <span className="text-sm text-[#8d8578]">{time}</span>
        </div>

        <div className="bg-[#f7f4ee]">
          <p className="text-base leading-7 text-[#2d2a25]">{run.summary}</p>

          {run.recommendations.length ? (
            <div className="mt-5">
              <SectionTitle icon={<Bookmark size={16} />}>
                {getRecommendationTitle(copy, run.scenario, language)}
              </SectionTitle>
              <div className="mt-2">
                {run.recommendations.map((item) => (
                  <RecommendationRow item={item} key={item.id} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-[#24211c]">
      {icon}
      {children}
    </h2>
  );
}

function RecommendationRow({ item }: { item: AgentRun["recommendations"][number] }) {
  return (
    <div className="grid gap-2 border-b border-[#ded8cf] py-3 last:border-b-0 sm:grid-cols-[26px_1fr_38px] sm:items-start">
      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded bg-[#1f7a4d] text-xs font-semibold text-white">
        {item.rank}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="min-w-0 text-sm font-semibold leading-6 text-[#24211c]">{item.title}</h3>
          {item.price ? <span className="text-base font-semibold text-[#1f7a4d]">{item.price}</span> : null}
        </div>
        <p className="text-sm leading-6 text-[#6f675b]">{item.meta}</p>
        <p className="text-sm leading-6 text-[#4f483f]">
          <span className="font-medium text-[#8a6b1f]">{item.score}</span>
          {item.reason ? ` · ${item.reason}` : ""}
        </p>
      </div>
      <div className="flex sm:justify-end">
        <a
          aria-label={item.actionLabel}
          className={`flex h-8 w-8 items-center justify-center rounded-md border border-[#ded8cf] transition ${
            item.actionUrl
              ? "text-[#4f483f] hover:bg-[#eeebe4]"
              : "pointer-events-none text-[#9a9183]"
          }`}
          href={item.actionUrl ?? "#"}
          rel="noreferrer"
          target="_blank"
          title={item.actionLabel}
        >
          <ExternalLink size={15} />
        </a>
      </div>
    </div>
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
    <div className="shrink-0 bg-[#f7f4ee] px-4 py-4 sm:px-6">
      <form
        className="mx-auto flex w-full max-w-[820px] items-end gap-3 rounded-xl border border-[#ded8cf] bg-[#fbfaf7] px-3 py-3"
        onSubmit={onSubmit}
      >
        <textarea
          className="min-h-10 flex-1 bg-transparent px-1 py-2 text-base leading-7 text-[#24211c] outline-none placeholder:text-[#9a9183]"
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
          value={draft}
        />
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1f7a4d] text-white transition hover:bg-[#155f3b] disabled:bg-[#b8ad9d]"
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

function ObservabilityPanel({
  copy,
  memory,
  run
}: {
  copy: UiCopy;
  memory: string;
  run?: AgentRun;
}) {
  const approvals = run?.approvals ?? [];
  const memoryUpdates = run?.memoryUpdates ?? [];
  const memorySnippets = memoryPreviewLines(memory);

  return (
    <aside className="hidden min-h-0 border-l border-[#ded8cf] bg-[#f7f4ee] lg:flex lg:h-dvh lg:flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div className="shrink-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Activity size={20} />
            {copy.logTitle}
          </h2>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-[#1f7a4d]">
              <span className="h-2 w-2 rounded-full bg-[#1f7a4d]" />
              {run?.statusLabel ?? copy.noActiveRun}
            </span>
            <span className="text-[#7c7466]">{copy.startedAt}: {run?.startedAt ?? "-"}</span>
          </div>
        </div>

        <LogSection title={copy.planSteps}>
          <div className="grid gap-3">
            {(run?.plan ?? []).map((step) => (
              <div className="grid grid-cols-[18px_1fr_auto] items-center gap-2 text-sm" key={step.id}>
                <StatusIcon status={step.status} />
                <span className="min-w-0 truncate text-[#4f483f]">{step.label}</span>
                <span className="text-xs text-[#7c7466]">{step.latency ?? "-"}</span>
              </div>
            ))}
          </div>
        </LogSection>

        <LogSection title={copy.toolCalls}>
          <div>
            {(run?.tools ?? []).map((tool) => (
              <div
                className="grid grid-cols-[1fr_72px_58px] items-center border-b border-[#ded8cf] py-2 text-xs text-[#4f483f] last:border-b-0"
                key={tool.id}
                title={tool.input}
              >
                <span className="min-w-0 truncate">{tool.tool}</span>
                <span className={tool.status === "success" ? "text-[#1f7a4d]" : tool.status === "error" ? "text-[#b42318]" : "text-[#8d8578]"}>
                  {copy.toolStatus[tool.status]}
                </span>
                <span>{tool.latency}</span>
              </div>
            ))}
          </div>
        </LogSection>

        {approvals.length ? (
          <LogSection title={copy.approvalHistory}>
            <div>
              {approvals.map((approval) => (
                <div className="border-b border-[#ded8cf] py-3 text-sm last:border-b-0" key={approval.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`font-medium ${
                        approval.status === "approved"
                          ? "text-[#1f7a4d]"
                          : approval.status === "declined"
                            ? "text-[#b42318]"
                            : "text-[#8a6b1f]"
                      }`}
                    >
                      {copy.approvalStatus[approval.status]}
                    </span>
                    <span className="text-xs text-[#7c7466]">{approval.time}</span>
                  </div>
                  <p className="mt-1 leading-5 text-[#4f483f]">{approval.label}</p>
                </div>
              ))}
            </div>
          </LogSection>
        ) : null}

        {memoryUpdates.length || memorySnippets.length ? (
          <LogSection title={copy.memoryUpdates}>
            <div>
              {memoryUpdates.map((memory) => (
                <div className="grid grid-cols-[58px_42px_1fr] gap-2 border-b border-[#ded8cf] py-3 text-xs last:border-b-0" key={memory.id}>
                  <span className="text-[#7c7466]">{memory.time.slice(0, 5)}</span>
                  <span className="font-semibold text-[#1f7a4d]">{copy.memoryKind[memory.kind]}</span>
                  <span className="leading-5 text-[#4f483f]">{memory.text}</span>
                </div>
              ))}
            </div>
            {memorySnippets.length ? (
              <div className="mt-3 space-y-2 border-t border-[#ded8cf] pt-3">
                {memorySnippets.map((item) => (
                  <p className="text-xs leading-5 text-[#5f574c]" key={item}>
                    {item}
                  </p>
                ))}
              </div>
            ) : null}
          </LogSection>
        ) : null}
      </div>
    </aside>
  );
}

function LogSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-[#24211c]">{title}</h3>
      {children}
    </section>
  );
}

function StatusIcon({ status }: { status: StepStatus | ToolStatus }) {
  if (status === "done" || status === "success") {
    return <CheckCircle2 className="text-[#1f7a4d]" size={16} />;
  }

  if (status === "error") {
    return <Circle className="text-[#b42318]" size={16} />;
  }

  if (status === "running") {
    return <Activity className="text-[#1f7a4d]" size={16} />;
  }

  return <Circle className="text-[#9a9183]" size={16} />;
}
