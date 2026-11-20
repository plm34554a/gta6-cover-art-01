// The Vice Panels editor: wires the controls to the cover renderer.
//
// Photos live only in this page (object URLs and the two bundled samples);
// nothing is uploaded anywhere. The stage canvas is a live preview drawn by
// the same drawCover the export uses, so the PNG a person downloads is the
// poster they framed.

import { LAYOUTS, panelBox, panelAt } from './layouts.js';
import { POST_SIZES, GRADES, drawCover, renderCoverCanvas } from './render.js';

const SAMPLES = [
  { id: 'sample-pier', src: 'samples/pier.jpg', label: 'Pier at dusk' },
  { id: 'sample-boulevard', src: 'samples/boulevard.jpg', label: 'Boulevard' },
];

const photos = new Map(); // id -> HTMLImageElement
const photoNames = new Map(); // id -> display name
let uploadCount = 0;
let pickedPhotoId = null;

const state = {
  layoutIndex: 0,
  sizeIndex: 0,
  gradeId: 'sunset',
  gradeAmount: 0.85,
  title: 'MIDNIGHT HEAT',
  tagline: 'EVERY SAINT HAS A PAST',
  titleScale: 1,
  titleAt: 'bottom',
  panels: [],
  selected: 0,
};

function blankView(photoId = null) {
  return { photoId, zoom: 1, ox: 0, oy: 0 };
}

function currentLayout() {
  return LAYOUTS[state.layoutIndex];
}

function currentSize() {
  return POST_SIZES[state.sizeIndex];
}

// Rebuild the panel views for a layout, keeping the views (and photos) of
// panels that already exist at the same index.
function fitPanelsToLayout() {
  const next = [];
  for (let i = 0; i < currentLayout().panels.length; i++) {
    next.push(state.panels[i] || blankView(pickedPhotoId));
  }
  state.panels = next;
  if (state.selected >= next.length) state.selected = 0;
}

// ---------------------------------------------------------------- photos

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function addSample(sample) {
  if (photos.has(sample.id)) return photos.get(sample.id);
  const img = await loadImage(sample.src);
  photos.set(sample.id, img);
  photoNames.set(sample.id, sample.label);
  addTrayThumb(sample.id, sample.src);
  if (!pickedPhotoId) pickPhoto(sample.id);
  return img;
}

function addTrayThumb(id, src) {
  const tray = document.getElementById('photo-tray');
  const thumb = document.createElement('img');
  thumb.className = 'tray-photo';
  thumb.src = src;
  thumb.alt = photoNames.get(id) || 'photo';
  thumb.title = thumb.alt;
  thumb.dataset.photoId = id;
  thumb.addEventListener('click', () => {
    pickPhoto(id);
    assignPickedToSelected();
  });
  tray.appendChild(thumb);
}

function pickPhoto(id) {
  pickedPhotoId = id;
  document.querySelectorAll('.tray-photo').forEach((el) => {
    el.classList.toggle('chosen', el.dataset.photoId === id);
  });
}

function assignPickedToSelected() {
  if (!pickedPhotoId) return;
  const view = state.panels[state.selected];
  if (view) view.photoId = pickedPhotoId;
  render();
}

async function addUploads(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    const id = `upload-${++uploadCount}`;
    photos.set(id, img);
    photoNames.set(id, file.name);
    addTrayThumb(id, url);
    pickPhoto(id);
    assignPickedToSelected();
  }
  render();
}

// Give every panel the picked photo, each panel framing it on its own.
function fillAllPanels() {
  if (!pickedPhotoId) return;
  for (const view of state.panels) view.photoId = pickedPhotoId;
  render();
}

// Spread the picked photo across the whole collage as one continuous
// picture: each panel's pan and zoom are solved so the panels line up.
function spreadMosaic() {
  const img = photos.get(pickedPhotoId);
  if (!img) return;
  const { w: W, h: H } = currentSize();
  const coverAll = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const drawnW = img.naturalWidth * coverAll;
  const drawnH = img.naturalHeight * coverAll;
  const originX = (W - drawnW) / 2;
  const originY = (H - drawnH) / 2;
  currentLayout().panels.forEach((panel, i) => {
    const box = panelBox(panel);
    const bw = box.w * W, bh = box.h * H;
    const coverPanel = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
    const view = state.panels[i];
    view.photoId = pickedPhotoId;
    view.zoom = coverAll / coverPanel;
    view.ox = (originX - box.x * W - (bw - drawnW) / 2) / bw;
    view.oy = (originY - box.y * H - (bh - drawnH) / 2) / bh;
  });
  render();
}

// ---------------------------------------------------------------- stage

const stage = document.getElementById('stage');
const stageCtx = stage.getContext('2d');

