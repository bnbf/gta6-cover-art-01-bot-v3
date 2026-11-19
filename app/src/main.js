// main.js — the Neon Coast editor: wires the controls to the renderer.
//
// The editor is a thin shell over cover.js: every control edits the
// state, every state change re-renders the preview canvas, and every
// committed change pushes an undo snapshot. Photos live on the user's
// machine (uploads) or in app/samples/; nothing is ever uploaded.

import { drawCover, renderCover } from './cover.js';
import { GRADES } from './grades.js';
import { LAYOUTS, layoutById, slotsFor } from './layouts.js';
import {
  defaultState, slotsForCount, History, snapshot, PRESETS, EXPORT_SIZES, clamp,
} from './state.js';

const WALLET = 'AoP4eSdGC9V2jioJANjN2jPsxL5DnHkWmNicRznF3x67';
const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard — red convertible', src: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Pier — rooftop man', src: 'samples/pier.jpg' },
];

const state = defaultState();
const history = new History(state);
let photos = []; // { id, name, src, img }
let selectedSlot = 0;
let previewSize = EXPORT_SIZES[0];
let drag = null; // { slot, startX, startY, ox, oy }

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const stageCtx = stage.getContext('2d');

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function boot() {
  // Load the two sample photos, then the title fonts, then render.
  for (const s of SAMPLES) {
    try {
      const img = await loadImage(s.src);
      photos.push({ ...s, img });
    } catch {
      // A missing sample just leaves one fewer photo to work with.
    }
  }
  state.photos = photos.map(({ id, name, src }) => ({ id, name, src }));
  state.slots = slotsForCount(layoutById(state.layout).slots.length, photos.length);
  try {
    await Promise.all([
      document.fonts.load('900 100px "Noto Sans Condensed"'),
      document.fonts.load('600 40px "Noto Sans Condensed"'),
      document.fonts.load('800 30px "Noto Sans Condensed"'),
    ]);
  } catch { /* fall back to system sans */ }
  buildControls();
  render();
  bindStage();
  window.__editorReady = true;
}

function buildControls() {
  // Photos: thumbnails + upload.
  const photoList = $('photo-list');
  photoList.innerHTML = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'thumb';
    b.title = p.name;
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    b.appendChild(img);
    b.addEventListener('click', () => assignPhoto(i));
    photoList.appendChild(b);
  });
  $('upload').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      if (photos.length >= 4) break;
      if (!file.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        const p = { id: `up${Date.now()}_${photos.length}`, name: file.name, src: url, img };
        photos.push(p);
        state.photos.push({ id: p.id, name: p.name, src: p.src });
      } catch { URL.revokeObjectURL(url); }
    }
    state.slots = slotsForCount(layoutById(state.layout).slots.length, photos.length);
    commit();
    buildControls();
  });

  // Layout picker.
  const layoutList = $('layout-list');
  layoutList.innerHTML = '';
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.className = 'pick' + (l.id === state.layout ? ' active' : '');
    b.textContent = l.name;
    b.title = l.blurb;
    b.addEventListener('click', () => {
      state.layout = l.id;
      state.slots = slotsForCount(l.slots.length, photos.length);
      selectedSlot = 0;
      commit();
      buildControls();
    });
    layoutList.appendChild(b);
  }

  // Grade picker.
  const gradeList = $('grade-list');
  gradeList.innerHTML = '';
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.className = 'pick' + (g.id === state.grade ? ' active' : '');
    b.textContent = g.name;
    b.title = g.blurb;
    b.addEventListener('click', () => {
      state.grade = g.id;
      commit();
      buildControls();
    });
    gradeList.appendChild(b);
  }

  // Caption.
  $('title-input').value = state.title;
  $('subtitle-input').value = state.subtitle;
  $('title-input').oninput = (e) => { state.title = e.target.value.toUpperCase(); render(); };
  $('title-input').onchange = () => commit();
  $('subtitle-input').oninput = (e) => { state.subtitle = e.target.value.toUpperCase(); render(); };
  $('subtitle-input').onchange = () => commit();
  const swatches = $('title-colors');
  swatches.innerHTML = '';
  for (const c of ['#ffffff', '#fff3c4', '#ffe9f5', '#00e5ff', '#ffd24d']) {
    const b = document.createElement('button');
    b.className = 'swatch' + (c === state.titleColor ? ' active' : '');
    b.style.background = c;
    b.title = c;
    b.addEventListener('click', () => { state.titleColor = c; commit(); buildControls(); });
    swatches.appendChild(b);
  }
  $('badge-toggle').checked = state.badge;
  $('badge-toggle').onchange = (e) => { state.badge = e.target.checked; commit(); };

  // Selected panel.
  updatePanelControls();

  // Export.
  const exportList = $('export-list');
  exportList.innerHTML = '';
  for (const s of EXPORT_SIZES) {
    const b = document.createElement('button');
    b.className = 'pick' + (s.id === previewSize.id ? ' active' : '');
    b.textContent = s.label;
    b.addEventListener('click', () => {
      previewSize = s;
      resizeStage();
      render();
      buildControls();
    });
    exportList.appendChild(b);
  }
  $('export-one').onclick = () => exportPng(previewSize);
  $('export-all').onclick = async () => {
    for (const s of EXPORT_SIZES) await exportPng(s);
  };

  // Topbar.
  $('undo-btn').disabled = !history.canUndo();
  $('redo-btn').disabled = !history.canRedo();
  $('undo-btn').onclick = () => { const s = history.undo(photos); if (s) applyState(s); };
  $('redo-btn').onclick = () => { const s = history.redo(photos); if (s) applyState(s); };
  $('shuffle-btn').onclick = () => {
    state.seed = Math.floor(Math.random() * 100000);
    state.layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)].id;
    state.grade = GRADES[Math.floor(Math.random() * GRADES.length)].id;
    state.slots = slotsForCount(layoutById(state.layout).slots.length, photos.length);
    selectedSlot = 0;
    commit();
    buildControls();
  };
  const presetSel = $('preset-select');
  presetSel.innerHTML = '<option value="">Presets…</option>';
  for (const p of PRESETS) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    presetSel.appendChild(o);
  }
  presetSel.onchange = (e) => {
    const p = PRESETS.find((x) => x.id === e.target.value);
    if (!p) return;
    Object.assign(state, {
      layout: p.layout, grade: p.grade, title: p.title,
      subtitle: p.subtitle, titleColor: p.titleColor,
    });
    state.slots = slotsForCount(layoutById(state.layout).slots.length, photos.length);
    selectedSlot = 0;
    commit();
    buildControls();
  };
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      const s = history.undo(photos);
      if (s) applyState(s);
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      const s = history.redo(photos);
      if (s) applyState(s);
    }
  });
}

