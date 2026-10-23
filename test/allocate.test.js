import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate } from '../js/allocate.js';

// Plana justa: TCol de mando, 3 oficiales y 3 suboficiales propios.
const PLANA_OK = { TCOL: 1, CTE: 1, CAP: 1, TTE: 1, BDA: 1, SGTO1: 1, SGTO: 1 };

// Compañía exacta para una caja 9x8: 1 Cap, 3 Tte, 9 JPn (2 Sgto1 + 7 Sgto), 9 cabos, 54 reg.
const CIA_EXACTA = { CAP: 1, TTE: 3, SGTO1: 2, SGTO: 7, CABO: 9, REG: 54 };

function base(extra = {}) {
  return {
    counts: { PLANA: { ...PLANA_OK }, ...extra },
    forming: Object.keys(extra),
    frente: 9,
    fondo: 8,
  };
}

test('compañía exacta: sin avisos, sin transferencias, caja completa', () => {
  const r = allocate(base({ 1: { ...CIA_EXACTA } }));
  const c = r.companies[0];
  assert.equal(c.mando.rank, 'CAP');
  assert.equal(c.jsec.length, 3);
  assert.deepEqual(c.jsec.map((p) => p.rank), ['TTE', 'TTE', 'TTE']);
  assert.equal(c.jpn.length, 9);
  assert.equal(c.cabos.length, 9);
  assert.equal(c.regs.length, 54);
  assert.equal(c.warnings.length, 0);
  assert.equal(r.transfers.length, 0);
  assert.equal(r.plana.mando.rank, 'TCOL');
  assert.equal(r.plana.oficiales.length, 3);
  assert.equal(r.plana.suboficiales.length, 3);
  assert.equal(r.plana.warnings.length, 0);
});

test('excedente de compañía que forma cubre a otra que forma (ej. del Cabo 1º)', () => {
  // 1ª tiene 10 para JPn (1 Sgto1, 8 Sgto, 1 Cabo1): el Cabo 1º (más moderno) sobra.
  // 2ª tiene solo 8 JPn: recibe al Cabo 1º de la 1ª.
  const r = allocate(base({
    1: { ...CIA_EXACTA, SGTO1: 1, SGTO: 8, CABO1: 1 },
    2: { ...CIA_EXACTA, SGTO1: 1, SGTO: 7 }, // 8 JPn
  }));
  const c1 = r.companies.find((c) => c.unit === '1');
  const c2 = r.companies.find((c) => c.unit === '2');
  assert.equal(c1.jpn.filter((p) => p.rank === 'CABO1').length, 0); // el cabo 1º no forma con la 1ª
  assert.equal(c2.jpn.length, 9);
  assert.deepEqual(
    r.transfers.filter((t) => t.rank === 'CABO1'),
    [{ from: '1', to: '2', rank: 'CABO1', count: 1 }]
  );
});

test('las unidades que no forman dan a los más modernos primero', () => {
  // MAPO no forma: 2 Sgto1 y 2 Sgto. La 1ª necesita 2 JPn: recibe los 2 Sgto.
  const input = base({ 1: { ...CIA_EXACTA, SGTO1: 1, SGTO: 6 } }); // 7 JPn, faltan 2
  input.counts.MAPO = { SGTO1: 2, SGTO: 2 };
  const r2 = allocate(input);
  const c1 = r2.companies[0];
  assert.equal(c1.jpn.length, 9);
  assert.deepEqual(r2.transfers, [{ from: 'MAPO', to: '1', rank: 'SGTO', count: 2 }]);
  assert.deepEqual(r2.leftovers.MAPO, { SGTO1: 2 }); // los antiguos se quedan sin formar
});

test('orden de donantes 1-2-3-4-MAPO-SVS', () => {
  const input = base({ 3: { ...CIA_EXACTA, REG: 50 } }); // faltan 4 regulares
  input.counts['1'] = { REG: 2 };
  input.counts.SVS = { REG: 10 };
  const r = allocate(input);
  assert.deepEqual(r.transfers, [
    { from: '1', to: '3', rank: 'REG', count: 2 },
    { from: 'SVS', to: '3', rank: 'REG', count: 2 },
  ]);
  assert.deepEqual(r.leftovers.SVS, { REG: 8 });
});

test('los jefes de sección son tenientes siempre que los haya', () => {
  // La 1ª cubre sus JSec con 1 Tte, 1 Bda y 1 Sgto 1º propios, pero MAPO
  // (no forma) tiene un Tte: el Sgto 1º le cede el puesto y baja a JPn.
  const input = base({ 1: { ...CIA_EXACTA, TTE: 1, BDA: 1, SGTO1: 2, SGTO: 7 } });
  input.counts.MAPO = { TTE: 1 };
  const r = allocate(input);
  const c = r.companies[0];
  assert.deepEqual(c.jsec.map((p) => p.rank).sort(), ['BDA', 'TTE', 'TTE']);
  assert.ok(c.jsec.some((p) => p.rank === 'TTE' && p.origin === 'MAPO'));
  assert.ok(!c.jsec.some((p) => p.rank === 'SGTO1'));
  assert.equal(c.jpn.filter((p) => p.rank === 'SGTO1').length, 2); // el liberado vuelve a JPn
});

test('para JSec se prefiere un Bda agregado antes que un Sgto 1º agregado', () => {
  const input = base({ 1: { ...CIA_EXACTA, TTE: 1, SGTO1: 0, SGTO: 9 } }); // faltan 2 JSec
  input.counts['2'] = { SGTO1: 2 }; // donante anterior en el orden, pero más moderno
  input.counts.MAPO = { BDA: 2 };
  const r = allocate(input);
  const c = r.companies[0];
  assert.deepEqual(c.jsec.map((p) => p.rank).sort(), ['BDA', 'BDA', 'TTE']);
  assert.ok(c.jsec.every((p) => p.rank !== 'SGTO1'));
});

