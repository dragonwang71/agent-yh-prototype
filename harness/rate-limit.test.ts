import { describe, expect, it } from "vitest";
import { checkAgentRateLimit } from "@/lib/agent/rate-limit";

describe("agent API rate limit", () => {
  it("allows a bounded burst and resets after the window", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const now = Date.now();

    for (let index = 0; index < 12; index += 1) {
      expect(checkAgentRateLimit(key, now).allowed).toBe(true);
    }

    expect(checkAgentRateLimit(key, now).allowed).toBe(false);
    expect(checkAgentRateLimit(key, now + 60_001).allowed).toBe(true);
  });
});
