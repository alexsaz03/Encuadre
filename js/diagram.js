// Dibujo SVG de la formación: circulitos con el color y la sigla de la unidad
// de origen de cada persona. El frente queda arriba.

import { UNIT_BY_ID, RANK_BY_ID } from './data.js';

const CELL = 26;
const R = 11;
const FONT = 10;
const BLOCK_GAP = 44;
const MARGIN = 24;
const FRONT_GAP = 34; // hueco entre la línea de FRENTE y el primer circulito
const LABEL_H = 46;

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

function person(g, x, y, p) {
  const u = UNIT_BY_ID[p.origin];
  const c = el('circle', {
    cx: x, cy: y, r: R,
    fill: u.color,
    stroke: p.promoted ? '#ff8f00' : (u.border || 'rgba(0,0,0,0.28)'),
    'stroke-width': p.promoted ? 2.5 : 1,
  });
  const title = el('title', {}, `${RANK_BY_ID[p.rank].label} (${u.name})${p.promoted ? ' — sube de puesto' : ''}`);
  c.appendChild(title);
  g.appendChild(c);
  g.appendChild(el('text', {
    x, y: y + 0.5,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-size': FONT,
    'font-weight': 700,
    fill: u.text,
    'pointer-events': 'none',
  }, u.short));
}

function emptySlot(g, x, y, label = 'Hueco sin cubrir') {
  const c = el('circle', {
    cx: x, cy: y, r: R,
    fill: 'none',
    stroke: '#b0003a',
    'stroke-width': 1.4,
    'stroke-dasharray': '3 3',
  });
  c.appendChild(el('title', {}, label));
  g.appendChild(c);
}

// Banderín / guion: mástil con gallardete del color de la unidad.
function flag(g, x, y, unitId, big, label) {
  const u = UNIT_BY_ID[unitId];
  const h = big ? 15 : 12;
  const w = big ? 16 : 12;
  const grp = el('g');
  grp.appendChild(el('line', {
    x1: x, y1: y - h, x2: x, y2: y + h,
    stroke: '#4e342e', 'stroke-width': 2, 'stroke-linecap': 'round',
  }));
  grp.appendChild(el('polygon', {
    points: `${x},${y - h} ${x + w},${y - h + 5} ${x},${y - h + 10}`,
    fill: u.color,
    stroke: u.border || 'rgba(0,0,0,0.35)',
    'stroke-width': 1,
  }));
  grp.appendChild(el('title', {}, label));
  g.appendChild(grp);
}

function rowXs(width, n) {
  // n posiciones repartidas uniformemente en un bloque de ancho `width`.
  const xs = [];
  for (let i = 0; i < n; i++) xs.push((width * (2 * i + 1)) / (2 * n));
  return xs;
}

function drawRow(g, width, y, people, slots, slotLabel) {
  const xs = rowXs(width, slots);
  for (let i = 0; i < slots; i++) {
    if (i < people.length) person(g, xs[i], y, people[i]);
    else emptySlot(g, xs[i], y, slotLabel);
  }
}

// ── Bloques ───────────────────────────────────────────────────────────────

function drawPlana(svg, x0, y0, plana) {
  const width = 3 * CELL;
  const g = el('g', { transform: `translate(${x0},${y0})` });
  const cx = width / 2;
  // Mando
  if (plana.mando) person(g, cx, 0, plana.mando);
  else emptySlot(g, cx, 0, 'Mando vacante');
  // Guion del Tabor + acompañante (fuera de los números)
  flag(g, cx - CELL / 2 - 4, CELL, 'PLANA', true, 'Guion del Tabor');
  const u = UNIT_BY_ID.PLANA;
  const acomp = el('circle', {
    cx: cx + CELL / 2 + 4, cy: CELL, r: R,
    fill: u.color, stroke: 'rgba(0,0,0,0.28)', 'stroke-width': 1,
  });
  acomp.appendChild(el('title', {}, 'Acompañante del guion'));
  g.appendChild(acomp);
  g.appendChild(el('text', {
    x: cx + CELL / 2 + 4, y: CELL + 0.5, 'text-anchor': 'middle',
    'dominant-baseline': 'central', 'font-size': FONT, 'font-weight': 700,
    fill: u.text, 'pointer-events': 'none',
  }, u.short));
  // Oficiales y suboficiales
  drawRow(g, width, 2 * CELL, plana.oficiales, 3, 'Oficial sin cubrir');
  drawRow(g, width, 3 * CELL, plana.suboficiales, 3, 'Suboficial sin cubrir');
  svg.appendChild(g);
  return { width, rows: 4 };
}

