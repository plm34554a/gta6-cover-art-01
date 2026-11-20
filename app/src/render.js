// The cover renderer for Vice Panels.
//
// drawCover paints a whole poster into any 2D context at any size, from the
// editor's state alone: the panel collage, each panel's photo cropped by its
// own pan and zoom, the colour grade, and the caption lettering. The editor's
// live preview and the PNG export call this same function, so what you see
// while editing is exactly what the exported file holds.

import { LAYOUTS, panelBox } from './layouts.js';

export const POST_SIZES = [
  { id: 'square', name: 'Square post', w: 1080, h: 1080 },
  { id: 'portrait', name: 'Portrait post', w: 1080, h: 1350 },
  { id: 'wide', name: 'Wide post', w: 1920, h: 1080 },
];

// Colour grades. `filter` runs on each photo as it is drawn; `wash` is a
// vertical gradient laid over the whole collage; `glow` is a soft light from
// the top. Amounts are scaled by the editor's grade intensity.
export const GRADES = [
  {
    id: 'sunset',
    name: 'Vice Sunset',
    filter: 'saturate(1.32) contrast(1.08) brightness(1.03)',
    wash: [[0, 'rgba(255,120,40,0.10)'], [0.45, 'rgba(255,60,110,0.16)'], [1, 'rgba(24,8,64,0.30)']],
    glow: 'rgba(255,170,80,0.20)',
  },
  {
    id: 'neon',
    name: 'Neon Night',
    filter: 'saturate(1.45) contrast(1.12) brightness(0.98)',
    wash: [[0, 'rgba(0,229,255,0.12)'], [0.55, 'rgba(120,0,255,0.14)'], [1, 'rgba(255,0,128,0.20)']],
    glow: 'rgba(0,229,255,0.16)',
  },
  {
    id: 'gold',
    name: 'Gold Hour',
    filter: 'saturate(1.18) contrast(1.05) brightness(1.06) sepia(0.22)',
    wash: [[0, 'rgba(255,190,60,0.12)'], [0.6, 'rgba(255,120,20,0.10)'], [1, 'rgba(60,24,0,0.26)']],
    glow: 'rgba(255,210,110,0.22)',
  },
  {
    id: 'clean',
    name: 'Clean Print',
    filter: 'saturate(1.08) contrast(1.04)',
    wash: [[0, 'rgba(255,255,255,0.03)'], [1, 'rgba(0,0,0,0.14)']],
    glow: 'rgba(255,255,255,0.06)',
  },
];

const INK = '#0d0d12';
const KEYLINE = '#f7f1e3';

function tracePanel(ctx, panel, W, H) {
  ctx.beginPath();
  panel.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x * W, y * H);
    else ctx.lineTo(x * W, y * H);
  });
  ctx.closePath();
}

