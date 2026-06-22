// RFI journey grouping.
//
// In the documents register each row is a *transmittal* (a remission of a
// document), not the document itself. The same document — the RFI — therefore
// shows up several times: once when it is received (the question) and again
// when it is answered (the response). The list takes them as independent rows
// even though they are the same document.
//
// This module collapses those rows into one "recorrido" (journey) per RFI,
// using the document number (documento_nro) as the root. The journey rule for
// RFIs is:
//   · recibido (STATUS = RECIBIDO) → inicio  (the RFI arrives / is opened)
//   · enviado  (STATUS = ENVIADO)  → cierre / atención (the response is sent)

import { isRfiDoc } from './isRfi';

const norm = (s) => (s == null ? '' : String(s)).toUpperCase().trim();

// The root key that ties every transmittal of the same document together.
// Primary signal is the document number; if missing we fall back to the RFI
// number parsed from the description, then to the transmittal/reference.
export function rfiRootKey(doc) {
  const nro = norm(doc.documento_nro);
  if (nro) return nro;
  const rfiNum = rfiNumber(doc);
  if (rfiNum) return `RFI:${rfiNum}`;
  return norm(doc.transmittal) || norm(doc.referencia) || `#${doc.id}`;
}

// Extracts the human RFI number (e.g. "1001" from "RESPUESTA A RFI 1001 - ...").
export function rfiNumber(doc) {
  const text = `${doc.descripcion || ''} ${doc.documento_nro || ''}`.toUpperCase();
  const m = text.match(/RFI[\s.\-N°#]*?(\d{1,6})/);
  return m ? m[1] : null;
}

const isRespuesta = (d) => norm(d.descripcion).startsWith('RESPUESTA') || norm(d.descripcion).includes('RESPUESTA A RFI');

function fechaTime(d) {
  if (!d || !d.fecha) return Number.POSITIVE_INFINITY;
  const t = new Date(d.fecha).getTime();
  return isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// Builds one journey object from the transmittals that share a root.
function buildJourney(key, docs) {
  const sorted = [...docs].sort((a, b) => fechaTime(a) - fechaTime(b));

  // inicio: the RFI being opened. Prefer a RECIBIDO transmittal that is not a
  // response; fall back to the earliest non-response, then the earliest row.
  const inicio =
    sorted.find((d) => norm(d.status) === 'RECIBIDO' && !isRespuesta(d)) ||
    sorted.find((d) => !isRespuesta(d)) ||
    sorted[0];

  // cierre: the response. Prefer an ENVIADO transmittal (or one described as a
  // response) that is not the inicio; fall back to any later transmittal.
  const cierre =
    sorted.find((d) => d !== inicio && (norm(d.status) === 'ENVIADO' || isRespuesta(d))) ||
    sorted.find((d) => d !== inicio) ||
    null;

  const atendido = sorted.some((d) => norm(d.status_g) === 'ATENDIDO');
  const estado = cierre || atendido ? 'cerrado' : 'pendiente';

  let diasRespuesta = null;
  if (inicio && cierre) {
    const ti = fechaTime(inicio);
    const tc = fechaTime(cierre);
    if (isFinite(ti) && isFinite(tc)) diasRespuesta = Math.round((tc - ti) / 86400000);
  }

  return {
    key,
    rfiNumber: rfiNumber(inicio) || rfiNumber(cierre) || null,
    root: inicio.documento_nro || cierre?.documento_nro || '',
    docs: sorted,
    inicio,
    cierre,
    descripcion: inicio.descripcion || cierre?.descripcion || '',
    n_contrato: inicio.n_contrato || cierre?.n_contrato || '',
    empresa: inicio.empresa || cierre?.empresa || '',
    responsable: inicio.responsable || cierre?.responsable || '',
    estado,
    diasRespuesta,
  };
}

// Groups the RFI documents into journeys (one per root document).
// Sorted: pending first, then by most recent activity.
export function groupRfiJourneys(documents) {
  const groups = new Map();
  for (const doc of documents) {
    if (!isRfiDoc(doc)) continue;
    const key = rfiRootKey(doc);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  const journeys = [...groups.entries()].map(([key, docs]) => buildJourney(key, docs));

  const lastTime = (j) => {
    const all = j.docs.map(fechaTime).filter((t) => isFinite(t));
    return all.length ? Math.max(...all) : 0;
  };
  return journeys.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'pendiente' ? -1 : 1;
    return lastTime(b) - lastTime(a);
  });
}
