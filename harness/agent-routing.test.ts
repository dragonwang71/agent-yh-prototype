import { describe, expect, it } from "vitest";
import cases from "@/harness/cases/agent-routing.json";
import {
  chooseLocalSearchQuery,
  extractPlace,
  extractPriceMax,
  extractShoppingQuery,
  normalizeLocalSearchQuery
} from "@/lib/agent/heuristics";
import { inferScenario } from "@/lib/demoData";

describe("agent routing harness", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(inferScenario(testCase.prompt)).toBe(testCase.scenario);

      if (testCase.shoppingQuery) {
        expect(extractShoppingQuery(testCase.prompt)).toBe(testCase.shoppingQuery);
      }

      if (testCase.priceMax) {
        expect(extractPriceMax(testCase.prompt)).toBe(testCase.priceMax);
      }

      if (testCase.place) {
        expect(extractPlace(testCase.prompt)).toBe(testCase.place);
      }

      if (testCase.localQueryWhenRaining) {
        expect(chooseLocalSearchQuery(testCase.prompt, 1)).toBe(testCase.localQueryWhenRaining);
      }
    });
  }

  it("does not allow an outdoor park query when rainfall is present", () => {
    expect(normalizeLocalSearchQuery("公園", 0.5)).toBeUndefined();
    expect(normalizeLocalSearchQuery("公園", 0)).toBe("公園");
  });

  it("rejects model-selected facility types outside the allowlist", () => {
    expect(normalizeLocalSearchQuery("ショッピングモール", 0)).toBeUndefined();
  });
});
