// Neon Chrome cover renderer: draws a GTA-style multi-panel poster cover on
// a 2D canvas, from any photos and a caption. All art is drawn here — the
// 3D chrome retro title (real layered extrusion, not flat text), neon script
// subtitle, character callout tags, gold "Original Cover Art" seal, inked
// panel frames, halftone title block, palm and skyline silhouettes, a retro
// sun, grain and vignette — no external images, no network.
//
// Layouts: four-panel grid, hero-and-three, full-bleed, tilted snapshots,
// nine-panel grid, triptych. Grades: gradient-map colour grades applied per
// panel, plus brightness / contrast / neon-glow sliders. Title styles:
// chrome-3d (default), gold-3d, flat. Sizes: 1080x1080, 1080x1350, 1920x1080.

export const COVER_SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const COVER_GRADES = {
  'vice-sunset': { name: 'Vice Sunset', filter: 'saturate(1.3) contrast(1.1)', top: '#ff9a3d', bottom: '#ff2d78', wash: 'rgba(255,110,60,0.12)' },
  'neon-night': { name: 'Neon Night', filter: 'saturate(1.55) contrast(1.18) brightness(0.95)', top: '#a855f7', bottom: '#ff2ec4', wash: 'rgba(60,0,110,0.20)' },
  'golden-hour': { name: 'Golden Hour', filter: 'saturate(1.35) contrast(1.05) brightness(1.05)', top: '#ffd76a', bottom: '#ff7b2f', wash: 'rgba(255,180,60,0.15)' },
  'miami-teal': { name: 'Miami Teal', filter: 'saturate(1.2) contrast(1.1)', top: '#00c2a8', bottom: '#0057ff', wash: 'rgba(0,120,140,0.12)' },
  'noir-pop': { name: 'Noir Pop', filter: 'grayscale(0.9) contrast(1.35)', top: '#ffffff', bottom: '#ff2d78', wash: 'rgba(255,45,120,0.10)' },
  'palm-dusk': { name: 'Palm Dusk', filter: 'saturate(1.3) contrast(1.1) brightness(0.97)', top: '#7b2ff7', bottom: '#ff5e62', wash: 'rgba(90,0,140,0.16)' },
};

export const COVER_LAYOUTS = {
  'four-panel': { name: 'Four-Panel Grid', cells: 4 },
  'hero-three': { name: 'Hero and Three', cells: 4 },
  'full-bleed': { name: 'Full-Bleed', cells: 1 },
  'tilted': { name: 'Tilted Snapshots', cells: 3 },
  'nine-panel': { name: 'Nine-Panel Grid', cells: 9 },
  'triptych': { name: 'Triptych', cells: 3 },
};

