import { agentCopy } from "@/lib/agent/copy";
import { validateGroundedRecommendations } from "@/lib/agent/evidence/validate-grounding";
import { inferScenarioHint } from "@/lib/agent/heuristics";
import { proposeMemory } from "@/lib/agent/memory/propose";
import { parseIntent } from "@/lib/agent/model/intent-parser";
import { rankOutingCandidates, selectLocalQuery } from "@/lib/agent/ranking/outing-ranker";
import { rankShoppingCandidates } from "@/lib/agent/ranking/shopping-ranker";
import type {
  AgentEvent,
  AgentIntent,
  AgentRequest,
  AgentRun,
  AgentStatus,
  PlanStep,
  Recommendation,
  ScenarioId,
  ToolCall,
  ToolErrorCode
} from "@/lib/agent/schemas";
import { TraceCollector } from "@/lib/agent/telemetry/trace";
import {
  geocodePlace,
  getWeather,
  searchLocalPlaces,
  searchShopping,
  toolCallFromResult,
  type WeatherSnapshot
} from "@/lib/agent/tools/yahoo";
import type { UiLanguage } from "@/lib/i18n";

export type AgentEventSink = (event: AgentEvent) => void;

const runBudget = {
  maxModelCalls: 2,
  maxToolCalls: 5,
  maxRetriesPerTool: 1,
  deadlineMs: 12_000
} as const;

