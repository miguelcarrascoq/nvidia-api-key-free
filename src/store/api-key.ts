'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'nvidia-api-key';

type ApiKeyState = {
  apiKey: string;
  hasHydrated: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setHasHydrated: (value: boolean) => void;
};

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      apiKey: '',
      hasHydrated: false,
      setApiKey: (key) => set({ apiKey: key.trim() }),
      clearApiKey: () => set({ apiKey: '' }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ apiKey: state.apiKey }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate API key store', error);
        }
        // Use the rehydrated state API — do not reference useApiKeyStore here
        // (callback can run during create(), before the export is assigned).
        state?.setHasHydrated(true);
      },
    },
  ),
);
