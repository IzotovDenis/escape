export const SIZE = 32;
export const CELL = 3.2;
export const ORIGIN = 15;
export const TOTAL = 20;
export const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(1));
function carve(x0, z0, x1, z1) {
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) grid[z][x] = 0;
}
for (const line of [1, 8, 15, 22, 29]) {
  carve(line, 1, line + 1, 30); carve(1, line, 30, line + 1);
}
export const at = (x, z) => ({ x: (x - ORIGIN) * CELL, z: (z - ORIGIN) * CELL });
export const tile = (p) => ({ x: Math.floor(p.x / CELL + ORIGIN + 0.5), z: Math.floor(p.z / CELL + ORIGIN + 0.5) });
export const open = (x, z) => grid[z]?.[x] === 0;
const names = ['Астрономия', 'Музыка', 'География', 'Лаборатория', 'Математика', 'Рисование', 'Библиотека', 'Робототехника', 'История', 'Биология', 'Мастерская', 'Литература', 'Класс открытий', 'Класс мечты', 'Класс загадок', 'Класс приключений'];
export const ROOMS = [];
export const DOORS = [];
for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
  const x = 4 + col * 7, z = 4 + row * 7, id = row * 4 + col;
  carve(x, z, x + 2, z + 2);
  const room = { id, x, z, cx: x + 1, cz: z + 1, name: names[id], color: ['#bda167', '#729b9e', '#a28ba9', '#a8ad7d'][row] };
  ROOMS.push(room);
  for (const [tx, tz, axis] of [[x + 1, z + 3, 'z'], [x + 3, z + 1, 'x']]) {
    grid[tz][tx] = 0;
    DOORS.push({ ...at(tx, tz), tx, tz, axis, id: DOORS.length, roomId: id, name: room.name });
  }
}
const doorTiles = new Map(DOORS.map(door => [door.tz * SIZE + door.tx, door]));
export const doorAt = p => { const t = tile(p); return doorTiles.get(t.z * SIZE + t.x); };
export const roomAt = p => { const t = tile(p); return ROOMS.find(r => t.x >= r.x && t.x <= r.x + 2 && t.z >= r.z && t.z <= r.z + 2); };
export const SPAWN = at(16, 29);
export const ENEMY_SPAWN = at(16, 16);
export const WANDERER_SPAWN = at(8, 22);
export const EXIT = at(16, 30);
export const CATS = [
  { ...at(15, 28), id: 0, name: 'Рыжик', power: 'energy' },
  { ...at(16, 24), id: 1, name: 'Полосатик', power: 'hint' },
];
export const DOG = at(15, 26);
export const BOOKS = [
  ...ROOMS.map(room => ({ ...at(room.cx, room.cz), roomId: room.id })),
  ...[3, 6, 9, 12].map(id => { const room = ROOMS[id], center = at(room.cx, room.cz); return { x: center.x + 2.2, z: center.z - 2.1, roomId: id }; })
].map((book, id) => ({ ...book, id }));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function canStand(x, z, radius = 0.28, openedDoors = null) {
  const min = tile({ x: x - radius, z: z - radius });
  const max = tile({ x: x + radius, z: z + radius });
  for (let iz = min.z; iz <= max.z; iz++) for (let ix = min.x; ix <= max.x; ix++) {
    const door = doorTiles.get(iz * SIZE + ix);
    if (open(ix, iz) && (!openedDoors || !door || openedDoors.has(door.id))) continue;
    const center = at(ix, iz);
    const nearX = Math.max(center.x - CELL / 2, Math.min(x, center.x + CELL / 2));
    const nearZ = Math.max(center.z - CELL / 2, Math.min(z, center.z + CELL / 2));
    if (Math.hypot(x - nearX, z - nearZ) < radius) return false;
  }
  return true;
}

export function move(body, dx, dz, openedDoors = null) {
  // Substeps also prevent tunnelling when a browser frame stalls.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  for (let i = 0; i < steps; i++) {
    if (canStand(body.x + dx / steps, body.z, 0.28, openedDoors)) body.x += dx / steps;
    if (canStand(body.x, body.z + dz / steps, 0.28, openedDoors)) body.z += dz / steps;
  }
}