export async function runAgent({
  emit,
  request,
  signal
}: {
  emit: AgentEventSink;
  request: AgentRequest;
  signal: AbortSignal;
}) {
  const traceId = `trace-${request.runId}`;
  const copy = agentCopy[request.language];
  const initialScenario =
    request.scenario ?? inferScenarioHint(request.prompt) ?? ("shopping" as const);
  const deadlineSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(runBudget.deadlineMs)
  ]);
  const trace = new TraceCollector({
    traceId,
    runId: request.runId,
    startedAt: request.startedAt
  });
  let seq = 0;
  const send = <T extends AgentEvent>(event: Omit<T, "seq" | "traceId" | "runId">) => {
    emit({
      ...event,
      seq: seq++,
      traceId,
      runId: request.runId
    } as T);
  };
  let scenario: ScenarioId = initialScenario;
  let tools: ToolCall[] = [];
  let plan: PlanStep[] = [
    step("intent", copy.reading, "running", request.startedAt, null)
  ];
  const initialRun = createInitialRun({
    request,
    scenario,
    traceId,
    trace: trace.snapshot()
  });

  send<Extract<AgentEvent, { type: "run.started" }>>({
    type: "run.started",
    payload: initialRun
  });

  try {
    const intentStarted = performance.now();
    const intentResult = await parseIntent({
      language: request.language,
      memory: request.memory,
      prompt: request.prompt,
      scenarioHint: request.scenario,
      signal: deadlineSignal
    });
    const intentDuration = Math.round(performance.now() - intentStarted);
    const intent = intentResult.intent;

    if (intentResult.usage) {
      trace.addModelUsage(intentResult.usage);
    }

    if (intentResult.fallbackReason) {
      trace.setFallback(intentResult.fallbackReason);
    }

    trace.addSpan({
      name: "intent.parse",
      detail: intentResult.usedModel ? copy.modelParser : copy.ruleParser,
      durationMs: intentDuration
    });
    tools = [
      {
        id: "intent-parser",
        tool: intentResult.usedModel ? "openai_responses_intent_parser" : "deterministic_intent_parser",
        input: `approved_memory=${request.memory.filter((item) => item.status === "approved").length}`,
        status: "success",
        latencyMs: intentDuration,
        retryCount: 0,
        cacheStatus: "disabled",
        evidenceCount: 0
      }
    ];
    scenario = scenarioFromIntent(intent, initialScenario);
    plan = [
      step(
        "intent",
        formatIntentStep(intent, intentResult.usedModel, request.language),
        "done",
        request.startedAt,
        intentDuration
      )
    ];
    trace.setState("planned");

    send<Extract<AgentEvent, { type: "intent.resolved" }>>({
      type: "intent.resolved",
      payload: {
        scenario,
        title: scenario === "shopping" ? copy.shoppingTitle : copy.outingTitle,
        plan,
        tools,
        trace: trace.snapshot()
      }
    });

    if (intent.kind === "needs_clarification" || intent.kind === "unsupported") {
      const clarification =
        intent.kind === "needs_clarification"
          ? {
              missingField: intent.missingField,
              question: intent.question,
              reasonCode: intent.reasonCode
            }
          : {
              missingField: "scope",
              question: intent.userMessage,
              reasonCode: intent.reasonCode
            };
      trace.setState("needs_clarification");
      plan = [
        ...plan,
        step(
          "clarification",
          clarification.question,
          "waiting",
          request.startedAt,
          null
        )
      ];
      send<Extract<AgentEvent, { type: "clarification.required" }>>({
        type: "clarification.required",
        payload: {
          clarification,
          summary: clarification.question,
          statusLabel:
            intent.kind === "unsupported" ? copy.unsupported : copy.needsClarification,
          plan,
          tools,
          trace: trace.snapshot()
        }
      });
      return;
    }

    trace.setState("retrieving");
    plan = [
      ...plan,
      step(
        "retrieval",
        intent.kind === "shopping" ? copy.retrievingShopping : copy.retrievingOuting,
        "running",
        request.startedAt,
        null
      )
    ];
    send<Extract<AgentEvent, { type: "retrieval.started" }>>({
      type: "retrieval.started",
      payload: {
        summary: intent.kind === "shopping" ? copy.retrievingShopping : copy.retrievingOuting,
        statusLabel: "running",
        plan
      }
    });

    const yahooClientId = process.env.YAHOO_CLIENT_ID;

    if (!yahooClientId) {
      await failRun({
        code: "AUTH_ERROR",
        copy,
        emit: send,
        plan,
        request,
        tools,
        trace
      });
      return;
    }

    if (intent.kind === "shopping") {
      await runShopping({
        clientId: yahooClientId,
        copy,
        emit: send,
        intent,
        language: request.language,
        plan,
        request,
        signal: deadlineSignal,
        tools,
        trace
      });
      return;
    }

    await runOuting({
      clientId: yahooClientId,
      copy,
      emit: send,
      intent,
      language: request.language,
      plan,
      request,
      signal: deadlineSignal,
      tools,
      trace
    });
  } catch (error) {
    const aborted = signal.aborted;
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    const code: ToolErrorCode = aborted ? "ABORTED" : timedOut ? "TIMEOUT" : "UNKNOWN";
    await failRun({
      code,
      copy,
      emit: send,
      plan,
      request,
      tools,
      trace
    });
  }
}

