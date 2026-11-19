// state.js — the cover state, its presets, undo/redo, and crop math.
//
// A cover's state is plain JSON (photos carry an `img` at run time, which
// is never serialised). Undo/redo keeps up to 60 snapshots.
// Crop math: a panel shows a cover-fit window of its photo. When a panel
// crops vertically, the window's default framing anchors on the face
// band — 20% down the photo — instead of the vertical middle, so heads
// survive wide panels. An explicit pan (ox/oy) moves away from the
// anchor; "Fit" returns to it.

export const FACE_ANCHOR = 0.20; // fraction of photo height where faces sit

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'story', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 × 1080', w: 1920, h: 1080 },
];

export const PRESETS = [
  {
    id: 'shore',
    name: 'Neon Shore',
    layout: 'carhero',
    grade: 'sunset',
    title: 'NEON SHORE',
    subtitle: 'VICE CITY • 2026',
    titleColor: '#ffffff',
  },
  {
    id: 'night',
    name: 'Night Shift',
    layout: 'tilted',
    grade: 'neon',
    title: 'NIGHT SHIFT',
    subtitle: 'AFTER DARK • LEONIDA',
    titleColor: '#ffe9f5',
  },
  {
    id: 'pier',
    name: 'Pier Pressure',
    layout: 'duo',
    grade: 'gold',
    title: 'PIER PRESSURE',
    subtitle: 'GOLDEN HOUR • LEONIDA',
    titleColor: '#fff3c4',
  },
];

export function defaultState() {
  return {
    seed: 7,
    layout: 'carhero',
    grade: 'sunset',
    title: 'NEON SHORE',
    subtitle: 'VICE CITY • 2026',
    titleColor: '#ffffff',
    badge: true,
    grain: true,
    vignette: true,
    photos: [], // { id, name, src } — img attached at run time
    slots: [], // per layout slot: { photo, zoom, ox, oy } (oy null = face anchor)
  };
}

/** Seeded RNG (mulberry32): the same seed draws the same grain every time. */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The source rect of a photo to draw cover-fit into a slot.
 * photoW/photoH: the photo; slotW/slotH: the panel; zoom >= 1;
 * ox/oy: explicit pan in [-1, 1] (oy null = face-band anchor).
 * Returns { sx, sy, sw, sh } in photo pixels.
 */
export function coverCrop(photoW, photoH, slotW, slotH, zoom, ox, oy) {
  const z = Math.max(1, zoom || 1);
  const scale = Math.max(slotW / photoW, slotH / photoH) * z;
  const sw = Math.min(photoW, slotW / scale);
  const sh = Math.min(photoH, slotH / scale);
  const slackX = photoW - sw;
  const slackY = photoH - sh;
  let sx = slackX / 2;
  let sy = slackY / 2;
  if (ox !== null && ox !== undefined) sx = (slackX / 2) * (1 + clamp(ox, -1, 1));
  if (oy === null || oy === undefined) {
    // Face-band anchor: the face band (20% down the photo) sits near the
    // top of the window, not in its middle, so a heavily cropped panel
    // still shows what is below the face — the car door, the mirror, the
    // windshield — instead of clamping to the very top of the photo.
    sy = clamp(FACE_ANCHOR * photoH - sh * 0.15, 0, Math.max(0, slackY));
  } else {
    sy = (slackY / 2) * (1 + clamp(oy, -1, 1));
  }
  return { sx, sy, sw, sh };
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** A fresh slot assignment for a layout: photos cycle across the slots. */
export function slotsForCount(n, photoCount) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ photo: photoCount ? i % photoCount : 0, zoom: 1, ox: 0, oy: null });
  }
  return out;
}

/** Serialise a state for undo history (photos without their live images). */
export function snapshot(state) {
  return JSON.parse(JSON.stringify({ ...state, photos: state.photos.map(({ id, name, src }) => ({ id, name, src })) }));
}

export function restore(snapshotData, livePhotos) {
  const s = JSON.parse(JSON.stringify(snapshotData));
  const byId = new Map(livePhotos.map((p) => [p.id, p]));
  s.photos = s.photos.map((p) => byId.get(p.id) || p);
  return s;
}

const HISTORY_CAP = 60;

export class History {
  constructor(initial) {
    this.stack = [snapshot(initial)];
    this.index = 0;
  }
  push(state) {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(snapshot(state));
    if (this.stack.length > HISTORY_CAP) this.stack.shift();
    this.index = this.stack.length - 1;
  }
  undo(livePhotos) {
    if (!this.canUndo()) return null;
    this.index -= 1;
    return restore(this.stack[this.index], livePhotos);
  }
  redo(livePhotos) {
    if (!this.canRedo()) return null;
    this.index += 1;
    return restore(this.stack[this.index], livePhotos);
  }
  canUndo() {
    return this.index > 0;
  }
  canRedo() {
    return this.index < this.stack.length - 1;
  }
}
