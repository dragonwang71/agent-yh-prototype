import { agentEventSchema, agentRequestSchema, type AgentRun } from "@/lib/agent/schemas";
import { reduceAgentEvent } from "@/lib/agent/events";
import { runAgent } from "@/lib/agent/orchestrator";
import {
  checkAgentRateLimit,
  rateLimitHeaders,
  rateLimitIdentifier
} from "@/lib/agent/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimit = checkAgentRateLimit(rateLimitIdentifier(request));

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Please wait before trying again." },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(rateLimit),
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1_000)))
        }
      }
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = agentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid agent request.",
        fields: parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean)
      },
      { status: 400, headers: rateLimitHeaders(rateLimit) }
    );
  }

  if (new URL(request.url).searchParams.get("stream") === "1") {
    return streamAgent(parsed.data, request.signal, rateLimitHeaders(rateLimit));
  }

  let finalRun: AgentRun | undefined;

  await runAgent({
    request: parsed.data,
    signal: request.signal,
    emit(event) {
      const validated = agentEventSchema.parse(event);
      finalRun = reduceAgentEvent(finalRun, validated);
    }
  });

  if (!finalRun) {
    return Response.json({ error: "Agent produced no run." }, { status: 502 });
  }

  return Response.json({ run: finalRun }, { headers: rateLimitHeaders(rateLimit) });
}

function streamAgent(
  request: Parameters<typeof runAgent>[0]["request"],
  signal: AbortSignal,
  rateHeaders: Record<string, string>
) {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      signal.addEventListener("abort", close, { once: true });

      try {
        await runAgent({
          request,
          signal,
          emit(event) {
            if (closed) {
              return;
            }

            const validated = agentEventSchema.parse(event);
            controller.enqueue(encoder.encode(`${JSON.stringify(validated)}\n`));
          }
        });
      } finally {
        signal.removeEventListener("abort", close);
        close();
      }
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...rateHeaders
    }
  });
}
