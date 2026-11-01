// Guest TypeScript is stripped in Node, then executed inside QuickJS. Only a
// bounded SQL bridge to this run's disposable SQLite DB crosses the boundary.
import { getQuickJS } from "quickjs-emscripten";
import { compileClaim, compileLifecycle } from "./tend-source.mjs";
import { stripTypeScriptTypes } from "node:module";

const forbidden =
  /\b(?:attach|detach|pragma|drop|alter|create|delete|insert|replace|vacuum|with|union|join|load_extension|readfile|writefile|random|randomblob|sqlite_master|sqlite_schema)\b|--|\/\*|;/i;
function sqlAllowed(query) {
  if (typeof query !== "string" || query.length > 3000 || forbidden.test(query))
    throw new Error(
      "Only bounded SELECT/UPDATE statements on follow_ups are exposed.",
    );
  if (
    !/^\s*(?:SELECT\s+[\s\S]+?\s+FROM\s+follow_ups\b|UPDATE\s+follow_ups\s+SET\b)/i.test(
      query,
    )
  )
    throw new Error("This SQL statement is outside the workload adapter.");
  if (/\b(?:FROM|UPDATE)\s+(?!follow_ups\b)/i.test(query))
    throw new Error("Only the workload table is exposed.");
  if ((query.match(/\bfollow_ups\b(?!\.)/gi) ?? []).length !== 1)
    throw new Error("Only one bounded table reference is exposed.");
  const functions = new Set([
    "IN",
    "AND",
    "OR",
    "WHERE",
    "COUNT",
    "MIN",
    "MAX",
    "COALESCE",
    "DATETIME",
    "STRFTIME",
    "JULIANDAY",
    "CAST",
  ]);
  for (const match of query.matchAll(/\b([A-Za-z_][A-Za-z_0-9]*)\s*\(/g))
    if (!functions.has(match[1].toUpperCase()))
      throw new Error("SQL function is outside the bounded adapter.");
}

export async function executeClaim(
  database,
  {
    source,
    rowAdapter,
    at,
    lifecycle = false,
    operation = "claimNextDue",
    args = [],
  },
  onSql = () => {},
) {
  if (
    !["claimNextDue", "renewClaim", "completeClaim"].includes(operation) ||
    (!lifecycle && operation !== "claimNextDue")
  )
    throw new Error("Unknown adapter operation.");
  const compiled = lifecycle ? compileLifecycle(source) : compileClaim(source);
  const mapper = stripTypeScriptTypes(rowAdapter, { mode: "strip" });
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(16 * 1024 * 1024);
  runtime.setMaxStackSize(256 * 1024);
  const deadline = Date.now() + 1500;
  let interrupts = 0,
    operations = 0;
  runtime.setInterruptHandler(
    () => Date.now() > deadline || ++interrupts > 2000,
  );
  const vm = runtime.newContext();
  let transaction = false;
  const json = (value) =>
    vm.unwrapResult(vm.evalCode(`(${JSON.stringify(value ?? null)})`));
  const set = (name, callback) => {
    const fn = vm.newFunction(name, (...args) =>
      callback(...args.map((a) => vm.dump(a))),
    );
    vm.setProp(vm.global, name, fn);
    fn.dispose();
  };
  const rows = () =>
    database
      .prepare("SELECT * FROM follow_ups ORDER BY id")
      .all()
      .map((x) => ({ ...x }));
  try {
    set("__sql", (kind, query, args) => {
      if (++operations > 24)
        throw new Error("Claim exceeded the 24-statement cap.");
      if (
        !["get", "all", "run"].includes(kind) ||
        !Array.isArray(args) ||
        args.length > 20 ||
        JSON.stringify(args).length > 10_000
      )
        throw new Error("Invalid SQL bridge call.");
      sqlAllowed(query);
      if (/^\s*UPDATE\b/i.test(query) && !transaction)
        throw new Error("Claim writes require a transaction.");
      const before = rows(),
        statement = database.prepare(query);
      let value = statement[kind](...args);
      if (kind === "run") value = { changes: value.changes };
      onSql({
        kind: "sql",
        method: kind,
        sql: query,
        params: args,
        before,
        after: rows(),
        result: value ?? null,
      });
      return json(value);
    });
    set("__transaction", (kind) => {
      if (kind === "begin") {
        if (transaction)
          throw new Error("Nested transactions are unavailable.");
        database.exec("BEGIN");
        transaction = true;
      } else if (kind === "commit" && transaction) {
        database.exec("COMMIT");
        transaction = false;
      } else if (kind === "rollback" && transaction) {
        database.exec("ROLLBACK");
        transaction = false;
      } else throw new Error("Invalid transaction boundary.");
      onSql({ kind: "transaction", action: kind, rows: rows() });
      return vm.undefined;
    });
    const code = `
      const sql = __sql, tx = __transaction;
      delete globalThis.__sql; delete globalThis.__transaction;
      const database = Object.freeze({
        prepare(query) { return Object.freeze({get(...args){return sql('get',query,args)},all(...args){return sql('all',query,args)},run(...args){return sql('run',query,args)}}); },
        transaction(fn) { return (...args)=>{tx('begin');try{const result=fn(...args);if(result&&typeof result.then==='function')throw new Error('Claim transactions must be synchronous');tx('commit');return result;}catch(error){tx('rollback');throw error;}}; }
      });
      const NativeDate=Date;
      globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[${JSON.stringify(at)}]));}static now(){return new NativeDate(${JSON.stringify(at)}).getTime();}};
      Math.random=()=>{throw new Error('Randomness is not exposed');};
      const followUpSchema=Object.freeze({parse(row){
        if(!row||typeof row.id!=='string'||typeof row.incidentId!=='string'||!Number.isSafeInteger(row.attemptCount)||!['scheduled','retrying','claimed','completed','failed'].includes(row.status))throw new Error('Invalid follow-up row');
        return row;
      }});
      ${mapper}
      ${compiled}
      JSON.stringify(new CaseRepository(database)[${JSON.stringify(operation)}](...${JSON.stringify(args)}, new Date(${JSON.stringify(at)})));
    `;
    const result = vm.unwrapResult(vm.evalCode(code, "tend-claim.js"));
    try {
      const value = vm.dump(result);
      return typeof value === "string" ? JSON.parse(value) : null;
    } finally {
      result.dispose();
    }
  } finally {
    if (transaction) database.exec("ROLLBACK");
    vm.dispose();
    runtime.dispose();
  }
}