async function runShopping({
  clientId,
  copy,
  emit,
  intent,
  language,
  plan,
  request,
  signal,
  tools,
  trace
}: RunContext<Extract<AgentIntent, { kind: "shopping" }>>) {
  const query = intent.query;

  if (!query) {
    throw new Error("Shopping intent has no query");
  }

  const queryVariants = buildShoppingQueries(query, intent.priorities).slice(
    0,
    Math.min(2, runBudget.maxToolCalls - tools.length)
  );
  const results = await Promise.all(
    queryVariants.map((variant, index) =>
      searchShopping({
        clientId,
        priceMax: intent.budgetMaxYen,
        query: variant,
        signal,
        toolCallId: `shopping-search-${index + 1}`
      })
    )
  );
  const searchTools = results.map((result, index) =>
    toolCallFromResult({
      result,
      tool: "yahoo_shopping_itemSearch",
      input: `query=${queryVariants[index]}${
        intent.budgetMaxYen ? `, price_to=${intent.budgetMaxYen}` : ""
      }`
    })
  );
  tools = [...tools, ...searchTools];
  const candidates = results.flatMap((result) => (result.ok ? result.data : []));
  const failed = results.filter((result) => !result.ok);

  for (const tool of searchTools) {
    trace.addSpan({
      name: "tool.yahoo.shopping",
      detail: `${tool.input}; evidence=${tool.evidenceCount}`,
      durationMs: tool.latencyMs ?? 0,
      status: tool.status === "success" ? "ok" : "error",
      ...(tool.errorCode ? { errorCode: tool.errorCode } : {})
    });
  }

  if (!candidates.length) {
    await failRun({
      code: failed[0] && !failed[0].ok ? failed[0].error.code : "NO_RESULTS",
      copy,
      emit,
      plan,
      request,
      tools,
      trace
    });
    return;
  }

  const rankingStarted = performance.now();
  const ranked = rankShoppingCandidates({
    budgetMaxYen: intent.budgetMaxYen,
    candidates,
    language,
    priorities: intent.priorities,
    query
  });
  const validation = validateGroundedRecommendations(ranked);
  const rankingDuration = Math.round(performance.now() - rankingStarted);
  trace.addSpan({
    name: "ranking.shopping",
    detail: `${candidates.length} candidates -> ${validation.valid.length} recommendations`,
    durationMs: rankingDuration
  });
  trace.addSpan({
    name: "grounding.validate",
    detail: `${validation.rejected.length} rejected`,
    durationMs: 0,
    status: validation.rejected.length ? "error" : "ok"
  });
  tools = [
    ...tools,
    formatterTool(validation.valid.length, validation.rejected.length, rankingDuration)
  ];
  const state: "completed" | "degraded" =
    failed.length || validation.rejected.length || validation.valid.length === 0
      ? "degraded"
      : "completed";
  const summary = shoppingSummary({
    count: validation.valid.length,
    language,
    query,
    state
  });
  const memory = proposeMemory({
    intent,
    language,
    prompt: request.prompt,
    runId: request.runId
  });

  await completeRun({
    copy,
    emit,
    memory,
    plan: finalizePlan(plan, rankingDuration, language),
    recommendations: validation.valid,
    request,
    state,
    summary,
    tools,
    trace
  });
}

