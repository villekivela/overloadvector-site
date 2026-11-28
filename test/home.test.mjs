import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { openSite } from "./browser.mjs";
import { builtFiles, page, read } from "./dist.mjs";

// The feature sections in page order, by the screen each puts on the live phone. Technique's is
// the mannequin's clip, which shows its muscles too.
const SECTIONS = ["new-program", "logging", "mannequin", "progress", "check-in"];
// The pictures of the phone in the sections, where there is no live phone: Technique's is the
// mannequin with its muscles lit, as the list beside it is.
const PICTURED = ["new-program", "logging", "muscles", "progress", "check-in"];
// The screens the phone plays a clip of, in place of their still.
const CLIPS = ["logging", "mannequin", "check-in"];
const DESK = { width: 1280, height: 800 };
const POCKET = { width: 390, height: 800 };
// A desk's tall window, where a section can be whole in view and still low in it.
const HIGH_DESK = { width: 1440, height: 1100 };
// A window taller than it is wide, where the phone is sized by its side's width.
const NARROW_DESK = { width: 1000, height: 1200 };

test("the home page names Overload Vector, a word a line", () => {
  const [, name] = page("/").match(/<h1[^>]*>(.*?)<\/h1>/s);
  assert.match(name, /^\s*<span[^>]*>Overload<\/span>\s+<span[^>]*>Vector<\/span>\s*$/);
});

test("the home page's address is on overloadvector.com", () => {
  assert.match(page("/"), /<link rel="canonical" href="https:\/\/overloadvector\.com\/"\s*\/?>/);
});

const BETA = /href="https:\/\/github\.com\/villekivela\/overloadvector-releases\/releases\/latest"[^>]*>\s*Get the beta/;

test("the home page's first buttons lead to the band it ends with and to the docs, and the band offers the beta", () => {
  const html = page("/");
  const hero = html.slice(html.indexOf("<h1"), html.indexOf('class="facts'));
  assert.match(hero, /href="#start"[^>]*>\s*Get the beta/);
  assert.match(hero, /href="\/docs\/getting-started\/"[^>]*>\s*Read the docs/);
  const band = html.slice(html.indexOf('id="start"'), html.indexOf('<footer class="site-footer'));
  assert.match(band, /<h2[^>]*>\s*Start training\s*<\/h2>/);
  assert.match(band, BETA);
  assert.match(band, /href="\/docs\/getting-started\/"[^>]*>\s*Install guide/);
});

test("the Program section draws its block: twelve weeks of three days, four weeks done and the next day marked", () => {
  const html = page("/");
  const block = html.slice(html.indexOf('class="block'), html.indexOf('class="points', html.indexOf('class="block')));
  const days = [...block.matchAll(/<i\b([^>]*)><\/i>/g)].map(([, set]) => set.match(/class="(done|now)"/)?.[1] ?? "");
  assert.equal(days.length, 36);
  // A row is a training day and a column a week: weeks 1 to 4 are done, and week 5 has day A done and day B next.
  const row = (done, fifth) => [...Array(done).fill("done"), fifth, ...Array(7).fill("")];
  assert.deepEqual(days, [...row(4, "done"), ...row(4, "now"), ...row(4, "")]);
  assert.match(block, /role="img" aria-label="A 12-week block of three training days a week, with four weeks done and week 5's second day next"/);
});

test("the facts under the hero each carry an icon, and the closing band doesn't say them again", () => {
  const html = page("/");
  const facts = html.slice(html.indexOf('class="facts'), html.indexOf("</ul>", html.indexOf('class="facts')));
  const items = facts.split("<li").slice(1);
  assert.equal(items.length, 3);
  for (const item of items) assert.match(item, /^[^>]*>\s*<svg[^>]*aria-hidden="true"/, "a fact starts with an icon that a screen reader skips");
  const band = html.slice(html.indexOf('id="start"'), html.indexOf('<footer class="site-footer')).replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(band, /Android|free|account|ads|trackers/i);
});

