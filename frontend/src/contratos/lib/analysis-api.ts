// Cliente del backend para el módulo Análisis (/api/analysis).
// El token de sesión lo agrega el wrapper global instalado en main.jsx
// (installAuthFetch), así que aquí basta con fetch normal.
import type { ContractData, ConsolidatedContract, SpecializedSheetLog } from './excel-processor';
import type { ExecutiveKpiDef } from './specialized-sheets-config';

export interface AnalysisSnapshot {
  contracts: ContractData[];
  consolidated: ConsolidatedContract[];
  specializedSheetLogs: SpecializedSheetLog[];
}

export interface ContractMatch {
  id: number;
  code: string;
  title: string;
  status: string;
  currency: string;
  amount: string | number | null;
  contractor_name: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchKpis(): Promise<ExecutiveKpiDef[] | null> {
  const body = await json<{ kpis: ExecutiveKpiDef[] | null }>(await fetch('/api/analysis/kpis'));
  return body.kpis ?? null;
}

export async function saveKpis(kpis: ExecutiveKpiDef[] | null): Promise<void> {
  await json(await fetch('/api/analysis/kpis', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kpis }),
  }));
}

export async function fetchSnapshot(): Promise<{ data: AnalysisSnapshot | null; fileName?: string; updatedAt?: string }> {
  const body = await json<{ data: AnalysisSnapshot | null; file_name?: string; updated_at?: string }>(
    await fetch('/api/analysis/snapshot')
  );
  return { data: body.data ?? null, fileName: body.file_name, updatedAt: body.updated_at };
}

export async function saveSnapshot(fileName: string | null, data: AnalysisSnapshot): Promise<void> {
  await json(await fetch('/api/analysis/snapshot', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, data }),
  }));
}

export async function deleteSnapshot(): Promise<void> {
  await json(await fetch('/api/analysis/snapshot', { method: 'DELETE' }));
}

export async function matchContracts(codes: string[]): Promise<Record<string, ContractMatch>> {
  if (codes.length === 0) return {};
  const body = await json<{ matches: Record<string, ContractMatch> }>(
    await fetch('/api/analysis/contract-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes }),
    })
  );
  return body.matches || {};
}
