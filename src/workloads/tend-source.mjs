import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stripTypeScriptTypes } from "node:module";

export const TEND = Object.freeze({
  id: "tend-claims",
  repository: "tang-vu/tend",
  commit: "fe6975ced2c2004e3bb8f91e97c07db878596a06",
  path: "packages/db/src/store.ts",
  blobSha: "6ffed74e343f919d8fe249a3d2c182d8b7870dbd",
  license: "MIT",
  leaseMs: 60_000,
  adapter: "tend-sqlite-claim-v1",
});
export const sourceHash = (source) =>
  createHash("sha256").update(source).digest("hex");
export const sourceUrl = `https://github.com/${TEND.repository}/blob/${TEND.commit}/${TEND.path}#L1017`;
const rawUrl = `https://raw.githubusercontent.com/${TEND.repository}/${TEND.commit}/${TEND.path}`;

export function extractTend(bytes) {
  const blob = createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
  if (blob !== TEND.blobSha)
    throw new Error(
      "TEND source integrity check failed. The pinned input was not executed.",
    );
  const text = bytes.toString("utf8");
  const start = text.indexOf("  claimNextDue(now = new Date())");
  const end = text.indexOf("\n  completeFollowUp(", start);
  const mapStart = text.indexOf("function followUpFromRow(");
  const mapEnd = text.indexOf("\nfunction auditFromRow(", mapStart);
  if (start < 0 || end < start || mapStart < 0 || mapEnd < mapStart)
    throw new Error("The pinned TEND method boundary does not match.");
  const source = text.slice(start, end).trimEnd();
  return {
    ...TEND,
    sourceUrl,
    source,
    sourceHash: sourceHash(source),
    rowAdapter: text.slice(mapStart, mapEnd),
    inputBytes: bytes.length,
    sourceVerified: true,
  };
}

export async function loadTend(directory, { fetchMissing = false } = {}) {
  const path = join(directory, "sources", `tend-${TEND.commit}.ts`);
  let bytes;
  try {
    bytes = await readFile(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (!fetchMissing)
      throw new Error(
        "Pinned TEND input is missing. Run npm run prepare:tend once with network access.",
      );
    const response = await fetch(rawUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new Error(
        `Could not download the pinned TEND input (HTTP ${response.status}).`,
      );
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 150_000)
      throw new Error("Pinned source exceeded its size limit.");
    extractTend(bytes);
    await mkdir(join(directory, "sources"), { recursive: true });
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 }).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
  }
  return extractTend(bytes);
}

export function compileClaim(source) {
  if (
    typeof source !== "string" ||
    !source.trim() ||
    source.length > 12_000 ||
    !/^\s*claimNextDue\s*\(/.test(source)
  )
    throw new Error(
      "Provide a TypeScript claimNextDue method, up to 12,000 characters.",
    );
  return stripTypeScriptTypes(
    `class CaseRepository { constructor(database) { this.database = database; }\n${source}\n}`,
    { mode: "strip" },
  );
}
