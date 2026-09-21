import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame as createAssistedGame, selectLane, updateGame, startGame, pauseGame, resumeGame } from './fruit-logic.js';
import { swipeLane } from './fruit-swipe.js';

test('side swipes select lower baskets and a small upward component selects upper baskets', () => {
  for (const start of [0, 1, 2, 3]) {
    assert.equal(swipeLane(-40, 0, start), 1);
    assert.equal(swipeLane(40, 3, start), 3);
    assert.equal(swipeLane(-40, -8, start), 0);
    assert.equal(swipeLane(40, -8, start), 2);
    assert.equal(swipeLane(-40, 20, start), 1);
    assert.equal(swipeLane(40, 20, start), 3);
  }
});

test('swipes reject tap jitter, allow upward refinement, and preserve side for vertical gestures', () => {
  assert.equal(swipeLane(4, -5, 1), null);
  assert.equal(swipeLane(10, 10, 1), null);
  assert.equal(swipeLane(16, -2, 1), 3);
  assert.equal(swipeLane(30, -8, 1), 2);
  assert.equal(swipeLane(3, -20, 1), 0);
  assert.equal(swipeLane(-3, 20, 2), 3);
});

function seededRandom(seed = 7) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

// Keep the original timing contracts covered with assistance disabled.
const createGame = (options = {}) => createAssistedGame({ ...options, catchAssist: false });

// Two random draws per item: its lane, then its kind.
function fixedLaneRandom(lane = 0, kindRandom = () => 0) {
  let draw = 0;
  return () => draw++ % 2 === 0 ? (lane + 0.1) / 4 : kindRandom();
}

function nextArrival(game) {
  while (!game.fruits.length) updateGame(game, game.nextSpawnAt - game.elapsed);
  return game.fruits[0];
}

function catchNext(game) {
  const fruit = nextArrival(game);
  selectLane(game, fruit.lane);
  return updateGame(game, fruit.arrivalAt - game.elapsed);
}

function avoidNext(game) {
  const fruit = nextArrival(game);
  selectLane(game, (fruit.lane + 1) % 4);
  return updateGame(game, fruit.arrivalAt - game.elapsed);
}

test('only the selected one of four basket positions catches a snack', () => {
  for (let lane = 0; lane < 4; lane += 1) {
    const game = startGame(createGame({ random: fixedLaneRandom(lane) }));
    const fruit = nextArrival(game);
    assert.equal(fruit.lane, lane);
    selectLane(game, lane);
    const events = updateGame(game, fruit.arrivalAt - game.elapsed);
    assert.equal(game.score, 1);
    assert.equal(game.lives, 3);
    assert.equal(game.combo, 1);
    assert.equal(events.filter(event => event.type === 'catch').length, 1);
    const second = game.fruits[0];
    selectLane(game, (lane + 1) % 4);
    assert.equal(updateGame(game, second.arrivalAt - game.elapsed).at(-1).type, 'miss');
    assert.equal(game.lives, 2);
    assert.equal(game.combo, 0);
    assert.equal(game.bestCombo, 1);
    assert.equal(game.caught, 1);
    assert.equal(game.score, 1);
  }
});

test('ready and paused games freeze both deadlines and basket position', () => {
  const game = createGame({ random: () => 0 });
  assert.deepEqual(updateGame(game, 10), []);
  assert.equal(game.elapsed, 0);
  startGame(game);
  updateGame(game, 1);
  pauseGame(game);
  const snapshot = structuredClone({ ...game, random: undefined });
  selectLane(game, 3);
  assert.deepEqual(updateGame(game, 100), []);
  assert.deepEqual({ ...game, random: undefined }, snapshot);
  resumeGame(game);
  catchNext(game);
  assert.equal(game.score, 1);
  assert.equal(game.phase, 'playing');
});

