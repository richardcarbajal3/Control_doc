import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
// El módulo de Análisis vive bajo el alias "@" (frontend/src/contratos); la API
// compartida de la app está fuera de ese alias, de ahí la ruta relativa.
import { fetchAnalysisFile } from '../../api/sync';
import { processExcelFile } from './excel-processor';
import { useAppStore } from '../store';

export interface AnalysisSyncState {
  status: 'idle' | 'loading' | 'done' | 'empty' | 'error';
  error: string | null;
  lastSynced: Date | null;
  sync: () => Promise<void>;
}

// Descarga el Excel de Análisis configurado en SharePoint y lo carga en el store
// del módulo (mismo parser que la carga manual). Al montar, intenta una carga
// automática solo si todavía no hay datos, para no pisar un archivo que el
// usuario haya subido a mano. El botón de recarga fuerza una nueva descarga.
export function useAnalysisSync(): AnalysisSyncState {
  const [status, setStatus] = useState<AnalysisSyncState['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const setData = useAppStore((s) => s.setData);

  const sync = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const buffer = await fetchAnalysisFile();
      if (!buffer) {
        setStatus('empty'); // no hay enlace configurado todavía
        return;
      }
      const result = await processExcelFile(buffer);
      if (result.errors.length > 0) {
        setError(result.errors.join('\n'));
        setStatus('error');
        return;
      }
      setData(result.contracts, result.consolidated, result.specializedSheetLogs);
      setLastSynced(new Date());
      setStatus('done');
    } catch (e: any) {
      setError(e?.message || 'No se pudo sincronizar el archivo de Análisis');
      setStatus('error');
    }
  }, [setData]);

  useEffect(() => {
    // Carga automática inicial solo si el store está vacío.
    if (useAppStore.getState().contracts.length === 0) {
      void sync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, error, lastSynced, sync };
}

// Contexto para compartir el estado de la sincronización entre el contenedor del
// módulo (que dispara la carga automática) y la UI (barra lateral, pantalla de
// inicio) sin volver a descargar el archivo en cada componente.
const AnalysisSyncContext = createContext<AnalysisSyncState | null>(null);

export function AnalysisSyncProvider({ children }: { children: ReactNode }) {
  const state = useAnalysisSync();
  return createElement(AnalysisSyncContext.Provider, { value: state }, children);
}

export function useAnalysisSyncContext(): AnalysisSyncState | null {
  return useContext(AnalysisSyncContext);
}
