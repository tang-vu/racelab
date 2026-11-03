import { bindings, defineConfig, defineContainer, exports } from "cf/config";
import { env as deployEnv } from "node:process";
import { readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };
const videoBytes: Record<string, number> = {};
function measureVideos(directory: string, prefix = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory())
      measureVideos(join(directory, entry.name), prefix + entry.name + "/");
    else if (entry.isFile() && entry.name.endsWith(".mp4"))
      videoBytes["/" + prefix + entry.name] = statSync(
        join(directory, entry.name),
      ).size;
  }
}
measureVideos(resolve(import.meta.dirname, "../../public"));

const runner = defineContainer({
  name: "racelab-judge-runner",
  image: deployEnv.RACELAB_CF_IMAGE
    ? { reference: deployEnv.RACELAB_CF_IMAGE }
    : { dockerfile: "../../Dockerfile", buildContext: "../.." },
  maxInstances: 1,
  instanceType: "basic",
  ssh: { enabled: false },
  observability: { enabled: true, logs: { enabled: true } },
});

export default defineConfig({
  worker: {
    name: "racelab-judge",
    compatibilityDate: "2026-10-23",
    entrypoint,
    workersDev: true,
    domains: ["racelab.tangvu.dev"],
    previewUrls: false,
    assets: { runWorkerFirst: true, htmlHandling: "none" },
    exports: {
      LiveRepair: exports.durableObject({ storage: "sqlite" }),
      RaceLabRunner: exports.durableObject({
        storage: "sqlite",
        container: runner,
      }),
    },
    env: {
      MODEL_API_KEY: bindings.secret(),
      VIDEO_BYTES: bindings.json(videoBytes),
      LIVE: bindings.durableObject({
        worker: "racelab-judge",
        exportName: "LiveRepair",
      }),
      PUBLIC_ORIGIN: bindings.text("https://racelab.tangvu.dev"),
      ASSETS: bindings.assets(),
      RUNNER: bindings.durableObject({
        worker: "racelab-judge",
        exportName: "RaceLabRunner",
      }),
    },
    observability: { enabled: true, redactQueryString: true },
  },
  containers: [runner],
});
