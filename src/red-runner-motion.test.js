import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedRunnerMotion, sampleRedJump, sampleRedRun } from './red-runner-motion.js';

const state = overrides => ({ moving: true, jumping: false, jumpProgress: 0, slide: false, slideProgress: 0, menu: false, speed: 16, laneError: 0, ...overrides });
const jump = progress => state({ jumping: true, jumpProgress: progress });
const slide = seconds => state({ slide: true, slideProgress: seconds / .85 });
const dominant = pose => pose.mix < .5 ? pose.from : pose.to;
const jumpPosition = pose => Number(pose.from.slice(4)) * (1 - pose.mix) + Number(pose.to.slice(4)) * pose.mix;
const jumpWeights = pose => [0, 1, 2].map(index => (pose.from === `jump${index}` ? 1 - pose.mix : 0) + (pose.to === `jump${index}` ? pose.mix : 0));
const weights = pose => {
  const result = new Map([[pose.from, 1 - pose.mix]]);
  result.set(pose.to, (result.get(pose.to) ?? 0) + pose.mix);
  return result;
};
function assertPoseClose(actual, expected, tolerance = 1e-10) {
  const a = weights(actual), b = weights(expected);
  for (const id of new Set([...a.keys(), ...b.keys()])) assert.ok(Math.abs((a.get(id) ?? 0) - (b.get(id) ?? 0)) < tolerance, `${id}: ${a.get(id) ?? 0} vs ${b.get(id) ?? 0}`);
}
function beginSlide(cycle = .15) {
  const motion = createRedRunnerMotion();
  const running = motion.update(cycle * 8 / 13, state());
  const entering = motion.update(0, slide(0));
  return { motion, running, entering };
}
function advance(motion, seconds, fps, makeState) {
  const count = Math.floor(seconds * fps);
  for (let frame = 1; frame <= count; frame++) motion.update(1 / fps, makeState(frame / fps));
  return motion.update(seconds - count / fps, makeState(seconds));
}

test('upright jump tucks at the apex and retraces the same poses on descent without inversion', () => {
  const motion = createRedRunnerMotion();
  const visited = new Set();
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const pose = motion.update(.0009, jump(i / 1000));
    assert.match(pose.from, /^jump[0-2]$/);
    assert.match(pose.to, /^jump[0-2]$/);
    assert.ok(pose.mix >= 0 && pose.mix <= 1);
    const position = jumpPosition(pose);
    assert.ok(i <= 500 ? position >= previous - 1e-12 : position <= previous + 1e-12);
    visited.add(dominant(pose)); previous = position;
    if (i === 500) assert.equal(dominant(pose), 'jump2');
  }
  assert.deepEqual([...visited].sort(), ['jump0', 'jump1', 'jump2']);
  const landing = motion.update(.016, state());
  assert.equal(landing.from, 'jump0');
  assert.equal(landing.to, 'run0');
  assert.equal(landing.landing, 1);
  assert.equal(motion.update(.2, state()).landing, 0);
});

test('jump samples have matching endpoints and symmetric pose weights at mirrored times', () => {
  for (const progress of [0, 1]) assert.equal(jumpPosition(sampleRedJump(progress)), 0);
  assert.equal(jumpPosition(sampleRedJump(.5)), 2);
  for (let i = 0; i <= 500; i++) {
    const progress = i / 1000;
    const up = jumpWeights(sampleRedJump(progress));
    const down = jumpWeights(sampleRedJump(1 - progress));
    for (let pose = 0; pose < 3; pose++) assert.ok(Math.abs(up[pose] - down[pose]) < 1e-12, `pose ${pose} at ${progress}`);
  }
});

test('jump pose is determined by simulation progress at different frame rates', () => {
  for (const rate of [30, 60, 120]) for (const progress of [.12, .3, .5, .7, .93]) {
    const motion = createRedRunnerMotion();
    for (let frame = 0; frame <= rate * progress * .9; frame++) motion.update(1 / rate, jump(frame / rate / .9));
    const pose = motion.update(0, jump(progress));
    const expected = sampleRedJump(progress);
    assert.equal(pose.from, expected.from);
    assert.equal(pose.to, expected.to);
    assert.equal(pose.mix, expected.mix);
  }
});