test("the outcome buttons stand apart, and the reps-in-reserve numbers are larger than the text beside them", async () => {
  await visit(DESK);
  const seen = await site.run(() => {
    const [first, second] = [...document.querySelectorAll(".outcomes button")].map((button) => button.getBoundingClientRect());
    const size = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return { gap: second.left - first.right, chip: size(".rir button"), note: size(".rir .note") };
  });
  assert.ok(seen.gap >= 8, `the outcomes are ${seen.gap}px apart`);
  assert.ok(seen.chip >= seen.note * 1.2, `a chip's number is ${seen.chip}px beside ${seen.note}px text`);
});

test("the Logging section's example set is the one its clip logs: 50 kg for 8 reps", () => {
  const html = page("/");
  const set = html.slice(html.indexOf(">", html.indexOf('class="set"')) + 1, html.indexOf('<div class="rir'));
  assert.equal(set.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), "50 kg × 8 reps");
});

const text = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

test("the home page keeps a space between its words and the link to the privacy policy", () => {
  assert.match(text(page("/")), /and the privacy policy lists each case/);
});

test("the home page leaves the processor to the install guide", () => {
  assert.doesNotMatch(text(page("/")), /64-bit|ARM/);
});

test("the home page's example Change swaps an exercise without calling either one safer", () => {
  const html = page("/");
  const change = text(html.slice(html.indexOf('class="change"'), html.indexOf('class="verdict"')));
  assert.match(change, /Machine chest press/);
  assert.doesNotMatch(change, /easier|safer|joints/i);
});

test("the Progression section draws three steps of the gym's weights", () => {
  const steps = [...page("/").matchAll(/<g\b[^>]*data-kg="([\d.]+)"/g)].map(([, kg]) => kg);
  assert.deepEqual(steps.sort(), ["57.5", "60", "62.5"]);
});

