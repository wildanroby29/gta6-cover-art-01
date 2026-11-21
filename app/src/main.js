// Vice City Cover Studio editor (recorded Vice City Cast build, 2026-11-20).
// State lives here; cover.js draws it. Photos: the seven-person demo cast
// plus anything the user uploads. Every edit pushes an undo step; exports
// render the same cover the preview shows, at full export size.
import { renderCover, exportCoverPNG, COVER_SIZES, CAST, BILLING_DEFAULT, layoutPanels, applySinglePhotoCrops } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const trayEl = document.getElementById('tray');
const panelTitleEl = document.getElementById('panelTitle');
const zoomEl = document.getElementById('zoom');

const photos = new Map(); // id -> {id, name, label, img, faceX, faceY}
let photoSeq = 0;

const state = {
  layout: 'six-grid',
  grade: 'sunset-gold',
  size: '1920x1080',
  title: 'Vice City',
  subtitle: 'Neon Nights',
  ribbon: 'NEON • SUNSET • 1987 — YOUR STORY, YOUR CITY',
  quote: 'THE HOTTEST CREW OF THE YEAR',
  quoteSource: 'VICE CITY GAZETTE',
  billing: BILLING_DEFAULT,
  seal: 'BEST CREW',
  sealRing: 'VICE CITY FILM FESTIVAL',
  release: 'COMING SOON',
  edition: 'VOL. 1',
  showLabels: true,
  showSeal: true,
  heat: 5,
  selected: 0,
  slots: CAST.map((c) => ({ photoId: c.id, zoom: 1, ox: 0, oy: 0, flip: false, label: c.role })),
};

let history = [];
let historyIndex = -1;

function snapshot() { return JSON.stringify(state); }
function pushHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot());
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  syncUndoButtons();
}
function restoreSnapshot(json) {
  const next = JSON.parse(json);
  Object.assign(state, next);
  syncControls();
  redraw();
}
function undo() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restoreSnapshot(history[historyIndex]);
  syncUndoButtons();
}
function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  restoreSnapshot(history[historyIndex]);
  syncUndoButtons();
}
function syncUndoButtons() {
  document.getElementById('undo').disabled = historyIndex <= 0;
  document.getElementById('redo').disabled = historyIndex >= history.length - 1;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSamples() {
  if (photos.size > 0) return;
  for (const c of CAST) {
    const img = await loadImage(`./samples/${c.file}`);
    photos.set(c.id, { id: c.id, name: c.file, label: c.role, img, faceX: c.faceX, faceY: c.faceY });
  }
  buildTray();
}

function buildTray() {
  trayEl.innerHTML = '';
  CAST.forEach((c, i) => {
    const photo = photos.get(c.id);
    if (!photo) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `thumb${i === 0 ? ' hero' : ''}`;
    b.title = `${c.role} — click to fill the selected panel`;
    b.dataset.photoId = c.id;
    const img = document.createElement('img');
    img.src = `./samples/${c.file}`;
    img.alt = c.role;
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(i + 1);
    b.append(img, num);
    b.addEventListener('click', () => {
      assignPhotoToSelected(c.id);
      pushHistory();
    });
    trayEl.appendChild(b);
  });
  syncTrayUsed();
}

function syncTrayUsed() {
  const used = new Set(state.slots.map((s) => s.photoId));
  trayEl.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('used', used.has(t.dataset.photoId)));
}

function assignPhotoToSelected(photoId) {
  const slot = state.slots[state.selected];
  const photo = photos.get(photoId);
  if (!slot || !photo) return;
  slot.photoId = photoId;
  slot.label = photo.label || '';
  slot.zoom = 1; slot.ox = 0; slot.oy = 0; slot.flip = false;
  syncTrayUsed();
  redraw();
}

function redraw() {
  // Editor badges and the selection outline only in the editor, never on
  // an exported cover or a cover screenshot.
  const editorMode = !document.body.classList.contains('shot-cover');
  renderCover(canvas, state, photos, { editor: editorMode });
  const slot = state.slots[state.selected];
  const photo = slot ? photos.get(slot.photoId) : null;
  panelTitleEl.textContent = `PANEL ${state.selected + 1} — ${slot ? (slot.label || (photo && photo.label) || 'EMPTY') : '—'}`;
  if (slot) zoomEl.value = String(slot.zoom);
  fitCanvasCss();
}

// The canvas keeps its export-size bitmap; CSS only scales it to the stage.
function fitCanvasCss() {
  // max-width / max-height in the stylesheet do the work; nothing to do here.
}

function syncControls() {
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
  set('title', state.title);
  set('subtitle', state.subtitle);
  set('ribbon', state.ribbon);
  set('quote', state.quote);
  set('quoteSource', state.quoteSource);
  set('billing', state.billing);
  set('seal', state.seal);
  set('sealRing', state.sealRing);
  set('release', state.release);
  set('edition', state.edition);
  const showLabels = document.getElementById('showLabels');
  if (showLabels) showLabels.checked = state.showLabels !== false;
  const showSeal = document.getElementById('showSeal');
  if (showSeal) showSeal.checked = state.showSeal !== false;
  document.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades button').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  syncTrayUsed();
}

