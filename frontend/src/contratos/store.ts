import { create } from 'zustand';
import { ContractData, ConsolidatedContract, SpecializedSheetLog } from './lib/excel-processor';
import { fetchSnapshot, saveSnapshot, deleteSnapshot } from './lib/analysis-api';

interface AppState {
  contracts: ContractData[];
  consolidated: ConsolidatedContract[];
  specializedSheetLogs: SpecializedSheetLog[];
  lastUpdated: Date | null;
  fileName: string | null;
  // true mientras se intenta recuperar el último snapshot guardado en el backend
  hydrating: boolean;
  setData: (
    contracts: ContractData[],
    consolidated: ConsolidatedContract[],
    specializedSheetLogs?: SpecializedSheetLog[],
    fileName?: string | null,
  ) => void;
  hydrateFromServer: () => Promise<void>;
  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  contracts: [],
  consolidated: [],
  specializedSheetLogs: [],
  lastUpdated: null,
  fileName: null,
  hydrating: true,

  setData: (contracts, consolidated, specializedSheetLogs = [], fileName = null) => {
    set({ contracts, consolidated, specializedSheetLogs, fileName, lastUpdated: new Date(), hydrating: false });
    // Persistencia en segundo plano: si falla (p.ej. sin org asignada), el
    // dashboard sigue funcionando igual que antes, solo que sin sobrevivir recargas.
    saveSnapshot(fileName, { contracts, consolidated, specializedSheetLogs }).catch((e) =>
      console.warn('No se pudo guardar el snapshot de análisis:', e)
    );
  },

  hydrateFromServer: async () => {
    // Solo hidratar si aún no hay datos cargados en esta sesión.
    if (get().contracts.length > 0) {
      set({ hydrating: false });
      return;
    }
    try {
      const snap = await fetchSnapshot();
      if (snap.data && Array.isArray(snap.data.contracts) && snap.data.contracts.length > 0) {
        set({
          contracts: snap.data.contracts,
          consolidated: snap.data.consolidated || [],
          specializedSheetLogs: snap.data.specializedSheetLogs || [],
          fileName: snap.fileName || null,
          lastUpdated: snap.updatedAt ? new Date(snap.updatedAt) : null,
        });
      }
    } catch (e) {
      console.warn('No se pudo recuperar el snapshot de análisis:', e);
    } finally {
      set({ hydrating: false });
    }
  },

  reset: () => {
    set({ contracts: [], consolidated: [], specializedSheetLogs: [], fileName: null, lastUpdated: null });
    deleteSnapshot().catch(() => {});
  },
}));
