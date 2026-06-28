export const runtime = "nodejs";

type MemoryRequest = {
  memory: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as MemoryRequest;
  const transcript = body.messages
    .filter((message) => message.content.trim())
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  const prompt = `You update the long-term user memory for Agent yh.

Goal:
- Extract only durable information that helps answer the end user's future everyday shopping, weather, local search, and outing questions.
- Keep this as a fictional Tokyo consumer persona for demonstrating why memory improves agent answers.
- The memory must start exactly with:
# ユーザーメモ

回答はアプリで選択された言語に合わせる。
- Keep useful existing memory that improves the demo user's future answers.
- Preserve concrete lifestyle details when they help show why memory matters.
- Merge duplicates and rewrite the memory as clean Japanese Markdown.

Store:
- stable living context, especially city or neighborhood
- daily mobility, budget, language, schedule, food, shopping, leisure, and travel preferences
- answer preferences that improve future shopping, weather, map, or local recommendations
- practical constraints that affect recommendations

Do not store:
- raw chat logs
- one-off requests
- app-development, coding, UI, or implementation details
- API keys, secrets, private identifiers, or credentials
- unsupported guesses about the user

Keep it concise and useful for a normal consumer assistant. Return Japanese Markdown only.

Current memory:
${body.memory || "(empty)"}

Recent conversation:
${transcript || "(empty)"}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You update durable long-term user memory for a consumer assistant demo. Return only the updated Markdown memory."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    return Response.json(
      { error: `OpenAI API ${response.status}` },
      { status: response.status }
    );
  }

  const data = (await response.json()) as OpenAIChatResponse;
  const memory = data.choices?.[0]?.message?.content?.trim();

  if (!memory) {
    return Response.json({ error: "OpenAI API returned no memory." }, { status: 502 });
  }

  return Response.json({ memory });
}
