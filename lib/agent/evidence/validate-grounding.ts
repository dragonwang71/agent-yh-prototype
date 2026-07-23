import type { Recommendation } from "@/lib/agent/schemas";

export type GroundingValidation = {
  valid: Recommendation[];
  rejected: Array<{
    id: string;
    reasons: string[];
  }>;
};

export function validateGroundedRecommendations(
  recommendations: Recommendation[]
): GroundingValidation {
  const valid: Recommendation[] = [];
  const rejected: GroundingValidation["rejected"] = [];

  for (const recommendation of recommendations) {
    const reasons = validateRecommendation(recommendation);

    if (reasons.length) {
      rejected.push({ id: recommendation.id, reasons });
    } else {
      valid.push(recommendation);
    }
  }

  return { valid, rejected };
}

function validateRecommendation(recommendation: Recommendation) {
  const reasons: string[] = [];
  const evidenceIds = new Set(recommendation.evidence.map((evidence) => evidence.id));

  if (!recommendation.fieldEvidence.title.length) {
    reasons.push("title has no evidence");
  }

  if (recommendation.priceYen !== undefined && !recommendation.fieldEvidence.price.length) {
    reasons.push("price has no evidence");
  }

  const unknownMetaLabels = new Set([
    "販売元情報なし",
    "Seller not returned",
    "未返回卖家信息",
    "住所情報なし",
    "Address not returned",
    "未返回地址"
  ]);

  if (!unknownMetaLabels.has(recommendation.meta) && !recommendation.fieldEvidence.meta.length) {
    reasons.push("meta has no evidence");
  }

  if (recommendation.imageUrl && !recommendation.fieldEvidence.imageUrl.length) {
    reasons.push("image URL has no evidence");
  }

  if (recommendation.action.url) {
    if (!recommendation.fieldEvidence.actionUrl.length) {
      reasons.push("action URL has no evidence");
    }

    if (!isAllowedYahooUrl(recommendation.action.url)) {
      reasons.push("action URL is outside the Yahoo allowlist");
    }
  }

  for (const [field, ids] of Object.entries(recommendation.fieldEvidence)) {
    for (const id of ids) {
      if (!evidenceIds.has(id)) {
        reasons.push(`${field} references missing evidence ${id}`);
      }
    }
  }

  if (recommendation.constraints.some((constraint) => constraint.status === "not_matched")) {
    reasons.push("a hard constraint is not matched");
  }

  for (const constraint of recommendation.constraints) {
    for (const id of constraint.evidenceIds) {
      if (!evidenceIds.has(id)) {
        reasons.push(`constraint ${constraint.name} references missing evidence ${id}`);
      }
    }
  }

  if (recommendation.score < 0 || recommendation.score > 100) {
    reasons.push("score is outside 0-100");
  }

  return [...new Set(reasons)];
}

function isAllowedYahooUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === "yahoo.co.jp" ||
        hostname.endsWith(".yahoo.co.jp") ||
        hostname === "yahoo.jp" ||
        hostname.endsWith(".yahoo.jp"))
    );
  } catch {
    return false;
  }
}