async function runOuting({
  clientId,
  copy,
  emit,
  intent,
  language,
  plan,
  request,
  signal,
  tools,
  trace
}: RunContext<Extract<AgentIntent, { kind: "outing" }>>) {
  const place = intent.place;

  if (!place) {
    throw new Error("Outing intent has no place");
  }

  const geocode = await geocodePlace({
    clientId,
    place,
    signal,
    toolCallId: "geocoder"
  });
  const geocodeTool = toolCallFromResult({
    result: geocode,
    tool: "yahoo_yolp_geocoder",
    input: `query=${place}`
  });
  tools = [...tools, geocodeTool];
  traceTool(trace, "tool.yahoo.geocoder", geocodeTool);

  if (!geocode.ok) {
    await failRun({
      code: geocode.error.code,
      copy,
      emit,
      plan,
      request,
      tools,
      trace
    });
    return;
  }

  const weather = await getWeather({
    clientId,
    coordinates: geocode.data.coordinates,
    signal,
    toolCallId: "weather"
  });
  const weatherTool = toolCallFromResult({
    result: weather,
    tool: "yahoo_yolp_weather",
    input: `coordinates=${geocode.data.coordinates}`
  });
  tools = [...tools, weatherTool];
  traceTool(trace, "tool.yahoo.weather", weatherTool);
  const weatherCovered =
    weather.ok && isWeatherCovered(weather.data, intent.requestedAt);
  const maxRainfall = weather.ok ? weather.data.maxRainfall : 0;
  const localQuery = selectLocalQuery({
    activityPreference: intent.activityPreference,
    indoorPreference: intent.indoorPreference,
    maxRainfall,
    weatherCovered
  });
  const local = await searchLocalPlaces({
    clientId,
    lat: geocode.data.lat,
    lon: geocode.data.lon,
    query: localQuery,
    signal,
    toolCallId: "local-search"
  });
  const localTool = toolCallFromResult({
    result: local,
    tool: "yahoo_yolp_local_search",
    input: `query=${localQuery}, dist=2km`
  });
  tools = [...tools, localTool];
  traceTool(trace, "tool.yahoo.local_search", localTool);
  const rankingStarted = performance.now();
  const ranked = local.ok
    ? rankOutingCandidates({
        language,
        places: local.data,
        query: localQuery,
        weatherEvidence: weather.ok ? weather.evidence : [],
        weatherCovered
      })
    : [];
  const validation = validateGroundedRecommendations(ranked);
  const rankingDuration = Math.round(performance.now() - rankingStarted);
  trace.addSpan({
    name: "ranking.outing",
    detail: `${local.ok ? local.data.length : 0} candidates -> ${validation.valid.length} recommendations`,
    durationMs: rankingDuration
  });
  trace.addSpan({
    name: "grounding.validate",
    detail: `${validation.rejected.length} rejected`,
    durationMs: 0,
    status: validation.rejected.length ? "error" : "ok"
  });
  tools = [
    ...tools,
    formatterTool(validation.valid.length, validation.rejected.length, rankingDuration)
  ];
  const state: "completed" | "degraded" =
    !weather.ok ||
    !weatherCovered ||
    !local.ok ||
    validation.rejected.length > 0 ||
    validation.valid.length === 0
      ? "degraded"
      : "completed";
  const summary = outingSummary({
    count: validation.valid.length,
    language,
    maxRainfall,
    place: geocode.data.name,
    requestedAt: intent.requestedAt,
    state,
    weatherCovered,
    weatherOk: weather.ok
  });
  const memory = proposeMemory({
    intent,
    language,
    prompt: request.prompt,
    runId: request.runId
  });

  await completeRun({
    copy,
    emit,
    memory,
    plan: finalizePlan(plan, rankingDuration, language),
    recommendations: validation.valid,
    request,
    state,
    summary,
    tools,
    trace
  });
}

type RunContext<TIntent extends AgentIntent> = {
  clientId: string;
  copy: (typeof agentCopy)[UiLanguage];
  emit: <T extends AgentEvent>(event: Omit<T, "seq" | "traceId" | "runId">) => void;
  intent: TIntent;
  language: UiLanguage;
  plan: PlanStep[];
  request: AgentRequest;
  signal: AbortSignal;
  tools: ToolCall[];
  trace: TraceCollector;
};

async function completeRun({
  copy,
  emit,
  memory,
  plan,
  recommendations,
  request,
  state,
  summary,
  tools,
  trace
}: {
  copy: (typeof agentCopy)[UiLanguage];
  emit: RunContext<AgentIntent>["emit"];
  memory: ReturnType<typeof proposeMemory>;
  plan: PlanStep[];
  recommendations: Recommendation[];
  request: AgentRequest;
  state: "completed" | "degraded";
  summary: string;
  tools: ToolCall[];
  trace: TraceCollector;
}) {
  trace.complete(state);
  emit<Extract<AgentEvent, { type: "recommendations.ready" }>>({
    type: "recommendations.ready",
    payload: {
      summary,
      recommendations,
      tools,
      plan,
      memoryProposals: memory.proposals,
      trace: trace.snapshot(),
      state
    }
  });
  emit<Extract<AgentEvent, { type: "run.completed" }>>({
    type: "run.completed",
    payload: {
      summary,
      statusLabel: state === "completed" ? copy.ready : copy.degraded,
      state,
      trace: trace.snapshot()
    }
  });
}