function photoIdByName(name) {
  const key = String(name).trim().toLowerCase().replace(/\.jpg$/, '');
  if (photos.has(key)) return key;
  for (const [id, p] of photos) {
    if (p.name.toLowerCase().replace(/\.jpg$/, '') === key) return id;
  }
  return null;
}

function setStatus(text) {
  statusEl.textContent = text;
  window.clearTimeout(setStatus._t);
  setStatus._t = window.setTimeout(() => { statusEl.textContent = ''; }, 4000);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportOne(sizeKey) {
  const blob = await exportCoverPNG(sizeKey, state, photos);
  if (!blob) throw new Error('export failed');
  downloadBlob(blob, `vice-city-cover-${sizeKey}.png`);
  return blob;
}

// ---- Wiring ----
function bindButtonGroup(selector, onPick) {
  document.querySelectorAll(selector).forEach((b) => {
    b.addEventListener('click', () => {
      onPick(b);
      pushHistory();
    });
  });
}

bindButtonGroup('#layouts button', (b) => { state.layout = b.dataset.layout; redraw(); });
bindButtonGroup('#grades button', (b) => { state.grade = b.dataset.grade; redraw(); });
bindButtonGroup('[data-size]', (b) => { state.size = b.dataset.size; syncControls(); redraw(); });

const textFields = ['title', 'subtitle', 'ribbon', 'quote', 'quoteSource', 'billing', 'seal', 'sealRing', 'release', 'edition'];
for (const field of textFields) {
  const el = document.getElementById(field);
  el.addEventListener('input', () => {
    state[field] = el.value;
    redraw();
  });
  el.addEventListener('change', () => pushHistory());
}
document.getElementById('showLabels').addEventListener('change', (e) => {
  state.showLabels = e.target.checked;
  redraw();
  pushHistory();
});
document.getElementById('showSeal').addEventListener('change', (e) => {
  state.showSeal = e.target.checked;
  redraw();
  pushHistory();
});

document.getElementById('photoPrev').addEventListener('click', () => {
  cyclePhoto(-1);
  pushHistory();
});
document.getElementById('photoNext').addEventListener('click', () => {
  cyclePhoto(1);
  pushHistory();
});
document.getElementById('flip').addEventListener('click', () => {
  const slot = state.slots[state.selected];
  slot.flip = !slot.flip;
  redraw();
  pushHistory();
});
document.getElementById('resetCrop').addEventListener('click', () => {
  const slot = state.slots[state.selected];
  slot.zoom = 1; slot.ox = 0; slot.oy = 0; slot.flip = false;
  redraw();
  pushHistory();
});
document.getElementById('autofill').addEventListener('click', () => {
  const ids = [...photos.keys()];
  if (ids.length === 1) {
    // One photo only: crop it into several different windows (centre,
    // left, right, zoomed face, wide) so the poster is full.
    const photo = photos.get(ids[0]);
    applySinglePhotoCrops(state.slots, ids[0], photo ? photo.label : '');
  } else {
    state.slots.forEach((slot, i) => {
      slot.photoId = ids[i % ids.length];
      const photo = photos.get(slot.photoId);
      slot.label = photo ? photo.label : '';
      slot.zoom = 1; slot.ox = 0; slot.oy = 0; slot.flip = false;
    });
  }
  syncTrayUsed();
  redraw();
  pushHistory();
});
document.getElementById('shuffle').addEventListener('click', () => {
  const layouts = ['hero-mosaic', 'diagonal-strips', 'six-grid'];
  const grades = ['sunset-gold', 'neon-night', 'tropic-teal', 'ultraviolet', 'retro-print'];
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  const ids = [...photos.keys()];
  if (ids.length === 1) {
    const photo = photos.get(ids[0]);
    applySinglePhotoCrops(state.slots, ids[0], photo ? photo.label : '');
  } else {
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    state.slots.forEach((slot, i) => {
      slot.photoId = shuffled[i % shuffled.length];
      const photo = photos.get(slot.photoId);
      slot.label = photo ? photo.label : '';
      slot.zoom = 1; slot.ox = 0; slot.oy = 0; slot.flip = false;
    });
  }
  syncControls();
  syncTrayUsed();
  redraw();
  pushHistory();
  setStatus('Shuffled — new layout, grade and photo order.');
});

zoomEl.addEventListener('input', () => {
  const slot = state.slots[state.selected];
  slot.zoom = Number(zoomEl.value);
  redraw();
});
zoomEl.addEventListener('change', () => pushHistory());

function cyclePhoto(dir) {
  const ids = [...photos.keys()];
  const slot = state.slots[state.selected];
  const i = ids.indexOf(slot.photoId);
  const next = ids[(i + dir + ids.length) % ids.length];
  assignPhotoToSelected(next);
}

document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.getElementById('settings').addEventListener('click', () => {
  setStatus('Everything is on this page — no settings needed.');
});
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
});

