const SNACK_KINDS = ['donut-pink', 'donut-chocolate', 'sandwich'];
const FIRST_SPAWN_DELAY = 0.55;
const CHILI_CHANCE = 0.16;
const SPICY_DURATION = 4;
const BOOST_DURATION = 15;
const BOOST_SPAWN_INTERVAL = 0.2;
const BASE_TRAVEL = 3.1;
const ASSIST_START = 0.6;
const ASSIST_SPEED = 3;
const MISS_PROTECTION_DURATION = 2;
const BASE_SPAWN = 1.1;
const SPEED_GAIN = 2.4;
const SPEED_RAMP_SECONDS = 150;

// Smoothly approaches 3.4x, leaving at least .323s between manual catches.
function ordinarySpeed(time) {
  return 1 + SPEED_GAIN * -Math.expm1(-time / SPEED_RAMP_SECONDS);
}
function ordinaryDistance(from, to) {
  const dt = to - from;
  return (1 + SPEED_GAIN) * dt + SPEED_GAIN * SPEED_RAMP_SECONDS
    * Math.exp(-from / SPEED_RAMP_SECONDS) * Math.expm1(-dt / SPEED_RAMP_SECONDS);
}
function ordinaryArrival(from, distance) {
  if (distance <= 0) return from;
  let low = from, high = from + distance;
  for (let step = 0; step < 55; step += 1) {
    const middle = (low + high) / 2;
    if (ordinaryDistance(from, middle) < distance) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}
function motionAt(game, time) {
  return game.motionAnchor + game.boostMultiplier * ordinaryDistance(game.motionAnchorTime, time);
}
function timeAtMotion(game, motion) {
  const distance = motion - game.motionAnchor;
  if (game.boostMultiplier === 4) {
    const toBoostEnd = 4 * ordinaryDistance(game.motionAnchorTime, game.boostUntil);
    if (distance > toBoostEnd) return ordinaryArrival(game.boostUntil, distance - toBoostEnd);
    return ordinaryArrival(game.motionAnchorTime, distance / 4);
  }
  return ordinaryArrival(game.motionAnchorTime, distance);
}
function refreshTiming(game) {
  game.motion = motionAt(game, game.elapsed);
  game.speedMultiplier = ordinarySpeed(game.elapsed);
  game.boostRemaining = Math.max(0, game.boostUntil - game.elapsed);
  game.spicyRemaining = Math.max(0, game.spicyUntil - game.elapsed);
  game.protectionRemaining = Math.max(0, game.protectedUntil - game.elapsed);
  game.spawnInterval = game.boostMultiplier === 4 ? BOOST_SPAWN_INTERVAL : game.baseSpawn / game.speedMultiplier;
  game.travelTime = timeAtMotion(game, game.motion + game.baseTravel) - game.elapsed;
  if (game.nextSpawnMotion !== null) game.nextSpawnAt = timeAtMotion(game, game.nextSpawnMotion);
  for (const fruit of game.fruits) {
    fruit.progress = Math.max(0, Math.min(1, (game.motion - fruit.bornMotion) / (fruit.arrivalMotion - fruit.bornMotion)));
    fruit.arrivalAt = timeAtMotion(game, fruit.arrivalMotion);
    fruit.travel = fruit.arrivalAt - fruit.bornAt;
  }
  if (game.lastArrivalMotion !== null) game.lastArrivalAt = timeAtMotion(game, game.lastArrivalMotion);
}

// Only the front item can approach faster, so later food never overtakes it.
function assistCandidate(game) {
  const fruit = game.fruits[0];
  return game.catchAssist && game.boostMultiplier === 1 && fruit
    && fruit.lane === game.lane && SNACK_KINDS.includes(fruit.kind) ? fruit : null;
}
function syncCatchAssist(game) {
  const fruit = game.fruits[0];
  if (!fruit) return;
  const active = assistCandidate(game) === fruit && fruit.progress >= ASSIST_START - 1e-12;
  if (Boolean(fruit.assisted) === active) return;
  // Re-anchor at the current position: switching baskets never teleports food.
  const span = game.baseTravel / (active ? ASSIST_SPEED : 1);
  fruit.bornMotion = game.motion - fruit.progress * span;
  fruit.arrivalMotion = game.motion + (1 - fruit.progress) * span;
  fruit.assisted = active;
  refreshTiming(game);
}
function nextAssistTime(game) {
  const fruit = assistCandidate(game);
  if (!fruit || fruit.assisted) return Infinity;
  return timeAtMotion(game, fruit.bornMotion
    + ASSIST_START * (fruit.arrivalMotion - fruit.bornMotion));
}

/** Mutable, browser-independent state. All times, including dt, are seconds. */
export function createGame({ mode = 'classic', random = Math.random, catchAssist = true } = {}) {
  const normalizedMode = mode === 'relaxed' ? 'relaxed' : 'classic';
  const relaxation = normalizedMode === 'relaxed' ? 1.35 : 1;
  const game = {
    mode: normalizedMode, random, catchAssist, phase: 'ready', score: 0, lives: 3,
    protectedUntil: 0, protectionRemaining: 0,
    combo: 0, bestCombo: 0, caught: 0, donuts: 0, sandwiches: 0,
    peppersCaught: 0, avoidedPeppers: 0, spicyUntil: 0, spicyRemaining: 0,
    boostsCaught: 0, boostUntil: 0, boostRemaining: 0, boostMultiplier: 1,
    speedMultiplier: 1, elapsed: 0, level: 1, lane: 1, fruits: [], nextId: 1,
    nextSpawnAt: FIRST_SPAWN_DELAY, nextSpawnMotion: ordinaryDistance(0, FIRST_SPAWN_DELAY),
    lastArrivalAt: null, lastArrivalMotion: null, lastKind: null,
    lastEnergySpawnAt: null, motion: 0, motionAnchor: 0, motionAnchorTime: 0,
    baseTravel: BASE_TRAVEL * relaxation, baseSpawn: BASE_SPAWN * relaxation,
  };
  refreshTiming(game);
  return game;
}
export function startGame(game) {
  Object.assign(game, createGame({ mode: game.mode, random: game.random, catchAssist: game.catchAssist }), { phase: 'playing' });
  return game;
}
export function selectLane(game, lane) {
  if ((game.phase === 'ready' || game.phase === 'playing') && game.boostMultiplier !== 4
    && Number.isInteger(lane) && lane >= 0 && lane < 4) {
    game.lane = lane;
    syncCatchAssist(game);
  }
  return game;
}
export function pauseGame(game) {
  if (game.phase === 'playing') game.phase = 'paused';
  return game;
}
export function resumeGame(game) {
  if (game.phase === 'paused') game.phase = 'playing';
  return game;
}
function randomUnit(game) {
  return Math.min(1 - Number.EPSILON, Math.max(0, game.random()));
}
function chooseKind(game) {
  let roll = randomUnit(game);
  const energyEligible = game.elapsed >= 20 && game.nextId > 5 && game.boostMultiplier !== 4
    && (game.lastEnergySpawnAt === null || game.elapsed - game.lastEnergySpawnAt >= 45);
  if (energyEligible && roll >= 0.97) return 'energy';
  if (energyEligible) roll /= 0.97;
  const canBeChili = game.nextId > 5 && game.lastKind !== 'chili';
  if (canBeChili && roll >= 1 - CHILI_CHANCE) return 'chili';
  const snackRoll = canBeChili ? roll / (1 - CHILI_CHANCE) : roll;
  return SNACK_KINDS[Math.min(SNACK_KINDS.length - 1, Math.floor(snackRoll * SNACK_KINDS.length))];
}
function autoSelectLane(game) {
  if (game.boostMultiplier !== 4 || !game.fruits.length) return;
  const first = game.fruits[0];
  if (first.kind !== 'chili') game.lane = first.lane;
  else {
    const nextSafe = game.fruits.find(fruit => fruit.kind !== 'chili' && fruit.lane !== first.lane);
    game.lane = nextSafe ? nextSafe.lane : (first.lane + 1) % 4;
  }
}
function spawnFruit(game, events) {
  const lane = Math.floor(randomUnit(game) * 4);
  const kind = chooseKind(game);
  const fruit = {
    id: game.nextId++, lane, kind, progress: 0, bornAt: game.elapsed, bornMotion: game.motion,
    arrivalMotion: Math.max(game.motion + game.baseTravel,
      game.lastArrivalMotion === null ? 0 : game.lastArrivalMotion + BASE_SPAWN),
  };
  fruit.arrivalAt = timeAtMotion(game, fruit.arrivalMotion);
  fruit.travel = fruit.arrivalAt - fruit.bornAt;
  game.fruits.push(fruit);
  game.lastKind = kind;
  game.lastArrivalMotion = fruit.arrivalMotion;
  game.lastArrivalAt = fruit.arrivalAt;
  if (kind === 'energy') game.lastEnergySpawnAt = game.elapsed;
  if (game.boostMultiplier === 4) {
    game.nextSpawnMotion = null;
    game.nextSpawnAt = game.elapsed + BOOST_SPAWN_INTERVAL;
  } else {
    game.nextSpawnMotion = game.motion + game.baseSpawn;
    game.nextSpawnAt = timeAtMotion(game, game.nextSpawnMotion);
  }
  events.push({ type: 'spawn', id: fruit.id, lane, kind, at: game.elapsed, arrivalAt: fruit.arrivalAt });
}
function beginBoost(game, event, events) {
  game.boostsCaught += 1;
  if (game.boostMultiplier === 4) return; // A second pickup cannot extend the effect.
  game.motionAnchor = game.motion;
  game.motionAnchorTime = game.elapsed;
  game.boostMultiplier = 4;
  game.boostUntil = game.elapsed + BOOST_DURATION;
  game.boostRemaining = BOOST_DURATION;
  game.nextSpawnAt = Math.min(game.nextSpawnAt, game.elapsed + BOOST_SPAWN_INTERVAL);
  game.nextSpawnMotion = null;
  refreshTiming(game);
  events.push({ ...event, type: 'boost', duration: BOOST_DURATION, boostUntil: game.boostUntil });
}
function endBoost(game, events) {
  game.motionAnchor = game.motion;
  game.motionAnchorTime = game.elapsed;
  game.boostMultiplier = 1;
  game.boostUntil = 0;
  game.boostRemaining = 0;
  game.nextSpawnMotion = game.motion + game.baseSpawn;
  refreshTiming(game);
  events.push({ type: 'boost-end', at: game.elapsed });
}
function resolveFruit(game, events) {
  const fruit = game.fruits.shift();
  const event = { id: fruit.id, lane: fruit.lane, kind: fruit.kind, at: game.elapsed };
  if (game.boostMultiplier === 4) game.lane = fruit.kind === 'chili' ? (fruit.lane + 1) % 4 : fruit.lane;
  if (fruit.kind === 'energy') {
    if (game.lane === fruit.lane) beginBoost(game, event, events);
    else events.push({ ...event, type: 'energy-miss' });
    return;
  }
  if (fruit.kind === 'chili') {
    if (game.lane === fruit.lane) {
      game.peppersCaught += 1;
      game.combo = 0;
      game.spicyUntil = game.elapsed + SPICY_DURATION;
      game.spicyRemaining = SPICY_DURATION;
      events.push({ ...event, type: 'spicy', duration: SPICY_DURATION, spicyUntil: game.spicyUntil });
    } else {
      game.avoidedPeppers += 1;
      events.push({ ...event, type: 'dodge', avoidedPeppers: game.avoidedPeppers });
    }
    return;
  }
  if (game.lane === fruit.lane) {
    const points = fruit.kind === 'sandwich' ? 2 : 1;
    if (fruit.kind === 'sandwich') game.sandwiches += 1;
    else game.donuts += 1;
    game.caught += 1;
    game.score += points;
    game.combo += 1;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    events.push({ ...event, type: 'catch', score: game.score, combo: game.combo, points });
    const nextLevel = 1 + Math.floor(game.caught / 10);
    if (nextLevel !== game.level) {
      game.level = nextLevel;
      events.push({ type: 'level', level: game.level, at: game.elapsed });
    }
  } else {
    game.combo = 0;
    if (game.elapsed < game.protectedUntil) {
      events.push({ ...event, type: 'protected-miss', lives: game.lives });
      return;
    }
    game.lives -= 1;
    if (game.lives > 0) {
      game.protectedUntil = game.elapsed + MISS_PROTECTION_DURATION;
      game.protectionRemaining = MISS_PROTECTION_DURATION;
    }
    events.push({ ...event, type: 'miss', lives: game.lives });
    if (game.lives === 0) {
      game.phase = 'over';
      events.push({ type: 'over', score: game.score, at: game.elapsed });
    }
  }
}

/** Events and movement use an analytic clock, independent of frame duration. */
export function updateGame(game, dt) {
  const events = [];
  if (game.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return events;
  const target = game.elapsed + dt;
  syncCatchAssist(game);
  while (game.phase === 'playing') {
    const nextArrival = game.fruits[0]?.arrivalAt ?? Infinity;
    const nextCooling = game.spicyUntil > 0 ? game.spicyUntil : Infinity;
    const nextBoostEnd = game.boostUntil > 0 ? game.boostUntil : Infinity;
    const nextEvent = Math.min(nextArrival, game.nextSpawnAt, nextCooling, nextBoostEnd, nextAssistTime(game));
    if (nextEvent > target) break;
    game.elapsed = nextEvent;
    refreshTiming(game);
    if (nextBoostEnd <= nextEvent) endBoost(game, events);
    if (nextCooling <= nextEvent) {
      game.spicyUntil = 0;
      game.spicyRemaining = 0;
      events.push({ type: 'cooled', at: game.elapsed });
    }
    if (nextArrival <= nextEvent) resolveFruit(game, events);
    if (game.phase === 'playing' && game.nextSpawnAt <= nextEvent) spawnFruit(game, events);
    autoSelectLane(game);
    syncCatchAssist(game);
  }
  if (game.phase === 'playing') {
    game.elapsed = target;
    refreshTiming(game);
    autoSelectLane(game);
    syncCatchAssist(game);
  }
  return events;
}
