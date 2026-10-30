import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { frameFor, methodDiff } from "../public/tend-view.js";
const record = JSON.parse(
  await readFile(
    new URL("../public/recordings/tend-claims.json", import.meta.url),
    "utf8",
  ),
);
test("Process frames reveal only past exits, claims and accepted local completions", () => {
  const original = record.probes[0].run;
  const killed = original.trace.find(
    (event) => event.kind === "process-killed",
  );
  assert.equal(frameFor(original, 0).processes.A, undefined);
  assert.equal(
    frameFor(original, killed.step - 1).processes.A.status,
    "running",
  );
  assert.equal(
    frameFor(original, killed.step).processes.A.status,
    "terminated",
  );
  const update = original.trace.find(
    (event) => event.kind === "sql" && event.method === "run",
  );
  const commit = original.trace.find(
    (event) => event.kind === "transaction" && event.action === "commit",
  );
  assert.equal(frameFor(original, update.step).rows[0].status, "scheduled");
  assert.equal(frameFor(original, commit.step).rows[0].status, "claimed");
  const repaired = record.best.verification.cases.find(
    (item) => item.id === "expired-owner",
  ).run;
  const completions = repaired.trace.filter(
    (event) => event.kind === "completion",
  );
  assert.equal(frameFor(repaired, completions[0].step).receipts, 0);
  assert.equal(frameFor(repaired, completions[1].step).receipts, 1);
  assert.equal(frameFor(repaired, repaired.trace.length).verdict, "PASS");
  assert.equal(frameFor(original, Infinity).verdict, "FAIL");
  assert.equal(frameFor(null, 0), null);
});
test("Exported method diff applies cleanly to the exact pinned source", async (t) => {
  const source = await readFile(
    new URL(
      `../.racelab/sources/tend-${record.input.commit}.ts`,
      import.meta.url,
    ),
  ).catch(() => null);
  if (!source) return t.skip("Run npm run prepare:tend once.");
  assert.equal(
    createHash("sha1")
      .update(`blob ${source.length}\0`)
      .update(source)
      .digest("hex"),
    record.input.blobSha,
  );
  const directory = await mkdtemp(join(tmpdir(), "racelab-diff-"));
  try {
    await mkdir(join(directory, "packages/db/src"), { recursive: true });
    await writeFile(join(directory, "packages/db/src/store.ts"), source);
    const path = join(directory, "claim.diff");
    await writeFile(
      path,
      methodDiff(record.startingSource, record.best.source),
    );
    execFileSync("git", ["-C", directory, "apply", "--check", path], {
      stdio: "pipe",
    });
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  }
});