// Paint one panel: the photo (or a printed placeholder) clipped to the
// polygon, graded as it lands.
function paintPanel(ctx, W, H, panel, view, image, grade) {
  const box = panelBox(panel);
  const bx = box.x * W, by = box.y * H, bw = box.w * W, bh = box.h * H;
  ctx.save();
  tracePanel(ctx, panel, W, H);
  ctx.clip();
  if (image && image.naturalWidth > 0) {
    // Cover-fit the photo to the panel's box, then apply the panel's own
    // zoom and pan: zoom 1 exactly covers the box, pan is in box units.
    const cover = Math.max(bw / image.naturalWidth, bh / image.naturalHeight);
    const dw = image.naturalWidth * cover * view.zoom;
    const dh = image.naturalHeight * cover * view.zoom;
    const dx = bx + (bw - dw) / 2 + view.ox * bw;
    const dy = by + (bh - dh) / 2 + view.oy * bh;
    ctx.filter = grade.filter;
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    // No photo yet: a printed sunset placeholder with the panel's number,
    // so the collage still reads as a poster in the editor.
    const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    g.addColorStop(0, '#2b1055');
    g.addColorStop(0.55, '#7597de');
    g.addColorStop(0.78, '#ff7e5f');
    g.addColorStop(1, '#feb47b');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(13,13,18,0.25)';
    ctx.font = `${Math.round(bh * 0.5)}px Anton, 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(view.index + 1), bx + bw / 2, by + bh / 2);
  }
  ctx.restore();
  // The cream keyline that separates the panels on a printed cover.
  tracePanel(ctx, panel, W, H);
  ctx.lineWidth = Math.max(2, H * 0.0055);
  ctx.strokeStyle = KEYLINE;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// The grade: a colour wash over the collage, a glow from the top, and a
// vignette to seat the edges, all scaled by the chosen intensity.
function paintGrade(ctx, W, H, grade, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount;
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  for (const [at, colour] of grade.wash) wash.addColorStop(at, colour);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -H * 0.25, H * 0.1, W / 2, -H * 0.25, H * 1.05);
  glow.addColorStop(0, grade.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.98);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Split a caption into one or two lines that fit the poster width.
function wrapTitle(ctx, text, maxWidth) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length === 1 || ctx.measureText(words.join(' ')).width <= maxWidth) {
    return [words.join(' ')];
  }
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!best || w < best.w) best = { lines: [a, b], w };
  }
  return best.lines;
}

// The caption: poster lettering with a hard shadow and a black outline, the
// tagline letterspaced beneath it (or above it, when the caption sits high).
function paintCaption(ctx, W, H, state) {
  const title = (state.title || '').trim();
  const tagline = (state.tagline || '').trim();
  if (!title && !tagline) return;
  const atTop = state.titleAt === 'top';
  ctx.save();
  // A soft scrim behind the lettering so it holds over bright photos.
  const scrimH = H * 0.34;
  const scrim = atTop
    ? ctx.createLinearGradient(0, 0, 0, scrimH)
    : ctx.createLinearGradient(0, H, 0, H - scrimH);
  scrim.addColorStop(0, 'rgba(5,5,10,0.42)');
  scrim.addColorStop(1, 'rgba(5,5,10,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, atTop ? 0 : H - scrimH, W, scrimH);

  const margin = W * 0.055;
  let size = Math.min(W, H * 1.35) * 0.128 * (state.titleScale || 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let lines = [];
  if (title) {
    for (;;) {
      ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
      lines = wrapTitle(ctx, title.toUpperCase(), W - margin * 2);
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if (widest <= W - margin * 2 || size < 18) break;
      size *= (W - margin * 2) / widest;
    }
  }
  const lineH = size * 1.04;
  const tagSize = size * 0.30;
  const blockH = lines.length * lineH + (tagline ? tagSize * 1.75 : 0);
  let baseline = atTop ? margin + size * 0.92 : H - margin - blockH + size * 0.92;
  let lastLineBaseline = baseline;

  if (tagline && atTop) {
    ctx.font = `${tagSize}px Anton, 'Arial Black', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(tagSize * 0.32)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffd166';
    ctx.fillText(tagline.toUpperCase(), margin + size * 0.02, baseline - size * 0.18);
    baseline += tagSize * 1.55 + size * 0.12;
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  for (const line of lines) {
    // Hard offset shadow, then outline, then a warm white fill.
    ctx.fillStyle = 'rgba(10,8,14,0.85)';
    ctx.fillText(line, margin + size * 0.045, baseline + size * 0.05);
    ctx.lineWidth = size * 0.16;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.strokeText(line, margin, baseline);
    const fill = ctx.createLinearGradient(0, baseline - size, 0, baseline);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.75, '#fff6e8');
    fill.addColorStop(1, '#ffc98a');
    ctx.fillStyle = fill;
    ctx.fillText(line, margin, baseline);
    lastLineBaseline = baseline;
    baseline += lineH;
  }
  if (tagline && !atTop) {
    // Sit the tagline under the title's last line, inside the bottom margin.
    const tagBaseline = lastLineBaseline + size * 0.30 + tagSize;
    ctx.font = `${tagSize}px Anton, 'Arial Black', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(tagSize * 0.32)}px`; } catch { /* older canvas */ }
    ctx.lineWidth = tagSize * 0.14;
    ctx.strokeStyle = INK;
    ctx.strokeText(tagline.toUpperCase(), margin + size * 0.02, tagBaseline);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(tagline.toUpperCase(), margin + size * 0.02, tagBaseline);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  ctx.restore();
}

// Paint the whole cover described by state into ctx at W x H.
export function drawCover(ctx, W, H, state, photosById) {
  const layout = LAYOUTS[state.layoutIndex] || LAYOUTS[0];
  const grade = GRADES.find((g) => g.id === state.gradeId) || GRADES[0];
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  layout.panels.forEach((panel, i) => {
    const view = state.panels[i] || { photoId: null, zoom: 1, ox: 0, oy: 0 };
    const image = view.photoId ? photosById.get(view.photoId) : null;
    paintPanel(ctx, W, H, panel, { ...view, index: i }, image, grade);
  });
  paintGrade(ctx, W, H, grade, state.gradeAmount);
  paintCaption(ctx, W, H, state);
  // The poster's outer frame.
  ctx.lineWidth = Math.max(3, H * 0.008);
  ctx.strokeStyle = INK;
  ctx.strokeRect(0, 0, W, H);
  ctx.restore();
}

// Render the cover to a fresh canvas at an exact post size (the export).
export function renderCoverCanvas(state, photosById, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas.getContext('2d'), size.w, size.h, state, photosById);
  return canvas;
}
