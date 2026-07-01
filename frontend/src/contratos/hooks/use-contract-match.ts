import { useQuery } from '@tanstack/react-query';
import { matchContracts, type ContractMatch } from '@/lib/analysis-api';

// Cruza los N° CONTRATO del Excel con el módulo Contratos (solo lectura).
// Devuelve un mapa código → contrato registrado; vacío mientras carga o si falla.
export function useContractMatch(codes: string[]): Record<string, ContractMatch> {
  const key = [...new Set(codes)].sort().join('|');
  const { data } = useQuery({
    queryKey: ['analysis-contract-match', key],
    queryFn: () => matchContracts(codes),
    enabled: codes.length > 0,
  });
  return data || {};
}