document.getElementById('export').addEventListener('click', async () => {
  try {
    await exportOne(state.size);
    setStatus(`Exported vice-city-cover-${state.size}.png`);
  } catch (err) {
    setStatus('Export failed — try again.');
  }
});
document.getElementById('export-all').addEventListener('click', async () => {
  try {
    for (const sizeKey of Object.keys(COVER_SIZES)) {
      await exportOne(sizeKey);
      await new Promise((r) => window.setTimeout(r, 400));
    }
    setStatus('Exported all 3 sizes.');
  } catch (err) {
    setStatus('Export failed — try again.');
  }
});

async function addFiles(files) {
  const images = [...files].filter((f) => f.type && f.type.startsWith('image/'));
  let lastId = null;
  for (const file of images) {
    const img = await loadImage(URL.createObjectURL(file));
    const id = `upload-${photoSeq++}`;
    const name = file.name.replace(/\.[^.]+$/, '');
    photos.set(id, { id, name, label: name.toUpperCase().slice(0, 18), img, faceX: 0.5, faceY: 0.35 });
    lastId = id;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = `${name} — click to fill the selected panel`;
    b.dataset.photoId = id;
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = name;
    b.appendChild(thumb);
    b.addEventListener('click', () => {
      assignPhotoToSelected(id);
      pushHistory();
    });
    trayEl.appendChild(b);
  }
  if (images.length > 0) {
    if (images.length === 1) {
      // One photo only: crop it into several windows so the poster is full.
      const photo = photos.get(lastId);
      applySinglePhotoCrops(state.slots, lastId, photo ? photo.label : '');
    } else {
      assignPhotoToSelected(lastId);
    }
    pushHistory();
    setStatus(`${images.length} photo${images.length > 1 ? 's' : ''} added — they never leave this device.`);
  }
  return images.length;
}

document.getElementById('upload').addEventListener('change', async (e) => {
  await addFiles(e.target.files);
  e.target.value = '';
});

// Drag-and-drop a photo anywhere on the stage to add it.
const stageEl = document.querySelector('.stage');
['dragover', 'dragenter'].forEach((ev) => stageEl.addEventListener(ev, (e) => {
  e.preventDefault();
  stageEl.classList.add('dropping');
}));
['dragleave', 'drop'].forEach((ev) => stageEl.addEventListener(ev, (e) => {
  e.preventDefault();
  stageEl.classList.remove('dropping');
}));
stageEl.addEventListener('drop', async (e) => {
  await addFiles(e.dataTransfer.files);
});

// ---- Canvas pointer: select, drag to pan, wheel to zoom, drag a number to swap ----
let drag = null;

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    scale: canvas.width / rect.width,
  };
}

function hitPanel(pt) {
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (pt.x >= p.x && pt.x <= p.x + p.w && pt.y >= p.y && pt.y <= p.y + p.h) return p;
  }
  return null;
}

function hitBadge(pt) {
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  for (const p of panels) {
    const r = Math.max(9, 0.011 * canvas.width);
    const cx = p.x + r + 0.006 * canvas.width, cy = p.y + r + 0.006 * canvas.height;
    if (Math.hypot(pt.x - cx, pt.y - cy) <= r + 4) return p;
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const badge = hitBadge(pt);
  if (badge) {
    drag = { kind: 'swap', from: badge.slot, x: pt.x, y: pt.y };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  const p = hitPanel(pt);
  if (!p) return;
  state.selected = p.slot;
  redraw();
  drag = { kind: 'pan', slot: p.slot, x: pt.x, y: pt.y, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  if (drag.kind === 'pan') {
    const slot = state.slots[drag.slot];
    const dx = pt.x - drag.x, dy = pt.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    slot.ox = Math.max(-400, Math.min(400, slot.ox + dx));
    slot.oy = Math.max(-400, Math.min(400, slot.oy + dy));
    drag.x = pt.x;
    drag.y = pt.y;
    redraw();
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  if (drag.kind === 'swap') {
    const pt = canvasPoint(e);
    const target = hitPanel(pt);
    if (target && target.slot !== drag.from) {
      const a = state.slots[drag.from], b = state.slots[target.slot];
      for (const key of ['photoId', 'label', 'zoom', 'ox', 'oy', 'flip']) {
        const tmp = a[key];
        a[key] = b[key];
        b[key] = tmp;
      }
      state.selected = target.slot;
      pushHistory();
      redraw();
    }
  } else if (drag.moved) {
    pushHistory();
  }
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = state.slots[state.selected];
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  slot.zoom = Math.max(1, Math.min(3, slot.zoom * factor));
  redraw();
}, { passive: false });

// ---- Boot ----
const api = { state, photos, loadSamples, redraw, pushHistory, syncControls, photoIdByName };

async function init() {
  await loadSamples();
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('100px Pacifico'),
      document.fonts.ready,
    ]);
  } catch (err) {
    // Fonts fall back to the system faces; the cover still draws.
  }
  syncControls();
  const query = new URLSearchParams(location.search);
  if (query.has('shot')) {
    await runShot(query.get('shot'), query, api);
  } else {
    redraw();
    pushHistory();
  }
}

init();