function updatePanelControls() {
  const slot = state.slots[selectedSlot];
  $('panel-label').textContent = slot
    ? `Panel ${selectedSlot + 1} of ${state.slots.length} — ${photos[slot.photo]?.name || 'no photo'}`
    : 'No panel selected';
  const zoom = $('zoom-range');
  zoom.value = slot ? slot.zoom : 1;
  zoom.oninput = (e) => {
    if (!slot) return;
    slot.zoom = parseFloat(e.target.value);
    render();
  };
  zoom.onchange = () => commit();
  $('fit-btn').onclick = () => {
    if (!slot) return;
    slot.zoom = 1;
    slot.ox = 0;
    slot.oy = null;
    commit();
  };
}

function assignPhoto(photoIndex) {
  const slot = state.slots[selectedSlot];
  if (!slot) return;
  slot.photo = photoIndex;
  commit();
}

function applyState(s) {
  Object.assign(state, JSON.parse(JSON.stringify(s)));
  state.photos = photos.map(({ id, name, src }) => ({ id, name, src }));
  // Re-attach live images and keep slot assignments valid.
  state.slots = state.slots.slice(0, layoutById(state.layout).slots.length);
  while (state.slots.length < layoutById(state.layout).slots.length) {
    state.slots.push({ photo: 0, zoom: 1, ox: 0, oy: null });
  }
  selectedSlot = clamp(selectedSlot, 0, state.slots.length - 1);
  resizeStage();
  render();
  buildControls();
}

function commit() {
  history.push(state);
  render();
  updatePanelControls();
}

function resizeStage() {
  stage.width = previewSize.w;
  stage.height = previewSize.h;
}

function render() {
  resizeStage();
  drawCover(stage, state, photos, stage.width, stage.height);
  // Selection outline over the chosen panel.
  const layout = layoutById(state.layout);
  const slots = slotsFor(layout, stage.width, stage.height);
  const sel = slots[selectedSlot];
  if (sel) {
    stageCtx.save();
    stageCtx.strokeStyle = '#00e5ff';
    stageCtx.lineWidth = Math.max(2, stage.width * 0.004);
    stageCtx.setLineDash([12, 8]);
    stageCtx.strokeRect(sel.x + 2, sel.y + 2, sel.w - 4, sel.h - 4);
    stageCtx.setLineDash([]);
    stageCtx.restore();
  }
  $('size-label').textContent = `${previewSize.label} — ${state.title || 'Untitled'}`;
}

function bindStage() {
  const toCover = (e) => {
    const r = stage.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * stage.width,
      y: ((e.clientY - r.top) / r.height) * stage.height,
    };
  };
  stage.addEventListener('pointerdown', (e) => {
    const p = toCover(e);
    const layout = layoutById(state.layout);
    const slots = slotsFor(layout, stage.width, stage.height);
    const hit = slots.findIndex((s) => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h);
    if (hit >= 0) {
      selectedSlot = hit;
      const slot = state.slots[hit];
      drag = { slot, startX: p.x, startY: p.y, ox: slot.ox, oy: slot.oy, moved: false };
      stage.setPointerCapture(e.pointerId);
      render();
      updatePanelControls();
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toCover(e);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (!drag.moved) return;
    const layout = layoutById(state.layout);
    const slots = slotsFor(layout, stage.width, stage.height);
    const s = slots[selectedSlot];
    // Pan in fractions of the panel: a full panel-width drag = full pan.
    drag.slot.ox = clamp((drag.ox || 0) - dx / Math.max(1, s.w), -1, 1);
    drag.slot.oy = clamp(((drag.oy === null || drag.oy === undefined) ? 0 : drag.oy) - dy / Math.max(1, s.h), -1, 1);
    render();
  });
  stage.addEventListener('pointerup', () => {
    if (drag && drag.moved) commit();
    drag = null;
  });
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const slot = state.slots[selectedSlot];
    if (!slot) return;
    slot.zoom = clamp(slot.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 1, 4);
    render();
  }, { passive: false });
}

function exportPng(size) {
  return new Promise((resolve) => {
    const canvas = renderCover(state, photos, size.w, size.h);
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neon-coast-${size.id}-${state.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'cover'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

// Expose for shots.js and for the finalist review's own photo test.
window.__coverStudio = { state, photos, renderCover, exportPng, get selectedSlot() { return selectedSlot; } };

boot();