function sizeStageToPost() {
  const { w, h } = currentSize();
  const scale = Math.min(880 / w, 880 / h);
  stage.width = Math.round(w * scale);
  stage.height = Math.round(h * scale);
}

function render() {
  drawCover(stageCtx, stage.width, stage.height, state, photos);
  outlineSelectedPanel();
  syncPanelControls();
}

function outlineSelectedPanel() {
  const panel = currentLayout().panels[state.selected];
  if (!panel) return;
  stageCtx.save();
  stageCtx.beginPath();
  panel.forEach(([x, y], i) => {
    if (i === 0) stageCtx.moveTo(x * stage.width, y * stage.height);
    else stageCtx.lineTo(x * stage.width, y * stage.height);
  });
  stageCtx.closePath();
  stageCtx.setLineDash([10, 7]);
  stageCtx.lineWidth = 2.5;
  stageCtx.strokeStyle = '#ffd166';
  stageCtx.stroke();
  stageCtx.restore();
}

function stagePoint(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (stage.width / rect.width),
    y: (event.clientY - rect.top) * (stage.height / rect.height),
  };
}

function panelIndexAt(x, y) {
  const nx = x / stage.width;
  const ny = y / stage.height;
  const panels = currentLayout().panels;
  for (let i = panels.length - 1; i >= 0; i--) {
    if (panelAt(panels[i], nx, ny)) return i;
  }
  return -1;
}

let drag = null;

function wireStage() {
  stage.addEventListener('pointerdown', (event) => {
    const p = stagePoint(event);
    const idx = panelIndexAt(p.x, p.y);
    if (idx === -1) return;
    state.selected = idx;
    drag = { x: p.x, y: p.y };
    stage.setPointerCapture(event.pointerId);
    render();
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const p = stagePoint(event);
    const view = state.panels[state.selected];
    const box = panelBox(currentLayout().panels[state.selected]);
    view.ox += (p.x - drag.x) / (box.w * stage.width);
    view.oy += (p.y - drag.y) / (box.h * stage.height);
    drag = p;
    render();
  });
  const endDrag = () => { drag = null; };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('wheel', (event) => {
    const p = stagePoint(event);
    const idx = panelIndexAt(p.x, p.y);
    if (idx === -1) return;
    event.preventDefault();
    state.selected = idx;
    const view = state.panels[idx];
    view.zoom = Math.min(4, Math.max(1, view.zoom * Math.exp(-event.deltaY * 0.0012)));
    render();
  }, { passive: false });
}

// ---------------------------------------------------------------- controls

function syncPanelControls() {
  const view = state.panels[state.selected];
  if (!view) return;
  document.getElementById('panel-label').textContent =
    `Panel ${state.selected + 1} of ${state.panels.length} selected` +
    (view.photoId ? ` — showing ${photoNames.get(view.photoId) || 'a photo'}` : ' — no photo yet');
  document.getElementById('zoom-slider').value = view.zoom;
  document.getElementById('panx-slider').value = view.ox;
  document.getElementById('pany-slider').value = view.oy;
}

function buttonGrid(containerId, items, isChosen, onPick) {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  items.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn' + (isChosen(item, i) ? ' chosen' : '');
    btn.textContent = item.name;
    btn.addEventListener('click', () => onPick(item, i));
    box.appendChild(btn);
  });
}

function refreshButtonGrids() {
  buttonGrid('layout-buttons', LAYOUTS, (_l, i) => i === state.layoutIndex, (_l, i) => {
    state.layoutIndex = i;
    document.getElementById('layout-blurb').textContent = LAYOUTS[i].blurb;
    fitPanelsToLayout();
    refreshButtonGrids();
    render();
  });
  buttonGrid('grade-buttons', GRADES, (g) => g.id === state.gradeId, (g) => {
    state.gradeId = g.id;
    refreshButtonGrids();
    render();
  });
  buttonGrid('size-buttons', POST_SIZES.map((s) => ({ ...s, name: `${s.name} ${s.w}×${s.h}` })),
    (_s, i) => i === state.sizeIndex, (_s, i) => {
      state.sizeIndex = i;
      sizeStageToPost();
      refreshButtonGrids();
      render();
    });
}

