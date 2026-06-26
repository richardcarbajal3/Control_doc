import type { ContractData } from './excel-processor';

// ---------- Interfaces ----------

export interface AvanceDayEntry {
  fecha: Date | null;
  fechaStr: string;
  semana: number;
  dia: number;
  avanceProgramado: number;
  avanceProgramadoAcum: number;
  avanceReal: number;
  avanceRealAcum: number;
  observaciones: string;
  superado: string;
  completo: string;
  rfi: string;
  rptaRfi: string;
  dentroDePlazo: string;
  rnc: string;
  rncLevantada: string;
  scOc: string;
  scOcAprobada: string;
}

export interface AvanceKpis {
  programadoActual: number;
  realActual: number;
  desviacion: number;
  spi: number;
  rfisAbiertos: number;
  rncsAbiertos: number;
  diasRegistrados: number;
  ultimaFecha: string;
}

export interface WeeklySummary {
  semana: number;
  programado: number;
  real: number;
  programadoAcum: number;
  realAcum: number;
}

// ---------- Spanish date parsing ----------

const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

/**
 * Parse various date formats → Date
 * Supports: "miércoles, 18 de Marzo de 2026", "18/03/2026", "2026-03-18", Excel serial numbers
 */
export function parseSpanishDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Handle Excel serial number (numeric)
  if (typeof dateStr === 'number' || /^\d{5}$/.test(String(dateStr).trim())) {
    const serial = typeof dateStr === 'number' ? dateStr : parseFloat(String(dateStr).trim());
    if (serial > 1 && serial < 100000) {
      // Convert serial to UTC ms, then extract UTC components to avoid timezone shift
      const utcMs = Math.round((serial - 25569) * 86400 * 1000);
      const tmp = new Date(utcMs);
      return new Date(tmp.getUTCFullYear(), tmp.getUTCMonth(), tmp.getUTCDate());
    }
  }

  if (typeof dateStr !== 'string') return null;
  const str = dateStr.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
  }

  // YYYY-MM-DD (ISO)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }

  // Spanish text: "miércoles, 18 de Marzo de 2026"
  const cleaned = str.replace(/^[a-záéíóúñü]+,\s*/i, '').trim();
  const m = cleaned.match(/^(\d{1,2})\s+de\s+([a-záéíóúñü]+)\s+de\s+(\d{4})$/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MESES[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (month === undefined || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month, day);
}

/** Format Date → "DD/MM/YYYY" */
export function formatShortDate(d: Date | null): string {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ---------- Data extraction ----------

function clean(val: any): string {
  if (val == null) return '';
  const s = String(val).trim();
  return s === '-' ? '' : s;
}

function toPercent(val: any): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val > 1 ? val : val * 100;
  const s = String(val).trim().replace('%', '').replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  // If original string had %, value is already a percentage
  return String(val).includes('%') ? n : (n > 1 ? n : n * 100);
}

function findValue(data: Record<string, any>, ...candidates: string[]): any {
  // First pass: exact match
  for (const key of Object.keys(data)) {
    const upper = key.trim().toUpperCase().replace(/\s+/g, ' ');
    for (const c of candidates) {
      if (upper === c.toUpperCase()) {
        return data[key];
      }
    }
  }
  // Second pass: includes match
  for (const key of Object.keys(data)) {
    const upper = key.trim().toUpperCase().replace(/\s+/g, ' ');
    for (const c of candidates) {
      if (upper.includes(c.toUpperCase())) {
        return data[key];
      }
    }
  }
  return undefined;
}

/** Like findValue but excludes columns containing any of the excludeTerms */
function findValueExcluding(data: Record<string, any>, excludeTerms: string[], ...candidates: string[]): any {
  // First pass: exact match
  for (const key of Object.keys(data)) {
    const upper = key.trim().toUpperCase().replace(/\s+/g, ' ');
    if (excludeTerms.some(ex => upper.includes(ex.toUpperCase()))) continue;
    for (const c of candidates) {
      if (upper === c.toUpperCase()) {
        return data[key];
      }
    }
  }
  // Second pass: includes match
  for (const key of Object.keys(data)) {
    const upper = key.trim().toUpperCase().replace(/\s+/g, ' ');
    if (excludeTerms.some(ex => upper.includes(ex.toUpperCase()))) continue;
    for (const c of candidates) {
      if (upper.includes(c.toUpperCase())) {
        return data[key];
      }
    }
  }
  return undefined;
}

/**
 * Extract avance day entries from a contract's specializedData.
 * Works with sheetType containing "avance".
 */
export function extractAvanceData(contract: ContractData): AvanceDayEntry[] {
  const entries: AvanceDayEntry[] = [];

  for (const sd of contract.specializedData) {
    if (!sd.sheetType.toLowerCase().includes('avance')) continue;
    const d = sd.data;

    const rawFecha = findValue(d, 'FECHA');
    const fechaStr = clean(rawFecha);
    const fecha = parseSpanishDate(rawFecha) || parseSpanishDate(fechaStr);

    entries.push({
      fecha,
      fechaStr,
      semana: parseInt(String(findValue(d, 'SEMANA') ?? 0), 10) || 0,
      dia: parseInt(String(findValue(d, 'DIA') ?? 0), 10) || 0,
      avanceProgramado: toPercent(findValueExcluding(d, ['ACUM'], 'AVANCE PROGRAMADO')),
      avanceProgramadoAcum: toPercent(findValue(d, 'AVANCE PROGRAMADO ACUM', 'PROGRAMADO ACUM')),
      avanceReal: toPercent(findValueExcluding(d, ['ACUM'], 'AVANCE REAL')),
      avanceRealAcum: toPercent(findValue(d, 'AVANCE REAL ACUM', 'REAL ACUM')),
      observaciones: clean(findValue(d, 'OBSERVACIONES')),
      superado: clean(findValue(d, 'SUPERADO')),
      completo: clean(findValue(d, 'COMPLETO')),
      rfi: clean(findValue(d, 'RFI')),
      rptaRfi: clean(findValue(d, 'RPTA RFI')),
      dentroDePlazo: clean(findValue(d, 'DENTRO DE PLAZO')),
      rnc: clean(findValue(d, 'RNC')),
      rncLevantada: clean(findValue(d, 'RNC LEVANTADA')),
      scOc: clean(findValue(d, 'SC, OC', 'SC OC')),
      scOcAprobada: clean(findValue(d, 'SC, OC2 APROBADA', 'SC OC APROBADA', 'SC, OC APROBADA')),
    });
  }

  // Sort by day number
  entries.sort((a, b) => a.dia - b.dia);

  // If cumulative columns are all zero but daily values exist, compute running sums
  const hasAcumProg = entries.some(e => e.avanceProgramadoAcum > 0);
  const hasAcumReal = entries.some(e => e.avanceRealAcum > 0);
  const hasDailyProg = entries.some(e => e.avanceProgramado > 0);
  const hasDailyReal = entries.some(e => e.avanceReal > 0);

  if (!hasAcumProg && hasDailyProg) {
    let sum = 0;
    for (const e of entries) {
      sum += e.avanceProgramado;
      e.avanceProgramadoAcum = Math.round(sum * 100) / 100;
    }
  }
  if (!hasAcumReal && hasDailyReal) {
    let sum = 0;
    for (const e of entries) {
      sum += e.avanceReal;
      e.avanceRealAcum = Math.round(sum * 100) / 100;
    }
  }

  // Enforce monotonic non-decreasing cumulative values
  let maxProg = 0;
  let maxReal = 0;
  for (const e of entries) {
    if (e.avanceProgramadoAcum > 0) {
      maxProg = Math.max(maxProg, e.avanceProgramadoAcum);
      e.avanceProgramadoAcum = maxProg;
    }
    if (e.avanceRealAcum > 0) {
      maxReal = Math.max(maxReal, e.avanceRealAcum);
      e.avanceRealAcum = maxReal;
    }
  }

  return entries;
}

/**
 * Extract avance data grouped by contract ID (N° CONTRATO level).
 * Merges all addendums for the same contract.
 */
export function extractAvanceByContract(contracts: ContractData[]): Map<string, AvanceDayEntry[]> {
  const map = new Map<string, AvanceDayEntry[]>();
  for (const c of contracts) {
    const entries = extractAvanceData(c);
    if (entries.length === 0) continue;
    const existing = map.get(c.contractId) || [];
    map.set(c.contractId, [...existing, ...entries]);
  }
  // Sort each contract's entries by day
  Array.from(map.entries()).forEach(([key, entries]) => {
    map.set(key, entries.sort((a: AvanceDayEntry, b: AvanceDayEntry) => a.dia - b.dia));
  });
  return map;
}

/**
 * Get list of contracts that have avance data.
 */
export function getContractsWithAvance(contracts: ContractData[]): ContractData[] {
  const seen = new Set<string>();
  const result: ContractData[] = [];
  for (const c of contracts) {
    if (seen.has(c.contractId)) continue;
    const hasAvance = c.specializedData.some(s => s.sheetType.toLowerCase().includes('avance'));
    if (hasAvance) {
      seen.add(c.contractId);
      result.push(c);
    }
  }
  return result;
}

// ---------- KPI computation ----------

/**
 * Find the index of the last entry that truly has real progress reported.
 * Handles the case where Excel carries forward the accumulated value into future days.
 */
export function findLastRealDayIndex(entries: AvanceDayEntry[]): number {
  // Strategy 1: last entry with daily avanceReal > 0
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].avanceReal > 0) return i;
  }

  // Strategy 2: last entry where avanceRealAcum increased from previous
  for (let i = entries.length - 1; i >= 1; i--) {
    if (entries[i].avanceRealAcum > 0 && entries[i].avanceRealAcum > entries[i - 1].avanceRealAcum) {
      return i;
    }
  }

  // Strategy 3: first entry with any real acum > 0 (only 1 day of data)
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].avanceRealAcum > 0) return i;
  }

  return -1;
}

