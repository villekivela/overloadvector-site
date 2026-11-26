import assert from "node:assert/strict";
import { test } from "node:test";
import { story } from "../src/phone/story.js";

// A page 900 px tall in view, whose phone turns over the first 600 px of scroll, and two feature
// sections of 700 px each from 1000 px down.
const page = {
  viewport: 900,
  turnOver: 600,
  sections: [
    { screen: "new-program", top: 1000, bottom: 1700 },
    { screen: "logging", top: 1700, bottom: 2400 },
  ],
};
const at = (scrollY) => story({ ...page, scrollY });

test("at the top the phone shows its back, with Today waiting on the screen", () => {
  assert.deepEqual(at(0), { turn: 0, screen: "today", drift: 0 });
});

test("the phone turns with the scroll, and back again", () => {
  assert.equal(at(150).turn, 0.25);
  assert.equal(at(450).turn, 0.75);
  assert.equal(at(150).turn, 0.25);
});

test("past the hero the front stays, on Today until a section reaches the middle", () => {
  assert.deepEqual(at(549), { turn: 0.915, screen: "today", drift: 0 });
  assert.equal(at(700).turn, 1);
});

test("the section across the middle of the view sets the screen", () => {
  assert.equal(at(550).screen, "new-program");
  assert.equal(at(1249).screen, "new-program");
  assert.equal(at(1250).screen, "logging");
  assert.equal(at(5000).screen, "logging");
});

test("the drift runs from -1 to 1 as a section passes the middle", () => {
  assert.equal(at(550).drift, -1);
  assert.equal(at(900).drift, 0);
  assert.equal(at(1075).drift, 0.5);
  assert.equal(at(5000).drift, 1);
});

test("a bounce above the top doesn't turn the phone past its back", () => {
  assert.equal(at(-40).turn, 0);
});
