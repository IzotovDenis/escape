import test from 'node:test';
import assert from 'node:assert/strict';
import { grid, at, open, canStand, move, route, newGame, BOOKS, DOORS, ROOMS, EXIT, SPAWN, TOTAL, interact, updateGame, visible, distance } from './game.js';

test('Every notebook, classroom and exit can be reached from spawn', () => {
  for (let z = 0; z < grid.length; z++) for (let x = 0; x < grid[z].length; x++) {
    if (!open(x, z) || distance(at(x, z), SPAWN) === 0) continue;
    assert.ok(route(SPAWN, at(x, z)).length, `Unreachable tile ${x},${z}`);
  }
  for (const destination of [...BOOKS, EXIT]) assert.ok(canStand(destination.x, destination.z));
});

test('Collision blocks walls, map edges and large movement jumps', () => {
  const body = at(16, 26), startX = body.x;
  move(body, 100, 0);
  assert.ok(body.x <= startX + 1.33);
  assert.ok(canStand(body.x, body.z));
  assert.equal(canStand(-999, -999), false);
  assert.equal(visible(at(16, 26), at(19, 26)), false);
});

test('A notebook can only be collected once and an early exit is locked', () => {
  const game = newGame();
  game.player = { ...EXIT };
  assert.equal(interact(game), 'locked');
  game.player = { ...BOOKS[0] }; game.stamina = 0.2;
  assert.equal(interact(game), 'book');
  assert.equal(game.collected.size, 1); assert.ok(game.stamina > 0.2);
  assert.equal(interact(game), null); assert.equal(game.collected.size, 1);
  game.state = 'paused'; game.player = { ...BOOKS[1] };
  assert.equal(interact(game), null);
});

test('Collecting all twenty and using the exit wins; restart clears the run', () => {
  const game = newGame();
  for (const book of BOOKS) { game.player = { ...book }; assert.equal(interact(game), 'book'); }
  assert.equal(game.collected.size, TOTAL);
  assert.equal(game.state, 'playing');
  game.player = { ...EXIT }; assert.equal(interact(game), 'won'); assert.equal(game.state, 'won');
  const next = newGame('normal');
  assert.equal(next.collected.size, 0); assert.equal(next.elapsed, 0); assert.equal(next.stamina, 1); assert.equal(next.mode, 'normal');
});

test('Sprint drains energy, rest restores it, and pause freezes the simulation', () => {
  const game = newGame(); game.grace = 999;
  for (let i = 0; i < 130; i++) updateGame(game, 0.05, { x: 0, z: -1, sprint: true });
  assert.ok(game.stamina < 0.2); assert.equal(game.tired, true);
  for (let i = 0; i < 100; i++) updateGame(game, 0.05, { x: 0, z: 0, sprint: false });
  assert.equal(game.stamina, 1); assert.equal(game.tired, false);
  game.state = 'paused'; const before = JSON.stringify(game);
  updateGame(game, 1, { x: 1, z: 0, sprint: true }); assert.equal(JSON.stringify(game), before);
});

test('Pursuer navigates corners into every classroom and catches a stationary player', () => {
  for (const destination of BOOKS) {
    const game = newGame(); game.grace = 0; game.player = { x: destination.x + 0.7, z: destination.z + 0.45 };
    for (let i = 0; i < 4000 && game.state === 'playing'; i++) {
      updateGame(game, 0.05, { x: 0, z: 0, sprint: false });
      assert.ok(canStand(game.enemy.x, game.enemy.z, 0.28, game.openedDoors), 'Pursuer entered a wall or a closed door');
    }
    assert.equal(game.state, 'caught', `Pursuer stuck on route to notebook ${destination.id}`);
  }
});

test('Expanded school has twenty hidden notebooks, sixteen rooms and two doors per room', () => {
  assert.equal(grid.length, 32); assert.equal(TOTAL, 20); assert.equal(BOOKS.length, TOTAL);
  assert.equal(ROOMS.length, 16); assert.equal(DOORS.length, 32);
  for (const room of ROOMS) assert.equal(DOORS.filter(d => d.roomId === room.id).length, 2);
  for (const book of BOOKS) assert.ok(ROOMS.some(r => r.id === book.roomId));
});

test('Doors block movement and sight, open and close with interaction, and reset closed', () => {
  const game = newGame(), door = DOORS[0];
  game.player = { x: door.x, z: door.z + 2.15 };
  assert.equal(visible(game.player, { x: door.x, z: door.z - 2.15 }, game.openedDoors), false);
  const blocked = { ...game.player }; move(blocked, 0, -4, game.openedDoors);
  assert.ok(blocked.z > door.z);
  assert.equal(interact(game), 'door-open'); assert.equal(game.openedDoors.has(door.id), true);
  assert.equal(visible(game.player, { x: door.x, z: door.z - 2.15 }, game.openedDoors), true);
  move(game.player, 0, -2.15, game.openedDoors);
  assert.equal(interact(game), 'door-blocked');
  move(game.player, 0, -2.15, game.openedDoors);
  assert.equal(interact(game), 'door-close'); assert.equal(game.openedDoors.has(door.id), false);
  assert.equal(newGame().openedDoors.size, 0);
});