test('third miss ends at its deadline and never emits later spawns or losses', () => {
  const game = startGame(createGame({ random: () => 0 }));
  const events = updateGame(game, 100);
  assert.equal(game.phase, 'over');
  assert.equal(game.lives, 0);
  assert.equal(events.filter(event => event.type === 'miss').length, 3);
  assert.equal(events.at(-1).type, 'over');
  assert.equal(game.elapsed, events.at(-1).at);
  assert.ok(game.elapsed < 10);
  const snapshot = structuredClone({ ...game, random: undefined });
  assert.deepEqual(updateGame(game, 100), []);
  selectLane(game, 0);
  resumeGame(game);
  assert.deepEqual({ ...game, random: undefined }, snapshot);
});

test('restart clears previous fruit, counters, speed and end state', () => {
  const game = startGame(createGame({ mode: 'relaxed', random: () => 0 }));
  for (let index = 0; index < 15; index += 1) catchNext(game);
  assert.equal(game.level, 2);
  selectLane(game, 1);
  updateGame(game, 100);
  assert.equal(game.phase, 'over');
  startGame(game);
  assert.equal(game.mode, 'relaxed');
  assert.equal(game.phase, 'playing');
  assert.equal(game.lives, 3);
  assert.equal(game.score, 0);
  assert.equal(game.caught, 0);
  assert.equal(game.combo, 0);
  assert.equal(game.bestCombo, 0);
  assert.equal(game.elapsed, 0);
  assert.equal(game.level, 1);
  assert.deepEqual(game.fruits, []);
  assert.equal(game.nextId, 1);
});

test('difficulty grows gradually and every arrival remains possible across lane changes', () => {
  const game = startGame(createGame({ random: seededRandom() }));
  const initialTravel = game.travelTime;
  const initialSpawn = game.spawnInterval;
  let previousArrival = -Infinity;
  let previousLane = null;
  let laneChanges = 0;
  let expectedCaught = 0;
  let expectedScore = 0;
  const spawned = [];
  for (let index = 0; index < 400; index += 1) {
    const next = nextArrival(game);
    assert.ok(next.arrivalAt - previousArrival >= 1.1 / 3.4 - 1e-9);
    if (previousLane !== null && next.lane !== previousLane) laneChanges += 1;
    previousArrival = next.arrivalAt;
    previousLane = next.lane;
    const events = next.kind === 'chili' || next.kind === 'energy' ? avoidNext(game) : catchNext(game);
    if (next.kind !== 'chili' && next.kind !== 'energy') {
      expectedCaught += 1;
      expectedScore += next.kind === 'sandwich' ? 2 : 1;
    }
    spawned.push(...events.filter(event => event.type === 'spawn'));
    assert.equal(game.lives, 3);
    assert.equal(game.score, expectedScore);
    assert.equal(game.caught, expectedCaught);
    assert.ok(game.travelTime >= 3.1 / 3.4 - 1e-9);
    assert.ok(game.spawnInterval >= 1.1 / 3.4);
    assert.ok(game.fruits.every(fruit => fruit.progress >= 0 && fruit.progress <= 1));
  }
  assert.ok(laneChanges > 150);
  assert.ok(game.travelTime < initialTravel);
  assert.ok(game.spawnInterval < initialSpawn);
  assert.ok(game.speedMultiplier > 2.5 && game.speedMultiplier < 3.4);
  assert.equal(game.level, 1 + Math.floor(expectedCaught / 10));
  assert.equal(game.bestCombo, expectedCaught);
  assert.ok(spawned.length > 390);
});

test('relaxed mode offers more travel and time between arrivals at every level', () => {
  const classic = startGame(createGame({ random: () => 0 }));
  const relaxed = startGame(createGame({ mode: 'relaxed', random: () => 0 }));
  for (let index = 0; index < 150; index += 1) {
    catchNext(classic);
    catchNext(relaxed);
    assert.ok(relaxed.travelTime > classic.travelTime);
    assert.ok(relaxed.spawnInterval > classic.spawnInterval);
  }
  assert.ok(relaxed.elapsed > classic.elapsed);
});

