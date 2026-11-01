import { readConfig } from "../src/config.mjs";
import {
  loadRepositories,
  airulesSource,
  verifyAirules,
  validateOpenMusic,
} from "../src/workloads/repository-engine.mjs";
import { writeFile } from "node:fs/promises";
const inputs = await loadRepositories(readConfig().dataDirectory),
  source = airulesSource(inputs);
const report = {
  version: 1,
  createdAt: new Date().toISOString(),
  inputs: Object.values(inputs).map(({ source, ...pin }) => pin),
  openmusic: await validateOpenMusic(inputs),
  airules: {
    contract:
      "RaceLab-added minimum line-edit counts, not an upstream guarantee",
    verification: await verifyAirules(source),
  },
};
if (process.argv.includes("--record"))
  await writeFile(
    new URL("../public/recordings/repository-validation.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
console.log(
  JSON.stringify(
    {
      openmusic: {
        passed: report.openmusic.passed,
        checks: report.openmusic.tested,
      },
      airules: {
        passed: report.airules.verification.passed,
        conditions: report.airules.verification.tested,
        failures: report.airules.verification.cases
          .filter((c) => !c.passed)
          .map((c) => c.id),
      },
      modelRequests: 0,
    },
    null,
    2,
  ),
);
