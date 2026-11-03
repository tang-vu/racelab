import { LIVE_MODEL, LIVE_MAX_OUTPUT } from "./live-policy.ts";
type Message = { role: string; content: string };
type Data = Record<string, any>;
export const LIVE_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "RaceLabAction",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["probe", "patch", "finish"] },
        hypothesis: { type: "string" },
        condition: { type: "string" },
        explanation: { type: "string" },
        source: { type: "string" },
        summary: { type: "string" },
      },
      required: [
        "action",
        "hypothesis",
        "condition",
        "explanation",
        "source",
        "summary",
      ],
    },
  },
};
export const museBody = (messages: Message[]) => ({
  model: LIVE_MODEL,
  messages,
  max_completion_tokens: LIVE_MAX_OUTPUT,
  reasoning_effort: "low",
  store: false,
  response_format: LIVE_RESPONSE_FORMAT,
});
export async function requestMuse(
  key: string,
  messages: Message[],
  transport: typeof fetch = fetch,
): Promise<Data> {
  if (!key) throw new Error("Muse Spark is not configured on the backend.");
  const body = JSON.stringify(museBody(messages));
  if (new TextEncoder().encode(body).length > 100000)
    throw new Error("The bounded text request is too large.");
  try {
    const response = await transport(
      "https://api.meta.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(90000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Meta returned HTTP ${response.status}. No automatic retry was made.`,
      );
    return (await response.json()) as Data;
  } catch (error) {
    if (/^Meta returned HTTP \d{3}\./.test(String((error as Error).message)))
      throw error;
    throw new Error(
      "The Meta request did not complete. No automatic retry was made.",
    );
  }
}
export function museReply(data: Data): string {
  if (data.model !== LIVE_MODEL)
    throw new Error(
      "The provider did not confirm the requested Muse Spark model.",
    );
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length")
    throw new Error(
      "Muse Spark reached the output cap. No automatic retry was made.",
    );
  if (choice?.message?.refusal)
    throw new Error("Muse Spark declined this request.");
  const text = choice?.message?.content;
  if (typeof text !== "string" || !text.trim() || text.length > 30000)
    throw new Error("Muse Spark returned no supported JSON action.");
  return text;
}
