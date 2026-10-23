// Constantes del dominio: unidades, empleos, colores y órdenes de preferencia.

export const RANKS = [
  { id: 'TCOL',  label: 'Teniente Coronel', short: 'TCol' },
  { id: 'CTE',   label: 'Comandante',       short: 'Cte' },
  { id: 'CAP',   label: 'Capitán',          short: 'Cap' },
  { id: 'TTE',   label: 'Teniente',         short: 'Tte' },
  { id: 'BDA',   label: 'Brigada',          short: 'Bda' },
  { id: 'SGTO1', label: 'Sargento 1º',      short: 'Sgto 1º' },
  { id: 'SGTO',  label: 'Sargento',         short: 'Sgto' },
  { id: 'CABO1', label: 'Cabo 1º',          short: 'Cabo 1º' },
  { id: 'CABO',  label: 'Cabo',             short: 'Cabo' },
  { id: 'REG',   label: 'Regular',          short: 'Reg' },
];

// Índice de antigüedad: menor índice = más antiguo.
export const RANK_INDEX = Object.fromEntries(RANKS.map((r, i) => [r.id, i]));
export const RANK_BY_ID = Object.fromEntries(RANKS.map((r) => [r.id, r]));

export const UNITS = [
  { id: '1',     name: '1ª Compañía', short: '1', color: '#d32f2f', text: '#ffffff' },
  { id: '2',     name: '2ª Compañía', short: '2', color: '#fbc02d', text: '#3e2723' },
  { id: '3',     name: '3ª Compañía', short: '3', color: '#ffffff', text: '#37474f', border: '#546e7a' },
  { id: '4',     name: '4ª Compañía', short: '4', color: '#aed581', text: '#33691e' },
  { id: 'MAPO',  name: 'MAPO',        short: 'M', color: '#1b5e20', text: '#ffffff' },
  { id: 'SVS',   name: 'SVS',         short: 'S', color: '#0d47a1', text: '#ffffff' },
  { id: 'PLANA', name: 'Plana',       short: 'P', color: '#558b2f', text: '#ffffff' },
];

export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]));

// Orden tanto para dar como para recibir agregados.
export const COMPANY_ORDER = ['1', '2', '3', '4', 'MAPO', 'SVS'];

// Empleos que se piden a cada unidad en el formulario.
export const COMPANY_RANKS = ['CAP', 'TTE', 'BDA', 'SGTO1', 'SGTO', 'CABO1', 'CABO', 'REG'];
export const PLANA_RANKS = ['TCOL', 'CTE', ...COMPANY_RANKS];
