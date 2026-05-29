import React, { createContext, useContext, useState } from 'react';

// Tracks how many bottom sheets are currently open.
// StopNavigator checks this before allowing drag gestures.

interface SheetContextValue {
  openCount: number;
  increment: () => void;
  decrement: () => void;
}

const SheetContext = createContext<SheetContextValue>({
  openCount: 0,
  increment: () => {},
  decrement: () => {},
});

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [openCount, setOpenCount] = useState(0);
  const increment = () => setOpenCount((n) => n + 1);
  const decrement = () => setOpenCount((n) => Math.max(0, n - 1));
  return (
    <SheetContext.Provider value={{ openCount, increment, decrement }}>
      {children}
    </SheetContext.Provider>
  );
}

export function useSheetContext(): SheetContextValue {
  return useContext(SheetContext);
}
