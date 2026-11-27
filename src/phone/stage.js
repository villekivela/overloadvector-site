// Drives the home page's phone from the scroll: it turns a little into place as the scroll begins,
// then stands still, pinned, while each feature section puts its own screen on it, or plays its
// clip there. Loaded only when the animated page runs, so neither three.js nor a clip is ever
// fetched for the stills.
import { createPhone, POSES } from "./phone.js";
import { story } from "./story.js";

const ease = (t) => t * t * (3 - 2 * t);
const lerp = (from, to, t) => from + (to - from) * t;

// A new screen crossfades in over this many milliseconds.
const CHANGE = 300;

/** Starts the phone in `stage`, an element holding a canvas and the screens' addresses. */
export function startStage(stage) {
  const canvas = stage.querySelector("canvas");
  const screens = JSON.parse(stage.dataset.screens);
  const sections = [...document.querySelectorAll(".home [data-screen]")];
  const root = document.documentElement;
  const phone = createPhone(canvas, { pixelRatio: Math.min(window.devicePixelRatio, 2) });

  // Screens by "screen:theme", once loaded.
  const loaded = new Map();
  const asked = new Set();
  const theme = () => (root.dataset.theme === "light" ? "light" : "dark");
  const keyOf = (screen) => `${screen}:${theme()}`;
  function ask(key) {
    if (asked.has(key)) return;
    asked.add(key);
    const [screen, theme] = key.split(":");
    phone.loadScreen(screens[screen][theme]).then(
      (texture) => {
        loaded.set(key, texture);
        redraw();
      },
      // Asked for again the next time it is wanted.
      () => asked.delete(key),
    );
  }

  // Clips by "screen:theme", made the first time their screen is shown. Muted and looping, a
  // clip plays only while its screen is the one shown, from its start each time. Until its first
  // frame is drawn the phone shows the still of that frame, and once paused, the frame it stopped on.
  const clips = new Map();
  function clipOf(key) {
    const [screen, theme] = key.split(":");
    const sources = screens[screen].clip?.[theme];
    if (!sources) return null;
    if (!clips.has(key)) {
      const video = document.createElement("video");
      Object.assign(video, { muted: true, loop: true, playsInline: true, preload: "auto" });
      for (const [kind, src] of Object.entries(sources)) {
        video.append(Object.assign(document.createElement("source"), { src, type: `video/${kind}` }));
      }
      const clip = { video, texture: phone.videoScreen(video), drawn: false };
      // Each new frame draws the phone again.
      const next = () => {
        if (!video.paused) clip.drawn = true;
        redraw();
        video.requestVideoFrameCallback(next);
      };
      video.requestVideoFrameCallback(next);
      clips.set(key, clip);
    }
    return clips.get(key);
  }
  /** Plays the clip of `key` if it has one, and stops every other. */
  function play(key) {
    for (const [other, { video }] of clips) if (other !== key && !video.paused) video.pause();
    const clip = key && clipOf(key);
    if (!clip?.video.paused) return;
    clip.drawn = false;
    clip.video.currentTime = 0;
    // Refused, as by a browser that saves power: the still stays.
    clip.video.play().catch(() => {});
  }
  const screenOf = (key) => {
    const clip = clips.get(key);
    return clip?.drawn ? clip.texture : loaded.get(key);
  };

  let shown = null;
  let change = null;
  let queued = false;
  let sized = false;

  function redraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    queued = false;
    if (!sized || root.dataset.home !== "live") return;
    const { turn, screen } = story({
      scrollY: window.scrollY,
      viewport: window.innerHeight,
      sections: sections.map((section) => {
        const { top, bottom } = section.getBoundingClientRect();
        return { screens: section.dataset.screen.split(" "), top: top + window.scrollY, bottom: bottom + window.scrollY };
      }),
    });

    phone.setFinish(theme());
    const wanted = keyOf(screen);
    ask(wanted);
    if (!change && wanted !== shown && loaded.has(wanted)) {
      // The first screen and a change of theme just appear; a new section's screen fades in.
      const sameTheme = shown?.split(":")[1] === wanted.split(":")[1];
      if (sameTheme) change = { from: shown, to: wanted, start: now };
      else shown = wanted;
    }
    let t = 0;
    if (change) {
      t = Math.min(1, (now - change.start) / CHANGE);
      phone.setScreen(screenOf(change.from), screenOf(change.to), ease(t));
      if (t >= 0.5) shown = change.to;
    } else if (shown) {
      phone.setScreen(screenOf(shown));
    }

    const placed = ease(turn);
    phone.setPose({
      yaw: lerp(POSES.open.yaw, POSES.front.yaw, placed),
      pitch: lerp(POSES.open.pitch, POSES.front.pitch, placed),
      roll: lerp(POSES.open.roll, POSES.front.roll, placed),
    });
    phone.render();

    // What the canvas shows, for a reader who can't see it and for the tests. It is ready to take
    // the picture's place only once it has a screen.
    const showing = shown?.split(":")[0];
    if (showing) {
      stage.dataset.screen = showing;
      canvas.setAttribute("aria-label", screens[showing].alt);
      stage.dataset.ready = "";
    }

    if (change && t >= 1) change = null;
    // A clip starts once its screen has faded in, and stops as another begins to.
    play(change ? null : shown);
    // Which clip is playing, for the tests.
    const running = [...clips].find(([, { video }]) => !video.paused)?.[0].split(":")[0];
    if (running) stage.dataset.playing = running;
    else delete stage.dataset.playing;
    if (change || (wanted !== shown && loaded.has(wanted))) redraw();
  }

  new ResizeObserver(() => {
    if (stage.clientWidth === 0) return;
    phone.setSize(stage.clientWidth, stage.clientHeight);
    sized = true;
    redraw();
  }).observe(stage);
  window.addEventListener("scroll", redraw, { passive: true });
  // Every section's screen in the theme in use, before the reader gets to it.
  const preload = () => Object.keys(screens).forEach((screen) => ask(keyOf(screen)));
  new MutationObserver(() => {
    preload();
    redraw();
  }).observe(root, { attributeFilter: ["data-theme", "data-home"] });
  preload();
}
