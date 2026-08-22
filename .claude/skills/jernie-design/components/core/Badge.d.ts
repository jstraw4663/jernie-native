/** Status on a row: Booked, Next, Open, Ends, Suggested. Two words maximum. */
export interface BadgeProps {
  label: string;
  /** accent = secured · warning = unfinished · neutral = past or informational */
  tone?: 'accent' | 'warning' | 'neutral' | 'solid';
}
export declare function Badge(props: BadgeProps): JSX.Element;
