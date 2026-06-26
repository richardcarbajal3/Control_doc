import { useState, useMemo } from "react";
import { useAppStore } from "@/store";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Area, ComposedChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, Target, Gauge, AlertTriangle, ClipboardCheck,
  CalendarDays, Filter, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractAvanceByContract, getContractsWithAvance,
  computeAvanceKpis, groupByWeek, formatShortDate, findLastRealDayIndex,
  type AvanceDayEntry, type AvanceKpis,
} from "@/lib/avance-utils";

export default function DailyProgress() {
  const contracts = useAppStore(s => s.contracts);
  const [selectedContract, setSelectedContract] = useState<string>("");
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  // Contracts with avance data
  const contractsWithAvance = useMemo(() => getContractsWithAvance(contracts), [contracts]);

  // All avance data grouped by contract
  const avanceMap = useMemo(() => extractAvanceByContract(contracts), [contracts]);

  // Auto-select first contract
  const activeContract = selectedContract || (contractsWithAvance.length > 0 ? contractsWithAvance[0].contractId : "");

  // Day entries for selected contract
  const dayEntries = useMemo(() => avanceMap.get(activeContract) || [], [avanceMap, activeContract]);

  // KPIs
  const kpis = useMemo(() => computeAvanceKpis(dayEntries), [dayEntries]);

  // Weekly data
  const weeklyData = useMemo(() => groupByWeek(dayEntries), [dayEntries]);

  // Check if there is any actual "Avance Real" data
  const hasRealData = useMemo(() => dayEntries.some(e => e.avanceReal > 0 || e.avanceRealAcum > 0), [dayEntries]);

  // Chart data for S-curve with projection
  const curveData = useMemo(() => {
    if (dayEntries.length === 0) return [];

    // Find the true last day with real progress (not carried-forward values)
    const lastRealIdx = findLastRealDayIndex(dayEntries);

    const base = dayEntries.map((e, i) => ({
      dia: e.dia,
      fechaDD: e.fecha ? formatShortDate(e.fecha) : `Día ${e.dia}`,
      fechaShort: e.fecha ? formatShortDate(e.fecha) : `D${e.dia}`,
      programado: Math.round(e.avanceProgramadoAcum * 100) / 100,
      // Only show real data up to the last day with actual progress
      real: hasRealData && lastRealIdx >= 0 && i <= lastRealIdx && e.avanceRealAcum > 0
        ? Math.round(e.avanceRealAcum * 100) / 100
        : null,
      proyeccion: null as number | null,
    }));

    // Insert origin point (0%) before the first day so curves start from zero
    // Use "Inicio" label (not a previous date) since work begins on Día 1's date
    const firstEntry = dayEntries[0];
    const originDia = firstEntry.dia - 1;
    base.unshift({
      dia: originDia,
      fechaDD: 'Inicio',
      fechaShort: 'Inicio',
      programado: 0,
      real: hasRealData ? 0 : null,
      proyeccion: null,
    });

    if (!hasRealData || lastRealIdx < 0) return base;

    // After unshift, base indices are offset by 1 from dayEntries indices
    const baseOffset = 1;

    const firstRealIdx = dayEntries.findIndex(e => e.avanceRealAcum > 0);
    if (firstRealIdx < 0 || firstRealIdx >= lastRealIdx) return base;

    // ---------- EWMA: Exponentially Weighted Moving Average ----------
    // Compute daily rates between consecutive real data points
    const dailyRates: { rate: number; dias: number }[] = [];
    let prevIdx = firstRealIdx;
    for (let i = firstRealIdx + 1; i <= lastRealIdx; i++) {
      if (dayEntries[i].avanceRealAcum > 0 && dayEntries[i].avanceRealAcum >= dayEntries[prevIdx].avanceRealAcum) {
        const deltaDias = dayEntries[i].dia - dayEntries[prevIdx].dia;
        if (deltaDias > 0) {
          const deltaAvance = dayEntries[i].avanceRealAcum - dayEntries[prevIdx].avanceRealAcum;
          dailyRates.push({ rate: deltaAvance / deltaDias, dias: deltaDias });
          prevIdx = i;
        }
      }
    }
    if (dailyRates.length === 0) return base;

    // EWMA: alpha=0.3 means recent days get ~70% more weight per step
    const alpha = 0.3;
    let weightedSum = 0;
    let weightSum = 0;
    for (let i = 0; i < dailyRates.length; i++) {
      const weight = Math.pow(1 - alpha, dailyRates.length - 1 - i);
      weightedSum += dailyRates[i].rate * weight;
      weightSum += weight;
    }
    const tasaDiariaEWMA = weightedSum / weightSum;
    if (tasaDiariaEWMA <= 0) return base;

    const lastReal = dayEntries[lastRealIdx];
    const lastRealAcum = lastReal.avanceRealAcum;
    const lastDia = lastReal.dia;
    const lastRealDate = lastReal.fecha;
    const lastProgramadoAcum = lastReal.avanceProgramadoAcum;

    // ---------- SPI-blended projection ----------
    // SPI = avanceRealAcum / avanceProgramadoAcum at the last real data point
    const spi = lastProgramadoAcum > 0 ? lastRealAcum / lastProgramadoAcum : 1;

    // Blend weight: how much to trust EWMA vs SPI-based projection
    // Early in the project (few data points) → lean on SPI (follows schedule shape)
    // Later (many data points) → lean on EWMA (actual observed pace)
    const totalDays = dayEntries.length;
    const daysWithData = lastRealIdx - firstRealIdx + 1;
    const dataRatio = Math.min(1, daysWithData / totalDays);
    // Smooth sigmoid-like transition: wEWMA goes from ~0 to ~1 as data accumulates
    const wEWMA = dataRatio * dataRatio; // quadratic ramp-up
    const wSPI = 1 - wEWMA;

    // ---------- Blended projection function ----------
    // For a future day d, compute projected acum using both methods and blend:
    //   EWMA: lastRealAcum + tasaDiariaEWMA * (d - lastDia)
    //   SPI:  lastRealAcum + spi * (programadoAcum[d] - programadoAcumAtLastReal)
    // Final: wEWMA * ewmaProj + wSPI * spiProj
    const programadoAtLastReal = lastProgramadoAcum;

    // Helper: get programado acum for a given day number (interpolated from dayEntries)
    const getProgramadoAcumForDia = (dia: number): number => {
      // Find the two entries that bracket this day
      if (dia <= dayEntries[0].dia) return dayEntries[0].avanceProgramadoAcum;
      if (dia >= dayEntries[dayEntries.length - 1].dia) return dayEntries[dayEntries.length - 1].avanceProgramadoAcum;
      for (let j = 0; j < dayEntries.length - 1; j++) {
        if (dayEntries[j].dia <= dia && dayEntries[j + 1].dia > dia) {
          // Linear interpolation
          const span = dayEntries[j + 1].dia - dayEntries[j].dia;
          const frac = span > 0 ? (dia - dayEntries[j].dia) / span : 0;
          return dayEntries[j].avanceProgramadoAcum + frac * (dayEntries[j + 1].avanceProgramadoAcum - dayEntries[j].avanceProgramadoAcum);
        }
      }
      return dayEntries[dayEntries.length - 1].avanceProgramadoAcum;
    };

    const projectForDia = (dia: number): number => {
      const delta = dia - lastDia;
      if (delta <= 0) return lastRealAcum;
      const ewmaProj = lastRealAcum + tasaDiariaEWMA * delta;
      const progAtDia = getProgramadoAcumForDia(dia);
      const spiProj = lastRealAcum + spi * (progAtDia - programadoAtLastReal);
      // Blend and clamp
      const blended = wEWMA * ewmaProj + wSPI * spiProj;
      return Math.min(100, Math.round(blended * 100) / 100);
    };

    // Estimate completion day using blended rate
    // Use EWMA rate as fallback for days beyond the schedule
    const restante = 100 - lastRealAcum;
    // Approximate blended daily rate for beyond-schedule estimation
    const lastScheduledDia = dayEntries[dayEntries.length - 1].dia;
    const totalScheduledDays = lastScheduledDia - dayEntries[0].dia;
    // Beyond schedule we can only use EWMA since there's no programado curve
    const diasParaCompletar = Math.ceil(restante / tasaDiariaEWMA);
    const diaFinalProyectado = lastDia + diasParaCompletar;

    // ---------- Generate projection: fill remaining base entries + extend ----------
    const lastRealBaseIdx = lastRealIdx + baseOffset;
    base[lastRealBaseIdx].proyeccion = Math.round(lastRealAcum * 100) / 100;

    let maxProj = Math.round(lastRealAcum * 100) / 100;
    for (let i = lastRealBaseIdx + 1; i < base.length; i++) {
      const d = base[i].dia;
      const raw = projectForDia(d);
      maxProj = Math.max(maxProj, raw);
      base[i].proyeccion = maxProj;
    }

    // If projection hasn't reached 100% by end of schedule, extend beyond
    const lastBaseProj = base[base.length - 1].proyeccion;
    if (lastBaseProj !== null && lastBaseProj < 99.5) {
      const lastBaseDia = base[base.length - 1].dia;
      const projInterval = 7;
      let prevProj = lastBaseProj;
      for (let d = lastBaseDia + projInterval; d <= diaFinalProyectado; d += projInterval) {
        // Beyond schedule: increment from last projected value by EWMA rate
        const projValue = Math.min(100, Math.round((prevProj + tasaDiariaEWMA * projInterval) * 100) / 100);
        prevProj = projValue;
        let fechaDD = `Día ${d}`;
        let fechaShort = `D${d}`;
        if (lastRealDate) {
          const projDate = new Date(lastRealDate.getTime() + (d - lastDia) * 86400000);
          fechaDD = formatShortDate(projDate);
          fechaShort = formatShortDate(projDate);
        }
        base.push({ dia: d, fechaDD, fechaShort, programado: null as any, real: null, proyeccion: projValue });
        if (projValue >= 100) break;
      }
    } else if (lastBaseProj !== null && lastBaseProj >= 99.5) {
      // Close enough to 100% — snap to 100% and skip extension
      base[base.length - 1].proyeccion = 100;
    }

    // Ensure the very last point reaches exactly 100%
    const lastProj = base[base.length - 1];
    if (!lastProj.proyeccion || lastProj.proyeccion < 100) {
      let fechaDD = `Día ${diaFinalProyectado}`;
      let fechaShort = `D${diaFinalProyectado}`;
      if (lastRealDate) {
        const endDate = new Date(lastRealDate.getTime() + (diaFinalProyectado - lastDia) * 86400000);
        fechaDD = formatShortDate(endDate);
        fechaShort = formatShortDate(endDate);
      }
      base.push({ dia: diaFinalProyectado, fechaDD, fechaShort, programado: null as any, real: null, proyeccion: 100 });
    }

    return base;
  }, [dayEntries, hasRealData]);

  // Filtered observations
  const observations = useMemo(() => {
    const rows = dayEntries.filter(e => {
      if (showOnlyPending) {
        return e.observaciones || (e.rfi && !e.rptaRfi) || (e.rnc && !e.rncLevantada);
      }
      return e.observaciones || e.rfi || e.rnc || e.superado || e.completo;
    });
    return rows;
  }, [dayEntries, showOnlyPending]);

  if (contractsWithAvance.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <CalendarDays className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Avance Diario de Obra</h2>
          <p className="text-muted-foreground max-w-md">
            No se encontraron datos de avance. Cargue un archivo Excel con la hoja <strong>E_avance</strong> para visualizar el dashboard de avance diario.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Avance Diario de Obra
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Curva S, indicadores y observaciones por contrato
            </p>
          </div>

          <Select value={activeContract} onValueChange={setSelectedContract}>
            <SelectTrigger className="w-[320px]">
              <SelectValue placeholder="Seleccionar contrato" />
            </SelectTrigger>
            <SelectContent>
              {contractsWithAvance.map(c => (
                <SelectItem key={c.contractId} value={c.contractId}>
                  {c.contractId}{c.description ? ` - ${c.description.slice(0, 40)}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard
            title="Programado Acum."
            value={`${kpis.programadoActual.toFixed(1)}%`}
            icon={<Target className="h-4 w-4" />}
            color="blue"
            subtitle={kpis.ultimaFecha ? `al ${kpis.ultimaFecha}` : undefined}
          />
          <KpiCard
            title="Real Acum."
            value={`${kpis.realActual.toFixed(1)}%`}
            icon={<ClipboardCheck className="h-4 w-4" />}
            color={kpis.realActual >= kpis.programadoActual ? "green" : "amber"}
            subtitle={kpis.ultimaFecha ? `al ${kpis.ultimaFecha}` : undefined}
          />
          <KpiCard
            title="Desviacion"
            value={`${kpis.desviacion >= 0 ? '+' : ''}${kpis.desviacion.toFixed(1)}%`}
            icon={kpis.desviacion >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            color={kpis.desviacion >= 0 ? "green" : "red"}
            subtitle={kpis.desviacion >= 0 ? "Adelantado" : "Atrasado"}
          />
          <KpiCard
            title="SPI"
            value={kpis.spi.toFixed(2)}
            icon={<Gauge className="h-4 w-4" />}
            color={kpis.spi >= 1 ? "green" : kpis.spi >= 0.9 ? "amber" : "red"}
            subtitle={kpis.spi >= 1 ? "En plazo" : kpis.spi >= 0.9 ? "Riesgo" : "Critico"}
          />
          <KpiCard
            title="RFI / RNC Abiertos"
            value={`${kpis.rfisAbiertos} / ${kpis.rncsAbiertos}`}
            icon={<AlertTriangle className="h-4 w-4" />}
            color={(kpis.rfisAbiertos + kpis.rncsAbiertos) > 0 ? "amber" : "green"}
            subtitle={`${kpis.diasRegistrados} dias registrados`}
          />
        </div>

        {/* S-Curve Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Curva S - Avance Acumulado</CardTitle>
            {hasRealData && (
              <p className="text-[11px] text-muted-foreground leading-tight mt-1">
                Proyección = w<sub>SPI</sub> · (Acum<sub>real</sub> + SPI · ΔProg) + w<sub>EWMA</sub> · (Acum<sub>real</sub> + tasa · Δt) — peso SPI mayor al inicio, peso EWMA crece con más datos.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={curveData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="dia"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(dia: number) => {
                    const point = curveData.find(p => p.dia === dia);
                    return point?.fechaShort || `D${dia}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const labels: Record<string, string> = {
                      programado: 'Programado',
                      real: 'Real',
                      proyeccion: 'Proyección (SPI + ritmo)',
                    };
                    return [
                      `${value != null ? Number(value).toFixed(2) : '-'}%`,
                      labels[name] || name,
                    ];
                  }}
                  labelFormatter={(_label: any, payload: any) => {
                    if (payload && payload.length > 0) {
                      return payload[0]?.payload?.fechaDD || _label;
                    }
                    return _label;
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      programado: 'Programado',
                      real: 'Real',
                      proyeccion: 'Proyección (SPI + ritmo)',
                    };
                    return labels[value] || value;
                  }}
                />
                <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="programado"
                  fill="hsl(217, 91%, 60%)"
                  fillOpacity={0.08}
                  stroke="none"
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="programado"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="programado"
                />
                {hasRealData && (
                  <Line
                    type="monotone"
                    dataKey="real"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: "hsl(142, 71%, 45%)" }}
                    connectNulls={false}
                    name="real"
                  />
                )}
                {hasRealData && (
                  <Line
                    type="monotone"
                    dataKey="proyeccion"
                    stroke="hsl(25, 95%, 53%)"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    dot={{ r: 3, fill: "hsl(25, 95%, 53%)", strokeWidth: 0 }}
                    connectNulls
                    name="proyeccion"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekly Progress Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Avance por Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="semana" tick={{ fontSize: 12 }} tickFormatter={(v) => `Sem ${v}`} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}%`,
                    name === 'programado' ? 'Programado' : 'Real',
                  ]}
                  labelFormatter={(v) => `Semana ${v}`}
                />
                <Legend formatter={(value) => value === 'programado' ? 'Programado' : 'Real'} />
                <Bar dataKey="programado" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="programado" />
                {hasRealData && (
                  <Bar dataKey="real" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="real" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Observations Table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Observaciones y Pendientes</CardTitle>
              <Button
                variant={showOnlyPending ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOnlyPending(!showOnlyPending)}
                className="gap-2"
              >
                {showOnlyPending ? <EyeOff className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
                {showOnlyPending ? "Mostrando Pendientes" : "Filtrar Pendientes"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {observations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>{showOnlyPending ? "No hay observaciones pendientes" : "No hay observaciones registradas"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Dia</TableHead>
                      <TableHead className="w-[90px]">Fecha</TableHead>
                      <TableHead className="min-w-[200px]">Observacion</TableHead>
                      <TableHead className="w-[90px]">Superado</TableHead>
                      <TableHead className="w-[80px]">Completo</TableHead>
                      <TableHead className="w-[90px]">RFI</TableHead>
                      <TableHead className="w-[90px]">Rpta RFI</TableHead>
                      <TableHead className="w-[80px]">Plazo</TableHead>
                      <TableHead className="w-[80px]">RNC</TableHead>
                      <TableHead className="w-[100px]">RNC Levantada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {observations.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{e.dia}</TableCell>
                        <TableCell className="text-xs">
                          {e.fecha ? formatShortDate(e.fecha) : e.fechaStr.slice(0, 15)}
                        </TableCell>
                        <TableCell className="text-sm">{e.observaciones || '-'}</TableCell>
                        <TableCell>
                          {e.superado && <StatusBadge value={e.superado} />}
                        </TableCell>
                        <TableCell>
                          {e.completo && <CompletoIndicator value={e.completo} />}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{e.rfi || '-'}</TableCell>
                        <TableCell className="text-xs font-mono">{e.rptaRfi || '-'}</TableCell>
                        <TableCell>
                          {e.dentroDePlazo && <PlazoIndicator value={e.dentroDePlazo} />}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{e.rnc || '-'}</TableCell>
                        <TableCell className="text-xs font-mono">{e.rncLevantada || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

// ---------- Sub-components ----------

function KpiCard({ title, value, icon, color, subtitle }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "red" | "amber";
  subtitle?: string;
}) {
  const colors = {
    blue: "text-blue-600 bg-blue-50 border-blue-200",
    green: "text-green-600 bg-green-50 border-green-200",
    red: "text-red-600 bg-red-50 border-red-200",
    amber: "text-amber-600 bg-amber-50 border-amber-200",
  };
  const iconColors = {
    blue: "text-blue-500",
    green: "text-green-500",
    red: "text-red-500",
    amber: "text-amber-500",
  };

  return (
    <Card className={cn("border", colors[color])}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={iconColors[color]}>{icon}</span>
          <span className="text-xs font-medium text-muted-foreground truncate">{title}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ value }: { value: string }) {
  const lower = value.toLowerCase();
  if (lower.includes('aceptado') || lower.includes('si')) {
    return <Badge variant="default" className="bg-green-100 text-green-800 text-[10px]">{value}</Badge>;
  }
  if (lower.includes('revisar') || lower.includes('parcial')) {
    return <Badge variant="default" className="bg-amber-100 text-amber-800 text-[10px]">{value}</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">{value}</Badge>;
}

function CompletoIndicator({ value }: { value: string }) {
  const lower = value.toLowerCase();
  if (lower === 'parcial') {
    return <Badge variant="default" className="bg-amber-100 text-amber-800 text-[10px]">Parcial</Badge>;
  }
  if (lower === 'impacto') {
    return <Badge variant="default" className="bg-red-100 text-red-800 text-[10px]">Impacto</Badge>;
  }
  if (lower.includes('completo') || lower === 'si') {
    return <Badge variant="default" className="bg-green-100 text-green-800 text-[10px]">Completo</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">{value}</Badge>;
}

function PlazoIndicator({ value }: { value: string }) {
  const lower = value.toLowerCase();
  if (lower.includes('atendido') || lower.includes('dentro')) {
    return <Badge variant="default" className="bg-green-100 text-green-800 text-[10px]">{value}</Badge>;
  }
  if (lower.includes('fuera') || lower.includes('vencido')) {
    return <Badge variant="default" className="bg-red-100 text-red-800 text-[10px]">{value}</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">{value}</Badge>;
}
