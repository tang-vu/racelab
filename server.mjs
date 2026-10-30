import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, resolve, sep } from "node:path";
import { readConfig } from "./src/config.mjs";
import { openLedger } from "./src/budget.mjs";
import { MetaClient } from "./src/meta.mjs";
import { fixtures, fixtureFor, validateSource } from "./src/race/fixtures.mjs";
import { raceJob } from "./src/race/runner.mjs";
import { investigateRace } from "./src/race/agent.mjs";
import { replayInvestigation } from "./src/race/replay.mjs";
import { readRuntimeConfig, DemoAccess } from "./src/access.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const config = readConfig();
const runtime = readRuntimeConfig();
const dataDirectory = config.dataDirectory;
const ledger = await openLedger(config);
const client = new MetaClient(config, ledger);
const port = runtime.port;
const access = new DemoAccess(runtime);
let paidBusy = false;
let raceBusy = false;
if (runtime.publicOrigin && config.key) {
  // Public restarts must never reset accounting by silently using an empty mount.
  try {
    await readFile(join(config.ledgerDirectory, "usage.json"));
    await ledger.summary();
  } catch {
    throw new Error(
      "Restore the verified usage ledger into RACELAB_LEDGER_DIR before enabling public Meta calls.",
    );
  }
}

function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 3_200_000) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt; charset=utf-8",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  if (!access.trusted(req))
    return json(res, 403, { error: "This origin or host is not allowed." });
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  try {
    if (req.method === "GET" && url.pathname === "/healthz")
      return json(res, 200, { ok: true });
    if (req.method === "POST" && url.pathname === "/api/access") {
      const body = await readBody(req);
      const result = access.unlock(body.code);
      if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
      return json(
        res,
        result.status,
        result.status === 200
          ? { authorized: true }
          : {
              error:
                result.status === 429
                  ? "Too many incorrect codes. Check the code with the builder."
                  : "The demo access code is incorrect.",
            },
      );
    }
    if (req.method === "POST" && url.pathname === "/api/logout") {
      res.setHeader("Set-Cookie", access.logout(req));
      return json(res, 200, { authorized: false });
    }
    if (req.method === "GET" && url.pathname === "/api/status")
      return json(res, 200, {
        configured: Boolean(config.key),
        model: config.model,
        accessRequired: access.required(),
        authorized: access.authorized(req),
        budget: await ledger.summary(),
      });
    if (req.method === "GET" && url.pathname === "/api/racelab/fixtures")
      return json(
        res,
        200,
        fixtures.map(({ additional, ...fixture }) => ({
          ...fixture,
          additionalCaseCount: additional.length,
        })),
      );
    if (
      req.method === "POST" &&
      ["/api/racelab/execute", "/api/racelab/replay"].includes(url.pathname)
    ) {
      if (raceBusy || paidBusy)
        return json(res, 409, {
          error: "Another experiment is running. Wait for it to finish.",
        });
      raceBusy = true;
      try {
        const body = await readBody(req);
        if (url.pathname === "/api/racelab/replay") {
          let record = body.report;
          if (body.recordedCaseId) {
            const fixture = fixtureFor(body.recordedCaseId);
            record = JSON.parse(
              await readFile(
                join(root, "public", "recordings", `${fixture.id}.json`),
                "utf8",
              ),
            );
          }
          return json(
            res,
            200,
            await replayInvestigation(record, Boolean(body.recordedCaseId)),
          );
        }
        const fixture = fixtureFor(body.caseId);
        validateSource(body.source ?? fixture.source);
        const action = ["run", "search", "verify"].includes(body.action)
          ? body.action
          : null;
        if (!action) throw new Error("Choose run, search or verify.");
        return json(res, 200, await raceJob(action, body));
      } finally {
        raceBusy = false;
      }
    }
    if (req.method === "POST" && url.pathname === "/api/racelab/agent") {
      if (!access.authorized(req))
        return json(res, 403, {
          error: "Enter the demo access code to use live Meta calls.",
          code: "LIVE_ACCESS_REQUIRED",
        });
      if (paidBusy || raceBusy)
        return json(res, 409, {
          error: "Another Meta operation is running. Wait for it to finish.",
        });
      paidBusy = true;
      try {
        const body = await readBody(req);
        if (url.pathname === "/api/racelab/agent") {
          fixtureFor(body.caseId);
          validateSource(body.source);
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          });
          const send = (event) => {
            if (!res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`);
          };
          const result = await investigateRace(client, body, send);
          await mkdir(join(dataDirectory, "racelab"), { recursive: true });
          await writeFile(
            join(dataDirectory, "racelab", `${result.runId}.json`),
            JSON.stringify(result, null, 2),
            { mode: 0o600 },
          );
          send({ type: "complete", result });
          res.end();
          return;
        }
      } finally {
        paidBusy = false;
      }
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      return json(res, 405, { error: "Method not allowed." });
    const directory = join(root, "public");
    const relative =
      url.pathname === "/" || url.pathname === "/racelab/"
        ? "index.html"
        : decodeURIComponent(url.pathname).replace(/^\//, "");
    const file = resolve(directory, relative);
    if (!file.startsWith(directory + sep) || !mime[extname(file)])
      return json(res, 404, { error: "Not found." });
    const content = await readFile(file);
    if (extname(file) === ".mp4" && req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      let start;
      let end;
      if (match && (match[1] || match[2])) {
        if (!match[1]) {
          start = Math.max(0, content.length - Number(match[2]));
          end = content.length - 1;
        } else {
          start = Number(match[1]);
          end = match[2]
            ? Math.min(Number(match[2]), content.length - 1)
            : content.length - 1;
        }
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start >= content.length ||
        end < start ||
        (match && !match[1] && Number(match[2]) === 0)
      ) {
        res.setHeader("Content-Range", `bytes */${content.length}`);
        return json(res, 416, {
          error: "Requested video range is unavailable.",
        });
      }
      res.writeHead(206, {
        "Content-Type": mime[".mp4"],
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${content.length}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });
      res.end(
        req.method === "HEAD" ? undefined : content.subarray(start, end + 1),
      );
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[extname(file)],
      "Content-Length": content.length,
      ...(extname(file) === ".mp4" ? { "Accept-Ranges": "bytes" } : {}),
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    const message =
      error.code === "ENOENT"
        ? "Not found."
        : String(error.message).replaceAll(
            config.key || "__NO_SECRET__",
            "[redacted]",
          );
    if (res.headersSent) {
      if (!res.destroyed) {
        res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
        res.end();
      }
    } else json(res, error.code === "ENOENT" ? 404 : 400, { error: message });
  }
});

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(port, runtime.host, () =>
  console.log(
    `RaceLab is ready at ${runtime.publicOrigin ?? `http://127.0.0.1:${port}`}`,
  ),
);
