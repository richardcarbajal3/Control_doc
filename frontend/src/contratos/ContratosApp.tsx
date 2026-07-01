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
import { Layout } from '@/components/layout';
import { FileUpload } from '@/components/file-upload';
import { useAppStore } from '@/store';
import { processExcelBuffer } from '@/lib/excel-processor';
import { getContractsFile } from '../api/sync';

// Decodifica base64 a bytes para poder procesar el .xlsx que sirve el backend.
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Al abrir Análisis, si no hay datos cargados, intenta traer el Excel que la
// sincronización automática guardó en el servidor y procesarlo con el mismo
// motor que la carga manual. Silencioso: si no hay archivo o falla, cae al
// flujo de subida manual sin molestar.
function useAutoLoadContracts() {
  const setData = useAppStore(s => s.setData);
  const hasData = useAppStore(s => s.contracts.length > 0);
  const tried = useRef(false);

  useEffect(() => {
    if (hasData || tried.current) return;
    tried.current = true;
    (async () => {
      try {
        const f = await getContractsFile();
        if (!f || !f.file_base64) return;
        const result = await processExcelBuffer(base64ToBytes(f.file_base64));
        if (result.contracts.length > 0) {
          setData(result.contracts, result.consolidated, result.specializedSheetLogs);
        }
      } catch (e) {
        console.warn('[contratos] auto-carga desde SharePoint falló:', e);
      }
    })();
  }, [hasData, setData]);
}

function HomeRedirect() {
  const hasData = useAppStore(s => s.contracts.length > 0);
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
  useAutoLoadContracts();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <Layout>
            <ContratosRouter />
          </Layout>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
