// Separate pointer ownership allows simultaneous movement, look and actions.
export function createTouchControls({ isPlaying, turn, use }) {
  const root = document.getElementById('touch-controls');
  const stick = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  const sprintButton = document.getElementById('touch-sprint');
  const action = document.getElementById('touch-use');
  const canvas = document.getElementById('world');
  const input = { forward: 0, right: 0, sprint: false };
  let movePointer = null, lookPointer = null, lookX = 0, lookY = 0;
  let enabled = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  function enable() {
    enabled = true; document.body.classList.add('touch-device');
    document.querySelector('.keyboard-note').textContent = 'Левый палец — идти · правый — обзор';
    document.querySelector('.modal-controls').textContent = 'Джойстик слева — идти · проведи справа — обзор. «Бег» включает ускорение, кнопка рядом открывает двери и собирает тетради.';
    root.hidden = !isPlaying();
  }
  if (enabled) enable();
  addEventListener('pointerdown', event => { if (event.pointerType === 'touch' && !enabled) enable(); }, { capture: true });
  function reset() {
    input.forward = input.right = 0; input.sprint = false;
    movePointer = lookPointer = null;
    knob.style.transform = ''; stick.classList.remove('active');
    sprintButton.setAttribute('aria-pressed', 'false');
  }
  function move(event) {
    const rect = stick.getBoundingClientRect(), radius = rect.width * 0.32;
    const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy), scale = Math.min(1, radius / (length || 1));
    const strength = Math.max(0, (Math.min(length / radius, 1) - 0.12) / 0.88);
    input.right = dx / (length || 1) * strength; input.forward = -dy / (length || 1) * strength;
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }
  stick.addEventListener('pointerdown', event => {
    if (!isPlaying() || movePointer !== null) return;
    event.preventDefault(); movePointer = event.pointerId;
    stick.setPointerCapture(event.pointerId); stick.classList.add('active'); move(event);
  });
  stick.addEventListener('pointermove', event => { if (event.pointerId === movePointer) move(event); });
  function endMove(event) {
    if (event.pointerId !== movePointer) return;
    movePointer = null; input.forward = input.right = 0;
    knob.style.transform = ''; stick.classList.remove('active');
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(event, endMove);
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !isPlaying() || lookPointer !== null) return;
    event.preventDefault(); lookPointer = event.pointerId; lookX = event.clientX; lookY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== lookPointer || !isPlaying()) return;
    turn((event.clientX - lookX) * 0.0045, (event.clientY - lookY) * 0.0035);
    lookX = event.clientX; lookY = event.clientY;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => { if (e.pointerId === lookPointer) lookPointer = null; });
  sprintButton.addEventListener('click', () => {
    if (!isPlaying()) return;
    input.sprint = !input.sprint; sprintButton.setAttribute('aria-pressed', String(input.sprint));
  });
  action.addEventListener('click', () => { if (isPlaying()) use(); });
  root.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('contextmenu', event => { if (enabled) event.preventDefault(); });
  addEventListener('blur', reset); addEventListener('resize', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  return {
    input, get enabled() { return enabled; }, reset,
    setActive(active) { reset(); root.hidden = !enabled || !active; },
    setAction(label, available) { action.textContent = label; action.disabled = !available; },
  };
}
