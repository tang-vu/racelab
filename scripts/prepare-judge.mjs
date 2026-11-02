process.env.RACELAB_JUDGE_MODE = "1";
process.env.RACELAB_DATA_DIR ||= ".racelab/judge";
const { readConfig } = await import("../src/config.mjs");
const { loadTend } = await import("../src/workloads/tend-source.mjs");
const bundle = await loadTend(readConfig().dataDirectory, {
  fetchMissing: true,
});
console.log(
  `Verified pinned ${bundle.repository} input at ${bundle.commit}. No model calls.`,
);
