import { NextResponse } from "next/server";
import { inferScenario } from "@/lib/demoData";
import type { AgentRun, PlanStep, Recommendation, ScenarioId, ToolCall, UserMemory } from "@/lib/types";

type AgentRequest = {
  prompt?: string;
  scenario?: ScenarioId;
  runId?: string;
  startedAt?: string;
  memory?: UserMemory[];
  language?: UiLanguage;
};

type UiLanguage = "ja" | "en" | "zh";

type AgentContext = {
  prompt: string;
  scenario: ScenarioId;
  runId: string;
  startedAt: string;
  memory: UserMemory[];
  language: UiLanguage;
  baseRun: AgentRun;
};

type AgentIntent = {
  scenario: ScenarioId;
  shoppingQuery?: string;
  priceMax?: number;
  place?: string;
  priorities: string[];
  decisionSummary?: string;
};

type IntentResult = {
  intent: AgentIntent;
  usedOpenAI: boolean;
  latency: string;
};

type LocalSearchDecision = {
  query: string;
  decision: string;
  usedOpenAI: boolean;
  latency: string;
};

type OpenAIJsonResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type YahooShoppingItem = {
  name?: string;
  price?: number;
  url?: string;
  review?: {
    rate?: number;
    count?: number;
  };
  seller?: {
    name?: string;
  };
  image?: {
    medium?: string;
  };
};

type YahooShoppingResponse = {
  hits?: YahooShoppingItem[];
};

type YahooFeature = {
  Name?: string;
  Geometry?: {
    Coordinates?: string;
  };
};

type YahooFeatureResponse = {
  Feature?: YahooFeature[];
};

type YahooWeatherPoint = {
  Rainfall?: number;
  Date?: string;
};

type YahooWeatherResponse = {
  Feature?: Array<{
    Property?: {
      WeatherList?: {
        Weather?: YahooWeatherPoint[];
      };
    };
  }>;
};

type YahooLocalGenre = {
  Name?: string;
};

type YahooLocalStation = {
  Name?: string;
  Distance?: string | number;
  Time?: string | number;
};

type YahooLocalProperty = {
  Address?: string;
  Genre?: YahooLocalGenre | YahooLocalGenre[];
  Station?: YahooLocalStation | YahooLocalStation[];
  PcUrl1?: string;
  ReviewUrl?: string;
  Detail?: {
    PcUrl1?: string;
  };
};

type YahooLocalFeature = YahooFeature & {
  Property?: YahooLocalProperty;
};

type YahooLocalSearchResponse = {
  Feature?: YahooLocalFeature[] | YahooLocalFeature;
  ResultInfo?: {
    Count?: number;
    Total?: number;
  };
};

const yahooClientId = process.env.YAHOO_CLIENT_ID;
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const agentText = {
  ja: {
    outputLanguage: "Japanese",
    requirementStatus: "running / 要件確認",
    apiStatus: "running / 情報確認",
    reading: "リクエストを読み取り、使うサービスを決めています。",
    callingShopping: "商品条件を読み取りました。Yahoo Shopping に問い合わせます。",
    callingOuting: "場所と天気条件を読み取りました。Yahoo 地図と Yahoo 天気に問い合わせます。",
    missingKeyStatus: "API key未設定",
    missingKey:
      "YAHOO_CLIENT_ID が未設定です。外部情報の取得には Yahoo! JAPAN Client ID を .env.local に設定してください。",
    apiErrorStatus: "API error",
    apiError: (message: string) => `外部 API の呼び出しに失敗しました。理由: ${message}`,
    liveStatus: "候補を整理済み",
    shoppingSummary: (query: string, count: number) =>
      `「${query}」に合う候補を${count}件選びました。`,
    shoppingSuffix: "",
    shoppingMeta: (seller?: string) =>
      seller ? seller : "商品ページで詳細を確認できます",
    reviewScore: (rate?: number, count?: number) =>
      rate && count ? `${rate} (${count.toLocaleString("ja-JP")}件)` : "レビュー情報あり",
    shoppingReason: (priceMax?: number, withinBudget?: boolean) =>
      priceMax && withinBudget
        ? `予算 ${priceMax.toLocaleString("ja-JP")} 円以内で、レビュー情報を優先して抽出しました。`
        : "レビューと商品情報を見て、候補を絞りました。",
    productAction: "商品ページを開く",
    shoppingMemory: (query: string, priceMax?: number) =>
      `検索条件: ${query}${priceMax ? ` / 上限 ${priceMax} 円` : ""}`,
    shoppingApproval: "この条件を「家電選びの好み」として保存",
    outingApproval: "雨なら屋内を優先する好みとして保存"
  },
  en: {
    outputLanguage: "English",
    requirementStatus: "running / reading request",
    apiStatus: "running / checking sources",
    reading: "Reading the request and choosing which services to use.",
    callingShopping: "Product conditions are clear. Calling Yahoo Shopping.",
    callingOuting: "Place and weather conditions are clear. Calling Yahoo Maps and Yahoo Weather.",
    missingKeyStatus: "API key missing",
    missingKey:
      "YAHOO_CLIENT_ID is not set. Add a Yahoo! JAPAN Client ID to .env.local to fetch live data.",
    apiErrorStatus: "API error",
    apiError: (message: string) => `External API call failed. Reason: ${message}`,
    liveStatus: "recommendations ready",
    shoppingSummary: (query: string, count: number) =>
      `I picked ${count} candidates that match "${query}".`,
    shoppingSuffix: "",
    shoppingMeta: (seller?: string) => (seller ? seller : "Details are available on the product page"),
    reviewScore: (rate?: number, count?: number) =>
      rate && count ? `${rate} (${count.toLocaleString("en-US")} reviews)` : "Review data available",
    shoppingReason: (priceMax?: number, withinBudget?: boolean) =>
      priceMax && withinBudget
        ? `Selected from items within the ${priceMax.toLocaleString("en-US")} yen budget, prioritizing reviews.`
        : "Narrowed the options using product details and review information.",
    productAction: "Open product page",
    shoppingMemory: (query: string, priceMax?: number) =>
      `Search condition: ${query}${priceMax ? ` / max ${priceMax} yen` : ""}`,
    shoppingApproval: "Save these conditions as appliance-shopping preferences",
    outingApproval: "Save the preference to prioritize indoors when it rains"
  },
  zh: {
    outputLanguage: "Chinese",
    requirementStatus: "运行中 / 理解需求",
    apiStatus: "运行中 / 确认信息",
    reading: "正在理解请求，并决定要调用哪些服务。",
    callingShopping: "商品条件已经整理好，正在调用 Yahoo Shopping。",
    callingOuting: "地点和天气条件已经整理好，正在调用 Yahoo 地图和 Yahoo 天气。",
    missingKeyStatus: "缺少 API key",
    missingKey:
      "还没有设置 YAHOO_CLIENT_ID。要获取外部信息，请把 Yahoo! JAPAN Client ID 加到 .env.local。",
    apiErrorStatus: "API 错误",
    apiError: (message: string) => `调用外部 API 失败。原因：${message}`,
    liveStatus: "已整理候选",
    shoppingSummary: (query: string, count: number) =>
      `我选了 ${count} 个符合“${query}”的候选。`,
    shoppingSuffix: "",
    shoppingMeta: (seller?: string) => (seller ? seller : "商品页里可以看详情"),
    reviewScore: (rate?: number, count?: number) =>
      rate && count ? `${rate} (${count.toLocaleString("zh-CN")} 条评价)` : "有评价信息",
    shoppingReason: (priceMax?: number, withinBudget?: boolean) =>
      priceMax && withinBudget
        ? `在 ${priceMax.toLocaleString("zh-CN")} 日元预算内筛选，并优先参考评价信息。`
        : "根据商品信息和评价信息缩小候选范围。",
    productAction: "打开商品页",
    shoppingMemory: (query: string, priceMax?: number) =>
      `搜索条件: ${query}${priceMax ? ` / 上限 ${priceMax} 日元` : ""}`,
    shoppingApproval: "把这些条件保存为家电选择偏好",
    outingApproval: "把雨天优先室内保存为偏好"
  }
} satisfies Record<UiLanguage, Record<string, unknown>>;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AgentRequest;
  const context = prepareAgentContext(body);

  if (new URL(request.url).searchParams.get("stream") === "1") {
    return streamAgentRun(context);
  }

  const { prompt, scenario, memory, language, baseRun } = context;
  const copy = agentText[language];
  const intentResult = await extractIntent(prompt, scenario, memory);
  const intent = intentResult.intent;
  const runBase = {
    ...baseRun,
    scenario: intent.scenario,
    title: getRunTitle(intent.scenario, language)
  };
  const runWithOpenAILog = {
    ...runBase,
    plan: createIntentTrace(intent, intentResult, language, runBase.startedAt, "done"),
    tools: [
      {
        id: "openai-intent",
        tool: openaiApiKey ? "openai_intent_parser" : "rule_based_intent_parser",
        input: memory.length ? `memory_items=${memory.length}` : "memory_items=0",
        status: "success",
        latency: intentResult.latency
      },
    ]
  } satisfies AgentRun;

  if (!yahooClientId) {
    return NextResponse.json({
      run: {
        ...runWithOpenAILog,
        statusLabel: copy.missingKeyStatus,
        summary: copy.missingKey,
        recommendations: [],
        memoryUpdates: []
      }
    });
  }

  try {
    const run =
      intent.scenario === "outing"
        ? await createLiveOutingRun(runWithOpenAILog, intent, yahooClientId, memory, language)
        : await createLiveShoppingRun(runWithOpenAILog, intent, yahooClientId, memory, language);

    return NextResponse.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown API error";

    return NextResponse.json({
      run: {
        ...runWithOpenAILog,
        statusLabel: copy.apiErrorStatus,
        summary: copy.apiError(message),
        recommendations: [],
        memoryUpdates: [],
        tools: [
          ...runWithOpenAILog.tools,
          {
            id: "api-error",
            tool: "yahoo_api_error",
            input: message,
            status: "error",
            latency: "-"
          }
        ]
      }
    });
  }
}

