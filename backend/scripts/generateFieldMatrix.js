// Genera una matriz de verificación (Excel) con los campos que la app espera
// para Documentos y Contratos. Sirve para que el usuario compare su Excel real
// contra el "sentido" (orden + encabezados) que usará la sincronización.
//
//   node backend/scripts/generateFieldMatrix.js
//
// Salida: Matriz_Campos_ControlDoc.xlsx (hojas: Documentos, Contratos, Mapa de campos).

const path = require('path');
const XLSX = require('xlsx');

// Campos de Documentos (espejo de frontend/src/lib/importConfig.js -> documents).
const DOCUMENTS = [
  { key: 'status', label: 'TIPO DE FLUJO', type: 'texto',
    note: 'Antes "STATUS". Columna BD: status. ENVIADO / RECIBIDO (del transmittal)' },
  { key: 'status_g', label: 'ESTADO TRANSMITTAL', type: 'texto',
    note: 'Antes "STATUS G". Columna BD: status_g. ATENDIDO / PENDIENTE (atención)' },
  { key: 'n_contrato', label: 'N° CONTRATO', type: 'texto' },
  { key: 'empresa', label: 'EMPRESA', type: 'texto' },
  { key: 'ruc', label: 'RUC', type: 'texto', note: 'RUC de la empresa' },
  { key: 'contrato', label: 'CONTRATO DC', type: 'texto', note: 'Antes "CONTRATO". Columna BD: contrato' },
  { key: 'descripcion_contrato', label: 'DESCRIPCIÓN CONTRATO', type: 'texto' },
  { key: 'fecha', label: 'FECHA', type: 'fecha' },
  { key: 'transmittal', label: '# TRANSMITTAL', type: 'texto', unique: true },
  { key: 'item', label: 'ITEM', type: 'texto' },
  { key: 'referencia', label: 'REFERENCIA', type: 'texto' },
  { key: 'documento_nro', label: 'DOCUMENTO NRO', type: 'texto', unique: true },
  { key: 'rev', label: 'REV.', type: 'texto' },
  { key: 'descripcion', label: 'DESCRIPCIÓN', type: 'texto' },
  { key: 'tipo_doc', label: 'TIPO DE DOC', type: 'texto' },
  { key: 'status_contratista', label: 'ESTATUS DE DOCUMENTO', type: 'texto',
    note: 'Antes "STATUS DE CONTRATISTA". Columna BD: status_contratista. APROBADO / EN REVISIÓN / CON OBSERVACIONES / ANULADO' },
  { key: 'responsable', label: 'RESPONSABLE', type: 'texto' },
];

