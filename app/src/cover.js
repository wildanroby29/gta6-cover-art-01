// Vice City Cover Studio — cover renderer (recorded Vice City Cast build, 2026-11-20).
// Draws a movie-poster cover on a 2D canvas from a cast of portrait photos:
// one of three layouts, one of five colour grades, a solid-gold Anton title
// across the middle, a Pacifico script subtitle, a tagline ribbon, five
// stars and a quote, a gold seal, a billing block, a barcode and a release
// line. Every face is kept whole: photo crops are anchored on each portrait's
// face centre, and the title band never covers a face's eyes.
// No real company or person name appears anywhere: the billing names only
// the fictional "Vice City Pictures" studio and the seven fictional roles.

export const COVER_SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const LAYOUTS = {
  'hero-mosaic': { name: 'Hero Mosaic', cells: 7 },
  'diagonal-strips': { name: 'Diagonal Strips', cells: 7 },
  'six-grid': { name: 'Six Grid', cells: 6 },
  'neon-noir': { name: 'Neon Noir', cells: 5 },
};

export const GRADES = {
  'sunset-gold': { name: 'Sunset Gold', filter: 'saturate(1.15) contrast(1.05) brightness(1.03)', wash: 'rgba(255,140,40,0.07)' },
  'neon-night': { name: 'Neon Night', filter: 'saturate(1.35) contrast(1.12) brightness(0.95)', wash: 'rgba(255,46,196,0.16)' },
  'tropic-teal': { name: 'Tropic Teal', filter: 'saturate(1.15) contrast(1.06)', wash: 'rgba(0,180,160,0.15)' },
  'ultraviolet': { name: 'Ultraviolet', filter: 'hue-rotate(35deg) saturate(1.35) contrast(1.08)', wash: 'rgba(120,40,255,0.12)' },
  'retro-print': { name: 'Retro Print', filter: 'sepia(0.35) contrast(0.95) brightness(1.06) saturate(0.9)', wash: 'rgba(255,240,200,0.05)' },
  'neon-noir': { name: 'Neon Noir', filter: 'saturate(1.5) contrast(1.18) brightness(0.82) hue-rotate(-12deg)', wash: 'rgba(90,20,170,0.22)' },
};

// The seven-person demo cast: file, role tag and face centre (fractions of
// the photo). Faces sit in the upper third of each portrait.
export const CAST = [
  { id: 'boss', file: 'boss.jpg', role: 'THE BOSS', faceX: 0.50, faceY: 0.30 },
  { id: 'driver', file: 'driver.jpg', role: 'THE DRIVER', faceX: 0.52, faceY: 0.28 },
  { id: 'mechanic', file: 'mechanic.jpg', role: 'THE MECHANIC', faceX: 0.52, faceY: 0.28 },
  { id: 'hustler', file: 'hustler.jpg', role: 'THE HUSTLER', faceX: 0.55, faceY: 0.30 },
  { id: 'fixer', file: 'fixer.jpg', role: 'THE FIXER', faceX: 0.50, faceY: 0.28 },
  { id: 'smuggler', file: 'smuggler.jpg', role: 'THE SMUGGLER', faceX: 0.52, faceY: 0.30 },
  { id: 'lookout', file: 'lookout.jpg', role: 'THE LOOKOUT', faceX: 0.55, faceY: 0.30 },
  { id: 'vista', file: 'landscape.jpg', role: 'THE CITY', faceX: 0.50, faceY: 0.45 },
  { id: 'crew', file: 'group.jpg', role: 'THE CREW', faceX: 0.50, faceY: 0.40 },
];

// Crop variants for one photo filling the whole collage: each slot gets a
// different window of the same photo (centre, left, right, zoomed face,
// wide), so a single photo still makes a full poster.
export const SINGLE_PHOTO_CROPS = [
  { zoom: 1.0, ox: 0, oy: 0 },
  { zoom: 1.5, ox: -220, oy: 0 },
  { zoom: 1.5, ox: 220, oy: 0 },
  { zoom: 2.2, ox: 0, oy: -60 },
  { zoom: 1.0, ox: 0, oy: 90 },
  { zoom: 1.7, ox: -160, oy: 60 },
  { zoom: 1.7, ox: 160, oy: -60 },
];

