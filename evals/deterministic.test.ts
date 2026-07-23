import { describe, expect, it } from "vitest";
import { evalCases, expectedCategoryCounts } from "@/evals/datasets/cases";
import {
  outingFixture,
  shoppingFixture,
  weatherFixtureEvidence
} from "@/evals/fixtures/recommendations";
import { validateGroundedRecommendations } from "@/lib/agent/evidence/validate-grounding";
import { parseIntentWithRules } from "@/lib/agent/model/intent-parser";
import { rankOutingCandidates } from "@/lib/agent/ranking/outing-ranker";
import { rankShoppingCandidates } from "@/lib/agent/ranking/shopping-ranker";

describe("deterministic evaluation dataset", () => {
  it("contains the declared 120 cases without hidden personal data", () => {
    expect(evalCases).toHaveLength(120);

    for (const [category, expected] of Object.entries(expectedCategoryCounts)) {
      expect(evalCases.filter((item) => item.category === category)).toHaveLength(expected);
    }
  });

  it("routes every fixed case and preserves explicit slots", () => {
    for (const item of evalCases) {
      const intent = parseIntentWithRules(
        item.prompt,
        item.language,
        item.memory ?? [],
        item.scenarioHint
      );

      expect(intent.kind, item.id).toBe(item.expectedKind);

      if (intent.kind === "shopping") {
        expect(intent.query, item.id).toBe(item.expectedQuery);
        expect(intent.budgetMaxYen, item.id).toBe(item.expectedBudgetMaxYen ?? null);
      }

      if (intent.kind === "outing") {
        expect(intent.place, item.id).toBe(item.expectedPlace);
      }
    }
  });
});

describe("ranking and grounding gates", () => {
  it("filters hard budgets, deduplicates and rewards trustworthy review volume", () => {
    const ranked = rankShoppingCandidates({
      budgetMaxYen: 20_000,
      candidates: shoppingFixture,
      language: "ja",
      priorities: ["レビュー重視", "省スペース"],
      query: "電子レンジ"
    });

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.id).toBe("product-trusted");
    expect(ranked.every((item) => (item.priceYen ?? Infinity) <= 20_000)).toBe(true);
    expect(ranked.every((item) => item.constraints.some((constraint) => constraint.status === "unverified"))).toBe(
      true
    );
    expect(validateGroundedRecommendations(ranked).rejected).toHaveLength(0);
  });

  it("grounds weather and place facts while ranking closer places first", () => {
    const ranked = rankOutingCandidates({
      language: "ja",
      places: outingFixture,
      query: "カフェ",
      weatherCovered: true,
      weatherEvidence: weatherFixtureEvidence
    });
    const validation = validateGroundedRecommendations(ranked);

    expect(ranked[0]?.id).toBe("place-near");
    expect(validation.rejected).toHaveLength(0);
    expect(ranked[0]?.constraints.find((item) => item.name.includes("天気"))?.evidenceIds).toEqual([
      "weather:rainfall"
    ]);
  });

  it("rejects factual fields whose evidence link is removed", () => {
    const [ranked] = rankShoppingCandidates({
      budgetMaxYen: 20_000,
      candidates: shoppingFixture,
      language: "ja",
      priorities: [],
      query: "電子レンジ"
    });

    expect(ranked).toBeDefined();
    const forged = {
      ...ranked!,
      fieldEvidence: {
        ...ranked!.fieldEvidence,
        price: []
      }
    };
    const validation = validateGroundedRecommendations([forged]);

    expect(validation.valid).toHaveLength(0);
    expect(validation.rejected[0]?.reasons).toContain("price has no evidence");
  });
});
