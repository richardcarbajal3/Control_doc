// Unified document journey ("recorrido / trazabilidad").
//
// Every tracked document shares the same essence: a root document, a timeline,
// and a state. They split into two modes for the middle key:
//
//   · ESTADO mode  → RFI, RNC and similar correspondence. There is no revision;
//     the document moves through STATES over time (recibido → enviado / atendido).
//     The timeline is the sequence of transmittals ordered by date.
//
//   · REVISIÓN mode → every other deliverable (planos, procedimientos, memorias…).
//     Each revision is its own line; the governing one is the highest revision
//     (letters A<B<… then numbers 0<1<…). Its ESTATUS DE DOCUMENTO is the state.
//
// "Informativo" documents (info only, no follow-up) are excluded from both.
//
// State labels are NEVER rewritten: ESTADO mode keeps the RFI wording
// (Atendido / Atendido (tarde) / Pendiente); REVISIÓN mode shows the raw
// ESTATUS DE DOCUMENTO value (APROBADO / EN REVISIÓN / CON OBSERVACIONES / …).

import { isRfiDoc } from './isRfi';

const norm = (s) => (s == null ? '' : String(s)).toUpperCase().trim();
const INFORMATIVO_RE = /INFORMAT|INFORMAC/;

// A document is tracked unless it is "informativo" (marked in ESTATUS DE
// DOCUMENTO or, as a safety net, TIPO DE DOC). Codes are not uniform, so we
// include everything else.
export function isTrackedDoc(doc) {
  if (!doc) return false;
  const hay = `${doc.tipo_doc || ''} ${doc.status_contratista || ''}`.toUpperCase();
  return !INFORMATIVO_RE.test(hay);
}

