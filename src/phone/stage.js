// Drives the home page's phone from the scroll: it turns from its back to its front through the
// hero, then stays pinned while each feature section puts its own screen on it. Loaded only when
// the animated page runs, so three.js is never fetched for the stills.
import { createPhone, POSES } from "./phone.js";
import { story } from "./story.js";

const ease = (t) => t * t * (3 - 2 * t);
const lerp = (from, to, t) => from + (to - from) * t;

// How a new screen arrives, by `?transition=`. `lean` moves the resting pose at `t`, 0 to 1
// through the change, where `towards` is 1 scrolling down and -1 scrolling up and `drift` is the
// story's. `blend` is how much of the new screen shows at `t`.
const TRANSITIONS = {
  // The screens crossfade, and the phone leans a little with the scroll.
  fade: {
    duration: 350,
    lean: ({ yaw, pitch, roll }, { drift }) => ({ yaw: yaw + drift * 0.16, pitch: pitch - drift * 0.04, roll }),
    blend: (t) => ease(t),
  },
  // The phone turns once all the way round, and the new screen is on when its front comes back.
  turn: {
    duration: 900,
    lean: (pose, { t, towards }) => ({ ...pose, yaw: pose.yaw + towards * 2 * Math.PI * ease(t) }),
    blend: (t) => (t < 0.5 ? 0 : 1),
  },
};

/** Starts the phone in `stage`, an element holding a canvas and the screens' addresses. */
export function startStage(stage, { transition: named } = {}) {
  const canvas = stage.querySelector("canvas");
  const screens = JSON.parse(stage.dataset.screens);
  const hero = document.querySelector(".home .hero");
  const sections = [...document.querySelectorAll(".home [data-screen]")];
  const root = document.documentElement;
  const transition = TRANSITIONS[named] ?? TRANSITIONS.fade;
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
  let lastScroll = window.scrollY;
  let towards = 1;
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
    if (window.scrollY !== lastScroll) towards = window.scrollY > lastScroll ? 1 : -1;
    lastScroll = window.scrollY;

    const { turn, screen, drift } = story({
      scrollY: window.scrollY,
      viewport: window.innerHeight,
      turnOver: hero.offsetHeight * 0.5,
      sections: sections.map((section) => {
        const { top, bottom } = section.getBoundingClientRect();
        return { screen: section.dataset.screen, top: top + window.scrollY, bottom: bottom + window.scrollY };
      }),
    });

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
      t = Math.min(1, (now - change.start) / transition.duration);
      phone.setScreen(loaded.get(change.from), loaded.get(change.to), transition.blend(t));
      if (transition.blend(t) >= 0.5) shown = change.to;
    } else if (shown) {
      phone.setScreen(loaded.get(shown));
    }

    const facing = ease(turn);
    const resting = {
      yaw: lerp(POSES.back.yaw, POSES.front.yaw, facing),
      pitch: lerp(POSES.back.pitch, POSES.front.pitch, facing),
      roll: lerp(POSES.back.roll, POSES.front.roll, facing),
    };
    phone.setPose(transition.lean(resting, { t, towards: change?.towards ?? 1, drift: drift * facing }));
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
