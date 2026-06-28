import { CloudSun, ShoppingCart } from "lucide-react";
import type { AgentRun, ScenarioId, TaskOption } from "@/lib/types";

export const defaultMemory = `# ユーザーメモ

回答はアプリで選択された言語に合わせる。

## 基本情報
- 東京在住の会社員。
- 平日は電車と徒歩で都心へ移動することが多い。
- 休日は遠出よりも、近場で短時間に行ける場所を探すことが多い。

## 生活文脈
- 朝は天気、電車の遅延、今日見るべきニュースをまとめて知りたい。
- 人混みが強すぎる場所より、落ち着いて歩ける街、神社、カフェ、公園、商店街が好き。
- 外出先では、最寄り駅からの歩きやすさ、混雑しにくい時間、普通の生活予算で使いやすいかを重視する。

## 回答の好み
- まず結論を短く、その後に理由と具体的な行動を示す。
- 高級店や観光客向けだけでなく、日常生活で使いやすい選択肢を優先する。
- Shopping では予算、サイズ、レビュー、日常利用しやすさを重視する。
- Weather / outing では雨天時の屋内導線、駅近、移動しやすさを重視する。`;

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

export function approveRun(run: AgentRun): AgentRun {
  return {
    ...run,
    statusLabel: "承認済み",
    approvals: run.approvals.map((approval) => ({
      ...approval,
      status: approval.status === "pending" ? "approved" : approval.status,
      time: formatClock()
    }))
  };
}

export function declineRun(run: AgentRun): AgentRun {
  return {
    ...run,
    statusLabel: "保存しない",
    approvals: run.approvals.map((approval) => ({
      ...approval,
      status: approval.status === "pending" ? "declined" : approval.status,
      time: formatClock()
    }))
  };
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
