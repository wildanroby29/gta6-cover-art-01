// Neon Vice cover renderer: draws a GTA-style multi-panel poster cover on a 2D
// canvas, from any photos and a caption. All art is drawn here — inked panel
// frames, a halftone title block, neon script, palm and skyline silhouettes,
// a retro sun, grain and vignette — no external images, no network.
//
// Layouts: four-panel grid, hero-and-three, full-bleed, tilted snapshots,
// nine-panel grid, triptych. Grades: gradient-map colour grades applied per
// panel. Sizes: 1080x1080, 1080x1350, 1920x1080.

export const COVER_SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const COVER_GRADES = {
  'vice-sunset': { name: 'Vice Sunset', filter: 'saturate(1.3) contrast(1.1)', top: '#ff9a3d', bottom: '#ff2d78', wash: 'rgba(255,110,60,0.12)' },
  'neon-night': { name: 'Neon Night', filter: 'saturate(1.5) contrast(1.15) brightness(0.95)', top: '#00e5ff', bottom: '#ff2ec4', wash: 'rgba(40,0,80,0.18)' },
  'golden-hour': { name: 'Golden Hour', filter: 'saturate(1.35) contrast(1.05) brightness(1.05)', top: '#ffd76a', bottom: '#ff7b2f', wash: 'rgba(255,180,60,0.15)' },
  'miami-teal': { name: 'Miami Teal', filter: 'saturate(1.2) contrast(1.1)', top: '#00c2a8', bottom: '#0057ff', wash: 'rgba(0,120,140,0.12)' },
  'noir-pop': { name: 'Noir Pop', filter: 'grayscale(0.9) contrast(1.35)', top: '#ffffff', bottom: '#ff2d78', wash: 'rgba(255,45,120,0.10)' },
  'palm-dusk': { name: 'Palm Dusk', filter: 'saturate(1.25) contrast(1.08) brightness(0.97)', top: '#7b2ff7', bottom: '#ff5e62', wash: 'rgba(90,0,140,0.15)' },
};

export const COVER_LAYOUTS = {
  'four-panel': { name: 'Four-Panel Grid', cells: 4 },
  'hero-three': { name: 'Hero and Three', cells: 4 },
  'full-bleed': { name: 'Full-Bleed', cells: 1 },
  'tilted': { name: 'Tilted Snapshots', cells: 3 },
  'nine-panel': { name: 'Nine-Panel Grid', cells: 9 },
  'triptych': { name: 'Triptych', cells: 3 },
};

let grainPattern = null;

/** Builds a 128x128 noise pattern once, reused for the grain pass. */
function getGrainPattern(ctx) {
  if (grainPattern) return grainPattern;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 100 + Math.floor(Math.random() * 80);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(c, 'repeat');
  return grainPattern;
}

/** Cover-fits `img` into `rect` with a zoom and pan, then grades it.
 *  `bias` is the fraction of the vertical excess used to push the crop
 *  window toward the top of the photo (where faces are): 0 centres it,
 *  0.5 anchors it to the photo's top edge. The default 0.18 suits most
 *  panels, but short wide strips need more — see renderCover. */
export function paintPanelPhoto(ctx, img, rect, slot, grade, bias = 0.18) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const base = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const zoom = (slot?.zoom ?? 1) * base;
    const pw = img.naturalWidth * zoom;
    const ph = img.naturalHeight * zoom;
    const dx = (slot?.dx ?? 0) * w;
    const dy = (slot?.dy ?? 0) * h;
    // Cover-fit crops the photo: bias the window toward the top of the
    // photo (where faces are) by `bias` of the vertical excess, so a
    // portrait photo in a wide panel keeps its subject's head in frame.
    // A positive offset draws the photo lower, showing more of its top.
    const topBias = ph > h ? bias * (ph - h) : 0;
    ctx.filter = grade.filter;
    ctx.drawImage(img, x + (w - pw) / 2 + dx, y + (h - ph) / 2 + dy + topBias, pw, ph);
    ctx.filter = 'none';
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#3a2b4d'); g.addColorStop(1, '#1c1030');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  const over = ctx.createLinearGradient(x, y, x + w * 0.25, y + h);
  over.addColorStop(0, grade.top);
  over.addColorStop(1, grade.bottom);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = over;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 1;
  ctx.fillStyle = grade.wash;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Thick black ink border plus a thin white keyline around a panel. */
