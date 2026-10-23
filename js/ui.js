// Wizard de entrada de datos y renderizado de resultados.

import {
  UNITS, UNIT_BY_ID, RANK_BY_ID, RANK_INDEX,
  COMPANY_ORDER, COMPANY_RANKS, PLANA_RANKS,
} from './data.js';
import { allocate } from './allocate.js';
import { renderDiagram, downloadPNG } from './diagram.js';

const STORAGE_KEY = 'encuadre-v1';

// Nombres compactos para textos y etiquetas.
const SHORT_NAME = { 1: '1ª', 2: '2ª', 3: '3ª', 4: '4ª', MAPO: 'MAPO', SVS: 'SVS', PLANA: 'Plana' };

const $ = (sel) => document.querySelector(sel);

// ── Estado ────────────────────────────────────────────────────────────────

let state = {
  counts: {},   // unidad -> empleo -> número
  forming: [],  // compañías que forman (sin Plana)
  frente: 9,
  fondo: 8,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...state, ...saved };
    }
  } catch { /* sin almacenamiento: se sigue en memoria */ }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignorar */ }
}

const unitTotal = (u) =>
  Object.values(state.counts[u] || {}).reduce((s, n) => s + (Number(n) || 0), 0);

// ── Paso 1: números por unidad ────────────────────────────────────────────

function buildUnitCards() {
  const grid = $('#units-grid');
  grid.textContent = '';
  for (const unit of UNITS) {
    const ranks = unit.id === 'PLANA' ? PLANA_RANKS : COMPANY_RANKS;
    const card = document.createElement('div');
    card.className = 'unit-card';
    const h3 = document.createElement('h3');
    h3.innerHTML = `<span class="dot" style="background:${unit.color}"></span>${unit.name}
      <span class="total-badge" data-total="${unit.id}"></span>`;
    card.appendChild(h3);
    for (const r of ranks) {
      const row = document.createElement('div');
      row.className = 'rank-row';
      const id = `n-${unit.id}-${r}`;
      row.innerHTML = `<label for="${id}">${RANK_BY_ID[r].label}</label>
        <input id="${id}" type="number" inputmode="numeric" min="0" max="500" placeholder="0">`;
      const input = row.querySelector('input');
      const saved = state.counts[unit.id]?.[r];
      if (saved) { input.value = saved; input.classList.add('nonzero'); }
      input.addEventListener('input', () => {
        const n = Math.max(0, Math.floor(Number(input.value) || 0));
        state.counts[unit.id] = state.counts[unit.id] || {};
        state.counts[unit.id][r] = n;
        input.classList.toggle('nonzero', n > 0);
        updateTotals();
        saveState();
      });
      card.appendChild(row);
    }
    grid.appendChild(card);
  }
  updateTotals();
}

function updateTotals() {
  for (const unit of UNITS) {
    const el = document.querySelector(`[data-total="${unit.id}"]`);
    if (el) el.textContent = `${unitTotal(unit.id)} en total`;
  }
}

// ── Paso 2: quién forma ───────────────────────────────────────────────────

function buildFormingList() {
  const list = $('#forming-list');
  list.textContent = '';
  // Quitar del estado compañías marcadas que se quedaron sin números.
  state.forming = state.forming.filter((u) => unitTotal(u) > 0);
  for (const id of COMPANY_ORDER) {
    const unit = UNIT_BY_ID[id];
    const total = unitTotal(id);
    const row = document.createElement('label');
    row.className = 'forming-row' + (total === 0 ? ' disabled' : '');
    row.innerHTML = `<input type="checkbox" ${total === 0 ? 'disabled' : ''}
        ${state.forming.includes(id) ? 'checked' : ''}>
      <span class="dot" style="background:${unit.color}"></span>${unit.name}
      <span class="count">${total} pax</span>`;
    const cb = row.querySelector('input');
    row.classList.toggle('checked', cb.checked);
    cb.addEventListener('change', () => {
      if (cb.checked) state.forming.push(id);
      else state.forming = state.forming.filter((u) => u !== id);
      row.classList.toggle('checked', cb.checked);
      saveState();
    });
    list.appendChild(row);
  }
  const plana = document.createElement('label');
  plana.className = 'forming-row plana checked';
  plana.innerHTML = `<input type="checkbox" checked disabled>
    <span class="dot" style="background:${UNIT_BY_ID.PLANA.color}"></span>Plana
    <span class="count">forma siempre · ${unitTotal('PLANA')} pax</span>`;
  list.appendChild(plana);
}

// ── Paso 3: tamaño ────────────────────────────────────────────────────────