export function route(from, to, openedDoors = null) {
  const start = tile(from), goal = tile(to);
  if (!open(start.x, start.z) || !open(goal.x, goal.z)) return [];
  const key = ({ x, z }) => z * SIZE + x;
  const queue = [start], parents = new Map([[key(start), null]]);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (key(current) === key(goal)) {
      const path = [];
      let item = current;
      while (parents.get(key(item)) !== null) { path.unshift(at(item.x, item.z)); item = parents.get(key(item)); }
      return path;
    }
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const next = { x: current.x + dx, z: current.z + dz };
      const door = doorTiles.get(key(next));
      if (open(next.x, next.z) && (!openedDoors || !door || openedDoors.has(door.id)) && !parents.has(key(next))) { parents.set(key(next), current); queue.push(next); }
    }
  }
  return [];
}

export function visible(a, b, openedDoors = null) {
  const length = distance(a, b), steps = Math.ceil(length / 0.25);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    if (!canStand(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.22, openedDoors)) return false;
  }
  return true;
}

export function newGame(mode = 'easy') {
  return { catReadyAt: [0, 0], petMessage: null, hintBook: null, hintUntil: 0, cats: CATS.map(cat => ({ ...cat, path: [], rest: 2 + cat.id * 3 })), dog: { ...DOG, path: [], rest: 0, phase: 'idle', timer: 5 }, poops: [], slowed: 0, player: { ...SPAWN }, enemy: { ...ENEMY_SPAWN }, wanderer: { ...WANDERER_SPAWN, state: 'wandering', path: [], previous: null, travel: 0, moving: false }, collected: new Set(), openedDoors: new Set(), visitedRooms: new Set(), doorWait: null, stamina: 1, tired: false, elapsed: 0, mode, state: 'playing', grace: 12, path: [], pathAge: 1, enemyTravel: 0, enemyMoving: false };
}

const corridor = p => !roomAt(p) && !doorAt(p) && open(tile(p).x, tile(p).z);

export function wandererSeesPlayer(game) {
  const npc = game.wanderer, d = distance(npc, game.player);
  const facing = npc.facing || { x: 0, z: -1 };
  const dot = ((game.player.x - npc.x) * facing.x + (game.player.z - npc.z) * facing.z) / Math.max(d, 0.001);
  return d < 22 && dot >= 0.5 && visible(npc, game.player, game.openedDoors);
}

export function updateWanderer(game, dt) {
  const npc = game.wanderer;
  npc.moving = false;
  npc.facing ??= { x: 0, z: -1 };
  npc.turnIn ??= 14 + Math.random() * 16;
  const seesPlayer = wandererSeesPlayer(game);
  const nextState = seesPlayer ? 'chasing' : 'wandering';
  if (npc.state !== nextState) { npc.path = []; npc.state = nextState; }
  let target;
  if (seesPlayer) target = game.player;
  else {
    npc.turnIn -= dt;
    while (npc.path.length && distance(npc, npc.path[0]) < 0.05) npc.path.shift();
    if (!npc.path.length) {
      const cell = tile(npc), center = at(cell.x, cell.z);
      if (distance(npc, center) > 0.05) npc.path = [center];
      else if (corridor(npc)) {
        const options = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([x, z]) => at(cell.x + x, cell.z + z)).filter(corridor);
        const forward = options.filter(p => !npc.previous || distance(p, npc.previous) > 0.1);
        const reverse = options.filter(p => npc.previous && distance(p, npc.previous) < 0.1);
        const choices = npc.turnIn <= 0 && reverse.length ? reverse : forward.length ? forward : options;
        if (npc.turnIn <= 0) npc.turnIn = 14 + Math.random() * 16;
        if (choices.length) npc.path = [choices[Math.floor(Math.random() * choices.length)]];
        npc.previous = center;
      } else {
        // After losing the player in a classroom, return through an open door.
        const exits = DOORS.filter(d => game.openedDoors.has(d.id)).map(d => at(d.tx + (d.axis === 'x' ? 1 : 0), d.tz + (d.axis === 'z' ? 1 : 0))).sort((a, b) => distance(npc, a) - distance(npc, b));
        for (const exit of exits) { const path = route(npc, exit, game.openedDoors); if (path.length) { npc.path = path; break; } }
      }
    }
    target = npc.path[0];
  }
  if (target) {
    const d = distance(npc, target), speed = seesPlayer ? (game.mode === 'easy' ? 2.65 : 3.15) : 1.55;
    if (d > 0.001) {
      const before = { x: npc.x, z: npc.z }, step = Math.min(d, speed * dt);
      move(npc, (target.x - npc.x) / d * step, (target.z - npc.z) / d * step, game.openedDoors);
      const travelled = distance(before, npc);
      if (travelled > 0.0001) npc.facing = { x: (npc.x - before.x) / travelled, z: (npc.z - before.z) / travelled };
      npc.travel += travelled; npc.moving = travelled > 0.0001;
      if (!npc.moving && dt > 0) npc.path = [];
    }
  }
  if (seesPlayer && distance(npc, game.player) < 0.82) game.state = 'caught';
}

