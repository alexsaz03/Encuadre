// Motor de encuadre. Funciones puras, sin DOM: se testea con node --test.
//
// Reglas:
//  - La gente propia siempre forma con su compañía; los agregados se suman.
//  - Dentro de la compañía que forma, los puestos se cubren por antigüedad
//    (empleo más alto primero); el excedente más moderno pasa al pool.
//  - Los donantes dan a los más modernos primero.
//  - Orden para dar y para recibir: 1 → 2 → 3 → 4 → MAPO → SVS.
//  - Cubrir la Plana (mando + 3 oficiales + 3 suboficiales) es la primera
//    prioridad del reparto de agregados.
//  - El mando de una compañía es siempre propio (Cap; si no, sube un Tte).
//  - El fondo incluye la fila de jefes de pelotón y la de cabos:
//    caja = frente × fondo = JPn (frente) + cabos (frente) + regulares ((fondo-2)·frente).

import { COMPANY_ORDER, RANKS, RANK_INDEX } from './data.js';

const ALL_UNITS = [...COMPANY_ORDER, 'PLANA'];

const modernFirst = (ranks) => [...ranks].sort((a, b) => RANK_INDEX[b] - RANK_INDEX[a]);

export function allocate({ counts, forming, frente, fondo }) {
  frente = Math.max(1, Math.floor(frente));
  fondo = Math.max(2, Math.floor(fondo));
  const formingOrdered = COMPANY_ORDER.filter((u) => forming.includes(u));

  // Disponibles por unidad y empleo.
  const avail = {};
  for (const u of ALL_UNITS) {
    avail[u] = {};
    for (const r of RANKS) {
      const n = counts[u] && counts[u][r.id];
      avail[u][r.id] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
  }

  const transfers = []; // {from, to, rank, count}
  function recordTransfer(from, to, rank) {
    const t = transfers.find((t) => t.from === from && t.to === to && t.rank === rank);
    if (t) t.count++;
    else transfers.push({ from, to, rank, count: 1 });
  }

  function takeOwn(unit, rank) {
    if (avail[unit][rank] > 0) {
      avail[unit][rank]--;
      return { rank, origin: unit };
    }
    return null;
  }

  // Cubre con gente propia por orden de antigüedad (prefs de más antiguo a más moderno).
  function fillOwn(unit, out, slots, prefs) {
    for (const rank of prefs) {
      while (out.length < slots) {
        const p = takeOwn(unit, rank);
        if (!p) break;
        out.push(p);
      }
    }
  }

  // Toma 1 persona del pool: donantes en orden 1-2-3-4-MAPO-SVS,
  // y dentro de cada donante los más modernos primero.
  function takePool(toUnit, eligible) {
    const ranks = modernFirst(eligible);
    for (const donor of COMPANY_ORDER) {
      if (donor === toUnit) continue;
      for (const rank of ranks) {
        if (avail[donor][rank] > 0) {
          avail[donor][rank]--;
          recordTransfer(donor, toUnit, rank);
          return { rank, origin: donor };
        }
      }
    }
    return null;
  }

  function fillFromPool(toUnit, out, slots, eligible) {
    while (out.length < slots) {
      const p = takePool(toUnit, eligible);
      if (!p) break;
      out.push(p);
    }
  }

  // Como fillFromPool, pero respetando la preferencia del puesto: se agota
  // cada empleo (en el orden dado) en todos los donantes antes de pasar al
  // siguiente. Para jefes de sección: todos los Tte disponibles antes que
  // ningún Bda, y estos antes que ningún Sgto 1º.
  function fillFromPoolByPreference(toUnit, out, slots, eligible) {
    for (const rank of eligible) {
      for (const donor of COMPANY_ORDER) {
        if (donor === toUnit) continue;
        while (out.length < slots && avail[donor][rank] > 0) {
          avail[donor][rank]--;
          recordTransfer(donor, toUnit, rank);
          out.push({ rank, origin: donor });
        }
      }
    }
  }

  // ── Plana: cubrir con gente propia ─────────────────────────────────────
  const plana = { unit: 'PLANA', mando: null, oficiales: [], suboficiales: [], warnings: [] };
  plana.mando = takeOwn('PLANA', 'TCOL') || takeOwn('PLANA', 'CTE');
  if (!plana.mando) plana.warnings.push('La Plana no tiene TCol ni Cte: el mando queda vacante.');
  fillOwn('PLANA', plana.oficiales, 3, ['CTE', 'CAP', 'TTE']);
  fillOwn('PLANA', plana.suboficiales, 3, ['BDA', 'SGTO1', 'SGTO']);

  // ── Compañías que forman: cubrir con gente propia ──────────────────────
  const regsSlots = (fondo - 2) * frente;
  const companies = formingOrdered.map((u) => {
    const c = { unit: u, mando: null, jsec: [], jpn: [], cabos: [], regs: [], warnings: [], missing: 0 };
    c.mando = takeOwn(u, 'CAP');
    if (!c.mando) {
      const t = takeOwn(u, 'TTE');
      if (t) {
        t.promoted = true;
        c.mando = t;
        c.warnings.push('Sin capitán propio: manda un teniente de la compañía.');
      } else {
        c.warnings.push('Sin capitán ni teniente propios: el mando queda vacante (no se agregan capitanes a las compañías).');
      }
    }
    fillOwn(u, c.jsec, 3, ['TTE', 'BDA', 'SGTO1']);
    fillOwn(u, c.jpn, frente, ['SGTO1', 'SGTO', 'CABO1']);
    fillOwn(u, c.cabos, frente, ['CABO']);
    fillOwn(u, c.regs, regsSlots, ['REG']);
    return c;
  });

  // ── Reparto del pool: la Plana primero ─────────────────────────────────
  fillFromPool('PLANA', plana.oficiales, 3, ['CTE', 'CAP', 'TTE']);
  fillFromPool('PLANA', plana.suboficiales, 3, ['BDA', 'SGTO1', 'SGTO']);
  if (plana.oficiales.length < 3)
    plana.warnings.push(`Faltan ${3 - plana.oficiales.length} oficial(es) para la fila de oficiales de la Plana.`);
  if (plana.suboficiales.length < 3)
    plana.warnings.push(`Faltan ${3 - plana.suboficiales.length} suboficial(es) para la fila de suboficiales de la Plana.`);

  // Después, las compañías por orden de recepción.
  for (const c of companies) {
    // Jefes de sección: siempre que haya tenientes, son ellos. Un Sgto 1º
    // propio solo se queda de JSec si no quedan tenientes en ninguna parte;
    // si llega un Tte agregado, el Sgto 1º baja (a JPn propio si hay hueco).
    while (true) {
      const i = c.jsec.findIndex((p) => p.rank === 'SGTO1');
      if (i < 0) break;
      const tte = takePool(c.unit, ['TTE']);
      if (!tte) break;
      const out = c.jsec.splice(i, 1, tte)[0];
      avail[out.origin][out.rank]++;
    }
    fillFromPoolByPreference(c.unit, c.jsec, 3, ['TTE', 'BDA', 'SGTO1']);
    // Recolocar en JPn al Sgto 1º propio que haya podido quedar liberado.
    fillOwn(c.unit, c.jpn, frente, ['SGTO1', 'SGTO', 'CABO1']);
    fillFromPool(c.unit, c.jpn, frente, ['SGTO1', 'SGTO', 'CABO1']);
    fillFromPool(c.unit, c.cabos, frente, ['CABO']);
    fillFromPool(c.unit, c.regs, regsSlots, ['REG']);
  }

  // ── Subidas de empleo cuando ni el pool llega ──────────────────────────
  for (const c of companies) {
    // Jefes de sección: sube un sargento propio.
    while (c.jsec.length < 3) {
      let p = takeOwn(c.unit, 'SGTO');
      if (!p) {
        const i = c.jpn.findIndex((x) => x.origin === c.unit && x.rank === 'SGTO');
        if (i >= 0) p = c.jpn.splice(i, 1)[0];
      }
      if (!p) break;
      p.promoted = true;
      c.jsec.push(p);
      c.warnings.push('Un sargento propio sube a jefe de sección.');
    }
    if (c.jsec.length < 3) c.warnings.push(`Faltan ${3 - c.jsec.length} jefe(s) de sección.`);

    // Jefes de pelotón: sube un cabo propio.
    while (c.jpn.length < frente) {
      let p = takeOwn(c.unit, 'CABO');
      if (!p) {
        const i = c.cabos.findIndex((x) => x.origin === c.unit && x.rank === 'CABO');
        if (i >= 0) p = c.cabos.splice(i, 1)[0];
      }
      if (!p) break;
      p.promoted = true;
      c.jpn.push(p);
      c.warnings.push('Un cabo propio sube a jefe de pelotón.');
    }
    if (c.jpn.length < frente) c.warnings.push(`Faltan ${frente - c.jpn.length} jefe(s) de pelotón.`);

    // Fila de cabos: los huecos los ocupan regulares, en las posiciones más a la izquierda.
    const regFill = [];
    while (c.cabos.length + regFill.length < frente) {
      let p = takeOwn(c.unit, 'REG') || takePool(c.unit, ['REG']);
      if (!p && c.regs.length > 0) p = c.regs.pop(); // se adelanta un regular de la caja
      if (!p) break;
      regFill.push(p);
    }
    c.cabos = [...regFill, ...c.cabos];

    // Rellenar la caja de regulares con lo que quede en el pool.
    fillFromPool(c.unit, c.regs, regsSlots, ['REG']);

    c.missing =
      (frente - c.jpn.length) + (frente - c.cabos.length) + (regsSlots - c.regs.length);
    if (c.missing > 0)
      c.warnings.push(`Faltan ${c.missing} persona(s) para completar la caja de ${frente}×${fondo}.`);
  }

  // ── Sin formar: lo que queda disponible en cada unidad ─────────────────
  const leftovers = {};
  for (const u of ALL_UNITS) {
    const rest = {};
    for (const r of RANKS) if (avail[u][r.id] > 0) rest[r.id] = avail[u][r.id];
    if (Object.keys(rest).length) leftovers[u] = rest;
  }

  return { plana, companies, transfers, leftovers, frente, fondo };
}

// Resumen empleo × origen de una compañía encuadrada (incluye mando y jefes).
export function companyComposition(c) {
  const people = [c.mando, ...c.jsec, ...c.jpn, ...c.cabos, ...c.regs].filter(Boolean);
  const byRank = {}; // rank -> origin -> count
  for (const p of people) {
    byRank[p.rank] = byRank[p.rank] || {};
    byRank[p.rank][p.origin] = (byRank[p.rank][p.origin] || 0) + 1;
  }
  return { byRank, total: people.length };
}

export function planaComposition(p) {
  const people = [p.mando, ...p.oficiales, ...p.suboficiales].filter(Boolean);
  const byRank = {};
  for (const x of people) {
    byRank[x.rank] = byRank[x.rank] || {};
    byRank[x.rank][x.origin] = (byRank[x.rank][x.origin] || 0) + 1;
  }
  return { byRank, total: people.length };
}
