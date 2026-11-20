// Fixed scenes for screenshots: ?shot=cover shows one exported cover alone at
// its export size; ?shot=editor shows the editor with sample photos loaded.
// Query params: layout, grade, size (1080x1080|1080x1350|1920x1080), title,
// subtitle, heat (0-5), strip (0|1), photo (boulevard|pier, the hero photo).
// window.__shotReady is set once painted, after the fonts are in.
export async function runShot(shot, query, api) {
  const { state, loadSamples, redraw, pushHistory, syncControls } = api;
  await loadSamples();
  const get = (k, d) => query.get(k) ?? d;
  state.layout = get('layout', 'hero-three');
  state.grade = get('grade', 'vice-sunset');
  state.size = get('size', '1920x1080');
  state.title = get('title', 'Neon Shore');
  state.subtitle = get('subtitle', 'a vice city story');
  state.heat = Number(get('heat', '4'));
  state.strip = get('strip', '1') !== '0';
  const hero = get('photo', 'boulevard');
  const other = hero === 'boulevard' ? 'pier' : 'boulevard';
  const heroId = api.photoIdByName(hero);
  const otherId = api.photoIdByName(other);
  state.slots.forEach((s, i) => { s.photoId = i % 2 === 0 ? heroId : otherId; });
  syncControls();
  pushHistory();
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    fitCoverCanvas();
    window.addEventListener('resize', fitCoverCanvas);
  }
  redraw();
  await document.fonts.ready;
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

/** Scales the cover canvas to fill the viewport without distortion. */
function fitCoverCanvas() {
  const canvas = document.getElementById('cover');
  const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
}
