import { readConfig } from "../src/config.mjs";
import { openLedger } from "../src/budget.mjs";

// No credential values, private ledger records or network requests.
const config = readConfig();
const ledger = await openLedger(config);
console.log(
  JSON.stringify(
    {
      keyConfigured: Boolean(config.key),
      model: config.model,
      budget: await ledger.summary(),
      networkRequestsMadeByThisCheck: 0,
    },
    null,
    2,
  ),
);
