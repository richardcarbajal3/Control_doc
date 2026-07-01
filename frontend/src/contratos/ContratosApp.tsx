import './contratos.css';
import { useEffect, useRef } from 'react';
import { Switch, Route, Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/queryClient';
import ExecutiveView from '@/pages/executive-view';
import ConsolidatedView from '@/pages/consolidated-view';
import DetailView from '@/pages/detail-view';
import KpiConfig from '@/pages/kpi-config';
import DailyProgress from '@/pages/daily-progress';
import { FileUpload } from '@/components/file-upload';
import { useAppStore } from '@/store';
import { useKpiConfigStore } from '@/lib/kpi-store';
import { processExcelBuffer } from '@/lib/excel-processor';
import { getContractsFile } from '../api/sync';

// Decodifica base64 a bytes para poder procesar el .xlsx que sirve el backend.
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function HomeRedirect() {
  const hasData = useAppStore(s => s.contracts.length > 0);
  const hydrating = useAppStore(s => s.hydrating);
  if (hydrating && !hasData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Cargando datos de contratos...</p>
        </div>
      </div>
    );
  }
  if (!hasData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-3xl font-bold mb-2">Análisis de Contratos</h1>
          <p className="text-muted-foreground mb-8">
            Cargue un archivo Excel con los datos de contratos para comenzar.
          </p>
          <FileUpload />
        </div>
      </div>
    );
  }
  return <ExecutiveView />;
}

function ContratosRouter() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/executive" component={ExecutiveView} />
      <Route path="/consolidated" component={ConsolidatedView} />
      <Route path="/detail" component={DetailView} />
      <Route path="/kpis" component={KpiConfig} />
      <Route path="/daily-progress" component={DailyProgress} />
      <Route>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Página no encontrada</p>
        </div>
      </Route>
    </Switch>
  );
}

export default function ContratosApp() {
  const setData = useAppStore(s => s.setData);
  const hydrateData = useAppStore(s => s.hydrateFromServer);
  const hydrateKpis = useKpiConfigStore(s => s.hydrateFromServer);
  const tried = useRef(false);

  // Al entrar al módulo: (1) sincronizar la config de KPIs de la organización;
  // (2) cargar datos con esta prioridad — primero el Excel fresco que la
  // sincronización automática dejó en el servidor (fuente de verdad) y, si no
  // hay o falla, el último snapshot procesado guardado para la organización.
  // La sesión la aporta el fetch global instalado en main.jsx.
  useEffect(() => {
    hydrateKpis();
    if (tried.current) return;
    tried.current = true;
    (async () => {
      try {
        const f = await getContractsFile();
        if (f && f.file_base64) {
          const result = await processExcelBuffer(base64ToBytes(f.file_base64));
          if (result.contracts.length > 0) {
            setData(result.contracts, result.consolidated, result.specializedSheetLogs, f.filename || null);
            return;
          }
        }
      } catch (e) {
        console.warn('[contratos] auto-carga desde SharePoint falló:', e);
      }
      // Respaldo: último snapshot persistido (también libera el flag hydrating).
      await hydrateData();
    })();
  }, [setData, hydrateData, hydrateKpis]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <ContratosRouter />
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
