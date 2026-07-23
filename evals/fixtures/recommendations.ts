import type { EvidenceRef } from "@/lib/agent/schemas";
import type { LocalPlace, ShoppingCandidate } from "@/lib/agent/tools/yahoo";

function evidence(
  id: string,
  sourceType: EvidenceRef["sourceType"],
  toolCallId: string,
  fieldPath: string,
  sourceUrl?: string
): EvidenceRef {
  return {
    id,
    sourceType,
    toolCallId,
    fieldPath,
    fetchedAt: "2026-07-23T00:00:00.000Z",
    ...(sourceUrl ? { sourceUrl } : {})
  };
}

export const shoppingFixture: ShoppingCandidate[] = [
  createShoppingCandidate({
    id: "product-trusted",
    title: "電子レンジ 17L シンプルモデル",
    priceYen: 18_800,
    rating: 4.8,
    reviewCount: 520
  }),
  createShoppingCandidate({
    id: "product-low-sample",
    title: "電子レンジ コンパクト",
    priceYen: 17_500,
    rating: 5,
    reviewCount: 1
  }),
  createShoppingCandidate({
    id: "product-over-budget",
    title: "電子レンジ プレミアムモデル",
    priceYen: 24_800,
    rating: 4.9,
    reviewCount: 900
  }),
  createShoppingCandidate({
    id: "product-trusted",
    title: "電子レンジ 17L シンプルモデル",
    priceYen: 18_800,
    rating: 4.8,
    reviewCount: 520
  })
];

export const outingFixture: LocalPlace[] = [
  createLocalPlace({
    id: "place-near",
    name: "渋谷テストカフェ",
    address: "東京都渋谷区",
    genres: ["カフェ", "喫茶店"],
    walkingMinutes: 4
  }),
  createLocalPlace({
    id: "place-far",
    name: "渋谷テスト喫茶",
    address: "東京都渋谷区",
    genres: ["カフェ"],
    walkingMinutes: 18
  })
];

export const weatherFixtureEvidence: EvidenceRef[] = [
  evidence("weather:rainfall", "yahoo_weather", "weather", "Feature[0].Property.WeatherList.Weather")
];

function createShoppingCandidate({
  id,
  priceYen,
  rating,
  reviewCount,
  title
}: {
  id: string;
  title: string;
  priceYen: number;
  rating: number;
  reviewCount: number;
}): ShoppingCandidate {
  const url = `https://shopping.yahoo.co.jp/products/${id}`;
  const titleEvidence = evidence(`${id}:title`, "yahoo_shopping", "shopping", `${id}.Name`, url);
  const priceEvidence = evidence(`${id}:price`, "yahoo_shopping", "shopping", `${id}.Price`, url);
  const scoreEvidence = evidence(`${id}:score`, "yahoo_shopping", "shopping", `${id}.Review`, url);
  const sellerEvidence = evidence(`${id}:seller`, "yahoo_shopping", "shopping", `${id}.Seller`, url);
  const actionEvidence = evidence(`${id}:url`, "yahoo_shopping", "shopping", `${id}.Url`, url);

  return {
    id,
    title,
    priceYen,
    rating,
    reviewCount,
    seller: "テストストア",
    url,
    query: "電子レンジ",
    evidence: [
      titleEvidence,
      priceEvidence,
      scoreEvidence,
      sellerEvidence,
      actionEvidence
    ],
    fieldEvidence: {
      title: [titleEvidence.id],
      price: [priceEvidence.id],
      score: [scoreEvidence.id],
      meta: [sellerEvidence.id],
      imageUrl: [],
      actionUrl: [actionEvidence.id]
    }
  };
}

function createLocalPlace({
  address,
  genres,
  id,
  name,
  walkingMinutes
}: {
  id: string;
  name: string;
  address: string;
  genres: string[];
  walkingMinutes: number;
}): LocalPlace {
  const url = `https://loco.yahoo.co.jp/place/${id}`;
  const titleEvidence = evidence(`${id}:title`, "yahoo_local_search", "local-search", `${id}.Name`, url);
  const metaEvidence = evidence(`${id}:meta`, "yahoo_local_search", "local-search", `${id}.Property`, url);
  const stationEvidence = evidence(
    `${id}:station`,
    "yahoo_local_search",
    "local-search",
    `${id}.Station`,
    url
  );
  const actionEvidence = evidence(`${id}:url`, "yahoo_local_search", "local-search", `${id}.Url`, url);

  return {
    id,
    name,
    address,
    genres,
    station: {
      name: "渋谷駅",
      walkingMinutes
    },
    url,
    evidence: [titleEvidence, metaEvidence, stationEvidence, actionEvidence],
    fieldEvidence: {
      title: [titleEvidence.id],
      meta: [metaEvidence.id],
      imageUrl: [],
      score: [stationEvidence.id],
      actionUrl: [actionEvidence.id]
    }
  };
}