test('simulation is deterministic and independent of frame size', () => {
  const whole = startGame(createGame({ random: fixedLaneRandom(0, seededRandom(23)) }));
  const split = startGame(createGame({ random: fixedLaneRandom(0, seededRandom(23)) }));
  selectLane(whole, 0);
  selectLane(split, 0);
  const wholeEvents = updateGame(whole, 100);
  const splitEvents = [];
  for (let frame = 0; frame < 800; frame += 1) splitEvents.push(...updateGame(split, 0.125));
  assert.deepEqual(splitEvents, wholeEvents);
  assert.ok(wholeEvents.some(event => event.type === 'spicy'));
  assert.ok(wholeEvents.some(event => event.type === 'cooled'));
  assert.deepEqual({ ...split, random: undefined }, { ...whole, random: undefined });
  const first = startGame(createGame({ random: seededRandom(12) }));
  const second = startGame(createGame({ random: seededRandom(12) }));
  assert.deepEqual(updateGame(first, 10), updateGame(second, 10));
});

test('invalid deltas and invalid lane selections cannot corrupt state', () => {
  const game = startGame(createGame());
  for (const dt of [-1, 0, Infinity, NaN, undefined]) assert.deepEqual(updateGame(game, dt), []);
  for (const lane of [-1, 4, 1.5, NaN, '0']) selectLane(game, lane);
  assert.equal(game.elapsed, 0);
  assert.equal(game.lane, 1);
});

test('both doughnut kinds score one point and sandwiches score two', () => {
  const rolls = [0, 0.5, 0.8];
  let nextRoll = 0;
  const game = startGame(createGame({ random: fixedLaneRandom(0, () => rolls[nextRoll++ % rolls.length]) }));
  const catches = [];
  for (let index = 0; index < 3; index += 1) catches.push(catchNext(game).find(event => event.type === 'catch'));
  assert.deepEqual(catches.map(event => [event.kind, event.points]), [
    ['donut-pink', 1], ['donut-chocolate', 1], ['sandwich', 2],
  ]);
  assert.equal(game.score, 4);
  assert.equal(game.caught, 3);
  assert.equal(game.donuts, 2);
  assert.equal(game.sandwiches, 1);
  assert.equal(game.combo, 3);
});

test('levels count good snacks, not the higher sandwich score', () => {
  const game = startGame(createGame({ random: fixedLaneRandom(0, () => 0.7) }));
  for (let index = 0; index < 9; index += 1) catchNext(game);
  assert.equal(game.score, 18);
  assert.equal(game.caught, 9);
  assert.equal(game.level, 1);
  const events = catchNext(game);
  assert.equal(game.score, 20);
  assert.equal(game.caught, 10);
  assert.equal(game.level, 2);
  assert.equal(events.filter(event => event.type === 'level').length, 1);
});

test('first five items are snacks and even adversarial randomness cannot produce adjacent peppers', () => {
  const game = startGame(createGame({ random: fixedLaneRandom(0, () => 0.99) }));
  const kinds = [];
  for (let index = 0; index < 30; index += 1) {
    const fruit = nextArrival(game);
    kinds.push(fruit.kind);
    if (fruit.kind === 'chili') avoidNext(game);
    else catchNext(game);
  }
  assert.ok(kinds.slice(0, 5).every(kind => kind !== 'chili'));
  assert.equal(kinds[5], 'chili');
  assert.ok(kinds.every((kind, index) => kind !== 'chili' || kinds[index - 1] !== 'chili'));
  assert.equal(game.lives, 3);
});

test('peppers remain occasional over a deterministic long run', () => {
  const game = startGame(createGame({ random: seededRandom(419) }));
  let peppers = 0;
  let previousKind;
  for (let index = 0; index < 2000; index += 1) {
    const fruit = nextArrival(game);
    if (fruit.kind === 'chili') {
      assert.notEqual(previousKind, 'chili');
      peppers += 1;
      avoidNext(game);
    } else if (fruit.kind === 'energy') avoidNext(game);
    else catchNext(game);
    previousKind = fruit.kind;
  }
  // The no-consecutive-peppers rule lowers the overall rate slightly below 16%.
  assert.ok(peppers / 2000 > 0.11 && peppers / 2000 < 0.18);
  assert.equal(game.avoidedPeppers, peppers);
  assert.equal(game.peppersCaught, 0);
});

