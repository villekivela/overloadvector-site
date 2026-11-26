import assert from "node:assert/strict";
import { test } from "node:test";
import { story } from "../src/phone/story.js";

// A page 900 px tall in view, whose phone turns over the first 600 px of scroll, and two feature
// sections of 700 px each from 1000 px down.
const page = {
  viewport: 900,
  turnOver: 600,
  sections: [
    { screens: ["new-program"], top: 1000, bottom: 1700 },
    { screens: ["logging"], top: 1700, bottom: 2400 },
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

test("past the hero the front rests on Today until a section nears the top third", () => {
  assert.deepEqual(at(549), { turn: 0.915, screen: "today", drift: 0 });
  assert.deepEqual(at(699), { turn: 1, screen: "today", drift: 0 });
});

test("the section across the line a third down the view sets the screen", () => {
  assert.equal(at(700).screen, "new-program");
  assert.equal(at(1399).screen, "new-program");
  assert.equal(at(1400).screen, "logging");
  assert.equal(at(5000).screen, "logging");
});

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

test("the drift sways once through a section: one way, level at its middle, then the other", () => {
  near(at(875).drift, -1);
  near(at(1050).drift, 0);
  near(at(1225).drift, 1);
});

test("the drift is level where one section hands over to the next, so the phone never jumps", () => {
  near(at(699).drift, 0);
  near(at(700).drift, 0);
  // A pixel before the handover the sway has all but come back to level.
  assert.ok(Math.abs(at(1399).drift - at(1400).drift) < 0.01);
  near(at(1400).drift, 0);
  near(at(5000).drift, 0);
});

test("a section with two screens shows the first through its first half and the second after", () => {
  const two = { ...page, sections: [{ screens: ["exercise", "exercise-muscles"], top: 1000, bottom: 1700 }] };
  const shown = (scrollY) => story({ ...two, scrollY }).screen;
  assert.equal(shown(700), "exercise");
  assert.equal(shown(1049), "exercise");
  assert.equal(shown(1050), "exercise-muscles");
  assert.equal(shown(5000), "exercise-muscles");
});

test("a bounce above the top doesn't turn the phone past its back", () => {
  assert.equal(at(-40).turn, 0);
});