function prepareAgentContext(body: AgentRequest): AgentContext {
  const prompt = body.prompt?.trim() || "2万円以内で電子レンジを探して";
  const scenario = body.scenario ?? inferScenario(prompt);
  const startedAt = body.startedAt ?? "10:24:03";
  const runId = body.runId ?? "api-run";
  const memory = body.memory ?? [];
  const language = normalizeLanguage(body.language);

  return {
    prompt,
    scenario,
    runId,
    startedAt,
    memory,
    language,
    baseRun: createLiveBaseRun(scenario, prompt, startedAt, runId, language)
  };
}

function normalizeLanguage(language: AgentRequest["language"]): UiLanguage {
  return language === "en" || language === "zh" || language === "ja" ? language : "ja";
}

function createLiveBaseRun(
  scenario: ScenarioId,
  prompt: string,
  startedAt: string,
  runId: string,
  language: UiLanguage
): AgentRun {
  return {
    id: runId,
    scenario,
    title: getRunTitle(scenario, language),
    summary: "",
    userPrompt: prompt,
    statusLabel: "",
    startedAt,
    plan: [],
    tools: [],
    recommendations: [],
    approvals: [],
    memoryUpdates: []
  };
}

function getRunTitle(scenario: ScenarioId, language: UiLanguage) {
  if (scenario === "shopping") {
    return language === "en" ? "Shopping run" : language === "zh" ? "购物执行" : "ショッピング実行";
  }

  return language === "en" ? "Weather and map run" : language === "zh" ? "天气和地图执行" : "天気・地図実行";
}

function createTraceStep({
  id,
  label,
  latency,
  startedAt,
  status
}: {
  id: string;
  label: string;
  latency?: string;
  startedAt: string;
  status: PlanStep["status"];
}): PlanStep {
  return {
    id,
    label,
    latency,
    status,
    time: startedAt
  };
}

function createIntentTrace(
  intent: AgentIntent,
  result: Pick<IntentResult, "latency" | "usedOpenAI">,
  language: UiLanguage,
  startedAt: string,
  status: PlanStep["status"]
): PlanStep[] {
  const source = result.usedOpenAI
    ? language === "en"
      ? "OpenAI classified the request"
      : language === "zh"
        ? "OpenAI 判断了请求类型"
        : "OpenAIが依頼タイプを判断"
    : language === "en"
      ? "Rule-based parser classified the request"
      : language === "zh"
        ? "规则解析器判断了请求类型"
        : "ルール解析で依頼タイプを判断";
  const scenario =
    intent.scenario === "shopping"
      ? language === "en"
        ? "shopping"
        : language === "zh"
          ? "购物"
          : "ショッピング"
      : language === "en"
        ? "weather/map"
        : language === "zh"
          ? "天气/地图"
          : "天気・地図";
  const detail =
    intent.scenario === "shopping"
      ? formatShoppingIntentDetail(intent, language)
      : formatOutingIntentDetail(intent, language);
  const decision = intent.decisionSummary ? ` ${intent.decisionSummary}` : "";

  return [
    createTraceStep({
      id: "trace-intent",
      label: `${source}: ${scenario}. ${detail}${decision}`,
      latency: result.latency,
      startedAt,
      status
    })
  ];
}

