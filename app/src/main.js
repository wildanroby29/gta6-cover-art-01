// Neon Vice Cover Studio editor: photos, layouts, grades, caption, sizes,
// export. State lives here; cover.js draws it. Undo/redo keeps a history of
// the settings (photos themselves are not part of a history step).
import { renderCover, exportCoverPNG, COVER_SIZES, COVER_GRADES, COVER_LAYOUTS, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const trayEl = document.getElementById('tray');
const SAMPLE_LABELS = { boulevard: 'golden hour', pier: 'pier pressure' };

let photos = []; // {id, name, label, img}
let photoSeq = 0;
let selectedPanel = 0;
let drag = null;

const state = {
  layout: 'hero-three',
  grade: 'vice-sunset',
  size: '1080x1080',
  title: 'Neon Shore',
  subtitle: 'a vice city story',
  heat: 4,
  strip: true,
  slots: Array.from({ length: 9 }, () => ({ photoId: null, zoom: 1, dx: 0, dy: 0 })),
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
    title: state.title, subtitle: state.subtitle, heat: state.heat,
    strip: state.strip, slots: state.slots,
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

/** Resolves photo ids to images for the renderer. */
function renderState() {
  return {
    layout: state.layout, grade: state.grade, title: state.title,
    subtitle: state.subtitle, heat: state.heat, strip: state.strip,
    slots: state.slots.map((s) => {
      const p = photoById(s.photoId);
      return { photo: p?.img ?? null, zoom: s.zoom, dx: s.dx, dy: s.dy, caption: p?.label ?? '' };
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
  const cells = layoutPanels(state.layout, canvas.width, canvas.height, state.strip).cells.length;
  document.getElementById('panelLabel').textContent = `Panel ${Math.min(selectedPanel + 1, cells)} of ${cells}`;
}

function syncControls() {
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('heat').value = String(state.heat);
  document.getElementById('strip').checked = state.strip;
  document.getElementById('zoom').value = String(state.slots[selectedPanel].zoom);
  redraw();
}

function setStatus(text) { statusEl.textContent = text; }

/** Adds a loaded photo to the tray and fills empty panel slots with it. */
function addPhoto(img, name, label) {
  const id = `p${++photoSeq}`;
  photos.push({ id, name, label: label ?? name.replace(/\.[^.]+$/, '').slice(0, 18), img });
  const empty = state.slots.find((s) => !s.photoId);
  if (empty) empty.photoId = id;
  renderTray();
  return id;
}

function renderTray() {
  trayEl.innerHTML = '';
  photos.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = p.name;
    const thumb = document.createElement('canvas');
    thumb.width = 96; thumb.height = 96;
    const tctx = thumb.getContext('2d');
    const s = Math.max(96 / p.img.naturalWidth, 96 / p.img.naturalHeight);
    tctx.drawImage(p.img, (96 - p.img.naturalWidth * s) / 2, (96 - p.img.naturalHeight * s) / 2, p.img.naturalWidth * s, p.img.naturalHeight * s);
    b.appendChild(thumb);
    const used = state.slots.some((s) => s.photoId === p.id);
    if (used) b.classList.add('used');
    b.addEventListener('click', () => {
      state.slots[selectedPanel].photoId = p.id;
      pushHistory(); redraw(); renderTray();
      setStatus(`${p.name} → panel ${selectedPanel + 1}`);
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
document.getElementById('sample-boulevard').addEventListener('click', async () => {
  addPhoto(await loadImage('samples/boulevard.jpg'), 'boulevard.jpg', SAMPLE_LABELS.boulevard);
  pushHistory(); redraw(); setStatus('Sample photo: golden-hour boulevard.');
});
document.getElementById('sample-pier').addEventListener('click', async () => {
  addPhoto(await loadImage('samples/pier.jpg'), 'pier.jpg', SAMPLE_LABELS.pier);
  pushHistory(); redraw(); setStatus('Sample photo: pier pressure.');
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
document.getElementById('heat').addEventListener('change', (e) => {
  state.heat = Number(e.target.value);
  pushHistory(); redraw();
});
document.getElementById('strip').addEventListener('change', (e) => {
  state.strip = e.target.checked;
  pushHistory(); redraw();
});
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

/** Loads the two sample photos and fills the panels, first run only. */
export async function loadSamples() {
  if (photos.length > 0) return;
  const b = await loadImage('samples/boulevard.jpg');
  const p = await loadImage('samples/pier.jpg');
  addPhoto(b, 'boulevard.jpg', SAMPLE_LABELS.boulevard);
  addPhoto(p, 'pier.jpg', SAMPLE_LABELS.pier);
  state.slots[0].photoId = photos[0].id;
  state.slots[1].photoId = photos[1].id;
  state.slots[2].photoId = photos[0].id;
  state.slots[3].photoId = photos[1].id;
  state.slots[4].photoId = photos[0].id;
  state.slots[5].photoId = photos[1].id;
  state.slots[6].photoId = photos[0].id;
  state.slots[7].photoId = photos[1].id;
  state.slots[8].photoId = photos[0].id;
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
    setStatus('Two sample photos loaded. Upload your own, pick a layout, export a PNG.');
  }
  await document.fonts.ready;
  redraw();
}

init();
