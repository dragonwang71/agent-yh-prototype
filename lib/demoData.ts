import { CloudSun, ShoppingCart } from "lucide-react";
import type { MemoryItem, ScenarioId, TaskOption } from "@/lib/types";

export const defaultMemory: MemoryItem[] = [];

export const taskOptions: TaskOption[] = [
  {
    id: "shopping",
    title: "Shopping agent",
    description: "2万円以内で電子レンジを探して",
    prompt:
      "来月から一人暮らしを始めるので、2万円以内で電子レンジを探して。レビューが良くて、省スペースなものがいい。",
    icon: ShoppingCart
  },
  {
    id: "outing",
    title: "Outing / weather agent",
    description: "週末の天気とおでかけ先を提案して",
    prompt:
      "土曜日に渋谷で友達と会う。雨なら屋内、晴れなら散歩できる場所を提案して。",
    icon: CloudSun
  }
];

export function formatClock(date = new Date()) {
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function inferScenario(prompt: string): ScenarioId {
  const normalizedPrompt = prompt.toLowerCase();
  const outingSignals = [
    "渋谷",
    "雨",
    "晴れ",
    "天気",
    "散歩",
    "おでかけ",
    "会う",
    "weather",
    "rain",
    "sunny",
    "walk",
    "meet",
    "shibuya",
    "天气",
    "下雨",
    "晴天",
    "散步",
    "见面",
    "涩谷"
  ];
  return outingSignals.some((signal) => normalizedPrompt.includes(signal)) ? "outing" : "shopping";
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
