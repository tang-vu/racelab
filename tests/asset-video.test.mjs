import test from "node:test";
import assert from "node:assert/strict";
import { serveAssetVideo } from "../deploy/cloudflare/src/asset-video.ts";
const bytes = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
const assets = async (request) => {
  assert.equal(request.headers.has("Range"), false);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < 100; i += 7)
          controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Length": "100",
        "Content-Type": "video/mp4",
        ETag: '"film-v5"',
      },
    },
  );
};
test("published film ranges select exact bytes across streamed chunk boundaries", async () => {
  for (const [range, start, end] of [
    ["bytes=0-31", 0, 31],
    ["bytes=-32", 68, 99],
    ["bytes=70-", 70, 99],
    ["bytes=90-150", 90, 99],
  ]) {
    const r = await serveAssetVideo(
      new Request("https://example.test/movie.mp4", {
        headers: { Range: range },
      }),
      assets,
    );
    assert.equal(r.status, 206);
    assert.equal(r.headers.get("Content-Range"), `bytes ${start}-${end}/100`);
    assert.deepEqual(
      new Uint8Array(await r.arrayBuffer()),
      bytes.slice(start, end + 1),
    );
  }
});
test("video HEAD, full responses, invalid ranges and stale If-Range preserve HTTP semantics", async () => {
  const head = await serveAssetVideo(
    new Request("https://example.test/movie.mp4", { method: "HEAD" }),
    assets,
  );
  assert.equal(head.status, 200);
  await head.body?.cancel(); // The HTTP edge suppresses HEAD response bytes.
  assert.equal(head.headers.get("Content-Length"), "100");
  for (const range of [
    "bytes=-0",
    "bytes=100-",
    "bytes=9-2",
    "bytes=0-2,5-8",
  ]) {
    const r = await serveAssetVideo(
      new Request("https://example.test/movie.mp4", {
        headers: { Range: range },
      }),
      assets,
    );
    assert.equal(r.status, 416);
    assert.equal(r.headers.get("Content-Range"), "bytes */100");
  }
  const full = await serveAssetVideo(
    new Request("https://example.test/movie.mp4", {
      headers: { Range: "bytes=0-1", "If-Range": '"old-film"' },
    }),
    assets,
  );
  assert.equal(full.status, 200);
  assert.deepEqual(new Uint8Array(await full.arrayBuffer()), bytes);
});
