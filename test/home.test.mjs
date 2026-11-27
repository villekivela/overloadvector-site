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
// A desk's tall window, where a section can be whole in view and still low in it.
const HIGH_DESK = { width: 1440, height: 1100 };
// A window taller than it is wide, where the phone is sized by its side's width.
const NARROW_DESK = { width: 1000, height: 1200 };

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
  for (let i = 0; i < stills.length; i += 2) assert.deepEqual(stills[i + 1], { ...stills[i], theme: "dark" });
  for (const { screen, alt } of stills.slice(0, -2)) assert.ok(alt.length >= 12, `${screen} isn't described`);
  assert.deepEqual(stills.slice(-2).map(({ alt }) => alt), ["", ""]);
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

/**
 * Scrolls a section to the view's foot ("end"), where it is whole in view as it comes up, or to
 * just under the header ("top").
 */
const bring = (screen, to) =>
  site.run(
    (screen, to) => {
      const section = document.querySelector(`.home [data-screen~="${screen}"]`);
      if (to === "end") return section.scrollIntoView({ block: "end", behavior: "instant" });
      const header = document.querySelector("header.header").offsetHeight;
      window.scrollBy({ top: section.getBoundingClientRect().top - header, behavior: "instant" });
    },
    screen,
    to,
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
    await bring(screen, second ? "top" : "end");
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
  await visit(HIGH_DESK);
  await phoneShows("today");
  await bring(SECTIONS[0], "end");
  const whole = await site.run((screen) => {
    const { top, bottom } = document.querySelector(`.home [data-screen~="${screen}"]`).getBoundingClientRect();
    return { underHeader: top - document.querySelector("header.header").offsetHeight, overFoot: window.innerHeight - bottom };
  }, SECTIONS[0]);
  assert.ok(whole.underHeader >= 0 && whole.overFoot >= -1, `not whole in view: ${JSON.stringify(whole)}`);
  await phoneShows(SECTIONS[0]);
});

for (const [where, size] of [["a desk", DESK], ["a tall desk", HIGH_DESK]]) {
  test(`on ${where} the hero's link to a section with two screens lands on its first`, async () => {
    await visit(size);
    await phoneShows("today");
    await site.run(() => document.querySelector('.home .glance a[href="#technique"]').click());
    await pause(1500);
    assert.equal(await site.run(() => document.querySelector(".home-stage").dataset.screen), "mannequin");
  });
}

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

/** How bright the middle of the phone's screen is, 0 to 255. */
async function screenBrightness() {
  const { pixels, width, height } = await seeStage();
  const middle = { left: Math.round(width / 2) - 40, top: Math.round(height / 2) - 40, width: 80, height: 80 };
  const { channels } = await sharp(await sharp(pixels, { raw: { width, height, channels: 3 } }).extract(middle).png().toBuffer()).stats();
  return (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
}

/** Runs `body` on a page whose screens are first rewritten by `rewrite`, a function in the page. */
async function withScreens(rewrite, body) {
  const { identifier } = await site.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `new MutationObserver((_, observer) => {
      const stage = document.querySelector(".home-stage[data-screens]");
      if (!stage) return;
      observer.disconnect();
      const screens = JSON.parse(stage.dataset.screens);
      (${rewrite})(screens);
      stage.dataset.screens = JSON.stringify(screens);
    }).observe(document, { childList: true, subtree: true });`,
  });
  try {
    await visit(DESK);
  } finally {
    await site.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  }
  await body();
}

/** The live phone's side of the page as a visitor sees it now, as raw pixels. */
async function seeStage() {
  const box = await site.run(() => {
    const { left, top, width, height } = document.querySelector(".home-stage").getBoundingClientRect();
    return { left: Math.round(left), top: Math.round(top), width: Math.floor(width), height: Math.floor(height) };
  });
  const { data } = await site.send("Page.captureScreenshot", { format: "png" });
  const pixels = await sharp(Buffer.from(data, "base64")).extract(box).removeAlpha().raw().toBuffer();
  return { pixels, width: box.width, height: box.height };
}

/** The share of two pictures' values that differ by more than a rounding's worth. */
function differing({ pixels: one }, { pixels: other }) {
  assert.equal(one.length, other.length, "the phone's side changed its size");
  let count = 0;
  for (let i = 0; i < one.length; i++) if (Math.abs(one[i] - other[i]) > 8) count++;
  return count / one.length;
}

