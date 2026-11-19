// cover.js — the Neon Coast cover renderer.
//
// drawCover(canvas, state, photos, W, H) paints a whole cover:
// sky + sun, the layout's photo panels (cover-fit with the face-band
// anchor, each graded, each framed), the halftone title block, the
// gold-star badge, grain and a vignette. Everything is deterministic
// for a given state: the grain comes from a seeded RNG, and no step
// reads the clock or the network.

import { gradeById } from './grades.js';
import { slotsFor, titleBandFor, layoutById } from './layouts.js';
import { coverCrop, rng, clamp } from './state.js';

const TITLE_FONT = '"Noto Sans Condensed", "Arial Narrow", sans-serif';

/** Render a cover into a fresh canvas of W x H. Returns the canvas. */
export function renderCover(state, photos, W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawCover(canvas, state, photos, W, H);
  return canvas;
}

export function drawCover(canvas, state, photos, W, H) {
  const ctx = canvas.getContext('2d');
  const grade = gradeById(state.grade);
  const layout = layoutById(state.layout);
  drawSky(ctx, grade, W, H);
  const slots = slotsFor(layout, W, H);
  slots.forEach((slot, i) => {
    const assign = state.slots[i] || { photo: 0, zoom: 1, ox: 0, oy: null };
    const photo = photos[assign.photo % Math.max(1, photos.length)];
    if (photo && photo.img) drawPanel(ctx, photo.img, slot, assign, grade, W, H);
    else drawEmptyPanel(ctx, slot, W, H);
  });
  const band = titleBandFor(layout, W, H);
  drawTitleBlock(ctx, band, state, grade, W, H);
  if (state.grain) drawGrain(ctx, W, H, state.seed);
  if (state.vignette) drawVignette(ctx, W, H);
}

// ---------------------------------------------------------------- sky

function drawSky(ctx, grade, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, grade.sky.top);
  g.addColorStop(0.45, grade.sky.mid);
  g.addColorStop(0.8, grade.sky.low);
  g.addColorStop(1, grade.sky.low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Sun: a glowing disc low over the horizon.
  const sx = W * 0.76;
  const sy = H * 0.30;
  const sr = Math.min(W, H) * 0.085;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 3.2);
  glow.addColorStop(0, hexA(grade.sky.sun, 0.85));
  glow.addColorStop(0.35, hexA(grade.sky.sun, 0.22));
  glow.addColorStop(1, hexA(grade.sky.sun, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = grade.sky.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  // Horizon haze: a soft light band where the sun sits.
  const haze = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.62);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(0.5, 'rgba(255,255,255,0.10)');
  haze.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, H * 0.42, W, H * 0.20);
}

// ---------------------------------------------------------------- panels

function drawPanel(ctx, img, slot, assign, grade, W, H) {
  ctx.save();
  clipSlot(ctx, slot);
  if (slot.rot) {
    ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
    ctx.rotate((slot.rot * Math.PI) / 180);
    ctx.translate(-(slot.x + slot.w / 2), -(slot.y + slot.h / 2));
  }
  const crop = coverCrop(img.naturalWidth, img.naturalHeight, slot.w, slot.h, assign.zoom, assign.ox, assign.oy);
  ctx.filter = grade.filter || 'none';
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, slot.x, slot.y, slot.w, slot.h);
  ctx.filter = 'none';
  if (grade.ramp) applyRampToRect(ctx, slot, grade.ramp);
  for (const wash of grade.washes) {
    ctx.globalCompositeOperation = wash.mode;
    ctx.globalAlpha = wash.alpha;
    ctx.fillStyle = wash.color;
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.restore();
  drawFrame(ctx, slot, grade, W, H);
}

