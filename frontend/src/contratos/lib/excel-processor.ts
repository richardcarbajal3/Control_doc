import * as XLSX from 'xlsx';

// ============================================================
// Sheet Name Aliases: maps canonical names to known internal aliases
// ============================================================
const SHEET_NAME_ALIASES: Record<string, string[]> = {
  contratos:        ['Contratos', '1Contratos'],
  pagos:            ['Pago', '4Pago', 'Pagos'],     // Pago = pagos ya realizados
  programacion:     ['SAP', '2SAP'],                // SAP = programacion de pagos del proximo mes
  provisiones:      ['Av&Provision', '3Av&Provision', 'Provision'],
  garantias:        ['Garantia', '5Garantia', 'Garantias'],
  custodia:         ['C_Ent_Fin', 'Custodia'],
  ordenes_servicio: ['OS.r.SAP'],
  ordenes_cambio:   [],
  avance_semanal:   [],
  con_sap:          ['Con.SAP'],
};

// Anchor headers per sheet type for auto-detecting the header row
const SHEET_ANCHOR_HEADERS: Record<string, string[]> = {
  contratos:        ['CONTRATO', 'ADENDA', 'MONTO'],
  pagos:            ['CONTRATO', 'ADENDA', 'VALOR'],
  provisiones:      ['CONTRATO_', 'EMPRESA_', 'SALDO DE PROVISIONES'],
  programacion:     ['CONTRATO', 'ADENDA'],
  garantias:        ['CONTRATO', 'CARTA FIANZA'],
  custodia:         ['CONTRATO', 'ADENDA'],
  ordenes_servicio: ['CONTRATO', 'ORDEN'],
  ordenes_cambio:   ['CONTRATO', 'CAMBIO'],
  avance_semanal:   ['CONTRATO', 'AVANCE'],
  con_sap:          ['CONTRATO'],
};

// ============================================================
// Workbook Preprocessing: resolve sheet names + detect header rows
// ============================================================

function resolveSheetName(
  canonicalName: string,
  sheetNames: string[]
): string | undefined {
  // 1. Exact match
  const exact = sheetNames.find(s => s === canonicalName);
  if (exact) return exact;

  // 2. Case-insensitive match on canonical name
  const caseInsensitive = sheetNames.find(
    s => s.toLowerCase().trim() === canonicalName.toLowerCase()
  );
  if (caseInsensitive) return caseInsensitive;

  // 3. Alias match (case-insensitive)
  const aliases = SHEET_NAME_ALIASES[canonicalName] || [];
  for (const alias of aliases) {
    const match = sheetNames.find(
      s => s.toLowerCase().trim() === alias.toLowerCase().trim()
    );
    if (match) return match;
  }

  return undefined;
}

function detectHeaderRow(
  sheet: XLSX.WorkSheet,
  canonicalName?: string,
  maxScanRows = 30,
  customAnchors?: string[]
): number {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const anchors = (customAnchors || SHEET_ANCHOR_HEADERS[canonicalName || ''] || [])
    .map(a => a.toUpperCase());

  // Pass 1: scoring-based anchor detection
  // Requires rows to have 3+ non-empty cells (filters out title/merged-cell rows).
  // Prefers exact cell matches over substring matches so a title like
  // "Detalle Pagos por Contrato y Adenda" doesn't beat the real header row.
  let bestRow = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rawRows.length, maxScanRows); i++) {
    const row = rawRows[i];
    if (!row) continue;

    const cellValues = row
      .map((cell: any) => (cell != null ? String(cell).trim().toUpperCase() : ''))
      .filter((v: string) => v.length > 0);

    // Skip rows with fewer than 3 non-empty cells (likely title/summary rows)
    if (cellValues.length < 3) continue;

    if (anchors.length > 0) {
      // Exact: cell equals anchor or starts with "ANCHOR " / "ANCHOR_"
      const exactMatches = anchors.filter(anchor =>
        cellValues.some((val: string) => val === anchor || val.startsWith(anchor + ' ') || val.startsWith(anchor + '_'))
      ).length;
      const substringMatches = anchors.filter(anchor =>
        cellValues.some((val: string) => val.includes(anchor))
      ).length;

      // Score: exact matches worth 10x more than substring
      const score = exactMatches * 10 + substringMatches;
      const threshold = Math.min(2, anchors.length);

      // Use >= so later rows win on tie (actual headers come after summaries)
      if (substringMatches >= threshold && score >= bestScore) {
        bestScore = score;
        bestRow = i;
        // If all anchors match exactly, this is certainly the header
        if (exactMatches >= anchors.length) break;
      }
    }
  }
  if (bestRow >= 0) return bestRow;

  // Pass 2: density heuristic - first row with 4+ non-empty string cells
  for (let i = 0; i < Math.min(rawRows.length, maxScanRows); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const nonEmpty = row.filter((cell: any) => cell != null && String(cell).trim() !== '');
    if (nonEmpty.length >= 4) return i;
  }

  return 0;
}

function extractSheetData(
  sheet: XLSX.WorkSheet,
  headerRow: number
): Record<string, any>[] {
  if (headerRow === 0) {
    return XLSX.utils.sheet_to_json(sheet);
  }
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  range.s.r = headerRow;
  return XLSX.utils.sheet_to_json(sheet, { range });
}

interface SheetResolution {
  canonicalName: string;
  actualName: string;
  headerRow: number;
}

/** Strip accents/diacritics from a string: "ÁREA" → "AREA", "Descripción" → "Descripcion" */
const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Normalize contract IDs: trim, remove trailing .0 from Excel numeric cells */
function normalizeContractId(raw: any): string {
  let s = String(raw ?? '').trim();
  // Remove trailing .0 from Excel numeric conversions (e.g., "12345.0" → "12345")
  s = s.replace(/\.0+$/, '');
  return s;
}