export const TITLE_STYLES = {
  'chrome-3d': { name: 'Chrome 3D' },
  'gold-3d': { name: 'Gold 3D' },
  'flat': { name: 'Flat' },
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
 *  panels, but short wide strips need more — see renderCover.
 *  `sliders` is {brightness, contrast, glow}: brightness/contrast multiply
 *  the grade's filter; glow boosts the neon wash. */
export function paintPanelPhoto(ctx, img, rect, slot, grade, bias = 0.18, sliders = {}) {
  const { x, y, w, h } = rect;
  const brightness = sliders.brightness ?? 1;
  const contrast = sliders.contrast ?? 1;
  const glow = sliders.glow ?? 0.7;
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
    // Tall portrait photos in wide cells need more than the base bias:
    // centre the crop window on the top fifth of the photo (the face
    // zone) by raising the bias toward 0.3*ph/(ph-h), capped at 0.44
    // (0.5 would pin the photo's top edge to the cell's top edge).
    // When the photo carries a measured face centre (`slot.faceY`, the
    // fraction down the photo where the face sits), centre the window
    // on that instead — close-up faces are taller than the crop window,
    // so centring on the top fifth clips chins. Capped at 0.46.
    let effBias = bias;
    if (ph > h) {
      const needed = (0.3 * ph) / (ph - h);
      effBias = Math.min(Math.max(bias, needed), 0.44);
      if (slot?.faceY != null) {
        const faceBias = (ph * (0.5 - slot.faceY)) / (ph - h);
        effBias = Math.min(Math.max(effBias, faceBias), 0.46);
      }
    }
    const topBias = ph > h ? effBias * (ph - h) : 0;
    ctx.filter = `${grade.filter} brightness(${brightness}) contrast(${contrast})`;
    ctx.drawImage(img, x + (w - pw) / 2 + dx, y + (h - ph) / 2 + dy + topBias, pw, ph);
    ctx.filter = 'none';
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#241631'); g.addColorStop(1, '#0d0817');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  const over = ctx.createLinearGradient(x, y, x + w * 0.25, y + h);
  over.addColorStop(0, grade.top);
  over.addColorStop(1, grade.bottom);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.35 + glow * 0.3;
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

/** Draws `text` as thick 3D retro letters: `depth` layered offsets in dark
 *  shades behind a gradient face, a bright outline, and a neon glow.
 *  `face` is [topColor, midColor, bottomColor]; `edge` is the extrusion
 *  colour ramp [near, far]; `glowColor` is the shadow glow. */
export function draw3DText(ctx, text, cx, cy, size, face, edge, glowColor, glow) {
  ctx.save();
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const depth = Math.max(6, Math.round(size * 0.09));
  const step = Math.max(1.2, size * 0.016);
  // Extrusion: deepest layer first, stepping up-left toward the face, so
  // the letters look carved toward the viewer.
  for (let i = depth; i >= 1; i--) {
    const t = i / depth;
    ctx.fillStyle = i % 2 === 0 ? edge[0] : edge[1];
    ctx.globalAlpha = 0.55 + 0.45 * (1 - t);
    ctx.fillText(text, cx + i * step, cy + i * step);
  }
  ctx.globalAlpha = 1;
  const grad = ctx.createLinearGradient(0, cy - size * 0.55, 0, cy + size * 0.6);
  grad.addColorStop(0, face[0]); grad.addColorStop(0.5, face[1]); grad.addColorStop(1, face[2]);
  // Neon glow behind the face, then the face itself, then a bright edge.
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = size * 0.28 * (0.4 + glow);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, cy);
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.5, size * 0.022);
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeText(text, cx, cy);
  ctx.restore();
}

/** The title block: halftone field, 3D retro title, neon Pacifico subtitle,
 *  heat stars. `zone` is {x,y,w,h}. `opts` is {titleStyle, subtitleColor,
 *  glow}. */