function drawEmptyPanel(ctx, slot, W, H) {
  ctx.save();
  clipSlot(ctx, slot);
  ctx.fillStyle = '#1a1a26';
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = Math.max(1, W * 0.0015);
  ctx.setLineDash([W * 0.008, W * 0.006]);
  ctx.strokeRect(slot.x + 4, slot.y + 4, slot.w - 8, slot.h - 8);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 ${Math.round(Math.min(slot.w, slot.h) * 0.07)}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADD A PHOTO', slot.x + slot.w / 2, slot.y + slot.h / 2);
  ctx.restore();
  drawFrame(ctx, slot, null, W, H);
}

function clipSlot(ctx, slot) {
  ctx.beginPath();
  if (slot.poly) {
    ctx.moveTo(slot.poly[0][0], slot.poly[0][1]);
    for (let i = 1; i < slot.poly.length; i++) ctx.lineTo(slot.poly[i][0], slot.poly[i][1]);
    ctx.closePath();
  } else {
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
  }
  ctx.clip();
}

function drawFrame(ctx, slot, grade, W, H) {
  const t = Math.max(2, W * 0.004);
  ctx.save();
  if (slot.rot) {
    ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
    ctx.rotate((slot.rot * Math.PI) / 180);
    ctx.translate(-(slot.x + slot.w / 2), -(slot.y + slot.h / 2));
  }
  const path = () => {
    ctx.beginPath();
    if (slot.poly) {
      ctx.moveTo(slot.poly[0][0], slot.poly[0][1]);
      for (let i = 1; i < slot.poly.length; i++) ctx.lineTo(slot.poly[i][0], slot.poly[i][1]);
      ctx.closePath();
    } else {
      ctx.rect(slot.x, slot.y, slot.w, slot.h);
    }
  };
  if (slot.frame === 'none') {
    ctx.restore();
    return;
  }
  if (slot.frame === 'snap') {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = W * 0.012;
    ctx.shadowOffsetY = W * 0.004;
    ctx.fillStyle = '#f7f3ea';
    const b = Math.max(6, W * 0.011);
    path();
    // Widen the rect into a polaroid border by stroking thick white.
    ctx.lineWidth = b;
    ctx.strokeStyle = '#f7f3ea';
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  } else if (slot.frame === 'band') {
    path();
    ctx.lineWidth = t;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    const bh = slot.h * 0.07;
    ctx.fillStyle = grade ? grade.sky.low : '#ffb347';
    ctx.fillRect(slot.x, slot.y, slot.w, bh);
    ctx.fillRect(slot.x, slot.y + slot.h - bh, slot.w, bh);
  } else {
    // 'ink': a thick black rule with a thin white inner line.
    path();
    ctx.lineWidth = t;
    ctx.strokeStyle = '#0d0d12';
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(slot.x + t, slot.y + t, slot.w - t * 2, slot.h - t * 2);
    ctx.lineWidth = Math.max(1, t * 0.35);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- grades

function applyRampToRect(ctx, slot, ramp) {
  const x = Math.max(0, Math.floor(slot.x));
  const y = Math.max(0, Math.floor(slot.y));
  const w = Math.min(ctx.canvas.width - x, Math.ceil(slot.w));
  const h = Math.min(ctx.canvas.height - y, Math.ceil(slot.h));
  if (w <= 0 || h <= 0) return;
  const data = ctx.getImageData(x, y, w, h);
  const px = data.data;
  const lutR = new Uint8Array(256);
  const lutG = new Uint8Array(256);
  const lutB = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const l = i / 255;
    const c = rampColor(ramp, l);
    lutR[i] = c[0];
    lutG[i] = c[1];
    lutB[i] = c[2];
  }
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
    px[i] = lutR[lum];
    px[i + 1] = lutG[lum];
    px[i + 2] = lutB[lum];
  }
  ctx.putImageData(data, x, y);
}

