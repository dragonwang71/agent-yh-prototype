import { agentCopy } from "@/lib/agent/copy";
import type { Recommendation, ScoreContribution } from "@/lib/agent/schemas";
import type { ShoppingCandidate } from "@/lib/agent/tools/yahoo";
import type { UiLanguage } from "@/lib/i18n";

const actionHostAllowlist = [
  "shopping.yahoo.co.jp",
  "store.shopping.yahoo.co.jp",
  "paypaymall.yahoo.co.jp"
];

export function rankShoppingCandidates({
  budgetMaxYen,
  candidates,
  language,
  priorities,
  query
}: {
  budgetMaxYen: number | null;
  candidates: ShoppingCandidate[];
  language: UiLanguage;
  priorities: string[];
  query: string;
}): Recommendation[] {
  const copy = agentCopy[language];
  const deduped = dedupeProducts(candidates);
  const eligible = deduped.filter((candidate) => {
    if (!budgetMaxYen) {
      return true;
    }

    return typeof candidate.priceYen === "number" && candidate.priceYen <= budgetMaxYen;
  });
  const rated = eligible.filter(
    (candidate) => typeof candidate.rating === "number" && typeof candidate.reviewCount === "number"
  );
  const collectionMean = rated.length
    ? rated.reduce((sum, candidate) => sum + (candidate.rating ?? 0), 0) / rated.length
    : 3.5;
  const hasReviewPriority = priorities.some((priority) => /レビュー|评价|review/i.test(priority));
  const hasCompactPriority = priorities.some((priority) =>
    /省スペース|省空间|compact/i.test(priority)
  );

  return eligible
    .map((candidate) => {
      const breakdown = scoreCandidate({
        budgetMaxYen,
        candidate,
        collectionMean,
        copy,
        hasReviewPriority,
        query
      });
      const totalScore = Math.round(
        breakdown.reduce((sum, contribution) => sum + contribution.score * contribution.weight, 0) *
          100
      );
      const constraints = [
        {
          name: copy.budgetConstraint,
          status: budgetMaxYen ? ("matched" as const) : ("unverified" as const),
          explanation: budgetMaxYen
            ? localized(
                language,
                `予算 ${budgetMaxYen.toLocaleString("ja-JP")} 円以内です。`,
                `Within the ¥${budgetMaxYen.toLocaleString("en-US")} budget.`,
                `在 ${budgetMaxYen.toLocaleString("zh-CN")} 日元预算内。`
              )
            : localized(
                language,
                "予算指定はありません。",
                "No budget was provided.",
                "没有指定预算。"
              ),
          evidenceIds: candidate.fieldEvidence.price
        },
        {
          name: copy.reviewConstraint,
          status:
            typeof candidate.rating === "number" && typeof candidate.reviewCount === "number"
              ? ("matched" as const)
              : ("unverified" as const),
          explanation:
            typeof candidate.rating === "number" && typeof candidate.reviewCount === "number"
              ? localized(
                  language,
                  `評価 ${candidate.rating}、${candidate.reviewCount.toLocaleString("ja-JP")}件です。`,
                  `Rated ${candidate.rating} from ${candidate.reviewCount.toLocaleString("en-US")} reviews.`,
                  `评分 ${candidate.rating}，共有 ${candidate.reviewCount.toLocaleString("zh-CN")} 条评价。`
                )
              : copy.noReview,
          evidenceIds: candidate.fieldEvidence.score
        },
        ...(hasCompactPriority
          ? [
              {
                name: copy.compactConstraint,
                status: "unverified" as const,
                explanation: copy.unverifiedSize,
                evidenceIds: []
              }
            ]
          : [])
      ];
      const limitations = [
        ...(hasCompactPriority ? [copy.unverifiedSize] : []),
        ...(!candidate.url || !isAllowedActionUrl(candidate.url) ? [copy.sourceMissing] : [])
      ];

      return {
        id: candidate.id,
        rank: 0,
        title: candidate.title,
        meta: candidate.seller ?? copy.unknownSeller,
        ...(candidate.imageUrl ? { imageUrl: candidate.imageUrl } : {}),
        ...(typeof candidate.priceYen === "number" ? { priceYen: candidate.priceYen } : {}),
        score: totalScore,
        scoreLabel: localized(
          language,
          `適合度 ${totalScore}`,
          `Fit score ${totalScore}`,
          `匹配度 ${totalScore}`
        ),
        reason: shoppingReason(candidate, budgetMaxYen, language),
        constraints,
        scoreBreakdown: breakdown,
        confidence:
          candidate.fieldEvidence.title.length &&
          candidate.fieldEvidence.price.length &&
          candidate.fieldEvidence.actionUrl.length
            ? "high"
            : "medium",
        limitations,
        action: {
          label: copy.productAction,
          ...(candidate.url && isAllowedActionUrl(candidate.url) ? { url: candidate.url } : {})
        },
        evidence: candidate.evidence,
        fieldEvidence: candidate.fieldEvidence
      } satisfies Recommendation;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}
function scoreCandidate({
  budgetMaxYen,
  candidate,
  collectionMean,
  copy,
  hasReviewPriority,
  query
}: {
  budgetMaxYen: number | null;
  candidate: ShoppingCandidate;
  collectionMean: number;
  copy: (typeof agentCopy)[UiLanguage];
  hasReviewPriority: boolean;
  query: string;
}): ScoreContribution[] {
  const count = candidate.reviewCount ?? 0;
  const rating = candidate.rating ?? collectionMean;
  const minimumReviews = 20;
  const weightedRating =
    (count / (count + minimumReviews)) * rating +
    (minimumReviews / (count + minimumReviews)) * collectionMean;
  const reviewQuality = clamp(weightedRating / 5);
  const reviewConfidence = clamp(Math.log10(count + 1) / 3);
  const queryMatch = normalizeForMatch(candidate.title).includes(normalizeForMatch(query)) ? 1 : 0.55;
  const completeness =
    [
      candidate.priceYen,
      candidate.url,
      candidate.rating,
      candidate.reviewCount,
      candidate.seller,
      candidate.imageUrl
    ].filter((value) => value !== undefined && value !== "").length / 6;
  const weights = hasReviewPriority
    ? { budget: 0.2, review: 0.3, confidence: 0.18, query: 0.22, completeness: 0.1 }
    : { budget: 0.25, review: 0.22, confidence: 0.13, query: 0.3, completeness: 0.1 };

  return [
    {
      factor: copy.budgetFactor,
      score:
        !budgetMaxYen || (candidate.priceYen !== undefined && candidate.priceYen <= budgetMaxYen)
          ? 1
          : 0,
      weight: weights.budget,
      explanation: budgetMaxYen ? `price <= ${budgetMaxYen}` : "no hard budget"
    },
    {
      factor: copy.reviewFactor,
      score: reviewQuality,
      weight: weights.review,
      explanation: `Bayesian rating ${weightedRating.toFixed(2)} / 5`
    },
    {
      factor: copy.reviewConfidenceFactor,
      score: reviewConfidence,
      weight: weights.confidence,
      explanation: `${count} reviews`
    },
    {
      factor: copy.queryFactor,
      score: queryMatch,
      weight: weights.query,
      explanation: queryMatch === 1 ? "title contains normalized query" : "search-result match"
    },
    {
      factor: copy.completenessFactor,
      score: completeness,
      weight: weights.completeness,
      explanation: `${Math.round(completeness * 6)} / 6 fields returned`
    }
  ];
}

function shoppingReason(
  candidate: ShoppingCandidate,
  budgetMaxYen: number | null,
  language: UiLanguage
) {
  const facts: string[] = [];

  if (budgetMaxYen && candidate.priceYen !== undefined) {
    facts.push(
      localized(
        language,
        `予算内（¥${candidate.priceYen.toLocaleString("ja-JP")}）`,
        `within budget (¥${candidate.priceYen.toLocaleString("en-US")})`,
        `预算内（¥${candidate.priceYen.toLocaleString("zh-CN")}）`
      )
    );
  }

  if (candidate.rating !== undefined && candidate.reviewCount !== undefined) {
    facts.push(
      localized(
        language,
        `評価 ${candidate.rating} / ${candidate.reviewCount.toLocaleString("ja-JP")}件`,
        `${candidate.rating} rating / ${candidate.reviewCount.toLocaleString("en-US")} reviews`,
        `评分 ${candidate.rating} / ${candidate.reviewCount.toLocaleString("zh-CN")} 条评价`
      )
    );
  }

  if (!facts.length) {
    return agentCopy[language].sourceMissing;
  }

  return facts.join(" · ");
}

function dedupeProducts(candidates: ShoppingCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = candidate.url ?? normalizeForMatch(candidate.title);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[\s　\-_/・]/g, "");
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function localized(language: UiLanguage, ja: string, en: string, zh: string) {
  return language === "en" ? en : language === "zh" ? zh : ja;
}