test("no style on the site is cyan, which a lit muscle was", () => {
  for (const path of builtFiles().filter((file) => /\.(css|html)$/.test(file))) {
    assert.doesNotMatch(read(path).toString("utf8"), /#1fd6f0|#0aa9c4|\bcyan\b/i, path);
  }
});

test("the search is on every page but the home page", () => {
  const header = (html) => html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  assert.doesNotMatch(header(page("/")), /site-search/);
  assert.match(header(page("/faq/")), /site-search/);
  assert.match(header(page("/docs/logging/")), /site-search/);
});

test("each still phone is there in both themes, and described", () => {
  const stills = [...page("/").matchAll(/<img\b[^>]*\ssrc="\/_astro\/phone-([a-z-]+)-(light|dark)\.[^>]*>/g)].map(
    ([img, screen, theme]) => ({ screen, theme, alt: img.match(/\salt="([^"]*)"/)?.[1] ?? "" }),
  );
  // After the screens, Today again: it holds the live phone's place, where the canvas speaks for it.
  assert.deepEqual(stills.filter(({ theme }) => theme === "light").map(({ screen }) => screen), ["today", ...PICTURED, "today"]);
  for (let i = 0; i < stills.length; i += 2) assert.deepEqual(stills[i + 1], { ...stills[i], theme: "dark" });
  for (const { screen, alt } of stills.slice(0, -2)) assert.ok(alt.length >= 12, `${screen} isn't described`);
  assert.deepEqual(stills.slice(-2).map(({ alt }) => alt), ["", ""]);
});

test("each clip comes as a VP9 WebM of about 1 MB or less, and as an H.264 MP4 for a browser without VP9", () => {
  const screens = JSON.parse(page("/").match(/data-screens="([^"]*)"/)[1].replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&"));
  const played = Object.entries(screens).filter(([, { clip }]) => clip);
  assert.deepEqual(played.map(([screen]) => screen), CLIPS);
  for (const [screen, { clip }] of played) {
    for (const theme of ["light", "dark"]) {
      const webm = read(clip[theme].webm.slice(1));
      const mp4 = read(clip[theme].mp4.slice(1));
      assert.ok(webm.includes("V_VP9"), `${screen} ${theme}: the WebM isn't VP9`);
      assert.ok(webm.length <= 1.1e6, `${screen} ${theme}: the WebM is ${webm.length} bytes`);
      assert.ok(mp4.includes("avc1"), `${screen} ${theme}: the MP4 isn't H.264`);
    }
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

/** The clips the page asked for. */
const clipsAskedFor = (requests) => requests.filter((url) => /\.(webm|mp4)$/.test(new URL(url).pathname));

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
  assert.deepEqual(clipsAskedFor(requests()), [], "a clip was asked for before its section");
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
  // The phone is still pinned in view beside the last section. It takes the middle 0.74 of its
  // canvas (phone.js, FILL), which is itself taller than the view.
  const pinned = await site.run(() => {
    const { top, height } = document.querySelector(".home-stage").getBoundingClientRect();
    const header = document.querySelector("header.header").offsetHeight;
    return top + 0.13 * height >= header && top + 0.87 * height <= window.innerHeight;
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
  test(`on ${where} a link to a section lands on its screen`, async () => {
    await visit(size);
    await phoneShows("today");
    await site.run(() => (location.hash = "#technique"));
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

/** The live phone's side of the page as a visitor sees it now, under the header, as raw pixels. */
async function seeStage() {
  const box = await site.run(() => {
    const { left, width } = document.querySelector(".home-stage").getBoundingClientRect();
    const top = document.querySelector("header.header").offsetHeight;
    return { left: Math.round(left), top, width: Math.floor(width), height: window.innerHeight - top };
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
      // Without the big mark and the end of the name behind the phone, which scroll away with
      // the top of the page.
      await site.run(() => (document.head.appendChild(document.createElement("style")).textContent = ".mark-big, .hero h1 { visibility: hidden }"));
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

/** How much of the phone's side changes over `milliseconds`. */
async function changeOver(milliseconds) {
  const before = await seeStage();
  await pause(milliseconds);
  return differing(before, await seeStage());
}

const playing = (screen) =>
  until(
    `the phone playing ${screen ?? "nothing"}`,
    (screen) => (document.querySelector(".home-stage").dataset.playing ?? null) === screen,
    screen,
  );

test("a section with a clip plays it on the phone while it is current, and stops it when another takes over", async () => {
  await visit(DESK);
  await phoneShows("today");
  for (const theme of ["dark", "light"]) {
    await pickTheme(theme);
    for (const screen of CLIPS) {
      await bring(screen, "end");
      await phoneShows(screen);
      await playing(screen);
      assert.ok((await changeOver(1500)) > 0.002, `${screen} in ${theme} stood still`);
      // Progression has no clip: the phone shows its still, and nothing plays.
      await bring("progress", "end");
      await phoneShows("progress");
      await playing(null);
      await pause(500);
      assert.ok((await changeOver(1500)) < 0.0005, `the phone kept moving after ${screen} in ${theme}`);
    }
  }
});

test("each clip lasts 4 to 8 s, or up to 12 with screens to read, and its last frame leads into its first as one frame leads into the next", async () => {
  await visit(DESK);
  const clips = await site.run(async () => {
    const screens = JSON.parse(document.querySelector(".home-stage").dataset.screens);
    const seen = {};
    for (const [screen, { clip }] of Object.entries(screens)) {
      for (const [theme, { webm }] of Object.entries(clip ?? {})) {
        const video = Object.assign(document.createElement("video"), { muted: true, preload: "auto", src: webm });
        await new Promise((resolve, reject) => {
          video.addEventListener("canplaythrough", resolve, { once: true });
          video.addEventListener("error", () => reject(new Error(`${webm} didn't load`)), { once: true });
        });
        const pen = Object.assign(document.createElement("canvas"), { width: 160, height: 357 }).getContext("2d", { willReadFrequently: true });
        const frameAt = async (time) => {
          video.currentTime = time;
          await new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
          pen.drawImage(video, 0, 0, 160, 357);
          return pen.getImageData(0, 0, 160, 357).data;
        };
        // The share of values that differ by more than a rounding's worth.
        const apart = (one, other) => {
          let count = 0;
          for (let i = 0; i < one.length; i += 4) for (let c = 0; c < 3; c++) if (Math.abs(one[i + c] - other[i + c]) > 12) count++;
          return count / ((one.length / 4) * 3);
        };
        const first = await frameAt(0);
        const second = await frameAt(1 / 30);
        const last = await frameAt(video.duration - 1 / 60);
        // How long each stretch lasts in which nothing on the screen changes, looked at every tenth of a second.
        const stills = [];
        if (screen === "check-in") {
          let [before, since] = [first, 0];
          for (let time = 0.1; time < video.duration; time += 0.1) {
            const now = await frameAt(time);
            if (apart(before, now) > 0.0005) {
              stills.push(time - 0.1 - since);
              since = time;
            }
            before = now;
          }
          stills.push(video.duration - since);
        }
        seen[`${screen} ${theme}`] = { duration: video.duration, seam: apart(last, first), step: apart(first, second), stills };
      }
    }
    return seen;
  });
  assert.deepEqual(Object.keys(clips).sort(), CLIPS.flatMap((screen) => [`${screen} dark`, `${screen} light`]).sort());
  for (const [name, { duration, seam, step, stills }] of Object.entries(clips)) {
    // Coaching's has a question and a proposed Change to read, and Coach to come back to: each
    // stands still long enough to, which takes the clip past 8 s.
    const reading = name.startsWith("check-in");
    assert.ok(duration >= 4 && duration <= (reading ? 12 : 8), `${name} lasts ${duration} s`);
    if (reading) {
      const longest = stills.sort((a, b) => b - a).slice(0, 3).map((still) => Math.round(still * 10) / 10);
      assert.ok(longest[0] >= 2.6 && longest[1] >= 2.1 && longest[2] >= 0.7, `${name} holds its screens for ${longest} s`);
    }
    assert.ok(seam <= step + 0.002, `${name} jumps at its loop: ${seam} of the values change, against ${step} from one frame to the next`);
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

test("a clip on the phone has the colours of its first frame's still, in both themes", async () => {
  const brightness = async (theme, clips) => {
    if (!clips) await site.send("Network.setBlockedURLs", { urls: ["*.webm", "*.mp4"] });
    try {
      await visit(DESK);
      await pickTheme(theme);
      await phoneShows("today");
      // Logging, whose opening changes no more than a few digits.
      await bring("logging", "end");
      await phoneShows("logging");
      if (clips) await playing("logging");
      await pause(700);
      return screenBrightness();
    } finally {
      await site.send("Network.setBlockedURLs", { urls: [] });
    }
  };
  for (const theme of ["dark", "light"]) {
    const still = await brightness(theme, false);
    const played = await brightness(theme, true);
    assert.ok(Math.abs(played - still) < 12, `${theme}: the still ${still}, the clip ${played}`);
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
        // At once: the picture's own fade would still be under way when it is looked at.
        style.textContent = ".home-stage canvas { visibility: hidden } .home-stage img { opacity: 1 !important; transition: none !important }";
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

// The stills a visitor sees.
const STILLS = ["today", ...PICTURED];

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
  test(`${who} gets the still phones in the picked theme, and no three.js or clip`, async () => {
    const requests = await open();
    await pickTheme("dark");
    assert.deepEqual(await stillsSeen(), STILLS.map((screen) => `phone-${screen}-dark`));
    await pickTheme("light");
    assert.deepEqual(await stillsSeen(), STILLS.map((screen) => `phone-${screen}-light`));
    assert.equal(askedForThree(requests()), false, "three.js was asked for");
    assert.deepEqual(clipsAskedFor(requests()), [], "a clip was asked for");
  });
}

test("pressing a reps-in-reserve chip marks it and says what it means", async () => {
  await visit(POCKET);
  const seen = await site.run(() => {
    const chips = [...document.querySelectorAll(".rir button")];
    const state = () => ({ pressed: chips.filter((chip) => chip.getAttribute("aria-pressed") === "true").map((chip) => chip.textContent), says: document.querySelector("#rir-say").textContent });
    const before = state();
    chips[0].click();
    return { before, after: state() };
  });
  assert.deepEqual(seen.before, { pressed: ["2"], says: "2 in reserve. Two more reps were possible." });
  assert.deepEqual(seen.after, { pressed: ["0"], says: "0 in reserve. That was the last rep possible." });
});

test("saying how the last session went shows the next weight, its step and its plates", async () => {
  await visit(POCKET);
  const seen = await site.run(() => {
    const state = () => ({
      kg: document.querySelector("#next-kg").textContent,
      why: document.querySelector("#next-why").parentElement.textContent.trim().replace(/\s+/g, " "),
      step: [...document.querySelectorAll("#rungs g.on")].map((step) => step.dataset.kg),
      plates: [...document.querySelectorAll("#next-plates span")].map((plate) => plate.textContent.trim()),
    });
    const before = state();
    [...document.querySelectorAll(".outcomes button")].find((button) => button.textContent.includes("under 6")).click();
    return { before, after: state() };
  });
  assert.deepEqual(seen.before, { kg: "62.5", why: "Up one step. A side, on plates this gym has:", step: ["62.5"], plates: ["1 × 20", "1 × 10", "1 × 1.25"] });
  assert.deepEqual(seen.after, { kg: "57.5", why: "One step down, about 5% lighter. A side, on plates this gym has:", step: ["57.5"], plates: ["1 × 20", "1 × 5", "1 × 2.5", "1 × 1.25"] });
});

// The main muscle's dot as red, green and blue out of 255, however the browser writes it.
const dot = () =>
  site.run(() => {
    const colour = getComputedStyle(document.querySelector(".muscles li.main"), "::before").backgroundColor;
    const parts = colour.match(/[\d.]+/g).slice(0, 3).map(Number);
    return (colour.startsWith("color(") ? parts.map((part) => Math.round(part * 255)) : parts).join(" ");
  });
const ORANGE = { dark: "232 87 28", light: "224 82 24" };

test("without the live phone Technique's muscles are lit in the signal's orange, with no switch, beside the still of them", async () => {
  assert.doesNotMatch(page("/"), /id="layer"|class="switch/);
  await visit(POCKET);
  for (const theme of ["dark", "light"]) {
    await pickTheme(theme);
    assert.deepEqual((await stillsSeen()).filter((still) => /mannequin|muscles/.test(still)), [`phone-muscles-${theme}`]);
    assert.equal(await dot(), ORANGE[theme]);
  }
});

test("on the live phone Technique's muscles light while the clip shows them lit, and dim while it doesn't", async () => {
  await visit(DESK);
  await phoneShows("today");
  // The list changes at once, so each look finds it wholly lit or wholly dim.
  await site.run(() => {
    document.head.append(Object.assign(document.createElement("style"), { textContent: ".muscles li::before { transition: none !important }" }));
  });
  for (const theme of ["dark", "light"]) {
    await pickTheme(theme);
    await bring("mannequin", "end");
    await phoneShows("mannequin");
    await playing("mannequin");
    // Two loops, looked at as often as a look takes: how orange the phone's side is, and
    // whether the list is lit.
    const looks = [];
    for (const end = Date.now() + 17000; Date.now() < end; await pause(60)) {
      const [{ pixels }, colour] = await Promise.all([seeStage(), dot()]);
      let orange = 0;
      for (let i = 0; i < pixels.length; i += 3) if (pixels[i] > 180 && pixels[i + 1] > 40 && pixels[i + 1] < 130 && pixels[i + 2] < 80) orange++;
      looks.push({ onPhone: orange > 150, onList: colour === ORANGE[theme] });
    }
    // A look takes a moment, so the two may differ in a look beside a change, and never between.
    const steady = looks.filter((look, at) => at > 0 && looks[at - 1].onPhone === look.onPhone && looks[at + 1]?.onPhone === look.onPhone);
    const [lit, dim] = [steady.filter(({ onPhone }) => onPhone), steady.filter(({ onPhone }) => !onPhone)];
    assert.ok(lit.length >= 3 && dim.length >= 3, `${theme}: of ${looks.length} looks, the clip was steadily lit in ${lit.length} and dim in ${dim.length}`);
    const apart = steady.filter(({ onPhone, onList }) => onPhone !== onList).length;
    assert.equal(apart, 0, `${theme}: the list and the clip differed in ${apart} of ${steady.length} steady looks`);
    // Away from Technique the list is lit again.
    await bring("progress", "end");
    await playing(null);
    assert.equal(await dot(), ORANGE[theme]);
  }
});

test("the Coaching card's Accept is drawn as the app draws it: the theme's orange, near-black words, modest rounding", async () => {
  await visit(POCKET);
  for (const theme of ["dark", "light"]) {
    await pickTheme(theme);
    const seen = await site.run(() => {
      const accept = document.querySelector(".change .verdict span:last-child");
      const style = getComputedStyle(accept);
      const rgb = (colour) => {
        const parts = colour.match(/[\d.]+/g).slice(0, 3).map(Number);
        return (colour.startsWith("color(") ? parts.map((part) => Math.round(part * 255)) : parts).join(" ");
      };
      return { words: accept.textContent, fill: rgb(style.backgroundColor), ink: rgb(style.color), round: parseFloat(style.borderTopLeftRadius) / accept.offsetHeight };
    });
    assert.deepEqual({ ...seen, round: undefined }, { words: "Accept", fill: ORANGE[theme], ink: "17 17 17", round: undefined });
    assert.ok(seen.round > 0.1 && seen.round < 0.3, `its corners are ${seen.round} of its height`);
  }
});

test("a window made narrow while the clip shows the muscles dim has them lit beside the still", async () => {
  await visit(DESK);
  await phoneShows("today");
  await bring("mannequin", "end");
  await until("the clip showing its muscles dim", () => document.querySelector(".home-stage").hasAttribute("data-unlit"));
  await site.send("Emulation.setDeviceMetricsOverride", { ...POCKET, deviceScaleFactor: 1, mobile: false });
  await until("the stills", () => document.querySelector(".home-stage canvas").getClientRects().length === 0);
  await pause(500);
  assert.equal(await dot(), ORANGE[await site.run(() => document.documentElement.dataset.theme)]);
});

for (const [where, size, behind] of [["a desk", DESK, ".home-stage"], ["a phone", POCKET, ".hero .phone-still img"]]) {
  test(`on ${where} the big mark stands behind the phone the page opens with`, async () => {
    await visit(size);
    const seen = await site.run((behind) => {
      const box = (element) => element.getBoundingClientRect();
      const mark = [...document.querySelectorAll(".mark-big")].filter((mark) => mark.getClientRects().length);
      const phone = [...document.querySelectorAll(behind)].find((phone) => phone.getClientRects().length);
      const [m, p] = [box(mark[0]), box(phone)];
      // The phone's middle lies on the mark.
      const [x, y] = [p.left + p.width / 2, p.top + p.height / 2];
      return { marks: mark.length, behind: m.left < x && x < m.right && m.top < y && y < m.bottom };
    }, behind);
    assert.deepEqual(seen, { marks: 1, behind: true });
  });
}
