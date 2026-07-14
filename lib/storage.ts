"use client";

import { defaultMemory } from "@/lib/demoData";
import type { UiLanguage } from "@/lib/i18n";
import type { Conversation } from "@/lib/types";

const conversationsKey = "agent-yh-conversations";
const memoryKey = "agent-yh-memory";
const languageKey = "agent-yh-language";
const languageDefaultVersionKey = "agent-yh-language-default-version";
const currentLanguageDefaultVersion = "ja-default-2026-06";
const maxStoredConversations = 20;
const legacyConversationMarkers = [
  "代々木公園",
  "スクランブルスクエア",
  "天候不明",
  "晴天:",
  "雨天:",
  "駅直結の屋内集合プラン",
  "雨天・晴天の分岐プラン",
  "openai_plan_explainer",
  "external_place_search",
  "Yahoo Geocoderで",
  "Yahoo Weather API",
  "Yahoo Local Search",
  "APIが返していない",
  "APIが返した",
  "coordinates=",
  "降水データ:",
  "最大降水強度",
  "実在する周辺地点",
  "API 返回",
  "真实附近地点",
  "真实数据",
  "实时天气和地图数据",
  "real nearby places",
  "Live weather and map data",
  "Formatted only the API-returned",
  "購入や保存は確認後",
  "Purchasing or saving only happens after your confirmation",
  "购买或保存只会在你确认后执行",
  "Yahoo!ショッピング /",
  "Yahoo Shopping /",
  "source=Yahoo",
  "live API / 承認待ち",
  "live API / approval pending",
  "live API / 等待确认",
  "openai_recommendation_explainer",
  "external_product_page"
];

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Conversation>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.messages) &&
    typeof candidate.runs === "object" &&
    typeof candidate.activeRunId === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isLegacyConversation(conversation: Conversation) {
  return Object.values(conversation.runs).some((run) => {
    const searchableText = [
      run.summary,
      ...run.plan.map((step) => step.label),
      ...run.tools.flatMap((tool) => [tool.tool, tool.input]),
      ...run.recommendations.flatMap((item) => [item.title, item.meta, item.score, item.reason])
    ].join("\n");

    return legacyConversationMarkers.some((marker) => searchableText.includes(marker));
  });
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(conversationsKey);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    const conversations = Array.isArray(parsed) ? parsed.filter(isConversation) : [];
    const liveConversations = conversations.filter(
      (conversation) => !isLegacyConversation(conversation)
    );

    if (liveConversations.length !== conversations.length) {
      window.localStorage.setItem(conversationsKey, JSON.stringify(liveConversations));
    }

    return liveConversations.slice(0, maxStoredConversations);
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]) {
  window.localStorage.setItem(
    conversationsKey,
    JSON.stringify(conversations.slice(0, maxStoredConversations))
  );
}

export function loadMemory() {
  if (typeof window === "undefined") {
    return defaultMemory;
  }

  try {
    const stored = window.localStorage.getItem(memoryKey);
    return stored?.trim() ? stored : defaultMemory;
  } catch {
    return defaultMemory;
  }
}

export function saveMemory(memory: string) {
  window.localStorage.setItem(memoryKey, memory);
}

export function loadLanguage(): UiLanguage {
  if (typeof window === "undefined") {
    return "ja";
  }

  const stored = window.localStorage.getItem(languageKey);
  const defaultVersion = window.localStorage.getItem(languageDefaultVersionKey);

  if (!defaultVersion && stored === "en") {
    window.localStorage.setItem(languageKey, "ja");
    window.localStorage.setItem(languageDefaultVersionKey, currentLanguageDefaultVersion);
    return "ja";
  }

  if (stored === "ja" || stored === "en" || stored === "zh") {
    window.localStorage.setItem(languageDefaultVersionKey, currentLanguageDefaultVersion);
    return stored;
  }

  window.localStorage.setItem(languageDefaultVersionKey, currentLanguageDefaultVersion);
  return "ja";
}

export function saveLanguage(language: UiLanguage) {
  window.localStorage.setItem(languageKey, language);
  window.localStorage.setItem(languageDefaultVersionKey, currentLanguageDefaultVersion);
}
