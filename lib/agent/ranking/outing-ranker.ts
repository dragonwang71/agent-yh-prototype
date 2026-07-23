import { agentCopy } from "@/lib/agent/copy";
import type {
  EvidenceRef,
  Recommendation,
  ScoreContribution
} from "@/lib/agent/schemas";
import type { LocalPlace } from "@/lib/agent/tools/yahoo";
import type { UiLanguage } from "@/lib/i18n";

const actionHostAllowlist = ["map.yahoo.co.jp", "loco.yahoo.co.jp"];

export function rankOutingCandidates({
  language,
  places,
  query,
  weatherEvidence = [],
  weatherCovered
}: {
  language: UiLanguage;
  places: LocalPlace[];
  query: string;
  weatherEvidence?: EvidenceRef[];
  weatherCovered: boolean;
}): Recommendation[] {
  const copy = agentCopy[language];

  return places
    .map((place) => {
      const breakdown = scorePlace(place, query, copy);
      const score = Math.round(
        breakdown.reduce((sum, contribution) => sum + contribution.score * contribution.weight, 0) *
          100
      );
      const stationText = formatStation(place, language);
      const meta = [place.address, place.genres.slice(0, 2).join(" / ")]
        .filter(Boolean)
        .join(" / ") || copy.noAddress;
      const constraints = [
        {
          name: copy.activityConstraint,
          status: matchesQuery(place, query) ? ("matched" as const) : ("unverified" as const),
          explanation: matchesQuery(place, query)
            ? localized(
                language,
                `取得元のカテゴリが「${formatQuery(query, language)}」に一致します。`,
                `The returned category matches ${formatQuery(query, language)}.`,
                `来源返回的类别与“${formatQuery(query, language)}”一致。`
              )
            : localized(
                language,
                "カテゴリ一致を確認できません。",
                "A category match could not be verified.",
                "无法确认设施类别是否匹配。"
              ),
          evidenceIds: place.fieldEvidence.meta
        },
        {
          name: copy.weatherConstraint,
          status: weatherCovered ? ("matched" as const) : ("unverified" as const),
          explanation: weatherCovered ? copy.heuristicIndoor : copy.unverifiedWeather,
          evidenceIds: weatherCovered ? weatherEvidence.map((evidence) => evidence.id) : []
        }
      ];
      const limitations = [
        copy.unknownOpeningHours,
        ...(!weatherCovered ? [copy.unverifiedWeather] : []),
        ...(isRainFriendlyQuery(query) ? [copy.heuristicIndoor] : [])
      ];

      return {
        id: place.id,
        rank: 0,
        title: place.name,
        meta,
        ...(place.imageUrl ? { imageUrl: place.imageUrl } : {}),
        score,
        scoreLabel: stationText || copy.noStation,
        reason: outingReason(place, query, language),
        constraints,
        scoreBreakdown: breakdown,
        confidence:
          place.fieldEvidence.title.length &&
          place.fieldEvidence.meta.length &&
          place.fieldEvidence.actionUrl.length
            ? "high"
            : "medium",
        limitations,
        action: {
          label: copy.placeAction,
          ...(place.url && isAllowedActionUrl(place.url) ? { url: place.url } : {})
        },
        evidence: [...place.evidence, ...(weatherCovered ? weatherEvidence : [])],
        fieldEvidence: {
          title: place.fieldEvidence.title,
          meta: place.fieldEvidence.meta,
          imageUrl: place.fieldEvidence.imageUrl,
          price: [],
          score: place.fieldEvidence.score,
          actionUrl: place.fieldEvidence.actionUrl
        }
      } satisfies Recommendation;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}

export function selectLocalQuery({
  activityPreference,
  indoorPreference,
  maxRainfall,
  weatherCovered
}: {
  activityPreference: string | null;
  indoorPreference: boolean | null;
  maxRainfall: number;
  weatherCovered: boolean;
}) {
  if (activityPreference === "museum") {
    return "美術館";
  }

  if (activityPreference === "cafe") {
    return "カフェ";
  }

  if (activityPreference === "restaurant") {
    return "レストラン";
  }

  if (activityPreference === "walk" && (!weatherCovered || maxRainfall === 0)) {
    return "公園";
  }

  if (indoorPreference === true || (weatherCovered && maxRainfall > 0)) {
    return "カフェ";
  }

  return "公園";
}

function scorePlace(
  place: LocalPlace,
  query: string,
  copy: (typeof agentCopy)[UiLanguage]
): ScoreContribution[] {
  const walkingMinutes = place.station?.walkingMinutes;
  const distanceMeters = place.station?.distanceMeters;
  const accessScore =
    walkingMinutes !== undefined
      ? Math.max(0, 1 - walkingMinutes / 30)
      : distanceMeters !== undefined
        ? Math.max(0, 1 - distanceMeters / 2_000)
        : 0.35;
  const queryScore = matchesQuery(place, query) ? 1 : 0.45;
  const completeness =
    [
      place.name,
      place.address,
      place.genres.length ? place.genres : undefined,
      place.station,
      place.url,
      place.imageUrl
    ].filter(Boolean).length / 6;
  const weatherHeuristic = isRainFriendlyQuery(query) ? 0.8 : 0.65;

  return [
    {
      factor: copy.distanceFactor,
      score: accessScore,
      weight: 0.38,
      explanation:
        walkingMinutes !== undefined
          ? `${walkingMinutes} walking minutes`
          : distanceMeters !== undefined
            ? `${distanceMeters} meters`
            : "station data not returned"
    },
    {
      factor: copy.activityFactor,
      score: queryScore,
      weight: 0.32,
      explanation: matchesQuery(place, query) ? "returned category match" : "search-result match"
    },
    {
      factor: copy.weatherFactor,
      score: weatherHeuristic,
      weight: 0.15,
      explanation: "category-level heuristic"
    },
    {
      factor: copy.completenessFactor,
      score: completeness,
      weight: 0.15,
      explanation: `${Math.round(completeness * 6)} / 6 fields returned`
    }
  ];
}

function outingReason(place: LocalPlace, query: string, language: UiLanguage) {
  const facts = [
    formatStation(place, language),
    place.genres.length
      ? localized(
          language,
          `カテゴリ: ${place.genres.slice(0, 2).join(" / ")}`,
          `Categories: ${place.genres.slice(0, 2).join(" / ")}`,
          `类别：${place.genres.slice(0, 2).join(" / ")}`
        )
      : "",
    localized(
      language,
      `検索条件: ${formatQuery(query, language)}`,
      `Search: ${formatQuery(query, language)}`,
      `搜索条件：${formatQuery(query, language)}`
    )
  ].filter(Boolean);

  return facts.join(" · ");
}

function formatStation(place: LocalPlace, language: UiLanguage) {
  const station = place.station;

  if (!station) {
    return "";
  }

  const parts = [
    station.name,
    station.walkingMinutes !== undefined
      ? localized(
          language,
          `徒歩${station.walkingMinutes}分`,
          `${station.walkingMinutes} min walk`,
          `步行 ${station.walkingMinutes} 分钟`
        )
      : "",
    station.distanceMeters !== undefined ? `${station.distanceMeters}m` : ""
  ].filter(Boolean);

  return parts.join(" / ");
}

function matchesQuery(place: LocalPlace, query: string) {
  const haystack = `${place.name} ${place.genres.join(" ")}`.toLowerCase();
  const aliases: Record<string, string[]> = {
    カフェ: ["カフェ", "喫茶", "coffee", "cafe"],
    公園: ["公園", "park"],
    美術館: ["美術館", "博物館", "museum", "gallery"],
    レストラン: ["レストラン", "飲食", "restaurant"]
  };

  return (aliases[query] ?? [query]).some((value) => haystack.includes(value.toLowerCase()));
}

function isRainFriendlyQuery(query: string) {
  return query === "カフェ" || query === "美術館" || query === "レストラン";
}

function isAllowedActionUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      actionHostAllowlist.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
      )
    );
  } catch {
    return false;
  }
}

function formatQuery(query: string, language: UiLanguage) {
  const labels: Record<string, Record<UiLanguage, string>> = {
    カフェ: { ja: "カフェ", en: "cafe", zh: "咖啡馆" },
    公園: { ja: "公園", en: "park", zh: "公园" },
    美術館: { ja: "美術館", en: "museum", zh: "美术馆" },
    レストラン: { ja: "レストラン", en: "restaurant", zh: "餐厅" }
  };

  return labels[query]?.[language] ?? query;
}

function localized(language: UiLanguage, ja: string, en: string, zh: string) {
  return language === "en" ? en : language === "zh" ? zh : ja;
}