test("the phone turns into place as the scroll begins, then stands still through every change of screen", async () => {
  // Every screen is given Today's picture, so whatever changes on the phone's side is the phone
  // moving, not its screen.
  await withScreens(
    (screens) => {
      for (const name in screens) screens[name] = screens.today;
    },
    async () => {
      await phoneShows("today");
      await pause(700);
      const opening = await seeStage();
      await site.run(() => window.scrollTo({ top: window.innerHeight / 4, behavior: "instant" }));
      await pause(700);
      const placed = await seeStage();
      assert.ok(differing(opening, placed) > 0.005, "the phone didn't turn");

      const seen = new Set();
      // The last section at its foot only: beyond that the phone rides up with the end of the page.
      for (const screen of SECTIONS) {
        for (const to of screen === SECTIONS.at(-1) ? ["end"] : ["end", "top"]) {
          await bring(screen, to);
          // Through the change of screen, and after it.
          for (const wait of [60, 100, 100, 100, 100, 500]) {
            await pause(wait);
            const moved = differing(placed, await seeStage());
            assert.ok(moved < 0.001, `the phone moved at ${screen}, ${to}: ${moved}`);
          }
          seen.add(await site.run(() => document.querySelector(".home-stage").dataset.screen));
        }
      }
      assert.deepEqual([...seen].filter((screen) => screen !== "today"), SECTIONS, "the screens didn't all come");
    },
  );
});

test("a new screen fades in over the old one", async () => {
  // The page's frames are told an eighth of the time, so the fade lasts long enough to be seen.
  const { identifier } = await site.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `{
      const frame = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (draw) => frame((now) => draw(now / 8));
    }`,
  });
  try {
    // Today black and the first section's screen white, so a frame between them is neither.
    await withScreens(
      (screens) => {
        for (const [name, colour] of [["today", "black"], ["new-program", "white"]]) {
          const canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 142 });
          const pen = canvas.getContext("2d");
          pen.fillStyle = colour;
          pen.fillRect(0, 0, 64, 142);
          screens[name].dark = screens[name].light = canvas.toDataURL();
        }
      },
      async () => {
        await pickTheme("dark");
        await site.run(() => window.scrollTo({ top: window.innerHeight / 4, behavior: "instant" }));
        await phoneShows("today");
        await pause(700);
        await bring("new-program", "end");
        const levels = [];
        for (const started = Date.now(); Date.now() - started < 3500; ) levels.push(Math.round(await screenBrightness()));
        assert.ok(levels.at(-1) > 215, `the new screen never arrived: ${levels.join(" ")}`);
        assert.ok(levels.some((level) => level > 70 && level < 200), `no frame between the two: ${levels.join(" ")}`);
      },
    );
  } finally {
    await site.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  }
});

test("the picture holding the phone's place stays until the model has a screen to show", async () => {
  await site.send("Network.setBlockedURLs", { urls: ["*shot-*"] });
  try {
    await visit(DESK);
    await pause(2500);
    const seen = await site.run(() => ({
      model: getComputedStyle(document.querySelector(".home-stage canvas")).opacity,
      picture: [...document.querySelectorAll(".home-stage img")]
        .filter((img) => img.getClientRects().length)
        .map((img) => getComputedStyle(img).opacity),
    }));
    assert.deepEqual(seen, { model: "0", picture: ["1"] });
  } finally {
    await site.send("Network.setBlockedURLs", { urls: [] });
  }
});

for (const [where, size] of [["a desk", DESK], ["a window taller than wide", NARROW_DESK]]) {
  test(`on ${where} the picture holding the phone's place is the phone as the page first shows it`, async () => {
    await visit(size);
    for (const theme of ["dark", "light"]) {
      await pickTheme(theme);
      await phoneShows("today");
      await pause(700);
      // Shrunk, so that only where the phone stands and which way it faces count.
      const shrunk = async () => {
        const { pixels, width, height } = await seeStage();
        return { pixels: await sharp(pixels, { raw: { width, height, channels: 3 } }).resize(60).raw().toBuffer() };
      };
      const model = await shrunk();
      // The picture alone, as before the model had loaded.
      const hidden = await site.run(async () => {
        const style = document.head.appendChild(document.createElement("style"));
        style.id = "picture-alone";
        style.textContent = ".home-stage canvas { visibility: hidden } .home-stage img { opacity: 1 !important }";
        await Promise.all([...document.querySelectorAll(".home-stage img")].filter((img) => img.getClientRects().length).map((img) => img.decode()));
        return true;
      });
      assert.ok(hidden);
      await pause(300);
      const picture = await shrunk();
      await site.run(() => document.getElementById("picture-alone").remove());
      const apart = differing(model, picture);
      assert.ok(apart < 0.08, `${theme}: the picture and the model differ in ${apart} of the values`);
    }
  });
}

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
  await pickTheme("dark");
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
