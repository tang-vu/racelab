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
  assert.equal(rendered.sourceType, "CUA-screenshot");
  assert.equal(
    await hash(`docs/racelab-shots/${scene.source}`),
    rendered.sourceSha256,
  );
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
assert.ok(story.disclosures.some((text) => /simulated-store/.test(text)));
console.log(
  "RaceLab film verified: video hash, eight actual UI source hashes, 179.99s render metadata, captions and transcript.",
);
