import { Container } from "@cloudflare/containers";

export class RaceLabRunner extends Container<Cloudflare.Env> {
  defaultPort = 4174;
  sleepAfter = "2m";
  enableInternet = false;
  pingEndpoint = "127.0.0.1:4174/healthz";
  envVars = {
    HOST: "0.0.0.0",
    PORT: "4174",
    RACELAB_PUBLIC_ORIGIN: this.env.PUBLIC_ORIGIN,
    RACELAB_JUDGE_MODE: "1",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.origin !== env.PUBLIC_ORIGIN ||
      (request.headers.has("origin") &&
        request.headers.get("origin") !== env.PUBLIC_ORIGIN) ||
      (request.method !== "GET" &&
        request.method !== "HEAD" &&
        request.headers.get("sec-fetch-site") === "cross-site")
    ) {
      return Response.json(
        { error: "This origin or host is not allowed." },
        { status: 403 },
      );
    }
    if (
      request.method === "POST" &&
      ["/api/racelab/agent", "/api/workloads/tend/agent"].includes(url.pathname)
    ) {
      return Response.json(
        {
          error:
            "This public lab re-executes retained Meta repairs. New model investigations require a private installation.",
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
      const forwarded = new Request(request);
      forwarded.headers.delete("cf-container-target-port");
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
