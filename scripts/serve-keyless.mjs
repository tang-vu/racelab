import { fileURLToPath } from "node:url";
process.env.MODEL_API_KEY = "";
process.env.PORT = "4176";
process.env.HOST = "127.0.0.1";
process.env.RACELAB_PUBLIC_ORIGIN = "";
process.env.RACELAB_DEMO_ACCESS_CODE = "";
process.env.RACELAB_LEDGER_DIR = "";
process.env.RACELAB_DATA_DIR = fileURLToPath(
  new URL("../.racelab/keyless/", import.meta.url),
);
await import("../server.mjs");
