// Drives the home page's phone from the scroll: it turns from its back to its front through the
// hero, then stays pinned while each feature section puts its own screen on it. Loaded only when
// the animated page runs, so three.js is never fetched for the stills.
import { createPhone, POSES } from "./phone.js";
import { story } from "./story.js";

const ease = (t) => t * t * (3 - 2 * t);
const lerp = (from, to, t) => from + (to - from) * t;

// How a new screen arrives, by `?transition=`. Each gives the pose's change and the screen's
// blend at `t`, 0 to 1 through the change; `towards` is 1 scrolling down and -1 scrolling up.
const TRANSITIONS = {
  // The screens crossfade, and the phone leans a little with the scroll.
  fade: {
    duration: 350,
    yaw: (yaw, _t, _towards, drift) => yaw + drift * 0.16,
    pitch: (pitch, drift) => pitch - drift * 0.04,
    blend: (t) => ease(t),
  },
  // The phone swings edge-on, and comes back with the new screen.
  turn: {
    duration: 750,
    yaw: (yaw, t, towards) => lerp(yaw, (towards * Math.PI) / 2, Math.sin(Math.PI * ease(t))),
    pitch: (pitch) => pitch,
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
  const keyOf = (screen) => `${screen}:${root.dataset.theme === "light" ? "light" : "dark"}`;
  function ask(key) {
    if (asked.has(key)) return;
    asked.add(key);
    const [screen, theme] = key.split(":");
    phone.loadScreen(screens[screen][theme]).then((texture) => {
      loaded.set(key, texture);
      draw();
    });
  }

  let shown = null;
  let change = null;
  let lastScroll = window.scrollY;
  let towards = 1;
  let queued = false;
  let sized = false;

  function draw() {
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
      turnOver: hero.offsetHeight * 0.6,
      sections: sections.map((section) => {
        const { top, bottom } = section.getBoundingClientRect();
        return { screen: section.dataset.screen, top: top + window.scrollY, bottom: bottom + window.scrollY };
      }),
    });

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
    phone.setPose({
      yaw: transition.yaw(lerp(POSES.back.yaw, POSES.front.yaw, facing), t, change?.towards ?? 1, drift * facing),
      pitch: transition.pitch(lerp(POSES.back.pitch, POSES.front.pitch, facing), drift * facing),
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
    if (change || (wanted !== shown && loaded.has(wanted))) draw();
  }

  new ResizeObserver(() => {
    if (stage.clientWidth === 0) return;
    phone.setSize(stage.clientWidth, stage.clientHeight);
    sized = true;
    draw();
  }).observe(stage);
  window.addEventListener("scroll", draw, { passive: true });
  new MutationObserver(draw).observe(root, { attributeFilter: ["data-theme", "data-home"] });
  // The other sections' screens, before the reader gets to them.
  for (const screen of Object.keys(screens)) ask(keyOf(screen));
}