function createInitialTraceLabel(language: UiLanguage) {
  if (language === "en") {
    return "Read the request and decide which tool chain is needed";
  }

  if (language === "zh") {
    return "读取请求，并判断需要哪条工具链";
  }

  return "依頼を読み、必要なツールチェーンを判断";
}

function createNextToolTraceLabel(intent: AgentIntent, language: UiLanguage) {
  if (intent.scenario === "shopping") {
    const query = intent.shoppingQuery ?? "家電";

    if (language === "en") {
      return `Next tool: Yahoo Shopping itemSearch for "${query}"`;
    }

    if (language === "zh") {
      return `下一步工具：用 Yahoo Shopping 搜索「${query}」`;
    }

    return `次のツール: Yahoo Shoppingで「${query}」を検索`;
  }

  const place = intent.place?.trim() || "\u6e0b\u8c37";

  if (language === "en") {
    return `Next tool: Yahoo Geocoder for "${place}"`;
  }

  if (language === "zh") {
    return `下一步工具：用 Yahoo Geocoder 确认「${place}」`;
  }

  return `次のツール: Yahoo Geocoderで「${place}」を確認`;
}

function formatShoppingIntentDetail(intent: AgentIntent, language: UiLanguage) {
  const query = intent.shoppingQuery ?? "家電";
  const price = intent.priceMax ? `, price_to=${intent.priceMax}` : "";

  if (language === "en") {
    return `Extracted query="${query}"${price}.`;
  }

  if (language === "zh") {
    return `抽取 query="${query}"${price}。`;
  }

  return `query="${query}"${price} を抽出。`;
}

function formatOutingIntentDetail(intent: AgentIntent, language: UiLanguage) {
  const place = intent.place?.trim() || "\u6e0b\u8c37";

  if (language === "en") {
    return `Extracted place="${place}".`;
  }

  if (language === "zh") {
    return `抽取 place="${place}"。`;
  }

  return `place="${place}" を抽出。`;
}

