// Makes one of the home page's clips from a screen recording of the app (adb shell screenrecord),
// with ffmpeg: npm run clips -- <recording> <screen> <light|dark> <from s> <to s> [<hold>].
// The recording comes back to where it began (a set logged and taken back, the muscles shown and
// hidden), and the cut ends a frame before it does, so the clip's last frame leads into its first
// as any frame leads into the next. `hold` (x:y:w:h, in the clip's pixels) keeps a part of the
// screen as it is in the first frame, for what only ever moves on (the session clock), but between
// the seconds a and b of the clip when it ends in :a:b (while the rest timer takes the clock's place).
// It writes src/assets/clips/clip-<screen>-<theme>.webm (VP9), .mp4 (H.264, for a browser without
// VP9) and .png, the clip's first frame, which the phone shows until the clip plays. It says how
// big each file is and how far the last frame is from the first, which should be next to nothing
// for a loop that doesn't jump.
import { execFileSync, spawnSync } from "node:child_process";
import { rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../src/assets/clips/", import.meta.url));
// The screenshots' size: the phone's screen at half its pixels.
const SCALE = "scale=640:1428:flags=lanczos,fps=30,format=yuv420p";
const FRAME = 1 / 30;

const [recording, screen, theme, ...times] = process.argv.slice(2);
const [from, to] = times.slice(0, 2).map(Number);
const hold = times[2]?.split(":").map(Number);
const length = to - from;
// The last frame is held 3 s past the recording's end, and no more.
if (!recording || !screen || !["light", "dark"].includes(theme) || !(length > FRAME) || (hold && (![4, 6].includes(hold.length) || hold.some(Number.isNaN)))) {
  console.error("usage: npm run clips -- <recording> <screen> <light|dark> <from s> <to s> [<x:y:w:h[:a:b] held>]");
  process.exit(1);
}
const name = join(OUT, `clip-${screen}-${theme}`);
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
// screenrecord writes a frame only when the screen changes, so its last is held to fill the cut.
const cut = `[0:v]fps=30,tpad=stop_mode=clone:stop_duration=3,trim=start=${from}:end=${to},setpts=PTS-STARTPTS,${SCALE}`;
const [x, y, w, h, a, b] = hold ?? [];
const held = a === undefined ? "" : `:enable='not(between(t,${a},${b}))'`;
const loop = hold
  ? [`${cut},split[a][b]`, `[b]trim=end_frame=1,crop=${w}:${h}:${x}:${y},loop=loop=-1:size=1,setpts=N/30/TB[held]`, `[a][held]overlay=${x}:${y}:shortest=1${held},format=yuv420p`].join(";")
  : cut;
const input = ["-i", recording, "-an", "-filter_complex", loop];

ffmpeg(...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-row-mt", "1", "-deadline", "good", "-cpu-used", "1", "-g", "300", `${name}.webm`);
ffmpeg(...input, "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-profile:v", "high", "-level", "3.1", "-movflags", "+faststart", `${name}.mp4`);
ffmpeg("-i", `${name}.webm`, "-frames:v", "1", "-update", "1", `${name}.png`);

// The loop's seam: the last frame against the first, as PSNR in dB (higher is closer; 40 and up
// is beyond what an eye can tell), beside the step from the first frame to the second. A seam no
// lower than that step moves no more than the clip does from one frame to the next.
const last = join(tmpdir(), `clip-${screen}-${theme}-last.png`);
ffmpeg("-sseof", "-0.2", "-i", `${name}.webm`, "-update", "1", last);
const psnr = (...inputs) =>
  spawnSync("ffmpeg", ["-hide_banner", ...inputs, "-filter_complex", "psnr", "-frames:v", "1", "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/average:(\S+)/)?.[1] ?? "?";
const seam = psnr("-i", last, "-i", `${name}.png`);
const step = psnr("-ss", "0.034", "-i", `${name}.webm`, "-i", `${name}.png`);
rmSync(last);
console.log(`${name}: ${length.toFixed(2)} s`);
for (const kind of ["webm", "mp4", "png"]) console.log(`  .${kind} ${(statSync(`${name}.${kind}`).size / 1e6).toFixed(2)} MB`);
console.log(`  seam ${seam} dB, a step ${step} dB`);
