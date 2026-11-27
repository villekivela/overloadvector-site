import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { openSite } from "./browser.mjs";
import { page, read } from "./dist.mjs";

// The feature sections in page order, by the screen each puts on the phone.
// The Technique section shows two: the mannequin, then its muscles.
const SECTIONS = ["new-program", "logging", "mannequin", "muscles", "progress", "check-in"];
const DESK = { width: 1280, height: 800 };
const POCKET = { width: 390, height: 800 };
// A desk's window tall enough to hold a whole section below its middle.
const TALL = { width: 1440, height: 1100 };

test("the home page names Overload Vector", () => {
  assert.match(page("/"), /<h1[^>]*>\s*Overload Vector\s*<\/h1>/);
});

test("the home page's address is on overloadvector.com", () => {
  assert.match(page("/"), /<link rel="canonical" href="https:\/\/overloadvector\.com\/"\s*\/?>/);
});

test("the home page offers the beta from the releases, and ends with the docs and the FAQ", () => {
  const html = page("/");
  assert.match(html, /href="https:\/\/github\.com\/villekivela\/overloadvector-releases\/releases\/latest"[^>]*>\s*Get the beta/);
  const end = html.slice(html.lastIndexOf("<h2"), html.indexOf('<footer class="site-footer'));
  assert.match(end, /href="\/docs\/getting-started\/"/);
  assert.match(end, /href="\/faq\/"/);
});

test("the home page's header leads to the docs and the FAQ, and the search is on the other pages", () => {
  const header = (html) => html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  assert.match(header(page("/")), /href="\/docs\/getting-started\/"[^>]*>Docs<[\s\S]*href="\/faq\/"[^>]*>FAQ</);
  assert.doesNotMatch(header(page("/")), /site-search/);
  assert.match(header(page("/faq/")), /site-search/);
});

test("each still phone is there in both themes, and described", () => {
  const stills = [...page("/").matchAll(/<img\b[^>]*\ssrc="\/_astro\/phone-([a-z-]+)-(light|dark)\.[^>]*>/g)].map(
    ([img, screen, theme]) => ({ screen, theme, alt: img.match(/\salt="([^"]*)"/)?.[1] ?? "" }),
  );
  // After the screens, Today again: it holds the live phone's place, where the canvas speaks for it.
  assert.deepEqual(stills.filter(({ theme }) => theme === "light").map(({ screen }) => screen), ["today", ...SECTIONS, "today"]);
  for (let i = 0; i < stills.length; i += 2) {
    assert.deepEqual(stills[i + 1], { ...stills[i], theme: "dark" });
    if (i < stills.length - 2) assert.ok(stills[i].alt.length >= 12, `${stills[i].screen} isn't described`);
  }
});

test("the page for a wrong address has no phone", () => {
  const html = read("404.html").toString("utf8");
  assert.doesNotMatch(html, /home-stage|phone-still/);
  assert.match(html, /<h1[^>]*>\s*404\s*<\/h1>/);
});

let site;
before(async () => (site = await openSite()));
after(() => site?.close());

/** Opens the home page as a visitor with that window would, and returns what it asked for. */
async function visit({ width, height }, { route = "/", reducedMotion = false } = {}) {
  // Leave the page before changing the window, so the old one doesn't answer to the new window.
  await site.leave();
  await site.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await site.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: "dark" },
      { name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" },
    ],
  });
  const asked = site.requests.length;
  await site.visit(route);
  return () => site.requests.slice(asked);
}

/** Whether any script the page asked for holds three.js. */
function askedForThree(requests) {
  return requests
    .map((url) => new URL(url).pathname.slice(1))
    .filter((path) => path.endsWith(".js"))
    .some((path) => read(path).toString("utf8").includes("THREE."));
}

const until = (what, test, ...args) =>
  site.run(
    async (what, test, args) => {
      const check = new Function(`return (${test})`)();
      for (let waited = 0; waited < 5000; waited += 50) {
        if (check(...args)) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`never: ${what}, at ${JSON.stringify({ ...document.querySelector(".home-stage")?.dataset, screens: undefined })}`);
    },
    what,
    String(test),
    args,
  );