function streamAgentRun({
  baseRun,
  language,
  memory,
  prompt,
  scenario
}: AgentContext) {
  const encoder = new TextEncoder();
  const copy = agentText[language];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (run: AgentRun) => {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "run", run })}\n`));
      };

      const progressTools: ToolCall[] = [
        {
          id: "openai-intent",
          tool: openaiApiKey ? "openai_intent_parser" : "rule_based_intent_parser",
          input: memory.length ? `memory_items=${memory.length}` : "memory_items=0",
          status: "waiting",
          latency: "-"
        }
      ];

      try {
        send(
          progressRun(baseRun, {
            summary: copy.reading,
            statusLabel: copy.requirementStatus,
            plan: [
              createTraceStep({
                id: "trace-intent",
                label: createInitialTraceLabel(language),
                startedAt: baseRun.startedAt,
                status: "running"
              })
            ],
            tools: progressTools,
            recommendations: [],
            approvals: [],
            memoryUpdates: []
          })
        );

        const intentResult = await extractIntent(prompt, scenario, memory);
        const intent = intentResult.intent;
        const runBase = {
          ...baseRun,
          scenario: intent.scenario,
          title: getRunTitle(intent.scenario, language)
        };
        const runWithOpenAILog = {
          ...runBase,
          plan: createIntentTrace(intent, intentResult, language, runBase.startedAt, "done"),
          tools: [
            {
              id: "openai-intent",
              tool: openaiApiKey ? "openai_intent_parser" : "rule_based_intent_parser",
              input: memory.length ? `memory_items=${memory.length}` : "memory_items=0",
              status: "success",
              latency: intentResult.latency
            }
          ]
        } satisfies AgentRun;

        send(
          progressRun(runWithOpenAILog, {
            summary:
              intent.scenario === "outing"
                ? copy.callingOuting
                : copy.callingShopping,
            statusLabel: copy.apiStatus,
            plan: [
              ...createIntentTrace(intent, intentResult, language, runBase.startedAt, "done"),
              createTraceStep({
                id: "trace-next-tool",
                label: createNextToolTraceLabel(intent, language),
                startedAt: runBase.startedAt,
                status: "running"
              })
            ],
            tools: [
              runWithOpenAILog.tools[0]
            ],
            recommendations: [],
            approvals: [],
            memoryUpdates: []
          })
        );

        if (!yahooClientId) {
          send({
            ...runWithOpenAILog,
            statusLabel: copy.missingKeyStatus,
            summary: copy.missingKey,
            recommendations: [],
            memoryUpdates: []
          });
          controller.close();
          return;
        }

        const run =
          intent.scenario === "outing"
            ? await createLiveOutingRun(runWithOpenAILog, intent, yahooClientId, memory, language)
            : await createLiveShoppingRun(runWithOpenAILog, intent, yahooClientId, memory, language);

        send(run);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown API error";

        send({
          ...baseRun,
          statusLabel: copy.apiErrorStatus,
          summary: copy.apiError(message),
          recommendations: [],
          memoryUpdates: [],
          tools: [
            {
              id: "api-error",
              tool: "yahoo_api_error",
              input: message,
              status: "error",
              latency: "-"
            }
          ]
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8"
    }
  });
}

function progressRun(
  baseRun: AgentRun,
  {
    approvals,
    memoryUpdates,
    plan,
    recommendations,
    statusLabel,
    summary,
    tools
  }: {
    approvals?: AgentRun["approvals"];
    memoryUpdates?: AgentRun["memoryUpdates"];
    plan?: AgentRun["plan"];
    recommendations?: AgentRun["recommendations"];
    statusLabel: string;
    summary: string;
    tools: ToolCall[];
  }
): AgentRun {
  return {
    ...baseRun,
    statusLabel,
    summary,
    plan: plan ?? baseRun.plan,
    tools,
    recommendations: recommendations ?? baseRun.recommendations,
    approvals: approvals ?? baseRun.approvals,
    memoryUpdates: memoryUpdates ?? baseRun.memoryUpdates
  };
}

async function createLiveShoppingRun(
  baseRun: AgentRun,
  intent: AgentIntent,
  clientId: string,
  memory: UserMemory[],
  language: UiLanguage
): Promise<AgentRun> {
  const copy = agentText[language];
  const query = intent.shoppingQuery?.trim() || "家電";
  const priceMax = intent.priceMax;
  const started = performance.now();
  const params = new URLSearchParams({
    appid: clientId,
    query,
    results: "10"
  });

  if (priceMax) {
    params.set("price_to", String(priceMax));
  }

  const response = await fetch(
    `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?${params.toString()}`,
    { headers: { Accept: "application/json" } }
  );
  const latency = `${Math.round(performance.now() - started)}ms`;

  if (!response.ok) {
    throw new Error(`Shopping API ${response.status}`);
  }

  const data = (await response.json()) as YahooShoppingResponse;
  const hits = (data.hits ?? []).slice(0, 3);

  if (!hits.length) {
    throw new Error("Shopping API returned no hits");
  }

  const recommendations: Recommendation[] = hits.map((item, index) => ({
    id: `live-shopping-${index + 1}`,
    rank: index + 1,
    title: item.name ?? `${query} 候補 ${index + 1}`,
    meta: copy.shoppingMeta(item.seller?.name),
    price: typeof item.price === "number" ? `¥${item.price.toLocaleString("ja-JP")}` : undefined,
    score: copy.reviewScore(item.review?.rate, item.review?.count),
    reason: copy.shoppingReason(priceMax, Boolean(priceMax && item.price && item.price <= priceMax)),
    actionLabel: copy.productAction,
    actionUrl: item.url
  }));

  const tools: ToolCall[] = [
    ...baseRun.tools.filter((tool) => tool.id === "openai-intent"),
    {
      id: "live-shopping-search",
      tool: "yahoo_shopping_itemSearch",
      input: `query=${query}${priceMax ? `, price_to=${priceMax}` : ""}`,
      status: "success",
      latency
    }
  ];
  const finalTools: ToolCall[] = [
    ...tools,
    {
      id: "source-grounded-shopping-output",
      tool: "deterministic_source_grounded_formatter",
      input: `shopping_results=${hits.length}, memory_items=${memory.length}, no_mock=true`,
      status: "success",
      latency: "-"
    }
  ];

  return {
    ...baseRun,
    plan: createShoppingExecutionTrace({
      baseRun,
      hits: hits.length,
      intent,
      language,
      query,
      searchLatency: latency
    }),
    statusLabel: copy.liveStatus,
    summary: copy.shoppingSuffix
      ? `${copy.shoppingSummary(query, hits.length)} ${copy.shoppingSuffix}`
      : copy.shoppingSummary(query, hits.length),
    tools: finalTools,
    recommendations,
    approvals: [],
    memoryUpdates: []
  };
}

function createShoppingExecutionTrace({
  baseRun,
  hits,
  intent,
  language,
  query,
  searchLatency
}: {
  baseRun: AgentRun;
  hits: number;
  intent: AgentIntent;
  language: UiLanguage;
  query: string;
  searchLatency: string;
}): PlanStep[] {
  const intentTool = baseRun.tools.find((tool) => tool.id === "openai-intent");
  const steps = createIntentTrace(
    intent,
    {
      latency: intentTool?.latency ?? "-",
      usedOpenAI: intentTool?.tool === "openai_intent_parser"
    },
    language,
    baseRun.startedAt,
    "done"
  );
  const priceText = intent.priceMax ? `, price_to=${intent.priceMax}` : "";

  return [
    ...steps,
    createTraceStep({
      id: "trace-shopping-search",
      label:
        language === "en"
          ? `Called Yahoo Shopping itemSearch with query="${query}"${priceText}`
          : language === "zh"
            ? `调用 Yahoo Shopping itemSearch：query="${query}"${priceText}`
            : `Yahoo Shopping itemSearchを実行: query="${query}"${priceText}`,
      latency: searchLatency,
      startedAt: baseRun.startedAt,
      status: "done"
    }),
    createTraceStep({
      id: "trace-shopping-filter",
      label:
        language === "en"
          ? `Used ${hits} returned items; ranked only by returned price, seller, and review fields`
          : language === "zh"
            ? `使用返回的 ${hits} 个商品；只按返回的价格、店铺和评价字段整理`
            : `返却された${hits}件を使用し、価格・ストア・レビューの返却フィールドだけで整理`,
      startedAt: baseRun.startedAt,
      status: "done"
    }),
    createTraceStep({
      id: "trace-shopping-grounded-output",
      label:
        language === "en"
          ? "Formatted the answer without inventing unavailable product fields"
          : language === "zh"
            ? "只格式化已取得的商品字段，不补写没有返回的信息"
            : "取得できた商品フィールドだけを整形し、未取得情報は補わない",
      startedAt: baseRun.startedAt,
      status: "done"
    })
  ];
}

async function createLiveOutingRun(
  baseRun: AgentRun,
  intent: AgentIntent,
  clientId: string,
  memory: UserMemory[],
  language: UiLanguage
): Promise<AgentRun> {
  const copy = agentText[language];
  const place = intent.place?.trim() || "\u6e0b\u8c37";
  const geocodeStarted = performance.now();
  const geocodeParams = new URLSearchParams({
    appid: clientId,
    query: place,
    output: "json",
    results: "1"
  });
  const geocodeResponse = await fetch(
    `https://map.yahooapis.jp/geocode/V1/geoCoder?${geocodeParams.toString()}`,
    { headers: { Accept: "application/json" } }
  );
  const geocodeLatency = `${Math.round(performance.now() - geocodeStarted)}ms`;

  if (!geocodeResponse.ok) {
    throw new Error(`Geocoder API ${geocodeResponse.status}`);
  }

  const geocode = (await geocodeResponse.json()) as YahooFeatureResponse;
  const geocodeFeature = geocode.Feature?.[0];
  const coordinates = geocodeFeature?.Geometry?.Coordinates;

  if (!coordinates) {
    throw new Error("Geocoder API returned no coordinates");
  }

  const [lon, lat] = coordinates.split(",").map((value) => value.trim());

  if (!lon || !lat) {
    throw new Error("Geocoder API returned malformed coordinates");
  }

  const weatherStarted = performance.now();
  const weatherParams = new URLSearchParams({
    appid: clientId,
    coordinates: `${lon},${lat}`,
    output: "json"
  });
  const weatherResponse = await fetch(
    `https://map.yahooapis.jp/weather/V1/place?${weatherParams.toString()}`,
    { headers: { Accept: "application/json" } }
  );
  const weatherLatency = `${Math.round(performance.now() - weatherStarted)}ms`;

  if (!weatherResponse.ok) {
    throw new Error(`Weather API ${weatherResponse.status}`);
  }

  const weather = (await weatherResponse.json()) as YahooWeatherResponse;
  const weatherPoints = weather.Feature?.[0]?.Property?.WeatherList?.Weather ?? [];
  const rainfalls = weatherPoints.map((item) => item.Rainfall ?? 0);
  const maxRainfall = rainfalls.length ? Math.max(...rainfalls) : 0;
  const localSearchDecision = weatherPoints.length
    ? await chooseLocalSearchQueryWithModel({
        language,
        maxRainfall,
        memory,
        prompt: baseRun.userPrompt,
        weatherPoints
      })
    : null;
  const localQuery = localSearchDecision?.query ?? null;
  let localPlaces: YahooLocalFeature[] = [];
  let localLatency = "-";
  let localError: string | undefined;

  if (localQuery) {
    const localStarted = performance.now();

    try {
      const localParams = new URLSearchParams({
        appid: clientId,
        query: localQuery,
        lat,
        lon,
        dist: "2",
        sort: "geo",
        results: "6",
        detail: "standard",
        output: "json"
      });
      const localResponse = await fetch(
        `https://map.yahooapis.jp/search/local/V1/localSearch?${localParams.toString()}`,
        { headers: { Accept: "application/json" } }
      );

      localLatency = `${Math.round(performance.now() - localStarted)}ms`;

      if (!localResponse.ok) {
        throw new Error(`Local Search API ${localResponse.status}`);
      }

      const localData = (await localResponse.json()) as YahooLocalSearchResponse;
      localPlaces = dedupeLocalPlaces(asArray(localData.Feature)).slice(0, 3);
    } catch (error) {
      localLatency = `${Math.round(performance.now() - localStarted)}ms`;
      localError = error instanceof Error ? error.message : "Unknown Local Search API error";
    }
  }

  const groundedResult = createGroundedOutingResult({
    coordinates,
    language,
    localPlaces,
    localQuery,
    maxRainfall,
    place,
    resolvedName: geocodeFeature?.Name,
    weatherPoints
  });
  const localTool: ToolCall | undefined = localQuery
    ? {
        id: "live-local-search",
        tool: "yahoo_yolp_local_search",
        input: `query=${localQuery}, lat=${lat}, lon=${lon}, dist=2km, results=${localPlaces.length}${
          localError ? `, error=${localError}` : ""
        }`,
        status: localError ? "error" : "success",
        latency: localLatency
      }
    : undefined;
  const intentTool = baseRun.tools.find((tool) => tool.id === "openai-intent");
  const localDecisionTool: ToolCall | undefined = localSearchDecision
    ? {
        id: "openai-next-tool-selector",
        tool: localSearchDecision.usedOpenAI
          ? "openai_next_tool_selector"
          : "rule_based_next_tool_selector",
        input: `max_rainfall_mm_h=${maxRainfall}, selected_query=${localSearchDecision.query}, decision=${localSearchDecision.decision}`,
        status: "success",
        latency: localSearchDecision.latency
      }
    : undefined;
  const finalTools: ToolCall[] = [
    ...(intentTool ? [intentTool] : []),
    {
      id: "live-geocoder",
      tool: "yahoo_yolp_geocoder",
      input: `query=${place}, resolved=${geocodeFeature?.Name ?? "-"}, coordinates=${coordinates}`,
      status: "success",
      latency: geocodeLatency
    },
    {
      id: "live-weather",
      tool: "yahoo_yolp_weather",
      input: `coordinates=${lon},${lat}, weather_points=${weatherPoints.length}, max_rainfall_mm_h=${maxRainfall}`,
      status: "success",
      latency: weatherLatency
    },
    ...(localDecisionTool ? [localDecisionTool] : []),
    ...(localTool ? [localTool] : []),
    {
      id: "source-grounded-output",
      tool: "deterministic_source_grounded_formatter",
      input: `weather_points=${weatherPoints.length}, local_results=${localPlaces.length}, memory_items=${memory.length}, no_mock=true`,
      status: "success",
      latency: "-"
    }
  ];

  return {
    ...baseRun,
    plan: createOutingExecutionTrace({
      baseRun,
      geocodeLatency,
      intent,
      language,
      localError,
      localPlaces,
      localSearchDecision,
      localTool,
      maxRainfall,
      place,
      resolvedName: geocodeFeature?.Name,
      weatherLatency,
      weatherPoints
    }),
    statusLabel: copy.liveStatus,
    summary: groundedResult.summary,
    tools: finalTools,
    recommendations: groundedResult.recommendations,
    approvals: [],
    memoryUpdates: []
  };
}

