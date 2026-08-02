import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { ResolvedStop } from '@/src/features/jernie/StopForm';
import type { SetupIntent } from '@/src/types';

// All four booking types default to "on" — Step 4's tiles start selected, matching the design
// doc's "assume the traveler wants a checklist for everything, let them opt out" intent.
const DEFAULT_SETUP_INTENT: SetupIntent = { flights: true, stays: true, car: true, restaurants: true };

export interface OnboardingDraft {
  name: string;
  organizerHandle: string;
  pills: string[];
  firstStop: ResolvedStop | null;
  setupIntent: SetupIntent;
}

export interface OnboardingDraftContextValue {
  draft: OnboardingDraft;
  setName: (name: string) => void;
  setOrganizerHandle: (handle: string) => void;
  setPills: (pills: string[]) => void;
  setFirstStop: (stop: ResolvedStop) => void;
  setSetupIntent: (intent: SetupIntent) => void;
}

const OnboardingDraftContext = createContext<OnboardingDraftContextValue | null>(null);

export function useOnboardingDraft(): OnboardingDraftContextValue {
  const ctx = useContext(OnboardingDraftContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used inside OnboardingDraftProvider');
  return ctx;
}

/**
 * In-memory-only wizard draft, scoped to the onboarding Stack (mounted once in
 * app/onboarding/_layout.tsx, above the Stack, so it survives step-to-step navigation but is
 * torn down — losing all state, by design — the moment the user leaves the onboarding flow
 * entirely). Nothing here ever touches RTDB; the only write happens in step-4.tsx's final
 * createTrip() call. Backing out of the wizard, or the app dying mid-flow, leaves zero orphan
 * data because nothing was ever persisted in the first place.
 */
export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('');
  const [organizerHandle, setOrganizerHandle] = useState('');
  const [pills, setPills] = useState<string[]>([]);
  const [firstStop, setFirstStop] = useState<ResolvedStop | null>(null);
  const [setupIntent, setSetupIntent] = useState<SetupIntent>(DEFAULT_SETUP_INTENT);

  const value: OnboardingDraftContextValue = {
    draft: { name, organizerHandle, pills, firstStop, setupIntent },
    setName,
    setOrganizerHandle,
    setPills,
    setFirstStop,
    setSetupIntent,
  };

  return (
    <OnboardingDraftContext.Provider value={value}>
      {children}
    </OnboardingDraftContext.Provider>
  );
}