function updateSizeSummary() {
  const f = Number($('#frente').value) || 0;
  const d = Number($('#fondo').value) || 0;
  const el = $('#size-summary');
  if (f >= 1 && d >= 2) {
    el.textContent = `Caja de ${f * d} por compañía: ${f} jefes de pelotón + ${f} cabos + ${f * (d - 2)} regulares (más el capitán y los 3 jefes de sección).`;
  } else {
    el.textContent = 'El fondo mínimo es 2 (fila de jefes de pelotón + fila de cabos).';
  }
}

// ── Navegación del wizard ─────────────────────────────────────────────────

let step = 0;
const STEPS = 3;

function showStep(n) {
  step = Math.max(0, Math.min(STEPS - 1, n));
  document.querySelectorAll('.step').forEach((s) =>
    s.classList.toggle('hidden', Number(s.dataset.step) !== step));
  document.querySelectorAll('.step-dot').forEach((d) =>
    d.classList.toggle('active', Number(d.dataset.step) === step));
  $('#btn-back').classList.toggle('hidden', step === 0);
  $('#btn-next').classList.toggle('hidden', step === STEPS - 1);
  $('#btn-go').classList.toggle('hidden', step !== STEPS - 1);
  if (step === 1) buildFormingList();
  if (step === 2) updateSizeSummary();
  window.scrollTo({ top: 0 });
}

// ── Resultados ────────────────────────────────────────────────────────────

function unitTag(id) {
  const u = UNIT_BY_ID[id];
  return `<span class="unit-tag"><span class="dot" style="background:${u.color}"></span>${SHORT_NAME[id]}</span>`;
}

