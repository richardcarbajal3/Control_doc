// Fixed columns for the "paste from Excel" grid, one config per module.
// You paste rows positionally into these columns (SAP-style); any pasted column
// beyond the fixed set is preserved in extra_data.
export const IMPORT_CONFIGS = {
  documents: {
    label: 'Documentos',
    fields: [
      { key: 'status', label: 'STATUS' },
      { key: 'status_g', label: 'STATUS G' },
      { key: 'n_contrato', label: 'N° CONTRATO' },
      { key: 'empresa', label: 'EMPRESA' },
      { key: 'contrato', label: 'CONTRATO' },
      { key: 'descripcion_contrato', label: 'DESCRIPCIÓN CONTRATO', type: 'textarea' },
      { key: 'fecha', label: 'FECHA', type: 'date' },
      { key: 'transmittal', label: '# TRANSMITTAL' },
      { key: 'referencia', label: 'REFERENCIA' },
      { key: 'documento_nro', label: 'DOCUMENTO NRO' },
      { key: 'rev', label: 'REV.' },
      { key: 'descripcion', label: 'DESCRIPCIÓN', type: 'textarea' },
      { key: 'tipo_doc', label: 'TIPO DE DOC' },
      { key: 'status_contratista', label: 'STATUS DE CONTRATISTA' },
      { key: 'responsable', label: 'RESPONSABLE' },
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
  // Contratos — layout del Excel real de "Control de Contratos" (51 columnas, en
  // orden). Las columnas con campo tipado en la tabla (code, title, currency,
  // amount y las 3 fechas del ciclo de vida) se mapean a la BD; el resto se
  // conserva fiel en extra_data. Mapeos tipados:
  //   code            ← N° CONTRATO
  //   title           ← DESCRIPCION CONTRATO
  //   currency        ← MONEDA
  //   amount          ← MONTO CONTRATADO US$ (CON IGV)
  //   start_date      ← Fecha Acta de INICIO DE OBRA2
  //   end_date        ← Fecha termino según contrato
  //   actual_end_date ← Fecha Recepcion Final
  contracts: {
    label: 'Contratos',
    fields: [
      { key: 'clase_contrato', label: 'CLASE CONTRATO' },
      { key: 'tipo_inversion', label: 'Tipo Inversion' },
      { key: 'consultoria', label: 'Consultoría' },
      { key: 'estado', label: 'ESTADO' },
      { key: 'a_sap_reg', label: 'A SAP Reg' },
      { key: 'estado_contrato_sap', label: 'Estado Contrato SAP' },
      { key: 'b_custodia', label: 'B Custodia' },
      { key: 'c_os', label: 'C OS(F=OK)' },
      { key: 'estado_os_sap', label: 'Estado OS SAP' },
      { key: 'responsable', label: 'RESPONSABLE' },
      { key: 'grupo_inversion', label: 'GRUPO INVERSION' },
      { key: 'area_solicitante', label: 'AREA SOLICITANTE' },
      { key: 'cod_inversion', label: 'COD INVERSION' },
      { key: 'cc', label: 'CC' },
      { key: 'circuito', label: 'CIRCUITO' },
      { key: 'modalidad_contratacion', label: 'MODALIDAD CONTRATACION' },
      { key: 'condiciones', label: 'Condiciones (Adel, % Ret FG, Ret FC)' },
      { key: 'fecha_suscripcion', label: 'FECHA SUSCRIPCIÓN DE CONTRATO', type: 'date' },
      { key: 'fin_vigencia', label: 'FIN VIGENCIA CONTRATO', type: 'date' },
      { key: 'fecha_acta_entrega_terreno', label: 'Fecha Acta de entrega de terreno', type: 'date' },
      { key: 'start_date', label: 'Fecha Acta de INICIO DE OBRA2', type: 'date' },
      { key: 'plazo_ejecucion', label: 'PLAZO DE EJECUCION / FABRICACION' },
      { key: 'end_date', label: 'Fecha termino según contrato', type: 'date' },
      { key: 'ampliacion_plazo', label: 'Z Ampliación de plazo' },
      { key: 'plazo_penalizado', label: 'Plazo penalizado' },
      { key: 'plazo_ejecucion_ajustado', label: 'Plazo de Ejecucion ajustado' },
      { key: 'plazo_total', label: 'Plazo total' },
      { key: 'fecha_recepcion_provisional', label: 'Fecha Recepción Provisional / Fin según contrato (Ultima)', type: 'date' },
      { key: 'actual_end_date', label: 'Fecha Recepcion Final', type: 'date' },
      { key: 'plazo_garantia', label: 'Plazo de garantia' },
      { key: 'inicio_operacion', label: 'Inicio de operación del PYT' },
      { key: 'por_pagar_garantia', label: 'Por Pagar Garantia (Cuenta 30 dias antes Venc.)' },
      { key: 'id_externo', label: 'ID' },
      { key: 'code', label: 'N° CONTRATO', required: true },
      { key: 'contrato_dwh', label: 'CONTRATO DWH' },
      { key: 'adenda', label: 'ADENDA' },
      { key: 'ruc', label: 'RUC' },
      { key: 'empresa', label: 'EMPRESA' },
      { key: 'title', label: 'DESCRIPCION CONTRATO', required: true, type: 'textarea' },
      { key: 'contrato_chino', label: 'Contrato en Chino' },
      { key: 'nombre_especifico', label: 'NOMBRE ESPECIFICO' },
      { key: 'descripcion_adenda', label: 'DESCRIPCION DE LA ADENDA' },
      { key: 'contrato_alt', label: 'CONTRATO_' },
      { key: 'empresa_alt', label: 'EMPRESA_' },
      { key: 'contrato_nombre_informe', label: 'CONTRATO_ NOMBRE INFORME' },
      { key: 'currency', label: 'MONEDA' },
      { key: 'ppto_base', label: 'PPTO BASE' },
      { key: 'monto_pen_sin_igv', label: 'MONTO CONTRATADO S/ (SIN IGV)' },
      { key: 'monto_usd_sin_igv', label: 'MONTO CONTRATADO US$ (SIN IGV)' },
      { key: 'monto_pen_con_igv', label: 'MONTO CONTRATADO S/ (CON IGV)' },
      { key: 'amount', label: 'MONTO CONTRATADO US$ (CON IGV)' },
    ],
  },
};
