/** Counts that stand as a record of travel — the Profile passport header. Three or four, never more. */
export interface StatStripProps {
  stats: { value: string; label: string }[];
  /** true when sitting on a photo scrim */
  onPhoto?: boolean;
}
export declare function StatStrip(props: StatStripProps): JSX.Element;