test('catching chili only adds spiciness; dodging it preserves lives, score and combo', () => {
  const game = startGame(createGame({ random: fixedLaneRandom(0, () => 0.99) }));
  for (let index = 0; index < 5; index += 1) catchNext(game);
  const before = { score: game.score, caught: game.caught, lives: game.lives };
  const spicyEvents = catchNext(game);
  const spicy = spicyEvents.find(event => event.type === 'spicy');
  assert.equal(spicy.kind, 'chili');
  assert.equal(spicy.duration, 4);
  assert.equal(game.spicyUntil, spicy.at + 4);
  assert.equal(game.spicyRemaining, 4);
  assert.equal(game.peppersCaught, 1);
  assert.equal(game.score, before.score);
  assert.equal(game.caught, before.caught);
  assert.equal(game.lives, before.lives);
  assert.equal(game.combo, 0);
  assert.equal(game.bestCombo, 5);
  assert.ok(spicyEvents.every(event => event.type !== 'miss' && event.type !== 'catch'));
  catchNext(game);
  const comboBeforeDodge = game.combo;
  const scoreBeforeDodge = game.score;
  const events = avoidNext(game);
  assert.ok(events.some(event => event.type === 'dodge'));
  assert.ok(events.every(event => event.type !== 'miss'));
  assert.equal(game.avoidedPeppers, 1);
  assert.equal(game.combo, comboBeforeDodge);
  assert.equal(game.score, scoreBeforeDodge);
  assert.equal(game.lives, 3);
});

test('spiciness freezes on pause, refreshes on another pepper and expires once at the new deadline', () => {
  const game = startGame(createGame({ random: fixedLaneRandom(0, () => 0.99) }));
  for (let index = 0; index < 6; index += 1) catchNext(game);
  const firstDeadline = game.spicyUntil;
  updateGame(game, 0.75);
  assert.equal(game.spicyRemaining, 3.25);
  pauseGame(game);
  assert.deepEqual(updateGame(game, 100), []);
  assert.equal(game.spicyRemaining, 3.25);
  assert.equal(game.spicyUntil, firstDeadline);
  resumeGame(game);
  catchNext(game);
  catchNext(game);
  assert.equal(game.peppersCaught, 2);
  assert.equal(game.spicyRemaining, 4);
  assert.ok(game.spicyUntil > firstDeadline);
  const refreshedDeadline = game.spicyUntil;
  const events = [];
  while (nextArrival(game).arrivalAt < refreshedDeadline) {
    events.push(...(game.fruits[0].kind === 'chili' ? avoidNext(game) : catchNext(game)));
  }
  events.push(...updateGame(game, refreshedDeadline - game.elapsed));
  assert.equal(game.spicyRemaining, 0);
  assert.equal(game.spicyUntil, 0);
  assert.deepEqual(events.filter(event => event.type === 'cooled'), [{ type: 'cooled', at: refreshedDeadline }]);
});

test('restart clears spiciness and all snack and pepper counters', () => {
  const game = startGame(createGame({ random: fixedLaneRandom(0, () => 0.99) }));
  for (let index = 0; index < 8; index += 1) {
    if (index === 5) avoidNext(game);
    else catchNext(game);
  }
  assert.equal(game.peppersCaught, 1);
  assert.equal(game.avoidedPeppers, 1);
  assert.ok(game.spicyRemaining > 0);
  assert.ok(game.sandwiches > 0);
  startGame(game);
  for (const key of ['donuts', 'sandwiches', 'peppersCaught', 'avoidedPeppers', 'spicyUntil', 'spicyRemaining']) {
    assert.equal(game[key], 0, key);
  }
  assert.equal(game.lastKind, null);
});

