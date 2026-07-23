import { expect, test } from "@playwright/test";
import type { AgentRun } from "@/lib/types";

test("desktop flow asks for missing information without exposing implementation detail", async ({
  page
}) => {
  await page.route("**/api/agent?stream=1", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as {
      runId: string;
      startedAt: string;
      prompt: string;
    };
    const run = clarificationRun(body.runId, body.startedAt, body.prompt);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ run })
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("starter-shopping")).toBeVisible();
  await page.getByTestId("composer-textarea").fill("安くて使いやすいものを探して");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("どの商品、または商品カテゴリを探していますか？")).toBeVisible();
  await expect(page.getByText(/APIキー|chain-of-thought/i)).toHaveCount(0);
});

test("starter examples fill the composer", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("starter-shopping").click();

  await expect(page.getByTestId("composer-textarea")).toHaveValue(/電子レンジ/);
  await expect(page.getByRole("button", { name: "送信" })).toBeEnabled();
});

test("mobile layout keeps starter choices and composer in the initial viewport", async ({ page }) => {
  await page.goto("/");
  const starter = page.getByTestId("starter-shopping");
  const composer = page.getByTestId("composer-textarea");

  await expect(starter).toBeVisible();
  await expect(composer).toBeVisible();

  const starterBox = await starter.boundingBox();
  const composerBox = await composer.boundingBox();
  const viewport = page.viewportSize();
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);

  expect(starterBox?.y ?? Infinity).toBeLessThan(220);
  expect((composerBox?.y ?? Infinity) + (composerBox?.height ?? 0)).toBeLessThanOrEqual(
    viewport?.height ?? 0
  );
  expect(pageWidth).toBeLessThanOrEqual(viewport?.width ?? 0);
});

function clarificationRun(runId: string, startedAt: string, prompt: string): AgentRun {
  const traceId = `trace-${runId}`;

  return {
    id: runId,
    traceId,
    scenario: "shopping",
    state: "needs_clarification",
    title: "Shopping agent",
    summary: "候補を正しく探すため、商品カテゴリを確認します。",
    userPrompt: prompt,
    statusLabel: "確認が必要です",
    startedAt,
    clarification: {
      missingField: "query",
      question: "どの商品、または商品カテゴリを探していますか？",
      reasonCode: "missing_shopping_query"
    },
    plan: [],
    tools: [],
    recommendations: [],
    approvals: [],
    memoryProposals: [],
    trace: {
      traceId,
      runId,
      state: "needs_clarification",
      modelProfile: "e2e-fixture",
      startedAt,
      completedAt: startedAt,
      spans: [],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        estimatedCostYen: null
      }
    }
  };
}
