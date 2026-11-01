import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { readConfig } from "../src/config.mjs";
import { openLedger, sparkReservation } from "../src/budget.mjs";
import { MetaClient } from "../src/meta.mjs";
import { sourceHash } from "../src/workloads/tend-source.mjs";
import { studyTasks, safeEvaluate, feedback } from "../src/study-tasks.mjs";
const root = new URL("../", import.meta.url),
  path = new URL("public/recordings/comparison-study-v2.json", root),
  protocolBytes = await readFile(
    new URL("demo/comparison-protocol-v2.json", root),
  ),
  protocol = JSON.parse(protocolBytes);
for (const [file, hash] of Object.entries(protocol.files))
  if (sourceHash(await readFile(new URL(file, root))) !== hash)
    throw new Error("Frozen evaluator changed: " + file);
const config = readConfig(),
  tasks = await studyTasks(config.dataDirectory);
for (const task of tasks)
  if (
    task.sourceHash !== protocol.tasks.find((t) => t.id === task.id)?.sourceHash
  )
    throw new Error("Frozen source changed.");
if (!process.argv.includes("--live")) {
  const report = JSON.parse(await readFile(path));
  for (const attempt of report.attempts.filter((a) => a.final?.source)) {
    const task = tasks.find((t) => t.id === attempt.task),
      result = await safeEvaluate(task, attempt.final.source, "held-out");
    if (
      result.passed !== attempt.heldOut.passed ||
      JSON.stringify(result.cases.map((c) => [c.id, c.passed])) !==
        JSON.stringify(attempt.heldOut.cases.map((c) => [c.id, c.passed]))
    )
      throw new Error("Retained held-out result differs: " + attempt.id);
    console.log(
      `${attempt.id}: ${result.cases.filter((c) => c.passed).length}/${result.tested} held-out; ${result.passed ? "PASS" : "FAIL"}`,
    );
  }
  console.log("Comparison recomputed; zero model requests.");
} else {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  if (
    sourceHash(
      Buffer.from(
        execFileSync("git", ["show", "HEAD:demo/comparison-protocol-v2.json"], {
          cwd: root,
          windowsHide: true,
        }),
      ),
    ) !== sourceHash(protocolBytes)
  )
    throw new Error("Commit frozen protocol before paid requests.");
  for (const file of Object.keys(protocol.files)) {
    if (
      sourceHash(
        execFileSync("git", ["show", `HEAD:${file}`], {
          cwd: root,
          windowsHide: true,
        }),
      ) !== protocol.files[file]
    )
      throw new Error("Commit frozen implementation before paid requests.");
  }
  const ledger = await openLedger(config),
    before = await ledger.summary(),
    client = new MetaClient(config, ledger);
  if (before.heldUsd || before.blocked)
    throw new Error("Existing accounting is not settled; study did not start.");
  const record = {
    version: 1,
    kind: "bounded-direct-feedback-comparison",
    protocolHash: sourceHash(protocolBytes),
    protocolCommit: git(
      "log",
      "-1",
      "--format=%H",
      "--",
      "demo/comparison-protocol-v2.json",
    ),
    createdAt: new Date().toISOString(),
    model: config.model,
    status: "running",
    attempts: [],
    requests: 0,
    costUsd: 0,
  };
  await writeFile(path, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  const save = async () => {
    const now = await ledger.summary();
    record.requests = now.requests - before.requests;
    record.costUsd = Number((now.spentUsd - before.spentUsd).toFixed(6));
    await writeFile(path, JSON.stringify(record, null, 2) + "\n");
  };
  const properties = {
      hypothesis: { type: "string" },
      explanation: { type: "string" },
      source: { type: "string" },
    },
    schema = {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    };
  const format = {
    response_format: {
      type: "json_schema",
      json_schema: { name: "repair", strict: true, schema },
    },
  };
  const tool = {
    type: "function",
    function: {
      name: "test_candidate",
      description:
        "Execute your proposed source against development conditions only, returning independent checks. One probe, then one final revision.",
      strict: true,
      parameters: schema,
    },
  };
  const publicMessage = (m) => ({
    role: "assistant",
    content: m.content ?? null,
    ...(m.tool_calls
      ? {
          tool_calls: m.tool_calls.map((t) => ({
            id: t.id,
            type: t.type,
            function: {
              name: t.function.name,
              arguments: t.function.arguments,
            },
          })),
        }
      : {}),
  });
  const candidate = (value) => {
    if (
      !value ||
      typeof value.source !== "string" ||
      typeof value.explanation !== "string" ||
      typeof value.hypothesis !== "string"
    )
      throw new Error("Model candidate schema is invalid.");
    return {
      hypothesis: value.hypothesis,
      explanation: value.explanation,
      source: value.source,
      sourceHash: sourceHash(value.source),
    };
  };
  try {
    for (const pair of protocol.order)
      for (const arm of pair.arms) {
        const task = tasks.find((t) => t.id === pair.task),
          attempt = {
            id: `${pair.task}-${pair.repetition}-${arm}`,
            task: pair.task,
            repetition: pair.repetition,
            arm,
            startedAt: new Date().toISOString(),
            calls: [],
            status: "running",
          };
        record.attempts.push(attempt);
        await save();
        const system =
          "You repair a bounded source adapter. Follow the given contract. You cannot edit the harness, fixtures or oracle. Do not import packages or access network, files, process, timers or randomness. Preserve the original function/method signatures. For tend-claim return ONLY the claimNextDue method text, beginning claimNextDue(, with NO class, export, helper, mapper, import or type declarations. For tend-lifecycle return ONLY the three method declarations claimNextDue, renewClaim, completeClaim with NO class, export, mapper or type declarations. The existing followUpFromRow helper is supplied. For airules-diff return ONLY the diffSync function (a local helper is permitted), with no imports. Return the exact requested replacement source and concise public hypothesis/explanation; do not include private reasoning. You have two model requests, at most 4096 output tokens each. Only your final second proposal is scored.";
        const user = `Task: ${task.id}\nContract:\n${task.contract}\nDevelopment condition names: ${task.development.join(", ")}\nInput source:\n${task.source}\nPropose a complete repair. ${arm === "feedback" ? "Call test_candidate exactly once for your first proposal." : "Return your first proposal as the requested JSON."}`;
        const messages = [
          { role: "system", content: system },
          { role: "user", content: user },
        ];
        const call = async (options) => {
          const budget = await ledger.summary();
          if (
            budget.spentUsd -
              before.spentUsd +
              sparkReservation(protocol.maxOutputTokensPerRequest) >
            protocol.studyIncrementalCapUsd
          )
            throw new Error("Incremental study cap reached before request.");
          const start = Date.now();
          try {
            const result = await client.chat(messages, {
              maxOutput: protocol.maxOutputTokensPerRequest,
              ...options,
            });
            attempt.calls.push({
              durationMs: Date.now() - start,
              usage: result.usage,
              costUsd: result.costUsd,
              message: publicMessage(result.message),
            });
            await save();
            return result.message;
          } catch (e) {
            attempt.calls.push({
              durationMs: Date.now() - start,
              error: e.message,
            });
            await save();
            throw e;
          }
        };
        const first = await call(
          arm === "feedback"
            ? {
                tools: { tools: [tool], parallel_tool_calls: false },
              }
            : { format },
        );
        messages.push(publicMessage(first));
        if (arm === "feedback") {
          if (
            first.tool_calls?.length !== 1 ||
            first.tool_calls[0].function.name !== "test_candidate"
          )
            throw new Error("Expected exactly one public test_candidate call.");
          attempt.first = candidate(
            JSON.parse(first.tool_calls[0].function.arguments),
          );
          attempt.developmentFeedback = await safeEvaluate(
            task,
            attempt.first.source,
            "development",
          );
          messages.push({
            role: "tool",
            tool_call_id: first.tool_calls[0].id,
            content: JSON.stringify(feedback(attempt.developmentFeedback)),
          });
          messages.push({
            role: "user",
            content:
              "Use the executed development feedback to return your final complete repair as JSON. No further tool calls are available.",
          });
        } else {
          attempt.first = candidate(JSON.parse(first.content));
          messages.push({
            role: "user",
            content:
              "Self-review your first proposal against the same contract and return your final complete repair as JSON. No executed tests or feedback are available.",
          });
        }
        await save();
        const final = await call({ format });
        attempt.final = candidate(JSON.parse(final.content));
        attempt.development = await safeEvaluate(
          task,
          attempt.final.source,
          "development",
        );
        attempt.heldOut = await safeEvaluate(
          task,
          attempt.final.source,
          "held-out",
        );
        attempt.status = "completed";
        attempt.finishedAt = new Date().toISOString();
        await save();
        console.log(
          `${attempt.id}: ${attempt.heldOut.cases.filter((c) => c.passed).length}/${attempt.heldOut.tested} held-out; cumulative $${record.costUsd}`,
        );
      }
    record.status = "completed";
  } catch (e) {
    const attempt = record.attempts.at(-1);
    if (attempt?.status === "running") {
      attempt.status = "error";
      attempt.error = e.message;
    }
    record.status = "stopped-error";
    record.error = e.message;
    console.log("Study stopped; all attempts retained: " + e.message);
  }
  record.finishedAt = new Date().toISOString();
  await save();
  console.log(
    JSON.stringify({
      status: record.status,
      attempts: record.attempts.length,
      requests: record.requests,
      costUsd: record.costUsd,
    }),
  );
}