export function drawInkedFrame(ctx, rect, scale) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.lineWidth = Math.max(3, scale * 0.011);
  ctx.strokeStyle = '#0d0a12';
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = Math.max(1, scale * 0.002);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  const inset = Math.max(3, scale * 0.011) + Math.max(2, scale * 0.004);
  ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
  ctx.restore();
}

/** A retro striped sun: a gradient disc with horizontal slits cut low down. */
export function drawRetroSun(ctx, cx, cy, r, top, bottom) {
  ctx.save();
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,8,32,0.9)';
  let y = cy + r * 0.05;
  let gap = r * 0.045;
  while (y < cy + r) {
    ctx.fillRect(cx - r - 2, y, r * 2 + 4, gap);
    y += gap + r * 0.16;
    gap *= 1.5;
  }
  ctx.restore();
}

/** A palm tree silhouette: curved trunk, fanning fronds. */
export function drawPalmSilhouette(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineCap = 'round';
  const topX = x + s * 0.18, topY = y - s;
  ctx.lineWidth = s * 0.055;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.05, y - s * 0.55, topX, topY);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (-160 + i * 23) * Math.PI / 180;
    const tx = topX + Math.cos(a) * s * 0.62;
    const ty = topY + Math.sin(a) * s * 0.42 + s * 0.1;
    const mx = topX + Math.cos(a) * s * 0.34;
    const my = topY + Math.sin(a) * s * 0.3 - s * 0.08;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.quadraticCurveTo(mx + Math.cos(a + 0.5) * s * 0.2, my + s * 0.08, topX, topY);
    ctx.fill();
  }
  ctx.restore();
}

/** A city skyline silhouette with lit windows, along a baseline. */
export function drawSkylineSilhouette(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  let bx = x;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (bx < x + w) {
    const bw = w * (0.05 + rnd() * 0.06);
    const bh = h * (0.35 + rnd() * 0.65);
    ctx.fillRect(bx, y - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,214,120,0.85)';
    for (let wy = y - bh + 4; wy < y - 6; wy += 9) {
      for (let wx = bx + 3; wx < bx + bw - 3; wx += 8) {
        if (rnd() > 0.55) ctx.fillRect(wx, wy, 2.5, 3.5);
      }
    }
    ctx.fillStyle = color;
    bx += bw + w * 0.012;
  }
  ctx.restore();
}

/** Halftone dot field inside a band: dot size swells toward the band centre. */
export function drawHalftoneField(ctx, rect, color) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.fillStyle = color;
  const step = Math.max(10, w * 0.018);
  for (let py = y + step / 2; py < y + h; py += step) {
    for (let px = x + step / 2; px < x + w; px += step) {
      const d = Math.hypot((px - (x + w / 2)) / (w / 2), (py - (y + h / 2)) / (h / 2));
      const r = Math.max(0.6, (1 - d) * step * 0.32);
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/** The title block: halftone field, gradient-filled Anton title with ink
 *  outline, neon Pacifico subtitle, heat stars. `zone` is {x,y,w,h}. */
export function drawTitleBlock(ctx, zone, title, subtitle, heat, scale) {
  const { x, y, w, h } = zone;
  ctx.save();
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, 'rgba(16,8,28,0.92)');
  bg.addColorStop(1, 'rgba(40,10,40,0.96)');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  drawHalftoneField(ctx, { x: x + w * 0.62, y, w: w * 0.38, h }, 'rgba(255,94,120,0.35)');
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const text = (title || 'UNTITLED').trim().toUpperCase();
  let size = h * 0.44;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  while (ctx.measureText(text).width > w * 0.88 && size > 10) {
    size -= 2;
    ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  }
  const ty = y + h * (subtitle ? 0.38 : 0.5);
  const grad = ctx.createLinearGradient(0, ty - size * 0.5, 0, ty + size * 0.55);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.55, '#ffe259'); grad.addColorStop(1, '#ff7e5f');
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = '#0d0a12';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x + w / 2, ty);
  ctx.fillStyle = grad;
  ctx.fillText(text, x + w / 2, ty);

  if (subtitle) {
    const ss = Math.max(12, h * 0.2);
    ctx.font = `${ss}px Pacifico, cursive`;
    ctx.fillStyle = '#ff5ce1';
    ctx.shadowColor = '#ff2ec4'; ctx.shadowBlur = ss * 0.7;
    ctx.fillText(subtitle, x + w / 2, y + h * 0.78);
    ctx.shadowBlur = 0;
  }
  if (heat > 0) {
    // On the subtitle's line, right-aligned, so it never crowds the title.
    const hs = Math.max(10, h * 0.13);
    ctx.font = `${hs}px Anton, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd76a';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < heat ? '★' : '☆';
    ctx.fillText(`HEAT ${stars}`, x + w - w * 0.03, y + h * 0.78);
    ctx.textAlign = 'center';
  }
  ctx.restore();
}

/** A thin bottom story strip: small caps text on black. */
export function drawStoryStrip(ctx, w, h, title, subtitle) {
  const sh = h * 0.045;
  const y = h - sh;
  ctx.save();
  ctx.fillStyle = '#0d0a12';
  ctx.fillRect(0, y, w, sh);
  ctx.fillStyle = '#ffd76a';
  ctx.font = `${Math.max(9, sh * 0.42)}px Anton, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const line = `★ ${(title || 'UNTITLED').toUpperCase()} — ${(subtitle || 'a vice city story').toUpperCase()} — EST. 2026 ★`;
  ctx.fillText(line, w / 2, y + sh / 2);
  ctx.restore();
  return sh;
}