export function drawTitleBlock(ctx, zone, title, subtitle, heat, scale, opts = {}) {
  const { x, y, w, h } = zone;
  const titleStyle = opts.titleStyle ?? 'chrome-3d';
  const subtitleColor = opts.subtitleColor ?? '#ff5ce1';
  const glow = opts.glow ?? 0.7;
  ctx.save();
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, 'rgba(10,5,18,0.96)');
  bg.addColorStop(1, 'rgba(34,8,48,0.98)');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  drawHalftoneField(ctx, { x: x + w * 0.62, y, w: w * 0.38, h }, 'rgba(255,46,196,0.32)');
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const text = (title || 'UNTITLED').trim().toUpperCase();
  let size = h * 0.4;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  while (ctx.measureText(text).width > w * 0.88 && size > 10) {
    size -= 2;
    ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  }
  const ty = y + h * (subtitle ? 0.36 : 0.48);
  if (titleStyle === 'chrome-3d') {
    draw3DText(ctx, text, x + w / 2, ty, size,
      ['#ffffff', '#d9b8ff', '#ff5ce1'],
      ['#3b1a5e', '#160a2e'], '#ff2ec4', glow);
  } else if (titleStyle === 'gold-3d') {
    draw3DText(ctx, text, x + w / 2, ty, size,
      ['#fffbe0', '#ffd76a', '#ff9a3d'],
      ['#4a2c00', '#1f1200'], '#ffb347', glow);
  } else {
    const grad = ctx.createLinearGradient(0, ty - size * 0.5, 0, ty + size * 0.55);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.55, '#ffe259'); grad.addColorStop(1, '#ff7e5f');
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = '#0d0a12';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x + w / 2, ty);
    ctx.fillStyle = grad;
    ctx.fillText(text, x + w / 2, ty);
  }

  // Heat stars first: measure them so the subtitle can be centred in the
  // space left of them instead of colliding with them on narrow covers.
  let heatWidth = 0;
  let heatText = '';
  if (heat > 0) {
    const hs = Math.max(10, h * 0.13);
    ctx.font = `${hs}px Anton, sans-serif`;
    heatText = 'HEAT ';
    for (let i = 0; i < 5; i++) heatText += i < heat ? '★' : '☆';
    heatWidth = ctx.measureText(heatText).width;
  }
  const heatRight = x + w - w * 0.03;
  const heatLeft = heatRight - heatWidth;

  if (subtitle) {
    const ss0 = Math.max(12, h * 0.2);
    let ss = ss0;
    ctx.font = `${ss}px Pacifico, cursive`;
    // Centre the subtitle in the region left of the heat stars (or the
    // full band when there are none), shrinking only if it still overflows.
    const availL = x + w * 0.03;
    const availR = heat > 0 ? heatLeft - w * 0.02 : x + w - w * 0.03;
    const availW = Math.max(50, availR - availL);
    while (ctx.measureText(subtitle).width > availW && ss > 10) {
      ss -= 2;
      ctx.font = `${ss}px Pacifico, cursive`;
    }
    ctx.fillStyle = subtitleColor;
    ctx.shadowColor = subtitleColor; ctx.shadowBlur = ss * 0.7;
    ctx.fillText(subtitle, availL + availW / 2, y + h * 0.78);
    ctx.shadowBlur = 0;
  }
  if (heat > 0) {
    // On the subtitle's line, right-aligned, so it never crowds the title.
    const hs = Math.max(10, h * 0.13);
    ctx.font = `${hs}px Anton, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(heatText, heatRight, y + h * 0.78);
    ctx.textAlign = 'center';
  }
  ctx.restore();
}

/** A character callout tag: small black pill with white Anton text, pinned
 *  to the bottom-left inside a panel — low enough to never cover a face. */
export function drawCalloutLabel(ctx, rect, text, scale) {
  if (!text) return;
  const label = text.trim().toUpperCase();
  if (!label) return;
  ctx.save();
  const fs = Math.max(10, scale * 0.016);
  ctx.font = `${fs}px Anton, 'Arial Black', sans-serif`;
  const tw = ctx.measureText(label).width;
  const padX = fs * 0.7;
  const padY = fs * 0.42;
  const bw = tw + padX * 2;
  const bh = fs + padY * 2;
  const bx = rect.x + Math.max(6, scale * 0.012);
  const by = rect.y + rect.h - bh - Math.max(6, scale * 0.012);
  ctx.fillStyle = 'rgba(8,4,14,0.92)';
  ctx.beginPath();
  const r = bh / 2;
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
  ctx.lineTo(bx + r, by + bh);
  ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
  ctx.lineTo(bx, by + r);
  ctx.arcTo(bx, by, bx + r, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + bw / 2, by + bh / 2 + fs * 0.04);
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

/** A gold "ORIGINAL COVER ART" seal: concentric gold rings, a star, and two
 *  lines of text — the mark of a finished poster. */
export function drawGoldSeal(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.1);
  // Serrated outer edge.
  ctx.fillStyle = '#b8860b';
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.88;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  const outer = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
  outer.addColorStop(0, '#fff3b0'); outer.addColorStop(0.55, '#f5c542'); outer.addColorStop(1, '#c8911a');
  ctx.fillStyle = outer;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7a4d00';
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#3a2400';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${r * 0.34}px Anton, sans-serif`;
  ctx.fillText('★', 0, -r * 0.32);
  ctx.font = `${r * 0.17}px Anton, sans-serif`;
  ctx.fillText('ORIGINAL', 0, r * 0.02);
  ctx.fillText('COVER ART', 0, r * 0.24);
  ctx.font = `${r * 0.11}px Anton, sans-serif`;
  ctx.fillText('★ EST. 2026 ★', 0, r * 0.46);
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

/** Draws one photo panel (polaroid or inked frame) at its layout cell, plus
 *  its callout label when labels are on (never on polaroids — they carry
 *  their own handwritten caption). */
function drawPanel(ctx, cell, slot, grade, scale, bias = 0.18, sliders = {}, showLabels = true) {
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
    paintPanelPhoto(ctx, slot?.photo ?? null, photoRect, slot, grade, bias, sliders);
    ctx.fillStyle = '#221a2e';
    ctx.font = `${Math.max(10, cell.w * 0.055)}px Pacifico, cursive`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(slot?.caption ?? 'golden hour', cell.w / 2, cell.h * 0.9);
  } else {
    paintPanelPhoto(ctx, slot?.photo ?? null, { x: cell.x, y: cell.y, w: cell.w, h: cell.h }, slot, grade, bias, sliders);
    drawInkedFrame(ctx, { x: cell.x, y: cell.y, w: cell.w, h: cell.h }, scale);
    if (showLabels) drawCalloutLabel(ctx, { x: cell.x, y: cell.y, w: cell.w, h: cell.h }, slot?.label ?? '', scale);
  }
  ctx.restore();
}

