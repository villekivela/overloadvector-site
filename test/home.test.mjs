import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { openSite } from "./browser.mjs";
import { page, read } from "./dist.mjs";

// The feature sections in page order, by the screen each puts on the phone.
const SECTIONS = ["new-program", "logging", "progress", "check-in"];
const DESK = { width: 1280, height: 800 };
const POCKET = { width: 390, height: 800 };

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

test("each still phone is there in both themes, and described", () => {
  const stills = [...page("/").matchAll(/<img\b[^>]*\ssrc="\/_astro\/phone-([a-z-]+)-(light|dark)\.[^>]*>/g)].map(
    ([img, screen, theme]) => ({ screen, theme, alt: img.match(/\salt="([^"]*)"/)[1] }),
  );
  assert.deepEqual(stills.filter(({ theme }) => theme === "light").map(({ screen }) => screen), ["today", ...SECTIONS]);
  for (let i = 0; i < stills.length; i += 2) {
    assert.deepEqual(stills[i + 1], { ...stills[i], theme: "dark" });
    assert.ok(stills[i].alt.length >= 12, `${stills[i].screen} isn't described`);
  }
});

let site;
before(async () => (site = await openSite()));
after(() => site?.close());

/** Opens the home page as a visitor with that window would, and returns what it asked for. */
async function visit({ width, height }, { route = "/", reducedMotion = false } = {}) {
  await site.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await site.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: "dark" },
      { name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" },
    ],
  });
  const before = site.requests.length;
  await site.visit(route);
  return () => site.requests.slice(before);
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

const phoneShows = (facing, screen) =>
  until(
    `the phone showing its ${facing} with ${screen}`,
    (facing, screen) => {
      const { dataset } = document.querySelector(".home-stage");
      return "ready" in dataset && dataset.facing === facing && dataset.screen === screen;
    },
    facing,
    screen,
  );

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

for (const transition of ["fade", "turn"]) {
  test(`on a desk the phone turns to its front with the scroll and shows each section's screen (${transition})`, async () => {
    const requests = await visit(DESK, { route: `/?transition=${transition}` });
    await phoneShows("back", "today");
    assert.ok(askedForThree(requests()), "three.js wasn't asked for");
    assert.deepEqual(await stillsSeen().catch(() => "the canvas"), "the canvas");

    await scrollTo(".home .hero .actions");
    await site.run(() => window.scrollBy({ top: window.innerHeight * 0.45, behavior: "instant" }));
    await phoneShows("front", "today");
    for (const screen of SECTIONS) {
      await scrollTo(`.home [data-screen="${screen}"]`);
      await phoneShows("front", screen);
    }
    // The phone is still pinned in view beside the last section.
    const pinned = await site.run(() => {
      const { top, bottom } = document.querySelector(".home-stage").getBoundingClientRect();
      return top >= 0 && bottom <= window.innerHeight;
    });
    assert.ok(pinned, "the phone has scrolled away");

    await scrollTo(`.home [data-screen="${SECTIONS[0]}"]`);
    await phoneShows("front", SECTIONS[0]);
    await scrollTo(null);
    await phoneShows("back", "today");
  });
}

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
  await phoneShows("front", "logging");
  const settle = () => site.run(() => new Promise((resolve) => setTimeout(resolve, 700)));
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
