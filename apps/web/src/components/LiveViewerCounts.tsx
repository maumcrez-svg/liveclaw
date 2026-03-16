'use client';

import { createContext, useContext } from 'react';
import { useViewerCounts } from '@/hooks/useViewerCounts';

const ViewerCountsContext = createContext<Map<string, number>>(new Map());

export function LiveViewerCountsProvider({ children }: { children: React.ReactNode }) {
  const counts = useViewerCounts();
  return (
    <ViewerCountsContext.Provider value={counts}>
      {children}
    </ViewerCountsContext.Provider>
  );
}

export function useLiveViewerCounts() {
  return useContext(ViewerCountsContext);
}
