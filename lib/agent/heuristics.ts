import type { UserMemory } from "@/lib/types";

export function extractShoppingQuery(prompt: string) {
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

export function extractPriceMax(prompt: string) {
  const normalizedPrompt = prompt.replace(/,/g, "");
  const tenThousandYenMatch = normalizedPrompt.match(/(\d+)\s*万(?:円|日元)?/);

  if (tenThousandYenMatch?.[1]) {
    return Number(tenThousandYenMatch[1]) * 10_000;
  }

  const yenMatch = normalizedPrompt.match(/(\d{4,6})\s*(?:円|日元|yen)/i);

  if (yenMatch?.[1]) {
    return Number(yenMatch[1]);
  }

  return undefined;
}

export function extractPlace(prompt: string) {
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

  return knownPlaces.find(([, aliases]) =>
    aliases.some((place) => normalizedPrompt.includes(place.toLowerCase()))
  )?.[0] ?? "渋谷";
}

export function extractPriorities(prompt: string, memory: UserMemory[]) {
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

export function chooseLocalSearchQuery(prompt: string, maxRainfall: number) {
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

  return maxRainfall > 0 ? "カフェ" : "公園";
}

export function normalizeLocalSearchQuery(query: string | undefined, maxRainfall: number) {
  const allowed = ["カフェ", "公園", "美術館", "レストラン"] as const;
  const normalized = query?.trim();

  if (maxRainfall > 0 && normalized === "公園") {
    return undefined;
  }

  return allowed.find((item) => item === normalized);
}