function normalizeWorkbook(workbook: XLSX.WorkBook): {
  workbook: XLSX.WorkBook;
  resolutions: SheetResolution[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const resolutions: SheetResolution[] = [];
  const newWorkbook = XLSX.utils.book_new();

  const allCanonical = Object.keys(SHEET_NAME_ALIASES);

  for (const canonical of allCanonical) {
    const actualName = resolveSheetName(canonical, workbook.SheetNames);
    if (!actualName) continue;

    const sheet = workbook.Sheets[actualName];
    const headerRow = detectHeaderRow(sheet, canonical);

    if (headerRow > 0) {
      warnings.push(
        `Hoja "${actualName}" (${canonical}): datos detectados desde fila ${headerRow + 1}`
      );
    }

    const data = extractSheetData(sheet, headerRow);
    console.log(`[normalizeWorkbook] "${actualName}" → "${canonical}": headerRow=${headerRow}, dataRows=${data.length}${data.length > 0 ? ', cols=' + Object.keys(data[0]).slice(0, 6).join(', ') : ''}`);
    const newSheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, canonical);

    resolutions.push({ canonicalName: canonical, actualName, headerRow });
  }

  // Warn about unmapped sheets (distinguish E_ specialized sheets)
  for (const name of workbook.SheetNames) {
    const alreadyMapped = resolutions.some(r => r.actualName === name);
    if (!alreadyMapped) {
      if (/^E_/i.test(name)) {
        warnings.push(`Hoja especializada "${name}" detectada (se procesara como datos adicionales).`);
      } else {
        warnings.push(`Hoja "${name}" no tiene mapeo conocido, ignorada.`);
      }
    }
  }

  return { workbook: newWorkbook, resolutions, warnings };
}

export interface PaymentRecord {
  valorizacion: string;
  descripcion: string;
  monto: number;
  factura: string;
  fechaContabilizacion: string;
  retencion: number;
  amortizacionAdelanto: number;
  isAdelanto: boolean; // true when VALORIZACION starts with "A"
}

export interface GuaranteeRecord {
  monto: number;
  detalle: string;
  entidad: string;
  nroCarta: string;
  fechaEmision: string;
  fechaVencimiento: string;
}

export interface ProvisionRecord {
  monto: number;
}

export interface SpecializedSheetEntry {
  sheetType: string;          // e.g., "obras", "arrendamiento"
  sheetLabel: string;         // Human-readable label
  data: Record<string, any>;  // All columns as key-value pairs (excluding CONTRATO)
}

export interface ContractData {
  contractId: string; // N° CONTRATO
  addendumId: string; // ADENDA (0, 1, 2...)
  key: string; // CONTRATO + ADENDA
  
  // From 'contratos' sheet
  description?: string;
  chineseDescription?: string;
  contractDate?: string;
  startDate?: string;
  endDate?: string;
  executionTerm?: string;
  extensionTerm?: string;
  responsible?: string;
  company?: string;
  observaciones?: string; // OBSERVACIONES from 1Contratos
  
  amount: number;
  deductivo: number; // DEDUCTIVO Y MAYORES METRADOS US$ (SIN IGV)
  amountNet: number; // CONTRATADO - DEDUCTIVO = valor real del contrato
  currency?: string;
  state?: string;
  type?: string; // Tipo de contrato
  contractClass?: string; // Clase de contrato (New)
  investmentType?: string; // Tipo de inversión
  investmentGroup?: string; // GRUPO INVERSION
  modalidadContratacion?: string; // MODALIDAD CONTRATACION
  contacto?: string; // CONTACTO
  
  // Computed/Aggregated
  payments: number;
  scheduledPayments: number; // Programacion: pagos planificados para el mes siguiente
  provisions: number;
  serviceOrders: number;
  changeOrders: number;
  guarantees: number;
  retention: number; // RETENCION FG Y FC US$
  adelantoContrato: number; // Adelanto de contrato (pagos con VALORIZACION que empieza con A)
  amortizacionAdelanto: number; // Amortizacion del adelanto
  adelantoPorAmortizar: number; // Adelanto - Amortizacion
  progress: number; // Avance
  montoEjecutado: number; // Monto ejecutado = avance acumulado * valor contrato
  balance: number; // Saldo
  saldoPorPagar: number; // Saldo por pagar
  
  // SAP registration tracking
  registeredInSap: boolean; // From Con.SAP sheet

  // Raw records for drill-down
  paymentsList: PaymentRecord[];
  guaranteesList: GuaranteeRecord[];
  provisionsList: ProvisionRecord[];

  records: Record<string, any>[];
  comments: string[]; // Aggregated comments

  // Specialized sheet data (E_obras, E_arrendamiento, etc.)
  specializedData: SpecializedSheetEntry[];
}

export interface ConsolidatedContract {
  contractId: string;
  totalAmount: number;
  totalExecuted: number;
  totalPaid: number;
  progressPercent: number;
  totalBalance: number;
  totalRetention: number;
  totalGuarantees: number; // New field
  state: string; // Derived from items
  items: ContractData[]; // The addendums belonging to this contract
}

export interface SpecializedSheetLog {
  sheetName: string;
  rowCount: number;
  matchCount: number;
  missCount: number;
  detectedColumns: string[];
  sampleEIds: string[];
  sampleContractMapKeys: string[];
}

export interface ProcessingResult {
  contracts: ContractData[];
  consolidated: ConsolidatedContract[];
  errors: string[];
  specializedSheetLogs: SpecializedSheetLog[];
}

const NORMALIZE_HEADERS = (row: any) => {
  const newRow: any = {};
  Object.keys(row).forEach(key => {
    // Aggressive normalization: 
    // 1. Trim whitespace from ends
    // 2. Replace multiple spaces with single space
    // 3. maintain original casing for value, but we need a standard key for lookup
    // Actually, let's keep the key standard: UPPERCASE, TRIMMED, SINGLE SPACES
    const cleanKey = stripAccents(key.trim().replace(/\s+/g, ' ').toUpperCase());
    newRow[cleanKey] = row[key];
    // Also keep original just in case
    newRow[key] = row[key];
  });
  return newRow;
};