export function computeAvanceKpis(entries: AvanceDayEntry[]): AvanceKpis {
  if (entries.length === 0) {
    return { programadoActual: 0, realActual: 0, desviacion: 0, spi: 0, rfisAbiertos: 0, rncsAbiertos: 0, diasRegistrados: 0, ultimaFecha: '' };
  }

  // Find the last entry that truly has real progress (not carried-forward values)
  const lastRealIdx = findLastRealDayIndex(entries);
  const comparisonEntry = lastRealIdx >= 0 ? entries[lastRealIdx] : entries[entries.length - 1];
  const programado = comparisonEntry.avanceProgramadoAcum;
  const real = comparisonEntry.avanceRealAcum;
  const desviacion = real - programado;
  const spi = programado > 0 ? real / programado : 0;

  // Count open RFIs: has RFI but no response
  const rfisAbiertos = entries.filter(e => e.rfi && !e.rptaRfi).length;
  // Count open RNCs: has RNC but not resolved
  const rncsAbiertos = entries.filter(e => e.rnc && !e.rncLevantada).length;

  return {
    programadoActual: programado,
    realActual: real,
    desviacion,
    spi,
    rfisAbiertos,
    rncsAbiertos,
    diasRegistrados: entries.length,
    ultimaFecha: comparisonEntry.fechaStr,
  };
}

