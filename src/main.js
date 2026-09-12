import './style.css';
import './pwa.js';
import { createTouchControls } from './touch.js';
import { createWorld } from './world.js';
import { grid, SIZE, CELL, ORIGIN, DOORS, EXIT, TOTAL, BOOKS, nearbyCat, newGame, updateGame, interact, nearby, nearbyDoor, roomAt, distance, tile, formatTime } from './game.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let game = newGame(), mode = 'easy', world, screen = 'welcome', yaw = 0, pitch = 0;
let lastTime = performance.now(), walkPhase = 0, footTimer = 0, toastTimer, audio, muted = false, mapVisible = false;
let lockedBefore = false, dragging = false, best = 0;
let mapSignature = '';
const keys = new Set();
try { muted = localStorage.getItem('peremena-muted') === 'true'; best = Number(localStorage.getItem('peremena-best-20') || 0); } catch { /* Storage is optional in private browsing. */ }

function sound(frequency = 440, duration = 0.14, volume = 0.035, type = 'sine', delay = 0) {
  if (muted || !audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime + delay;
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(time); oscillator.stop(time + duration + 0.02);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function jingle(kind) {
  const notes = kind === 'won' ? [523, 659, 784, 1047] : kind === 'book' ? [659, 880, 1047] : kind === 'caught' ? [440, 349, 392] : [523, 784];
  notes.forEach((note, i) => sound(note, 0.24, 0.045, 'sine', i * 0.1));
}
function enableAudio() {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); void audio.resume().catch(() => {}); } catch { /* The game works without audio. */ }
}
function updateSoundButton() {
  $('sound').textContent = muted ? '♪̸' : '♫';
  $('sound').setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  $('sound').setAttribute('aria-pressed', String(!muted));
}
$('sound').addEventListener('click', () => { muted = !muted; enableAudio(); updateSoundButton(); try { localStorage.setItem('peremena-muted', String(muted)); } catch {} });
updateSoundButton();
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (touch.enabled) await touch.requestLandscape();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else throw new Error('not supported');
  } catch { if (screen === 'playing') toast('Полный экран недоступен. Можно играть в окне.'); }
});
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
}));

