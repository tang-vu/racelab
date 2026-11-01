import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { getQuickJS } from "quickjs-emscripten";
import { sourceHash } from "./tend-source.mjs";

export async function loadRepositories(
  directory,
  { fetchMissing = false } = {},
) {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../demo/repository-inputs.json", import.meta.url),
    ),
  );
  const result = {};
  for (const item of manifest) {
    const path = join(directory, "sources", item.cacheName);
    let bytes;
    try {
      bytes = await readFile(path);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      if (!fetchMissing)
        throw new Error(
          "Pinned repository input missing. Run npm run prepare:repositories.",
        );
      const r = await fetch(
        `https://raw.githubusercontent.com/${item.repository}/${item.commit}/${item.path}`,
        { redirect: "error", signal: AbortSignal.timeout(20000) },
      );
      if (!r.ok) throw new Error(`Pinned input download failed (${r.status}).`);
      bytes = Buffer.from(await r.arrayBuffer());
    }
    if (
      bytes.length > 50000 ||
      createHash("sha1")
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest("hex") !== item.blobSha
    )
      throw new Error("Repository input integrity failed.");
    if (fetchMissing) {
      await mkdir(join(directory, "sources"), { recursive: true });
      await writeFile(path, bytes, { flag: "wx" }).catch((e) => {
        if (e.code !== "EEXIST") throw e;
      });
    }
    result[item.cacheName] = {
      ...item,
      source: bytes.toString("utf8"),
      sourceHash: sourceHash(bytes),
    };
  }
  return result;
}
async function pure(code) {
  if (code.length > 60000)
    throw new Error("Pure adapter source exceeded its cap.");
  const q = await getQuickJS(),
    runtime = q.newRuntime();
  runtime.setMemoryLimit(16 * 1024 * 1024);
  runtime.setMaxStackSize(256 * 1024);
  const deadline = Date.now() + 1500;
  let ticks = 0;
  runtime.setInterruptHandler(() => Date.now() > deadline || ++ticks > 2000);
  const vm = runtime.newContext();
  try {
    const handle = vm.unwrapResult(vm.evalCode(code, "owned-repository.js"));
    try {
      return JSON.parse(vm.dump(handle));
    } finally {
      handle.dispose();
    }
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}
const strip = (source) =>
  stripTypeScriptTypes(
    source
      .replace(/^import[\s\S]*?;\s*$/gm, "")
      .replace(/\bexport\s+(?=(?:function|const|interface)\b)/g, ""),
    { mode: "strip" },
  );
export function airulesSource(inputs) {
  const text = inputs["airules-diff.ts"].source,
    start = text.indexOf("export function diffSync("),
    end = text.indexOf("\nexport function formatDiffTable(");
  if (start < 0 || end < start)
    throw new Error("Pinned airules extraction boundary failed.");
  return text.slice(start, end).trimEnd();
}
export const AIRULES_CONTRACT =
  "diffSync(profile,config,cwd,targetTool?) uses supplied generateAll and read-only file facade. Preserve statuses added/modified/unchanged/deleted and tools/path behavior. For modified files, linesAdded and linesRemoved must count the minimum line insertions/deletions (LCS, replacement=one removal plus one addition), including equal-length replacements. split('\\n') defines lines, including empty/trailing entries. Existing absent generated files are added, known omitted files deleted, same contents unchanged. This precise edit-count contract is added by RaceLab, not claimed as an upstream guarantee. No writes or network are exposed.";
export const AIRULES_CASES = [
  { id: "unchanged", split: "development", before: "a\nb", after: "a\nb" },
  { id: "added", split: "development", before: null, after: "a\nb" },
  { id: "replacement", split: "development", before: "a\nb", after: "a\nc" },
  { id: "middle-insert", split: "held-out", before: "a\nc", after: "a\nb\nc" },
  { id: "middle-delete", split: "held-out", before: "a\nb\nc", after: "a\nc" },
  { id: "reordered", split: "held-out", before: "a\nb\na", after: "b\na\nb" },
  { id: "trailing-empty", split: "held-out", before: "", after: "\n" },
  {
    id: "omitted-known",
    split: "held-out",
    before: "manual\nnotes",
    after: null,
  },
];
function expectedDiff(before, after) {
  if (after === null)
    return {
      status: "deleted",
      linesAdded: 0,
      linesRemoved: before.split("\n").length,
    };
  if (before === null)
    return {
      status: "added",
      linesAdded: after.split("\n").length,
      linesRemoved: 0,
    };
  if (before === after)
    return { status: "unchanged", linesAdded: 0, linesRemoved: 0 };
  const a = before.split("\n"),
    b = after.split("\n"),
    dp = Array.from({ length: a.length + 1 }, () =>
      Array(b.length + 1).fill(0),
    );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return {
    status: "modified",
    linesAdded: b.length - dp[a.length][b.length],
    linesRemoved: a.length - dp[a.length][b.length],
  };
}
export async function runAirules(source, id) {
  const c = AIRULES_CASES.find((c) => c.id === id);
  if (!c) throw new Error("Unknown airules condition.");
  if (
    typeof source !== "string" ||
    source.length > 18000 ||
    !/(?:export\s+)?function\s+diffSync\s*\(/.test(source)
  )
    throw new Error("Provide diffSync, up to 18,000 characters.");
  const fixture = {
    files: c.before === null ? {} : { "/fixture/CLAUDE.md": c.before },
    generated:
      c.after === null
        ? []
        : [{ path: "CLAUDE.md", tool: "claude", content: c.after }],
  };
  const expected = {
    file: "CLAUDE.md",
    tool: c.after === null ? "unknown" : "claude",
    ...expectedDiff(c.before, c.after),
  };
  let actual = null,
    error = null;
  try {
    const results = await pure(
      `const fixture=${JSON.stringify(fixture)};const generateAll=()=>fixture.generated;const join=(...s)=>s.join('/');const existsSync=p=>Object.prototype.hasOwnProperty.call(fixture.files,p);const readFileSync=p=>{if(!existsSync(p))throw Error('Missing virtual file');return fixture.files[p];};${strip(source)}\nJSON.stringify(diffSync({}, {}, '/fixture'));`,
    );
    actual = results;
  } catch (e) {
    error = String(e.message ?? e).slice(0, 400);
  }
  const checks = [
    {
      name: "Read-only virtual file diff matches independent line-edit contract",
      actual,
      expected: [expected],
      passed: JSON.stringify(actual) === JSON.stringify([expected]),
    },
  ];
  // Property ordering is not part of the contract.
  checks[0].passed =
    Array.isArray(actual) &&
    actual.length === 1 &&
    Object.entries(expected).every(([k, v]) => actual[0]?.[k] === v);
  return {
    engine: "airules-readonly-diff-v1",
    condition: id,
    sourceHash: sourceHash(source),
    status: error ? "error" : "completed",
    error,
    verdict: { passed: !error && checks.every((c) => c.passed), checks },
  };
}
export async function verifyAirules(source, split = "all") {
  const cases = [];
  for (const c of AIRULES_CASES.filter(
    (c) => split === "all" || c.split === split,
  )) {
    const run = await runAirules(source, c.id);
    cases.push({ id: c.id, split: c.split, passed: run.verdict.passed, run });
  }
  return { passed: cases.every((c) => c.passed), tested: cases.length, cases };
}

export async function validateOpenMusic(inputs) {
  const project = inputs["openmusic-project-store.ts"],
    workspace = inputs["openmusic-project-workspace.ts"];
  const value = await pure(`
 const NativeDate=Date;Date.now=()=>1793534400000;Math.random=()=>0.42;
 let setProject;
 const create=()=>initializer=>{let state;const set=update=>{state={...state,...(typeof update==='function'?update(state):update)};};setProject=set;const get=()=>state;state=initializer(set,get);return{getState:get};};const persist=initializer=>initializer;
 ${strip(project.source)}
 let lyrics={content:'draft A',setContent(v){lyrics.content=v;}};
 let beats={bpm:137,pattern:[[true,false]],setBpm(v){beats.bpm=v;},setPattern(v){beats.pattern=JSON.parse(JSON.stringify(v));}};
 const useLyricsStore={getState:()=>lyrics},useBeatsStore={getState:()=>beats};
 ${strip(workspace.source)}
 setProject({projects:[{id:'a',name:'A',createdAt:1,updatedAt:1,data:{lyrics:'old A',beats:{bpm:120,pattern:[[false]]}}},{id:'b',name:'B',createdAt:2,updatedAt:2,data:{lyrics:'saved B',beats:{bpm:91,pattern:[[false,true]]}}}],currentProjectId:'a'});
 const checks=[];const check=(name,actual,expected)=>checks.push({name,actual,expected,passed:JSON.stringify(actual)===JSON.stringify(expected)});
 const before=JSON.stringify(useProjectStore.getState());
 check('Unknown project rejected',switchProjectWorkspace('missing'),false);
 check('Stale selection preserves state',JSON.stringify(useProjectStore.getState()),before);
 check('Selecting current project succeeds',switchProjectWorkspace('a'),true);
 check('Selecting current project preserves unsaved draft',lyrics.content,'draft A');
 check('Existing project switch succeeds',switchProjectWorkspace('b'),true);
 check('Outgoing lyrics saved',useProjectStore.getState().projects[0].data.lyrics,'draft A');
 check('Outgoing beat state saved',useProjectStore.getState().projects[0].data.beats,{bpm:137,pattern:[[true,false]]});
 check('Incoming project loaded',[lyrics.content,beats.bpm,beats.pattern],['saved B',91,[[false,true]]]);
 lyrics.content='new B';beats.bpm=155;
 check('Immediate second switch succeeds',switchProjectWorkspace('a'),true);
 check('Latest outgoing draft saved',useProjectStore.getState().projects[1].data.lyrics,'new B');
 check('Latest outgoing BPM saved',useProjectStore.getState().projects[1].data.beats.bpm,155);
 check('Original draft restored',lyrics.content,'draft A');
 useProjectStore.getState().deleteProject('b');
 check('Deleted target is stale',switchProjectWorkspace('b'),false);
 check('Active project unchanged after stale target',useProjectStore.getState().currentProjectId,'a');
 JSON.stringify(checks);`);
  return {
    engine: "openmusic-workspace-memory-v1",
    inputs: [project, workspace].map(({ source, ...pin }) => pin),
    passed: value.every((c) => c.passed),
    tested: value.length,
    checks: value,
    scope:
      "Unchanged pinned project store and switchProjectWorkspace, TypeScript stripped in QuickJS. Minimal in-memory Zustand create/persist and lyrics/beats facades; no browser persistence, React, audio, Tauri, OAuth or AI services. Synchronous repeated switching is a healthy control, not an async race or human usability trial.",
  };
}
