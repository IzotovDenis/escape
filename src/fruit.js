import './fruit.css';
import { createGame, startGame, selectLane, updateGame, pauseGame, resumeGame } from './fruit-logic.js';
import { createFruitScene } from './fruit-scene.js';
import { bindFruitSwipes } from './fruit-swipe.js';

const $ = id => document.getElementById(id);
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const laneButtons = [...document.querySelectorAll('[data-lane]')];
const storage = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, String(value)); } catch {} },
};
let mode = storage.get('seven-mode', 'classic') === 'relaxed' ? 'relaxed' : 'classic';
let game = createGame({ mode });
let scene, lastTime = 0, toastTime = 0, muted = storage.get('seven-muted', 'false') === 'true';
let audio;
const sessionBests = { classic: 0, relaxed: 0 };
const bestFor = () => Math.max(sessionBests[mode], Number(storage.get(`seven-best-${mode}`, '0')) || 0);
let best = bestFor();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function tone(frequency, duration = .11, delay = 0, volume = .025) {
  if (muted) return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    const at = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .75, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(at); oscillator.stop(at + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* The game remains playable when audio is unavailable. */ }
}
function syncSound() {
  $('sound').setAttribute('aria-pressed', String(!muted));
  $('sound').setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
}
$('sound').onclick = () => { muted = !muted; storage.set('seven-muted', muted); syncSound(); if (!muted) tone(650); };
syncSound();

function syncMode() {
  for (const button of modeButtons) {
    const chosen = button.dataset.mode === mode;
    button.classList.toggle('chosen', chosen);
    button.setAttribute('aria-pressed', String(chosen));
  }
  best = bestFor();
  $('menu-best').textContent = best;
  $('game-best').textContent = `Рекорд: ${best}`;
}
for (const button of modeButtons) button.onclick = () => {
  mode = button.dataset.mode;
  storage.set('seven-mode', mode);
  game = createGame({ mode });
  syncMode();
};
syncMode();