test('sin capitán propio: sube el teniente; nunca se agrega un capitán', () => {
  const input = base({ 1: { ...CIA_EXACTA, CAP: 0, TTE: 4 } });
  input.counts.MAPO = { CAP: 3 }; // capitanes disponibles fuera, pero no valen para mandar
  const r = allocate(input);
  const c = r.companies[0];
  assert.equal(c.mando.rank, 'TTE');
  assert.equal(c.mando.promoted, true);
  assert.equal(c.mando.origin, '1');
  assert.ok(!r.transfers.some((t) => t.rank === 'CAP' && t.to === '1'));
});

test('sin capitán ni teniente: mando vacante con aviso', () => {
  const input = base({ 1: { ...CIA_EXACTA, CAP: 0, TTE: 0, BDA: 3 } });
  const r = allocate(input);
  const c = r.companies[0];
  assert.equal(c.mando, null);
  assert.ok(c.warnings.some((w) => w.includes('vacante')));
  assert.equal(c.jsec.length, 3); // los brigadas cubren las secciones
});

test('subidas en cascada: sargento a jefe de sección y cabo a jefe de pelotón', () => {
  // Sin Tte/Bda/Sgto1 en ninguna parte: suben sargentos propios a JSec,
  // y los huecos de JPn los cubren cabos propios subidos.
  const input = {
    counts: {
      PLANA: { ...PLANA_OK },
      1: { CAP: 1, SGTO: 9, CABO: 12, REG: 60 },
    },
    forming: ['1'],
    frente: 9,
    fondo: 8,
  };
  const r = allocate(input);
  const c = r.companies[0];
  assert.equal(c.jsec.length, 3);
  assert.ok(c.jsec.every((p) => p.rank === 'SGTO' && p.promoted && p.origin === '1'));
  assert.equal(c.jpn.length, 9); // 6 sgto + 3 cabos subidos
  assert.equal(c.jpn.filter((p) => p.rank === 'CABO' && p.promoted).length, 3);
  assert.equal(c.cabos.length, 9); // 9 cabos quedan tras subir 3... quedan 9 de 12
});

test('la fila de cabos se completa con regulares por la izquierda', () => {
  const input = base({ 1: { ...CIA_EXACTA, CABO: 4, REG: 60 } });
  const r = allocate(input);
  const c = r.companies[0];
  assert.equal(c.cabos.length, 9);
  assert.deepEqual(c.cabos.slice(0, 5).map((p) => p.rank), ['REG', 'REG', 'REG', 'REG', 'REG']);
  assert.deepEqual(c.cabos.slice(5).map((p) => p.rank), ['CABO', 'CABO', 'CABO', 'CABO']);
  assert.equal(c.regs.length, 54); // la caja sigue completa (60 - 5 adelantados - 1 sobrante)
});

test('cubrir la Plana es prioritario sobre las compañías', () => {
  // La Plana no tiene suboficiales; MAPO (no forma) tiene 1 único Sgto,
  // que también haría falta a la 1ª como JPn. Se lo lleva la Plana.
  const input = {
    counts: {
      PLANA: { TCOL: 1, CTE: 1, CAP: 1, TTE: 1, BDA: 1, SGTO1: 1 }, // falta 1 suboficial
      1: { ...CIA_EXACTA, SGTO: 6 }, // faltan JPn
      MAPO: { SGTO: 1 },
    },
    forming: ['1'],
    frente: 9,
    fondo: 8,
  };
  const r = allocate(input);
  assert.equal(r.plana.suboficiales.length, 3);
  assert.ok(r.transfers.some((t) => t.from === 'MAPO' && t.to === 'PLANA' && t.rank === 'SGTO'));
  // La 1ª no recibe al sargento de MAPO: acaba subiendo un cabo propio a JPn.
  const c1 = r.companies[0];
  assert.ok(!r.transfers.some((t) => t.to === '1' && t.rank === 'SGTO'));
  assert.ok(c1.jpn.some((p) => p.rank === 'CABO' && p.promoted));
  assert.ok(c1.missing > 0); // y se queda corta en la caja
});

test('la Plana se cubre con compañías cuando su gente no llega', () => {
  const input = {
    counts: {
      PLANA: { CTE: 1 }, // solo el mando
      1: { ...CIA_EXACTA, TTE: 6, BDA: 2, SGTO1: 4, SGTO: 7 },
    },
    forming: ['1'],
    frente: 9,
    fondo: 8,
  };
  const r = allocate(input);
  assert.equal(r.plana.mando.rank, 'CTE');
  assert.equal(r.plana.oficiales.length, 3);
  assert.ok(r.plana.oficiales.every((p) => p.origin === '1' && p.rank === 'TTE'));
  assert.equal(r.plana.suboficiales.length, 3);
});

test('caja incompleta: aviso con cuántos faltan', () => {
  const input = {
    counts: { PLANA: { ...PLANA_OK }, 1: { ...CIA_EXACTA, REG: 40 } },
    forming: ['1'],
    frente: 9,
    fondo: 8,
  };
  const r = allocate(input);
  const c = r.companies[0];
  assert.equal(c.missing, 14);
  assert.ok(c.warnings.some((w) => w.includes('Faltan 14')));
});

test('el fondo incluye las filas de JPn y cabos (9x8 = caja de 72)', () => {
  const r = allocate(base({ 1: { ...CIA_EXACTA } }));
  const c = r.companies[0];
  assert.equal(c.jpn.length + c.cabos.length + c.regs.length, 72);
});
