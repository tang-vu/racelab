import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, join, relative } from "node:path";
import { createInterface } from "node:readline";

// Explicit media-only API operation. This never imports the project's Meta key
// or ledger. The caller supplies its separate MiMo key through stdin or env.
const live = process.argv.includes("--live");
const option = (name, fallback) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3) || fallback;
const story = JSON.parse(
  await readFile(option("story", "demo/racelab-film-v4.json"), "utf8"),
);
const out = resolve(option("out", ".racelab/film-mimo"));
await mkdir(out, { recursive: true });
const bin = process.env.RACELAB_FFMPEG_DIR || "D:/Apps/FFmpeg-9.0.2/bin";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exists = async (file) =>
  access(file).then(
    () => true,
    () => false,
  );
const run = (name, args) => {
  const r = spawnSync(join(bin, `${name}.exe`), args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0)
    throw Error(`${name} failed: ${(r.stderr || "").slice(-1000)}`);
  return r.stdout;
};
let key = process.env.MIMO_API_KEY || "";
if (live && !key) {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  console.log("Ready for the media API key on stdin (input is not echoed).");
  if (process.stdin.isTTY) {
    key = await new Promise((done) => {
      let value = "";
      const receive = (chunk) => {
        value += chunk.toString();
        if (/[\r\n]/.test(value)) {
          process.stdin.off("data", receive);
          done(value.split(/[\r\n]/)[0]);
        }
      };
      process.stdin.on("data", receive);
    });
    process.stdin.setRawMode(false);
    process.stdin.pause();
  } else {
    const lines = createInterface({ input: process.stdin, terminal: false });
    key = await new Promise((done) => lines.once("line", done));
    lines.close();
  }
}
const ledgerPath = join(out, "requests.json");
const ledger = (await exists(ledgerPath))
  ? JSON.parse(await readFile(ledgerPath))
  : { requests: [] };
if (ledger.requests.some((r) => r.state === "pending"))
  throw Error("Uncertain media request requires review; no automatic retry.");
const save = () =>
  writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
async function call(label, body) {
  if (!live || !key)
    throw Error(
      `Missing retained ${label}; use explicit --live with a separate MiMo key.`,
    );
  if (ledger.requests.length >= 100)
    throw Error("Media request ceiling reached.");
  const item = {
    label,
    model: body.model,
    startedAt: new Date().toISOString(),
    state: "pending",
  };
  ledger.requests.push(item);
  await save();
  let response;
  try {
    response = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    throw Error(
      `${label}: transport failed; retained pending reservation, no retry.`,
    );
  }
  if (!response.ok) {
    item.state = "http-error";
    item.status = response.status;
    await save();
    throw Error(
      `${label}: media API returned HTTP ${response.status}; no retry.`,
    );
  }
  const data = await response.json();
  item.state = "received";
  item.usage = data.usage;
  item.finishedAt = new Date().toISOString();
  await save();
  return data;
}
const report = {
  format: "racelab-speech-v1",
  provider: "Xiaomi MiMo",
  endpoint: "https://api.xiaomimimo.com/v1/chat/completions",
  ttsModel: story.ttsModel,
  asrModel: story.asrModel,
  voice: story.voice,
  voiceType: "built-in generic English voice; no cloning",
  timingMethod:
    "Each authored speech beat is synthesized and transcribed separately. Caption times use the actual audio clip boundaries and silence trimming, not provider word timestamps.",
  scenes: [],
};
if (option("asr-audio", "")) {
  const file = resolve(option("asr-audio", ""));
  const bytes = await readFile(file);
  if (bytes.length > 7_000_000 || !file.endsWith(".mp3"))
    throw Error("Final media review requires an MP3 under 7 MB.");
  const output = join(out, "final-asr.json");
  if (await exists(output))
    throw Error("Final ASR is retained already; do not overwrite.");
  const data = await call("asr:final-mix", {
    model: story.asrModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: `data:audio/mpeg;base64,${bytes.toString("base64")}`,
            },
          },
        ],
      },
    ],
    asr_options: { language: "en" },
  });
  const transcript = data.choices?.[0]?.message?.content;
  if (!transcript?.trim()) throw Error("Final mix ASR returned no transcript.");
  await writeFile(
    output,
    JSON.stringify(
      {
        format: "racelab-final-mix-asr-v1",
        model: story.asrModel,
        audioSha256: sha(bytes),
        transcript,
      },
      null,
      2,
    ) + "\n",
  );
  key = "";
  console.log(
    `Final mixed-audio ASR retained: ${transcript.split(/\s+/).length} words.`,
  );
  process.exit(0);
}
for (const scene of story.scenes) {
  const row = { id: scene.id, beats: [] };
  for (const [index, text] of scene.beats.entries()) {
    const id = `${scene.id}-${index + 1}`;
    const raw = join(out, `${id}-raw.wav`),
      trimmed = join(out, `${id}.wav`),
      asr = join(out, `${id}-asr.json`);
    const textProof = join(out, `${id}-text.sha256`);
    if (await exists(raw)) {
      if ((await readFile(textProof, "utf8")).trim() !== sha(text))
        throw Error(`Retained text changed: ${id}`);
    } else {
      const data = await call(`tts:${id}`, {
        model: story.ttsModel,
        messages: [
          ...(story.style ? [{ role: "user", content: story.style }] : []),
          { role: "assistant", content: text },
        ],
        audio: { format: "wav", voice: story.voice },
      });
      const encoded = data.choices?.[0]?.message?.audio?.data;
      if (!encoded) throw Error(`${id}: no synthesized audio returned.`);
      await writeFile(raw, Buffer.from(encoded, "base64"));
      await writeFile(textProof, sha(text) + "\n");
    }
    run("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      raw,
      "-af",
      "silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08,areverse",
      "-ar",
      "24000",
      "-ac",
      "1",
      trimmed,
    ]);
    const meta = JSON.parse(
      run("ffprobe", ["-v", "error", "-show_format", "-of", "json", trimmed]),
    );
    const seconds = Number(meta.format.duration),
      bytes = await readFile(trimmed);
    if (!(seconds > 0.3 && seconds < 20))
      throw Error(`${id}: unexpected speech duration.`);
    if (!(await exists(asr))) {
      const data = await call(`asr:${id}`, {
        model: story.asrModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: `data:audio/wav;base64,${bytes.toString("base64")}`,
                },
              },
            ],
          },
        ],
        asr_options: { language: "en" },
      });
      await writeFile(
        asr,
        JSON.stringify(
          {
            audioSha256: sha(bytes),
            transcript: data.choices?.[0]?.message?.content || "",
          },
          null,
          2,
        ) + "\n",
      );
    }
    const recognition = JSON.parse(await readFile(asr));
    if (
      recognition.audioSha256 !== sha(bytes) ||
      !recognition.transcript.trim()
    )
      throw Error(`${id}: ASR artifact is missing or mismatched.`);
    row.beats.push({
      id,
      text,
      asrTranscript: recognition.transcript,
      seconds,
      audioSha256: sha(bytes),
      localFile: relative(process.cwd(), trimmed).replaceAll("\\", "/"),
    });
    console.log(`${id}: TTS + ASR retained, ${seconds.toFixed(2)}s`);
  }
  report.scenes.push(row);
}
key = "";
await writeFile(
  join(out, "speech.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    scenes: report.scenes.length,
    beats: report.scenes.reduce((n, s) => n + s.beats.length, 0),
    apiRequests: ledger.requests.length,
    audioSeconds: report.scenes
      .flatMap((s) => s.beats)
      .reduce((n, b) => n + b.seconds, 0),
  }),
);