const phoneShows = (screen) =>
  until(
    `the phone showing ${screen}`,
    (screen) => {
      const { dataset } = document.querySelector(".home-stage");
      return "ready" in dataset && dataset.screen === screen;
    },
    screen,
  );

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const scrollTo = (selector) =>
  site.run((selector) => {
    if (selector) document.querySelector(selector).scrollIntoView({ block: "center", behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, selector);

const pickTheme = (value) =>
  site.run((value) => {
    const select = document.querySelector("starlight-theme-select select");
    select.value = value;
    select.dispatchEvent(new Event("change"));
  }, value);

/** The still phones in view, by file name, after giving a late script its chance to run. */
const stillsSeen = () =>
  site.run(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const canvas = document.querySelector(".home-stage canvas");
    if (canvas?.getClientRects().length) throw new Error("the canvas is showing");
    return [...document.querySelectorAll(".phone-still img")]
      .filter((img) => img.getClientRects().length > 0)
      .map((img) => img.getAttribute("src").match(/phone-[a-z-]+/)[0]);
  });

/** Scrolls a section against an edge of the view: "end" has it whole in view as it comes up. */
const bring = (screen, block) =>
  site.run(
    (screen, block) => document.querySelector(`.home [data-screen~="${screen}"]`).scrollIntoView({ block, behavior: "instant" }),
    screen,
    block,
  );

test("on a desk the phone shows each section's screen as the reader scrolls, and back again", async () => {
  const requests = await visit(DESK);
  await phoneShows("today");
  assert.ok(askedForThree(requests()), "three.js wasn't asked for");
  assert.deepEqual(await stillsSeen().catch(() => "the canvas"), "the canvas");

  for (const screen of SECTIONS) {
    // A section's first screen shows as it comes whole into view, its second by the time it has
    // reached the top.
    const second = await site.run((screen) => {
      const section = document.querySelector(`.home [data-screen~="${screen}"]`);
      return section.dataset.screen.split(" ").indexOf(screen) > 0;
    }, screen);
    await bring(screen, second ? "start" : "end");
    await phoneShows(screen);
  }
  // The phone is still pinned in view beside the last section.
  const pinned = await site.run(() => {
    const { top, bottom } = document.querySelector(".home-stage").getBoundingClientRect();
    return top >= 0 && bottom <= window.innerHeight;
  });
  assert.ok(pinned, "the phone has scrolled away");

  await scrollTo(`.home [data-screen~="${SECTIONS[0]}"]`);
  await phoneShows(SECTIONS[0]);
  await scrollTo(null);
  await phoneShows("today");
});

test("a section whole in view reads beside its own screen, also while it is low in the view", async () => {
  await visit(TALL);
  await phoneShows("today");
  await bring(SECTIONS[0], "end");
  const whole = await site.run((screen) => {
    const { top, bottom } = document.querySelector(`.home [data-screen~="${screen}"]`).getBoundingClientRect();
    return { below: top - document.querySelector("header.header").offsetHeight, above: window.innerHeight - bottom };
  }, SECTIONS[0]);
  assert.ok(whole.below >= 0 && whole.above >= -1, `not whole in view: ${JSON.stringify(whole)}`);
  await phoneShows(SECTIONS[0]);
});

test("no section's words are dimmed, wherever the page is scrolled", async () => {
  await visit(DESK);
  await phoneShows("today");
  for (const selector of [null, ...SECTIONS.map((screen) => `.home [data-screen~="${screen}"]`)]) {
    await scrollTo(selector);
    await pause(500);
    const dimmed = await site.run(() =>
      [...document.querySelectorAll(".home .home-feature *")]
        .filter((element) => {
          for (let at = element; at; at = at.parentElement) if (getComputedStyle(at).opacity !== "1") return true;
          return false;
        })
        .map((element) => `${element.closest("section").id} ${element.tagName.toLowerCase()}`),
    );
    assert.deepEqual(dimmed, [], `at ${selector ?? "the top"}`);
  }
});

/** The live phone's side of the page as a visitor sees it now, as raw pixels. */
async function seeStage() {
  const box = await site.run(() => {
    const { left, top, width, height } = document.querySelector(".home-stage").getBoundingClientRect();
    return { left: Math.round(left), top: Math.round(top), width: Math.floor(width), height: Math.floor(height) };
  });
  const { data } = await site.send("Page.captureScreenshot", { format: "png" });
  return sharp(Buffer.from(data, "base64")).extract(box).removeAlpha().raw().toBuffer();
}

/** The share of two pictures' values that differ by more than a rounding's worth. */
function differing(one, other) {
  assert.equal(one.length, other.length, "the phone's side changed its size");
  let count = 0;
  for (let i = 0; i < one.length; i++) if (Math.abs(one[i] - other[i]) > 8) count++;
  return count / one.length;
}

test("the phone turns into place as the scroll begins, then stands still through every change of screen", async () => {
  // Every screen is given Today's picture, so whatever changes on the phone's side is the phone
  // moving, not its screen.
  const { identifier } = await site.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `new MutationObserver((_, observer) => {
      const stage = document.querySelector(".home-stage[data-screens]");
      if (!stage) return;
      observer.disconnect();
      const screens = JSON.parse(stage.dataset.screens);
      for (const name in screens) screens[name] = screens.today;
      stage.dataset.screens = JSON.stringify(screens);
    }).observe(document, { childList: true, subtree: true });`,
  });
  try {
    await visit(DESK);
  } finally {
    await site.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  }
  await phoneShows("today");
  await pause(700);
  const opening = await seeStage();
  await site.run(() => window.scrollTo({ top: window.innerHeight / 4, behavior: "instant" }));
  await pause(700);
  const placed = await seeStage();
  assert.ok(differing(opening, placed) > 0.005, "the phone didn't turn");

  // The last section at its foot only: beyond that the phone rides up with the end of the page.
  for (const screen of SECTIONS) {
    for (const block of screen === SECTIONS.at(-1) ? ["end"] : ["end", "start"]) {
      await bring(screen, block);
      // Through the change of screen, and after it.
      for (const wait of [60, 100, 100, 100, 100, 500]) {
        await pause(wait);
        const moved = differing(placed, await seeStage());
        assert.ok(moved < 0.001, `the phone moved at ${screen}, ${block}: ${moved}`);
      }
    }
  }
});