// Campos de Contratos (espejo de importConfig.js -> contracts). Los `extra` se
// guardan tal cual en extra_data; los demás van a columnas reales.
const CONTRACTS = [
  { key: 'type', label: 'CLASE CONTRATO', type: 'texto' },
  { key: 'x_tipo_inversion', label: 'Tipo Inversion', type: 'texto', extra: true },
  { key: 'x_consultoria', label: 'Consultoria', type: 'texto', extra: true },
  { key: 'status', label: 'ESTADO', type: 'texto' },
  { key: 'x_a_sap_reg', label: 'A SAP Reg', type: 'texto', extra: true },
  { key: 'x_estado_contrato_sap', label: 'Estado Contrato SAP', type: 'texto', extra: true },
  { key: 'x_b_custodia', label: 'B Custodia', type: 'texto', extra: true },
  { key: 'x_c_os', label: 'C OS(F=OK)', type: 'texto', extra: true },
  { key: 'x_estado_os_sap', label: 'Estado OS SAP', type: 'texto', extra: true },
  { key: 'x_responsable', label: 'RESPONSABLE', type: 'texto', extra: true },
  { key: 'x_grupo_inversion', label: 'GRUPO INVERSION', type: 'texto', extra: true },
  { key: 'x_area_solicitante', label: 'AREA SOLICITANTE', type: 'texto', extra: true },
  { key: 'x_cod_inversion', label: 'COD INVERSION', type: 'texto', extra: true },
  { key: 'x_cc', label: 'CC', type: 'texto', extra: true },
  { key: 'x_circuito', label: 'CIRCUITO', type: 'texto', extra: true },
  { key: 'x_modalidad_contratacion', label: 'MODALIDAD CONTRATACION', type: 'texto', extra: true },
  { key: 'x_condiciones', label: 'Condiciones (Adel, % Ret FG, Ret FC)', type: 'texto', extra: true },
  { key: 'start_date', label: 'FECHA SUSCRIPCIÓN DE CONTRATO', type: 'fecha' },
  { key: 'end_date', label: 'FIN VIGENCIA CONTRATO', type: 'fecha' },
  { key: 'x_fecha_acta_entrega_terreno', label: 'Fecha Acta de entrega de terreno', type: 'texto', extra: true },
  { key: 'x_fecha_acta_inicio_obra', label: 'Fecha Acta de INICIO DE OBRA2', type: 'texto', extra: true },
  { key: 'x_plazo_ejecucion', label: 'PLAZO DE EJECUCION / FABRICACION', type: 'texto', extra: true },
  { key: 'x_fecha_termino_contrato', label: 'Fecha termino según contrato', type: 'texto', extra: true },
  { key: 'x_ampliacion_plazo', label: 'Z Ampliación de plazo', type: 'texto', extra: true },
  { key: 'x_plazo_penalizado', label: 'Plazo penalizado', type: 'texto', extra: true },
  { key: 'x_plazo_ejecucion_ajustado', label: 'Plazo de Ejecucion ajustado', type: 'texto', extra: true },
  { key: 'x_plazo_total', label: 'Plazo total', type: 'texto', extra: true },
  { key: 'x_fecha_recepcion_provisional', label: 'Fecha Recepción Provisional / Fin según contrato (Ultima)', type: 'texto', extra: true },
  { key: 'actual_end_date', label: 'Fecha Recepcion Final', type: 'fecha' },
  { key: 'x_plazo_garantia', label: 'Plazo de garantia', type: 'texto', extra: true },
  { key: 'x_inicio_operacion_pyt', label: 'Inicio de operación del PYT', type: 'texto', extra: true },
  { key: 'x_por_pagar_garantia', label: 'Por Pagar Garantia (Cuenta 30 dias antes Venc.)', type: 'texto', extra: true },
  { key: 'x_id', label: 'ID', type: 'texto', extra: true },
  { key: 'code', label: 'N° CONTRATO', type: 'texto', required: true, unique: true },
  { key: 'x_contrato_dwh', label: 'CONTRATO DWH', type: 'texto', extra: true },
  { key: 'x_adenda', label: 'ADENDA', type: 'texto', extra: true },
  { key: 'x_ruc', label: 'RUC', type: 'texto', extra: true },
  { key: 'x_empresa', label: 'EMPRESA', type: 'texto', extra: true },
  { key: 'title', label: 'DESCRIPCION CONTRATO', type: 'texto', required: true },
  { key: 'x_contrato_en_chino', label: 'Contrato en Chino', type: 'texto', extra: true },
  { key: 'x_nombre_especifico', label: 'NOMBRE ESPECIFICO', type: 'texto', extra: true },
  { key: 'x_descripcion_adenda', label: 'DESCRIPCION DE LA ADENDA', type: 'texto', extra: true },
  { key: 'x_contrato_', label: 'CONTRATO_', type: 'texto', extra: true },
  { key: 'x_empresa_', label: 'EMPRESA_', type: 'texto', extra: true },
  { key: 'x_contrato_nombre_informe', label: 'CONTRATO_ NOMBRE INFORME', type: 'texto', extra: true },
  { key: 'currency', label: 'MONEDA', type: 'texto' },
  { key: 'x_ppto_base', label: 'PPTO BASE', type: 'numero', extra: true },
  { key: 'x_monto_soles_sin_igv', label: 'MONTO CONTRATADO S/ (SIN IGV)', type: 'numero', extra: true },
  { key: 'x_monto_usd_sin_igv', label: 'MONTO CONTRATADO US$ (SIN IGV)', type: 'numero', extra: true },
  { key: 'x_monto_soles_con_igv', label: 'MONTO CONTRATADO S/ (CON IGV)', type: 'numero', extra: true },
  { key: 'x_monto_usd_con_igv', label: 'MONTO CONTRATADO US$ (CON IGV)', type: 'numero', extra: true },
];

// Hoja con solo los encabezados (fila 1), en el orden esperado. Sirve de plantilla.
function headerSheet(fields) {
  const headers = fields.map((f) => f.label);
  return XLSX.utils.aoa_to_sheet([headers]);
}

// Hoja de mapa: una fila por campo con su detalle de mapeo.
function mapSheet(name, fields) {
  const rows = [['HOJA', 'ORDEN', 'ENCABEZADO EN EXCEL', 'CAMPO BD', 'TIPO', 'CLAVE ÚNICA', 'REQUERIDO', 'DESTINO', 'NOTAS']];
  fields.forEach((f, i) => {
    rows.push([
      name,
      i + 1,
      f.label,
      f.extra ? '(extra_data)' : f.key,
      f.type,
      f.unique ? 'SÍ' : '',
      f.required ? 'SÍ' : '',
      f.extra ? 'extra_data (JSON)' : 'columna real',
      f.note || '',
    ]);
  });
  return XLSX.utils.aoa_to_sheet(rows);
}

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, headerSheet(DOCUMENTS), 'Documentos');
XLSX.utils.book_append_sheet(wb, headerSheet(CONTRACTS), 'Contratos');

const mapAll = XLSX.utils.aoa_to_sheet([]);
const mapDocs = mapSheet('Documentos', DOCUMENTS);
const mapCtr = mapSheet('Contratos', CONTRACTS);
// Combina ambos mapas en una sola hoja, Documentos arriba y Contratos abajo.
const docRows = XLSX.utils.sheet_to_json(mapDocs, { header: 1 });
const ctrRows = XLSX.utils.sheet_to_json(mapCtr, { header: 1 });
const combined = [...docRows, [], ...ctrRows];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(combined), 'Mapa de campos');

const out = path.join(__dirname, '..', '..', 'Matriz_Campos_ControlDoc.xlsx');
XLSX.writeFile(wb, out);
console.log('Generado:', out);
