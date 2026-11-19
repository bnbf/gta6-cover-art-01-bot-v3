// shots.js — the `?shot=` scenes for screenshots and the finalist review.
//
//   ?shot=cover  — the cover alone, canvas 1:1 at the window size
//                  (Car Hero, Vice Sunset, "NEON SHORE")
//   ?shot=editor — the full editor with a photo loaded
//   ?shot=story  — the cover alone at story size (Tilted, Neon Night)
//   ?shot=tilt   — the cover alone, square (Tilted, Neon Night)
//
// A scene sets window.__shotReady once the fonts are in and the frame
// is drawn, so a headless driver can wait for it instead of guessing.

import { drawCover } from './cover.js';
import { layoutById } from './layouts.js';
import { slotsForCount } from './state.js';

const SCENES = {
  cover: { mode: 'cover', layout: 'carhero', grade: 'sunset', title: 'NEON SHORE', subtitle: 'VICE CITY • 2026', titleColor: '#ffffff' },
  story: { mode: 'cover', layout: 'tilted', grade: 'neon', title: 'NEON SHORE', subtitle: 'VICE CITY • 2026', titleColor: '#ffe9f5' },
  tilt: { mode: 'cover', layout: 'tilted', grade: 'neon', title: 'NEON SHORE', subtitle: 'VICE CITY • 2026', titleColor: '#ffe9f5' },
  editor: { mode: 'editor' },
};

function waitForEditor() {
  return new Promise((resolve) => {
    const tick = () => {
      if (window.__coverStudio && window.__editorReady) resolve();
      else setTimeout(tick, 50);
    };
    tick();
  });
}

async function run() {
  const params = new URLSearchParams(location.search);
  const name = params.get('shot');
  const scene = SCENES[name];
  if (!scene) return; // plain editor, no scene
  await waitForEditor();
  const studio = window.__coverStudio;
  const { state, photos } = studio;
  if (scene.mode === 'editor') {
    // The editor already shows the default cover; just signal readiness.
    window.__shotReady = true;
    return;
  }
  // Cover mode: hide the editor chrome, draw the cover 1:1 at the window.
  // Headless Chrome's viewport starts 87px short of the window and then
  // expands to the full window size, which would stretch a canvas drawn
  // too early — so re-read the size right before drawing, and redraw on
  // any later resize.
  Object.assign(state, {
    layout: scene.layout, grade: scene.grade, title: scene.title,
    subtitle: scene.subtitle, titleColor: scene.titleColor,
  });
  state.slots = slotsForCount(layoutById(state.layout).slots.length, photos.length);
  document.body.classList.add('cover-mode');
  const stage = document.getElementById('stage');
  const drawAtWindow = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    stage.width = W;
    stage.height = H;
    drawCover(stage, state, photos, W, H);
  };
  try {
    await Promise.all([
      document.fonts.load('900 100px "Noto Sans Condensed"'),
      document.fonts.load('600 40px "Noto Sans Condensed"'),
      document.fonts.load('800 30px "Noto Sans Condensed"'),
    ]);
  } catch { /* system sans fallback */ }
  await document.fonts.ready;
  // Let the viewport settle, then draw at its final size.
  await new Promise((r) => setTimeout(r, 300));
  drawAtWindow();
  window.addEventListener('resize', drawAtWindow);
  window.__shotReady = true;
}

run();
