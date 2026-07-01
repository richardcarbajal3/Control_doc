import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EXECUTIVE_KPIS, type ExecutiveKpiDef } from './specialized-sheets-config';
import { fetchKpis, saveKpis } from './analysis-api';

interface KpiConfigState {
  customKpis: ExecutiveKpiDef[] | null;
  addKpi: (kpi: ExecutiveKpiDef) => void;
  updateKpi: (index: number, kpi: ExecutiveKpiDef) => void;
  removeKpi: (index: number) => void;
  resetToDefaults: () => void;
  // Trae la config guardada en el backend (compartida por la organización).
  // localStorage queda como caché instantánea; el servidor manda.
  hydrateFromServer: () => Promise<void>;
}

// Guarda en el backend sin bloquear la UI; si falla, la config sigue viva
// en localStorage como hasta ahora.
function pushToServer(kpis: ExecutiveKpiDef[] | null) {
  saveKpis(kpis).catch((e) => console.warn('No se pudo guardar la config de KPIs:', e));
}

export const useKpiConfigStore = create<KpiConfigState>()(
  persist(
    (set, get) => ({
      customKpis: null,

      addKpi: (kpi) =>
        set((s) => {
          const customKpis = [...(s.customKpis ?? [...EXECUTIVE_KPIS]), kpi];
          pushToServer(customKpis);
          return { customKpis };
        }),

      updateKpi: (index, kpi) =>
        set((s) => {
          const list = [...(s.customKpis ?? [...EXECUTIVE_KPIS])];
          list[index] = kpi;
          pushToServer(list);
          return { customKpis: list };
        }),

      removeKpi: (index) =>
        set((s) => {
          const list = [...(s.customKpis ?? [...EXECUTIVE_KPIS])];
          list.splice(index, 1);
          pushToServer(list);
          return { customKpis: list };
        }),

      resetToDefaults: () => {
        pushToServer(null);
        set({ customKpis: null });
      },

      hydrateFromServer: async () => {
        try {
          const kpis = await fetchKpis();
          if (kpis) set({ customKpis: kpis });
        } catch (e) {
          console.warn('No se pudo recuperar la config de KPIs:', e);
        }
      },
    }),
    { name: 'kpi-config' }
  )
);

/** Returns the user's custom KPIs or the built-in defaults */
export function getEffectiveKpis(state: KpiConfigState): ExecutiveKpiDef[] {
  return state.customKpis ?? EXECUTIVE_KPIS;
}
