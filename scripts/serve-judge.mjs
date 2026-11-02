// Dedicated keyless entry point. Never load .env.local or open an accounting ledger.
process.env.RACELAB_JUDGE_MODE = "1";
process.env.RACELAB_PUBLIC_ORIGIN ||= process.env.RENDER_EXTERNAL_URL ?? "";
process.env.HOST ||= process.env.RACELAB_PUBLIC_ORIGIN
  ? "0.0.0.0"
  : "127.0.0.1";
process.env.RACELAB_DATA_DIR ||= ".racelab/judge";
await import("../server.mjs");
