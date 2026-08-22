/**
 * A hole in the plan, rendered as a row rather than an absence: a stop with no
 * stay, or a stop the rental car does not reach. Always carries its own action.
 */
export interface GapRowProps {
  /** "Nowhere to sleep in Southwest Harbor" */
  title: string;
  /** "May 27 – 29 · 2 nights unbooked" */
  sub: string;
  action?: string;
  onAction?: () => void;
}
export declare function GapRow(props: GapRowProps): JSX.Element;
