import { loadEnvConfig } from "@next/env";
import { geocodePlace, searchShopping } from "@/lib/agent/tools/yahoo";

async function main() {
loadEnvConfig(process.cwd());
const clientId = process.env.YAHOO_CLIENT_ID?.trim();

if (!clientId) {
  throw new Error("YAHOO_CLIENT_ID is required for npm run eval:live.");
}

const shopping = await searchShopping({
  clientId,
  priceMax: 20_000,
  query: "電子レンジ",
  signal: AbortSignal.timeout(15_000),
  toolCallId: "live-shopping"
});
const geocode = await geocodePlace({
  clientId,
  place: "渋谷",
  signal: AbortSignal.timeout(15_000),
  toolCallId: "live-geocoder"
});

const checks = [
  {
    tool: "yahoo_shopping",
    ok: shopping.ok,
    latencyMs: shopping.meta.latencyMs,
    evidenceCount: shopping.ok ? shopping.evidence.length : 0,
    errorCode: shopping.ok ? undefined : shopping.error.code
  },
  {
    tool: "yahoo_geocoder",
    ok: geocode.ok,
    latencyMs: geocode.meta.latencyMs,
    evidenceCount: geocode.ok ? geocode.evidence.length : 0,
    errorCode: geocode.ok ? undefined : geocode.error.code
  }
];

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2));

if (checks.some((check) => !check.ok)) {
  process.exitCode = 1;
}
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Live evaluation failed.");
  process.exitCode = 1;
});