function mixedFourLaneRandom() {
  const kinds = [0.1, 0.45, 0.75, 0.92, 0.4, 0.99];
  let draw = 0;
  return () => {
    const item = Math.floor(draw / 2);
    return draw++ % 2 === 0 ? (item % 4 + 0.1) / 4 : kinds[item % kinds.length];
  };
}

function reachEnergy(game) {
  for (let index = 0; index < 500; index += 1) {
    const fruit = nextArrival(game);
    if (fruit.kind === 'energy') return fruit;
    if (fruit.kind === 'chili') avoidNext(game);
    else catchNext(game);
  }
  assert.fail('Expected a deterministic energy pickup');
}

test('ordinary speed rises continuously through and beyond ten levels', () => {
  const game = startGame(createGame({ random: () => 0 }));
  selectLane(game, 0);
  let previousSpeed = game.speedMultiplier;
  let speedAtLevelTen = 0;
  for (let index = 0; index < 4000; index += 1) {
    updateGame(game, 0.1);
    assert.ok(game.speedMultiplier > previousSpeed);
    assert.ok(game.speedMultiplier - previousSpeed < 0.0017);
    if (game.level === 10) speedAtLevelTen = game.speedMultiplier;
    previousSpeed = game.speedMultiplier;
  }
  assert.equal(game.lives, 3);
  assert.ok(game.level > 50);
  assert.ok(game.speedMultiplier > speedAtLevelTen + 0.5);
  assert.ok(game.speedMultiplier < 3.4);
});

test('energy catches award no food points; missing energy is safe and preserves the combo', () => {
  const caught = startGame(createGame({ random: mixedFourLaneRandom() }));
  const missed = startGame(createGame({ random: mixedFourLaneRandom() }));
  reachEnergy(caught);
  reachEnergy(missed);
  const before = Object.fromEntries(['score', 'caught', 'donuts', 'sandwiches', 'lives', 'combo'].map(key => [key, caught[key]]));
  const boostEvents = catchNext(caught);
  const missEvents = avoidNext(missed);
  assert.ok(boostEvents.some(event => event.type === 'boost' && event.duration === 15));
  assert.ok(missEvents.some(event => event.type === 'energy-miss'));
  assert.equal(caught.boostsCaught, 1);
  assert.equal(caught.boostMultiplier, 4);
  assert.equal(missed.boostsCaught, 0);
  for (const [key, value] of Object.entries(before)) {
    assert.equal(caught[key], value, key);
    assert.equal(missed[key], value, key);
  }
});

test('boost immediately accelerates existing food without jumping its position', () => {
  const fast = startGame(createGame({ random: mixedFourLaneRandom() }));
  const normal = startGame(createGame({ random: mixedFourLaneRandom() }));
  reachEnergy(fast);
  reachEnergy(normal);
  catchNext(fast);
  avoidNext(normal);
  assert.equal(fast.elapsed, normal.elapsed);
  for (const item of fast.fruits) {
    const other = normal.fruits.find(candidate => candidate.id === item.id);
    assert.ok(other);
    assert.ok(Math.abs(item.progress - other.progress) < 1e-10);
    assert.ok(item.arrivalAt < other.arrivalAt);
  }
  const id = fast.fruits.at(-1).id;
  const before = fast.fruits.find(item => item.id === id).progress;
  updateGame(fast, 0.01);
  updateGame(normal, 0.01);
  const fastMovement = fast.fruits.find(item => item.id === id).progress - before;
  const normalMovement = normal.fruits.find(item => item.id === id).progress - before;
  assert.ok(Math.abs(fastMovement / normalMovement - 4) < 1e-7);
});

