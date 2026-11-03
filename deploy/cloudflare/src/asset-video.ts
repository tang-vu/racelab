// Static Assets ignores Range. Stream the selected bytes without buffering the
// whole movie, so a newly published film does not require a runner image rebuild.
export async function serveAssetVideo(
  request: Request,
  assets: (r: Request) => Promise<Response>,
  knownBytes?: number,
) {
  if (!["GET", "HEAD"].includes(request.method))
    return new Response(null, { status: 405 });
  const headers = new Headers(request.headers);
  headers.delete("Range");
  headers.delete("If-Range");
  const upstream = await assets(new Request(request.url, { headers }));
  const out = new Headers(upstream.headers);
  out.set("Accept-Ranges", "bytes");
  out.set("X-Content-Type-Options", "nosniff");
  const total = knownBytes ?? Number(upstream.headers.get("Content-Length"));
  if (total > 0) out.set("Content-Length", String(total));
  const sized = (stream: ReadableStream<Uint8Array> | null, length: number) => {
    if (!stream || typeof FixedLengthStream === "undefined") return stream;
    const fixed = new FixedLengthStream(length);
    stream.pipeTo(fixed.writable).catch(() => {});
    return fixed.readable;
  };
  if (request.method === "HEAD") {
    // The edge strips the body for HEAD; the sized stream preserves real length.
    return new Response(
      total > 0 ? sized(upstream.body, total) : upstream.body,
      { status: upstream.status, headers: out },
    );
  }
  const value = request.headers.get("Range"),
    condition = request.headers.get("If-Range");
  if (
    upstream.status !== 200 ||
    !value ||
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    upstream.headers.has("Content-Encoding") ||
    (condition &&
      (condition.startsWith("W/") ||
        (condition !== out.get("ETag") &&
          condition !== out.get("Last-Modified"))))
  )
    return new Response(
      total > 0 ? sized(upstream.body, total) : upstream.body,
      {
        status: upstream.status,
        headers: out,
      },
    );
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  let start = NaN,
    end = NaN;
  if (match && (match[1] || match[2])) {
    start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
    end =
      match[1] && match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (!match[1] && Number(match[2]) === 0) start = NaN;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= total ||
    end < start
  ) {
    await upstream.body?.cancel();
    out.set("Content-Range", `bytes */${total}`);
    out.delete("Content-Length");
    return new Response(null, { status: 416, headers: out });
  }
  const reader = upstream.body!.getReader();
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) {
            controller.close();
            return;
          }
          const chunkStart = offset;
          offset += next.value.byteLength;
          if (offset <= start) continue;
          const slice = next.value.subarray(
            Math.max(0, start - chunkStart),
            Math.min(next.value.byteLength, end + 1 - chunkStart),
          );
          if (slice.byteLength) controller.enqueue(slice);
          if (offset > end) {
            controller.close();
            await reader.cancel().catch(() => {});
          }
          return;
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  out.set("Content-Range", `bytes ${start}-${end}/${total}`);
  out.set("Content-Length", String(end - start + 1));
  return new Response(sized(stream, end - start + 1), {
    status: 206,
    headers: out,
  });
}
