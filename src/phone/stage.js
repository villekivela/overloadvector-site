// Drives the home page's phone from the scroll: it turns from its back to its front through the
// hero, then stays pinned while each feature section puts its own screen on it. Loaded only when
// the animated page runs, so three.js is never fetched for the stills.
import { createPhone, POSES } from "./phone.js";
import { story } from "./story.js";

const ease = (t) => t * t * (3 - 2 * t);
const lerp = (from, to, t) => from + (to - from) * t;

// A new screen arrives over this many milliseconds: the phone swings a little the way the page
// is going and draws back, the screens crossfade while it is turned, and it settles again.
const CHANGE = 700;
const SWING = { yaw: 0.42, size: 0.05 };
// How far the phone leans with the story's drift, in radians.
const LEAN = { yaw: 0.16, pitch: -0.04 };

/** Starts the phone in `stage`, an element holding a canvas and the screens' addresses. */
export function startStage(stage) {
  const canvas = stage.querySelector("canvas");
  const screens = JSON.parse(stage.dataset.screens);
  const hero = document.querySelector(".home .hero");
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

  let shown = null;
  let change = null;
  let queued = false;
  let lastScroll = window.scrollY;
  let towards = 1;
  let sized = false;

  function redraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    queued = false;
    if (!sized || root.dataset.home !== "live") return;
    if (window.scrollY !== lastScroll) towards = window.scrollY > lastScroll ? 1 : -1;
    lastScroll = window.scrollY;
    const { turn, screen, drift } = story({
      scrollY: window.scrollY,
      viewport: window.innerHeight,
      turnOver: hero.offsetHeight * 0.5,
      sections: sections.map((section) => {
        const { top, bottom } = section.getBoundingClientRect();
        return { screens: section.dataset.screen.split(" "), top: top + window.scrollY, bottom: bottom + window.scrollY };
      }),
    });

    for (const section of sections) section.toggleAttribute("data-active", section.dataset.screen.split(" ").includes(screen));
    phone.setFinish(theme());
    const wanted = keyOf(screen);
    ask(wanted);
    if (!change && wanted !== shown && loaded.has(wanted)) {
      // The first screen and a change of theme just appear; a new section's screen arrives.
      const sameTheme = shown?.split(":")[1] === wanted.split(":")[1];
      if (sameTheme) change = { from: shown, to: wanted, start: now, towards };
      else shown = wanted;
    }
    let t = 0;
    if (change) {
      t = Math.min(1, (now - change.start) / CHANGE);
      // The screens change through the middle half of the swing.
      const blend = ease(Math.min(1, Math.max(0, (t - 0.25) * 2)));
      phone.setScreen(loaded.get(change.from), loaded.get(change.to), blend);
      if (t >= 0.5) shown = change.to;
    } else if (shown) {
      phone.setScreen(loaded.get(shown));
    }

    // The phone leans a little with the scroll, once its front has come round.
    const facing = ease(turn);
    const lean = drift * facing;
    const swing = change ? Math.sin(Math.PI * ease(t)) * change.towards : 0;
    phone.setPose({
      size: 1 - Math.abs(swing) * SWING.size,
      yaw: lerp(POSES.back.yaw, POSES.front.yaw, facing) + lean * LEAN.yaw + swing * SWING.yaw,
      pitch: lerp(POSES.back.pitch, POSES.front.pitch, facing) + lean * LEAN.pitch,
      roll: lerp(POSES.back.roll, POSES.front.roll, facing),
    });
    phone.render();

    // What the canvas shows, for a reader who can't see it and for the tests.
    const side = turn < 0.5 ? "back" : "front";
    const showing = shown?.split(":")[0];
    stage.dataset.facing = side;
    if (showing) stage.dataset.screen = showing;
    canvas.setAttribute("aria-label", side === "front" && showing ? screens[showing].alt : stage.dataset.backAlt);
    stage.dataset.ready = "";

    if (change && t >= 1) change = null;
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