export function applySinglePhotoCrops(slots, photoId, label) {
  slots.forEach((slot, i) => {
    const c = SINGLE_PHOTO_CROPS[i % SINGLE_PHOTO_CROPS.length];
    slot.photoId = photoId;
    slot.label = label;
    slot.zoom = c.zoom;
    slot.ox = c.ox;
    slot.oy = c.oy;
    slot.flip = false;
  });
}

export const BILLING_DEFAULT = 'A VICE CITY PICTURES PRODUCTION — STARRING THE BOSS, THE DRIVER, THE MECHANIC, THE HUSTLER, THE FIXER, THE SMUGGLER, THE LOOKOUT — MIAMI, 1987';

const GOLD = '#eec25a';
const GOLD_DARK = '#8a6a1f';
const PINK = '#ff5ce1';
const CREAM = '#f2ede3';

// Geometry per layout, in fractions of the canvas. The title band sits
// between the rows (hero, six-grid) or across the strips' middles
// (diagonal), always clear of the panels' face zones.
function layoutGeometry(layout, W, H) {
  const topRowY = 0.05, stripTop = 0.05;
  if (layout === 'six-grid') {
    // Top row 0.355 (not 0.37): leaves a clear gap between the top-row name
    // tags and the title band above them.
    return {
      panels: gridPanels(W, H, 0.05, 0.355, 0.62, 0.30, [1, 0, 2], [3, 5, 4]),
      titleTop: 0.43, bandTop: 0.92,
    };
  }
  if (layout === 'neon-noir') {
    // Five tall vertical film strips; the right ~15% stays clear for the
    // vertical title column. Strips are full height, no slant.
    const strips = [];
    const gap = 0.008 * W;
    const avail = 0.84 * W - 0.01 * W;
    const sw = (avail - 4 * gap) / 5;
    for (let i = 0; i < 5; i++) {
      strips.push({ x: 0.01 * W + i * (sw + gap), y: 0.05 * H, w: sw, h: 0.90 * H, rot: 0, slant: 0, slot: i });
    }
    return { panels: strips, titleTop: 0.05, bandTop: 0.95, verticalTitle: true };
  }
  if (layout === 'diagonal-strips') {
    return {
      panels: stripPanels(W, H, stripTop, 0.94),
      titleTop: 0.485, bandTop: 0.94,
    };
  }
  // hero-mosaic (default): Boss hero centre-top, six around.
  const unit = 0.95 / 4.4;
  const widths = [unit, unit, unit * 1.4, unit];
  const top = [];
  let x = 0.01;
  const slotOrder = [1, 2, 0, 3]; // Driver, Mechanic, Boss, Hustler
  widths.forEach((w, i) => {
    top.push({ x: x * W, y: topRowY * H, w: w * W, h: 0.42 * H, rot: i === 2 ? -0.02 : 0, slant: 0, slot: slotOrder[i] });
    x += w + 0.01;
  });
  const bottom = [
    { x: 0.01 * W, y: 0.67 * H, w: 0.32 * W, h: 0.28 * H, rot: 0, slant: 0, slot: 4 },
    { x: 0.34 * W, y: 0.67 * H, w: 0.32 * W, h: 0.28 * H, rot: 0, slant: 0, slot: 5 },
    { x: 0.67 * W, y: 0.67 * H, w: 0.32 * W, h: 0.28 * H, rot: 0, slant: 0, slot: 6 },
  ];
  return { panels: [...top, ...bottom], titleTop: 0.485, bandTop: 0.95 };
}

// Three-by-two grid; topSlots/bottomSlots name the slot index per cell.
function gridPanels(W, H, topY, topH, botY, botH, topSlots, botSlots) {
  const out = [];
  const xs = [0.01, 0.34, 0.67], w = 0.32;
  topSlots.forEach((slot, i) => out.push({ x: xs[i] * W, y: topY * H, w: w * W, h: topH * H, rot: 0, slant: 0, slot }));
  botSlots.forEach((slot, i) => out.push({ x: xs[i] * W, y: botY * H, w: w * W, h: botH * H, rot: 0, slant: 0, slot }));
  return out;
}

