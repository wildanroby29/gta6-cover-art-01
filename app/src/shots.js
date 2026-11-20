// Fixed scenes for screenshots: ?shot=cover shows one exported cover alone at
// its export size; ?shot=editor shows the editor with sample photos loaded.
// The default cover matches the reference mockup: diverse scenes (sunset
// beach, neon palm street, pink sports car, a person) with the giant 3D
// title in its pink-neon-framed block at the bottom.
// Query params: layout, grade, size (1080x1080|1080x1350|1920x1080), title,
// subtitle, subtitleColor, titleStyle (chrome-3d|gold-3d|flat), heat (0-5),
// strip (0|1), labels (0|1), seal (0|1), brightness, contrast, glow,
// photos (comma list of sample names, cycled across panels).
// window.__shotReady is set once painted, after the fonts are in.
export async function runShot(shot, query, api) {
  const { state, loadSamples, redraw, pushHistory, syncControls } = api;
  await loadSamples();
  const get = (k, d) => query.get(k) ?? d;
  state.layout = get('layout', 'four-panel');
  state.grade = get('grade', 'neon-night');
  state.size = get('size', '1920x1080');
  state.title = get('title', 'Last Call');
  state.subtitle = get('subtitle', 'Neon Avenue');
  state.subtitleColor = get('subtitleColor', '#ff5ce1');
  state.titleStyle = get('titleStyle', 'chrome-3d');
  state.heat = Number(get('heat', '4'));
  state.strip = get('strip', '1') !== '0';
  state.showLabels = get('labels', '1') !== '0';
  state.showSeal = get('seal', '1') !== '0';
  state.brightness = Number(get('brightness', '1'));
  state.contrast = Number(get('contrast', '1'));
  state.glow = Number(get('glow', '0.7'));
  const photoNames = (get('photos', 'beach,street,car,boulevard') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const photoIds = photoNames.map((name) => api.photoIdByName(name)).filter(Boolean);
  const fallback = api.photoIdByName('beach');
  const labels = {
    beach: 'THE SHORE', street: 'THE STRIP', car: 'THE RIDE',
    mechanic: 'THE MECHANIC', courier: 'THE COURIER', insider: 'THE INSIDER',
    boss: 'THE BOSS', boulevard: 'THE CREW', pier: 'THE ANGLER',
  };
  state.slots.forEach((s, i) => {
    const name = photoNames[i % photoNames.length] ?? 'mechanic';
    s.photoId = photoIds[i % photoIds.length] ?? fallback;
    s.label = labels[name] ?? '';
  });
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
