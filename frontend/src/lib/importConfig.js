// Fixed columns for the "paste from Excel" grid, one config per module.
// You paste rows positionally into these columns (SAP-style); any pasted column
// beyond the fixed set is preserved in extra_data.
export const IMPORT_CONFIGS = {
  documents: {
    label: 'Documentos',
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'title', label: 'Título', required: true },
      { key: 'version', label: 'Versión' },
      { key: 'status', label: 'Estado' },
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
  contracts: {
    label: 'Contratos',
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'title', label: 'Título', required: true },
      { key: 'type', label: 'Tipo' },
      { key: 'amount', label: 'Monto' },
      { key: 'currency', label: 'Moneda' },
      { key: 'start_date', label: 'Fecha Inicio' },
      { key: 'end_date', label: 'Fecha Fin' },
      { key: 'actual_end_date', label: 'Fecha Fin Real' },
      { key: 'status', label: 'Estado' },
      { key: 'description', label: 'Descripción' },
    ],
  },
};