// Seven slanted full-height strips; the Boss strip (index 3) is 1.5 wide.
function stripPanels(W, H, topY, botY) {
  const unit = 0.98 / 7.5;
  const widths = [1, 1, 1, 1.5, 1, 1, 1];
  const out = [];
  let x = 0.01;
  widths.forEach((u, i) => {
    out.push({ x: x * W, y: topY * H, w: u * unit * W, h: (botY - topY) * H, rot: 0, slant: 0.03 * W, slot: i });
    x += u * unit;
  });
  return out;
}

export function layoutPanels(layout, W, H) {
  return layoutGeometry(layout, W, H).panels;
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/** Cover-fits one photo into a panel, anchored on the face so it stays whole. */
function drawPhoto(ctx, img, p, slot, face, grade) {
  ctx.save();
  ctx.beginPath();
  if (p.slant) {
    ctx.moveTo(p.x + p.slant, p.y);
    ctx.lineTo(p.x + p.w + p.slant, p.y);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.lineTo(p.x, p.y + p.h);
    ctx.closePath();
    ctx.clip();
    drawPhotoInto(ctx, img, p.x, p.y, p.w, p.h, slot, face, grade);
    ctx.strokeStyle = '#f5efe2';
    ctx.lineWidth = Math.max(4, Math.round(p.w * 0.006));
    ctx.stroke();
  } else if (p.rot) {
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.rotate(p.rot);
    ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.clip();
    drawPhotoInto(ctx, img, -p.w / 2, -p.h / 2, p.w, p.h, slot, face, grade);
    ctx.strokeStyle = '#f5efe2';
    ctx.lineWidth = Math.max(4, Math.round(p.w * 0.006));
    ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
  } else {
    ctx.rect(p.x, p.y, p.w, p.h);
    ctx.clip();
    drawPhotoInto(ctx, img, p.x, p.y, p.w, p.h, slot, face, grade);
    ctx.strokeStyle = '#f5efe2';
    ctx.lineWidth = Math.max(4, Math.round(p.w * 0.006));
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }
  ctx.restore();
}

function drawPhotoInto(ctx, img, dx, dy, dw, dh, slot, face, grade) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = Math.max(dw / iw, dh / ih);
  const s = base * (slot.zoom || 1);
  const sw = dw / s, sh = dh / s;
  let sx = face.x * iw - sw / 2 + (slot.ox || 0) / s;
  let sy = face.y * ih - sh / 2 + (slot.oy || 0) / s;
  sx = clamp(sx, 0, Math.max(0, iw - sw));
  sy = clamp(sy, 0, Math.max(0, ih - sh));
  ctx.filter = grade.filter;
  if (slot.flip) {
    ctx.drawImage(img, sx, sy, sw, sh, dx + dw, dy, -dw, dh);
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  ctx.filter = 'none';
}

/** Fits the title: Anton at 0.15H, stretched up to 1.5x to fill 0.88W. */
function fitTitle(ctx, text, W, H) {
  let size = Math.round(0.15 * H);
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  const measured = ctx.measureText(text.toUpperCase()).width || 1;
  const target = 0.88 * W;
  let sx = clamp(target / measured, 1.0, 1.5);
  if (measured * 1.5 > target) {
    size = Math.round(size * (target / (measured * 1.5)));
    ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
    sx = 1.5;
  }
  return { size, sx, width: ctx.measureText(text.toUpperCase()).width * sx };
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawArcText(ctx, text, cx, cy, r, maxFont) {
  // Ring text around the full circle, auto-sized so the letters never overlap.
  const fontSize = Math.max(5, Math.min(maxFont, (2 * Math.PI * r * 0.85) / (text.length * 0.62)));
  ctx.save();
  ctx.font = `700 ${Math.round(fontSize)}px Arial, sans-serif`;
  ctx.fillStyle = GOLD_DARK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const total = text.length;
  for (let i = 0; i < total; i++) {
    const ang = -Math.PI / 2 + ((i + 0.5) / total) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

// Original scene behind the title: a sun disc, a low skyline and palm
// silhouettes, all drawn with canvas shapes (no artwork, no logos).
function drawScene(ctx, W, H, titleTop) {
  const bandTop = titleTop * H;
  const bandBot = Math.min(0.68 * H, bandTop + 0.20 * H);
  const cy = bandTop + (bandBot - bandTop) * 0.42;
  const sunR = Math.min(0.055 * H, 0.05 * W);
  // Sun disc: bright core fading to orange.
  const sg = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, sunR * 1.6);
  sg.addColorStop(0, 'rgba(255,244,200,0.95)');
  sg.addColorStop(0.55, 'rgba(255,180,80,0.85)');
  sg.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(W / 2, cy, sunR * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffdf8a';
  ctx.beginPath();
  ctx.arc(W / 2, cy, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Low skyline along the bottom of the band.
  ctx.fillStyle = 'rgba(20,10,20,0.85)';
  let bx = 0;
  let seed = 7;
  while (bx < W) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const bw = W * (0.04 + (seed % 5) * 0.012);
    const bh = (bandBot - bandTop) * (0.25 + (seed % 7) * 0.07);
    ctx.fillRect(bx, bandBot - bh, bw, bh);
    bx += bw + W * 0.008;
  }
  // Palm silhouettes flanking the title.
  for (const side of [-1, 1]) {
    const px = W / 2 + side * W * 0.44;
    const py = bandBot;
    const ph = (bandBot - bandTop) * 0.9;
    ctx.strokeStyle = 'rgba(20,10,20,0.9)';
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - side * W * 0.01, py - ph * 0.6, px - side * W * 0.02, py - ph);
    ctx.stroke();
    const tx = px - side * W * 0.02, ty = py - ph;
    ctx.lineWidth = Math.max(2, W * 0.003);
    for (let i = 0; i < 5; i++) {
      const a = (-0.15 - i * 0.175) * Math.PI * side;
      const len = ph * 0.45;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(
        tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.5 - ph * 0.06,
        tx + Math.cos(a) * len, ty + Math.sin(a) * len * 0.7);
      ctx.stroke();
    }
  }
}

// Neon Noir vertical title: the caption stacked as upright letters down
// the right column, hot pink neon with a glow.
function drawVerticalTitle(ctx, W, H, state) {
  const text = (state.title || 'Vice City').toUpperCase().replace(/\s+/g, '');
  const chars = text.split('');
  const colX = 0.925 * W;
  const colW = 0.13 * W;
  const top = 0.06 * H, bot = 0.94 * H;
  const size = Math.max(20, Math.min(colW * 0.95, (bot - top) / (chars.length * 1.08)));
  ctx.save();
  ctx.font = `${Math.round(size)}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const step = (bot - top) / chars.length;
  chars.forEach((ch, i) => {
    const cy = top + step * (i + 0.5);
    ctx.shadowColor = '#ff2ec4';
    ctx.shadowBlur = Math.round(size * 0.35);
    ctx.strokeStyle = '#1a0512';
    ctx.lineWidth = size * 0.08;
    ctx.strokeText(ch, colX, cy);
    const g = ctx.createLinearGradient(colX, cy - size / 2, colX, cy + size / 2);
    g.addColorStop(0, '#ff7ae0');
    g.addColorStop(0.5, '#ff2ec4');
    g.addColorStop(1, '#c400a0');
    ctx.fillStyle = g;
    ctx.fillText(ch, colX, cy);
  });
  ctx.restore();
}

// Film-strip frame: black side borders with sprocket holes, for Neon Noir.
function drawFilmFrames(ctx, panels) {
  for (const p of panels) {
    const bw = Math.max(6, p.w * 0.06);
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(p.x, p.y, bw, p.h);
    ctx.fillRect(p.x + p.w - bw, p.y, bw, p.h);
    ctx.fillStyle = 'rgba(240,230,255,0.85)';
    const holeW = bw * 0.55, holeH = Math.max(4, p.h * 0.018);
    const gap = holeH * 1.6;
    for (let y = p.y + gap; y + holeH < p.y + p.h - gap; y += gap + holeH) {
      ctx.fillRect(p.x + (bw - holeW) / 2, y, holeW, holeH);
      ctx.fillRect(p.x + p.w - bw + (bw - holeW) / 2, y, holeW, holeH);
    }
  }
}

/** Draws the whole cover. photos: Map of photoId -> {img, faceX, faceY, label}. */
export function drawCover(ctx, W, H, state, photos, opts = {}) {
  const grade = GRADES[state.grade] || GRADES['sunset-gold'];
  const geo = layoutGeometry(state.layout, W, H);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Panels.
  for (const p of geo.panels) {
    const slot = state.slots[p.slot];
    if (!slot) continue;
    const photo = photos.get(slot.photoId);
    if (!photo || !photo.img) continue;
    drawPhoto(ctx, photo.img, p, slot, { x: photo.faceX, y: photo.faceY }, grade);
  }

  // Cinematic grade, under the lettering: the grade's own wash, then a
  // strong pink-to-orange sunset gradient (obvious at thumbnail size), a
  // soft bloom glow, a deep vignette, and subtle film grain on every grade.
  ctx.fillStyle = grade.wash;
  ctx.fillRect(0, 0, W, H);
  const sun = ctx.createLinearGradient(0, 0, 0, H);
  sun.addColorStop(0, 'rgba(255,92,225,0.20)');
  sun.addColorStop(0.45, 'rgba(255,140,60,0.12)');
  sun.addColorStop(1, 'rgba(255,90,40,0.20)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  // Soft bloom: a warm glow centred on the title zone.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const bloom = ctx.createRadialGradient(W / 2, H * 0.52, 0, W / 2, H * 0.52, Math.max(W, H) * 0.42);
  bloom.addColorStop(0, 'rgba(255,220,160,0.30)');
  bloom.addColorStop(0.55, 'rgba(255,160,90,0.12)');
  bloom.addColorStop(1, 'rgba(255,160,90,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  // Film grain on every grade: deterministic dots, so exports are stable.
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 1400; i++) {
    const x = (i * 7919) % W, y = (i * 104729) % H;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 900; i++) {
    const x = (i * 104729 + 401) % W, y = (i * 7919 + 977) % H;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  if (state.grade === 'neon-night') {
    const g2 = ctx.createLinearGradient(0, 0, 0, H);
    g2.addColorStop(0, 'rgba(255,46,196,0.16)');
    g2.addColorStop(1, 'rgba(0,180,255,0.14)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.grade === 'tropic-teal') {
    const g3 = ctx.createLinearGradient(0, 0, 0, H);
    g3.addColorStop(0, 'rgba(0,200,170,0.10)');
    g3.addColorStop(1, 'rgba(0,80,160,0.08)');
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, W, H);
  }

  // Neon Noir: film-strip frames over the panels, crisp above the grade.
  if (state.layout === 'neon-noir') drawFilmFrames(ctx, geo.panels);

  // Top strip: five stars, quote, edition tag.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, 0.05 * H);
  const stripY = 0.025 * H;
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const quoteText = `${'★'.repeat(state.heat || 5)}  ${(state.quote || '').toUpperCase()} — ${(state.quoteSource || '').toUpperCase()}`;
  ctx.font = `700 ${Math.round(0.016 * H)}px Arial, sans-serif`;
  // Stars are the ★ characters in the centred quote line: one tidy row.
  ctx.fillText(quoteText, W / 2, stripY);
  ctx.font = `700 ${Math.round(0.013 * H)}px Arial, sans-serif`;
  const ed = (state.edition || 'VOL. 1').toUpperCase();
  const edW = ctx.measureText(ed).width + 0.016 * W;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1, 0.0015 * W);
  ctx.strokeRect(W - 0.015 * W - edW, stripY - 0.016 * H, edW, 0.032 * H);
  ctx.fillStyle = GOLD;
  ctx.fillText(ed, W - 0.015 * W - edW / 2, stripY);

  // Name tags + editor badges on the panels.
  if (state.showLabels !== false) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const p of geo.panels) {
      const slot = state.slots[p.slot];
      if (!slot) continue;
      const photo = photos.get(slot.photoId);
      const label = (slot.label || (photo && photo.label) || '').toUpperCase();
      if (!label) continue;
      const fs = Math.max(11, Math.round(0.013 * W));
      ctx.font = `800 ${fs}px Arial, sans-serif`;
      const tw = ctx.measureText(label).width;
      const padX = fs * 0.7, padY = fs * 0.45;
      const tx = p.x + 0.008 * W, ty = p.y + p.h - 0.008 * H - (fs + padY * 2) / 2;
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      const bx = tx, by = ty - (fs + padY * 2) / 2, bw = tw + padX * 2, bh = fs + padY * 2;
      const r = Math.min(4, bh / 2);
      ctx.moveTo(bx + r, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
      ctx.arcTo(bx, by + bh, bx, by, r);
      ctx.arcTo(bx, by, bx + bw, by, r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#14100a';
      ctx.fillText(label, tx + padX, ty);
    }
  }
  if (opts.editor) {
    geo.panels.forEach((p) => {
      const r = Math.max(9, 0.011 * W);
      const cx = p.x + r + 0.006 * W, cy = p.y + r + 0.006 * H;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.fillStyle = '#14100a';
      ctx.font = `800 ${Math.round(r * 1.1)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.slot + 1), cx, cy + 1);
      if (p.slot === state.selected) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = Math.max(3, 0.003 * W);
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      }
    });
  }

  // Neon Noir: a vertical title column instead of the horizontal band.
  if (geo.verticalTitle) {
    drawVerticalTitle(ctx, W, H, state);
  } else {
  // Original scene (sun, skyline, palms) behind the title band.
  drawScene(ctx, W, H, geo.titleTop);

  // Title: layered Anton — vertical gradient fill, thick dark outline,
  // soft shadow — stretched to fill the width.
  const titleText = (state.title || 'Vice City').toUpperCase();
  const { size: titleSize, sx, width: titleWidth } = fitTitle(ctx, titleText, W, H);
  const capH = 0.72 * titleSize;
  const titleRight = W / 2 + titleWidth / 2;
  const titleCx = W / 2;
  const titleTop = geo.titleTop * H;
  ctx.save();
  ctx.translate(titleCx, titleTop + capH);
  ctx.scale(sx, 1);
  ctx.font = `${titleSize}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#140e04';
  ctx.lineWidth = titleSize * 0.09;
  ctx.strokeText(titleText, 0, 0);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.round(titleSize * 0.06);
  ctx.shadowOffsetY = Math.round(titleSize * 0.03);
  if (state.grade === 'neon-night') {
    const tg = ctx.createLinearGradient(0, -capH, 0, 0);
    tg.addColorStop(0, '#7ff7ff');
    tg.addColorStop(0.5, '#ffffff');
    tg.addColorStop(1, '#ff5ce1');
    ctx.fillStyle = tg;
  } else {
    const tg = ctx.createLinearGradient(0, -capH, 0, 0);
    tg.addColorStop(0, '#ffe9a8');
    tg.addColorStop(0.45, '#eec25a');
    tg.addColorStop(0.8, '#ff7a3d');
    tg.addColorStop(1, '#ff5ce1');
    ctx.fillStyle = tg;
  }
  ctx.fillText(titleText, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.restore();

  // Script subtitle, pink neon.
  const subY = titleTop + capH + 0.03 * H;
  ctx.save();
  ctx.font = `${Math.round(0.038 * H)}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = PINK;
  ctx.shadowBlur = Math.round(0.02 * H);
  ctx.fillStyle = PINK;
  ctx.fillText(state.subtitle || '', W / 2, subY);
  ctx.restore();

  // Tagline ribbon (Neon Night: cyan; otherwise orange).
  const ribbonText = (state.ribbon || '').toUpperCase();
  if (ribbonText) {
    const rfs = Math.max(11, Math.round(0.013 * H));
    ctx.font = `800 ${rfs}px Arial, sans-serif`;
    const rw = ctx.measureText(ribbonText).width + rfs * 2.4;
    const rh = 0.024 * H;
    const ry = subY + 0.022 * H;
    const grad = ctx.createLinearGradient(W / 2 - rw / 2, 0, W / 2 + rw / 2, 0);
    if (state.grade === 'neon-night') {
      grad.addColorStop(0, '#19c8e8');
      grad.addColorStop(1, '#7ff7ff');
    } else {
      grad.addColorStop(0, '#ff8a3d');
      grad.addColorStop(1, '#ff5e3d');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(W / 2 - rw / 2, ry, rw, rh);
    ctx.fillStyle = '#1a1206';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ribbonText, W / 2, ry + rh / 2 + 1);
  }
  } // end of the horizontal-title branch (Neon Noir uses the vertical title)

  // Bottom band: billing, release line, barcode.
  const bandTop = geo.bandTop * H;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, bandTop, W, H - bandTop);
  ctx.fillStyle = '#d8c690';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const bfs = Math.max(10, Math.round(0.011 * W));
  ctx.font = `${bfs}px Arial, sans-serif`;
  const billingLines = wrapLines(ctx, state.billing || BILLING_DEFAULT, 0.62 * W);
  const lineH = bfs * 1.5;
  const billingTop = bandTop + (H - bandTop) / 2 - ((billingLines.length - 1) * lineH) / 2;
  billingLines.forEach((line, i) => ctx.fillText(line, W / 2, billingTop + i * lineH));
  // Release line, left; barcode, right. The release scales with the smaller
  // canvas dimension so it never crowds the centred billing on tall canvases.
  ctx.textAlign = 'left';
  ctx.font = `700 ${Math.round(0.015 * Math.min(W, H))}px Arial, sans-serif`;
  ctx.fillStyle = GOLD;
  try { ctx.letterSpacing = '4px'; } catch (e) { /* older canvas: no letter spacing */ }
  ctx.fillText((state.release || 'COMING SOON').toUpperCase(), 0.02 * W, bandTop + (H - bandTop) / 2);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  // Small rating box (original, fictional) just left of the barcode.
  const rbW = 0.038 * W, rbH = (H - bandTop) * 0.62, rbX = W - 0.115 * W, rbY = bandTop + 0.008 * H;
  ctx.strokeStyle = '#f2ede3';
  ctx.lineWidth = Math.max(2, 0.0015 * W);
  ctx.strokeRect(rbX, rbY, rbW, rbH);
  ctx.fillStyle = '#f2ede3';
  ctx.font = `800 ${Math.round(rbH * 0.52)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', rbX + rbW / 2, rbY + rbH * 0.42);
  ctx.font = `700 ${Math.max(7, Math.round(rbH * 0.14))}px Arial, sans-serif`;
  ctx.fillText('MATURE', rbX + rbW / 2, rbY + rbH * 0.86);
  drawBarcode(ctx, W - 0.065 * W, bandTop + 0.008 * H, 0.045 * W, (H - bandTop) * 0.62);

  // Gold seal (Neon Night: blue), just right of the title in the title zone —
  // clear of every face.
  if (state.showSeal !== false) {
    const sr = Math.max(26, 0.034 * W);
    const scx = Math.min(0.96 * W, titleRight + sr + 0.008 * W), scy = titleTop + capH * 0.5;
    const neon = state.grade === 'neon-night';
    ctx.save();
    ctx.beginPath();
    ctx.arc(scx, scy, sr, 0, Math.PI * 2);
    ctx.fillStyle = neon ? '#1e6fd9' : GOLD;
    ctx.fill();
    ctx.lineWidth = Math.max(2, sr * 0.06);
    ctx.strokeStyle = neon ? '#7ff7ff' : GOLD_DARK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(scx, scy, sr * 0.82, 0, Math.PI * 2);
    ctx.strokeStyle = neon ? 'rgba(127,247,255,0.8)' : 'rgba(138,106,31,0.8)';
    ctx.lineWidth = Math.max(1, sr * 0.03);
    ctx.stroke();
    ctx.fillStyle = neon ? GOLD : GOLD_DARK;
    drawStar(ctx, scx, scy - sr * 0.42, sr * 0.16);
    ctx.fillStyle = neon ? '#ffffff' : '#14100a';
    ctx.font = `800 ${Math.round(sr * 0.26)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((state.seal || 'BEST CREW').toUpperCase(), scx, scy + sr * 0.18);
    drawArcText(ctx, (state.sealRing || '').toUpperCase(), scx, scy, sr * 0.68, sr * 0.16);
    ctx.restore();
  }
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#000';
  let bx = x + 2;
  let seed = 1987;
  while (bx < x + w - 3) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const bw = 1 + (seed % 3);
    if (seed % 3 !== 0) ctx.fillRect(bx, y + 1, bw, h - 6);
    bx += bw + 1 + (seed % 2);
  }
  ctx.font = `${Math.max(7, Math.round(h * 0.22))}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('0 1987 2026', x + w / 2, y + h - 1);
}

/** Renders the state onto a canvas sized to state.size (or opts.size). */
export function renderCover(canvas, state, photos, opts = {}) {
  const [W, H] = COVER_SIZES[opts.size || state.size] || COVER_SIZES['1920x1080'];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, W, H, state, photos, opts);
  return canvas;
}

/** Renders a standalone PNG of the cover at the given size. */
export function exportCoverPNG(sizeKey, state, photos) {
  const canvas = document.createElement('canvas');
  renderCover(canvas, state, photos, { size: sizeKey });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
