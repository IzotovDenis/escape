// Every direction and variation is separately illustrated. Sprite transforms
// always have a positive scale: clothing details never change sides.
const BASIS = 1254;
function cell(rect, feet, basket, face, cutouts = []) {
  const point = ([x, y]) => [(x - rect[0]) / rect[2], (y - rect[1]) / rect[3]];
  return { rect: rect.map(value => value / BASIS), feet: point(feet), basket: point(basket),
    face: point(face), cutouts: cutouts.map(box => box.map(value => value / BASIS)) };
}

// Lane order is upper-left, lower-left, upper-right, lower-right.
export const BOY_ATLASES = [
  { normal: 'seven-boy-directions.png', spicy: 'seven-boy-directions-spicy.png', standingHeight: 620 / BASIS,
    cells: [
      cell([0, 0, 627, 630], [335.7, 618.5], [159, 142], [338, 151]),
      cell([0, 630, 627, 624], [352.3, 1232], [205, 900], [338, 778]),
      cell([627, 0, 627, 630], [938.9, 619.5], [1099, 144], [914, 151]),
      cell([627, 630, 627, 624], [949.7, 1233], [1079, 905], [932, 778]),
    ] },
  { normal: 'seven-boy-variants.png', spicy: 'seven-boy-variants-spicy.png', standingHeight: 615 / BASIS,
    cells: [
      cell([75, 15, 515, 635], [353, 644], [194, 163], [370, 174], [[350, 638, 80, 12]]),
      cell([75, 637, 520, 598], [366, 1219], [194, 930], [370, 792], [[75, 637, 275, 13], [430, 637, 165, 13]]),
      cell([710, 15, 480, 635], [931, 644], [1066, 168], [842, 174], [[860, 638, 80, 12]]),
      cell([710, 637, 500, 598], [931, 1219], [1090, 937], [915, 792], [[710, 637, 150, 13], [940, 637, 270, 13]]),
    ] },
];

export function makeBoyFrames(image, cells, trimCell, standingHeight = .49) {
  return cells.map(({ rect, feet, basket, face, cutouts = [] }) => {
    const cell = { x: rect[0] * image.width, y: rect[1] * image.height,
      width: rect[2] * image.width, height: rect[3] * image.height };
    const point = ([x, y]) => ({ x: cell.x + x * cell.width, y: cell.y + y * cell.height });
    return { image, crop: trimCell(image, cell), feet: point(feet), basket: point(basket), face: point(face),
      scale: 405 / (image.height * standingHeight),
      cutouts: cutouts.map(([x, y, w, h]) => ({ x: x * image.width, y: y * image.height,
        width: w * image.width, height: h * image.height })) };
  });
}

/** Keep the body at one scale and the feet on the floor across different poses. */
export function boyPlacement(frame, target, floor, heroFactor = 1) {
  const scale = frame.scale * heroFactor;
  const x = target.x - frame.basket.x * scale;
  const y = floor - frame.feet.y * scale;
  return { scale, x, y,
    feet: { x: x + frame.feet.x * scale, y: floor },
    basket: { x: target.x, y: y + frame.basket.y * scale },
    face: { x: x + frame.face.x * scale, y: y + frame.face.y * scale } };
}

export function paintBoyFrame(ctx, frame, placement, breath = 0) {
  const { crop } = frame;
  const { x, y, scale } = placement;
  ctx.save();
  if (frame.cutouts.length) {
    // The alternate atlas has a five-pixel overlap between rows. Clip only
    // neighbouring hair/shoe tips when drawing, preserving the original PNG.
    ctx.beginPath();
    ctx.rect(x + crop.x * scale, y + crop.y * scale + breath, crop.width * scale, crop.height * scale);
    for (const cutout of frame.cutouts) ctx.rect(x + cutout.x * scale,
      y + cutout.y * scale + breath, cutout.width * scale, cutout.height * scale);
    ctx.clip('evenodd');
  }
  // A very small vertical breath keeps the feet and basket effectively planted.
  ctx.drawImage(frame.image, crop.x, crop.y, crop.width, crop.height,
    x + crop.x * scale, y + crop.y * scale + breath,
    crop.width * scale, crop.height * scale);
  ctx.restore();
}

/** Change art on an actual movement/catch, never on every animation frame. */
export function createPoseCycle() {
  let lane = null;
  const visits = [0, 0, 0, 0];
  const variants = [0, 0, 0, 0];
  return {
    reset() { lane = null; visits.fill(0); variants.fill(0); },
    select(nextLane, caught = false, reducedMotion = false) {
      if (lane !== nextLane) {
        if (visits[nextLane] > 0) variants[nextLane] ^= 1;
        visits[nextLane] += 1;
        lane = nextLane;
      } else if (caught) variants[nextLane] ^= 1;
      return reducedMotion ? 0 : variants[nextLane];
    },
  };
}