test('boost autopilot covers all four lanes, catches every snack and dodges peppers despite input', () => {
  const game = startGame(createGame({ random: mixedFourLaneRandom() }));
  reachEnergy(game);
  const startEvents = catchNext(game);
  const start = startEvents.find(event => event.type === 'boost').at;
  const deadline = game.boostUntil;
  const events = [];
  while (game.elapsed + 0.05 < deadline) {
    const selected = game.lane;
    selectLane(game, (selected + 2) % 4);
    assert.equal(game.lane, selected);
    events.push(...updateGame(game, 0.05));
  }
  events.push(...updateGame(game, deadline - game.elapsed));
  assert.equal(deadline - start, 15);
  assert.deepEqual(events.filter(event => event.type === 'boost-end'), [{ type: 'boost-end', at: deadline }]);
  assert.equal(game.boostMultiplier, 1);
  assert.equal(game.boostRemaining, 0);
  assert.equal(game.boostUntil, 0);
  assert.equal(game.lives, 3);
  assert.equal(events.filter(event => event.type === 'miss' || event.type === 'spicy').length, 0);
  assert.deepEqual([...new Set(events.filter(event => event.type === 'catch').map(event => event.lane))].sort(), [0, 1, 2, 3]);
  assert.ok(events.filter(event => event.type === 'catch').length > 35);
  assert.ok(events.some(event => event.type === 'dodge'));
  const spawns = events.filter(event => event.type === 'spawn');
  assert.ok(spawns.length > 65);
  assert.ok(spawns.every(event => event.kind !== 'energy'));
  for (let index = 1; index < spawns.length; index += 1) {
    assert.ok(Math.abs(spawns[index].at - spawns[index - 1].at - 0.2) < 1e-9);
  }
  const lane = (game.lane + 1) % 4;
  selectLane(game, lane);
  assert.equal(game.lane, lane);
});

test('boost expires smoothly at the ordinary current-stage speed', () => {
  const game = startGame(createGame({ random: mixedFourLaneRandom() }));
  reachEnergy(game);
  catchNext(game);
  const initialNormalSpeed = game.speedMultiplier;
  const deadline = game.boostUntil;
  updateGame(game, deadline - game.elapsed - 0.001);
  const id = game.fruits.at(-1).id;
  const before = game.fruits.find(item => item.id === id).progress;
  updateGame(game, deadline - game.elapsed);
  const atEnd = game.fruits.find(item => item.id === id).progress;
  assert.ok(atEnd > before && atEnd - before < 0.01);
  assert.ok(game.speedMultiplier > initialNormalSpeed);
  assert.ok(Math.abs(game.spawnInterval - 1.1 / game.speedMultiplier) < 1e-12);
  updateGame(game, 0.001);
  const after = game.fruits.find(item => item.id === id).progress;
  assert.ok(Math.abs((atEnd - before) / (after - atEnd) - 4) < 0.001);
  const baseline = startGame(createGame({ random: () => 0 }));
  selectLane(baseline, 0);
  updateGame(baseline, game.elapsed);
  assert.equal(game.speedMultiplier, baseline.speedMultiplier);
  assert.ok(Math.abs(game.travelTime - baseline.travelTime) < 1e-10);
});

test('pause freezes the entire 15-second boost and restarting clears it', () => {
  const game = startGame(createGame({ random: mixedFourLaneRandom() }));
  reachEnergy(game);
  catchNext(game);
  updateGame(game, 2);
  assert.equal(game.boostRemaining, 13);
  pauseGame(game);
  const snapshot = structuredClone({ ...game, random: undefined });
  assert.deepEqual(updateGame(game, 100), []);
  assert.deepEqual({ ...game, random: undefined }, snapshot);
  resumeGame(game);
  updateGame(game, 1);
  assert.equal(game.boostRemaining, 12);
  startGame(game);
  for (const key of ['boostRemaining', 'boostUntil', 'boostsCaught', 'elapsed', 'motion']) assert.equal(game[key], 0, key);
  assert.equal(game.boostMultiplier, 1);
  assert.equal(game.speedMultiplier, 1);
  assert.equal(game.lastEnergySpawnAt, null);
  assert.deepEqual(game.fruits, []);
});

