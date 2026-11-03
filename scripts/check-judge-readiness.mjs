// Public HTTP checks only: no model request, execution job, token or ledger access.
import assert from "node:assert/strict";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
const app = "https://racelab.tangvu.dev";
const review = "https://racelab-tang-vu.tang-vu.chatgpt.site";
const results = [];
async function request(url, init) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status >= 500 && attempt === 0) {
        await response.body?.cancel();
        continue;
      }
      return response;
    } catch (error) {
      if (attempt) throw error;
    }
  }
}
async function check(name, work) {
  try {
    results.push({ name, passed: true, ...(await work()) });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
}
for (const [name, url, expected] of [
  ["MVP", app + "/", "project-live"],
  ["Film", app + "/film.html", "cBR_6Pzx0W4"],
  ["Recorded evidence", app + "/evidence.html", "evidence-source"],
  ["Store experiments", app + "/store", "original-tab"],
  ["Review page", review, "cBR_6Pzx0W4"],
])
  await check(name, async () => {
    const response = await request(url);
    assert.equal(response.status, 200, `HTTP ${response.status}`);
    assert.ok(
      (await response.text()).includes(expected),
      "Expected page content missing",
    );
    return { url };
  });
await check("Muse availability", async () => {
  const response = await request(app + "/api/live/status");
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.equal(status.model, "muse-spark-1.3");
  assert.ok(
    status.enabled ||
      /Another live repair is running|Your live repair preview limit/.test(
        status.reason,
      ),
    status.reason,
  );
  return { liveReady: status.enabled, reason: status.reason };
});
await check("Public repository", async () => {
  const response = await request(
    "https://api.github.com/repos/tang-vu/racelab",
    { headers: { Accept: "application/vnd.github+json" } },
  );
  assert.equal(response.status, 200);
  const repo = await response.json();
  assert.equal(repo.private, false);
  assert.equal(repo.default_branch, "main");
  return { url: repo.html_url };
});
await check("YouTube metadata", async () => {
  const response = await request(
    "https://www.youtube.com/oembed?format=json&url=" +
      encodeURIComponent("https://www.youtube.com/watch?v=cBR_6Pzx0W4"),
  );
  assert.equal(response.status, 200);
  const video = await response.json();
  assert.match(video.title, /RaceLab/);
  return {
    title: video.title,
    verification: "Anonymous metadata; decoded playback is not tested",
  };
});
await check("Movie byte ranges", async () => {
  const response = await request(app + "/racelab-demo.mp4", {
    headers: { Range: "bytes=0-31" },
  });
  assert.equal(response.status, 206);
  assert.equal((await response.arrayBuffer()).byteLength, 32);
  assert.equal(response.headers.get("content-range"), "bytes 0-31/8553442");
  return { bytes: 32 };
});
const report = {
  at: new Date().toISOString(),
  modelRequests: 0,
  passed: results.every((r) => r.passed),
  checks: results,
};
await mkdir(".racelab/judge-readiness", { recursive: true });
await writeFile(
  ".racelab/judge-readiness/latest.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## Judge readiness\n\n${report.passed ? "Passed" : "Needs attention"} at ${report.at}. No model requests.\n\n` +
      results
        .map(
          (r) =>
            `- ${r.passed ? "PASS" : "FAIL"}: ${r.name}${r.reason ? ` — ${r.reason}` : ""}${r.error ? ` — ${r.error}` : ""}`,
        )
        .join("\n") +
      "\n",
  );
if (!report.passed) process.exitCode = 1;
