import { useState } from "react";
import { Layout } from "@/components/layout";
import { ClipboardList } from "lucide-react";
// Reutilizamos los mismos componentes de reporte del módulo Documentos, para
// que "Reportes Control Doc" se vea igual aquí, dentro del dashboard de
// contratos, sin duplicar lógica. Traen sus propios datos vía el API global.
import PresentationReport from "../../components/PresentationReport";
import ReportView from "../../components/ReportView";

type View = "presentation" | "custom";

export default function ControlDocReports() {
  const [view, setView] = useState<View>("presentation");

  const tab = (key: View, label: string) => (
    <button
      key={key}
      onClick={() => setView(key)}
      className={
        "px-3 py-1.5 text-sm font-medium rounded-md border transition-colors " +
        (view === key
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-muted-foreground border-border hover:bg-muted")
      }
    >
      {label}
    </button>
  );

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Reportes Control Doc</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Los mismos reportes del módulo de Documentos, disponibles aquí junto al
        análisis de contratos.
      </p>

      <div className="flex gap-2 mb-4">
        {tab("presentation", "CD_Reporte")}
        {tab("custom", "Reporte configurable")}
      </div>

      <div className="cd-reports-embed">
        {view === "presentation" ? <PresentationReport /> : <ReportView />}
      </div>
    </Layout>
  );
}
