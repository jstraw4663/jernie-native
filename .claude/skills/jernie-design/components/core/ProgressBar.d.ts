/** Wizard progress (segments) or trip completeness (value). Disappears at 100% and never returns. */
export interface ProgressBarProps {
  /** 0-100, for a continuous bar */
  value?: number;
  /** discrete step segments, for the onboarding wizard */
  segments?: { total: number; done: number };
  height?: number;
}
export declare function ProgressBar(props: ProgressBarProps): JSX.Element;