test('slide passes through crouch and dive, holds one belly pose, then retraces the same route', () => {
  for (const cycle of [.15, .4]) {
    const { motion } = beginSlide(cycle);
    const anchor = cycle < .25 ? 'run0' : 'run4';
    const expected = [[.035, anchor], [.085, 'action12'], [.13, 'action13'], [.18, 'action14'], [.45, 'action14'], [.67, 'action14'], [.72, 'action13'], [.765, 'action12'], [.815, anchor], [.85, anchor]];
    for (const [elapsed, id] of expected) {
      const pose = motion.update(.01, slide(elapsed));
      assert.equal(dominant(pose), id, `slide at ${elapsed}s`);
      assert.ok(pose.mix >= 0 && pose.mix <= 1);
      assert.notEqual(pose.from, 'action15');
      assert.notEqual(pose.to, 'action15');
    }
  }
});

test('refreshing a held slide preserves its stable belly posture without kicking or crouching', () => {
  const { motion } = beginSlide();
  const before = motion.update(.01, slide(.43));
  const after = motion.update(0, slide(0));
  assertPoseClose(after, before);
  assert.equal(after.slideBlend, 1);
  for (const elapsed of [.03, .1, .3, .6]) {
    const pose = motion.update(.03, slide(elapsed));
    assert.equal(pose.from, 'action14');
    assert.equal(pose.to, 'action14');
    assert.equal(pose.slideBlend, 1);
  }
});

test('refreshing during any slide-entry stage preserves elapsed age instead of restarting', () => {
  for (const elapsed of [.015, .08, .15]) {
    const { motion } = beginSlide();
    const before = motion.update(elapsed, slide(elapsed));
    const refreshed = motion.update(0, slide(0));
    assertPoseClose(refreshed, before);
    assert.equal(refreshed.slideBlend, before.slideBlend);
    const after = motion.update(.02, slide(.02));
    const uninterrupted = beginSlide().motion.update(elapsed + .02, slide(elapsed + .02));
    assertPoseClose(after, uninterrupted);
    assert.equal(after.slideBlend, uninterrupted.slideBlend);
  }
});

test('pause freezes pose, lean, stride, slide and cross-action transitions', () => {
  for (const active of [jump(.35), slide(.08), state({ laneError: 2 }), state({ menu: true })]) {
    const motion = createRedRunnerMotion();
    motion.update(.016, state());
    const before = motion.update(.016, active);
    for (let i = 0; i < 20; i++) assert.deepEqual(motion.update(.1, { ...active, moving: false }), before);
    const after = motion.update(.016, active);
    const uninterrupted = createRedRunnerMotion();
    uninterrupted.update(.016, state());
    uninterrupted.update(.016, active);
    assert.deepEqual(after, uninterrupted.update(.016, active));
  }
});

test('jump and slide interrupt each other through a bounded two-pose blend', () => {
  const motion = createRedRunnerMotion();
  const midJump = motion.update(.016, jump(.5));
  const interrupted = motion.update(.016, slide(.016));
  assert.equal(interrupted.from, dominant(midJump));
  assert.equal(interrupted.to, 'run0');
  assert.equal(interrupted.landing, 0);
  const sliding = motion.update(.1, slide(.12));
  const takeoff = motion.update(.016, jump(.016 / .9));
  assert.equal(takeoff.to, 'jump0');
  assert.ok(takeoff.slideBlend > 0 && takeoff.slideBlend < sliding.slideBlend);
  assert.equal(motion.update(.1, jump(.116 / .9)).slideBlend, 0);
});

test('jump entry keeps jump0 as its fixed target throughout the 65 ms transition', () => {
  const motion = createRedRunnerMotion();
  motion.update(.1, state());
  for (let frame = 1; frame <= 6; frame++) {
    const pose = motion.update(.01, jump(frame * .01 / .9));
    assert.equal(pose.to, 'jump0');
  }
  const lastEntry = motion.update(.004, jump(.064 / .9));
  assert.equal(lastEntry.to, 'jump0');
  const released = motion.update(.002, jump(.066 / .9));
  assert.match(released.from, /^jump[0-2]$/);
  assert.match(released.to, /^jump[0-2]$/);
  assert.ok(jumpPosition(released) < .01, 'transition must hand off close to its upright target');
});

