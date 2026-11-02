"""Render the editorial film from verified UI captures and ASR-checked MiMo beats.

No network calls. Intermediate WAVs, graphics and encodes stay in .racelab/.
The public movie is promoted only after dimensions, tracks and duration verify.
"""
import array
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import textwrap
import wave

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--speech", default=".racelab/film-mimo/selected-speech.json")
parser.add_argument("--preview", action="store_true")
options = parser.parse_args()
WORK = ROOT / ".racelab/film-mimo"
OUT = WORK / "render-v4"
OUT.mkdir(parents=True, exist_ok=True)
BIN = Path(os.environ.get("RACELAB_FFMPEG_DIR", "D:/Apps/FFmpeg-9.0.2/bin"))
STORY = json.loads((ROOT / "demo/racelab-film-v4.json").read_text(encoding="utf8"))
SPEECH = json.loads((ROOT / options.speech).read_text(encoding="utf8"))
SOURCES = json.loads((ROOT / "docs/film-shots/sources.json").read_text(encoding="utf8"))


def run(name, args):
    result = subprocess.run([str(BIN / (name + ".exe")), *map(str, args)], capture_output=True, text=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if result.returncode:
        raise RuntimeError(result.stderr[-2500:])
    return result.stdout


def probe(path, count=False):
    return json.loads(run("ffprobe", ["-v", "error", *(["-count_frames"] if count else []), "-show_streams", "-show_format", "-of", "json", path]))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def font(size, bold=False, mono=False):
    name = "consola.ttf" if mono else "segoeuib.ttf" if bold else "segoeuil.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def wrapped(draw, text, face, width):
    lines = []
    for paragraph in text.split("\n"):
        line = ""
        for word in paragraph.split():
            candidate = (line + " " + word).strip()
            if line and draw.textlength(candidate, font=face) > width:
                lines.append(line)
                line = word
            else:
                line = candidate
        lines.append(line)
    return lines


def frame(scene, index):
    image = Image.new("RGB", (1920, 1080), "#101210")
    draw = ImageDraw.Draw(image)
    accent = scene["accent"]
    for x in range(0, 1920, 96):
        draw.line((x, 0, x, 920), fill="#171b17", width=1)
    draw.rectangle((0, 925, 1920, 1080), fill="#101210")
    draw.text((80, 32), "racelab*", font=font(54, True), fill="#f4f6ef")
    draw.text((1460, 53), "TANG VU  /  META HACKATHON", font=font(17, mono=True), fill="#a4aba2")
    draw.line((80, 111, 1840, 111), fill="#343b31", width=1)
    draw.text((80, 148), scene["eyebrow"], font=font(17, mono=True), fill=accent)
    heading = wrapped(draw, scene["heading"], font(62), 490)
    for i, line in enumerate(heading):
        draw.text((76, 205 + 76 * i), line, font=font(62), fill="#f4f6ef")
    metric_size = 62 if len(scene["metric"]) < 12 else 47
    draw.text((78, 579), scene["metric"], font=font(metric_size, True), fill=accent)
    draw.rectangle((82, 679, 562, 682), fill=accent)
    for i, line in enumerate(wrapped(draw, scene["metricLabel"], font(23), 475)):
        draw.text((80, 706 + i * 32), line, font=font(23), fill="#c5cdc0")
    labels = [
        "NEW: RACELAB DURING THIS EVENT\nINPUTS: TEND + EARLIER EVENT INFRASTRUCTURE",
        "PINNED MIT METHOD / BOUNDED ADAPTER\nREAL DISPOSABLE SQLITE / NO EXTERNAL DELIVERY",
        "ACTUAL COMMITTED SNAPSHOTS\nCONTROLLED CLOCK / FINITE PROCESS SEQUENCES",
        "PUBLIC HYPOTHESIS → EXECUTED FEEDBACK\nSOURCE PATCH → INDEPENDENT CHECKS",
        "CANDIDATE-INTERNAL OWNERSHIP GUARDS\nAUTHORED CONTROL CREDITED SEPARATELY",
        "BOUNDED SOURCE ADAPTERS\nNO WHOLE-APP OR HUMAN-USABILITY CLAIM",
        "7 FIRST-TIME ARMS IN POST-HOC CONTINUATION\nSMALL CORRELATED COLLECTION / NO GENERAL SUPERIORITY",
        "GITHUB.COM/TANG-VU/RACELAB\nNARRATION & CAPTION PREPARATION: XIAOMI MIMO",
    ]
    for i, line in enumerate(labels[index].split("\n")):
        draw.text((80, 829 + i * 27), line, font=font(14, mono=True), fill="#a4aba2")
    draw.rounded_rectangle((650, 149, 1850, 855), radius=18, fill="#f7f8f4", outline="#46503f", width=2)
    draw.text((674, 123), "ACTUAL APPLICATION  /  EDITORIAL CROP", font=font(14, mono=True), fill="#b1b9ad")
    draw.text((80, 901), f"{index+1:02d} / 08", font=font(16, mono=True), fill=accent)
    for n in range(8):
        x = 254 + n * 197
        draw.rectangle((x, 914, x + 177, 917), fill=accent if n <= index else "#30382d")
    name = OUT / f"{scene['id']}-layout.png"
    image.save(name)
    return name


def stamp(seconds):
    value = round(seconds * 1000)
    return f"{value//3600000:02d}:{value//60000%60:02d}:{value//1000%60:02d},{value%1000:03d}"


assert sum(s["seconds"] for s in STORY["scenes"]) == 180
assert len(STORY["scenes"]) == 8
assert SOURCES["paidAttempts"] == 0 and SOURCES["passed"] and not SOURCES["errors"]
assert SPEECH["voice"] == STORY["voice"] and SPEECH["asrModel"] == "mimo-v2.5-asr"
if options.preview:
    for index, scene in enumerate(STORY["scenes"]):
        frame(scene, index)
    print("Editorial frame layouts rendered for visual review.")
    raise SystemExit(0)
captions, manifest, offset = [], [], 0.0
# All coordinates refer to retained 1440x900 UI captures; values are never edited.
rectangles = [
    (650, 430, 720, 335), (620, 570, 72, 238),
    (650, 600, 720, 240), (1250, 700, 72, 125),
    (1240, 660, 72, 170), (1240, 710, 72, 125),
    (1240, 650, 72, 125), (650, 570, 720, 320),
]
for index, scene in enumerate(STORY["scenes"]):
    source = ROOT / "docs/film-shots" / scene["source"]
    origin = SOURCES["sources"][scene["id"]]
    assert sha(source) == origin["sha256"], f"Changed source: {source.name}"
    speech = SPEECH["scenes"][index]
    assert speech["id"] == scene["id"]
    assert [b["text"] for b in speech["beats"]] == scene["beats"]
    seconds = scene["seconds"]
    total = sum(b["seconds"] for b in speech["beats"])
    tempo = max(1.0, total / (seconds - 1.4 - .18 * (len(speech["beats"]) - 1)))
    if tempo > 1.16:
        raise RuntimeError(f"Speech too long: {scene['id']}, {total:.2f}s. Revise the selected media.")
    voice_samples = array.array("h", [0] * round(0.55 * 24000))
    for number, beat in enumerate(speech["beats"]):
        audio = ROOT / beat["localFile"]
        assert sha(audio) == beat["audioSha256"] and beat["asrTranscript"].strip()
        processed = OUT / f"{beat['id']}-mix.wav"
        run("ffmpeg", ["-v", "error", "-y", "-i", audio, "-af", f"atempo={tempo:.8f},loudnorm=I=-17:TP=-2:LRA=8", "-ar", "24000", "-ac", "1", processed])
        with wave.open(str(processed), "rb") as file:
            assert file.getframerate() == 24000 and file.getsampwidth() == 2
            samples = array.array("h", file.readframes(file.getnframes()))
        start = len(voice_samples) / 24000
        voice_samples.extend(samples)
        end = len(voice_samples) / 24000
        # Whole speech-beat bounds are measured. No fabricated word timestamps.
        captions.append((offset + start, offset + end, beat["text"]))
        beat["captionStartSeconds"] = offset + start
        beat["captionEndSeconds"] = offset + end
        if number < len(speech["beats"]) - 1:
            voice_samples.extend([0] * round(.18 * 24000))
    assert len(voice_samples) / 24000 <= seconds - .3
    voice_samples.extend([0] * (round(seconds * 24000) - len(voice_samples)))
    narration = OUT / f"{scene['id']}.wav"
    with wave.open(str(narration), "wb") as file:
        file.setnchannels(1); file.setsampwidth(2); file.setframerate(24000); file.writeframes(voice_samples.tobytes())
    layout = frame(scene, index)
    width, height, x, y = rectangles[index]
    filters = (
        f"[1:v]crop={width}:{height}:{x}:{y},"
        "scale=1176:682:force_original_aspect_ratio=decrease:flags=lanczos,"
        "pad=1176:682:(ow-iw)/2:(oh-ih)/2:color=0xf7f8f4,setsar=1,fps=30,"
        "tpad=stop_mode=clone:stop_duration=2[ui];"
        "[0:v][ui]overlay=662:161:shortest=1,"
        f"fade=t=in:st=0:d=0.22,fade=t=out:st={seconds-.22}:d=0.22,format=yuv420p[v]"
    )
    video = OUT / f"{scene['id']}.mp4"
    args = ["-v", "error", "-y", "-loop", "1", "-framerate", "30", "-i", layout]
    if scene["kind"] == "ui":
        args += ["-loop", "1", "-framerate", "30"]
    args += ["-i", source, "-i", narration, "-filter_complex", filters, "-map", "[v]", "-map", "2:a:0", "-t", seconds, "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", video]
    run("ffmpeg", args)
    info = probe(source, scene["kind"] == "browser")
    stream = next(s for s in info["streams"] if s["codec_type"] == "video")
    manifest.append({"id": scene["id"], "seconds": seconds, "source": scene["source"], "sourceType": origin["type"], "sourceSha256": sha(source), "narrationSha256": sha(narration), "sourceFrames": int(stream.get("nb_read_frames", 1)) if scene["kind"] == "browser" else 1, "sourceFrameRate": stream["avg_frame_rate"], "narrationSeconds": total, "tempo": tempo, "editorialCrop": [width, height, x, y], "layoutSha256": sha(layout)})
    offset += seconds
    print(f"Rendered {scene['id']}: {total:.1f}s speech, tempo {tempo:.3f}", flush=True)

sample_rate = 24000
# Original quiet electronic bed, synthesized from elementary oscillators.
bed = array.array("h")
for sample in range(180 * sample_rate):
    t = sample / sample_rate
    value = sum(math.sin(2*math.pi*hz*t) * (.5+.5*math.cos(2*math.pi*(t/8+k/4)))**2 * .0018 for k,hz in enumerate([110,164.8138,220,261.6256]))
    value += math.sin(2*math.pi*55*t) * math.exp(-((t % (60/92))/.028)) * .004
    value *= min(t/3,1) * min((180-t)/3,1)
    bed.append(round(max(-1,min(1,value))*32767))
bed_file = OUT / "original-sound-bed.wav"
with wave.open(str(bed_file), "wb") as file:
    file.setnchannels(1); file.setsampwidth(2); file.setframerate(sample_rate); file.writeframes(bed.tobytes())
srt = "\n".join(f"{i+1}\n{stamp(start)} --> {stamp(end)}\n{textwrap.fill(text, width=72)}\n" for i, (start, end, text) in enumerate(captions))
(OUT / "racelab-demo.srt").write_text(srt, encoding="utf8")
concat = OUT / "movie.ffconcat"
concat.write_text("\n".join(f"file '{s['id']}.mp4'" for s in STORY["scenes"]), encoding="utf8")
movie = OUT / "racelab-demo.mp4"
disclosures = ["Actual Edge interaction clips and stills with editorial crops, original graphic framing and synthesized sound bed; preparation omitted", "Recorded public evidence; keyless local workbench independently recomputes source", "Generic Xiaomi MiMo TTS Mia voice, no voice cloning; separate MiMo ASR checks; captions use measured speech-beat boundaries rather than provider word timestamps", "Real disposable SQLite and finite controlled process sequences; no whole-application or external delivery guarantee", "Small correlated comparison with a disclosed post-hoc continuation; no general AI superiority claim", "Tang Vu built RaceLab during the event; TEND and earlier event infrastructure are pre-existing inputs"]
run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", concat, "-i", bed_file, "-i", OUT / "racelab-demo.srt", "-filter_complex", "[0:a][1:a]amix=inputs=2:normalize=0,alimiter=limit=0.89,afade=t=out:st=178.8:d=1[a]", "-map", "0:v", "-map", "[a]", "-map", "2:0", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-vf", "fps=30", "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-t", "179.9", "-movflags", "+faststart", "-metadata", f"title={STORY['title']}", "-metadata", "artist=Tang Vu", "-metadata", "comment=" + "; ".join(disclosures), movie])
result = probe(movie, True)
video = next(s for s in result["streams"] if s["codec_type"] == "video")
assert video["width"] == 1920 and video["height"] == 1080 and video["avg_frame_rate"] == "30/1"
assert 179.8 <= float(result["format"]["duration"]) <= 180
assert {"audio", "subtitle"}.issubset({s["codec_type"] for s in result["streams"]})
canonical = {"format":"racelab-demo-v4", "title":STORY["title"], "owner":"Tang Vu", "durationSeconds":180, "sourceDirectory":"docs/film-shots", "recording":"public/recordings/tend-claims.json", "recordingSha256":sha(ROOT / "public/recordings/tend-claims.json"), "disclosures":disclosures, "scenes":[{**s, "narration":" ".join(s["beats"])} for s in STORY["scenes"]]}
render = {"format":"racelab-demo-render-v2", "storyboard":"demo/racelab-storyboard.json", "durationSeconds":float(result["format"]["duration"]), "width":1920, "height":1080, "frameRate":"30/1", "frames":int(video["nb_read_frames"]), "videoSha256":sha(movie), "sourceDirectory":"docs/film-shots", "recording":canonical["recording"], "recordingSha256":canonical["recordingSha256"], "narrationVoice":"Xiaomi MiMo / Mia (built-in English)", "ttsModel":STORY["ttsModel"], "asrModel":STORY["asrModel"], "captionTiming":SPEECH["timingMethod"], "soundBed":"Original procedural oscillators; no sampled music", "disclosures":disclosures, "scenes":manifest}
render["cameraMotion"] = "none"
for rendered_scene in render["scenes"]:
    rendered_scene["cameraMotion"] = "none"
