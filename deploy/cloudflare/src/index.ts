import { Container } from "@cloudflare/containers";
import { RUNNER_ORIGIN, requestForRunner, trustedRequest } from "./origin";
export { LiveRepair } from "./live-repair";

function liveRequest(request: Request, path?: string) {
  const existing = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("__Host-racelab-live="))
    ?.split("=")[1];
  const token =
    existing && /^[a-f0-9]{64}$/.test(existing)
      ? existing
      : [...crypto.getRandomValues(new Uint8Array(32))]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
  const url = new URL(request.url);
  if (path) url.pathname = path;
  const forwarded = new Request(url, request);
  forwarded.headers.set("x-racelab-owner", token);
  forwarded.headers.set(
    "x-racelab-client",
    request.headers.get("cf-connecting-ip") ?? "unknown",
  );
  return {
    request: forwarded,
    cookie:
      token !== existing
        ? `__Host-racelab-live=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
        : null,
  };
}

function withLiveCookie(response: Response, cookie: string | null) {
  const result = new Response(response.body, response);
  if (cookie) result.headers.set("Set-Cookie", cookie);
  result.headers.set("Cache-Control", "no-store");
  result.headers.set("X-Content-Type-Options", "nosniff");
  return result;
}

export class RaceLabRunner extends Container<Cloudflare.Env> {
  defaultPort = 4174;
  sleepAfter = "2m";
  enableInternet = false;
  pingEndpoint = "127.0.0.1:4174/healthz";
  envVars = {
    HOST: "0.0.0.0",
    PORT: "4174",
    RACELAB_PUBLIC_ORIGIN: RUNNER_ORIGIN,
    RACELAB_JUDGE_MODE: "1",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!trustedRequest(request, env.PUBLIC_ORIGIN)) {
      return Response.json(
        { error: "This origin or host is not allowed." },
        { status: 403 },
      );
    }
    if (url.pathname.startsWith("/api/live/")) {
      const live = liveRequest(request);
      const response = await env.LIVE.getByName(
        "allocated-live-scout-v1",
      ).fetch(live.request);
      return withLiveCookie(response, live.cookie);
    }
    if (request.method === "GET" && url.pathname === "/api/status") {
      const live = liveRequest(request, "/api/live/status");
      const [runner, availability] = await Promise.all([
        env.RUNNER.getByName("public-lab").fetch(requestForRunner(request)),
        env.LIVE.getByName("allocated-live-scout-v1").fetch(live.request),
      ]);
      const status = (await runner.json()) as Record<string, unknown>;
      return withLiveCookie(
        Response.json({ ...status, liveRepair: await availability.json() }),
        live.cookie,
      );
    }
    if (
      request.method === "POST" &&
      ["/api/racelab/agent", "/api/workloads/tend/agent"].includes(url.pathname)
    ) {
      return Response.json(
        {
          error:
            "This legacy endpoint is disabled. Use the live Meta repair workspace at /tend.html for a new supported method investigation.",
          code: "PUBLIC_RECHECK_ONLY",
        },
        { status: 403 },
      );
    }
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname === "/healthz" ||
      url.pathname.endsWith(".mp4")
    ) {
      // Static Assets ignores Range; Node serves MP4 byte ranges for real seeks.
      // One named instance enforces the backend's bounded experiment lock.
      const forwarded = requestForRunner(request);
      return env.RUNNER.getByName("public-lab").fetch(forwarded);
    }
    const assetUrl = new URL(request.url);
    if (url.pathname === "/") assetUrl.pathname = "/index.html";
    const upstream = await env.ASSETS.fetch(new Request(assetUrl, request));
    const response = new Response(upstream.body, upstream);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    return response;
  },
} satisfies ExportedHandler<Cloudflare.Env>;
