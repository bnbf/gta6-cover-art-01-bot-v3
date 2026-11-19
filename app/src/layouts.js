// layouts.js — the eight cover layouts of Neon Coast Cover Studio.
//
// A layout is a set of photo slots plus where the title block and the
// badge sit. Every coordinate is a fraction of the cover (0..1), so a
// layout works at any export size. A slot may carry:
//   rot  — rotation in degrees about its centre (tilted snapshots)
//   poly — a polygon (array of [x, y] fractions) the photo is clipped to
//   frame — 'ink' | 'snap' | 'band' (default 'ink')
// The title sits in a band at the top or the bottom of the cover;
// 'bleed' overlays it on the photo, the others paint the band on sky.

const GUT = 0.012; // gutter between panels, in cover fractions

function grid(cols, rows, x0, y0, w, h, frame) {
  const slots = [];
  const cw = (w - GUT * (cols - 1)) / cols;
  const ch = (h - GUT * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        x: x0 + c * (cw + GUT),
        y: y0 + r * (ch + GUT),
        w: cw,
        h: ch,
        frame: frame || 'ink',
      });
    }
  }
  return slots;
}

export const LAYOUTS = [
  {
    id: 'nine',
    name: 'Nine-Panel Grid',
    blurb: 'The classic poster grid: nine panels, one story in every box.',
    title: 'bottom',
    slots: grid(3, 3, 0.015, 0.015, 0.97, 0.79),
  },
  {
    id: 'hero3',
    name: 'Hero + Three',
    blurb: 'One big moment on top, three supporting shots below it.',
    title: 'bottom',
    slots: [
      { x: 0.015, y: 0.015, w: 0.97, h: 0.52, frame: 'ink' },
      ...grid(3, 1, 0.015, 0.545, 0.97, 0.245, 'snap'),
    ],
  },
  {
    id: 'bleed',
    name: 'Full Bleed',
    blurb: 'One photo, edge to edge, title printed straight over it.',
    title: 'bottom',
    slots: [{ x: 0, y: 0, w: 1, h: 1, frame: 'none' }],
  },
  {
    id: 'tilted',
    name: 'Tilted Snapshots',
    blurb: 'Four photos tossed on the table, corners turned, tape optional.',
    title: 'top',
    slots: [
      { x: 0.03, y: 0.16, w: 0.44, h: 0.52, rot: -4, frame: 'snap' },
      { x: 0.53, y: 0.14, w: 0.44, h: 0.52, rot: 3, frame: 'snap' },
      { x: 0.06, y: 0.60, w: 0.42, h: 0.34, rot: -2, frame: 'snap' },
      { x: 0.54, y: 0.62, w: 0.42, h: 0.32, rot: 5, frame: 'snap' },
    ],
  },
  {
    id: 'diagonal',
    name: 'Diagonal Bands',
    blurb: 'Three photos sliced on the diagonal, sun-streaked.',
    title: 'top',
    slots: [
      {
        x: 0, y: 0.14, w: 1, h: 0.30, frame: 'ink',
        poly: [[0, 0.14], [1, 0.14], [1, 0.34], [0, 0.44]],
      },
      {
        x: 0, y: 0.36, w: 1, h: 0.30, frame: 'ink',
        poly: [[0, 0.46], [1, 0.36], [1, 0.56], [0, 0.66]],
      },
      {
        x: 0, y: 0.58, w: 1, h: 0.30, frame: 'ink',
        poly: [[0, 0.68], [1, 0.58], [1, 0.78], [0, 0.88]],
      },
    ],
  },
  {
    id: 'duo',
    name: 'Split Duo',
    blurb: 'Two faces, one cover: a straight down-the-middle split.',
    title: 'bottom',
    slots: [
      { x: 0.015, y: 0.015, w: 0.4775, h: 0.79, frame: 'ink' },
      { x: 0.5075, y: 0.015, w: 0.4775, h: 0.79, frame: 'ink' },
    ],
  },
  {
    id: 'stage',
    name: 'Centre Stage',
    blurb: 'One hero panel centre stage, two small acts flanking it below.',
    title: 'top',
    slots: [
      { x: 0.15, y: 0.17, w: 0.70, h: 0.55, frame: 'band' },
      { x: 0.03, y: 0.76, w: 0.44, h: 0.20, frame: 'snap' },
      { x: 0.53, y: 0.76, w: 0.44, h: 0.20, frame: 'snap' },
    ],
  },
  {
    id: 'carhero',
    name: 'Car Hero',
    blurb: 'One big hero panel with the car and the face, one tall side panel.',
    title: 'bottom',
    slots: [
      { x: 0.015, y: 0.015, w: 0.50, h: 0.78, frame: 'ink' },
      { x: 0.53, y: 0.015, w: 0.455, h: 0.78, frame: 'ink' },
    ],
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[LAYOUTS.length - 1];
}

export function layoutNames() {
  return LAYOUTS.map((l) => ({ id: l.id, name: l.name, blurb: l.blurb }));
}

/** Slots of a layout in pixels for a cover of W x H. */
export function slotsFor(layout, W, H) {
  return layout.slots.map((s) => ({
    x: s.x * W,
    y: s.y * H,
    w: s.w * W,
    h: s.h * H,
    rot: s.rot || 0,
    poly: s.poly ? s.poly.map(([px, py]) => [px * W, py * H]) : null,
    frame: s.frame || 'ink',
  }));
}

/** The title band rect (pixels) for a layout on a W x H cover. */
export function titleBandFor(layout, W, H) {
  if (layout.title === 'top') return { x: 0, y: 0, w: W, h: H * 0.14 };
  return { x: 0, y: H * 0.80, w: W, h: H * 0.20 };
}