function drawCompany(svg, x0, y0, c, frente, fondo) {
  const width = frente * CELL;
  const g = el('g', { transform: `translate(${x0},${y0})` });
  const cx = width / 2;
  // Mando + banderín
  if (c.mando) person(g, cx, 0, c.mando);
  else emptySlot(g, cx, 0, 'Mando vacante');
  flag(g, cx - CELL - 2, 0, c.unit, false, `Banderín (${UNIT_BY_ID[c.unit].name})`);
  // Jefes de sección
  drawRow(g, width, CELL, c.jsec, 3, 'Jefe de sección sin cubrir');
  // Caja: JPn, cabos, regulares
  drawRow(g, width, 2 * CELL, c.jpn, frente, 'Jefe de pelotón sin cubrir');
  drawRow(g, width, 3 * CELL, c.cabos, frente, 'Hueco en la fila de cabos');
  const xs = rowXs(width, frente);
  const regRows = fondo - 2;
  for (let i = 0; i < regRows * frente; i++) {
    const col = i % frente;
    const row = Math.floor(i / frente);
    const y = (4 + row) * CELL;
    if (i < c.regs.length) person(g, xs[col], y, c.regs[i]);
    else emptySlot(g, xs[col], y, 'Hueco sin cubrir');
  }
  svg.appendChild(g);
  return { width, rows: 2 + fondo };
}

function blockLabel(svg, x0, width, y, unitId, total, agregados) {
  const u = UNIT_BY_ID[unitId];
  const cx = x0 + width / 2;
  svg.appendChild(el('text', {
    x: cx, y: y + 16, 'text-anchor': 'middle',
    'font-size': 13, 'font-weight': 700, fill: '#2d3a2e',
  }, u.name));
  svg.appendChild(el('text', {
    x: cx, y: y + 32, 'text-anchor': 'middle',
    'font-size': 11, fill: '#5c6b5d',
  }, `${total} formando` + (agregados > 0 ? ` · ${agregados} agreg.` : '')));
}

const countPeople = (lists) => lists.flat().filter(Boolean);

export function renderDiagram(svg, result) {
  const { plana, companies, frente, fondo } = result;
  svg.textContent = '';
  svg.setAttribute('font-family', "system-ui, -apple-system, 'Segoe UI', sans-serif");

  const blocks = [
    { kind: 'plana', data: plana, width: 3 * CELL },
    ...companies.map((c) => ({ kind: 'cia', data: c, width: frente * CELL })),
  ];

  const totalW = MARGIN * 2 + blocks.reduce((s, b) => s + b.width, 0) + BLOCK_GAP * (blocks.length - 1);
  const maxRows = Math.max(4, 2 + fondo);
  const topY = MARGIN + 18 + FRONT_GAP; // línea de frente + hueco
  const totalH = topY + (maxRows - 1) * CELL + R + 10 + LABEL_H;

  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
  svg.setAttribute('width', totalW);
  svg.setAttribute('height', totalH);

  // Línea de FRENTE
  svg.appendChild(el('line', {
    x1: MARGIN, y1: MARGIN + 18, x2: totalW - MARGIN, y2: MARGIN + 18,
    stroke: '#8d9b8e', 'stroke-width': 1.5, 'stroke-dasharray': '7 5',
  }));
  svg.appendChild(el('text', {
    x: totalW / 2, y: MARGIN + 6, 'text-anchor': 'middle',
    'font-size': 12, 'font-weight': 700, fill: '#8d9b8e', 'letter-spacing': '4',
  }, 'FRENTE'));

  const labelY = topY + (maxRows - 1) * CELL + R + 10;
  let x = MARGIN;
  for (const b of blocks) {
    if (b.kind === 'plana') {
      drawPlana(svg, x, topY, b.data);
      const total = countPeople([[b.data.mando], b.data.oficiales, b.data.suboficiales]);
      blockLabel(svg, x, b.width, labelY, 'PLANA', total.length,
        total.filter((p) => p.origin !== 'PLANA').length);
    } else {
      drawCompany(svg, x, topY, b.data, frente, fondo);
      const total = countPeople([[b.data.mando], b.data.jsec, b.data.jpn, b.data.cabos, b.data.regs]);
      blockLabel(svg, x, b.width, labelY, b.data.unit, total.length,
        total.filter((p) => p.origin !== b.data.unit).length);
    }
    x += b.width + BLOCK_GAP;
  }
}

export function downloadPNG(svg, filename = 'encuadre.png') {
  const scale = 2;
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  const data = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(png);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
  };
  img.src = url;
}
