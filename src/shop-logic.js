export const CATEGORIES = {
  chips: { name: 'Чипсы', icon: '🥔', color: '#edb62f', price: 20 },
  donut: { name: 'Пончики', icon: '🍩', color: '#e694ae', price: 25 },
  sandwich: { name: 'Сэндвичи', icon: '🥪', color: '#92b765', price: 35 },
  cola: { name: 'Кола', icon: '🥤', color: '#d54436', price: 20 },
};
export const FIXTURES = [
  { x: .25, z: .25, w: 9.5, d: .8 },
  { x: .25, z: 2.7, w: .85, d: 4.4 },
  { x: .25, z: 8.3, w: .85, d: 2 },
  { x: 2.5, z: 3, w: 1.1, d: 4.8 },
  { x: 6.2, z: 3, w: 1.1, d: 4.8 },
  { x: 8.95, z: 2.7, w: .8, d: 4.4 },
  { x: 7.2, z: 10, w: 2.55, d: .65 },
  // Service area behind the counter is not accessible to the player.
  { x: 7.2, z: 10.65, w: 2.8, d: 1.35 },
  { x: .25, z: 11.2, w: 2.3, d: .55 },
];
export function canStand(x, z, radius = .22) {
  if (x < radius || x > 10 - radius || z < radius || z > 12 - radius) return false;
  return !FIXTURES.some(f => x + radius > f.x && x - radius < f.x + f.w && z + radius > f.z && z - radius < f.z + f.d);
}
export function movePlayer(player, dx, dz) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .08));
  for (let i = 0; i < steps; i++) {
    if (canStand(player.x + dx / steps, player.z)) player.x += dx / steps;
    if (canStand(player.x, player.z + dz / steps)) player.z += dz / steps;
  }
}
export function newMission(previous, random = Math.random) {
  const ids = Object.keys(CATEGORIES);
  const count = 2 + Math.floor(random() * 3);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const needs = Object.fromEntries(ids.slice(0, count).map(id => [id, 1 + Math.floor(random() * 3)]));
  const signature = value => Object.keys(value).sort().map(k => `${k}:${value[k]}`).join(',');
  if (previous && signature(needs) === signature(previous)) { const k = Object.keys(needs)[0]; needs[k] = needs[k] % 3 + 1; }
  return { needs, collected: Object.fromEntries(Object.keys(needs).map(k => [k, 0])), title: ['Перекус на пляж', 'В гости к друзьям', 'Вечер кино', 'После прогулки'][Math.floor(random() * 4)] };
}
export const isComplete = mission => Object.keys(mission.needs).every(k => mission.collected[k] >= mission.needs[k]);
export function collect(mission, id) {
  if (!mission.needs[id]) return 'unneeded';
  if (mission.collected[id] >= mission.needs[id]) return 'enough';
  mission.collected[id]++; return 'collected';
}
export const totalItems = mission => Object.values(mission.needs).reduce((a, b) => a + b, 0);
export const collectedItems = mission => Object.values(mission.collected).reduce((a, b) => a + b, 0);
export const totalPrice = mission => Object.entries(mission.needs).reduce((sum, [id, n]) => sum + CATEGORIES[id].price * n, 0);