export function updateGame(game, dt, input) {
  if (game.state !== 'playing') return;
  game.enemyMoving = false;
  dt = Math.min(Math.max(dt, 0), 0.05);
  game.elapsed += dt;
  updatePets(game, dt);
  game.grace = Math.max(0, game.grace - dt);
  const moving = Math.hypot(input.x, input.z) > 0;
  if (game.tired && game.stamina >= 0.28) game.tired = false;
  const sprint = moving && input.sprint && !game.tired && game.stamina > 0;
  const speed = (sprint ? 6 : 3.45) * (game.slowed > 0 ? 0.5 : 1);
  const len = Math.max(1, Math.hypot(input.x, input.z));
  move(game.player, input.x / len * speed * dt, input.z / len * speed * dt, game.openedDoors);
  const room = roomAt(game.player);
  if (room) game.visitedRooms.add(room.id);
  game.stamina = Math.max(0, Math.min(1, game.stamina + dt * (sprint ? -0.18 : moving ? 0.1 : 0.22)));
  if (game.stamina === 0) game.tired = true;
  updateWanderer(game, dt);
  if (game.state !== 'playing') return;
  if (game.grace > 0) return;
  const enemySpeed = (game.mode === 'easy' ? 2.2 : 2.85) + game.collected.size * 0.025;
  if (game.doorWait) {
    const waiting = game.doorWait;
    waiting.remaining -= dt;
    if (waiting.remaining <= 0 || game.openedDoors.has(waiting.id)) { game.openedDoors.add(waiting.id); game.doorWait = null; }
    else return;
  }
  game.pathAge += dt;
  let target;
  if (visible(game.enemy, game.player, game.openedDoors)) target = game.player;
  else {
    if (game.pathAge >= 0.6 || !game.path.length) {
      game.path = route(game.enemy, game.player); game.pathAge = 0;
      // Start from the current tile centre before turning around a wall corner.
      const cell = tile(game.enemy), center = at(cell.x, cell.z);
      if (game.path[0] && !visible(game.enemy, game.path[0])) game.path.unshift(center);
    }
    while (game.path.length && distance(game.enemy, game.path[0]) < 0.1) game.path.shift();
    target = game.path[0];
  }
  if (target) {
    const door = doorAt(target);
    if (door && !game.openedDoors.has(door.id) && distance(game.enemy, door) < 2.35) {
      game.doorWait = { id: door.id, remaining: 0.85 };
      return;
    }
    const d = distance(game.enemy, target);
    if (d > 0.01) {
      const step = Math.min(d, enemySpeed * dt);
      const previous = { ...game.enemy };
      move(game.enemy, (target.x - game.enemy.x) / d * step, (target.z - game.enemy.z) / d * step, game.openedDoors);
      const travelled = distance(previous, game.enemy);
      game.enemyTravel += travelled;
      game.enemyMoving = travelled > 0.0001;
    }
  }
  if (distance(game.player, game.enemy) < 0.82 && visible(game.player, game.enemy, game.openedDoors)) game.state = 'caught';
}

export function nearby(game) {
  return BOOKS.find(book => !game.collected.has(book.id) && distance(game.player, book) < 1.65 && visible(game.player, book, game.openedDoors));
}

export const nearbyDoor = game => DOORS.filter(door => distance(game.player, door) < 2.35 && visible(game.player, door)).sort((a, b) => distance(game.player, a) - distance(game.player, b))[0];

