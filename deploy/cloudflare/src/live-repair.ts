import { DurableObject } from "cloudflare:workers";
import {
  LIVE_MODEL,
  LIVE_MAX_OUTPUT,
  LIVE_ALLOCATION,
  newLiveBudget,
  availability,
  beginLiveJob,
  reserveLiveCall,
  settleLiveCall,
  type LiveBudgetState,
} from "./live-policy";
import {
  investigateLive,
  validateLiveSource,
  hashSource,
  type LiveMessage,
} from "./live-agent";
import { RUNNER_ORIGIN, requestForRunner } from "./origin";

type Data = Record<string, any>;
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export class LiveRepair extends DurableObject<Cloudflare.Env> {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS live_state (id INTEGER PRIMARY KEY, state TEXT NOT NULL, salt TEXT NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS live_jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL, status TEXT NOT NULL, report TEXT)",
    );
    ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO live_state (id,state,salt) VALUES (1,?,?)",
      JSON.stringify(newLiveBudget()),
      crypto.randomUUID() + crypto.randomUUID(),
    );
  }
  budget<T>(fn: (state: LiveBudgetState) => T): T {
    const row = this.ctx.storage.sql
      .exec("SELECT state FROM live_state WHERE id=1")
      .one();
    const state = JSON.parse(String(row.state)) as LiveBudgetState;
    try {
      return fn(state);
    } finally {
      this.ctx.storage.sql.exec(
        "UPDATE live_state SET state=? WHERE id=1",
        JSON.stringify(state),
      );
    }
  }
  async identity(value: string) {
    const row = this.ctx.storage.sql
      .exec("SELECT salt FROM live_state WHERE id=1")
      .one();
    return hashSource(String(row.salt) + value);
  }
  async oracle(path: string, body?: Data): Promise<Data> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const request = new Request(RUNNER_ORIGIN + path, {
        ...(body
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
      const r = await this.env.RUNNER.getByName("public-lab").fetch(
        requestForRunner(request),
      );
      if (r.status === 409 && attempt < 11) {
        await new Promise((done) => setTimeout(done, 1500));
        continue;
      }
      const value = (await r.json()) as Data;
      if (!r.ok)
        throw new Error(
          value.error ?? "The isolated runner could not complete this check.",
        );
      return value;
    }
    throw new Error("The isolated runner is busy. Try again shortly.");
  }
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    const owner = await this.identity(
      "owner:" + (request.headers.get("x-racelab-owner") ?? ""),
    );
    const client = await this.identity(
      "client:" + (request.headers.get("x-racelab-client") ?? "unknown"),
    );
    this.ctx.storage.sql.exec(
      "DELETE FROM live_jobs WHERE expires < ?",
      Date.now(),
    );
    if (request.method === "GET" && path === "/api/live/status") {
      const state = this.budget((s) => availability(s, client, Date.now()));
      return json({
        ...state,
        model: LIVE_MODEL,
        workload: "tend-claims",
        allocation: LIVE_ALLOCATION,
        limits: { turns: 6, patches: 2, sourceCharacters: 12000 },
        sourcePolicy:
          "Source and synthetic execution feedback go to Meta via Cloudflare. Reports are available to this browser for 24 hours.",
      });
    }
    if (
      request.method === "GET" &&
      /^\/api\/live\/jobs\/[a-z0-9-]{36}$/.test(path)
    ) {
      const row = this.ctx.storage.sql
        .exec(
          "SELECT status,report FROM live_jobs WHERE id=? AND owner=?",
          path.split("/").at(-1)!,
          owner,
        )
        .toArray()[0];
      return row
        ? json({
            status: row.status,
            report: row.report ? JSON.parse(String(row.report)) : null,
          })
        : json({ error: "This run is unavailable in this browser." }, 404);
    }
    if (request.method !== "POST" || path !== "/api/live/repair")
      return json({ error: "Not found." }, 404);
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 20000)
        throw new Error("The request is too large.");
      const input = JSON.parse(raw);
      validateLiveSource(input.source);
      const ready = this.budget((s) => availability(s, client, Date.now()));
      if (!ready.enabled) throw new Error(ready.reason);
      const id = crypto.randomUUID();
      // Validate syntax in the real adapter before consuming an AI quota.
      const bundle = await this.oracle("/api/workloads/tend");
      const baseline = await this.oracle("/api/workloads/tend/execute", {
        action: "run",
        condition: "normal",
        source: input.source,
      });
      this.budget((s) => beginLiveJob(s, client, id, Date.now()));
      this.ctx.storage.sql.exec(
        "INSERT INTO live_jobs (id,owner,expires,status) VALUES (?,?,?,?)",
        id,
        owner,
        Date.now() + 86400000,
        "running",
      );
      const stream = new TransformStream<Uint8Array, Uint8Array>();
      const writer = stream.writable.getWriter();
      let disconnected = false;
      writer.closed.catch(() => {
        disconnected = true;
      });
      const emit = async (event: Data) => {
        if (disconnected) return;
        try {
          await writer.write(
            new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          disconnected = true;
        }
      };
      const task = async () => {
        try {
          await emit({
            type: "started",
            jobId: id,
            message:
              "Live Meta repair started. Your source, not a saved answer, is the input.",
          });
          const record = await investigateLive(
            bundle,
            input.source,
            baseline,
            {
              execute: (body) =>
                this.oracle("/api/workloads/tend/execute", body),
              emit,
              cancelled: () => disconnected,
              chat: async (messages: LiveMessage[]) => {
                if (disconnected)
                  throw new Error(
                    "The browser disconnected before another model request.",
                  );
                if (
                  new TextEncoder().encode(JSON.stringify(messages)).length >
                  100000
                )
                  throw new Error(
                    "The bounded model context is full. Export this run to inspect it.",
                  );
                const receiptId = crypto.randomUUID();
                this.budget((s) =>
                  reserveLiveCall(s, receiptId, Date.now(), id),
                );
                let settled = false;
                try {
                  const result = (await this.env.AI.run(LIVE_MODEL, {
                    messages,
                    max_tokens: LIVE_MAX_OUTPUT,
                    temperature: 0.1,
                    response_format: { type: "json_object" },
                  })) as Data;
                  const charge = this.budget((s) =>
                    settleLiveCall(s, receiptId, result.usage),
                  );
                  settled = true;
                  if (!charge.known)
                    throw new Error(
                      "Provider usage was unavailable. Live repair is paused for cost review.",
                    );
                  const text =
                    typeof result.response === "string"
                      ? result.response
                      : JSON.stringify(result.response);
                  if (typeof text !== "string" || text.length > 30000)
                    throw new Error(
                      "The model returned an unsupported response.",
                    );
                  return {
                    text,
                    usage: result.usage,
                    costUsd: charge.costMicros / 1e6,
                    receiptId,
                  };
                } catch (error) {
                  if (!settled)
                    this.budget((s) => settleLiveCall(s, receiptId, null));
                  throw new Error(
                    settled
                      ? String((error as Error).message)
                      : "The model request did not complete. Live repair is paused for usage review; no automatic retry was made.",
                  );
                }
              },
            },
            id,
          );
          this.ctx.storage.sql.exec(
            "UPDATE live_jobs SET status=?,report=? WHERE id=?",
            "complete",
            JSON.stringify(record),
            id,
          );
          this.ctx.storage.sql.exec(
            "DELETE FROM live_jobs WHERE id NOT IN (SELECT id FROM live_jobs ORDER BY expires DESC LIMIT 20)",
          );
          await emit({ type: "complete", result: record });
        } catch (error) {
          const message = String((error as Error).message).slice(0, 800);
          this.ctx.storage.sql.exec(
            "UPDATE live_jobs SET status=?,report=? WHERE id=?",
            "failed",
            JSON.stringify({ error: message }),
            id,
          );
          await emit({ type: "error", message });
        } finally {
          this.budget((s) => {
            if (s.active?.id === id) s.active = null;
          });
          try {
            await writer.close();
          } catch {}
        }
      };
      this.ctx.waitUntil(task());
      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
          "X-RaceLab-Job-Id": id,
        },
      });
    } catch (error) {
      return json(
        { error: String((error as Error).message).slice(0, 800) },
        400,
      );
    }
  }
}