function createOutingExecutionTrace({
  baseRun,
  geocodeLatency,
  intent,
  language,
  localError,
  localPlaces,
  localSearchDecision,
  localTool,
  maxRainfall,
  place,
  resolvedName,
  weatherLatency,
  weatherPoints
}: {
  baseRun: AgentRun;
  geocodeLatency: string;
  intent: AgentIntent;
  language: UiLanguage;
  localError?: string;
  localPlaces: YahooLocalFeature[];
  localSearchDecision: LocalSearchDecision | null;
  localTool?: ToolCall;
  maxRainfall: number;
  place: string;
  resolvedName?: string;
  weatherLatency: string;
  weatherPoints: YahooWeatherPoint[];
}): PlanStep[] {
  const intentTool = baseRun.tools.find((tool) => tool.id === "openai-intent");
  const steps = createIntentTrace(
    intent,
    {
      latency: intentTool?.latency ?? "-",
      usedOpenAI: intentTool?.tool === "openai_intent_parser"
    },
    language,
    baseRun.startedAt,
    "done"
  );
  const placeLabel = formatPlaceLabel(place, resolvedName);

  return [
    ...steps,
    createTraceStep({
      id: "trace-geocoder",
      label:
        language === "en"
          ? `Called Yahoo Geocoder and resolved "${place}" to ${placeLabel}`
          : language === "zh"
            ? `调用 Yahoo Geocoder，把「${place}」解析为 ${placeLabel}`
            : `Yahoo Geocoderで「${place}」を${placeLabel}として解決`,
      latency: geocodeLatency,
      startedAt: baseRun.startedAt,
      status: "done"
    }),
    createTraceStep({
      id: "trace-weather",
      label:
        language === "en"
          ? `Called Yahoo Weather; received ${weatherPoints.length} rainfall records, max ${formatRainfall(maxRainfall, language)} mm/h`
          : language === "zh"
            ? `调用 Yahoo Weather；取得 ${weatherPoints.length} 条降水记录，最大 ${formatRainfall(maxRainfall, language)} mm/h`
            : `Yahoo Weatherを呼び出し、降水レコード${weatherPoints.length}件・最大${formatRainfall(maxRainfall, language)} mm/hを取得`,
      latency: weatherLatency,
      startedAt: baseRun.startedAt,
      status: "done"
    }),
    ...(localSearchDecision
      ? [
          createTraceStep({
            id: "trace-next-query",
            label:
              language === "en"
                ? `After weather data, selected Yahoo Local Search query "${formatLocalQueryLabel(localSearchDecision.query, language)}": ${localSearchDecision.decision}`
                : language === "zh"
                  ? `拿到天气数据后，选择 Yahoo Local Search 搜索「${formatLocalQueryLabel(localSearchDecision.query, language)}」：${localSearchDecision.decision}`
                  : `天気データ取得後、Yahoo Local Searchの検索語「${formatLocalQueryLabel(localSearchDecision.query, language)}」を選択: ${localSearchDecision.decision}`,
            latency: localSearchDecision.latency,
            startedAt: baseRun.startedAt,
            status: "done" as const
          })
        ]
      : []),
    ...(localTool
      ? [
          createTraceStep({
            id: "trace-local-search",
            label: localError
              ? language === "en"
                ? `Yahoo Local Search failed: ${localError}`
                : language === "zh"
                  ? `Yahoo Local Search 失败：${localError}`
                  : `Yahoo Local Searchが失敗: ${localError}`
              : language === "en"
                ? `Called Yahoo Local Search; received ${localPlaces.length} real nearby places`
                : language === "zh"
                  ? `调用 Yahoo Local Search；取得 ${localPlaces.length} 个真实附近地点`
                  : `Yahoo Local Searchを呼び出し、実在する周辺地点${localPlaces.length}件を取得`,
            latency: localTool.latency,
            startedAt: baseRun.startedAt,
            status: localError ? "waiting" : "done"
          })
        ]
      : []),
    createTraceStep({
      id: "trace-outing-grounded-output",
      label:
        language === "en"
          ? "Prepared the weather and place results for display"
          : language === "zh"
            ? "整理天气和地点结果"
            : "天気と地点の結果を表示用に整理",
      startedAt: baseRun.startedAt,
      status: "done"
    })
  ];
}

