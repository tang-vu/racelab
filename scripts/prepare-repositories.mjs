import { readConfig } from "../src/config.mjs";
import { loadRepositories } from "../src/workloads/repository-engine.mjs";
const inputs = await loadRepositories(readConfig().dataDirectory, {
  fetchMissing: true,
});
console.log(
  `Verified ${Object.keys(inputs).length} pinned public repository files; no model requests.`,
);
