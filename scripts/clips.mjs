// Makes one of the home page's clips from a screen recording of the app (adb shell screenrecord),
// with ffmpeg: npm run clips -- <recording> <screen> <light|dark> <from s> <to s> [<fade s>].
// The app's state at the end differs from the start (a set logged, a proposal made), so the loop
// is closed by the recording itself: its last `fade` seconds dissolve into its first, which hold
// still, and the clip starts after them. Its last frame then leads into its first.
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
const [from, to, fade = 0.6] = times.map(Number);
const length = to - from;
// The opening the end dissolves into comes off the clip, so the cut holds two of them. The last
// frame is held 3 s past the recording's end, and no more.
if (!recording || !screen || !["light", "dark"].includes(theme) || !(fade > FRAME && length > 2 * fade)) {
  console.error("usage: npm run clips -- <recording> <screen> <light|dark> <from s> <to s> [<fade s>]");
  process.exit(1);
}
const name = join(OUT, `clip-${screen}-${theme}`);
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
// screenrecord writes a frame only when the screen changes, so its last is held to fill the cut.
const loop = [
  `[0:v]fps=30,tpad=stop_mode=clone:stop_duration=3,trim=start=${from}:end=${to},setpts=PTS-STARTPTS,${SCALE},split[a][b]`,
  `[a]trim=start=${fade},setpts=PTS-STARTPTS[body]`,
  `[b]trim=end=${fade},setpts=PTS-STARTPTS[head]`,
  // The dissolve ends a frame early, so that the last frame is wholly the opening's.
  `[body][head]xfade=transition=fade:duration=${fade - FRAME}:offset=${length - 2 * fade + FRAME},format=yuv420p`,
].join(";");
const cut = ["-i", recording, "-an", "-filter_complex", loop];

ffmpeg(...cut, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-row-mt", "1", "-deadline", "good", "-cpu-used", "1", "-g", "300", `${name}.webm`);
ffmpeg(...cut, "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-profile:v", "high", "-level", "3.1", "-movflags", "+faststart", `${name}.mp4`);
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
console.log(`${name}: ${(length - fade + FRAME).toFixed(2)} s`);
for (const kind of ["webm", "mp4", "png"]) console.log(`  .${kind} ${(statSync(`${name}.${kind}`).size / 1e6).toFixed(2)} MB`);
console.log(`  seam ${seam} dB, a step ${step} dB`);