export function interact(game) {
  if (game.state !== 'playing') return null;
  const book = nearby(game);
  if (book) { game.collected.add(book.id); game.stamina = Math.min(1, game.stamina + 0.35); return 'book'; }
  const cat = nearbyCat(game);
  if (cat) {
    if (game.catReadyAt[cat.id] > game.elapsed) {
      game.petMessage = `${cat.name} мурчит. Снова поможет через ${Math.ceil(game.catReadyAt[cat.id] - game.elapsed)} сек.`;
      return 'cat-rest';
    }
    game.catReadyAt[cat.id] = game.elapsed + 25;
    if (cat.power === 'energy') {
      game.stamina = 1; game.tired = false;
      game.petMessage = 'Мур-р! Рыжик восстановил всю энергию.';
    } else {
      const book = BOOKS.filter(b => !game.collected.has(b.id)).sort((a, b) => distance(game.player, a) - distance(game.player, b))[0];
      game.hintBook = book?.id ?? null; game.hintUntil = game.elapsed + 20;
      game.petMessage = book ? `Полосатик подсказывает: ${ROOMS[book.roomId].name}. Тетрадь отмечена на карте на 20 секунд!` : 'Полосатик мурчит: всё собрано, пора к выходу!';
    }
    return 'cat';
  }
  const door = nearbyDoor(game);
  if (door) {
    if (game.openedDoors.has(door.id)) {
      if (distance(game.player, door) < 1.95 || distance(game.enemy, door) < 1.95 || distance(game.wanderer, door) < 1.95) return 'door-blocked';
      game.openedDoors.delete(door.id); return 'door-close';
    }
    game.openedDoors.add(door.id); return 'door-open';
  }
  if (distance(game.player, EXIT) < 2) {
    if (game.collected.size === TOTAL) { game.state = 'won'; return 'won'; }
    return 'locked';
  }
  return null;
}

export const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;


export const nearbyCat = game => game.cats.filter(cat => distance(game.player, cat) < 2.1 && visible(game.player, cat, game.openedDoors)).sort((a, b) => distance(game.player, a) - distance(game.player, b))[0];

// Choose adjacent corridor cells so pets never cross a wall or a closed door.
function stroll(pet, game, dt, speed) {
  pet.moving = false;
  if (pet.rest > 0) { pet.rest = Math.max(0, pet.rest - dt); return; }
  if (!pet.path.length) {
    const cell = tile(pet), center = at(cell.x, cell.z);
    if (distance(pet, center) > 0.05) pet.path = [center];
    else {
      const options = [[0, -1], [1, 0], [0, 1], [-1, 0]]
        .map(([x, z]) => at(cell.x + x, cell.z + z)).filter(corridor);
      const onward = options.filter(p => !pet.previous || distance(p, pet.previous) > 0.1);
      const choices = onward.length ? onward : options;
      if (!choices.length) return;
      pet.previous = center;
      pet.path = [choices[Math.floor(Math.random() * choices.length)]];
    }
  }
  const target = pet.path[0], d = distance(pet, target), step = Math.min(d, speed * dt);
  if (d > 0.001) {
    const before = { x: pet.x, z: pet.z };
    move(pet, (target.x - pet.x) / d * step, (target.z - pet.z) / d * step, game.openedDoors);
    pet.moving = distance(before, pet) > 0.0001;
  }
  if (distance(pet, target) < 0.05) {
    pet.path.shift();
    if (Math.random() < 0.2) pet.rest = 1 + Math.random() * 3;
  }
}

export function updatePets(game, dt) {
  game.slowed = Math.max(0, game.slowed - dt);
  for (const cat of game.cats) {
    // Stop nearby so the player can pet a moving cat.
    if (distance(game.player, cat) < 2.1) cat.moving = false;
    else stroll(cat, game, dt, 0.85);
  }
  game.dog.moving = false;
  if (game.dog.phase === 'idle') stroll(game.dog, game, dt, 1.2);
  game.dog.timer -= dt;
  if (game.dog.timer <= 0) {
    if (game.dog.phase === 'idle') {
      game.dog.phase = 'squatting'; game.dog.timer = 2.5;
    } else {
      game.dog.phase = 'idle'; game.dog.timer = 16;
      game.poops.push({ x: game.dog.x, z: game.dog.z });
    }
  }
  // Piles persist after contact; stepping away lets the slowdown wear off.
  if (game.poops.some(poop => distance(game.player, poop) < 0.65)) game.slowed = 2.5;
}
