import Constants from 'expo-constants';

// Bump this when a significant milestone lands, matching this repo's plan-doc
// naming convention (e.g. docs/superpowers/plans/2026-07-06-data-model-foundation.md).
// It's just a human-readable label — the git branch/commit below is what actually
// proves which code is running, since this string won't auto-update.
export const MILESTONE = 'data-model-foundation';

export interface BuildInfo {
  gitBranch: string;
  gitSha: string;
  gitDirty: boolean;
  builtAt: string;
}

const FALLBACK_BUILD_INFO: BuildInfo = {
  gitBranch: 'unknown',
  gitSha: 'unknown',
  gitDirty: false,
  builtAt: 'unknown',
};

export function getBuildInfo(): BuildInfo {
  const extra = Constants.expoConfig?.extra as { build?: BuildInfo } | undefined;
  return extra?.build ?? FALLBACK_BUILD_INFO;
}

/** e.g. "data-model-foundation · feat/data-model-foundation@8e6f2a2 (dirty)" */
export function getBuildLabel(): string {
  const { gitBranch, gitSha, gitDirty } = getBuildInfo();
  return `${MILESTONE} · ${gitBranch}@${gitSha}${gitDirty ? ' (dirty)' : ''}`;
}