let lastHud = '';
function syncHud() {
  const boosted = game.boostRemaining > 0;
  const tempo = ((game.speedMultiplier || 1) * (game.boostMultiplier || 1)).toFixed(2);
  const hud = `${game.score}/${game.lives}/${game.level}/${game.combo}/${game.lane}/${tempo}/${boosted}`;
  if (hud === lastHud) return;
  lastHud = hud;
  $('score').textContent = game.score;
  $('level').textContent = game.level;
  $('lives').setAttribute('aria-label', `Жизней: ${game.lives} из 3`);
  [...$('lives').children].forEach((heart, i) => heart.classList.toggle('lost', i >= game.lives));
  $('combo').textContent = boosted ? `Автоловля · темп ×${tempo}` : `${game.combo >= 3 ? `${game.combo} подряд · ` : ''}Темп ×${tempo}`;
  $('game').dataset.boosted = String(boosted);
  for (const button of laneButtons) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.lane) === game.lane));
    button.setAttribute('aria-disabled', String(boosted));
  }
}
function toast(message, duration = 2.6) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  toastTime = duration;
}
function closeResult() { if ($('result').open) $('result').close(); }
function start() {
  if (!scene) return;
  resetSwipes();
  closeResult();
  game = createGame({ mode }); startGame(game);
  lastTime = performance.now();
  $('menu').hidden = true;
  $('game').hidden = false;
  scene.resize();
  syncHud();
  tone(600); tone(850, .15, .1);
  toast('Лови пончики и тостики. Перец пропускай!');
  $('pause').focus({ preventScroll: true });
}
function pause() {
  resetSwipes();
  if (game.phase !== 'playing') return;
  pauseGame(game);
  $('result-label').textContent = 'МОЖНО ВЫДОХНУТЬ';
  $('result-title').textContent = 'Перерыв на перекус';
  $('result-copy').textContent = 'Пончики подождут. Возвращайся, когда будешь готов.';
  $('result-stats').hidden = true;
  $('result-basket').hidden = true;
  document.querySelector('.result-symbol').textContent = 'Ⅱ';
  $('resume').hidden = false;
  $('retry').textContent = 'Начать заново';
  $('result').showModal();
  $('resume').focus();
}
function resume() {
  if (game.phase !== 'paused') return;
  closeResult(); resumeGame(game); lastTime = performance.now();
  $('pause').focus({ preventScroll: true });
}
function finish() {
  resetSwipes();
  const isRecord = game.score > best;
  if (isRecord) { best = game.score; sessionBests[mode] = best; storage.set(`seven-best-${mode}`, best); }
  syncMode();
  $('result-label').textContent = isRecord ? 'ЭТО НОВЫЙ РЕКОРД!' : 'МОЖНО НА КАССУ';
  $('result-title').textContent = game.score === 0 ? 'Попробуем ещё?' : game.score >= 40 ? 'Вот это закупился!' : 'Вкусный результат!';
  $('result-copy').textContent = game.score === 0 ? 'Подставь корзинку под еду до того, как она упадёт. Чили можно пропустить.' : 'Пакет нужен? Или пойдём за новым рекордом?';
  $('final-score').textContent = game.score;
  $('final-combo').textContent = game.bestCombo;
  $('final-best').textContent = best;
  $('result-stats').hidden = false;
  $('result-basket').hidden = false;
  $('result-basket').textContent = `Пончиков: ${game.donuts} · тостиков: ${game.sandwiches} · перчиков: ${game.peppersCaught}${game.boostsCaught ? ` · турбо: ${game.boostsCaught}` : ''}`;
  document.querySelector('.result-symbol').textContent = isRecord ? '★' : '✓';
  $('resume').hidden = true;
  $('retry').textContent = 'Ещё за перекусом';
  $('result').showModal();
  $('retry').focus();
}
function home() {
  resetSwipes();
  closeResult();
  game = createGame({ mode });
  $('game').hidden = true;
  $('menu').hidden = false;
  $('toast').classList.remove('show');
  syncMode();
  $('start').focus({ preventScroll: true });
}
$('start').onclick = start;
$('retry').onclick = start;
$('pause').onclick = pause;
$('resume').onclick = resume;
$('home').onclick = home;
$('result').addEventListener('cancel', event => { event.preventDefault(); if (game.phase === 'paused') resume(); else home(); });

function chooseLane(lane) {
  if (game.phase !== 'playing' || game.boostRemaining > 0) return;
  const previous = game.lane;
  selectLane(game, lane);
  if (game.lane !== previous) tone(240 + lane * 30, .045, 0, .006);
  syncHud();
}
for (const button of laneButtons) {
  button.onpointerdown = event => { if (event.pointerType !== 'mouse' || event.button !== 0) return; event.preventDefault(); chooseLane(Number(button.dataset.lane)); };
  button.onclick = event => { if (event.detail === 0) chooseLane(Number(button.dataset.lane)); };
}
$('fruit-scene').addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0 || game.phase !== 'playing') return;
  event.preventDefault();
  chooseLane(scene.inputLane(event.clientX, event.clientY));
});
const resetSwipes = bindFruitSwipes(document.querySelector('.stage-shell'), {
  enabled: () => game.phase === 'playing' && game.boostRemaining <= 0,
  currentLane: () => game.lane,
  tapLane: event => {
    const button = event.target.closest('[data-lane]');
    return button ? Number(button.dataset.lane) : scene.inputLane(event.clientX, event.clientY);
  },
  chooseLane,
});
window.addEventListener('resize', resetSwipes);
window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && !$('result').open && game.phase === 'playing') { event.preventDefault(); pause(); return; }
  const focusedControl = event.target instanceof Element && event.target.closest('button, a, input, select, textarea');
  if ((event.code === 'KeyP' || (event.code === 'Space' && !focusedControl)) && !event.repeat && game.phase === 'playing') { event.preventDefault(); pause(); return; }
  if (game.phase !== 'playing' || event.altKey || event.ctrlKey || event.metaKey) return;
  const controls = { KeyQ: 0, KeyA: 1, KeyE: 2, KeyD: 3, Numpad7: 0, Numpad1: 1, Numpad9: 2, Numpad3: 3 };
  let lane = controls[event.code];
  if (event.code === 'ArrowLeft') lane = game.lane % 2;
  if (event.code === 'ArrowRight') lane = 2 + game.lane % 2;
  if (event.code === 'ArrowUp') lane = game.lane < 2 ? 0 : 2;
  if (event.code === 'ArrowDown') lane = game.lane < 2 ? 1 : 3;
  if (lane !== undefined) { event.preventDefault(); chooseLane(lane); }
});
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
new ResizeObserver(() => scene?.resize()).observe($('fruit-scene'));
window.addEventListener('resize', () => scene?.resize());