async function failRun({
  code,
  copy,
  emit,
  plan,
  request,
  tools,
  trace
}: {
  code: ToolErrorCode;
  copy: (typeof agentCopy)[UiLanguage];
  emit: RunContext<AgentIntent>["emit"];
  plan: PlanStep[];
  request: AgentRequest;
  tools: ToolCall[];
  trace: TraceCollector;
}) {
  const state = code === "ABORTED" ? "aborted" : "failed";
  trace.setError(code);
  trace.complete(state);
  const summary = failureSummary(code, request.language);
  emit<Extract<AgentEvent, { type: "run.failed" }>>({
    type: "run.failed",
    payload: {
      summary,
      statusLabel: state === "aborted" ? copy.aborted : copy.failed,
      state,
      tools,
      trace: trace.snapshot()
    }
  });
}

function createInitialRun({
  request,
  scenario,
  trace,
  traceId
}: {
  request: AgentRequest;
  scenario: ScenarioId;
  trace: AgentRun["trace"];
  traceId: string;
}): AgentRun {
  const copy = agentCopy[request.language];

  return {
    id: request.runId,
    traceId,
    scenario,
    state: "received",
    title: scenario === "shopping" ? copy.shoppingTitle : copy.outingTitle,
    summary: copy.reading,
    userPrompt: request.prompt,
    statusLabel: "running",
    startedAt: request.startedAt,
    plan: [step("intent", copy.reading, "running", request.startedAt, null)],
    tools: [],
    recommendations: [],
    approvals: [],
    memoryProposals: [],
    trace
  };
}

function scenarioFromIntent(intent: AgentIntent, fallback: ScenarioId): ScenarioId {
  if (intent.kind === "shopping" || intent.kind === "outing") {
    return intent.kind;
  }

  return intent.scenarioHint ?? fallback;
}

function step(
  id: string,
  label: string,
  status: PlanStep["status"],
  time: string,
  latencyMs: number | null
): PlanStep {
  return { id, label, status, time, latencyMs };
}

function formatIntentStep(intent: AgentIntent, usedModel: boolean, language: UiLanguage) {
  const source = usedModel ? agentCopy[language].modelParser : agentCopy[language].ruleParser;

  if (intent.kind === "shopping") {
    return `${source}: shopping / query="${intent.query ?? ""}"${
      intent.budgetMaxYen ? ` / budget=${intent.budgetMaxYen}` : ""
    }`;
  }

  if (intent.kind === "outing") {
    return `${source}: outing / place="${intent.place ?? ""}"${
      intent.requestedAt ? ` / time="${intent.requestedAt}"` : ""
    }`;
  }

  return `${source}: ${intent.kind} / ${intent.reasonCode}`;
}

function buildShoppingQueries(query: string, priorities: string[]) {
  const variants = [query];

  if (priorities.some((priority) => /省スペース|省空间|compact/i.test(priority))) {
    variants.push(`${query} 省スペース`);
  } else if (priorities.some((priority) => /レビュー|评价|review/i.test(priority))) {
    variants.push(`${query} 高評価`);
  }

  return [...new Set(variants)];
}

function formatterTool(valid: number, rejected: number, latencyMs: number): ToolCall {
  return {
    id: "grounding-validator",
    tool: "deterministic_grounding_validator",
    input: `valid=${valid}, rejected=${rejected}`,
    status: rejected ? "error" : "success",
    latencyMs,
    retryCount: 0,
    cacheStatus: "disabled",
    evidenceCount: valid
  };
}

function finalizePlan(plan: PlanStep[], latencyMs: number, language: UiLanguage) {
  return [
    ...plan.map((item) =>
      item.id === "retrieval" ? { ...item, status: "done" as const } : item
    ),
    step("ranking", agentCopy[language].formatter, "done", plan[0]?.time ?? "", latencyMs)
  ];
}

function traceTool(trace: TraceCollector, name: string, tool: ToolCall) {
  trace.addSpan({
    name,
    detail: `${tool.input}; evidence=${tool.evidenceCount}`,
    durationMs: tool.latencyMs ?? 0,
    status: tool.status === "success" ? "ok" : "error",
    ...(tool.errorCode ? { errorCode: tool.errorCode } : {})
  });
}