async function chooseLocalSearchQueryWithModel({
  language,
  maxRainfall,
  memory,
  prompt,
  weatherPoints
}: {
  language: UiLanguage;
  maxRainfall: number;
  memory: UserMemory[];
  prompt: string;
  weatherPoints: YahooWeatherPoint[];
}): Promise<LocalSearchDecision> {
  const fallbackQuery = chooseLocalSearchQuery(prompt, maxRainfall);
  const fallbackDecision = formatFallbackLocalSearchDecision(fallbackQuery, maxRainfall, language);

  if (!openaiApiKey) {
    return {
      query: fallbackQuery,
      decision: fallbackDecision,
      usedOpenAI: false,
      latency: "-"
    };
  }

  const started = performance.now();

  try {
    const content = await callOpenAIJson([
      {
        role: "system",
        content:
          "You select the next tool input for Agent yh after real weather data has been fetched. Do not reveal chain-of-thought. Return only JSON with query and decision. query must be exactly one of: カフェ, 公園, 美術館, レストラン. If maxRainfall is above 0, do not choose 公園. decision must be one concise observable reason in the requested UI language and must not name a specific place unless a prior API result supplied it."
      },
      {
        role: "user",
        content: JSON.stringify({
          uiLanguage: language,
          prompt,
          maxRainfall,
          weatherPointCount: weatherPoints.length,
          weatherWindow: formatWeatherWindow(weatherPoints, language),
          memory: memory.map((item) => item.text).slice(0, 5)
        })
      }
    ]);
    const parsed = JSON.parse(content) as Partial<{ query: string; decision: string }>;
    const query = normalizeLocalSearchQuery(parsed.query, maxRainfall) ?? fallbackQuery;
    const decision =
      query === parsed.query?.trim() && parsed.decision?.trim()
        ? parsed.decision.trim()
        : fallbackDecision;

    return {
      query,
      decision,
      usedOpenAI: true,
      latency: `${Math.round(performance.now() - started)}ms`
    };
  } catch {
    return {
      query: fallbackQuery,
      decision: fallbackDecision,
      usedOpenAI: false,
      latency: `${Math.round(performance.now() - started)}ms`
    };
  }
}

function normalizeLocalSearchQuery(query: string | undefined, maxRainfall: number) {
  const allowed = ["カフェ", "公園", "美術館", "レストラン"];
  const normalized = query?.trim();

  if (maxRainfall > 0 && normalized === "公園") {
    return undefined;
  }

  return allowed.find((item) => item === normalized);
}

function formatFallbackLocalSearchDecision(
  query: string,
  maxRainfall: number,
  language: UiLanguage
) {
  const queryLabel = formatLocalQueryLabel(query, language);
  const rain = formatRainfall(maxRainfall, language);

  if (language === "en") {
    return maxRainfall > 0
      ? `Rainfall is ${rain} mm/h, so an indoor-friendly query was selected.`
      : `Rainfall is ${rain} mm/h, so a walkable outdoor query was selected.`;
  }

  if (language === "zh") {
    return maxRainfall > 0
      ? `最大降水为 ${rain} mm/h，因此选择偏室内的「${queryLabel}」。`
      : `最大降水为 ${rain} mm/h，因此选择适合步行的「${queryLabel}」。`;
  }

  return maxRainfall > 0
    ? `最大降水${rain} mm/hのため、屋内寄りの「${queryLabel}」を選択。`
    : `最大降水${rain} mm/hのため、歩きやすい「${queryLabel}」を選択。`;
}

function chooseLocalSearchQuery(prompt: string, maxRainfall: number) {
  const normalizedPrompt = prompt.toLowerCase();

  if (
    prompt.includes("美術館") ||
    prompt.includes("博物館") ||
    prompt.includes("展覧") ||
    prompt.includes("展览") ||
    normalizedPrompt.includes("museum") ||
    normalizedPrompt.includes("gallery")
  ) {
    return "美術館";
  }

  if (
    prompt.includes("カフェ") ||
    prompt.includes("喫茶") ||
    prompt.includes("咖啡") ||
    normalizedPrompt.includes("cafe") ||
    normalizedPrompt.includes("coffee")
  ) {
    return "カフェ";
  }

  if (
    prompt.includes("レストラン") ||
    prompt.includes("食事") ||
    prompt.includes("餐厅") ||
    normalizedPrompt.includes("restaurant")
  ) {
    return "レストラン";
  }

  if (maxRainfall > 0) {
    return "カフェ";
  }

  return "公園";
}

