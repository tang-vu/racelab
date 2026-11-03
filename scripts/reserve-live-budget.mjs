import { randomUUID } from "node:crypto";
import { readConfig } from "../src/config.mjs";
import { openLedger } from "../src/budget.mjs";
import {
  LIVE_ALLOCATION,
  LIVE_CAP_MICROS,
} from "../deploy/cloudflare/src/live-policy.ts";

if (!process.argv.includes("--reserve"))
  throw new Error(
    "Use --reserve to encumber the existing project budget for public live repairs.",
  );
const config = readConfig(),
  ledger = await openLedger(config);
const allocation = await ledger.transaction((state) => {
  const existing = state.entries.find(
    (entry) => entry.allocation === LIVE_ALLOCATION,
  );
  if (existing) {
    if (
      existing.status !== "reserved" ||
      existing.reservedMicros !== LIVE_CAP_MICROS
    )
      throw new Error(
        "The existing live allocation is not an active matching reservation.",
      );
    return {
      label: LIVE_ALLOCATION,
      capUsd: LIVE_CAP_MICROS / 1e6,
      reused: true,
    };
  }
  if (state.blocked)
    throw new Error(
      "The existing budget is blocked; no live allocation was made.",
    );
  const { spent, held } = ledger.totals(state);
  const cap = Math.ceil(
    Math.min(config.phase, config.total - config.reserve) * 1e6,
  );
  if (spent + held + LIVE_CAP_MICROS > cap)
    throw new Error(
      "The live allocation would exceed the existing project budget.",
    );
  state.entries.push({
    id: randomUUID(),
    kind: "public-live-allocation",
    allocation: LIVE_ALLOCATION,
    status: "reserved",
    reservedMicros: LIVE_CAP_MICROS,
    chargedMicros: 0,
    createdAt: new Date().toISOString(),
    provider: "Meta Model API",
    model: "Muse Spark 1.3",
  });
  return {
    label: LIVE_ALLOCATION,
    capUsd: LIVE_CAP_MICROS / 1e6,
    reused: false,
  };
});
console.log(
  JSON.stringify({
    ...allocation,
    scope:
      "An allocation is held in the existing local ledger. No key or historical ledger is exported.",
  }),
);