function frame(now) {
  const dt = Math.min(Math.max(0, (now - lastTime) / 1000), .05);
  lastTime = now;
  const events = updateGame(game, dt);
  for (const event of events) {
    if (event.type === 'catch') tone(680 + game.combo % 6 * 90, .13);
    if (event.type === 'miss') { tone(155, .22, 0, .035); if (!reducedMotion) navigator.vibrate?.(35); }
    if (event.type === 'level' && !(game.boostRemaining > 0)) { toast(`Уровень ${game.level} · всё быстрее!`); tone(1000, .15, .1); }
    if (event.type === 'spicy') { toast('Ай, остро! Осторожнее с перцем.', 2); tone(280, .11); tone(420, .1, .1); tone(180, .23, .22); if (!reducedMotion) navigator.vibrate?.([30, 40, 30]); }
    if (event.type === 'cooled' && !(game.boostRemaining > 0)) toast('Фух, отпустило!', 1.5);
    if (event.type === 'boost') {
      resetSwipes();
      toast('ТУРБО! 15 секунд — ловлю сам!', 2);
      tone(650, .12); tone(850, .12, .09); tone(1150, .2, .18);
    }
    if (event.type === 'boost-end') { toast('Турбо закончилось — теперь лови сам!', 3); tone(800, .12); tone(500, .18, .12); }
  }
  if (game.phase === 'playing') {
    toastTime -= dt;
    if (toastTime <= 0) $('toast').classList.remove('show');
  }
  if (!$('game').hidden) {
    scene?.render(game, dt, events);
    syncHud();
    const spicy = game.spicyRemaining > 0;
    $('spice-indicator').hidden = !spicy;
    if (spicy) $('spice-meter').style.transform = `scaleX(${game.spicyRemaining / 4})`;
    const boosted = game.boostRemaining > 0;
    $('boost-indicator').hidden = !boosted;
    if (boosted) {
      const seconds = `${Math.ceil(game.boostRemaining)} с`;
      if ($('boost-countdown').textContent !== seconds) $('boost-countdown').textContent = seconds;
      const hint = game.boostRemaining <= 3 ? 'Скоро снова лови сам' : 'Автоловля · скорость ×4';
      if ($('boost-hint').textContent !== hint) $('boost-hint').textContent = hint;
      $('boost-meter').style.transform = `scaleX(${game.boostRemaining / 15})`;
    }
  }
  if (events.some(event => event.type === 'over')) finish();
  requestAnimationFrame(frame);
}

createFruitScene($('fruit-scene')).then(value => {
  scene = value;
  scene.drawMenuHero($('menu-hero'));
  $('start').disabled = false;
  $('start').innerHTML = '<span>За перекусом!</span><span aria-hidden="true">→</span>';
  requestAnimationFrame(frame);
}).catch(error => {
  console.error('Unable to load Seven game art', error);
  $('start').querySelector('span').textContent = 'Обновить страницу';
  $('start').disabled = false;
  $('start').onclick = () => location.reload();
  $('load-status').textContent = 'Картинки не загрузились. Проверь соединение и попробуй ещё раз.';
});

if (import.meta.env.DEV) window.__SEVEN__ = () => ({ ...game, random: undefined, fruits: game.fruits.map(fruit => ({ ...fruit })), mode, best, ready: Boolean(scene) });
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => registration.update()).catch(() => {});