function createGroundedOutingResult({
  coordinates,
  language,
  localPlaces,
  localQuery,
  maxRainfall,
  place,
  resolvedName,
  weatherPoints
}: {
  coordinates: string;
  language: UiLanguage;
  localPlaces: YahooLocalFeature[];
  localQuery: string | null;
  maxRainfall: number;
  place: string;
  resolvedName?: string;
  weatherPoints: YahooWeatherPoint[];
}): Pick<AgentRun, "summary" | "recommendations"> & { memoryText: string } {
  const placeLabel = formatPlaceLabel(place, resolvedName);
  const weatherWindow = formatWeatherWindow(weatherPoints, language);
  const localQueryLabel = localQuery ? formatLocalQueryLabel(localQuery, language) : "";
  const weatherCount = weatherPoints.length;
  const recommendations: Recommendation[] = localPlaces.map((feature, index) =>
    createLocalPlaceRecommendation({
      feature,
      index,
      language,
      localQuery: localQuery ?? "",
      placeLabel
    })
  );

  return {
    summary: formatGroundedOutingSummary({
      language,
      maxRainfall,
      placeLabel,
      localPlaces,
      localQueryLabel,
      weatherWindow
    }),
    recommendations,
    memoryText:
      `Outing data: place=${placeLabel}, coordinates=${coordinates}, weather_points=${weatherCount}, ` +
      `max_rainfall_mm_h=${maxRainfall}, local_query=${localQuery ?? "none"}, ` +
      `local_results=${localPlaces.length}, sources=Yahoo Geocoder|Yahoo Weather|Yahoo Local Search`
  };
}

function createLocalPlaceRecommendation({
  feature,
  index,
  language,
  localQuery,
  placeLabel
}: {
  feature: YahooLocalFeature;
  index: number;
  language: UiLanguage;
  localQuery: string;
  placeLabel: string;
}): Recommendation {
  const name =
    feature.Name ??
    (language === "en" ? "Nearby place" : language === "zh" ? "附近地点" : "近くの地点");
  const queryLabel = formatLocalQueryLabel(localQuery, language);
  const actionLabel =
    language === "en" ? "Open place" : language === "zh" ? "打开地点" : "地点を開く";

  return {
    id: `live-local-${index + 1}`,
    rank: index + 1,
    title: name,
    meta: formatLocalMeta(feature, language),
    score: formatLocalScore(feature, localQuery, language),
    reason: formatLocalReason({
      language,
      placeLabel,
      queryLabel
    }),
    actionLabel,
    actionUrl: getLocalPlaceUrl(feature) ?? createYahooMapUrl(name)
  };
}

function formatGroundedOutingSummary({
  language,
  localPlaces,
  localQueryLabel,
  maxRainfall,
  placeLabel,
  weatherWindow
}: {
  language: UiLanguage;
  localPlaces: YahooLocalFeature[];
  localQueryLabel: string;
  maxRainfall: number;
  placeLabel: string;
  weatherWindow: string;
}) {
  const hasRain = maxRainfall > 0;

  if (language === "en") {
    return hasRain
      ? `${placeLabel} has rain around ${weatherWindow}. I found ${localPlaces.length} nearby ${localQueryLabel || "places"} that are easier to use in wet weather.`
      : `${placeLabel} is not showing rain around ${weatherWindow}. I found ${localPlaces.length} nearby ${localQueryLabel || "places"} for a walkable plan.`;
  }

  if (language === "zh") {
    return hasRain
      ? `${placeLabel} 在 ${weatherWindow} 附近有雨。先给你找了 ${localPlaces.length} 个更适合避雨的附近地点。`
      : `${placeLabel} 在 ${weatherWindow} 附近暂时没有明显降水。先给你找了 ${localPlaces.length} 个适合步行的附近地点。`;
  }

  return hasRain
    ? `${placeLabel}は${weatherWindow}ごろ雨があります。雨を避けやすい近くの候補を${localPlaces.length}件選びました。`
    : `${placeLabel}は${weatherWindow}ごろ大きな雨は見えていません。歩きやすい近くの候補を${localPlaces.length}件選びました。`;
}

function formatLocalReason({
  language,
  placeLabel,
  queryLabel
}: {
  language: UiLanguage;
  placeLabel: string;
  queryLabel: string;
}) {
  if (language === "en") {
    return `Good match near ${placeLabel} for a ${queryLabel} stop.`;
  }

  if (language === "zh") {
    return `在 ${placeLabel} 附近，适合作为「${queryLabel}」停留点。`;
  }

  return `${placeLabel}周辺で「${queryLabel}」の立ち寄り先として使いやすい候補です。`;
}

function formatLocalMeta(feature: YahooLocalFeature, language: UiLanguage) {
  const address = feature.Property?.Address;
  const genre = asArray(feature.Property?.Genre)
    .map((item) => item.Name)
    .filter(Boolean)
    .slice(0, 2)
    .join(" / ");
  const fallback =
    language === "en"
      ? "Nearby place"
      : language === "zh"
        ? "附近地点"
        : "近くの地点";

  return [address, genre].filter(Boolean).join(" / ") || fallback;
}

function formatLocalScore(feature: YahooLocalFeature, localQuery: string, language: UiLanguage) {
  const station = asArray(feature.Property?.Station)[0];
  const queryLabel = formatLocalQueryLabel(localQuery, language);

  if (station?.Name || station?.Time || station?.Distance) {
    const stationName = station.Name ?? "";
    const time = station.Time ? `${station.Time}` : "";
    const distance = station.Distance ? `${station.Distance}m` : "";

    if (language === "en") {
      return [`Nearest ${stationName}`, time ? `${time} min walk` : "", distance]
        .filter(Boolean)
        .join(" / ");
    }

    if (language === "zh") {
      return [`最近车站 ${stationName}`, time ? `步行 ${time} 分钟` : "", distance]
        .filter(Boolean)
        .join(" / ");
    }

    return [`最寄り ${stationName}`, time ? `徒歩${time}分` : "", distance]
      .filter(Boolean)
      .join(" / ");
  }

  return queryLabel || (language === "en" ? "Nearby option" : language === "zh" ? "附近候选" : "近くの候補");
}

function formatPlaceLabel(place: string, resolvedName?: string) {
  return resolvedName && resolvedName !== place ? `${place} (${resolvedName})` : place;
}

function formatLocalQueryLabel(query: string, language: UiLanguage) {
  if (query === "カフェ") {
    return language === "en" ? "cafe" : language === "zh" ? "咖啡馆" : query;
  }

  if (query === "公園") {
    return language === "en" ? "park" : language === "zh" ? "公园" : query;
  }

  if (query === "美術館") {
    return language === "en" ? "museum" : language === "zh" ? "美术馆" : query;
  }

  if (query === "レストラン") {
    return language === "en" ? "restaurant" : language === "zh" ? "餐厅" : query;
  }

  return query;
}

