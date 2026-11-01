import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root));
const hash = async (path) =>
  createHash("sha256")
    .update(await read(path))
    .digest("hex");
const story = JSON.parse(await read("demo/racelab-storyboard.json"));
const manifest = JSON.parse(await read("demo/racelab-render-manifest.json"));
const sources = JSON.parse(await read(`${story.sourceDirectory}/sources.json`));
assert.equal(
  story.scenes.reduce((sum, scene) => sum + scene.seconds, 0),
  180,
);
assert.equal(story.scenes.length, 8);
assert.equal(manifest.storyboard, "demo/racelab-storyboard.json");
assert.equal(manifest.width, 1920);
assert.equal(manifest.height, 1080);
assert.equal(manifest.frameRate, "30/1");
assert.ok(manifest.durationSeconds <= 180 && manifest.durationSeconds >= 179.8);
assert.equal(await hash("public/racelab-demo.mp4"), manifest.videoSha256);
for (const [index, scene] of story.scenes.entries()) {
  const rendered = manifest.scenes[index];
  assert.equal(rendered.id, scene.id);
  assert.equal(rendered.seconds, scene.seconds);
  assert.equal(
    rendered.sourceType,
    scene.kind === "browser" ? "app-recording" : "app-screenshot",
  );
  if (scene.kind === "browser") {
    assert.equal(rendered.sourceFrameRate, "30/1");
    assert.ok(rendered.sourceFrames >= scene.seconds * 29);
  }
  assert.equal(
    await hash(`${story.sourceDirectory}/${scene.source}`),
    rendered.sourceSha256,
  );
  assert.equal(sources.sources[scene.id].sha256, rendered.sourceSha256);
  assert.match(sources.sources[scene.id].method, /Playwright.*Microsoft Edge/);
  assert.ok(rendered.narrationSeconds > 0 && rendered.tempo <= 1.16);
}
const srt = (await read("demo/racelab-demo.srt")).toString("utf8");
const transcript = srt
  .replace(/^\d+\r?$/gm, "")
  .replace(/^\d\d:\d\d:\d\d,\d{3} --> .*$/gm, "")
  .replace(/\s+/g, " ")
  .trim();
assert.equal(
  transcript,
  story.scenes.map((scene) => scene.narration).join(" "),
);
assert.match((await read("public/racelab-demo.vtt")).toString(), /^WEBVTT/);
assert.ok(story.disclosures.some((text) => /stills/.test(text)));
assert.ok(story.disclosures.some((text) => /controlled process/.test(text)));
assert.equal(await hash(story.recording), story.recordingSha256);
assert.equal(manifest.recordingSha256, story.recordingSha256);
const filmHtml = (await read("public/film.html")).toString();
const chapters = [...filmHtml.matchAll(/data-seek="(\d+)"/g)].map((match) =>
  Number(match[1]),
);
let elapsed = 0;
assert.deepEqual(
  chapters,
  story.scenes.map((scene) => {
    const start = elapsed;
    elapsed += scene.seconds;
    return start;
  }),
);
assert.equal(sources.paidAttempts, 0);
assert.equal(sources.passed, true);
assert.deepEqual(sources.errors, []);
assert.deepEqual(sources.viewport, { width: 1440, height: 700 });
assert.equal(story.scenes[0].kind, "browser");
assert.equal(story.scenes[0].seconds, 20);
const archive = JSON.parse(
  await read("demo/archive/store-render-manifest.json"),
);
assert.equal(
  await hash("public/archive/racelab-store-demo.mp4"),
  archive.videoSha256,
);
for (const scene of archive.scenes)
  assert.equal(
    await hash(`docs/racelab-shots/${scene.source}`),
    scene.sourceSha256,
  );
const tendArchive = JSON.parse(
  await read("demo/archive/tend-render-manifest.json"),
);
const partialArchive = JSON.parse(
  await read("demo/archive/evidence-partial-render-manifest.json"),
);
assert.equal(
  await hash("public/archive/racelab-evidence-partial-demo.mp4"),
  partialArchive.videoSha256,
);
for (const scene of partialArchive.scenes)
  assert.equal(
    await hash(
      scene.id === "07-comparison"
        ? "docs/evidence-shots/archive/07-comparison-partial.png"
        : scene.id === "05-lifecycle"
          ? "docs/evidence-shots/archive/05-lifecycle-partial.png"
          : `docs/evidence-shots/${scene.source}`,
    ),
    scene.sourceSha256,
  );
assert.equal(
  await hash("public/archive/racelab-tend-demo.mp4"),
  tendArchive.videoSha256,
);
for (const scene of tendArchive.scenes)
  assert.equal(
    await hash(`docs/tend-shots/${scene.source}`),
    scene.sourceSha256,
  );
console.log(
  "RaceLab evidence film verified: actual Edge clips/stills, retained investigation, captions/transcript, chapters and all preserved earlier films.",
);