test('slide entry retains the complete running silhouette and settles toward its nearest leg', () => {
  for (const cycle of [.15, .4, .65, .9]) {
    const { motion, running, entering } = beginSlide(cycle);
    assertPoseClose(entering, running);
    assert.equal(entering.slideBlend, 0);
    const anchor = running.mix < .5 ? 'run0' : 'run4';
    const middle = motion.update(.0175, slide(.0175));
    assert.equal(middle.from, 'run0');
    assert.equal(middle.to, 'run4');
    assert.ok(Math.abs(middle.mix - (anchor === 'run0' ? 0 : 1)) < Math.abs(running.mix - (anchor === 'run0' ? 0 : 1)));
    const settled = motion.update(.0175, slide(.035));
    assert.equal(dominant(settled), anchor);
    assert.equal(settled.slideBlend, 0);
    const justAfter = motion.update(.0001, slide(.0351));
    assertPoseClose(justAfter, settled, .00001);
  }
});

test('slide settles the outgoing run bounce without a vertical snap, including entry refresh', () => {
  const { motion, running, entering } = beginSlide(.25);
  assert.ok(Math.abs(running.bounce - .05) < 1e-12);
  assert.equal(entering.bounce, running.bounce);
  const middle = motion.update(.0175, slide(.0175));
  assert.ok(middle.bounce > 0 && middle.bounce < running.bounce);
  const refreshed = motion.update(0, slide(0));
  assert.equal(refreshed.bounce, middle.bounce);
  assertPoseClose(refreshed, middle);
  assert.equal(motion.update(.0175, slide(.0175)).bounce, 0);
});

test('slide descent and rise use exactly mirrored pose weights and body height', () => {
  for (const cycle of [.15, .4]) for (let i = 0; i <= 50; i++) {
    const elapsed = .035 + .145 * i / 50;
    const down = beginSlide(cycle).motion.update(elapsed, slide(elapsed));
    const up = beginSlide(cycle).motion.update(.85 - elapsed, slide(.85 - elapsed));
    assertPoseClose(down, up);
    assert.ok(Math.abs(down.slideBlend - up.slideBlend) < 1e-12);
  }
});

test('refreshing anywhere in slide exit reverses the current posture smoothly over 120 ms', () => {
  for (const elapsed of [.69, .74, .79, .83]) {
    const { motion } = beginSlide(.4);
    const before = motion.update(elapsed, slide(elapsed));
    const repeated = motion.update(0, slide(0));
    assertPoseClose(repeated, before);
    assert.equal(repeated.slideBlend, before.slideBlend);
    const middle = motion.update(.06, slide(.06));
    assert.ok(middle.slideBlend > before.slideBlend && middle.slideBlend < 1);
    const finished = motion.update(.06, slide(.12));
    assert.equal(finished.slideBlend, 1);
    assert.equal(dominant(finished), 'action14');
  }
});

test('a second refresh during slide recovery retains the exact current shape', () => {
  const { motion } = beginSlide(.4);
  motion.update(.76, slide(.76));
  motion.update(0, slide(0));
  const recovering = motion.update(.04, slide(.04));
  const repeated = motion.update(0, slide(0));
  assertPoseClose(repeated, recovering);
  assert.equal(repeated.slideBlend, recovering.slideBlend);
  assert.equal(motion.update(.12, slide(.12)).slideBlend, 1);
});

test('slide boundaries and mirrored entry/exit agree at 30, 60 and 120 FPS', () => {
  for (const cycle of [.15, .4]) for (const elapsed of [.035, .08, .18, .45, .67, .74, .815, .85]) {
    const expected = beginSlide(cycle).motion.update(elapsed, slide(elapsed));
    for (const fps of [30, 60, 120]) {
      const actual = advance(beginSlide(cycle).motion, elapsed, fps, slide);
      assertPoseClose(actual, expected);
      assert.ok(Math.abs(actual.slideBlend - expected.slideBlend) < 1e-12);
    }
  }
});

test('natural slide exit resumes the matching leg immediately without an idle transition', () => {
  for (const cycle of [.15, .4]) for (const fps of [30, 60, 120]) {
    const { motion, running } = beginSlide(cycle);
    advance(motion, .85 - 1 / fps, fps, slide);
    const resumed = motion.update(1 / fps, state());
    const startCycle = running.mix < .5 ? 0 : .5;
    assertPoseClose(resumed, sampleRedRun(startCycle + 13 / 8 / fps));
    assert.equal(resumed.slideBlend, 0);
    assert.equal(resumed.landing, 0);
    assert.ok(resumed.bounce > 0);
  }
});