// ---------- Weekly grouping ----------

export function groupByWeek(entries: AvanceDayEntry[]): WeeklySummary[] {
  const weekMap = new Map<number, { programado: number; real: number; programadoAcum: number; realAcum: number }>();

  for (const e of entries) {
    if (e.semana <= 0) continue;
    const existing = weekMap.get(e.semana);
    if (existing) {
      existing.programado += e.avanceProgramado;
      existing.real += e.avanceReal;
      // Keep the last (highest) cumulative values for the week
      if (e.avanceProgramadoAcum > 0) existing.programadoAcum = Math.max(existing.programadoAcum, e.avanceProgramadoAcum);
      if (e.avanceRealAcum > 0) existing.realAcum = Math.max(existing.realAcum, e.avanceRealAcum);
    } else {
      weekMap.set(e.semana, {
        programado: e.avanceProgramado,
        real: e.avanceReal,
        programadoAcum: e.avanceProgramadoAcum,
        realAcum: e.avanceRealAcum,
      });
    }
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([semana, data]) => ({
      semana,
      programado: Math.round(data.programado * 100) / 100,
      real: Math.round(data.real * 100) / 100,
      programadoAcum: Math.round(data.programadoAcum * 100) / 100,
      realAcum: Math.round(data.realAcum * 100) / 100,
    }));
}
