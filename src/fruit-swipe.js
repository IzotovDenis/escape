// Screen-space thresholds stay comfortable regardless of canvas resolution.
export function swipeLane(dx, dy, initialLane) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return null;
  const side = Math.abs(dx) >= 12 ? (dx < 0 ? 0 : 2) : (initialLane < 2 ? 0 : 2);
  return side + (dy <= -6 ? 0 : 1);
}

export function bindFruitSwipes(surface, { enabled, currentLane, tapLane, chooseLane }) {
  let gesture = null;
  function reset() {
    const previous = gesture;
    gesture = null;
    if (previous && surface.hasPointerCapture(previous.id)) surface.releasePointerCapture(previous.id);
  }
  surface.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || event.button !== 0 || gesture || !enabled()) return;
    event.preventDefault();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
      lane: currentLane(), tap: tapLane(event), moved: false };
    surface.setPointerCapture(event.pointerId);
  });
  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!enabled()) { reset(); return; }
    event.preventDefault();
    const lane = swipeLane(event.clientX - gesture.x, event.clientY - gesture.y, gesture.lane);
    if (lane === null) return;
    gesture.moved = true;
    // Keep evaluating while held, so a slight upward finish refines a side swipe.
    chooseLane(lane);
  }
  surface.addEventListener('pointermove', move);
  surface.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    move(event);
    if (gesture && !gesture.moved && enabled()) chooseLane(gesture.tap);
    reset();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    surface.addEventListener(type, event => { if (gesture?.id === event.pointerId) reset(); });
  }
  return reset;
}