test('a second energy item cannot stack or extend an existing boost', () => {
  const game = startGame(createGame({ random: mixedFourLaneRandom() }));
  reachEnergy(game);
  catchNext(game);
  const deadline = game.boostUntil;
  // Defensive contract even if a future level script places an extra pickup.
  game.fruits[0].kind = 'energy';
  const events = updateGame(game, game.fruits[0].arrivalAt - game.elapsed);
  assert.equal(game.boostUntil, deadline);
  assert.ok(game.boostRemaining < 15);
  assert.ok(events.every(event => event.type !== 'boost'));
});

test('energy spawns are rare, delayed and at least 45 seconds apart', () => {
  const game = startGame(createGame({ random: seededRandom(129) }));
  const pickups = [];
  for (let index = 0; index < 2500; index += 1) {
    const next = nextArrival(game);
    if (next.kind === 'energy') pickups.push({ at: next.bornAt, id: next.id });
    if (next.kind === 'energy' || next.kind === 'chili') avoidNext(game);
    else catchNext(game);
  }
  assert.ok(pickups.length > 5 && pickups.length < 45);
  assert.ok(pickups.every(pickup => pickup.at >= 20 && pickup.id > 5));
  for (let index = 1; index < pickups.length; index += 1) assert.ok(pickups[index].at - pickups[index - 1].at >= 45);
  assert.equal(game.lives, 3);
  assert.equal(game.boostsCaught, 0);
});

test('boost activation, automatic catches and expiry are independent of frame size', () => {
  const whole = startGame(createGame({ random: fixedLaneRandom(0, () => 0.99) }));
  const split = startGame(createGame({ random: fixedLaneRandom(0, () => 0.99) }));
  selectLane(whole, 0);
  selectLane(split, 0);
  const wholeEvents = updateGame(whole, 70);
  const splitEvents = [];
  for (let frame = 0; frame < 560; frame += 1) splitEvents.push(...updateGame(split, 0.125));
  assert.ok(wholeEvents.some(event => event.type === 'boost'));
  assert.ok(wholeEvents.some(event => event.type === 'boost-end'));
  assert.deepEqual(splitEvents, wholeEvents);
  assert.deepEqual({ ...split, random: undefined }, { ...whole, random: undefined });
});

test('basket assistance accelerates only the nearest snack, continuously, and scores sooner', () => {
  for (const mode of ['classic', 'relaxed']) for (const lane of [0, 1, 2, 3]) {
    const game = startGame(createAssistedGame({ mode, random: fixedLaneRandom(lane) }));
    selectLane(game, (lane + 1) % 4);
    const first = nextArrival(game);
    while (first.progress < 0.7) updateGame(game, 0.01);
    const before = game.fruits.map(fruit => ({ ...fruit }));
    selectLane(game, lane);
    assert.ok(first.assisted);
    assert.ok(Math.abs(first.progress - before[0].progress) < 1e-12);
    assert.ok(first.arrivalAt < before[0].arrivalAt);
    assert.equal(game.score, 0);
    for (let i = 1; i < before.length; i++) {
      assert.equal(game.fruits[i].arrivalAt, before[i].arrivalAt);
      assert.equal(game.fruits[i].progress, before[i].progress);
    }
    const events = updateGame(game, first.arrivalAt - game.elapsed);
    assert.equal(events.filter(event => event.type === 'catch').length, 1);
    assert.equal(game.score, 1);
    assert.equal(game.lives, 3);
  }
});

test('leaving the lane cancels assistance smoothly; later food and hazards do not attract', () => {
  const game = startGame(createAssistedGame({ random: fixedLaneRandom(0) }));
  const first = nextArrival(game);
  while (first.progress < 0.7) updateGame(game, 0.01);
  const second = game.fruits[1];
  second.lane = 2;
  const secondDeadline = second.arrivalAt;
  selectLane(game, 2);
  assert.equal(second.arrivalAt, secondDeadline);
  assert.ok(!second.assisted);
  for (const kind of ['chili', 'energy']) {
    first.kind = kind;
    const deadline = first.arrivalAt;
    selectLane(game, 0);
    assert.ok(!first.assisted);
    assert.equal(first.arrivalAt, deadline);
  }
  first.kind = 'donut-pink';
  selectLane(game, 0);
  updateGame(game, 0.02);
  const progress = first.progress;
  const assistedDeadline = first.arrivalAt;
  selectLane(game, 1);
  assert.ok(!first.assisted);
  assert.ok(Math.abs(first.progress - progress) < 1e-12);
  assert.ok(first.arrivalAt > assistedDeadline);
  const events = updateGame(game, first.arrivalAt - game.elapsed);
  assert.equal(events.filter(event => event.type === 'miss').length, 1);
  assert.equal(game.score, 0);
});

