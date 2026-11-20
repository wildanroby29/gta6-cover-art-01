// Neon Chrome Cover Studio editor: photos, layouts, grades, caption, callout
// labels, seal, sizes, export. State lives here; cover.js draws it.
// Undo/redo keeps a history of the settings (photos themselves are not part
// of a history step).
import { renderCover, exportCoverPNG, COVER_SIZES, COVER_GRADES, COVER_LAYOUTS, TITLE_STYLES, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const trayEl = document.getElementById('tray');
// Six sample photos: four new neon-city characters plus the kit's two.
export const SAMPLE_PHOTOS = [
  { file: 'mechanic.jpg', label: 'THE MECHANIC', face: 0.16 },
  { file: 'courier.jpg', label: 'THE COURIER', face: 0.18 },
  { file: 'insider.jpg', label: 'THE INSIDER', face: 0.21 },
  { file: 'boss.jpg', label: 'THE BOSS', face: 0.22 },
  { file: 'boulevard.jpg', label: 'THE CREW', face: 0.25 },
  { file: 'pier.jpg', label: 'THE ANGLER', face: 0.15 },
];
const SAMPLE_LABELS = Object.fromEntries(SAMPLE_PHOTOS.map((s) => [s.file.replace('.jpg', ''), s.label]));

let photos = []; // {id, name, label, img}
let photoSeq = 0;
let selectedPanel = 0;
let drag = null;

const state = {
  layout: 'four-panel',
  grade: 'neon-night',
  size: '1080x1080',
  title: 'Last Call',
  subtitle: 'Neon Avenue',
  subtitleColor: '#ff5ce1',
  titleStyle: 'chrome-3d',
  heat: 4,
  strip: true,
  showLabels: true,
  showSeal: true,
  brightness: 1,
  contrast: 1,
  glow: 0.7,
  slots: Array.from({ length: 9 }, () => ({ photoId: null, zoom: 1, dx: 0, dy: 0, label: '' })),
};

let history = [];
let historyIndex = -1;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function pushHistory() {
  const snap = JSON.stringify({
    layout: state.layout, grade: state.grade, size: state.size,
    title: state.title, subtitle: state.subtitle, subtitleColor: state.subtitleColor,
    titleStyle: state.titleStyle, heat: state.heat,
    strip: state.strip, showLabels: state.showLabels, showSeal: state.showSeal,
    brightness: state.brightness, contrast: state.contrast, glow: state.glow,
    slots: state.slots,
  });
  history = history.slice(0, historyIndex + 1);
  history.push(snap);
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  updateUndoButtons();
}

function applyHistory(index) {
  const snap = JSON.parse(history[index]);
  Object.assign(state, snap);
  historyIndex = index;
  syncControls();
  redraw();
  updateUndoButtons();
}

function updateUndoButtons() {
  document.getElementById('undo').disabled = historyIndex <= 0;
  document.getElementById('redo').disabled = historyIndex >= history.length - 1;
}

function photoById(id) {
  return photos.find((p) => p.id === id) ?? null;
}

/** Resolves photo ids to images for the renderer. A slot's label is the
 *  callout tag drawn on its panel; it defaults to its photo's label. */
function renderState() {
  return {
    layout: state.layout, grade: state.grade, title: state.title,
    subtitle: state.subtitle, subtitleColor: state.subtitleColor,
    titleStyle: state.titleStyle, heat: state.heat, strip: state.strip,
    showLabels: state.showLabels, showSeal: state.showSeal,
    brightness: state.brightness, contrast: state.contrast, glow: state.glow,
    slots: state.slots.map((s) => {
      const p = photoById(s.photoId);
      return {
        photo: p?.img ?? null, zoom: s.zoom, dx: s.dx, dy: s.dy,
        caption: p?.label ?? '', label: s.label || p?.label || '',
        faceY: p?.faceY ?? null,
      };
    }),
  };
}

function redraw() {
  const [w, h] = COVER_SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  renderCover(canvas, renderState());
  document.querySelectorAll('#sizes button').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
  document.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades button').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('#titleStyles button').forEach((b) => b.classList.toggle('active', b.dataset.titleStyle === state.titleStyle));
  const cells = layoutPanels(state.layout, canvas.width, canvas.height, state.strip).cells.length;
  document.getElementById('panelLabel').textContent = `Panel ${Math.min(selectedPanel + 1, cells)} of ${cells}`;
  document.getElementById('panelLabelInput').value = state.slots[selectedPanel].label || '';
}

function syncControls() {
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('subtitleColor').value = state.subtitleColor;
  document.getElementById('heat').value = String(state.heat);
  document.getElementById('strip').checked = state.strip;
  document.getElementById('showLabels').checked = state.showLabels;
  document.getElementById('showSeal').checked = state.showSeal;
  document.getElementById('brightness').value = String(state.brightness);
  document.getElementById('contrast').value = String(state.contrast);
  document.getElementById('glow').value = String(state.glow);
  document.getElementById('zoom').value = String(state.slots[selectedPanel].zoom);
  redraw();
}

function setStatus(text) { statusEl.textContent = text; }

/** Adds a loaded photo to the tray and fills empty panel slots with it.
 *  `faceY` is the fraction down the photo where the subject's face sits
 *  (measured for the samples); the renderer centres wide-cell crops on it. */
function addPhoto(img, name, label, faceY = null) {
  const id = `p${++photoSeq}`;
  photos.push({ id, name, label: label ?? name.replace(/\.[^.]+$/, '').slice(0, 18), img, faceY });
  const empty = state.slots.find((s) => !s.photoId);
  if (empty) { empty.photoId = id; empty.label = photos[photos.length - 1].label; }
  renderTray();
  return id;
}

function renderTray() {
  trayEl.innerHTML = '';
  photos.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = `${p.name} — ${p.label}`;
    const thumb = document.createElement('canvas');
    thumb.width = 96; thumb.height = 96;
    const tctx = thumb.getContext('2d');
    const s = Math.max(96 / p.img.naturalWidth, 96 / p.img.naturalHeight);
    tctx.drawImage(p.img, (96 - p.img.naturalWidth * s) / 2, (96 - p.img.naturalHeight * s) / 2, p.img.naturalWidth * s, p.img.naturalHeight * s);
    b.appendChild(thumb);
    const used = state.slots.some((s) => s.photoId === p.id);
    if (used) b.classList.add('used');
    b.addEventListener('click', () => {
      const slot = state.slots[selectedPanel];
      slot.photoId = p.id;
      slot.label = p.label;
      pushHistory(); redraw(); renderTray();
      setStatus(`${p.name} → panel ${selectedPanel + 1} (${p.label})`);
    });
    trayEl.appendChild(b);
  });
}