export const processExcelFile = async (file: File): Promise<ProcessingResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const rawWorkbook = XLSX.read(data, { type: 'array' });

        // Preprocess: resolve sheet names + detect header rows
        const normalized = normalizeWorkbook(rawWorkbook);
        const workbook = normalized.workbook;
        const sheetNames = workbook.SheetNames;

        console.log('Raw Excel sheet names:', rawWorkbook.SheetNames);
        console.log('Sheet resolutions:', normalized.resolutions);
        console.log('Normalized sheet names:', sheetNames);
        if (normalized.warnings.length > 0) {
          console.warn('Normalization warnings:', normalized.warnings);
        }
        const result: ProcessingResult = {
          contracts: [],
          consolidated: [],
          errors: [],
          specializedSheetLogs: []
        };

        // Helper to parse numbers safely
        const parseNumber = (val: any) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            if (typeof val === 'string') {
              const clean = val.replace(/,/g, '').trim();
              const num = parseFloat(clean);
              return isNaN(num) ? 0 : num;
            }
            return 0;
        };

        // Helper to parse Excel dates to DD/MM/YYYY
        const parseExcelDate = (val: any) => {
          if (!val) return '-';
          if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            if (isNaN(date.getTime())) return '-';
            const d = date.getUTCDate().toString().padStart(2, '0');
            const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
            const y = date.getUTCFullYear();
            return `${d}/${m}/${y}`;
          }
          return String(val);
        };

        // 1. Validate mandatory sheet (already normalized to canonical name)
        const contratosSheetName = sheetNames.find(s => s === 'contratos');
        
        if (!contratosSheetName) {
          result.errors.push("Falta la hoja obligatoria 'contratos'.");
          resolve(result);
          return;
        }

        // 2. Read 'contratos' (Base)
        const contractsSheet = workbook.Sheets[contratosSheetName];
        const rawContracts = XLSX.utils.sheet_to_json(contractsSheet);
        
        const contractsMap = new Map<string, ContractData>();

        console.log("Raw headers found:", rawContracts.length > 0 ? Object.keys(rawContracts[0] as object) : "No rows");

        rawContracts.forEach((row: any) => {
          const r = NORMALIZE_HEADERS(row);
          
          // Debug: print normalized keys for first row
          if (contractsMap.size === 0) {
             console.log("Normalized keys sample:", Object.keys(r));
          }

          // Key: CONTRATO + ADENDA
          // Try multiple variations
          let contractId = normalizeContractId(r['N° CONTRATO'] || r['CONTRATO'] || r['N CONTRATO'] || r['NO CONTRATO']);
          // Regex fallback for Unicode ° vs º mismatch in "N° CONTRATO"
          if (!contractId) {
            for (const [hKey, hVal] of Object.entries(r)) {
              const upper = hKey.trim().toUpperCase().replace(/\s+/g, ' ');
              if (/^N.?\s?CONTRATO$/.test(upper)) { contractId = normalizeContractId(hVal); break; }
            }
          }
          const addendumId = String(r['ADENDA'] ?? '').trim() || '0';

          if (!contractId) {
            // console.warn("Skipping row missing keys:", r);
            return;
          }

          const key = `${contractId}-${addendumId}`;
          
          // Specific column mappings
          // We normalized keys to UPPERCASE with SINGLE SPACES
          const amount = parseNumber(
            r['MONTO CONTRATADO US$ (SIN IGV)'] || 
            r['MONTO CONTRATADO US$'] || 
            r['MONTO CONTRATADO'] || 
            r['MONTO'] || 
            r['IMPORTE']
          );
          
          const payments = parseNumber(
            r['PAGADO US$ (SIN IGV)'] ||
            r['PAGADO US$'] ||
            r['PAGADO'] ||
            r['MONTO PAGADO']
          );

          const retention = parseNumber(
            r['RETENCION FG Y FC US$'] ||
            r['RETENCION FG Y FC'] ||
            r['RETENCION'] ||
            r['FONDO GARANTIA'] ||
            r['RETENCION FG'] ||
            r['RETENCION FC'] ||
            r['RETENCION TOTAL']
          );

          const deductivo = parseNumber(
            r['DEDUCTIVO Y MAYORES METRADOS US$ (SIN IGV)'] ||
            r['DEDUCTIVO Y MAYORES METRADOS'] ||
            r['DEDUCTIVO'] || 0
          );

          contractsMap.set(key, {
            contractId: String(contractId),
            addendumId: String(addendumId),
            key,
            description: r['DESCRIPCION CONTRATO'] || r['DESCRIPCION'] || r['OBJETO'] || r['NOMBRE'] || '',
            chineseDescription: r['CONTRATO EN CHINO'] || '',
            contractDate: parseExcelDate(r['FECHA SUSCRIPCION DE CONTRATO'] || r['FECHA SUSCRIPCIÓN DE CONTRATO'] || r['FECHA SUSCRIPCION'] || r['FECHA CONTRATO']),
            startDate: parseExcelDate(r['FECHA ACTA DE INICIO DE OBRA2'] || r['FECHA INICIO'] || r['INICIO']),
            executionTerm: String(r['PLAZO DE EJECUCION / FABRICACION'] || r['PLAZO'] || '-'),
            extensionTerm: String(r['Z AMPLIACION DE PLAZO'] || r['Z AMPLIACIÓN DE PLAZO'] || r['AMPLIACION'] || '-'),
            endDate: parseExcelDate(r['FECHA RECEPCION PROVISIONAL / FIN SEGUN CONTRATO (ULTIMA)'] || r['FECHA RECEPCIÓN PROVISIONAL / FIN SEGÚN CONTRATO (ULTIMA)'] || r['FECHA FIN'] || r['FIN']),
            responsible: String(r['RESPONSABLE (ADMINISTRADOR DE CONTRATO)'] || r['RESPONSABLE'] || '-'),
            company: String(r['EMPRESA'] || r['CONTRATISTA'] || '-'),
            observaciones: r['OBSERVACIONES'] || '',
            amount: amount,
            deductivo: deductivo,
            amountNet: amount - deductivo,
            state: r['ESTADO'] || 'Activo',
            type: r['TIPO_CONTRATO'] || 'General',
            contractClass: r['CLASE CONTRATO'] || r['CLASE'] || 'Sin Clase',
            investmentType: r['TIPO_INVERSION'] || r['TIPO INVERSION'] || 'Capex',
            investmentGroup: r['GRUPO INVERSION'] || r['GRUPO'] || 'Sin Grupo',
            modalidadContratacion: String(r['MODALIDAD CONTRATACION'] || r['MODALIDAD DE CONTRATACION'] || r['MODALIDAD'] || ''),
            contacto: String(r['CONTACTO'] || r['PERSONA CONTACTO'] || r['PERSONA DE CONTACTO'] || ''),
            payments: payments,
            scheduledPayments: 0,
            provisions: 0,
            serviceOrders: 0,
            changeOrders: 0,
            guarantees: 0,
            retention: retention,
            adelantoContrato: 0,
            amortizacionAdelanto: 0,
            adelantoPorAmortizar: 0,
            progress: 0,
            montoEjecutado: 0,
            balance: 0,
            saldoPorPagar: 0,
            registeredInSap: false,
            paymentsList: [],
            guaranteesList: [],
            provisionsList: [],
            records: [],
            comments: r['COMENTARIOS'] ? [r['COMENTARIOS']] : [],
            specializedData: []
          });
        });

        // 3. Process Secondary Sheets
        const secondarySheets = [
          { name: 'pagos', field: 'payments', valCol: 'MONTO' },
          { name: 'programacion', field: 'scheduledPayments', valCol: 'MONTO' },
          { name: 'provisiones', field: 'provisions', valCol: 'MONTO' },
          { name: 'ordenes_servicio', field: 'serviceOrders', valCol: 'MONTO' },
          { name: 'ordenes_cambio', field: 'changeOrders', valCol: 'MONTO' },
          { name: 'garantias', field: 'guarantees', valCol: 'CARTA FIANZA (US$)' },
          { name: 'custodia', field: 'retention', valCol: 'MONTO' },
        ];

        // Build normalized ID lookup for fallback matching
        const normalizedIdMap = new Map<string, ContractData>();
        contractsMap.forEach((c) => {
          const normKey = normalizeContractId(c.contractId);
          if (!normalizedIdMap.has(normKey)) {
            normalizedIdMap.set(normKey, c);
          }
        });

        secondarySheets.forEach(conf => {
          if (sheetNames.includes(conf.name)) {
            const sheet = workbook.Sheets[conf.name];
            let rows: any[] = XLSX.utils.sheet_to_json(sheet);
            let _matchedRows = 0;
            let _unmatchedIds: string[] = [];

            // Fix: if headers are __EMPTY*, header row detection failed — re-read from correct row
            if (rows.length > 0 && Object.keys(rows[0]).every(k => k.startsWith('__EMPTY') || k === '__rowNum__')) {
              console.log(`[provisions-fix] Sheet "${conf.name}" has __EMPTY headers, attempting auto-fix...`);
              const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
              let headerIdx = 0;
              for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
                const cells = (rawRows[i] || []).map((c: any) => String(c ?? '').toUpperCase());
                if (cells.some((c: string) => c.includes('CONTRATO'))) { headerIdx = i; break; }
              }
              const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
              range.s.r = headerIdx;
              rows = XLSX.utils.sheet_to_json(sheet, { range: XLSX.utils.encode_range(range) });
              console.log(`[provisions-fix] Re-read "${conf.name}" from row ${headerIdx + 1}, ${rows.length} rows. Headers:`, Object.keys(rows[0] || {}).slice(0, 10));
            }

            rows.forEach((row: any) => {
              const r = NORMALIZE_HEADERS(row);
              
              let contractId = normalizeContractId(r['CONTRATO'] || r['CONTRATO_'] || r['N° CONTRATO'] || r['N CONTRATO']);
              if (!contractId) {
                for (const [hKey, hVal] of Object.entries(r)) {
                  const upper = hKey.trim().toUpperCase().replace(/\s+/g, ' ');
                  if (/^N.?\s?CONTRATO_?$/.test(upper) || upper === 'CONTRATO' || upper === 'CONTRATO_') { contractId = normalizeContractId(hVal); break; }
                }
              }
              const addendumId = String(r['ADENDA'] ?? '').trim();

              if (contractId) {
                 // Try exact match first (CONTRATO + ADENDA)
                 let contract: ContractData | undefined;
                 if (addendumId) {
                   contract = contractsMap.get(`${contractId}-${addendumId}`);
                 }
                 // Fallback: try parent contract (adenda 0)
                 if (!contract) {
                   contract = contractsMap.get(`${contractId}-0`);
                 }
                 // Fallback: any adenda for this contract
                 if (!contract) {
                   for (const [k, v] of contractsMap) {
                     if (k.startsWith(`${contractId}-`)) { contract = v; break; }
                   }
                 }
                 // Last fallback: normalized contract ID lookup
                 if (!contract) {
                   contract = normalizedIdMap.get(normalizeContractId(contractId));
                 }

                 if (contract) {
                   _matchedRows++;
                   // Calculate main value to aggregate
                   let val = 0;
                   if (conf.name === 'garantias') {
                      val = parseNumber(
                        r['CARTA FIANZA (US$)'] || 
                        r['CARTA FIANZA'] || 
                        r['MONTO']
                      );
                   } else if (conf.name === 'provisiones') {
                      val = parseNumber(
                        r['SALDO DE PROVISIONES (SIN IGV US$)'] ||
                        r['SALDO DE PROVISIONES'] ||
                        r['SALDO PROVISIONES (SIN IGV US$)'] ||
                        r['SALDO PROVISIONES'] ||
                        r['PROVISIONES'] ||
                        r['MONTO']
                      );
                   } else if (conf.name === 'pagos') {
                      val = parseNumber(
                        r['VALOR SIN IGV 付款金额（不含税）'] ||
                        r['VALOR SIN IGV'] ||
                        r['MONTO']
                      );
                   } else {
                      val = Number(r[conf.valCol] || 0);
                   }

                   // For pagos: on first match, reset contratos baseline to avoid double-counting
                   if (conf.name === 'pagos' && contract.paymentsList.length === 0) {
                     contract.payments = 0;
                     contract.retention = 0;
                   }

                   (contract as any)[conf.field] += val;

                   // Store detailed records for "Historial" block
                   if (conf.name === 'pagos') {
                      const retVal = parseNumber(
                        r['RETENCION FG Y FC US$'] ||
                        r['RETENCION FG Y FC'] ||
                        r['RETENCION'] ||
                        r['RETENCION TOTAL']
                      );
                      if (retVal) {
                        contract.retention += retVal;
                      }

                      const valorizacionId = String(r['VALORIZACION #'] || r['VALORIZACIÓN #'] || r['VALORIZACION'] || r['N° VALORIZACION'] || '-').trim();
                      const isAdelanto = /^A/i.test(valorizacionId);
                      const amortAdelanto = parseNumber(
                        r['AMORTIZACION DEL ADELANTO'] ||
                        r['AMORTIZACION ADELANTO'] ||
                        r['AMORT. ADELANTO'] || 0
                      );

                      if (isAdelanto) {
                        contract.adelantoContrato += val;
                      }
                      if (amortAdelanto) {
                        contract.amortizacionAdelanto += amortAdelanto;
                      }

                      contract.paymentsList.push({
                        valorizacion: valorizacionId,
                        descripcion: r['VAL DESCRIPCION'] || r['DESCRIPCION'] || '-',
                        monto: val,
                        factura: r['FACTURA'] || '-',
                        fechaContabilizacion: parseExcelDate(r['FECHA CONTABILIZACION'] || r['FECHA PAGO']),
                        retencion: retVal || 0,
                        amortizacionAdelanto: amortAdelanto,
                        isAdelanto,
                      });
                   } else if (conf.name === 'garantias') {
                      contract.guaranteesList.push({
                        monto: val,
                        detalle: r['DETALLE DE LA CARTA'] || r['DETALLE'] || '-',
                        entidad: r['ENTIDAD FINANCIERA'] || r['BANCO'] || '-',
                        nroCarta: r['NRO. DE CARTA FIANZA'] || r['CARTA FIANZA NRO'] || '-',
                        fechaEmision: parseExcelDate(r['F. EMISION'] || r['F. EMISIÓN'] || r['FECHA EMISION']),
                        fechaVencimiento: parseExcelDate(r['FECHA DE VENCIMIENTO DE LAS CARTAS FIANZA O POLIZAS DE SEGURO.'] || r['FECHA VENCIMIENTO'])
                      });
                   } else if (conf.name === 'provisiones') {
                      contract.provisionsList.push({
                        monto: val
                      });
                   }

                   if (r['COMENTARIOS']) {
                     contract.comments.push(`[${conf.name}]: ${r['COMENTARIOS']}`);
                   }
                 } else if (_unmatchedIds.length < 10) {
                   _unmatchedIds.push(`${contractId}-${addendumId}`);
                 }
              }
            });
            if (conf.name === 'pagos') {
              const unmatchedCount = rows.length - _matchedRows;
              console.log(`[pagos-debug] Sheet "${conf.name}": ${rows.length} rows, ${_matchedRows} matched, ${unmatchedCount} unmatched${_unmatchedIds.length > 0 ? '. Sample unmatched IDs: ' + _unmatchedIds.join(', ') : ''}`);
              if (_unmatchedIds.length > 0) {
                const sampleKeys = Array.from(contractsMap.keys()).slice(0, 10);
                console.warn(`[pagos-debug] contractsMap sample keys: ${sampleKeys.join(', ')}`);
              }
              // Summary: contracts with/without pagos detail
              let withDetail = 0, withoutDetail = 0;
              contractsMap.forEach(c => { if (c.paymentsList.length > 0) withDetail++; else withoutDetail++; });
              console.log(`[pagos-debug] Contracts with pagos detail: ${withDetail}, using contratos fallback: ${withoutDetail}`);
            }
          }
        });

        // Pagos fallback: if normalized workbook yielded 0 payment records, retry from raw workbook
        // using brute-force header detection (try every row 0..30 as header, pick the one with most contract matches)
        {
          let totalPaymentRecords = 0;
          let totalPaymentAmount = 0;
          contractsMap.forEach(c => {
            totalPaymentRecords += c.paymentsList.length;
            totalPaymentAmount += c.payments;
          });
          console.log(`[pagos-debug] After secondary sheets: paymentsList records = ${totalPaymentRecords}, totalPaymentAmount = ${totalPaymentAmount.toFixed(2)}, contractsMap size = ${contractsMap.size}, pagos in normalized: ${sheetNames.includes('pagos')}`);

          if (totalPaymentRecords === 0) {
            const rawPagosName = resolveSheetName('pagos', rawWorkbook.SheetNames);
            if (rawPagosName) {
              console.log(`[pagos-fallback] Retrying from raw workbook sheet "${rawPagosName}" with brute-force header scan...`);
              const rawSheet = rawWorkbook.Sheets[rawPagosName];
              const allRawRows: any[][] = XLSX.utils.sheet_to_json(rawSheet, { header: 1 });
              console.log(`[pagos-fallback] Raw sheet has ${allRawRows.length} total rows`);

              // Try each row 0..30 as potential header, count how many data rows match a contract
              let bestHeaderIdx = -1;
              let bestMatchCount = 0;
              const contractIds = new Set<string>();
              contractsMap.forEach(c => contractIds.add(c.contractId));

              for (let hIdx = 0; hIdx < Math.min(allRawRows.length, 30); hIdx++) {
                const headerCells = allRawRows[hIdx];
                if (!headerCells || headerCells.length < 2) continue;

                // Find which column contains CONTRATO
                let contratoCol = -1;
                for (let c = 0; c < headerCells.length; c++) {
                  const cellStr = stripAccents(String(headerCells[c] ?? '').trim().toUpperCase());
                  if (cellStr === 'CONTRATO' || cellStr.includes('CONTRATO') || /^N.?\s?CONTRATO/.test(cellStr)) {
                    contratoCol = c;
                    break;
                  }
                }
                if (contratoCol < 0) continue;

                // Count how many subsequent rows have a contract ID that matches contractsMap
                let matchCount = 0;
                for (let r = hIdx + 1; r < Math.min(allRawRows.length, hIdx + 50); r++) {
                  const dataRow = allRawRows[r];
                  if (!dataRow) continue;
                  const cellVal = String(dataRow[contratoCol] ?? '').trim();
                  if (cellVal && contractIds.has(cellVal)) {
                    matchCount++;
                  }
                }

                if (matchCount > bestMatchCount) {
                  bestMatchCount = matchCount;
                  bestHeaderIdx = hIdx;
                }
              }

              console.log(`[pagos-fallback] Best header row: ${bestHeaderIdx + 1} (matched ${bestMatchCount} contract IDs in data)`);

              if (bestHeaderIdx >= 0 && bestMatchCount > 0) {
                // Re-read using the best header row
                const range = XLSX.utils.decode_range(rawSheet['!ref'] || 'A1');
                range.s.r = bestHeaderIdx;
                const rawRows = XLSX.utils.sheet_to_json(rawSheet, { range: XLSX.utils.encode_range(range) });
                console.log(`[pagos-fallback] Read ${rawRows.length} data rows from header at row ${bestHeaderIdx + 1}`);

                if (rawRows.length > 0) {
                  const sampleR = NORMALIZE_HEADERS(rawRows[0]);
                  console.log('[pagos-fallback] Columns:', Object.keys(sampleR).filter(k => k === k.toUpperCase()).slice(0, 12));
                }

                let fallbackMatched = 0;
                rawRows.forEach((row: any) => {
                  const r = NORMALIZE_HEADERS(row);

                  let contractId = normalizeContractId(r['CONTRATO'] || r['CONTRATO_'] || r['N° CONTRATO'] || r['N CONTRATO']);
                  if (!contractId) {
                    for (const [hKey, hVal] of Object.entries(r)) {
                      const upper = stripAccents(hKey.trim().toUpperCase().replace(/\s+/g, ' '));
                      if (/^N.?\s?CONTRATO_?$/.test(upper) || upper === 'CONTRATO' || upper === 'CONTRATO_') { contractId = normalizeContractId(hVal); break; }
                    }
                  }
                  const addendumId = String(r['ADENDA'] ?? '').trim();

                  if (contractId) {
                    let contract: ContractData | undefined;
                    if (addendumId) {
                      contract = contractsMap.get(`${contractId}-${addendumId}`);
                    }
                    if (!contract) {
                      contract = contractsMap.get(`${contractId}-0`);
                    }
                    if (!contract) {
                      for (const [k, v] of contractsMap) {
                        if (k.startsWith(`${contractId}-`)) { contract = v; break; }
                      }
                    }

                    if (contract) {
                      fallbackMatched++;
                      // On first match, reset contratos baseline to avoid double-counting
                      if (contract.paymentsList.length === 0) {
                        contract.payments = 0;
                        contract.retention = 0;
                      }
                      const val = parseNumber(
                        r['VALOR SIN IGV 付款金额（不含税）'] ||
                        r['VALOR SIN IGV'] ||
                        r['VALOR'] ||
                        r['MONTO']
                      );
                      contract.payments += val;

                      const retVal = parseNumber(
                        r['RETENCION FG Y FC US$'] ||
                        r['RETENCION FG Y FC'] ||
                        r['RETENCION'] ||
                        r['RETENCION TOTAL']
                      );
                      if (retVal) {
                        contract.retention += retVal;
                      }

                      const valorizacionId = String(r['VALORIZACION #'] || r['VALORIZACIÓN #'] || r['VALORIZACION'] || r['N° VALORIZACION'] || '-').trim();
                      const isAdelanto = /^A/i.test(valorizacionId);
                      const amortAdelanto = parseNumber(
                        r['AMORTIZACION DEL ADELANTO'] ||
                        r['AMORTIZACION ADELANTO'] ||
                        r['AMORT. ADELANTO'] || 0
                      );

                      if (isAdelanto) {
                        contract.adelantoContrato += val;
                      }
                      if (amortAdelanto) {
                        contract.amortizacionAdelanto += amortAdelanto;
                      }

                      contract.paymentsList.push({
                        valorizacion: valorizacionId,
                        descripcion: r['VAL DESCRIPCION'] || r['DESCRIPCION'] || '-',
                        monto: val,
                        factura: r['FACTURA'] || '-',
                        fechaContabilizacion: parseExcelDate(r['FECHA CONTABILIZACION'] || r['FECHA PAGO']),
                        retencion: retVal || 0,
                        amortizacionAdelanto: amortAdelanto,
                        isAdelanto,
                      });

                      if (r['COMENTARIOS']) {
                        contract.comments.push(`[pagos]: ${r['COMENTARIOS']}`);
                      }
                    }
                  }
                });
                console.log(`[pagos-fallback] Matched ${fallbackMatched} of ${rawRows.length} rows to contracts.`);
              } else {
                console.warn('[pagos-fallback] Could not find a valid header row with matching contract IDs.');
                console.warn('[pagos-fallback] Sample raw rows:', allRawRows.slice(0, 5).map(r => (r || []).slice(0, 5)));
                console.warn('[pagos-fallback] Sample contractsMap keys:', Array.from(contractsMap.keys()).slice(0, 5));
              }
            } else {
              console.warn('[pagos-debug] No pagos sheet found in raw workbook. Raw sheets:', rawWorkbook.SheetNames);
            }
          }
        }

        // Debug: provisions data flow
        if (sheetNames.includes('provisiones')) {
          const pSheet = workbook.Sheets['provisiones'];
          const pRows = XLSX.utils.sheet_to_json(pSheet);
          console.log('[provisions-debug] Sheet "provisiones" found. Total rows:', pRows.length);
          if (pRows.length > 0) {
            const sample = NORMALIZE_HEADERS(pRows[0]);
            console.log('[provisions-debug] Column names:', Object.keys(sample).filter(k => k === k.toUpperCase()));
            console.log('[provisions-debug] First row sample:', JSON.stringify(sample).substring(0, 500));
          }
          let matchedCount = 0;
          let totalProv = 0;
          const unmatchedIds: string[] = [];
          pRows.forEach((row: any) => {
            const r = NORMALIZE_HEADERS(row);
            const cId = r['CONTRATO'] || r['N° CONTRATO'] || r['N CONTRATO'];
            const aId = r['ADENDA'];
            const key = `${cId}-${aId}`;
            const found = contractsMap.has(key) || contractsMap.has(`${cId}-0`);
            if (found) {
              matchedCount++;
            } else if (unmatchedIds.length < 5) {
              unmatchedIds.push(key);
            }
          });
          contractsMap.forEach((c) => { if (c.provisions > 0) { totalProv += c.provisions; } });
          console.log('[provisions-debug] Rows matched to contracts:', matchedCount, '/', pRows.length);
          console.log('[provisions-debug] Total provisions accumulated:', totalProv);
          if (unmatchedIds.length > 0) {
            console.log('[provisions-debug] Sample UNMATCHED contract keys:', unmatchedIds);
            const sampleKeys = Array.from(contractsMap.keys()).slice(0, 5);
            console.log('[provisions-debug] Sample CONTRACT MAP keys:', sampleKeys);
          }
        } else {
          console.log('[provisions-debug] Sheet "provisiones" NOT found. Available sheets:', sheetNames);
        }

        // Special handling for 'avance_semanal' if it exists
        // Assuming it provides a percentage or amount for 'progress'
        if (sheetNames.includes('avance_semanal')) {
           const sheet = workbook.Sheets['avance_semanal'];
           const rows = XLSX.utils.sheet_to_json(sheet);
           rows.forEach((row: any) => {
             const r = NORMALIZE_HEADERS(row);
             const contractId = r['CONTRATO'];
             const addendumId = r['ADENDA'];
             const key = `${contractId}-${addendumId}`;
             const contract = contractsMap.get(key);
             if (contract) {
               // Assuming AVANCE is a percentage 0-100 or 0-1
               // Or is it an amount? Let's assume percentage for now, or look for 'VALORIZACION' for amount
               // Let's use 'AVANCE' column
               contract.progress = Math.max(contract.progress, Number(r['AVANCE'] || 0));
             }
           });
        }

        // Compute montoEjecutado after progress is known
        contractsMap.forEach(contract => {
          const pct = contract.progress > 1 ? contract.progress : contract.progress * 100;
          contract.montoEjecutado = (pct / 100) * contract.amountNet;
        });

        // Process 'con_sap' to mark contracts registered in SAP
        if (sheetNames.includes('con_sap')) {
          const sheet = workbook.Sheets['con_sap'];
          const rows = XLSX.utils.sheet_to_json(sheet);
          const sapContractIds = new Set<string>();
          rows.forEach((row: any) => {
            const r = NORMALIZE_HEADERS(row);
            const contractId = r['CONTRATO'] || r['N° CONTRATO'] || r['N CONTRATO'];
            if (contractId) sapContractIds.add(String(contractId));
          });
          contractsMap.forEach(c => {
            if (sapContractIds.has(c.contractId)) {
              c.registeredInSap = true;
            }
          });
        }

        // 3b. Process Specialized Sheets (E_obras, E_arrendamiento, etc.)
        // These are discovered from the RAW workbook since normalizeWorkbook discards unmapped sheets.
        const eSheetNames = rawWorkbook.SheetNames.filter(name => /^E_/i.test(name));

        // Build lookups for flexible matching
        const contractIdToKeys = new Map<string, string[]>();
        // Also build a normalized lookup: uppercase trimmed contractId → keys
        const normalizedIdToKeys = new Map<string, string[]>();
        contractsMap.forEach((c, key) => {
          const existing = contractIdToKeys.get(c.contractId) || [];
          existing.push(key);
          contractIdToKeys.set(c.contractId, existing);

          const norm = c.contractId.trim().toUpperCase();
          const normExisting = normalizedIdToKeys.get(norm) || [];
          normExisting.push(key);
          normalizedIdToKeys.set(norm, normExisting);
        });

        for (const eSheetName of eSheetNames) {
          const sheetType = eSheetName.replace(/^E_/i, '').toLowerCase();
          const sheetLabel = sheetType.charAt(0).toUpperCase() + sheetType.slice(1);

          const rawSheet = rawWorkbook.Sheets[eSheetName];
          // Use combined anchors for better header detection on specialized sheets
          const eAnchors = sheetType.includes('avance')
            ? ['CONTRATO', 'ADENDA', 'SEMANA', 'FECHA', 'AVANCE']
            : ['CONTRATO', 'ADENDA'];
          const eHeaderRow = detectHeaderRow(rawSheet, undefined, 30, eAnchors);
          console.log(`[E_ Sheet] "${eSheetName}": headerRow detected at index ${eHeaderRow} (row ${eHeaderRow + 1}), anchors used:`, eAnchors);

          // Log raw rows around the detected header for debugging
          const rawDebugRows: any[][] = XLSX.utils.sheet_to_json(rawSheet, { header: 1 });
          if (rawDebugRows.length > eHeaderRow) {
            console.log(`[E_ Sheet] "${eSheetName}" header row content:`, rawDebugRows[eHeaderRow]?.slice(0, 10));
          }

          const eRows = extractSheetData(rawSheet, eHeaderRow);

          // Collect columns for logging
          let detectedColumns: string[] = [];
          if (eRows.length > 0) {
            const sampleRow = NORMALIZE_HEADERS(eRows[0]);
            detectedColumns = Object.keys(sampleRow);
            console.log(`[E_ Sheet] "${eSheetName}": ${eRows.length} filas, header en fila ${eHeaderRow + 1}, columnas: [${detectedColumns.join(' | ')}]`);
            console.log(`[E_ Sheet] "${eSheetName}" primera fila valores: ${JSON.stringify(sampleRow).substring(0, 800)}`);
          }

          let matchCount = 0;
          let missCount = 0;
          const sampleEIds: string[] = [];

          eRows.forEach((row: any, rowIdx: number) => {
            const r = NORMALIZE_HEADERS(row);

            // ---- Extract contract ID from E_ row ----
            let rawContractId: any = undefined;
            let adendaVal: any = undefined;

            // Strategy 1: N° CONTRATO / Nº CONTRATO / etc. (regex for Unicode variants)
            for (const [key, value] of Object.entries(r)) {
              const upper = key.trim().toUpperCase().replace(/\s+/g, ' ');
              if (!rawContractId && /^N.?\s?CONTRATO$/.test(upper)) {
                rawContractId = value;
              }
              if (upper === 'ADENDA') {
                adendaVal = value;
              }
            }

            // Strategy 2: standalone "CONTRATO" column
            if (!rawContractId) {
              for (const [key, value] of Object.entries(r)) {
                const upper = key.trim().toUpperCase().replace(/\s+/g, ' ');
                if (upper === 'CONTRATO') {
                  rawContractId = value;
                  break;
                }
              }
            }

            // Strategy 3: "CONTRATO + ADENDA" combined column
            if (!rawContractId) {
              for (const [key, value] of Object.entries(r)) {
                const upper = key.trim().toUpperCase().replace(/\s+/g, ' ');
                if (upper.includes('CONTRATO') && upper.includes('ADENDA')) {
                  const combined = String(value).trim();
                  const lastDash = combined.lastIndexOf('-');
                  if (lastDash > 0) {
                    rawContractId = combined.substring(0, lastDash);
                    if (adendaVal === undefined || adendaVal === null) {
                      adendaVal = combined.substring(lastDash + 1);
                    }
                  } else {
                    rawContractId = combined;
                  }
                  break;
                }
              }
            }

            // Strategy 4: any column containing "CONTRATO" (last resort for ID detection)
            if (!rawContractId) {
              for (const [key, value] of Object.entries(r)) {
                const upper = key.trim().toUpperCase().replace(/\s+/g, ' ');
                if (upper.includes('CONTRATO') && value != null && String(value).trim() !== '') {
                  rawContractId = value;
                  break;
                }
              }
            }

            if (!rawContractId) {
              // Fallback: if only one contract exists, assign rows to it
              const allKeys = Array.from(contractsMap.keys());
              const uniqueContracts = new Set(allKeys.map(k => {
                const parts = k.split('-');
                parts.pop(); // remove adenda suffix
                return parts.join('-');
              }));

              if (uniqueContracts.size === 1) {
                rawContractId = uniqueContracts.values().next().value;
                if (rowIdx < 3) {
                  console.log(`[E_ Sheet] "${eSheetName}" fila ${rowIdx}: sin ID de contrato, asignando a único contrato: ${rawContractId}`);
                }
              } else {
                if (rowIdx < 3) {
                  console.warn(`[E_ Sheet] "${eSheetName}" fila ${rowIdx}: NO se encontró ID de contrato. Keys: [${Object.keys(r).join(' | ')}]. Values: [${Object.values(r).map(v => String(v).substring(0, 30)).join(' | ')}]`);
                }
                missCount++;
                return;
              }
            }

            const contractId = String(rawContractId).trim();
            if (sampleEIds.length < 5) sampleEIds.push(contractId);

            const adendaStr = adendaVal !== undefined && adendaVal !== null ? String(adendaVal).trim() : '0';

            // ---- Build data object from non-identifier columns ----
            const data: Record<string, any> = {};
            const seenKeys = new Set<string>();
            for (const [key, value] of Object.entries(r)) {
              const upperKey = stripAccents(key.trim().toUpperCase().replace(/\s+/g, ' '));
              if (/^N.?\s?CONTRATO$/.test(upperKey)) continue;
              if (upperKey === 'CONTRATO' || upperKey === 'ADENDA') continue;
              if (upperKey.includes('CONTRATO +') || upperKey.includes('CONTRATO+')) continue;
              if (/^ITEM$/i.test(upperKey)) continue;
              if (seenKeys.has(upperKey)) continue;
              seenKeys.add(upperKey);
              if (value !== null && value !== undefined && String(value).trim() !== '') {
                data[upperKey] = value;
              }
            }

            // ---- Match to contracts with multiple fallbacks ----
            let matched = false;

            // Match 1: exact key contractId-adenda
            const specificKey = `${contractId}-${adendaStr}`;
            const specificContract = contractsMap.get(specificKey);
            if (specificContract) {
              specificContract.specializedData.push({ sheetType, sheetLabel, data });
              matched = true;
            }

            // Match 2: try addendum 0
            if (!matched) {
              const primaryKey = `${contractId}-0`;
              const primaryContract = contractsMap.get(primaryKey);
              if (primaryContract) {
                primaryContract.specializedData.push({ sheetType, sheetLabel, data });
                matched = true;
              }
            }

            // Match 3: lookup by contractId in contractIdToKeys
            if (!matched) {
              const keys = contractIdToKeys.get(contractId);
              if (keys) {
                const contract = contractsMap.get(keys[0]);
                if (contract) {
                  contract.specializedData.push({ sheetType, sheetLabel, data });
                  matched = true;
                }
              }
            }

            // Match 4: normalized uppercase comparison
            if (!matched) {
              const normId = contractId.toUpperCase();
              const keys = normalizedIdToKeys.get(normId);
              if (keys) {
                const contract = contractsMap.get(keys[0]);
                if (contract) {
                  contract.specializedData.push({ sheetType, sheetLabel, data });
                  matched = true;
                }
              }
            }

            // Match 5: substring/contains match (E_ ID contains contractMap ID or vice versa)
            if (!matched) {
              const normId = contractId.toUpperCase().trim();
              for (const [mapKey, contract] of contractsMap) {
                const mapId = contract.contractId.toUpperCase().trim();
                if (normId.includes(mapId) || mapId.includes(normId)) {
                  contract.specializedData.push({ sheetType, sheetLabel, data });
                  matched = true;
                  break;
                }
              }
            }

            if (matched) matchCount++;
            else missCount++;
          });

          console.log(`[E_ Sheet] "${eSheetName}": ${matchCount} vinculadas, ${missCount} sin match de ${eRows.length} filas`);
          const sampleMapKeys = Array.from(contractsMap.keys()).slice(0, 5);
          if (matchCount === 0 && eRows.length > 0) {
            console.warn(`[E_ Sheet] WARNING: 0 matches! E_ IDs: [${sampleEIds.join(', ')}] contractsMap keys: [${sampleMapKeys.join(', ')}]`);
          }

          // Save log for UI diagnostics
          result.specializedSheetLogs.push({
            sheetName: eSheetName,
            rowCount: eRows.length,
            matchCount,
            missCount,
            detectedColumns,
            sampleEIds,
            sampleContractMapKeys: sampleMapKeys,
          });
        }

        // 4. Calculate Balances
        // Saldo = Monto Contractual - Pagos (usually) or Monto - Ejecutado?
        // User said: "Saldo" in Detail view.
        // Let's assume Saldo = Amount - Payments for now, or Amount - Provisions?
        // Let's stick to Amount - Payments as a safe default for "financial balance".
        
        contractsMap.forEach(c => {
          c.balance = c.amount - c.payments;
          c.adelantoPorAmortizar = c.adelantoContrato - c.amortizacionAdelanto;
          c.saldoPorPagar = c.amountNet - c.payments;
        });

        result.contracts = Array.from(contractsMap.values());

        // 5. Aggregate for Consolidated View
        const consolidatedMap = new Map<string, ConsolidatedContract>();
        
        result.contracts.forEach(c => {
          if (!consolidatedMap.has(c.contractId)) {
            consolidatedMap.set(c.contractId, {
              contractId: c.contractId,
              totalAmount: 0,
              totalExecuted: 0, // Using provisions or progress? Let's use payments for now or provisions if available
              totalPaid: 0,
              progressPercent: 0,
              totalBalance: 0,
              totalRetention: 0,
              totalGuarantees: 0,
              state: 'Activo', // Default
              items: []
            });
          }
          
          const master = consolidatedMap.get(c.contractId)!;
          master.items.push(c);
          master.totalAmount += c.amount;
          master.totalPaid += c.payments;
          master.totalBalance += c.balance;
          master.totalRetention += c.retention;
          master.totalGuarantees += c.guarantees;
          // Executed might be provisions?
          master.totalExecuted += c.provisions;
          
          // Determine state from main contract (adenda 0 usually holds the state)
          if (c.addendumId === '0' && c.state) {
            master.state = c.state;
          }
        });

        // Calculate weighted progress for consolidated?
        // Simple average for now or weighted by amount
        consolidatedMap.forEach(m => {
          if (m.totalAmount > 0) {
             // Weighted progress
             const weightedProgress = m.items.reduce((acc, item) => acc + (item.progress * item.amount), 0);
             m.progressPercent = weightedProgress / m.totalAmount;
          } else {
             m.progressPercent = 0;
          }
        });

        result.consolidated = Array.from(consolidatedMap.values());

        resolve(result);

      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