test('A pursuer opens a closed door after a delay instead of passing through it', () => {
  const game = newGame(), door = DOORS[0];
  game.enemy = { x: door.x, z: door.z + 2.15 };
  game.player = { ...BOOKS[0] }; game.grace = 0;
  const none = { x: 0, z: 0, sprint: false };
  updateGame(game, 0.05, none);
  assert.ok(game.doorWait); assert.equal(game.openedDoors.has(door.id), false);
  for (let i = 0; i < 20; i++) updateGame(game, 0.05, none);
  assert.ok(game.openedDoors.has(door.id));
});

test('Grace period stops the pursuer and diagonal speed matches straight speed', () => {
  const a = newGame(), b = newGame(); const initial = { ...a.enemy };
  updateGame(a, 0.05, { x: 0, z: -1, sprint: false });
  updateGame(b, 0.05, { x: 1, z: -1, sprint: false });
  assert.deepEqual(a.enemy, initial);
  assert.ok(Math.abs(distance(a.player, SPAWN) - distance(b.player, SPAWN)) < 0.001);
});

test('Pursuer stands during grace and door waits, and runs only when actually moving', () => {
  const game = newGame(), none = { x: 0, z: 0, sprint: false };
  assert.equal(game.enemyMoving, false);
  updateGame(game, 0.05, none); assert.equal(game.enemyMoving, false);
  game.grace = 0;
  updateGame(game, 0.05, none); assert.equal(game.enemyMoving, true);
  const door = DOORS[0];
  game.enemy = { x: door.x, z: door.z + 2.15 }; game.player = { ...BOOKS[0] };
  game.path = []; game.pathAge = 1;
  updateGame(game, 0.05, none); assert.ok(game.doorWait); assert.equal(game.enemyMoving, false);
  for (let i = 0; i < 10; i++) updateGame(game, 0.05, none);
  assert.equal(game.enemyMoving, false);
  for (let i = 0; i < 10; i++) updateGame(game, 0.05, none);
  assert.equal(game.enemyMoving, true);
  updateGame(game, 0, none); assert.equal(game.enemyMoving, false);
});

test('Analog movement preserves partial stick speed and clamps diagonal input', () => {
  const simulate = (x, z) => {
    const game = newGame(); game.state = 'playing';
    const start = { ...game.player };
    updateGame(game, 0.05, { x, z, sprint: false });
    return distance(start, game.player);
  };
  const full = simulate(0, -1);
  assert.ok(Math.abs(simulate(0, -0.25) - full * 0.25) < 1e-8);
  assert.ok(Math.abs(simulate(1, -1) - full) < 1e-8);
  assert.equal(simulate(0, 0), 0);
});

test('Wanderer walks immediately while the first pursuer waits', () => {
  const game = newGame(), start = { ...game.wanderer };
  updateGame(game, 0.05, { x: 0, z: 0 });
  assert.ok(distance(start, game.wanderer) > 0);
  assert.equal(game.enemyMoving, false);
  assert.equal(game.wanderer.state, 'wandering');
});

test('Wanderer sees only ahead, loses sight at walls and cannot catch from behind', async () => {
  const { wandererSeesPlayer, updateWanderer } = await import('./game.js');
  const game = newGame(), npc = game.wanderer;
  Object.assign(npc, at(16, 20), { facing: { x: 0, z: -1 } });
  game.player = at(16, 18);
  assert.equal(wandererSeesPlayer(game), true);
  updateWanderer(game, 0.05); assert.equal(npc.state, 'chasing');
  game.player = { x: npc.x, z: npc.z + 0.4 };
  assert.equal(wandererSeesPlayer(game), false);
  updateWanderer(game, 0.01); assert.equal(game.state, 'playing'); assert.equal(npc.state, 'wandering');
  Object.assign(npc, at(16, 20), { facing: { x: 1, z: 0 } });
  game.player = at(19, 20);
  assert.equal(wandererSeesPlayer(game), false);
  Object.assign(npc, at(16, 20), { facing: { x: 0, z: -1 } });
  game.player = { x: npc.x, z: npc.z - 0.5 };
  updateWanderer(game, 0.01); assert.equal(game.state, 'caught');
});

