import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface LawTab {
  lawId: string;
  title: string;
}

interface TabsState {
  tabs: LawTab[];
  open: (tab: LawTab) => void;
  close: (lawId: string) => void;
  rename: (lawId: string, title: string) => void;
}

export const useTabs = create<TabsState>()(
  persist(
    (set) => ({
      tabs: [],
      open: (tab) =>
        set((s) => {
          const existing = s.tabs.find((t) => t.lawId === tab.lawId);
          if (existing) {
            // refresh title in case it changed
            return existing.title === tab.title
              ? s
              : {
                  tabs: s.tabs.map((t) =>
                    t.lawId === tab.lawId ? { ...t, title: tab.title } : t,
                  ),
                };
          }
          return { tabs: [...s.tabs, tab] };
        }),
      close: (lawId) =>
        set((s) => ({ tabs: s.tabs.filter((t) => t.lawId !== lawId) })),
      rename: (lawId, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.lawId === lawId ? { ...t, title } : t)),
        })),
    }),
    {
      name: 'elaws.tabs',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