/** The main entry: draws the whole cover onto `canvas` from `state`. */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const scale = Math.min(w, h);
  const grade = COVER_GRADES[state.grade] ?? COVER_GRADES['neon-night'];
  const strip = !!state.strip;
  const sliders = {
    brightness: state.brightness ?? 1,
    contrast: state.contrast ?? 1,
    glow: state.glow ?? 0.7,
  };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d0518';
  ctx.fillRect(0, 0, w, h);

  const { cells, title, band, stripH } = layoutPanels(state.layout, w, h, strip);

  if (state.layout === 'tilted') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1b0533'); sky.addColorStop(0.45, '#ff2ec4'); sky.addColorStop(0.75, '#ff7b2f'); sky.addColorStop(1, '#1b0533');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    drawRetroSun(ctx, w * 0.5, h * 0.52, Math.min(w, h) * 0.26, '#ffd76a', '#ff2d78');
    drawSkylineSilhouette(ctx, 0, h * 0.62, w, h * 0.1, '#140627');
    drawPalmSilhouette(ctx, w * 0.03, h * 0.94, h * 0.22, '#0d0418');
    drawPalmSilhouette(ctx, w * 0.9, h * 0.94, h * 0.17, '#0d0418');
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
    drawPanel(ctx, cell, slot, grade, scale, bias, sliders, state.showLabels !== false);
  });

  if (state.layout === 'full-bleed') {
    const scrim = ctx.createLinearGradient(0, h - title.h - h * 0.12, 0, h);
    scrim.addColorStop(0, 'rgba(10,4,20,0)');
    scrim.addColorStop(1, 'rgba(10,4,20,0.75)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h - title.h - h * 0.12, w, title.h + h * 0.12);
  }
  drawTitleBlock(ctx, title, state.title, state.subtitle, state.heat, scale, {
    titleStyle: state.titleStyle ?? 'chrome-3d',
    subtitleColor: state.subtitleColor ?? '#ff5ce1',
    glow: sliders.glow,
  });

  if (state.showSeal !== false) {
    const sealR = Math.min(w, h) * 0.052;
    if (band === 'bottom') drawGoldSeal(ctx, w - sealR * 1.3, sealR * 1.45, sealR);
    else drawGoldSeal(ctx, w - sealR * 1.3, h - stripH - sealR * 1.45, sealR);
  }

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
