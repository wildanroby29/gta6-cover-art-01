// Fixed scenes for screenshots: ?shot=cover shows one exported cover alone at
// its export size; ?shot=editor shows the editor with the demo cast loaded.
// The cover is the approved Vice City Cast look: seven cast portraits in a
// hero mosaic, solid-gold Anton title across the middle, Pacifico script
// subtitle, tagline ribbon, five stars and a quote, gold seal, billing that
// names only the fictional Vice City Pictures studio.
// Query params: layout, grade, size (1080x1080|1080x1350|1920x1080), title,
// subtitle, ribbon, quote, quoteSource, billing, seal, sealRing, release,
// edition, labels (0|1), seal (0|1), heat (0-5), photos (comma list of cast
// ids, in slot order). window.__shotReady is set once painted, after the
// fonts are in.
import { CAST, BILLING_DEFAULT, applySinglePhotoCrops } from './cover.js';

export async function runShot(shot, query, api) {
  const { state, loadSamples, redraw, pushHistory, syncControls } = api;
  await loadSamples();
  const get = (k, d) => query.get(k) ?? d;
  state.layout = get('layout', 'hero-mosaic');
  state.grade = get('grade', 'sunset-gold');
  state.size = get('size', '1920x1080');
  state.title = get('title', 'Vice City');
  state.subtitle = get('subtitle', 'Neon Nights');
  state.ribbon = get('ribbon', 'NEON • SUNSET • 1987 — YOUR STORY, YOUR CITY');
  state.quote = get('quote', 'THE HOTTEST CREW OF THE YEAR');
  state.quoteSource = get('quoteSource', 'VICE CITY GAZETTE');
  state.billing = get('billing', BILLING_DEFAULT);
  state.seal = get('seal', 'BEST CREW');
  state.sealRing = get('sealRing', 'VICE CITY FILM FESTIVAL');
  state.release = get('release', 'COMING SOON');
  state.edition = get('edition', 'VOL. 1');
  state.showLabels = get('labels', '1') !== '0';
  state.showSeal = get('seal', '1') !== '0';
  state.heat = Number(get('heat', '5'));
  state.selected = 0;
  const photoNames = (get('photos', CAST.map((c) => c.id).join(',')) || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const byId = new Map(CAST.map((c) => [c.id, c]));
  const unique = [...new Set(photoNames)];
  if (unique.length === 1) {
    // One photo only: crop it into several different windows per panel.
    const cast = byId.get(unique[0]) || CAST[0];
    applySinglePhotoCrops(state.slots, cast.id, cast.role);
  } else {
    state.slots.forEach((s, i) => {
      const cast = byId.get(photoNames[i % photoNames.length]) || CAST[i % CAST.length];
      s.photoId = cast.id;
      s.label = cast.role;
      s.zoom = 1; s.ox = 0; s.oy = 0; s.flip = false;
    });
  }
  syncControls();
  pushHistory();
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    window.addEventListener('resize', fitCoverCanvas);
  } else {
    document.body.classList.add('shot-editor');
  }
  redraw();
  // Fit AFTER the canvas is resized to its export size; fitting before
  // redraw used the previous canvas size and squeezed portrait/square covers.
  if (shot === 'cover') fitCoverCanvas();
  await document.fonts.ready;
  redraw();
  if (shot === 'cover') fitCoverCanvas();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

/** Scales the cover canvas to fill the viewport without distortion. */
function fitCoverCanvas() {
  const canvas = document.getElementById('cover');
  const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
}