test("the picture holding the phone's place is the phone as the page first shows it", async () => {
  await visit(DESK);
  for (const theme of ["dark", "light"]) {
    await pickTheme(theme);
    await phoneShows("today");
    await pause(700);
    // Shrunk, so that only where the phone stands and which way it faces count.
    const shrunk = async () => {
      const box = await site.run(() => {
        const { width, height } = document.querySelector(".home-stage").getBoundingClientRect();
        return { width: Math.floor(width), height: Math.floor(height) };
      });
      return sharp(await seeStage(), { raw: { ...box, channels: 3 } }).resize(60).raw().toBuffer();
    };
    const model = await shrunk();
    await site.run(() => document.querySelector(".home-stage").removeAttribute("data-ready"));
    await pause(700);
    const picture = await shrunk();
    await site.run(() => document.querySelector(".home-stage").setAttribute("data-ready", ""));
    const apart = differing(model, picture);
    assert.ok(apart < 0.08, `${theme}: the picture and the model differ in ${apart} of the values`);
  }
});

test("the phone stays where it is when the scroll begins", async () => {
  await visit(DESK);
  await phoneShows("today");
  const tops = [];
  for (const top of [0, 10, 60, 300]) {
    tops.push(
      await site.run((top) => {
        window.scrollTo({ top, behavior: "instant" });
        return Math.round(document.querySelector(".home-stage").getBoundingClientRect().top);
      }, top),
    );
  }
  assert.deepEqual(tops, tops.map(() => tops[0]));
});

/** How bright the middle of the phone's screen is, 0 to 255. */
async function screenBrightness() {
  const clip = await site.run(() => {
    const { left, top, width, height } = document.querySelector(".home-stage").getBoundingClientRect();
    return { x: left + width / 2 - 40, y: top + height / 2 - 40, width: 80, height: 80, scale: 1 };
  });
  const { data } = await site.send("Page.captureScreenshot", { format: "png", clip });
  const { channels } = await sharp(Buffer.from(data, "base64")).stats();
  return (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
}

test("the theme menu changes the phone's screen, both ways", async () => {
  await visit(DESK);
  await pickTheme("dark");
  await scrollTo('.home [data-screen="logging"]');
  await phoneShows("logging");
  const settle = () => pause(700);
  await settle();
  const dark = await screenBrightness();
  await pickTheme("light");
  await settle();
  const light = await screenBrightness();
  await pickTheme("dark");
  await settle();
  const darkAgain = await screenBrightness();
  assert.ok(dark < 90 && light > 170 && darkAgain < 90, `dark ${dark}, light ${light}, dark again ${darkAgain}`);
});

const STILLS = ["today", ...SECTIONS];

test("a window made narrow while the phone is live goes to the stills, and back when widened", async () => {
  await visit(DESK);
  await phoneShows("today");
  await site.send("Emulation.setDeviceMetricsOverride", { ...POCKET, deviceScaleFactor: 1, mobile: false });
  assert.deepEqual(await stillsSeen(), STILLS.map((screen) => `phone-${screen}-dark`));
  await site.send("Emulation.setDeviceMetricsOverride", { ...DESK, deviceScaleFactor: 1, mobile: false });
  await until("the canvas back in view", () => document.querySelector(".home-stage canvas").getClientRects().length > 0);
});

for (const [who, open] of [
  ["a narrow window", () => visit(POCKET)],
  ["a visitor who asked for less motion", () => visit(DESK, { reducedMotion: true })],
  [
    "a browser without WebGL",
    async () => {
      const { identifier } = await site.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `{
          const real = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
            return /webgl/.test(kind) ? null : real.call(this, kind, ...rest);
          };
        }`,
      });
      try {
        return await visit(DESK);
      } finally {
        await site.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
      }
    },
  ],
]) {
  test(`${who} gets the still phones in the picked theme, and no three.js`, async () => {
    const requests = await open();
    await pickTheme("dark");
    assert.deepEqual(await stillsSeen(), STILLS.map((screen) => `phone-${screen}-dark`));
    await pickTheme("light");
    assert.deepEqual(await stillsSeen(), STILLS.map((screen) => `phone-${screen}-light`));
    assert.equal(askedForThree(requests()), false, "three.js was asked for");
  });
}