function rampColor(ramp, l) {
  if (l <= ramp[0][0]) return ramp[0][1];
  for (let i = 1; i < ramp.length; i++) {
    if (l <= ramp[i][0]) {
      const [l0, c0] = ramp[i - 1];
      const [l1, c1] = ramp[i];
      const t = (l - l0) / Math.max(1e-6, l1 - l0);
      return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
    }
  }
  return ramp[ramp.length - 1][1];
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// ---------------------------------------------------------------- title + badge

/**
 * The title band and the badge share one row: the title takes the width
 * left of the badge, so the two never overlap (badgeRow helper).
 */
export function badgeRow(band, badgeW, margin) {
  return {
    title: { x: band.x + margin, y: band.y, w: Math.max(0, band.w - badgeW - margin * 3), h: band.h },
    badge: { x: band.x + band.w - badgeW - margin, y: band.y + band.h / 2, w: badgeW },
  };
}

function drawTitleBlock(ctx, band, state, grade, W, H) {
  const margin = W * 0.03;
  const badgeW = state.badge ? Math.min(band.w * 0.22, H * 0.30) : 0;
  const row = badgeRow(band, badgeW, margin);
  // Halftone field behind the title: dots shrinking away from the band.
  const dotGap = Math.max(7, W * 0.011);
  const cx = row.title.x + row.title.w * 0.5;
  const cy = band.y + band.h * 0.5;
  const maxD = Math.hypot(band.w, band.h) * 0.5;
  ctx.fillStyle = hexA(grade.sky.mid, 0.55);
  for (let y = band.y + dotGap / 2; y < band.y + band.h; y += dotGap) {
    for (let x = band.x + dotGap / 2; x < band.x + band.w; x += dotGap) {
      const d = Math.hypot(x - cx, y - cy) / maxD;
      const r = Math.max(0.6, (dotGap * 0.32) * (1 - d * 0.7));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Title text, condensed extra-bold, with a hard offset shadow.
  const size = Math.min(band.h * 0.62, row.title.w / Math.max(4, state.title.length) * 1.9);
  const font = `900 ${Math.round(size)}px ${TITLE_FONT}`;
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.04)}px`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let tw = ctx.measureText(state.title).width;
  let fs = size;
  while (tw > row.title.w && fs > 10) {
    fs *= 0.94;
    ctx.font = `900 ${Math.round(fs)}px ${TITLE_FONT}`;
    tw = ctx.measureText(state.title).width;
  }
  const ty = band.y + band.h * (state.subtitle ? 0.38 : 0.52);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(state.title, row.title.x + 3, ty + 3);
  ctx.fillStyle = state.titleColor || '#ffffff';
  ctx.fillText(state.title, row.title.x, ty);
  if (state.subtitle) {
    const subSize = Math.round(band.h * 0.17);
    ctx.font = `600 ${subSize}px ${TITLE_FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`;
    ctx.fillStyle = hexA(grade.sky.sun, 0.95);
    ctx.fillText(state.subtitle, row.title.x, band.y + band.h * 0.82);
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  if (state.badge) drawBadge(ctx, row.badge.x, row.badge.y, badgeW, W);
}

function drawBadge(ctx, x, cy, w, W) {
  const h = Math.max(18, w * 0.24);
  const r = h / 2;
  ctx.save();
  // Gold pill with a star.
  ctx.fillStyle = '#f5b90d';
  ctx.strokeStyle = '#7a5200';
  ctx.lineWidth = Math.max(1, W * 0.0012);
  roundRect(ctx, x, cy - r, w, h, r);
  ctx.fill();
  ctx.stroke();
  const starR = h * 0.36;
  const sx = x + h * 0.52;
  drawStar(ctx, sx, cy, starR, '#7a5200');
  ctx.fillStyle = '#241a00';
  ctx.font = `800 ${Math.round(h * 0.42)}px ${TITLE_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEON COAST', x + h * 0.95, cy + 1);
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- grain + vignette

function drawGrain(ctx, W, H, seed) {
  const rand = rng(seed * 7919 + 13);
  const n = Math.floor((W * H) / 260);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = rand() * W;
    const y = rand() * H;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 1.3, 1.3);
  }
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function hexA(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(alpha, 0, 1)})`;
}