test('jumping out of a slide releases the low body transform over the transition', () => {
  const motion = createRedRunnerMotion();
  const sliding = motion.update(.016, slide(.4));
  const takeoff = motion.update(0, jump(0));
  assert.equal(takeoff.slideBlend, sliding.slideBlend);
  const middle = motion.update(.05, jump(.05 / .9));
  assert.ok(middle.slideBlend > 0 && middle.slideBlend < 1);
  assert.equal(motion.update(.05, jump(.1 / .9)).slideBlend, 0);
});

test('reset removes an interrupted jump, paused transition and landing pulse', () => {
  const motion = createRedRunnerMotion();
  motion.update(.1, jump(.9));
  motion.update(.016, state());
  motion.reset();
  assert.deepEqual(motion.update(.016, state()), createRedRunnerMotion().update(.016, state()));
});

test('run interpolation wraps continuously and menu selects only front poses', () => {
  const motion = createRedRunnerMotion();
  const before = motion.update((8 - .001) / 13, state());
  const after = motion.update(.002 / 13, state());
  assert.equal(before.from, 'run0');
  assert.equal(before.to, 'run4');
  assertPoseClose(before, after);
  assert.ok(after.mix < .001);
  motion.reset();
  const menu = motion.update(.15, state({ menu: true }));
  assert.match(menu.from, /^menu[0-3]$/);
  assert.match(menu.to, /^menu[0-3]$/);
});

test('a run cycle alternates the two stride anchors and produces exactly two footfalls', () => {
  const motion = createRedRunnerMotion();
  assert.equal(dominant(motion.update(0, state())), 'run0');
  for (const [mix, bounce] of [[.5, .05], [1, 0], [.5, .05], [0, 0]]) {
    const pose = motion.update(2 / 13, state());
    assert.equal(pose.from, 'run0');
    assert.equal(pose.to, 'run4');
    assert.ok(Math.abs(pose.mix - mix) < 1e-12);
    assert.ok(Math.abs(pose.bounce - bounce) < 1e-12);
  }
});

test('run is periodic and symmetric without extra easing stops between the legs', () => {
  for (const cycle of [0, .1, .25, .49, .5, .75, 1]) {
    assertPoseClose(sampleRedRun(cycle), sampleRedRun(cycle + 1));
    assertPoseClose(sampleRedRun(cycle), sampleRedRun(1 - cycle));
  }
  const epsilon = .00001;
  const velocity = (sampleRedRun(.25 + epsilon).mix - sampleRedRun(.25 - epsilon).mix) / (2 * epsilon);
  assert.ok(velocity > 3, 'mid-swing must keep moving rather than stop at an artificial keyframe');
});

test('running is independent of frame rate and reset removes refreshed slide state', () => {
  for (const fps of [30, 60, 120]) {
    const actual = advance(createRedRunnerMotion(), .73, fps, () => state());
    const expected = createRedRunnerMotion().update(.73, state());
    assertPoseClose(actual, expected);
    assert.ok(Math.abs(actual.bounce - expected.bounce) < 1e-12);
  }
  const { motion } = beginSlide(.4);
  motion.update(.74, slide(.74));
  motion.update(0, slide(0));
  motion.update(.03, slide(.03));
  motion.reset();
  assert.deepEqual(motion.update(.016, state()), createRedRunnerMotion().update(.016, state()));
});

test('articulated stride retains swing direction and its exact phase at action handoff', () => {
  const forward = createRedRunnerMotion().update(.25 * 8 / 13, state());
  const returning = createRedRunnerMotion().update(.75 * 8 / 13, state());
  assertPoseClose(forward, returning);
  assert.equal(forward.runCycle, .25);
  assert.equal(returning.runCycle, .75);
  for (const cycle of [.15, .4, .65, .9]) {
    const { motion, running, entering } = beginSlide(cycle);
    assert.equal(entering.runCycle, running.runCycle);
    const settled = motion.update(.035, slide(.035));
    assert.equal(settled.runCycle, Math.round(cycle * 2) / 2);
    assert.equal(motion.update(.5, { ...slide(.5), moving: false }).runCycle, settled.runCycle);
  }
  const motion = createRedRunnerMotion();
  const running = motion.update(.4, state());
  assert.equal(motion.update(0, jump(0)).runCycle, running.runCycle);
});
