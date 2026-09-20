import { BOY_ATLASES, makeBoyFrames, boyPlacement, paintBoyFrame, createPoseCycle } from './seven-boy.js';

const WIDTH = 1000;
const HEIGHT = 700;
const TAU = Math.PI * 2;
const ROLL_END = 0.70;

const HERO_HEIGHT = 405;
const HERO_FLOOR = 666;
// Default basket positions; wide screens anchor them to the shelf tips below.
export const LANE_TARGETS = Object.freeze([
  { x: 330, y: 353 }, { x: 327, y: 455 },
  { x: 670, y: 353 }, { x: 673, y: 455 },
].map(Object.freeze));

// One transparent shelf is shared by all lanes. Its measured top-surface
// centre line drives both the affine sprite placement and the snack trajectory.
const SHELF_SIZE = { width: 1629, height: 965 };
const SHELF_PATH = { start: { x: 136, y: 95 }, end: { x: 1390, y: 770 } };

function createShelfRail(surfaceStart, surfaceEnd, foodFactor) {
  const sx = SHELF_PATH.end.x - SHELF_PATH.start.x;
  const sy = SHELF_PATH.end.y - SHELF_PATH.start.y;
  const tx = surfaceEnd.x - surfaceStart.x;
  const ty = surfaceEnd.y - surfaceStart.y;
  const mirror = tx < 0 ? -1 : 1;
  const angle = Math.atan2(ty, Math.abs(tx)) - Math.atan2(sy, sx);
  const size = Math.hypot(tx, ty) / Math.hypot(sx, sy);
  const a = mirror * Math.cos(angle) * size;
  const b = Math.sin(angle) * size;
  const c = -mirror * Math.sin(angle) * size;
  const d = Math.cos(angle) * size;
  const e = surfaceStart.x - a * SHELF_PATH.start.x - c * SHELF_PATH.start.y;
  const f = surfaceStart.y - b * SHELF_PATH.start.x - d * SHELF_PATH.start.y;
  const centre = (point) => ({ x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f - 19 * foodFactor });
  return { matrix: [a, b, c, d, e, f], start: centre(SHELF_PATH.start), end: centre(SHELF_PATH.end) };
}

function createRails(targets, foodFactor = 1, portrait = false, bounds = { left: 0, right: WIDTH }) {
  // Anchor compact shelves to the actual screen edges. Their size no longer
  // grows to bridge the entire distance from the screen edge to the boy.
  const span = Math.min((bounds.right - bounds.left) * 0.25, portrait ? 250 : 300);
  return targets.map((target, lane) => {
    const left = lane < 2;
    const end = { x: left ? bounds.left + span : bounds.right - span,
      y: target.y - (portrait ? 105 * foodFactor : 110) };
    const startX = left ? bounds.left - 25 : bounds.right + 25;
    const rise = Math.abs(end.x - startX) * (portrait ? 0.9 : 0.5383);
    return createShelfRail({ x: startX, y: end.y - rise }, end, foodFactor);
  });
}

function drawShelf(ctx, image, rail) {
  ctx.save();
  ctx.transform(...rail.matrix);
  ctx.drawImage(image, 0, 0, SHELF_SIZE.width, SHELF_SIZE.height);
  ctx.restore();
}

const RAILS = createRails(LANE_TARGETS);

const DESKTOP_LAYOUT = {
  height: HEIGHT, heroFloor: HERO_FLOOR, heroFactor: 1, foodFactor: 1, fxFactor: 1,
  targets: LANE_TARGETS, rails: RAILS,
};

function createPortraitLayout(height) {
  const heroFactor = 560 / HERO_HEIGHT;
  const heroFloor = height - 34;
  const foodFactor = 1.3;
  const targets = LANE_TARGETS.map((target) => ({
    x: 500 + (target.x - 500) * heroFactor,
    y: heroFloor + (target.y - HERO_FLOOR) * heroFactor,
  }));
  return { height, heroFloor, heroFactor, foodFactor, fxFactor: 1.25, targets,
    rails: createRails(targets, foodFactor, true) };
}