// RFI / RNC (and similar correspondence) are tracked by STATE, not by revision.
export function isStateModeDoc(doc) {
  if (isRfiDoc(doc)) return true;
  const hay = `${doc.tipo_doc || ''} ${doc.documento_nro || ''} ${doc.descripcion || ''}`.toUpperCase();
  return /\bRNC\b|RNC[\s.\-N°#]/.test(hay);
}

// Human RFI/RNC number (e.g. "1001" from "RESPUESTA A RFI 1001 - ...").
function corrNumber(doc) {
  const text = `${doc.descripcion || ''} ${doc.documento_nro || ''}`.toUpperCase();
  const m = text.match(/(?:RFI|RNC)[\s.\-N°#]*?(\d{1,6})/);
  return m ? m[1] : null;
}

// Root key: the document number ties every revision / transmittal together.
// For correspondence (RFI/RNC) we fall back to the parsed number, then ref/id.
export function rootKey(doc) {
  const nro = norm(doc.documento_nro);
  if (nro) return nro;
  if (isStateModeDoc(doc)) {
    const n = corrNumber(doc);
    if (n) return `CORR:${n}`;
  }
  return norm(doc.transmittal) || norm(doc.referencia) || `#${doc.id}`;
}

// Orders a revision so letters rank below numbers:
//   (vacío) < A < B < … < Z < 0 < 1 < 2 … (los números crecen sin límite)
export function revRank(rev) {
  const r = norm(rev);
  if (r === '') return -1;
  if (/^\d+$/.test(r)) return 1000 + parseInt(r, 10);
  let rank = 0;
  for (const ch of r) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) rank = rank * 26 + (c - 64); // A=1, B=2 …
  }
  return rank > 0 ? rank : 0;
}

function fechaTime(d) {
  if (!d || !d.fecha) return Number.NEGATIVE_INFINITY;
  const t = new Date(d.fecha).getTime();
  return isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

const isRespuesta = (d) => norm(d.descripcion).startsWith('RESPUESTA') || norm(d.descripcion).includes('RESPUESTA A');

// ── ESTADO mode (RFI / RNC) ────────────────────────────────────────────────
// Reproduces the RFI journey: recibido (inicio) → enviado / atendido (cierre).
// Keeps the original wording for the state.
function buildStateJourney(key, docs) {
  const sorted = [...docs].sort((a, b) => fechaTime(a) - fechaTime(b));

  const inicio =
    sorted.find((d) => norm(d.status) === 'RECIBIDO' && !isRespuesta(d)) ||
    sorted.find((d) => !isRespuesta(d)) ||
    sorted[0];
  const cierre =
    sorted.find((d) => d !== inicio && (norm(d.status) === 'ENVIADO' || isRespuesta(d))) ||
    sorted.find((d) => d !== inicio) ||
    null;

  const atendido = sorted.some((d) => norm(d.status_g) === 'ATENDIDO');
  const cerrado = !!cierre || atendido;

  let diasRespuesta = null;
  if (inicio && cierre) {
    const ti = fechaTime(inicio), tc = fechaTime(cierre);
    if (isFinite(ti) && isFinite(tc)) diasRespuesta = Math.round((tc - ti) / 86400000);
  }

  // Estado con las MISMAS palabras de antes (estado del transmittal).
  const late = cerrado && inicio?.fecha_vencimiento && cierre &&
    new Date(cierre.fecha) > new Date(inicio.fecha_vencimiento);
  let estadoText, estadoKind;
  if (cerrado) {
    estadoText = late ? 'Atendido (tarde)' : 'Atendido';
    estadoKind = late ? 'warn' : 'ok';
  } else {
    estadoText = 'Pendiente';
    estadoKind = 'info';
  }

  return {
    key, mode: 'estado',
    root: inicio.documento_nro || cierre?.documento_nro || '',
    descripcion: inicio.descripcion || cierre?.descripcion || '',
    n_contrato: inicio.n_contrato || cierre?.n_contrato || '',
    docs: sorted,
    inicio, cierre, diasRespuesta,
    clave: cierre ? 'Atendido' : 'Pendiente',
    fechaControla: (cierre || inicio)?.fecha || null,
    docControla: cierre || inicio,
    estadoText, estadoKind,
    estadoTitle: late ? 'Atendido fuera de plazo' : (cerrado ? 'Atendido / respuesta enviada' : 'A la espera de respuesta'),
    lineas: sorted.length,
  };
}

// ── REVISIÓN mode (planos / procedimientos / etc.) ─────────────────────────
// Color for a raw ESTATUS DE DOCUMENTO value (the text itself is shown as-is).
function revEstadoKind(raw) {
  const s = norm(raw);
  if (!s) return 'info';
  if (/APROBAD|ATENDIDO|CERRAD/.test(s)) return 'ok';
  if (/OBSERV|COMENTARIO/.test(s)) return 'warn';
  if (/ANULAD/.test(s)) return 'soft';
  if (/VENCID|RECHAZAD|NO APROB|OBSOLET/.test(s)) return 'danger';
  return 'info'; // EN REVISIÓN, RECIBIDO, PENDIENTE…
}

// Raw state text for a revision (kept verbatim; falls back to "Pendiente").
export function revEstadoText(doc) {
  const raw = doc?.status_contratista;
  return raw && String(raw).trim() ? String(raw).trim() : 'Pendiente';
}

function buildRevisionJourney(key, docs) {
  const sorted = [...docs].sort((a, b) => {
    const dr = revRank(a.rev) - revRank(b.rev);
    return dr !== 0 ? dr : fechaTime(a) - fechaTime(b);
  });

  const primera = sorted[0];
  const controla = sorted[sorted.length - 1]; // la revisión mayor manda
  const estadoText = revEstadoText(controla);

  return {
    key, mode: 'revision',
    root: controla.documento_nro || primera.documento_nro || '',
    descripcion: controla.descripcion || primera.descripcion || '',
    n_contrato: controla.n_contrato || primera.n_contrato || '',
    docs: sorted,
    primera, controla,
    clave: controla.rev ? `Rev ${controla.rev}` : '—',
    fechaControla: controla.fecha || null,
    docControla: controla,
    estadoText,
    estadoKind: revEstadoKind(controla.status_contratista),
    estadoTitle: 'Estado de la revisión que manda (ESTATUS DE DOCUMENTO)',
    lineas: sorted.length,
  };
}

// Groups every tracked document into one journey per root, choosing the mode
// per group. Sorted: open items first, then by most recent activity.
export function groupDocJourneys(documents) {
  const groups = new Map();
  for (const doc of documents) {
    if (!isTrackedDoc(doc)) continue;
    const key = rootKey(doc);
    if (!groups.has(key)) groups.set(key, { docs: [], state: false });
    const g = groups.get(key);
    g.docs.push(doc);
    if (isStateModeDoc(doc)) g.state = true;
  }

  const journeys = [...groups.entries()].map(([key, g]) =>
    g.state ? buildStateJourney(key, g.docs) : buildRevisionJourney(key, g.docs)
  );

  // "open" = not yet resolved (Pendiente / EN REVISIÓN / sin aprobar).
  const isOpen = (j) => j.estadoKind === 'info' || j.estadoKind === 'warn';
  const lastTime = (j) => {
    const all = j.docs.map(fechaTime).filter((t) => isFinite(t));
    return all.length ? Math.max(...all) : 0;
  };
  return journeys.sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
    return lastTime(b) - lastTime(a);
  });
}