test('Wanderer patrol stays in corridors and reverses only after its timer', async () => {
  const { updateWanderer, roomAt, doorAt } = await import('./game.js');
  const game = newGame(), npc = game.wanderer;
  game.player = { ...BOOKS[0] };
  Object.assign(npc, at(16, 20), { previous: at(16, 21), turnIn: 0, facing: { x: 0, z: -1 } });
  updateWanderer(game, 0.05);
  assert.ok(npc.facing.z > 0.9); assert.ok(npc.turnIn >= 14);
  for (let i = 0; i < 5000; i++) {
    updateWanderer(game, 0.05);
    assert.ok(canStand(npc.x, npc.z, 0.28, game.openedDoors));
    assert.equal(roomAt(npc), undefined); assert.equal(doorAt(npc), undefined);
  }
  assert.ok(npc.travel > 300);
});

test('Wanderer leaves a classroom after losing sight through an open doorway', async () => {
  const { updateWanderer, roomAt } = await import('./game.js');
  const game = newGame(), npc = game.wanderer;
  Object.assign(npc, BOOKS[0]);
  game.openedDoors.add(DOORS[0].id);
  for (let i = 0; i < 400; i++) updateWanderer(game, 0.05);
  assert.equal(roomAt(npc), undefined);
  assert.ok(canStand(npc.x, npc.z, 0.28, game.openedDoors));
});

test('Cats restore energy with a cooldown and hint at an uncollected notebook', async () => {
  const { CATS } = await import('./game.js');
  const game = newGame();
  game.player = { ...CATS[0] }; game.stamina = 0.1; game.tired = true;
  assert.equal(interact(game), 'cat');
  assert.equal(game.stamina, 1); assert.equal(game.tired, false);
  game.stamina = 0.4;
  assert.equal(interact(game), 'cat-rest'); assert.equal(game.stamina, 0.4);
  game.elapsed = 25;
  assert.equal(interact(game), 'cat'); assert.equal(game.stamina, 1);
  game.player = { ...CATS[1] };
  game.collected.add(0);
  assert.equal(interact(game), 'cat');
  assert.ok(BOOKS.some(b => b.id === game.hintBook));
  assert.ok(!game.collected.has(game.hintBook));
  game.elapsed += 25; game.collected = new Set(BOOKS.map(b => b.id));
  assert.equal(interact(game), 'cat'); assert.equal(game.hintBook, null);
});

test('Dog squats before leaving a pile; stepping on it slows movement briefly', async () => {
  const { updatePets } = await import('./game.js');
  const game = newGame();
  updatePets(game, 5); assert.equal(game.dog.phase, 'squatting'); assert.equal(game.poops.length, 0);
  updatePets(game, 2.5); assert.equal(game.dog.phase, 'idle'); assert.equal(game.poops.length, 1);
  game.player = { ...game.poops[0] };
  updatePets(game, 0.01); assert.equal(game.poops.length, 1); assert.equal(game.slowed, 2.5);
  const other = newGame(); other.player = { ...game.player };
  const start = { ...game.player };
  updateGame(game, 0.05, { x: 0, z: -1 }); updateGame(other, 0.05, { x: 0, z: -1 });
  assert.ok(Math.abs(distance(start, game.player) * 2 - distance(start, other.player)) < 0.001);
  game.player = { ...SPAWN };
  updatePets(game, 2.5); assert.equal(game.slowed, 0);
  assert.equal(game.poops.length, 1);
  game.state = 'paused'; const timer = game.dog.timer;
  updateGame(game, 0.05, { x: 0, z: 0 }); assert.equal(game.dog.timer, timer);
  const fresh = newGame(); assert.equal(fresh.poops.length, 0); assert.equal(fresh.slowed, 0); assert.deepEqual(fresh.catReadyAt, [0, 0]);
});


test('Pets roam without crossing walls, interactions follow cats, piles accumulate until restart', async () => {
  const { updatePets, nearbyCat } = await import('./game.js');
  const game = newGame();
  const starts = [...game.cats, game.dog].map(p => ({ x: p.x, z: p.z }));
  const travelled = [0, 0, 0];
  for (let i = 0; i < 2400; i++) {
    updatePets(game, 0.05);
    [...game.cats, game.dog].forEach((pet, j) => {
      assert.ok(canStand(pet.x, pet.z, 0.28, game.openedDoors));
      travelled[j] = Math.max(travelled[j], distance(pet, starts[j]));
    });
  }
  assert.ok(travelled.every(d => d > 3));
  assert.ok(game.poops.length >= 6);
  const first = { ...game.poops[0] }, count = game.poops.length;
  game.player = { ...first }; updatePets(game, 0.05);
  assert.equal(game.poops.length, count); assert.equal(game.slowed, 2.5);
  assert.deepEqual(game.poops[0], first);
  game.player = { ...game.cats[0] };
  assert.equal(nearbyCat(game).id, 0);
  assert.equal(interact(game), 'cat');
  const positions = [...game.cats, game.dog].map(p => ({ x: p.x, z: p.z }));
  game.state = 'paused'; updateGame(game, 0.05, { x: 0, z: 0 });
  assert.deepEqual([...game.cats, game.dog].map(p => ({ x: p.x, z: p.z })), positions);
  assert.equal(newGame().poops.length, 0);
});