/** A circular star badge, e.g. top-right of the cover. */
export function drawBadgeRibbon(ctx, cx, cy, r, label) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  ctx.fillStyle = '#ff2d78';
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.82;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d0a12';
  ctx.font = `${r * 0.42}px Anton, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', 0, -r * 0.2);
  ctx.font = `${r * 0.2}px Anton, sans-serif`;
  ctx.fillText(label, 0, r * 0.28);
  ctx.restore();
}

/** Panel rectangles for a layout, as fractions of the canvas. Title band
 *  sits at the bottom except for `tilted`, where it sits at the top. */
export function layoutPanels(layout, w, h, strip) {
  const m = 0.02 * w;
  const g = 0.012 * w;
  const tb = 0.26 * h;
  const sh = strip ? 0.045 * h : 0;
  const cells = [];
  if (layout === 'tilted') {
    const bandH = 0.2 * h;
    const pw = 0.34 * w, ph = pw * 1.22;
    const cy = bandH + (h - sh - bandH - ph) / 2;
    const rots = [-0.1, 0.05, -0.035];
    const xs = [0.06 * w, 0.33 * w, 0.6 * w];
    for (let i = 0; i < 3; i++) {
      cells.push({ x: xs[i], y: cy, w: pw, h: ph, rot: rots[i], polaroid: true });
    }
    return { cells, title: { x: 0, y: 0, w, h: bandH }, band: 'top', stripH: sh };
  }
  const content = { x: m, y: m, w: w - 2 * m, h: h - tb - sh - m };
  const grid = (cols, rows) => {
    const cw = (content.w - g * (cols - 1)) / cols;
    const ch = (content.h - g * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ x: content.x + c * (cw + g), y: content.y + r * (ch + g), w: cw, h: ch, rot: 0 });
      }
    }
  };
  if (layout === 'four-panel') grid(2, 2);
  else if (layout === 'nine-panel') grid(3, 3);
  else if (layout === 'triptych') grid(3, 1);
  else if (layout === 'hero-three') {
    const hw = content.w * 0.6;
    cells.push({ x: content.x, y: content.y, w: hw, h: content.h, rot: 0 });
    const sw = content.w - hw - g;
    const sh3 = (content.h - 2 * g) / 3;
    for (let i = 0; i < 3; i++) {
      cells.push({ x: content.x + hw + g, y: content.y + i * (sh3 + g), w: sw, h: sh3, rot: 0 });
    }
  } else { // full-bleed
    cells.push({ x: 0, y: 0, w, h: h - tb - sh, rot: 0 });
  }
  return { cells, title: { x: 0, y: h - tb - sh, w, h: tb }, band: 'bottom', stripH: sh };
}

/** Draws one photo panel (polaroid or inked frame) at its layout cell. */
function drawPanel(ctx, cell, slot, grade, scale, bias = 0.18) {
  ctx.save();
  if (cell.rot) {
    ctx.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
    ctx.rotate(cell.rot);
    ctx.translate(-cell.w / 2, -cell.h / 2);
  }
  if (cell.polaroid) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = scale * 0.02; ctx.shadowOffsetY = scale * 0.008;
    ctx.fillStyle = '#fdfbf6';
    ctx.fillRect(0, 0, cell.w, cell.h);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const photoRect = { x: cell.w * 0.045, y: cell.h * 0.04, w: cell.w * 0.91, h: cell.h * 0.78 };
    paintPanelPhoto(ctx, slot?.photo ?? null, photoRect, slot, grade, bias);
    ctx.fillStyle = '#221a2e';
    ctx.font = `${Math.max(10, cell.w * 0.055)}px Pacifico, cursive`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(slot?.caption ?? 'golden hour', cell.w / 2, cell.h * 0.9);
  } else {
    paintPanelPhoto(ctx, slot?.photo ?? null, { x: cell.x, y: cell.y, w: cell.w, h: cell.h }, slot, grade, bias);
    drawInkedFrame(ctx, { x: cell.x, y: cell.y, w: cell.w, h: cell.h }, scale);
  }
  ctx.restore();
}

/** The main entry: draws the whole cover onto `canvas` from `state`. */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const scale = Math.min(w, h);
  const grade = COVER_GRADES[state.grade] ?? COVER_GRADES['vice-sunset'];
  const strip = !!state.strip;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, w, h);

  const { cells, title, band, stripH } = layoutPanels(state.layout, w, h, strip);

  if (state.layout === 'tilted') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2b1055'); sky.addColorStop(0.45, '#ff5e62'); sky.addColorStop(0.75, '#ff9966'); sky.addColorStop(1, '#2b1055');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    drawRetroSun(ctx, w * 0.5, h * 0.52, Math.min(w, h) * 0.26, '#ffd76a', '#ff2d78');
    drawSkylineSilhouette(ctx, 0, h * 0.62, w, h * 0.1, '#1c0b2e');
    drawPalmSilhouette(ctx, w * 0.03, h * 0.94, h * 0.22, '#12081f');
    drawPalmSilhouette(ctx, w * 0.9, h * 0.94, h * 0.17, '#12081f');
  }

  cells.forEach((cell, i) => {
    const slot = state.slots[i] ?? { photo: null, zoom: 1, dx: 0, dy: 0 };
    // Hero-and-three's side strips are short and wide (about 3.2:1), so
    // their crop window is only a thin slice of the photo's height. The
    // default 0.18 bias still starts that slice below the face, leaving
    // only a chin. A 0.42 bias centres the slice on the face zone (the
    // top fifth of the photo), keeping eyes, nose, mouth and chin in
    // frame. Every other layout keeps the default bias.
    const bias = (state.layout === 'hero-three' && i > 0) ? 0.42 : 0.18;
    drawPanel(ctx, cell, slot, grade, scale, bias);
  });

  if (state.layout === 'full-bleed') {
    const scrim = ctx.createLinearGradient(0, h - title.h - h * 0.12, 0, h);
    scrim.addColorStop(0, 'rgba(10,4,20,0)');
    scrim.addColorStop(1, 'rgba(10,4,20,0.75)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h - title.h - h * 0.12, w, title.h + h * 0.12);
  }
  drawTitleBlock(ctx, title, state.title, state.subtitle, state.heat, scale);

  const badgeR = Math.min(w, h) * 0.04;
  if (band === 'bottom') drawBadgeRibbon(ctx, w - badgeR * 1.25, badgeR * 1.35, badgeR, '2026');
  else drawBadgeRibbon(ctx, w - badgeR * 1.25, h - stripH - badgeR * 1.35, badgeR, '2026');

  if (strip) drawStoryStrip(ctx, w, h, state.title, state.subtitle);

  // Grain + vignette finish.
  const grain = getGrainPattern(ctx);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grain;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** Renders the cover at an exact export size and returns a PNG blob. */
export function exportCoverPNG(state, sizeKey) {
  const [sw, sh] = COVER_SIZES[sizeKey] ?? COVER_SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = sw; canvas.height = sh;
  renderCover(canvas, state);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
