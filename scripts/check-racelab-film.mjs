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
const sources = JSON.parse(await read("docs/tend-shots/sources.json"));
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
  assert.equal(rendered.sourceType, "app-screenshot");
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
assert.deepEqual(
  sources.views.map((item) => item.width),
  [1440, 390, 320, 768],
);
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
console.log(
  "RaceLab TEND film verified: video and eight actual Edge captures, retained investigation hash, captions, transcript and preserved store-film archive.",
);
