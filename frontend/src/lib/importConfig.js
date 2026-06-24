// Fixed columns for the "paste from Excel" grid, one config per module.
// You paste rows positionally into these columns (SAP-style); any pasted column
// beyond the fixed set is preserved in extra_data.
export const IMPORT_CONFIGS = {
  documents: {
    label: 'Documentos',
    fields: [
      // TIPO DE FLUJO y ESTADO TRANSMITTAL son del TRANSMITTAL (no del documento):
      // TIPO DE FLUJO = sentido del envío (enviado/recibido); ESTADO TRANSMITTAL =
      // atención (atendido/pendiente). Las columnas en BD siguen siendo status y
      // status_g; solo cambian las etiquetas.
      { key: 'status', label: 'TIPO DE FLUJO', options: ['ENVIADO', 'RECIBIDO'], colWidth: 60 },
      { key: 'status_g', label: 'ESTADO TRANSMITTAL', options: ['ATENDIDO', 'PENDIENTE'], colWidth: 72 },
      { key: 'n_contrato', label: 'N° CONTRATO', colWidth: 100 },
      { key: 'ruc', label: 'RUC', colWidth: 90 },
      { key: 'empresa', label: 'EMPRESA', colWidth: 52 },
      { key: 'ruc', label: 'RUC', colWidth: 90 },
      // abbrev: 4 — muestra solo las primeras 4 letras en la tabla; texto completo al hover
      // La columna en BD sigue siendo contrato; solo cambia la etiqueta a CONTRATO DC.
      { key: 'contrato', label: 'CONTRATO DC', colWidth: 80, abbrev: 4 },
      { key: 'descripcion_contrato', label: 'DESCRIPCIÓN CONTRATO', type: 'textarea', colWidth: 108 },
      { key: 'fecha', label: 'FECHA', type: 'date', colWidth: 86 },
      // rtl:true → muestra el FINAL del nro de transmittal (la parte más discriminante)
      { key: 'transmittal', label: '# TRANSMITTAL', colWidth: 108, rtl: true },
      { key: 'item', label: 'ITEM', colWidth: 46 },
      { key: 'referencia', label: 'REFERENCIA', colWidth: 88 },
      { key: 'documento_nro', label: 'DOCUMENTO NRO', colWidth: 132 },
      { key: 'rev', label: 'REV.', colWidth: 46 },
      { key: 'descripcion', label: 'DESCRIPCIÓN', type: 'textarea', colWidth: 190 },
      { key: 'tipo_doc', label: 'TIPO DE DOC', colWidth: 52 },
      // ESTATUS DE DOCUMENTO es el estado del DOCUMENTO en sí (revisión técnica).
      // La columna en BD sigue siendo status_contratista; solo cambia la etiqueta.
      { key: 'status_contratista', label: 'ESTATUS DE DOCUMENTO',
        options: ['APROBADO', 'EN REVISIÓN', 'CON OBSERVACIONES', 'ANULADO'], colWidth: 100 },
      { key: 'responsable', label: 'RESPONSABLE', colWidth: 68 },
    ],
  },
  companies: {
    label: 'Empresas',
    fields: [
      { key: 'ruc', label: 'RUC', required: true },
      { key: 'razon_social', label: 'Razón Social', required: true },
      { key: 'nombre_comercial', label: 'Nombre Comercial' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'pais', label: 'País' },
      { key: 'email_contacto', label: 'Email' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'estado', label: 'Estado' },
    ],
  },
  projects: {
    label: 'Proyectos',
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'name', label: 'Nombre', required: true },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'ubicacion', label: 'Ubicación' },
      { key: 'fecha_inicio', label: 'Fecha Inicio' },
      { key: 'fecha_fin', label: 'Fecha Fin' },
      { key: 'estado', label: 'Estado' },
    ],
  },
  users: {
    label: 'Usuarios',
    fields: [
      { key: 'email', label: 'Correo', required: true },
      { key: 'full_name', label: 'Nombre' },
      { key: 'role', label: 'Rol (member/admin)' },
      { key: 'password', label: 'Contraseña' },
    ],
  },
  claims: {
    label: 'Claims',
    fields: [
      { key: 'code', label: 'Código' },
      { key: 'title', label: 'Título', required: true },
      { key: 'type', label: 'Tipo' },
      { key: 'n_contrato', label: 'N° Contrato' },
      { key: 'status', label: 'Estado' },
      { key: 'description', label: 'Descripción', type: 'textarea' },
    ],
  },
  // Contracts mirror the user's real Excel sheet 1:1 (same columns, same order).
  // Columns that map to a real DB column carry `key`; everything else is marked
  // `extra: true` and is preserved in extra_data under its exact header.
  contracts: {
    label: 'Contratos',
    fields: [
      { key: 'type', label: 'CLASE CONTRATO' },
      { key: 'x_tipo_inversion', label: 'Tipo Inversion', extra: true },
      { key: 'x_consultoria', label: 'Consultoria', extra: true },
      { key: 'status', label: 'ESTADO' },
      { key: 'x_a_sap_reg', label: 'A SAP Reg', extra: true },
      { key: 'x_estado_contrato_sap', label: 'Estado Contrato SAP', extra: true },
      { key: 'x_b_custodia', label: 'B Custodia', extra: true },
      { key: 'x_c_os', label: 'C OS(F=OK)', extra: true },
      { key: 'x_estado_os_sap', label: 'Estado OS SAP', extra: true },
      { key: 'x_responsable', label: 'RESPONSABLE', extra: true },
      { key: 'x_grupo_inversion', label: 'GRUPO INVERSION', extra: true },
      { key: 'x_area_solicitante', label: 'AREA SOLICITANTE', extra: true },
      { key: 'x_cod_inversion', label: 'COD INVERSION', extra: true },
      { key: 'x_cc', label: 'CC', extra: true },
      { key: 'x_circuito', label: 'CIRCUITO', extra: true },
      { key: 'x_modalidad_contratacion', label: 'MODALIDAD CONTRATACION', extra: true },
      { key: 'x_condiciones', label: 'Condiciones (Adel, % Ret FG, Ret FC)', extra: true },
      { key: 'start_date', label: 'FECHA SUSCRIPCIÓN DE CONTRATO', type: 'date' },
      { key: 'end_date', label: 'FIN VIGENCIA CONTRATO', type: 'date' },
      { key: 'x_fecha_acta_entrega_terreno', label: 'Fecha Acta de entrega de terreno', extra: true },
      { key: 'x_fecha_acta_inicio_obra', label: 'Fecha Acta de INICIO DE OBRA2', extra: true },
      { key: 'x_plazo_ejecucion', label: 'PLAZO DE EJECUCION / FABRICACION', extra: true },
      { key: 'x_fecha_termino_contrato', label: 'Fecha termino según contrato', extra: true },
      { key: 'x_ampliacion_plazo', label: 'Z Ampliación de plazo', extra: true },
      { key: 'x_plazo_penalizado', label: 'Plazo penalizado', extra: true },
      { key: 'x_plazo_ejecucion_ajustado', label: 'Plazo de Ejecucion ajustado', extra: true },
      { key: 'x_plazo_total', label: 'Plazo total', extra: true },
      { key: 'x_fecha_recepcion_provisional', label: 'Fecha Recepción Provisional / Fin según contrato (Ultima)', extra: true },
      { key: 'actual_end_date', label: 'Fecha Recepcion Final', type: 'date' },
      { key: 'x_plazo_garantia', label: 'Plazo de garantia', extra: true },
      { key: 'x_inicio_operacion_pyt', label: 'Inicio de operación del PYT', extra: true },
      { key: 'x_por_pagar_garantia', label: 'Por Pagar Garantia (Cuenta 30 dias antes Venc.)', extra: true },
      { key: 'x_id', label: 'ID', extra: true },
      { key: 'code', label: 'N° CONTRATO', required: true },
      { key: 'x_contrato_dwh', label: 'CONTRATO DWH', extra: true },
      { key: 'x_adenda', label: 'ADENDA', extra: true },
      { key: 'x_ruc', label: 'RUC', extra: true },
      { key: 'x_empresa', label: 'EMPRESA', extra: true },
      { key: 'title', label: 'DESCRIPCION CONTRATO', required: true },
      { key: 'x_contrato_en_chino', label: 'Contrato en Chino', extra: true },
      { key: 'x_nombre_especifico', label: 'NOMBRE ESPECIFICO', extra: true },
      { key: 'x_descripcion_adenda', label: 'DESCRIPCION DE LA ADENDA', extra: true },
      { key: 'x_contrato_', label: 'CONTRATO_', extra: true },
      { key: 'x_empresa_', label: 'EMPRESA_', extra: true },
      { key: 'x_contrato_nombre_informe', label: 'CONTRATO_ NOMBRE INFORME', extra: true },
      { key: 'currency', label: 'MONEDA' },
      { key: 'x_ppto_base', label: 'PPTO BASE', extra: true },
      { key: 'x_monto_soles_sin_igv', label: 'MONTO CONTRATADO S/ (SIN IGV)', extra: true },
      { key: 'x_monto_usd_sin_igv', label: 'MONTO CONTRATADO US$ (SIN IGV)', extra: true },
      { key: 'x_monto_soles_con_igv', label: 'MONTO CONTRATADO S/ (CON IGV)', extra: true },
      { key: 'x_monto_usd_con_igv', label: 'MONTO CONTRATADO US$ (CON IGV)', extra: true },
    ],
  },
};