function wireControls() {
  document.getElementById('photo-input').addEventListener('change', (event) => {
    addUploads(event.target.files);
    event.target.value = '';
  });
  document.getElementById('sample-pier-btn').addEventListener('click', async () => {
    await addSample(SAMPLES[0]); pickPhoto(SAMPLES[0].id); assignPickedToSelected();
  });
  document.getElementById('sample-boulevard-btn').addEventListener('click', async () => {
    await addSample(SAMPLES[1]); pickPhoto(SAMPLES[1].id); assignPickedToSelected();
  });
  document.getElementById('fill-panels-btn').addEventListener('click', fillAllPanels);
  document.getElementById('mosaic-btn').addEventListener('click', spreadMosaic);

  const view = () => state.panels[state.selected];
  document.getElementById('zoom-slider').addEventListener('input', (e) => { view().zoom = Number(e.target.value); render(); });
  document.getElementById('panx-slider').addEventListener('input', (e) => { view().ox = Number(e.target.value); render(); });
  document.getElementById('pany-slider').addEventListener('input', (e) => { view().oy = Number(e.target.value); render(); });
  document.getElementById('reset-view-btn').addEventListener('click', () => {
    const v = view();
    v.zoom = 1; v.ox = 0; v.oy = 0;
    render();
  });

  document.getElementById('grade-slider').addEventListener('input', (e) => {
    state.gradeAmount = Number(e.target.value);
    render();
  });
  document.getElementById('title-input').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  document.getElementById('tagline-input').addEventListener('input', (e) => { state.tagline = e.target.value; render(); });
  document.getElementById('title-size-slider').addEventListener('input', (e) => { state.titleScale = Number(e.target.value); render(); });
  const setTitleAt = (at) => {
    state.titleAt = at;
    document.getElementById('title-top-btn').classList.toggle('primary', at === 'top');
    document.getElementById('title-bottom-btn').classList.toggle('primary', at === 'bottom');
    render();
  };
  document.getElementById('title-top-btn').addEventListener('click', () => setTitleAt('top'));
  document.getElementById('title-bottom-btn').addEventListener('click', () => setTitleAt('bottom'));

  document.getElementById('export-btn').addEventListener('click', exportCover);
}

function exportCover() {
  const size = currentSize();
  const canvas = renderCoverCanvas(state, photos, size);
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-panels-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    document.getElementById('export-note').textContent =
      `Saved vice-panels-cover-${size.w}x${size.h}.png — ready to post.`;
  }, 'image/png');
}

// ---------------------------------------------------------------- start

async function waitForPosterFont() {
  try {
    await Promise.race([
      document.fonts.load('80px Anton'),
      new Promise((resolve) => setTimeout(resolve, 1800)),
    ]);
  } catch { /* fall back to the sans stack */ }
}

// Compose a starter collage from the two bundled samples so the editor
// opens on a finished-looking poster.
async function seedDefaultCollage() {
  await addSample(SAMPLES[0]);
  await addSample(SAMPLES[1]);
  const order = ['sample-pier', 'sample-boulevard', 'sample-boulevard', 'sample-pier', 'sample-boulevard', 'sample-pier'];
  state.panels.forEach((view, i) => { view.photoId = order[i % order.length]; });
  pickPhoto('sample-pier');
}

function applyQueryToState(params) {
  const layout = LAYOUTS.findIndex((l) => l.id === params.get('layout'));
  if (layout >= 0) state.layoutIndex = layout;
  const grade = GRADES.find((g) => g.id === params.get('grade'));
  if (grade) state.gradeId = grade.id;
  if (params.get('caption')) state.title = params.get('caption').toUpperCase();
  if (params.get('tagline')) state.tagline = params.get('tagline').toUpperCase();
  if (params.get('titleat')) state.titleAt = params.get('titleat');
  const size = POST_SIZES.findIndex((s) => s.id === params.get('size'));
  if (size >= 0) state.sizeIndex = size;
  fitPanelsToLayout();
}

// Shot mode: the page is only the finished cover, for taking screenshots.
async function startShotCover(params) {
  document.documentElement.classList.add('shot-cover');
  applyQueryToState(params);
  await waitForPosterFont();
  await seedDefaultCollage();
  const first = params.get('photo') === 'boulevard' ? 'sample-boulevard' : 'sample-pier';
  const second = first === 'sample-pier' ? 'sample-boulevard' : 'sample-pier';
  state.panels.forEach((view, i) => { view.photoId = i % 2 === 0 ? first : second; });
  if (state.panels[0]) state.panels[0].photoId = first;
  const size = currentSize();
  const canvas = renderCoverCanvas(state, photos, size);
  canvas.id = 'shot-canvas';
  document.body.appendChild(canvas);
  window.__shotReady = { width: size.w, height: size.h };
}

async function startEditor(params) {
  applyQueryToState(params);
  wireControls();
  wireStage();
  sizeStageToPost();
  refreshButtonGrids();
  document.getElementById('layout-blurb').textContent = currentLayout().blurb;
  await waitForPosterFont();
  await seedDefaultCollage();
  if (params.get('photo') === 'boulevard') {
    state.panels.forEach((view, i) => { view.photoId = i % 2 === 0 ? 'sample-boulevard' : 'sample-pier'; });
  }
  sizeStageToPost();
  render();
}

const params = new URLSearchParams(location.search);
if (params.get('shot') === 'cover') {
  startShotCover(params);
} else {
  startEditor(params);
}
