// grades.js — the six colour grades of Neon Coast Cover Studio.
//
// A grade is a recipe the renderer applies to every photo panel:
//   filter — a canvas 2d filter string used when the photo is drawn
//   washes — colour overlays drawn over the photo (mode = composite op)
//   ramp   — an optional luminance -> colour ramp, applied per pixel
//            (stops are [luminance 0..1, [r, g, b]]).
// The sky, the title block and the badge are graded separately by the
// renderer, so a grade is a whole-cover look, not just a photo filter.

export const GRADES = [
  {
    id: 'sunset',
    name: 'Vice Sunset',
    blurb: 'Golden-hour orange over a pink sky, warm skin, deep violet shadows.',
    filter: 'saturate(1.28) contrast(1.07) brightness(1.03)',
    washes: [
      { color: '#ff7a2f', alpha: 0.10, mode: 'overlay' },
      { color: '#ff2e88', alpha: 0.08, mode: 'soft-light' },
      { color: '#2b0a4d', alpha: 0.10, mode: 'multiply' },
    ],
    ramp: null,
    sky: { top: '#2b0a4d', mid: '#ff2e88', low: '#ffb347', sun: '#fff3c4' },
  },
  {
    id: 'neon',
    name: 'Neon Night',
    blurb: 'Wet-street night: cyan and magenta neon, crushed blacks, hot highlights.',
    filter: 'saturate(1.45) contrast(1.14) brightness(0.97)',
    washes: [
      { color: '#00e5ff', alpha: 0.12, mode: 'overlay' },
      { color: '#ff2e88', alpha: 0.12, mode: 'overlay' },
      { color: '#05001a', alpha: 0.14, mode: 'multiply' },
    ],
    ramp: null,
    sky: { top: '#05001a', mid: '#3b0a6e', low: '#ff2e88', sun: '#00e5ff' },
  },
  {
    id: 'gold',
    name: 'Gold Hour',
    blurb: 'Honeyed late light: amber wash, soft contrast, glowing edges.',
    filter: 'saturate(1.18) contrast(1.02) brightness(1.06) sepia(0.18)',
    washes: [
      { color: '#ffb347', alpha: 0.14, mode: 'soft-light' },
      { color: '#7a3b00', alpha: 0.08, mode: 'multiply' },
    ],
    ramp: null,
    sky: { top: '#3d1c00', mid: '#ff8c1a', low: '#ffd97a', sun: '#fff8d6' },
  },
  {
    id: 'teal',
    name: 'Teal Heat',
    blurb: 'Teal shadows against orange skin: the blockbuster two-tone grade.',
    filter: 'saturate(1.22) contrast(1.10) brightness(1.00)',
    washes: [
      { color: '#00b3a6', alpha: 0.10, mode: 'overlay' },
    ],
    ramp: [
      [0.00, [0, 26, 38]],
      [0.25, [8, 74, 84]],
      [0.50, [122, 122, 110]],
      [0.75, [238, 176, 118]],
      [1.00, [255, 232, 190]],
    ],
    sky: { top: '#01262e', mid: '#0a7a72', low: '#ff9a3d', sun: '#ffe9b0' },
  },
  {
    id: 'mono',
    name: 'Mono Ink',
    blurb: 'High-contrast black and white, inked like a poster print.',
    filter: 'grayscale(1) contrast(1.22) brightness(1.02)',
    washes: [
      { color: '#000000', alpha: 0.06, mode: 'multiply' },
    ],
    ramp: [
      [0.00, [8, 8, 12]],
      [0.35, [52, 52, 60]],
      [0.65, [150, 150, 158]],
      [1.00, [250, 250, 246]],
    ],
    sky: { top: '#0a0a12', mid: '#3a3a44', low: '#b9b9c2', sun: '#ffffff' },
  },
  {
    id: 'true',
    name: 'True Colour',
    blurb: 'The photo as it is: a light clean-up, no colour cast.',
    filter: 'saturate(1.05) contrast(1.03) brightness(1.01)',
    washes: [],
    ramp: null,
    sky: { top: '#1c4d6b', mid: '#7fb3d5', low: '#f2e3c6', sun: '#ffffff' },
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

export function gradeNames() {
  return GRADES.map((g) => ({ id: g.id, name: g.name, blurb: g.blurb }));
}