function isWeatherCovered(weather: WeatherSnapshot, requestedAt: string | null) {
  if (!requestedAt) {
    return true;
  }

  const requestedTime = Date.parse(requestedAt);

  if (!Number.isFinite(requestedTime)) {
    return false;
  }

  const pointTimes = weather.points
    .map((point) => parseYahooWeatherDate(point.date))
    .filter((value): value is number => value !== null);

  if (!pointTimes.length) {
    return false;
  }

  return requestedTime >= Math.min(...pointTimes) && requestedTime <= Math.max(...pointTimes);
}

function parseYahooWeatherDate(value?: string) {
  const match = value?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  return Date.parse(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);
}

function shoppingSummary({
  count,
  language,
  query,
  state
}: {
  count: number;
  language: UiLanguage;
  query: string;
  state: "completed" | "degraded";
}) {
  if (language === "en") {
    return count
      ? `${count} evidence-backed options for “${query}” are ready. ${
          state === "degraded" ? "Some source fields remain unavailable." : ""
        }`.trim()
      : `No option for “${query}” passed the budget and evidence checks.`;
  }

  if (language === "zh") {
    return count
      ? `已整理 ${count} 个有来源证据的“${query}”候选。${
          state === "degraded" ? "部分来源字段仍无法确认。" : ""
        }`
      : `没有“${query}”候选同时通过预算与证据校验。`;
  }

  return count
    ? `「${query}」の候補を、根拠付きで${count}件に絞りました。${
        state === "degraded" ? "一部の取得項目は未確認です。" : ""
      }`
    : `「${query}」で、予算と根拠確認を通過した候補はありませんでした。`;
}

function outingSummary({
  count,
  language,
  maxRainfall,
  place,
  requestedAt,
  state,
  weatherCovered,
  weatherOk
}: {
  count: number;
  language: UiLanguage;
  maxRainfall: number;
  place: string;
  requestedAt: string | null;
  state: "completed" | "degraded";
  weatherCovered: boolean;
  weatherOk: boolean;
}) {
  if (language === "en") {
    if (!weatherOk) {
      return `${count} nearby options for ${place} are available, but weather could not be verified.`;
    }

    if (!weatherCovered) {
      return `${count} nearby options for ${place} are available. The returned forecast does not cover ${
        requestedAt ?? "the requested time"
      }.`;
    }

    return `${place}: maximum returned rainfall is ${maxRainfall} mm/h. ${count} nearby options are ready.${
      state === "degraded" ? " Some place details remain unavailable." : ""
    }`;
  }

  if (language === "zh") {
    if (!weatherOk) {
      return `已找到 ${count} 个 ${place} 附近的候选，但无法确认天气。`;
    }

    if (!weatherCovered) {
      return `已找到 ${count} 个 ${place} 附近的候选。返回的天气范围不包含${
        requestedAt ?? "指定时间"
      }。`;
    }

    return `${place} 返回时段内最大降水为 ${maxRainfall} mm/h。已整理 ${count} 个附近候选。`;
  }

  if (!weatherOk) {
    return `${place}周辺の候補を${count}件確認しましたが、天気は取得できませんでした。`;
  }

  if (!weatherCovered) {
    return `${place}周辺の候補を${count}件確認しました。返却された天気の時間範囲は「${
      requestedAt ?? "指定日時"
    }」を含みません。`;
  }

  return `${place}の返却時間帯では最大降水${maxRainfall} mm/hです。周辺候補を${count}件に絞りました。`;
}

function failureSummary(code: ToolErrorCode, language: UiLanguage) {
  if (language === "en") {
    return code === "ABORTED"
      ? "The run was canceled before completion."
      : "The source data could not be verified. No recommendation was generated.";
  }

  if (language === "zh") {
    return code === "ABORTED"
      ? "运行在完成前被取消。"
      : "无法验证来源数据，因此没有生成推荐。";
  }

  return code === "ABORTED"
    ? "完了前に実行を中止しました。"
    : "取得元データを確認できなかったため、推測の候補は生成していません。";
}