/** Maps a pointer event to canvas pixels, then to a layout cell index. */
function pickPanel(event) {
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * (canvas.width / rect.width);
  const py = (event.clientY - rect.top) * (canvas.height / rect.height);
  const { cells } = layoutPanels(state.layout, canvas.width, canvas.height, state.strip);
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    let qx = px, qy = py;
    if (c.rot) {
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
      qx = cx + (px - cx) * cos - (py - cy) * sin;
      qy = cy + (px - cx) * sin + (py - cy) * cos;
    }
    if (qx >= c.x && qx <= c.x + c.w && qy >= c.y && qy <= c.y + c.h) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  const i = pickPanel(e);
  if (i < 0) return;
  selectedPanel = i;
  drag = { x: e.clientX, y: e.clientY, slot: { ...state.slots[i] } };
  canvas.setPointerCapture(e.pointerId);
  document.getElementById('zoom').value = String(state.slots[i].zoom);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const slot = state.slots[selectedPanel];
  slot.dx = drag.slot.dx + ((e.clientX - drag.x) / rect.width);
  slot.dy = drag.slot.dy + ((e.clientY - drag.y) / rect.height);
  slot.dx = Math.max(-0.6, Math.min(0.6, slot.dx));
  slot.dy = Math.max(-0.6, Math.min(0.6, slot.dy));
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  drag = null;
  pushHistory();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = state.slots[selectedPanel];
  slot.zoom = Math.max(1, Math.min(3, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  document.getElementById('zoom').value = String(slot.zoom);
  redraw();
}, { passive: false });

document.getElementById('upload').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    const img = await loadImage(URL.createObjectURL(file));
    addPhoto(img, file.name);
  }
  pushHistory(); redraw();
  setStatus(`${e.target.files.length} photo(s) loaded — click a panel, then a photo to place it.`);
});
document.getElementById('samples').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-sample]');
  if (!b) return;
  const sample = SAMPLE_PHOTOS.find((s) => s.file === b.dataset.sample);
  if (!sample) return;
  addPhoto(await loadImage(`samples/${sample.file}`), sample.file, sample.label, sample.face);
  pushHistory(); redraw(); setStatus(`Sample photo: ${sample.label.toLowerCase()}.`);
});