// "7 Sgto · 2 Sgto (MAPO) · 1 Cabo↑" — agrupa por empleo/origen/subida.
function fmtPeople(people, ownUnit) {
  const groups = new Map();
  for (const p of people) {
    if (!p) continue;
    const key = `${p.rank}|${p.origin}|${p.promoted ? 1 : 0}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  const parts = [...groups.entries()]
    .map(([key, n]) => {
      const [rank, origin, promoted] = key.split('|');
      return { rank, origin, promoted: promoted === '1', n };
    })
    .sort((a, b) =>
      RANK_INDEX[a.rank] - RANK_INDEX[b.rank] ||
      (a.origin === ownUnit ? -1 : 1) - (b.origin === ownUnit ? -1 : 1));
  if (!parts.length) return '<span class="empty-note">— nadie —</span>';
  return parts
    .map((g) => {
      let s = `${g.n} ${RANK_BY_ID[g.rank].short}`;
      if (g.promoted) s += '↑';
      if (g.origin !== ownUnit) s += ` <span class="agg">(${SHORT_NAME[g.origin]})</span>`;
      return s;
    })
    .join(' · ');
}

function posRow(name, detailHTML) {
  return `<div class="pos-row"><span class="pos-name">${name}:</span>
    <span class="pos-detail">${detailHTML}</span></div>`;
}

function warnList(warnings) {
  if (!warnings.length) return '';
  return `<ul class="warn-list">${warnings.map((w) => `<li>${w}</li>`).join('')}</ul>`;
}

function renderCompanyCards(result) {
  const wrap = $('#forming-results');
  wrap.textContent = '';

  // Plana primero.
  const p = result.plana;
  const planaTotal = [p.mando, ...p.oficiales, ...p.suboficiales].filter(Boolean).length;
  const planaCard = document.createElement('div');
  planaCard.className = 'result-card';
  planaCard.style.borderTopColor = UNIT_BY_ID.PLANA.color;
  planaCard.innerHTML = `
    <h3><span class="dot" style="background:${UNIT_BY_ID.PLANA.color}"></span>Plana
      <span class="total-badge">${planaTotal} formando</span></h3>
    ${posRow('Mando', p.mando ? fmtPeople([p.mando], 'PLANA') : '<span class="empty-note">vacante</span>')}
    ${posRow('Guion', 'guion del Tabor + acompañante <span class="empty-note">(aparte de los números)</span>')}
    ${posRow('Oficiales (3)', fmtPeople(p.oficiales, 'PLANA'))}
    ${posRow('Suboficiales (3)', fmtPeople(p.suboficiales, 'PLANA'))}
    ${warnList(p.warnings)}`;
  wrap.appendChild(planaCard);

  for (const c of result.companies) {
    const u = UNIT_BY_ID[c.unit];
    const all = [c.mando, ...c.jsec, ...c.jpn, ...c.cabos, ...c.regs].filter(Boolean);
    const agg = all.filter((x) => x.origin !== c.unit).length;
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.borderTopColor = u.color;
    card.innerHTML = `
      <h3><span class="dot" style="background:${u.color}"></span>${u.name}
        <span class="total-badge">${all.length} formando${agg ? ` · ${agg} agreg.` : ''}</span></h3>
      ${posRow('Mando', c.mando ? fmtPeople([c.mando], c.unit) : '<span class="empty-note">vacante</span>')}
      ${posRow('Banderín', `de la propia compañía <span class="empty-note">(aparte de los números)</span>`)}
      ${posRow('Jefes de Sección (3)', fmtPeople(c.jsec, c.unit))}
      ${posRow(`Jefes de Pelotón (${result.frente})`, fmtPeople(c.jpn, c.unit))}
      ${posRow(`Fila de cabos (${result.frente})`, fmtPeople(c.cabos, c.unit))}
      ${posRow(`Regulares (${(result.fondo - 2) * result.frente})`, fmtPeople(c.regs, c.unit))}
      ${warnList(c.warnings)}`;
    wrap.appendChild(card);
  }
}

function renderTransfers(result) {
  const wrap = $('#transfers-results');
  if (!result.transfers.length) {
    wrap.innerHTML = '<p class="empty-note">Nadie tiene que dar gente: todas las compañías se cubren solas.</p>';
    return;
  }
  const order = [...COMPANY_ORDER, 'PLANA'];
  const rows = [...result.transfers].sort((a, b) =>
    order.indexOf(a.from) - order.indexOf(b.from) ||
    order.indexOf(a.to) - order.indexOf(b.to) ||
    RANK_INDEX[a.rank] - RANK_INDEX[b.rank]);
  wrap.innerHTML = `<table class="simple">
    <thead><tr><th>Da</th><th>Empleo</th><th>Nº</th><th>Recibe</th></tr></thead>
    <tbody>${rows.map((t) => `<tr>
      <td>${unitTag(t.from)}</td>
      <td>${RANK_BY_ID[t.rank].label}</td>
      <td><strong>${t.count}</strong></td>
      <td>${unitTag(t.to)}</td>
    </tr>`).join('')}</tbody></table>`;
}

function renderLeftovers(result) {
  const wrap = $('#leftovers-results');
  const order = [...COMPANY_ORDER, 'PLANA'];
  const entries = order.filter((u) => result.leftovers[u]);
  if (!entries.length) {
    wrap.innerHTML = '<p class="empty-note">Todo el mundo forma.</p>';
    return;
  }
  wrap.innerHTML = `<table class="simple">
    <thead><tr><th>Unidad</th><th>Sin formar</th><th>Situación</th></tr></thead>
    <tbody>${entries.map((u) => {
      const detail = Object.entries(result.leftovers[u])
        .sort((a, b) => RANK_INDEX[a[0]] - RANK_INDEX[b[0]])
        .map(([r, n]) => `${n} ${RANK_BY_ID[r].short}`)
        .join(' · ');
      const forming = u === 'PLANA' || result.companies.some((c) => c.unit === u);
      return `<tr>
        <td>${unitTag(u)}</td>
        <td>${detail}</td>
        <td class="empty-note">${forming ? 'forma (excedente)' : 'no forma'}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function renderLegend() {
  const legend = $('#legend');
  legend.innerHTML =
    UNITS.map((u) =>
      `<span class="item"><span class="dot" style="background:${u.color}"></span>${u.name}</span>`
    ).join('') +
    `<span class="item"><span class="ring"></span>sube de puesto</span>
     <span class="item"><span class="hole"></span>hueco sin cubrir</span>`;
}

// ── Hoja de impresión: dibujo arriba y resumen compacto por unidad ────────

function psCard(unitId, badge, rows) {
  const u = UNIT_BY_ID[unitId];
  return `<div class="ps-card">
    <h4><span class="dot" style="background:${u.color}"></span>${u.name}
      <span class="muted">${badge}</span></h4>
    ${rows.map(([k, v]) => `<div class="ps-row"><b>${k}:</b> ${v}</div>`).join('')}
  </div>`;
}

function buildPrintSheet(result) {
  const givesByUnit = {};
  for (const t of result.transfers) (givesByUnit[t.from] = givesByUnit[t.from] || []).push(t);
  const fmtGives = (u) => (givesByUnit[u] || [])
    .sort((a, b) => RANK_INDEX[a.rank] - RANK_INDEX[b.rank])
    .map((t) => `${t.count} ${RANK_BY_ID[t.rank].short} → ${SHORT_NAME[t.to]}`)
    .join(' · ');
  const fmtLeft = (u) => Object.entries(result.leftovers[u] || {})
    .sort((a, b) => RANK_INDEX[a[0]] - RANK_INDEX[b[0]])
    .map(([r, n]) => `${n} ${RANK_BY_ID[r].short}`)
    .join(' · ');
  const extraRows = (u) => {
    const rows = [];
    if (givesByUnit[u]) rows.push(['Da', fmtGives(u)]);
    if (result.leftovers[u]) rows.push(['Sin formar', fmtLeft(u)]);
    return rows;
  };

  const cards = [];
  const p = result.plana;
  const pTotal = [p.mando, ...p.oficiales, ...p.suboficiales].filter(Boolean).length;
  cards.push(psCard('PLANA', `${pTotal} formando`, [
    ['Mando', p.mando ? fmtPeople([p.mando], 'PLANA') : 'vacante'],
    ['Oficiales', fmtPeople(p.oficiales, 'PLANA')],
    ['Subof.', fmtPeople(p.suboficiales, 'PLANA')],
    ...extraRows('PLANA'),
  ]));
  for (const c of result.companies) {
    const all = [c.mando, ...c.jsec, ...c.jpn, ...c.cabos, ...c.regs].filter(Boolean);
    const agg = all.filter((x) => x.origin !== c.unit).length;
    cards.push(psCard(c.unit, `${all.length} formando${agg ? ` · ${agg} agr.` : ''}`, [
      ['Mando', c.mando ? fmtPeople([c.mando], c.unit) : 'vacante'],
      ['JSec', fmtPeople(c.jsec, c.unit)],
      ['JPn', fmtPeople(c.jpn, c.unit)],
      ['Cabos', fmtPeople(c.cabos, c.unit)],
      ['Reg', fmtPeople(c.regs, c.unit)],
      ...extraRows(c.unit),
    ]));
  }
  for (const u of COMPANY_ORDER) {
    if (result.companies.some((c) => c.unit === u)) continue;
    const rows = extraRows(u);
    if (rows.length) cards.push(psCard(u, 'no forma', rows));
  }

  const sheet = $('#print-sheet');
  sheet.innerHTML = `
    <div class="ps-head">
      <span>FORMACIÓN ${result.frente}×${result.fondo}</span>
      <span class="date">${fileStamp()}</span>
    </div>
    <div class="ps-diagram"></div>
    <div class="ps-grid">${cards.join('')}</div>`;
  const svgClone = $('#diagram').cloneNode(true);
  svgClone.removeAttribute('id');
  svgClone.removeAttribute('width');
  svgClone.removeAttribute('height');
  sheet.querySelector('.ps-diagram').appendChild(svgClone);
}

function runAllocation() {
  if (!state.forming.length) {
    alert('Marca al menos una compañía que forme (paso 2).');
    showStep(1);
    return;
  }
  const frente = Math.floor(Number($('#frente').value));
  const fondo = Math.floor(Number($('#fondo').value));
  if (!(frente >= 1) || !(fondo >= 2)) {
    alert('Revisa el frente (mínimo 1) y el fondo (mínimo 2).');
    return;
  }
  state.frente = frente;
  state.fondo = fondo;
  saveState();

  const result = allocate({
    counts: state.counts,
    forming: state.forming,
    frente,
    fondo,
  });

  $('#global-warnings').innerHTML = warnList(result.plana.warnings.length || result.companies.some((c) => c.warnings.length)
    ? ['Revisa los avisos marcados en cada compañía.']
    : []);
  renderCompanyCards(result);
  renderTransfers(result);
  renderLeftovers(result);
  renderLegend();
  renderDiagram($('#diagram'), result);
  buildPrintSheet(result);

  $('#wizard').classList.add('hidden');
  $('#results').classList.remove('hidden');
  window.scrollTo({ top: 0 });
}

// ── Arranque ──────────────────────────────────────────────────────────────

loadState();
buildUnitCards();
$('#frente').value = state.frente;
$('#fondo').value = state.fondo;

$('#btn-next').addEventListener('click', () => showStep(step + 1));
$('#btn-back').addEventListener('click', () => showStep(step - 1));
$('#btn-go').addEventListener('click', runAllocation);
document.querySelectorAll('.step-dot').forEach((d) =>
  d.addEventListener('click', () => showStep(Number(d.dataset.step))));
$('#frente').addEventListener('input', () => { updateSizeSummary(); });
$('#fondo').addEventListener('input', () => { updateSizeSummary(); });

$('#btn-edit').addEventListener('click', () => {
  $('#results').classList.add('hidden');
  $('#wizard').classList.remove('hidden');
  window.scrollTo({ top: 0 });
});
// "Formacion 23-10-2026": nombre del PDF al imprimir y del PNG descargado.
function fileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}
$('#btn-png').addEventListener('click', () =>
  downloadPNG($('#diagram'), `Formacion ${fileStamp()}.png`));
$('#btn-print').addEventListener('click', () => {
  const dateEl = document.querySelector('#print-sheet .date');
  if (dateEl) dateEl.textContent = fileStamp();
  const prev = document.title;
  document.title = `Formacion ${fileStamp()}`;
  window.print();
  document.title = prev;
});
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('¿Borrar todos los números metidos?')) return;
  state = { counts: {}, forming: [], frente: 9, fondo: 8 };
  saveState();
  buildUnitCards();
  $('#frente').value = 9;
  $('#fondo').value = 8;
  showStep(0);
});

showStep(0);
