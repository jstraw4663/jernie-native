import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTripContext } from '@/src/contexts/TripContext';
import { getExploreDefaultStopId, type ExploreFilters, type FilterId, type SortKey } from '@/src/domain/explore';

export interface ExploreFilterContextValue {
  filters: ExploreFilters;
  setStop: (id: string | 'all') => void;
  setCategory: (id: FilterId) => void;
  setSearch: (q: string) => void;
  setMustOnly: (on: boolean) => void;
  setSort: (s: SortKey) => void;
  reset: () => void;
}

const ExploreFilterContext = createContext<ExploreFilterContextValue | null>(null);

export function useExploreFilters(): ExploreFilterContextValue {
  const ctx = useContext(ExploreFilterContext);
  if (!ctx) throw new Error('useExploreFilters must be used inside ExploreFilterProvider');
  return ctx;
}

const DEFAULT_CATEGORY: FilterId = 'all';
const DEFAULT_SEARCH = '';
const DEFAULT_MUST_ONLY = false;
const DEFAULT_SORT: SortKey = 'rating';

interface ExploreFilterProviderProps {
  children: ReactNode;
}

/**
 * Holds the Explore tab's filter state for the whole trip shell — Session 8's Map tab
 * consumes it unchanged. Not persisted: MMKV is for "last-used filters" generally, but a
 * stop default that's supposed to track where the traveller is *right now* would go stale
 * the moment they sleep somewhere else, so this is in-memory for the session only.
 */
export function ExploreFilterProvider({ children }: ExploreFilterProviderProps) {
  const { stops } = useTripContext();

  // `stops` arrives asynchronously from RTDB (the provider first mounts with an empty
  // array), so the initial derivation almost always falls back to 'all' and gets
  // corrected by the effect below once real stops land.
  const [stopId, setStopId] = useState<string | 'all'>(
    () => getExploreDefaultStopId(stops, new Date()) ?? 'all',
  );
  const [category, setCategory] = useState<FilterId>(DEFAULT_CATEGORY);
  const [search, setSearch] = useState(DEFAULT_SEARCH);
  const [mustOnly, setMustOnly] = useState(DEFAULT_MUST_ONLY);
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);

  // Set by setStop; read (never as a dependency) inside the re-derivation effect so a
  // late RTDB update can't clobber a choice the traveller already made.
  const userChoseStop = useRef(false);

  // Keyed on the stop list going from empty to populated — not on `stops`' identity, which
  // RTDB changes on every update — so this fires exactly once, when real data first lands.
  const stopsKey = stops.length > 0 ? stops.map(s => s.id).join(',') : '';

  useEffect(() => {
    if (userChoseStop.current) return;
    if (stops.length === 0) return;
    const defaultId = getExploreDefaultStopId(stops, new Date());
    setStopId(defaultId ?? 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey]);

  const setStop = useCallback((id: string | 'all') => {
    userChoseStop.current = true;
    setStopId(id);
  }, []);

  const reset = useCallback(() => {
    // A reset that left userChoseStop true would permanently freeze the store against
    // re-derivation — the whole point of the ref is to let a fresh session re-derive.
    userChoseStop.current = false;
    setStopId(getExploreDefaultStopId(stops, new Date()) ?? 'all');
    setCategory(DEFAULT_CATEGORY);
    setSearch(DEFAULT_SEARCH);
    setMustOnly(DEFAULT_MUST_ONLY);
    setSort(DEFAULT_SORT);
  }, [stops]);

  const filters: ExploreFilters = useMemo(
    () => ({ stopId, category, search, mustOnly, sort }),
    [stopId, category, search, mustOnly, sort],
  );

  const value: ExploreFilterContextValue = useMemo(
    () => ({ filters, setStop, setCategory, setSearch, setMustOnly, setSort, reset }),
    [filters, setStop, reset],
  );

  return (
    <ExploreFilterContext.Provider value={value}>
      {children}
    </ExploreFilterContext.Provider>
  );
}