/** Desktop coordinates remain the default; the renderer supplies its mobile layout. */
export function fruitPoint(lane, progress, layout = DESKTOP_LAYOUT) {
  const rail = layout.rails[lane] || layout.rails[0];
  const target = layout.targets[lane] || layout.targets[0];
  const p = Math.max(0, Math.min(1, progress));
  if (p <= ROLL_END) {
    const roll = p / ROLL_END;
    return { x: rail.start.x + (rail.end.x - rail.start.x) * roll,
      y: rail.start.y + (rail.end.y - rail.start.y) * roll };
  }
  const drop = (p - ROLL_END) / (1 - ROLL_END);
  return { x: rail.end.x + (target.x - rail.end.x) * drop,
    y: rail.end.y + (target.y - rail.end.y) * drop * drop };
}

function loadImage(src, optional = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => optional ? resolve(null) : reject(new Error(`Не удалось загрузить изображение: ${src}`));
    image.src = src;
  });
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2, width, color) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Trim transparent padding within a known atlas cell, retaining source pixels. */
function trimCell(image, cell) {
  const probe = document.createElement('canvas');
  probe.width = Math.ceil(cell.width);
  probe.height = Math.ceil(cell.height);
  const pc = probe.getContext('2d', { willReadFrequently: true });
  pc.drawImage(image, cell.x, cell.y, cell.width, cell.height, 0, 0, probe.width, probe.height);
  const { data } = pc.getImageData(0, 0, probe.width, probe.height);
  let left = probe.width;
  let top = probe.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < probe.height; y += 1) {
    for (let x = 0; x < probe.width; x += 1) {
      if (data[(y * probe.width + x) * 4 + 3] > 24) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  if (left > right) return { image, ...cell };
  const pad = 3;
  left = Math.max(0, left - pad); top = Math.max(0, top - pad);
  right = Math.min(probe.width - 1, right + pad); bottom = Math.min(probe.height - 1, bottom + pad);
  return { image, x: cell.x + left, y: cell.y + top, width: right - left + 1, height: bottom - top + 1 };
}

function makeFoodSprites(atlas) {
  if (!atlas) return null;
  // The sandwich extends two pixels across the nominal atlas midpoint. Explicit
  // icon bounds keep that edge out of the neighbouring pepper's transparent crop.
  const boxes = {
    'donut-pink': [68, 99, 511, 453],
    'donut-chocolate': [692, 98, 514, 443],
    sandwich: [66, 678, 566, 478],
    chili: [684, 662, 536, 478],
  };
  const sx = atlas.width / 1254;
  const sy = atlas.height / 1254;
  return Object.fromEntries(Object.entries(boxes).map(([kind, [x, y, width, height]]) =>
    [kind, trimCell(atlas, { x: x * sx, y: y * sy, width: width * sx, height: height * sy })]));
}

function proceduralSnack(ctx, kind) {
  if (kind === 'chili') {
    const pepper = ctx.createLinearGradient(-18, -13, 22, 17);
    pepper.addColorStop(0, '#ff9470'); pepper.addColorStop(0.28, '#ee3026'); pepper.addColorStop(1, '#a8111e');
    ctx.beginPath();
    ctx.moveTo(-18, -13);
    ctx.bezierCurveTo(-1, -19, -5, 14, 26, 12);
    ctx.bezierCurveTo(8, 28, -17, 12, -21, -6);
    ctx.closePath();
    ctx.fillStyle = pepper; ctx.fill();
    line(ctx, -17, -12, -19, -22, 5, '#478031');
    line(ctx, -19, -22, -25, -25, 3, '#74a84b');
    ctx.beginPath(); ctx.moveTo(-13, -6); ctx.quadraticCurveTo(-7, 7, 6, 13);
    ctx.strokeStyle = '#ffc7a080'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
    return;
  }
  if (kind === 'sandwich') {
    const triangle = (dy, fill) => {
      ctx.beginPath(); ctx.moveTo(-30, 15 + dy); ctx.lineTo(-5, -24 + dy); ctx.lineTo(32, 13 + dy);
      ctx.quadraticCurveTo(4, 23 + dy, -30, 15 + dy); ctx.fillStyle = fill; ctx.fill();
    };
    triangle(6, '#b47129'); triangle(2, '#ffc85b'); triangle(-1, '#f29983'); triangle(-4, '#f7c775');
    const toast = ctx.createLinearGradient(-10, -30, 15, 20);
    toast.addColorStop(0, '#fff1be'); toast.addColorStop(0.65, '#e8ad55'); toast.addColorStop(1, '#ca8034');
    triangle(-8, toast);
    ctx.beginPath(); ctx.moveTo(-26, 7); ctx.lineTo(-5, -27); ctx.lineTo(27, 5);
    ctx.strokeStyle = '#b17530'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    for (let i = 0; i < 4; i += 1) line(ctx, -16 + i * 6, 2, -6 + i * 5, -15 + i * 4, 2.8, '#ad6c3390');
    return;
  }
  const chocolate = kind === 'donut-chocolate';
  const dough = ctx.createRadialGradient(-8, -10, 1, 0, 0, 29);
  dough.addColorStop(0, '#ffdb80'); dough.addColorStop(0.65, '#e9a340'); dough.addColorStop(1, '#b46824');
  ellipse(ctx, 0, 3, 28, 23, dough);
  const icing = ctx.createLinearGradient(-15, -20, 19, 20);
  icing.addColorStop(0, chocolate ? '#bb784d' : '#ffc5e8');
  icing.addColorStop(0.45, chocolate ? '#864729' : '#ed85c1');
  icing.addColorStop(1, chocolate ? '#542c1f' : '#d85d9d');
  ellipse(ctx, 0, -2, 26, 20, icing);
  ellipse(ctx, 0, -3, 9, 7.5, '#804321');
  ellipse(ctx, 0, -1, 6.5, 5, '#d99239');
  const colors = ['#fff4c1', '#80d5d1', '#ffd14e', '#f48299'];
  for (let i = 0; i < 16; i += 1) {
    const a = i * 2.39996;
    const r = 12 + i % 3 * 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.76 - 2;
    line(ctx, x, y, x + Math.cos(a + 1) * 4, y + Math.sin(a + 1) * 3, 2, colors[i % colors.length]);
  }
}

function drawEnergy(ctx, sprite, x, y, height, alpha) {
  if (!sprite) return;
  const factor = height / 66;
  // Keep the bottle upright and place its base on the same surface as the food.
  const centreY = y - 14 * factor;
  const width = sprite.width / sprite.height * height;
  ctx.save();
  ctx.globalAlpha = alpha;
  const halo = ctx.createRadialGradient(x, centreY, 3, x, centreY, height * 0.67);
  halo.addColorStop(0, '#fff3bd77');
  halo.addColorStop(0.48, '#ffc95735');
  halo.addColorStop(1, '#ffc95700');
  ellipse(ctx, x, centreY, height * 0.52, height * 0.67, halo);
  ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height,
    x - width / 2, centreY - height / 2, width, height);
  ctx.translate(x + width * 0.48 + 5 * factor, centreY - height * 0.24);
  ctx.scale(factor * 0.8, factor * 0.8);
  ctx.beginPath();
  ctx.moveTo(2, -11); ctx.lineTo(-7, 2); ctx.lineTo(0, 2);
  ctx.lineTo(-3, 12); ctx.lineTo(9, -3); ctx.lineTo(2, -3);
  ctx.lineTo(5, -11); ctx.closePath();
  ctx.lineJoin = 'round'; ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff9dc'; ctx.stroke();
  ctx.fillStyle = '#f6bc2f'; ctx.fill();
  ctx.restore();
}

