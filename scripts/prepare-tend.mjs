import { readConfig } from "../src/config.mjs";
import { loadTend } from "../src/workloads/tend-source.mjs";
const input = await loadTend(readConfig().dataDirectory, {
  fetchMissing: true,
});
console.log(
  JSON.stringify({
    repository: input.repository,
    commit: input.commit,
    blobSha: input.blobSha,
    bytes: input.inputBytes,
    sourceVerified: input.sourceVerified,
  }),
);