function formatWeatherWindow(weatherPoints: YahooWeatherPoint[], language: UiLanguage) {
  const first = formatYahooWeatherDate(weatherPoints[0]?.Date);
  const last = formatYahooWeatherDate(weatherPoints[weatherPoints.length - 1]?.Date);

  if (first && last && first !== last) {
    return `${first} - ${last}`;
  }

  if (first) {
    return first;
  }

  return language === "en"
    ? "no returned time range"
    : language === "zh"
      ? "未返回时间范围"
      : "返却された時間範囲なし";
}

function formatYahooWeatherDate(value?: string) {
  const match = value?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);

  if (!match) {
    return value;
  }

  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatRainfall(value: number, language: UiLanguage) {
  const locale = language === "en" ? "en-US" : language === "zh" ? "zh-CN" : "ja-JP";
  return value.toLocaleString(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1
  });
}

function getLocalPlaceUrl(feature: YahooLocalFeature) {
  return feature.Property?.PcUrl1 ?? feature.Property?.Detail?.PcUrl1 ?? feature.Property?.ReviewUrl;
}

function dedupeLocalPlaces(features: YahooLocalFeature[]) {
  const seen = new Set<string>();

  return features.filter((feature) => {
    const key = (feature.Name ?? feature.Geometry?.Coordinates ?? "")
      .replace(/[\s　]/g, "")
      .toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function asArray<T>(value?: T | T[]) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

async function extractIntent(
  prompt: string,
  fallbackScenario: ScenarioId,
  memory: UserMemory[]
): Promise<IntentResult> {
  const fallback: AgentIntent = {
    scenario: fallbackScenario,
    shoppingQuery: extractShoppingQuery(prompt),
    priceMax: extractPriceMax(prompt),
    place: extractPlace(prompt),
    priorities: extractPriorities(prompt, memory),
    decisionSummary: undefined
  };

  if (!openaiApiKey) {
    return { intent: fallback, usedOpenAI: false, latency: "-" };
  }

  const started = performance.now();

  try {
    const content = await callOpenAIJson([
      {
        role: "system",
        content:
          "You route requests for Agent yh and extract structured intent. Do not reveal chain-of-thought. Return only JSON with scenario, shoppingQuery, priceMax, place, priorities, decisionSummary. scenario must be shopping or outing. decisionSummary must be one concise observable reason in the user's UI language."
      },
      {
        role: "user",
        content: JSON.stringify({
          prompt,
          existingMemory: memory.map((item) => item.text)
        })
      }
    ]);
    const parsed = JSON.parse(content) as Partial<AgentIntent>;
    const parsedPlace = typeof parsed.place === "string" ? parsed.place.trim() : "";

    return {
      intent: {
        ...fallback,
        ...parsed,
        scenario:
          parsed.scenario === "outing" || parsed.scenario === "shopping"
            ? parsed.scenario
            : fallback.scenario,
        shoppingQuery:
          fallback.shoppingQuery && fallback.shoppingQuery !== "家電"
            ? fallback.shoppingQuery
            : parsed.shoppingQuery ?? fallback.shoppingQuery,
        place:
          fallback.place && prompt.includes(fallback.place)
            ? fallback.place
            : parsedPlace || fallback.place,
        priorities: Array.isArray(parsed.priorities)
          ? parsed.priorities.slice(0, 5)
          : fallback.priorities,
        decisionSummary:
          typeof parsed.decisionSummary === "string"
            ? parsed.decisionSummary.trim()
            : fallback.decisionSummary
      },
      usedOpenAI: true,
      latency: `${Math.round(performance.now() - started)}ms`
    };
  } catch {
    return {
      intent: fallback,
      usedOpenAI: false,
      latency: `${Math.round(performance.now() - started)}ms`
    };
  }
}

async function callOpenAIJson(messages: Array<{ role: "system" | "user"; content: string }>) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: openaiModel,
      messages,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API ${response.status}`);
  }

  const data = (await response.json()) as OpenAIJsonResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI API returned no content");
  }

  return content;
}

function extractShoppingQuery(prompt: string) {
  const normalizedPrompt = prompt.toLowerCase();

  if (prompt.includes("電子レンジ") || prompt.includes("微波炉") || normalizedPrompt.includes("microwave")) {
    return "電子レンジ";
  }

  if (prompt.includes("冷蔵庫") || prompt.includes("冰箱") || normalizedPrompt.includes("refrigerator")) {
    return "冷蔵庫";
  }

  if (prompt.includes("洗濯機") || prompt.includes("洗衣机") || normalizedPrompt.includes("washing machine")) {
    return "洗濯機";
  }

  return "家電";
}

function extractPriceMax(prompt: string) {
  const normalizedPrompt = prompt.replace(/,/g, "");
  const manYenMatch = normalizedPrompt.match(/(\d+)\s*万(?:円|日元)?/);

  if (manYenMatch?.[1]) {
    return Number(manYenMatch[1]) * 10000;
  }

  const yenMatch = normalizedPrompt.match(/(\d{4,6})\s*(?:円|日元|yen)/i);

  if (yenMatch?.[1]) {
    return Number(yenMatch[1]);
  }

  return undefined;
}

function extractPlace(prompt: string) {
  const normalizedPrompt = prompt.toLowerCase();
  const knownPlaces: Array<[string, string[]]> = [
    ["渋谷", ["渋谷", "涩谷", "shibuya"]],
    ["新宿", ["新宿", "shinjuku"]],
    ["池袋", ["池袋", "ikebukuro"]],
    ["東京駅", ["東京駅", "东京站", "tokyo station"]],
    ["横浜", ["横浜", "横滨", "yokohama"]],
    ["大阪", ["大阪", "osaka"]],
    ["京都", ["京都", "kyoto"]]
  ];
  return knownPlaces.find(([, aliases]) => aliases.some((place) => normalizedPrompt.includes(place.toLowerCase())))?.[0] ?? "渋谷";
}

function createYahooMapUrl(place: string) {
  return `https://map.yahoo.co.jp/search?q=${encodeURIComponent(place)}`;
}

function extractPriorities(prompt: string, memory: UserMemory[]) {
  const normalizedPrompt = prompt.toLowerCase();
  const priorities = new Set<string>();

  if (prompt.includes("レビュー") || prompt.includes("评价") || normalizedPrompt.includes("review")) {
    priorities.add("レビュー重視");
  }

  if (prompt.includes("省スペース") || prompt.includes("省空间") || normalizedPrompt.includes("compact")) {
    priorities.add("省スペース");
  }

  if (prompt.includes("雨") || prompt.includes("下雨") || normalizedPrompt.includes("rain")) {
    priorities.add("雨天時は屋内");
  }

  for (const item of memory.slice(0, 3)) {
    priorities.add(item.text);
  }

  return [...priorities].slice(0, 5);
}
