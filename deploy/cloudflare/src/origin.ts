// Keep the container's existing host allowlist stable across public aliases.
export const RUNNER_ORIGIN = "https://racelab-judge.8ndwvxvrgt.workers.dev";

export function trustedRequest(request: Request, publicOrigin: string) {
  const origin = new URL(request.url).origin;
  return (
    [publicOrigin, RUNNER_ORIGIN].includes(origin) &&
    (!request.headers.has("origin") ||
      request.headers.get("origin") === origin) &&
    (["GET", "HEAD"].includes(request.method) ||
      request.headers.get("sec-fetch-site") !== "cross-site")
  );
}

export function requestForRunner(request: Request) {
  const url = new URL(request.url);
  url.host = new URL(RUNNER_ORIGIN).host;
  const forwarded = new Request(url, request);
  forwarded.headers.set("host", url.host);
  if (forwarded.headers.has("origin"))
    forwarded.headers.set("origin", RUNNER_ORIGIN);
  forwarded.headers.delete("cf-container-target-port");
  return forwarded;
}
