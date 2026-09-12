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
export const EXIT = at(16, 30);
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

export function route(from, to) {
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
      if (open(next.x, next.z) && !parents.has(key(next))) { parents.set(key(next), current); queue.push(next); }
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
  return { player: { ...SPAWN }, enemy: { ...ENEMY_SPAWN }, collected: new Set(), openedDoors: new Set(), visitedRooms: new Set(), doorWait: null, stamina: 1, tired: false, elapsed: 0, mode, state: 'playing', grace: 12, path: [], pathAge: 1, enemyTravel: 0, enemyMoving: false };
}

export function updateGame(game, dt, input) {
  if (game.state !== 'playing') return;
  game.enemyMoving = false;
  dt = Math.min(Math.max(dt, 0), 0.05);
  game.elapsed += dt;
  game.grace = Math.max(0, game.grace - dt);
  const moving = Math.hypot(input.x, input.z) > 0;
  if (game.tired && game.stamina >= 0.28) game.tired = false;
  const sprint = moving && input.sprint && !game.tired && game.stamina > 0;
  const speed = sprint ? 6 : 3.45;
  const len = Math.max(1, Math.hypot(input.x, input.z));
  move(game.player, input.x / len * speed * dt, input.z / len * speed * dt, game.openedDoors);
  const room = roomAt(game.player);
  if (room) game.visitedRooms.add(room.id);
  game.stamina = Math.max(0, Math.min(1, game.stamina + dt * (sprint ? -0.18 : moving ? 0.1 : 0.22)));
  if (game.stamina === 0) game.tired = true;
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
  const door = nearbyDoor(game);
  if (door) {
    if (game.openedDoors.has(door.id)) {
      if (distance(game.player, door) < 1.95 || distance(game.enemy, door) < 1.95) return 'door-blocked';
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