function drawSnack(ctx, sprites, kind, x, y, size = 60, rotation = 0, alpha = 1, caution = true) {
  if (kind === 'energy') {
    drawEnergy(ctx, sprites?.energy, x, y, size, alpha);
    return;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const sprite = sprites?.[kind];
  if (sprite) {
    const ratio = size / Math.max(sprite.width, sprite.height);
    const w = sprite.width * ratio;
    const h = sprite.height * ratio;
    ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height, -w / 2, -h / 2, w, h);
  } else {
    ctx.scale(size / 60, size / 60);
    proceduralSnack(ctx, kind);
  }
  ctx.restore();
  if (kind === 'chili' && caution) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.roundRect(x + size * 0.25, y - size * 0.51, 15, 19, 6);
    ctx.fillStyle = '#fff7df'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#d33726'; ctx.stroke();
    ctx.font = '900 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#cf2c20'; ctx.fillText('!', x + size * 0.25 + 7.5, y - size * 0.51 + 14);
    ctx.restore();
  }
}

export async function createFruitScene(canvas) {
  const base = import.meta.env.BASE_URL || '/';
  const [store, shelf, food, energy, illustrations] = await Promise.all([
    loadImage(`${base}assets/seven-store-clean.png`),
    loadImage(`${base}assets/seven-shelf.png`),
    loadImage(`${base}assets/seven-food.png`, true),
    loadImage(`${base}assets/seven-energy.png`),
    Promise.all(BOY_ATLASES.map(async definition => {
      const [normal, spicy] = await Promise.all([loadImage(`${base}assets/${definition.normal}`),
        loadImage(`${base}assets/${definition.spicy}`)]);
      return { normal: makeBoyFrames(normal, definition.cells, trimCell, definition.standingHeight),
        spicy: makeBoyFrames(spicy, definition.cells, trimCell, definition.standingHeight) };
    })),
  ]);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Браузер не поддерживает графику Canvas.');
  const backdrop = document.createElement('canvas');
  const bg = backdrop.getContext('2d', { alpha: false });
  const poseCycle = createPoseCycle();
  const sprites = { ...makeFoodSprites(food), energy: trimCell(energy,
    { x: 0, y: 0, width: energy.width, height: energy.height }) };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let layout = DESKTOP_LAYOUT;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let time = 0;
  let pulse = 0;
  let previousGame = null;
  let previousElapsed = 0;
  let previousPhase = '';
  let particles = [];
  let notices = [];
  let dropped = [];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round((rect.width || WIDTH) * dpr));
    const pixelHeight = Math.max(1, Math.round((rect.height || (rect.width || WIDTH) * HEIGHT / WIDTH) * dpr));
    if (canvas.width === pixelWidth && canvas.height === pixelHeight && backdrop.width === pixelWidth) return;
    canvas.width = backdrop.width = pixelWidth;
    canvas.height = backdrop.height = pixelHeight;
    const portrait = pixelHeight > pixelWidth * 0.9;
    layout = portrait ? createPortraitLayout(WIDTH * pixelHeight / pixelWidth) : DESKTOP_LAYOUT;
    scale = Math.min(pixelWidth / WIDTH, pixelHeight / layout.height);
    offsetX = (pixelWidth - WIDTH * scale) / 2;
    offsetY = (pixelHeight - layout.height * scale) / 2;
    // Foreground sprites keep a uniform scale. On wide screens the playable
    // shelves continue beyond the real canvas edges, not the old 1000px stage.
    const bounds = { left: -offsetX / scale, right: (pixelWidth - offsetX) / scale };
    const rails = createRails(layout.targets, layout.foodFactor, portrait, bounds);
    // Step towards the active shelf. The same basket target positions the boy
    // and ends the falling food's path, including on very wide screens.
    const targets = layout.targets.map((target, lane) => ({ ...target,
      x: rails[lane].end.x + (lane < 2 ? 1 : -1) * ((portrait ? 55 : 80) - lane % 2 * 3),
    }));
    layout = { ...layout, targets, rails };
    // Transient positions belong to their old layout; clear them on rotation.
    particles = []; notices = []; dropped = []; pulse = 0;
    bg.setTransform(1, 0, 0, 1, 0, 0);
    // A single full-canvas store image prevents a second shop appearing at the
    // sides. Its fill is independent of the undistorted foreground coordinates.
    // Apply the contrast once to the cached shop, keeping food and boy intact.
    bg.save();
    bg.filter = 'contrast(1.12) saturate(1.04)';
    bg.drawImage(store, 0, 0, pixelWidth, pixelHeight);
    bg.restore();
    bg.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    for (const rail of layout.rails) drawShelf(bg, shelf, rail);
  }

  function resetEffects() {
    particles = []; notices = []; dropped = []; pulse = 0; time = 0;
    poseCycle.reset();
  }

  function processEvents(events, targets = layout.targets) {
    for (const event of events) {
      const target = targets[event.lane] || targets[1];
      const f = layout.fxFactor;
      if (event.type === 'catch') {
        pulse = 1;
        notices.push({ x: target.x, y: target.y - 40 * f, age: 0, life: 0.8, text: `+${event.points || 1}` });
        if (event.combo >= 5 && event.combo % 5 === 0) {
          notices.push({ x: 500, y: 226 * layout.height / HEIGHT, age: 0, life: 1, text: `Серия ×${event.combo}`, combo: true });
        }
        if (!reducedMotion.matches) {
          for (let i = 0; i < 12; i += 1) {
            const a = i * TAU / 12;
            particles.push({ x: target.x, y: target.y - 8 * f, vx: Math.cos(a) * (40 + i % 3 * 19) * f, vy: (Math.sin(a) * 46 - 44) * f,
              age: 0, life: 0.5 + i % 3 * 0.07, size: (2.7 + i % 3) * f, color: i % 3 ? '#ffe890' : '#ffffff', star: i % 3 === 0 });
          }
        }
      } else if (event.type === 'miss' || event.type === 'dodge' || event.type === 'energy-miss') {
        dropped.push({ x: target.x, y: target.y, kind: event.kind, lane: event.lane, age: 0, life: 0.78, dodge: event.type !== 'miss' });
        if (event.type === 'miss') notices.push({ x: target.x, y: target.y - 35 * f, age: 0, life: 0.7, text: '−1', miss: true });
      } else if (event.type === 'boost') {
        notices.push({ x: target.x, y: target.y - 52 * f, age: 0, life: 1, text: '×4', boost: true });
        if (!reducedMotion.matches) {
          for (let i = 0; i < 14; i += 1) {
            const angle = i * TAU / 14;
            particles.push({ x: target.x, y: target.y - 10 * f,
              vx: Math.cos(angle) * (44 + i % 3 * 12) * f,
              vy: (Math.sin(angle) * 43 - 32) * f,
              age: 0, life: 0.65 + i % 3 * 0.07, size: (3 + i % 2) * f,
              color: i % 3 ? '#ffd976' : '#fff6c9', star: i % 2 === 0 });
          }
        }
      } else if (event.type === 'spicy') {
        pulse = 1;
        if (!reducedMotion.matches) {
          for (let i = 0; i < 8; i += 1) {
            const a = i * TAU / 8;
            particles.push({ x: target.x, y: target.y - 5 * f, vx: Math.cos(a) * 52 * f, vy: (Math.sin(a) * 48 - 25) * f,
              age: 0, life: 0.6, size: (3 + i % 2) * f, color: i % 2 ? '#ff9b45' : '#fff0bc', star: true });
          }
        }
      }
    }
  }

  function updateEffects(dt) {
    pulse = Math.max(0, pulse - dt * 3.8);
    particles = particles.filter((p) => {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 135 * layout.fxFactor;
      return p.age < p.life;
    });
    notices = notices.filter((notice) => { notice.age += dt; return notice.age < notice.life; });
    dropped = dropped.filter((item) => { item.age += dt; return item.age < item.life; });
  }

  function drawSpice(facePosition, reduced) {
    ctx.save();
    ctx.translate(facePosition.x, facePosition.y);
    ctx.scale(layout.fxFactor, layout.fxFactor);
    const face = { x: 0, y: 0 };
    if (!reduced) {
      for (let i = 0; i < 5; i += 1) {
        const t = (time * 0.8 + i * 0.2) % 1;
        const side = i % 2 ? 1 : -1;
        const x = face.x + side * (30 + t * 12) + Math.sin(t * 5 + i) * 4;
        const y = face.y - 28 - t * 38;
        ctx.save(); ctx.globalAlpha = Math.sin(t * Math.PI) * 0.68;
        ellipse(ctx, x, y, 5 + t * 8, 7 + t * 7, '#fffef3');
        ellipse(ctx, x + side * 6, y - 7, 4 + t * 6, 6 + t * 7, '#fffef3');
        ctx.restore();
      }
      for (const side of [-1, 1]) {
        const t = (time * 0.85 + (side > 0 ? 0.5 : 0)) % 1;
        ctx.save(); ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8;
        ctx.translate(face.x + side * 42, face.y - 3 + t * 27);
        ctx.rotate(side * -0.35);
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.bezierCurveTo(7, 0, 6, 7, 0, 7); ctx.bezierCurveTo(-6, 7, -7, 0, 0, -7);
        ctx.fillStyle = '#a9effd'; ctx.fill(); line(ctx, -1, 0, -1, 3, 1.2, '#ffffff');
        ctx.restore();
      }
    }
    const x = face.x + 65;
    const y = face.y - 79;
    ctx.save();
    ctx.shadowColor = '#71451e35'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.roundRect(x - 49, y - 20, 98, 39, 15);
    ctx.fillStyle = '#fff3c9'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.lineWidth = 2; ctx.strokeStyle = '#f07b2c'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 17, y + 17); ctx.lineTo(x - 25, y + 29); ctx.lineTo(x - 1, y + 18);
    ctx.fillStyle = '#fff3c9'; ctx.fill();
    ctx.font = '900 22px "Nunito", "Arial Rounded MT Bold", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#d74a23'; ctx.fillText('ОСТРО!', x, y + 8);
    ctx.restore();
    ctx.restore();
  }

  function drawBoostAura(location) {
    const radius = 89 * layout.heroFactor;
    const centreY = location.basket.y + 12 * layout.heroFactor;
    const glow = ctx.createRadialGradient(location.basket.x, centreY, 2,
      location.basket.x, centreY, radius);
    glow.addColorStop(0, '#ffe59754');
    glow.addColorStop(0.55, '#ffd16b24');
    glow.addColorStop(1, '#ffc33d00');
    ellipse(ctx, location.basket.x, centreY, radius, radius * 0.72, glow);
    ellipse(ctx, location.feet.x, layout.heroFloor, 96 * layout.heroFactor,
      12 * layout.heroFactor, '#ffcc4838');
  }

  function drawBoostTrail(item, point, activeLayout) {
    if (item.progress < 0.01) return;
    const before = fruitPoint(item.lane, Math.max(0, item.progress - 0.075), activeLayout);
    const middle = fruitPoint(item.lane, Math.max(0, item.progress - 0.0375), activeLayout);
    if (Math.hypot(point.x - before.x, point.y - before.y) < 1) return;
    const lift = item.kind === 'energy' ? 14 * layout.foodFactor : 0;
    ctx.save();
    const streak = ctx.createLinearGradient(before.x, before.y - lift, point.x, point.y - lift);
    streak.addColorStop(0, '#ffd46f00');
    streak.addColorStop(1, '#fff0ab70');
    ctx.beginPath(); ctx.moveTo(before.x, before.y - lift);
    ctx.quadraticCurveTo(middle.x, middle.y - lift, point.x, point.y - lift);
    ctx.lineCap = 'round'; ctx.lineWidth = 4.5 * layout.foodFactor;
    ctx.strokeStyle = streak; ctx.stroke();
    ctx.restore();
  }

  function render(game, dt = 0, events = []) {
    const elapsed = Number.isFinite(game.elapsed) ? game.elapsed : 0;
    if (game !== previousGame || elapsed < previousElapsed || (elapsed === 0 && game.phase === 'playing' && previousPhase !== 'playing' && previousPhase !== 'paused')) resetEffects();
    previousGame = game; previousElapsed = elapsed; previousPhase = game.phase;
    const active = game.phase === 'playing' || game.phase === 'ready';
    const step = active ? Math.min(Math.max(dt, 0), 0.05) : 0;
    if (!reducedMotion.matches) time += step;
    updateEffects(step);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(backdrop, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const lane = Number.isInteger(game.lane) && game.lane >= 0 && game.lane < 4 ? game.lane : 1;
    const spicy = game.spicyRemaining > 0;
    const boosted = game.boostRemaining > 0;
    const variant = poseCycle.select(lane, events.some(event => event.type === 'catch'), reducedMotion.matches);
    const actor = illustrations[variant][spicy ? 'spicy' : 'normal'][lane];
    const location = boyPlacement(actor, layout.targets[lane], layout.heroFloor, layout.heroFactor);
    // A crouch changes the height of the basket, not the boy's body scale. Food
    // finishes its fall at this pose's actual opening while shelves stay still.
    const targets = layout.targets.map((target, index) => index === lane ? location.basket : target);
    const catchLayout = { ...layout, targets };
    processEvents(events, targets);
    const shadow = ctx.createRadialGradient(location.feet.x, layout.heroFloor, 2,
      location.feet.x, layout.heroFloor, 103 * layout.heroFactor);
    shadow.addColorStop(0, '#30443e5a'); shadow.addColorStop(1, '#30443e00');
    ellipse(ctx, location.feet.x, layout.heroFloor + 1, 108 * layout.heroFactor, 17 * layout.heroFactor, shadow);
    if (boosted) drawBoostAura(location);
    ctx.save();
    if (boosted) {
      ctx.shadowColor = '#ffc95299';
      ctx.shadowBlur = 12 * scale * layout.heroFactor;
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    }
    paintBoyFrame(ctx, actor, location, reducedMotion.matches ? 0 : Math.sin(time * 2.5) * .25);
    ctx.restore();

    const items = game.phase === 'ready' && !(game.fruits || []).length ? [
      { lane: 0, kind: 'donut-pink', progress: 0.34 },
      { lane: 0, kind: 'sandwich', progress: 0.76 },
      { lane: 1, kind: 'donut-chocolate', progress: 0.26 },
      { lane: 2, kind: 'chili', progress: 0.37 },
      { lane: 2, kind: 'donut-chocolate', progress: 0.72 },
      { lane: 3, kind: 'sandwich', progress: 0.5 },
    ] : game.fruits || [];
    for (const item of items) {
      const point = fruitPoint(item.lane, item.progress, catchLayout);
      const onBelt = item.progress <= ROLL_END;
      if (onBelt) ellipse(ctx, point.x + 2, point.y + 19 * layout.foodFactor,
        15 * layout.foodFactor, 3 * layout.foodFactor, '#233f3135');
      if (boosted && !reducedMotion.matches) drawBoostTrail(item, point, catchLayout);
      const sign = item.lane < 2 ? 1 : -1;
      const rotation = item.kind.startsWith('donut') ? sign * item.progress * 4.5 : sign * (0.12 + Math.sin(item.progress * 5) * 0.1);
      const snackSize = item.kind === 'energy' ? 66 : item.kind === 'sandwich' ? 68 : 60;
      drawSnack(ctx, sprites, item.kind, point.x, point.y, snackSize * layout.foodFactor, rotation);
    }

    for (const item of dropped) {
      const t = Math.min(1, item.age / 0.54);
      const floor = Math.min(layout.heroFloor, item.y + 132 * layout.fxFactor);
      const f = layout.fxFactor;
      const side = item.lane < 2 ? -1 : 1;
      if (t < 1) {
        drawSnack(ctx, sprites, item.kind, item.x + side * t * 24 * f, item.y + (floor - item.y) * t * t,
          (item.kind === 'energy' ? 66 : 57) * layout.foodFactor, item.age * side * 5, 1, false);
      } else if (!item.dodge) {
        const fade = (item.age - 0.54) / 0.24;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - fade);
        ellipse(ctx, item.x + side * 24 * f, floor + 15 * f, (21 + fade * 12) * f, 4 * f, '#ae89583b');
        for (let i = 0; i < 7; i += 1) {
          const a = i * TAU / 7;
          ellipse(ctx, item.x + (side * 24 + Math.cos(a) * (12 + fade * 30)) * f, floor + (9 + Math.sin(a) * (5 + fade * 12)) * f,
            (2.2 + i % 2) * f, 1.8 * f, i % 2 ? '#f0c483' : '#bf813d');
        }
        ctx.restore();
      }
    }
    if (spicy) drawSpice(location.face, reducedMotion.matches);
    for (const particle of particles) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - particle.age / particle.life);
      if (particle.star) {
        ctx.translate(particle.x, particle.y); ctx.rotate(particle.age * 2); ctx.fillStyle = particle.color; ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = i * Math.PI / 4; const r = i % 2 ? particle.size * 0.35 : particle.size * 1.25;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
      } else ellipse(ctx, particle.x, particle.y, particle.size, particle.size, particle.color);
      ctx.restore();
    }
    for (const notice of notices) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (notice.life - notice.age) * 4);
      ctx.font = `900 ${(notice.combo ? 28 : 32) * layout.fxFactor}px "Nunito", "Arial Rounded MT Bold", sans-serif`;
      ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 5 * layout.fxFactor;
      const y = notice.y - (reducedMotion.matches ? 0 : notice.age * 28 * layout.fxFactor);
      ctx.strokeStyle = '#fffae9'; ctx.strokeText(notice.text, notice.x, y);
      ctx.fillStyle = notice.miss ? '#cf3c29' : notice.boost ? '#c58a16' : notice.combo ? '#ed8322' : '#078546';
      ctx.fillText(notice.text, notice.x, y); ctx.restore();
    }
  }

  function inputLane(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return 1;
    const x = ((clientX - rect.left) * canvas.width / rect.width - offsetX) / scale;
    const y = ((clientY - rect.top) * canvas.height / rect.height - offsetY) / scale;
    const split = (layout.targets[0].y + layout.targets[1].y) / 2;
    return (x < WIDTH / 2 ? 0 : 2) + (y < split ? 0 : 1);
  }

  function drawMenuHero(menuCanvas) {
    const menu = menuCanvas.getContext('2d');
    if (!menu) return;
    const width = menuCanvas.width || 500;
    const height = menuCanvas.height || 540;
    const actor = illustrations[0].normal[1];
    const crop = actor.crop;
    const fit = Math.min((width - 22) / crop.width, (height - 18) / crop.height);
    const w = crop.width * fit;
    const h = crop.height * fit;
    menu.clearRect(0, 0, width, height);
    menu.imageSmoothingEnabled = true;
    menu.imageSmoothingQuality = 'high';
    menu.drawImage(actor.image, crop.x, crop.y, crop.width, crop.height, (width - w) / 2, height - h - 5, w, h);
  }

  resize();
  return { render, resize, drawMenuHero, inputLane, ready: true };
}
