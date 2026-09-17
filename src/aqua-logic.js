export function newRun() { return { lane: 1, x: 0, distance: 0, coins: 0, jump: 0, slide: 0, shield: true, invincible: 0, speed: 16 }; }
export function action(run, name) {
  if (name === 'left') run.lane = Math.max(0, run.lane - 1);
  if (name === 'right') run.lane = Math.min(2, run.lane + 1);
  if (name === 'jump' && !run.jump) { run.jump = .9; run.slide = 0; }
  if (name === 'slide') { run.jump = 0; run.slide = .85; }
}
export function height(run) { return run.jump > 0 ? Math.sin((1 - run.jump / .9) * Math.PI) * 2.5 : 0; }
export function tick(run, dt) {
  run.speed = Math.min(34, 16 + run.distance / 110);
  run.distance += run.speed * dt;
  run.x += ((run.lane - 1) * 3 - run.x) * (1 - Math.exp(-dt * 35));
  run.jump = Math.max(0, run.jump - dt); run.slide = Math.max(0, run.slide - dt); run.invincible = Math.max(0, run.invincible - dt);
}
export function hits(run, item) {
  if (Math.abs(run.x - (item.lane - 1) * 3) > 1) return false;
  if (item.kind === 'ring' || item.kind === 'flamingo') return height(run) < 1.0;
  if (item.kind === 'arch') return run.slide <= 0 || height(run) > .1;
  return true;
}
// Every row leaves one entire lane free, with enough time to change lanes.
export function row(random = Math.random) {
  const safe = Math.floor(random() * 3);
  const kinds = ['ring', 'arch', 'flamingo'];
  return { safe, obstacles: [0, 1, 2].filter(lane => lane !== safe).map(lane => ({ lane, kind: kinds[Math.floor(random() * kinds.length)] })) };
}

// A fixed world-space route. Ahead samples move toward the player as distance grows.
export function trackOffset(distance, ahead) {
  const center = s => 10 * Math.sin(s / 65);
  return center(distance + ahead) - center(distance) - ahead * (10 / 65) * Math.cos(distance / 65);
}
export const trackShader = `
uniform float trackBend;
float routeOffset(float ahead) {
  return 10.*(sin((trackBend+ahead)/65.)-sin(trackBend/65.))
    -ahead*(10./65.)*cos(trackBend/65.);
}
`;

// Consume a gesture as soon as the finger crosses the threshold, once per touch.
export function swipeAction(gesture, x, y) {
  if (!gesture || gesture.fired) return null;
  const dx=x-gesture.x,dy=y-gesture.y;
  if (Math.max(Math.abs(dx),Math.abs(dy)) < 14) return null;
  gesture.fired=true;
  return Math.abs(dx)>Math.abs(dy) ? dx>0?'right':'left' : dy<0?'jump':'slide';
}