(ROOT / "public/racelab-demo.mp4").write_bytes(movie.read_bytes())
(ROOT / "demo/racelab-demo.srt").write_text(srt, encoding="utf8")
(ROOT / "public/racelab-demo.vtt").write_text("WEBVTT\n\n" + "\n".join(f"{stamp(a).replace(',', '.')} --> {stamp(b).replace(',', '.')}\n{textwrap.fill(text, width=72)}\n" for a,b,text in captions), encoding="utf8")
(ROOT / "demo/racelab-storyboard.json").write_text(json.dumps(canonical, ensure_ascii=False, indent=2)+"\n", encoding="utf8")
(ROOT / "demo/racelab-render-manifest.json").write_text(json.dumps(render, ensure_ascii=False, indent=2)+"\n", encoding="utf8")
public_speech = {**SPEECH, "scenes":[{"id":s["id"], "beats":[{k:v for k,v in b.items() if k != "localFile"} for b in s["beats"]]} for s in SPEECH["scenes"]]}
(ROOT / "demo/racelab-speech.json").write_text(json.dumps(public_speech, ensure_ascii=False, indent=2)+"\n", encoding="utf8")
run("ffmpeg", ["-v", "error", "-y", "-ss", "12", "-i", movie, "-frames:v", "1", ROOT / "public/racelab-poster.jpg"])
print(json.dumps({"duration":render["durationSeconds"], "frames":render["frames"], "bytes":movie.stat().st_size, "sha256":render["videoSha256"]}), flush=True)
