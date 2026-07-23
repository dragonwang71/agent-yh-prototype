import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

export type ModelUsage = {
  responseId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  latencyMs: number;
};

export type StructuredModelResult<T> = {
  data: T;
  usage: ModelUsage;
};

const defaultModel = "gpt-5.6-terra";
const requestTimeoutMs = 15_000;

let client: OpenAI | undefined;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  client ??= new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: requestTimeoutMs
  });

  return client;
}
function configuredReasoningEffort() {
  const effort = process.env.OPENAI_REASONING_EFFORT;

  if (
    effort === "none" ||
    effort === "low" ||
    effort === "medium" ||
    effort === "high" ||
    effort === "xhigh" ||
    effort === "max"
  ) {
    return effort;
  }

  return undefined;
}

export function getConfiguredModel() {
  return process.env.OPENAI_MODEL ?? defaultModel;
}

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function callStructuredModel<T>({
  input,
  instructions,
  name,
  schema,
  signal
}: {
  input: unknown;
  instructions: string;
  name: string;
  schema: ZodType<T>;
  signal: AbortSignal;
}): Promise<StructuredModelResult<T>> {
  const openai = getClient();

  if (!openai) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const reasoningEffort = configuredReasoningEffort();
  const started = performance.now();
  const response = await openai.responses.parse(
    {
      model: getConfiguredModel(),
      store: false,
      input: [
        {
          role: "developer",
          content: instructions
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      text: {
        format: zodTextFormat(schema, name),
        verbosity: "low"
      },
      max_output_tokens: 1_200,
      ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {})
    },
    {
      signal,
      maxRetries: 0,
      timeout: requestTimeoutMs
    }
  );
  const parsed = response.output_parsed;

  if (!parsed) {
    const refusal = response.output
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content)
      .find((item) => item.type === "refusal");

    throw new Error(
      refusal?.type === "refusal" ? `Model refusal: ${refusal.refusal}` : "No parsed model output"
    );
  }

  return {
    data: parsed,
    usage: {
      responseId: response.id,
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      cachedTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
      latencyMs: Math.round(performance.now() - started)
    }
  };
}
