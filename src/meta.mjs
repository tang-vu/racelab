import {
  sparkReservation,
  SPARK_INPUT_USD,
  SPARK_OUTPUT_USD,
} from "./budget.mjs";

export class MetaClient {
  constructor(config, ledger, transport = fetch) {
    this.config = config;
    this.ledger = ledger;
    this.transport = transport;
  }
  async chat(messages, options = {}) {
    if (!this.config.key)
      throw new Error("Add MODEL_API_KEY to .env.local to enable Meta.");
    const maxOutput = options.maxOutput ?? 2048;
    if (!Number.isInteger(maxOutput) || maxOutput < 1 || maxOutput > 4096)
      throw new Error("Output token cap is invalid.");
    const body = {
      model: this.config.model,
      messages,
      max_completion_tokens: maxOutput,
      reasoning_effort: "low",
      store: false,
      ...options.format,
      ...options.tools,
    };
    const reservation = await this.ledger.reserve(
      "spark",
      sparkReservation(maxOutput),
      { model: this.config.model },
    );
    let settled = false;
    try {
      const response = await this.transport(
        `${this.config.baseURL}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(90_000),
          redirect: "error",
        },
      );
      if (!response.ok)
        throw new Error(
          `Meta returned HTTP ${response.status}. No automatic retry was made.`,
        );
      const data = await response.json();
      const usage = data.usage;
      const known =
        Number.isSafeInteger(usage?.prompt_tokens) &&
        usage.prompt_tokens >= 0 &&
        Number.isSafeInteger(usage?.completion_tokens) &&
        usage.completion_tokens >= 0;
      const cost = known
        ? usage.prompt_tokens * SPARK_INPUT_USD +
          usage.completion_tokens * SPARK_OUTPUT_USD
        : null;
      await this.ledger.settle(reservation, cost, known ? usage : null);
      settled = true;
      if (!known)
        throw new Error(
          "Meta did not return token usage. Paid requests are paused for cost review.",
        );
      const choice = data.choices?.[0];
      if (!choice?.message)
        throw new Error("Meta returned no assistant message.");
      if (choice.finish_reason === "length")
        throw new Error(
          "Meta reached the output cap. No automatic retry was made.",
        );
      if (choice.message.refusal)
        throw new Error("Meta declined this request.");
      return {
        message: choice.message,
        usage,
        costUsd: cost,
        receiptId: reservation,
      };
    } catch (error) {
      if (!settled) await this.ledger.settle(reservation, null).catch(() => {});
      if (/^Meta /.test(error.message)) throw error;
      throw new Error(
        "The Meta request did not complete. Paid requests are paused if the charge is uncertain.",
      );
    }
  }
}
