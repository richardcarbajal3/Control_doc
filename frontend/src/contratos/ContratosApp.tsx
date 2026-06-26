import './contratos.css';
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
import { AnalysisSyncProvider, useAnalysisSyncContext } from '@/lib/useAnalysisSync';

function HomeRedirect() {
  const hasData = useAppStore(s => s.contracts.length > 0);
  const sync = useAnalysisSyncContext();
  if (!hasData) {
    const syncing = sync?.status === 'loading';
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-3xl font-bold mb-2">Análisis de Contratos</h1>
          <p className="text-muted-foreground mb-8">
            {syncing
              ? 'Sincronizando el archivo desde SharePoint…'
              : 'Cargue un archivo Excel con los datos de contratos, o sincronícelo desde SharePoint.'}
          </p>
          {sync?.status === 'error' && (
            <p className="text-sm text-destructive mb-4 whitespace-pre-line">{sync.error}</p>
          )}
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AnalysisSyncProvider>
          <Router hook={useHashLocation}>
            <Layout>
              <ContratosRouter />
            </Layout>
          </Router>
        </AnalysisSyncProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
