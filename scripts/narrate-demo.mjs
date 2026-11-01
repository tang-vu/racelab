import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";

if (process.platform !== "win32")
  throw new Error(
    "Local narration uses the installed Windows System.Speech API.",
  );
const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, process.argv[2] ?? ".racelab/film-tend");
if (!output.startsWith(resolve(root) + sep))
  throw new Error("Narration output must stay inside this checkout.");
await mkdir(output, { recursive: true });
// Invoke the installed speech API; no execution-policy or system-setting changes.
const result = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Speech
    $raceStory = Get-Content -Encoding UTF8 -LiteralPath 'demo/racelab-storyboard.json' -Raw | ConvertFrom-Json
    $raceSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
      $raceSynth.SelectVoice('Microsoft Zira Desktop')
      $raceSynth.Rate = 0
      foreach ($raceScene in $raceStory.scenes) {
        if ($raceScene.id -notmatch '^\\d{2}-[a-z-]+$') { throw 'Invalid scene ID.' }
        $raceSynth.SetOutputToWaveFile((Join-Path $env:RACELAB_NARRATION_DIR ($raceScene.id + '.wav')))
        $raceSynth.Speak($raceScene.narration)
        $raceSynth.SetOutputToNull()
        Write-Output ('Narrated ' + $raceScene.id)
      }
    } finally { $raceSynth.Dispose() }
  `,
  ],
  {
    cwd: root,
    env: { ...process.env, RACELAB_NARRATION_DIR: output },
    stdio: "inherit",
    windowsHide: true,
  },
);
if (result.error) throw result.error;
if (result.status !== 0)
  throw new Error("The installed speech API could not generate narration.");