document.getElementById('layouts').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-layout]');
  if (!b) return;
  state.layout = b.dataset.layout;
  selectedPanel = 0;
  pushHistory(); redraw();
  setStatus(`Layout: ${COVER_LAYOUTS[state.layout].name}.`);
});
document.getElementById('grades').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-grade]');
  if (!b) return;
  state.grade = b.dataset.grade;
  pushHistory(); redraw();
  setStatus(`Grade: ${COVER_GRADES[state.grade].name}.`);
});
document.getElementById('titleStyles').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-title-style]');
  if (!b) return;
  state.titleStyle = b.dataset.titleStyle;
  pushHistory(); redraw();
  setStatus(`Title style: ${TITLE_STYLES[state.titleStyle].name}.`);
});
document.getElementById('sizes').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-size]');
  if (!b) return;
  state.size = b.dataset.size;
  pushHistory(); redraw();
  setStatus(`Size: ${state.size.replace('x', ' × ')} px.`);
});
document.getElementById('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
document.getElementById('title').addEventListener('change', pushHistory);
document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('subtitle').addEventListener('change', pushHistory);
document.getElementById('subtitleColor').addEventListener('input', (e) => { state.subtitleColor = e.target.value; redraw(); });
document.getElementById('subtitleColor').addEventListener('change', pushHistory);
document.getElementById('heat').addEventListener('change', (e) => {
  state.heat = Number(e.target.value);
  pushHistory(); redraw();
});
document.getElementById('strip').addEventListener('change', (e) => {
  state.strip = e.target.checked;
  pushHistory(); redraw();
});
document.getElementById('showLabels').addEventListener('change', (e) => {
  state.showLabels = e.target.checked;
  pushHistory(); redraw();
});
document.getElementById('showSeal').addEventListener('change', (e) => {
  state.showSeal = e.target.checked;
  pushHistory(); redraw();
});
document.getElementById('panelLabelInput').addEventListener('input', (e) => {
  state.slots[selectedPanel].label = e.target.value;
  redraw();
});
document.getElementById('panelLabelInput').addEventListener('change', pushHistory);
for (const [key, el] of [['brightness', 'brightness'], ['contrast', 'contrast'], ['glow', 'glow']]) {
  document.getElementById(el).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    document.getElementById(`${el}Val`).textContent = key === 'glow'
      ? `${Math.round(state[key] * 100)}%`
      : `${state[key].toFixed(2)}×`;
    redraw();
  });
  document.getElementById(el).addEventListener('change', pushHistory);
}
document.getElementById('zoom').addEventListener('input', (e) => {
  state.slots[selectedPanel].zoom = Number(e.target.value);
  redraw();
});
document.getElementById('zoom').addEventListener('change', pushHistory);
document.getElementById('reset-crop').addEventListener('click', () => {
  const s = state.slots[selectedPanel];
  s.zoom = 1; s.dx = 0; s.dy = 0;
  document.getElementById('zoom').value = '1';
  pushHistory(); redraw();
});
document.getElementById('undo').addEventListener('click', () => { if (historyIndex > 0) applyHistory(historyIndex - 1); });
document.getElementById('redo').addEventListener('click', () => { if (historyIndex < history.length - 1) applyHistory(historyIndex + 1); });
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); if (historyIndex > 0) applyHistory(historyIndex - 1); }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); if (historyIndex < history.length - 1) applyHistory(historyIndex + 1); }
});

function slug(text) {
  return (text || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
}
function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

document.getElementById('export').addEventListener('click', async () => {
  const blob = await exportCoverPNG(renderState(), state.size);
  downloadBlob(blob, `cover-${slug(state.title)}-${state.size}.png`);
  setStatus(`Exported cover-${slug(state.title)}-${state.size}.png — ${state.size.replace('x', ' × ')} px.`);
});
document.getElementById('export-all').addEventListener('click', async () => {
  for (const sizeKey of Object.keys(COVER_SIZES)) {
    const blob = await exportCoverPNG(renderState(), sizeKey);
    downloadBlob(blob, `cover-${slug(state.title)}-${sizeKey}.png`);
    await new Promise((r) => setTimeout(r, 350));
  }
  setStatus('Exported all 3 sizes: 1080×1080, 1080×1350, 1920×1080.');
});

/** Loads the six sample photos and fills the panels, first run only. */
export async function loadSamples() {
  if (photos.length > 0) return;
  for (const s of SAMPLE_PHOTOS) {
    const img = await loadImage(`samples/${s.file}`);
    addPhoto(img, s.file, s.label, s.face);
  }
  state.slots.forEach((slot, i) => {
    slot.photoId = photos[i % photos.length].id;
    slot.label = photos[i % photos.length].label;
  });
  renderTray();
}

async function init() {
  await Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('40px Pacifico'),
  ]).catch(() => {});
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      state, loadSamples, loadImage, addPhoto, redraw, pushHistory, syncControls,
      photoIdByName: (name) => photos.find((p) => p.name.startsWith(name))?.id ?? null,
    });
  } else {
    await loadSamples();
    syncControls();
    pushHistory();
    setStatus('Six sample photos loaded. Upload your own, pick a layout, export a PNG.');
  }
  await document.fonts.ready;
  redraw();
}

init();