function toast(message, duration = 3500) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), duration);
}
function unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
async function lock() {
  if (touch.enabled) return;
  if (document.pointerLockElement === $('world')) return;
  try {
    if (!$('world').requestPointerLock) throw new Error('not supported');
    await $('world').requestPointerLock();
  } catch { if (screen === 'playing') toast('Обзор: зажми мышь и двигай её, или используй ← →.', 5500); }
}
function reset() {
  touch.reset(); mapVisible = false; $('map-wrap').hidden = true;
  game = newGame(mode); yaw = 0; pitch = -0.015; walkPhase = 0; footTimer = 0;
  $('count').textContent = '0'; $('confetti').replaceChildren();
  updateMap();
}
function start() {
  if (!world) return;
  reset(); screen = 'playing'; game.state = 'playing';
  $('welcome').hidden = true; $('hud').hidden = false; $('modal').hidden = true;
  document.body.classList.add('playing');
  touch.setActive(true); void touch.requestLandscape();
  enableAudio(); jingle('start'); void lock();
  toast(touch.enabled ? 'Слева — идти, справа — обзор. Удерживай «Бег», чтобы ускориться. Найди 20 тетрадей! Первый ждёт 12 секунд, второй уже гуляет — не попадайся ему на глаза.' : '20 тетрадей спрятаны в классах. E — открыть дверь, M — план школы. Котиков можно гладить: рыжий даёт энергию, полосатый — подсказку.', 7000);
}
$('start').addEventListener('click', start);
$('restart').addEventListener('click', start);
$('resume').addEventListener('click', () => {
  if (screen === 'paused') {
    screen = 'playing'; game.state = 'playing'; $('modal').hidden = true; keys.clear(); touch.setActive(true); void touch.requestLandscape(); void lock();
  } else start();
});
$('home').addEventListener('click', () => {
  screen = 'welcome'; game.state = 'welcome'; unlock(); keys.clear(); touch.setActive(false);
  reset(); game.state = 'welcome'; $('modal').hidden = true; $('hud').hidden = true; $('welcome').hidden = false;
  document.body.classList.remove('playing'); $('start').focus();
});
function pause() {
  if (screen !== 'playing') return;
  screen = 'paused'; game.state = 'paused'; keys.clear(); dragging = false; unlock(); touch.setActive(false);
  $('modal').hidden = false; $('modal-symbol').textContent = 'Ⅱ';
  $('modal-eyebrow').textContent = 'МОЖНО ВЫДОХНУТЬ'; $('modal-title').innerHTML = 'Перемена<br>на паузе.';
  $('modal-description').textContent = 'Школа подождёт. Продолжим, когда будешь готов.';
  $('result-stats').hidden = true; $('resume').firstElementChild.textContent = 'Продолжить'; $('restart').hidden = false;
  $('resume').focus();
}
$('pause-button').addEventListener('click', pause);
function finish(result) {
  screen = result; keys.clear(); unlock(); jingle(result); touch.setActive(false);
  $('modal').hidden = false; $('result-stats').hidden = false; $('restart').hidden = true;
  $('resume').firstElementChild.textContent = 'Ещё одну перемену';
  if (result === 'won') {
    const record = !best || game.elapsed < best;
    if (record) { best = game.elapsed; try { localStorage.setItem('peremena-best-20', String(best)); } catch {} }
    $('modal-symbol').textContent = '✳'; $('modal-eyebrow').textContent = record ? 'НОВЫЙ ЛИЧНЫЙ РЕКОРД' : 'ОТЛИЧНЫЙ ЗАБЕГ';
    $('modal-title').innerHTML = 'Вот это<br>перемена!'; $('modal-description').textContent = 'Все тетради на месте. Ты добрался до выхода и выиграл!';
    confetti();
  } else {
    $('modal-symbol').textContent = '☺'; $('modal-eyebrow').textContent = 'ДОГОНЯЛКИ ЕСТЬ ДОГОНЯЛКИ';
    $('modal-title').innerHTML = 'Ага,<br>попался!'; $('modal-description').textContent = 'Хороший забег! В следующий раз срежь через класс и прибереги энергию для рывка.';
  }
  $('result-stats').innerHTML = `<div><strong>${game.collected.size} / ${TOTAL}</strong>тетрадей</div><div><strong>${formatTime(game.elapsed)}</strong>время</div>${result === 'won' ? `<div><strong>${formatTime(best)}</strong>рекорд</div>` : ''}`;
  $('resume').focus();
}
function confetti() {
  if (reduced) return;
  const colors = ['#7651bf', '#edbe6b', '#75a7a0', '#d99bb5'];
  for (let i = 0; i < 45; i++) {
    const particle = document.createElement('i'); particle.className = 'confetto';
    particle.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % 4]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2.3 + Math.random() * 1.4}s`;
    particle.addEventListener('animationend', () => particle.remove()); $('confetti').append(particle);
  }
}
function use() {
  const result = interact(game);
  if (result === 'book') {
    jingle('book'); $('count').textContent = String(game.collected.size); updateMap();
    toast(game.collected.size === TOTAL ? `Все ${TOTAL} тетрадей собраны! Возвращайся к выходу — он отмечен на карте.` : game.collected.size === 1 ? 'Первая есть! В некоторых классах спрятано по две тетради.' : game.collected.size === 10 ? 'Половина уже у тебя. Продолжай поиски!' : `Тетрадей: ${game.collected.size} из ${TOTAL}. Проверь остальные классы!`, 4200);
    if (game.collected.size === TOTAL) { mapVisible = true; $('map-wrap').hidden = false; }
    hud();
  } else if (result === 'cat' || result === 'cat-rest') {
    toast(game.petMessage, 5000);
    if (result === 'cat') { sound(280, 0.35, 0.035, 'triangle'); sound(210, 0.4, 0.025, 'sine', 0.15); }
    if (game.hintBook !== null && game.hintUntil > game.elapsed) { mapVisible = true; $('map-wrap').hidden = false; }
    updateMap(); hud();
  } else if (result === 'door-open' || result === 'door-close') {
    sound(result === 'door-open' ? 210 : 160, 0.12, 0.025, 'triangle');
    updateMap(); hud();
  } else if (result === 'door-blocked') toast('Отойди на шаг от порога, чтобы закрыть дверь.');
  else if (result === 'won') finish('won');
  else if (result === 'locked') toast(`Для выхода нужно ещё ${TOTAL - game.collected.size} тетрадей. Найти их поможет карта.`);
}
function toggleMap() { mapVisible = !mapVisible; $('map-wrap').hidden = !mapVisible; if (mapVisible) updateMap(); }
$('map-toggle').addEventListener('click', toggleMap);
const touch = createTouchControls({
  isPlaying: () => screen === 'playing',
  turn: (x, y) => { yaw -= x; pitch = Math.max(-0.85, Math.min(0.85, pitch - y)); },
  use,
});

const handledKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyM', 'Escape'];
addEventListener('keydown', event => {
  if (screen === 'playing' && handledKeys.includes(event.code)) event.preventDefault();
  if (event.code === 'Escape' && screen === 'playing') { pause(); return; }
  if (screen !== 'playing') return;
  keys.add(event.code);
  if (!event.repeat && event.code === 'KeyE') use();
  if (!event.repeat && event.code === 'KeyM') toggleMap();
});
addEventListener('keyup', event => keys.delete(event.code));
addEventListener('blur', () => { keys.clear(); if (screen === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
document.addEventListener('pointerlockchange', () => {
  const now = document.pointerLockElement === $('world');
  if (lockedBefore && !now && screen === 'playing') pause();
  lockedBefore = now;
});
document.addEventListener('pointerlockerror', () => {
  if (screen === 'playing') toast('Обзор: зажми мышь и двигай её, или используй ← →.', 5500);
});
$('world').addEventListener('pointerdown', event => { if (event.pointerType !== 'touch' && screen === 'playing' && event.button === 0) { dragging = true; if (!document.pointerLockElement) void lock(); } });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('mousemove', event => {
  if (screen !== 'playing' || (!document.pointerLockElement && !dragging)) return;
  yaw -= event.movementX * 0.0023;
  pitch = Math.max(-0.85, Math.min(0.85, pitch - event.movementY * 0.0019));
});
document.addEventListener('keydown', event => {
  if ($('modal').hidden || event.key !== 'Tab') return;
  const buttons = [...$('modal').querySelectorAll('button')].filter(b => !b.hidden);
  const first = buttons[0], last = buttons.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

function updateMap() {
  $('minimap').setAttribute('viewBox', `0 0 ${SIZE * 10} ${SIZE * 10}`);
  let svg = '';
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) if (grid[z][x] === 0) svg += `<rect x="${x * 10}" y="${z * 10}" width="10.4" height="10.4" fill="#6c7274"/>`;
  for (const door of DOORS) {
    const isOpen = game.openedDoors.has(door.id);
    svg += `<rect x="${door.tx * 10 + (door.axis === 'x' ? 3 : 0)}" y="${door.tz * 10 + (door.axis === 'z' ? 3 : 0)}" width="${door.axis === 'x' ? 4 : 10}" height="${door.axis === 'z' ? 4 : 10}" fill="${isOpen ? '#91bcb0' : '#e6bb7c'}"/>`;
  }
  for (const cat of game.cats) {
    const t = tile(cat);
    svg += `<circle id="map-cat-${cat.id}" cx="${t.x * 10 + 5}" cy="${t.z * 10 + 5}" r="3" fill="#ffd19b"><title>${cat.name}</title></circle>`;
  }
  const hinted = game.hintUntil > game.elapsed && BOOKS.find(b => b.id === game.hintBook && !game.collected.has(b.id));
  if (hinted) {
    const t = tile(hinted);
    svg += `<circle cx="${t.x * 10 + 5}" cy="${t.z * 10 + 5}" r="6" fill="#d8b1ff" stroke="white" stroke-width="1.5"><title>Тетрадь — подсказка котика</title></circle>`;
  }
  const exit = tile(EXIT);
  svg += `<rect x="${exit.x * 10 + 1}" y="${exit.z * 10 + 1}" width="8" height="8" rx="2" fill="#7ce0be"/><g id="map-player"><circle r="4" fill="white"/><path d="M-3-5 0-10 3-5" fill="white" opacity=".75"/></g>`;
  $('minimap').innerHTML = svg;
}

function hud() {
  $('timer').textContent = formatTime(game.elapsed);
  $('stamina-bar').style.transform = `scaleX(${game.stamina})`;
  $('stamina-bar').style.background = game.stamina < 0.25 ? '#efa786' : '#efd19c';
  $('stamina-label').textContent = `${Math.round(game.stamina * 100)}%`;
  const d = Math.min(game.grace > 0 ? Infinity : distance(game.player, game.enemy), game.wanderer.state === 'chasing' ? distance(game.player, game.wanderer) : Infinity);
  $('chase-label').textContent = game.slowed > 0 ? 'Ой, наступил! Обойди собачий сюрприз' : game.wanderer.state === 'chasing' ? 'Тебя заметили! Скройся за поворотом' : game.grace > 0 ? `Первый ждёт: ${Math.ceil(game.grace)} сек. Второй гуляет` : game.tired ? 'Переведи дух — энергия вернётся' : d < 5 ? 'Уже близко! Самое время ускориться' : d < 12 ? 'Соперник где-то неподалёку' : 'Отличный отрыв. Ищи тетради!';
  $('danger').style.boxShadow = `inset 0 0 100px 25px rgba(238,183,107,${Math.max(0, 1 - d / 6) * 0.24})`;
  const book = nearby(game), cat = nearbyCat(game), door = nearbyDoor(game), exit = distance(game.player, EXIT) < 2;
  touch.setAction(book ? 'Взять' : cat ? 'Погладить' : door ? game.openedDoors.has(door.id) ? 'Закрыть' : 'Открыть' : exit ? 'Выход' : 'Действие', !!(book || cat || door || exit));
  $('interaction').hidden = !book && !cat && !door && !exit;
  if (book || cat || door || exit) $('interaction').lastElementChild.textContent = book ? 'Взять тетрадь' : cat ? `Погладить · ${cat.name} · ${cat.power === 'energy' ? 'энергия' : 'подсказка'}` : door ? `${game.openedDoors.has(door.id) ? 'Закрыть' : 'Открыть'} · ${door.name}` : game.collected.size === TOTAL ? 'Выйти из школы' : `Выход · нужны ${TOTAL} тетрадей`;
  const t = tile(game.player);
  const room = roomAt(game.player);
  $('location').textContent = room ? `${String(room.id + 1).padStart(2, '0')} · ${room.name}` : t.x === 15 || t.x === 16 ? 'Главный коридор' : ['Северное крыло', 'Крыло открытий', 'Творческое крыло', 'Южное крыло'][Math.min(3, Math.floor(t.z / 8))];
  const signature = [...game.openedDoors].join(',') + ':' + (game.hintUntil > game.elapsed ? game.hintBook : 'none') + ':' + game.collected.size;
  if (signature !== mapSignature) { mapSignature = signature; updateMap(); }
  if (mapVisible) for (const cat of game.cats) {
    const marker = $('map-cat-' + cat.id);
    marker?.setAttribute('cx', (cat.x / CELL + ORIGIN) * 10 + 5);
    marker?.setAttribute('cy', (cat.z / CELL + ORIGIN) * 10 + 5);
  }
  if (mapVisible) $('map-player')?.setAttribute('transform', `translate(${(game.player.x / CELL + ORIGIN) * 10 + 5},${(game.player.z / CELL + ORIGIN) * 10 + 5}) rotate(${-yaw * 180 / Math.PI})`);
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
  if (screen === 'playing' && !touch.needsRotation) {
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + touch.input.forward;
    const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + touch.input.right;
    yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.65;
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.input.sprint;
    const input = { x: -Math.sin(yaw) * forward + Math.cos(yaw) * right, z: -Math.cos(yaw) * forward - Math.sin(yaw) * right, sprint };
    const previous = { ...game.player };
    updateGame(game, dt, input);
    const moved = distance(previous, game.player);
    walkPhase += moved * 4;
    if (moved > 0.002) {
      footTimer += dt;
      if (footTimer > (sprint && !game.tired ? 0.29 : 0.45)) { sound(95 + Math.random() * 18, 0.08, 0.018, 'triangle'); footTimer = 0; }
    }
    world.camera.fov += ((sprint && moved > 0.03 && !game.tired ? 73 : 68) - world.camera.fov) * Math.min(dt * 5, 1);
    world.camera.position.set(game.player.x, 1.6 + (reduced || moved < 0.002 ? 0 : Math.sin(walkPhase) * 0.025), game.player.z);
    world.camera.rotation.set(pitch, yaw, 0, 'YXZ');
    hud();
    if (game.state === 'caught') finish('caught');
  }
  // Stop idle animations while paused; the opening screen remains a live 3D preview.
  const sceneTime = screen === 'welcome' ? now / 1000 : game.elapsed;
  world.render(sceneTime, game, screen === 'welcome', reduced);
  requestAnimationFrame(frame);
}

try {
  world = await createWorld($('world'));
  $('start-label').textContent = 'Начать догонялки'; $('start').disabled = false;
  updateMap(); requestAnimationFrame(frame);
  if (import.meta.env.DEV) {
    // Read-only diagnostics for local QA; omitted from production builds.
    window.__PEREMENA__ = () => ({ state: screen, yaw, pitch, touch: { ...touch.input }, player: { ...game.player }, enemy: { ...game.enemy }, wanderer: { ...game.wanderer, view: world.wanderer.userData.view }, pixelRatio: world.renderer.getPixelRatio(), count: game.collected.size, pose: world.runner.userData.pose, openedDoors: [...game.openedDoors], stamina: game.stamina, elapsed: game.elapsed, mode: game.mode, frame: world.renderer.info.render.frame, calls: world.renderer.info.render.calls, triangles: world.renderer.info.render.triangles, pointerLocked: !!document.pointerLockElement });
  }
} catch (error) {
  console.error('School initialization failed:', error);
  $('start-label').textContent = 'Школа пока не загрузилась'; $('load-error').hidden = false;
  $('load-error').textContent = 'Не удалось запустить 3D-сцену. Обнови страницу и проверь, включено ли аппаратное ускорение в браузере.';
}
$('world').addEventListener('webglcontextlost', event => { event.preventDefault(); pause(); $('modal-description').textContent = 'Браузер приостановил 3D-графику. Обнови страницу, чтобы снова открыть школу.'; $('resume').disabled = true; $('restart').disabled = true; });