test('assistance, peppers and boost keep identical event timing across frame sizes', () => {
  const whole = startGame(createAssistedGame({ random: fixedLaneRandom(0, () => 0.99) }));
  const split = startGame(createAssistedGame({ random: fixedLaneRandom(0, () => 0.99) }));
  selectLane(whole, 0);
  selectLane(split, 0);
  const events = updateGame(whole, 70);
  const splitEvents = [];
  for (let i = 0; i < 560; i++) splitEvents.push(...updateGame(split, 0.125));
  assert.ok(events.some(event => event.type === 'boost'));
  assert.ok(events.some(event => event.type === 'boost-end'));
  assert.ok(events.some(event => event.type === 'spicy'));
  assert.deepEqual(splitEvents, events);
  assert.deepEqual({ ...split, random: undefined }, { ...whole, random: undefined });
  // After autopilot dodges a pepper, manual play must resume on the right lane.
  startGame(split);
  selectLane(split, 0);
  updateGame(split, 2.5);
  assert.ok(split.fruits[0].assisted);
  pauseGame(split);
  const snapshot = structuredClone({ ...split, random: undefined });
  updateGame(split, 20);
  assert.deepEqual({ ...split, random: undefined }, snapshot);
  startGame(split);
  assert.equal(split.catchAssist, true);
  assert.equal(split.score, 0);
  assert.deepEqual(split.fruits, []);
});

test('a lost heart gives two seconds of protection; protected misses do not extend it', () => {
  const game = startGame(createAssistedGame({ random: fixedLaneRandom(0) }));
  const miss = avoidNext(game).find(event => event.type === 'miss');
  assert.equal(game.lives, 2);
  assert.equal(game.protectedUntil, miss.at + 2);
  const deadline = game.protectedUntil;
  const protectedEvents = avoidNext(game);
  assert.ok(protectedEvents.some(event => event.type === 'protected-miss'));
  assert.equal(game.lives, 2);
  assert.equal(game.protectedUntil, deadline);
  assert.ok(game.protectionRemaining > 0);
  const snapshot = structuredClone({ ...game, random: undefined });
  pauseGame(game);
  updateGame(game, 10);
  assert.equal(game.protectionRemaining, snapshot.protectionRemaining);
  resumeGame(game);
  const events = updateGame(game, 20);
  const losses = events.filter(event => event.type === 'miss');
  assert.equal(losses.length, 2);
  assert.ok(losses[0].at >= deadline);
  assert.ok(losses[1].at >= losses[0].at + 2);
  assert.equal(game.phase, 'over');
  startGame(game);
  assert.equal(game.protectedUntil, 0);
  assert.equal(game.protectionRemaining, 0);
  assert.equal(game.lives, 3);
});

test('loss protection behaves identically with large and small time steps', () => {
  const whole = startGame(createAssistedGame({ random: fixedLaneRandom(0) }));
  const split = startGame(createAssistedGame({ random: fixedLaneRandom(0) }));
  const events = updateGame(whole, 20);
  const splitEvents = [];
  for (let i = 0; i < 160; i++) splitEvents.push(...updateGame(split, 0.125));
  assert.ok(events.some(event => event.type === 'protected-miss'));
  assert.deepEqual(events, splitEvents);
  assert.deepEqual({ ...whole, random: undefined }, { ...split, random: undefined });
});
